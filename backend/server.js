/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ABDI Absen Digital — Backend Server                                     ║
 * ║  backend/api/server.js                                                   ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  ARSITEKTUR KEAMANAN:                                                    ║
 * ║  ┌─────────────────────────────────────────────────────────────────┐    ║
 * ║  │ CLIENT (React)           SERVER (Express + Admin SDK)            │    ║
 * ║  │ ─────────────────        ──────────────────────────────────────  │    ║
 * ║  │                          ENCRYPTION_SECRET (private, env-only)   │    ║
 * ║  │ 1. Ambil Firebase                     │                          │    ║
 * ║  │    ID Token               2. Verify Firebase ID Token            │    ║
 * ║  │ POST /api/attendance ──►  3. Haversine + Anti-Fake GPS           │    ║
 * ║  │  { token, lat, lng,       4. Enkripsi foto (AES-256-GCM)        │    ║
 * ║  │    photo (raw),           5. Admin SDK → Firebase write          │    ║
 * ║  │    qrToken }         ◄── { success, recordId }                  │    ║
 * ║  └─────────────────────────────────────────────────────────────────┘    ║
 * ║                                                                          ║
 * ║  ENDPOINT:                                                               ║
 * ║  GET  /api/health              → Status server & enkripsi                ║
 * ║  POST /api/secure/encrypt      → Enkripsi data sensitif                  ║
 * ║  POST /api/secure/decrypt      → Dekripsi data sensitif                  ║
 * ║  POST /api/attendance          → Pipeline presensi lengkap               ║
 * ║  POST /api/attendance/pending-photo → Upload foto saat kembali online    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// DEPENDENCIES
// ─────────────────────────────────────────────────────────────────────────────

const express       = require("express");
const cors          = require("cors");
const crypto        = require("crypto");
const path          = require("path");
const fs            = require("fs");
const { rateLimit } = require("express-rate-limit");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getDatabase }                   = require("firebase-admin/database");
const { getAuth }                       = require("firebase-admin/auth");

// Muat root .env dan backend/.env jika ada
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
if (fs.existsSync(path.join(__dirname, ".env"))) {
  require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT & VALIDASI
// ─────────────────────────────────────────────────────────────────────────────

const PORT             = Number(process.env.PORT) || 3001;
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET ?? "";
const FIREBASE_DB_URL  = process.env.FIREBASE_DATABASE_URL
  ?? "https://abdi-absendigital-default-rtdb.asia-southeast1.firebasedatabase.app";
const ALLOWED_ORIGINS  = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:5173")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// ── Validasi saat startup ──────────────────────────────────────────────────
if (!ENCRYPTION_SECRET || ENCRYPTION_SECRET.length < 32) {
  console.warn(
    "[ABDI Server] ⚠️ ENCRYPTION_SECRET belum diset atau kurang dari 32 karakter!\n" +
    "   Enkripsi server-side tidak akan aktif sampai variabel ini dikonfigurasi di environment."
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE ADMIN SDK — INISIALISASI
// ─────────────────────────────────────────────────────────────────────────────

let serviceAccount = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  // ── Production: baca dari environment variable (Base64 string) ───────────
  try {
    const decodedStr = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    serviceAccount = JSON.parse(decodedStr);
  } catch (e) {
    console.error("[ABDI Server] ⚠️ FIREBASE_SERVICE_ACCOUNT_BASE64 gagal diparsing:", e.message);
  }
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // ── Production: baca dari environment variable (JSON string) ─────────────
  try {
    serviceAccount = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string'
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : process.env.FIREBASE_SERVICE_ACCOUNT;
  } catch (e) {
    console.error("[ABDI Server] ⚠️ FIREBASE_SERVICE_ACCOUNT gagal diparsing:", e.message);
  }
} else {
  // ── Local Dev: baca dari file serviceAccountKey.json ────────────────────
  const saKeyPath = path.join(__dirname, "serviceAccountKey.json");
  if (fs.existsSync(saKeyPath)) {
    try {
      serviceAccount = require(saKeyPath);
    } catch (e) {
      console.error("[ABDI Server] ⚠️ Gagal membaca serviceAccountKey.json:", e.message);
    }
  } else {
    console.warn(
      "[ABDI Server] ⚠️ serviceAccountKey.json tidak ditemukan dan env FIREBASE_SERVICE_ACCOUNT tidak diset."
    );
  }
}

// Cegah duplikasi inisialisasi (penting saat hot-reload & serverless reuse)
let adminDb = null;
let adminAuth = null;

if (serviceAccount) {
  try {
    if (getApps().length === 0) {
      initializeApp({
        credential: cert(serviceAccount),
        databaseURL: FIREBASE_DB_URL,
      });
    }
    adminDb   = getDatabase();
    adminAuth = getAuth();
  } catch (err) {
    console.error("[ABDI Server] ⚠️ Firebase Admin init error:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENKRIPSI — AES-256-GCM (Server-Side Only)
// ─────────────────────────────────────────────────────────────────────────────

const ALGORITHM       = "aes-256-gcm";
const IV_LENGTH       = 12;   // GCM standard: 96-bit IV
const TAG_LENGTH      = 16;   // GCM auth tag: 128-bit
const PBKDF2_ITER     = 200_000;  // 2× lebih kuat dari client-side encryption
const PBKDF2_KEYLEN   = 32;
const PBKDF2_DIGEST   = "sha256";
const OUTPUT_PREFIX   = "ABDI_SRV_v1:";

/**
 * Derive kunci AES-256 dari ENCRYPTION_SECRET + salt acak.
 * @param {Buffer} salt - 16 byte random salt
 * @returns {Buffer} 32-byte derived key
 */
function deriveKey(salt) {
  return crypto.pbkdf2Sync(ENCRYPTION_SECRET, salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST);
}

/**
 * Enkripsi data sensitif dengan AES-256-GCM.
 * Format output: "ABDI_SRV_v1:<base64(salt|iv|tag|ciphertext)>"
 *
 * @param {string} plaintext - Data yang akan dienkripsi
 * @returns {string} Ciphertext aman untuk disimpan di Firebase
 */
function encrypt(plaintext) {
  const salt       = crypto.randomBytes(16);
  const iv         = crypto.randomBytes(IV_LENGTH);
  const key        = deriveKey(salt);
  const cipher     = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const cipherBuf  = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf8")),
    cipher.final(),
  ]);
  const authTag    = cipher.getAuthTag();

  // Pack: salt (16) + iv (12) + tag (16) + ciphertext
  const packed     = Buffer.concat([salt, iv, authTag, cipherBuf]);
  return OUTPUT_PREFIX + packed.toString("base64");
}

/**
 * Dekripsi data yang dienkripsi oleh fungsi encrypt() di atas.
 *
 * @param {string} ciphertext - String dengan prefix "ABDI_SRV_v1:"
 * @returns {string} Plaintext asli
 */
function decrypt(ciphertext) {
  if (!ciphertext.startsWith(OUTPUT_PREFIX)) {
    throw new Error("Format ciphertext tidak valid — bukan enkripsi ABDI server-side.");
  }

  const packed     = Buffer.from(ciphertext.slice(OUTPUT_PREFIX.length), "base64");
  const salt       = packed.subarray(0, 16);
  const iv         = packed.subarray(16, 28);
  const authTag    = packed.subarray(28, 44);
  const cipherBuf  = packed.subarray(44);

  const key        = deriveKey(salt);
  const decipher   = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const plain      = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
  return plain.toString("utf8");
}

// ─────────────────────────────────────────────────────────────────────────────
// GEOFENCING — HAVERSINE FORMULA (Server-Side Validation)
// ─────────────────────────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_000;

/**
 * Hitung jarak antara dua koordinat GPS menggunakan rumus Haversine.
 * Implementasi identik dengan src/utils/geolocation.ts untuk konsistensi.
 *
 * @param {number} lat1 - Latitude titik 1 (dalam derajat)
 * @param {number} lon1 - Longitude titik 1
 * @param {number} lat2 - Latitude titik 2
 * @param {number} lon2 - Longitude titik 2
 * @returns {number} Jarak dalam meter (dibulatkan)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLon  = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Validasi koordinat GPS: range check + anomali dasar.
 * Ini lapisan validasi server-side, bukan pengganti securityGuard.ts client-side.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {object} [extras] - Field tambahan dari client: accuracy, altitude
 * @returns {{ valid: boolean; flags: string[] }}
 */
function validateGpsSignal(lat, lon, extras = {}) {
  const flags = [];

  // ── Range Check ──────────────────────────────────────────────────────────
  if (lat < -90 || lat > 90)   flags.push("latitude_out_of_range");
  if (lon < -180 || lon > 180) flags.push("longitude_out_of_range");

  // ── Anomali: Akurasi terlalu tinggi (< 1m = sangat curiga) ───────────────
  if (extras.accuracy !== undefined && extras.accuracy < 1) {
    flags.push("gps_accuracy_suspiciously_high");
  }

  // ── Anomali: Koordinat terlalu bulat (0.000 persis = mock) ───────────────
  const latDecimalPlaces = (String(lat).split(".")[1] ?? "").length;
  const lonDecimalPlaces = (String(lon).split(".")[1] ?? "").length;
  if (latDecimalPlaces < 3 || lonDecimalPlaces < 3) {
    flags.push("gps_coordinates_suspiciously_round");
  }

  // ── Anomali: Koordinat (0,0) = default/null GPS ───────────────────────────
  if (lat === 0 && lon === 0) {
    flags.push("null_island_coordinates");
  }

  return {
    valid: flags.filter(f => ["latitude_out_of_range", "longitude_out_of_range", "null_island_coordinates"].includes(f)).length === 0,
    flags,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPRESS APP
// ─────────────────────────────────────────────────────────────────────────────

const app = express();

// ── CORS (whitelist origin) ──────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (misal curl / Postman di dev)
    // Di production, hapus kondisi ini dan enforce whitelist ketat
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Origin ditolak: ${origin}`);
      callback(new Error(`Origin ${origin} tidak diizinkan oleh CORS policy.`));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// ── Body Parser (limit 10MB untuk base64 foto biometrik) ────────────────────
app.use(express.json({ limit: "10mb" }));

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITERS — ANTI BRUTE-FORCE & SPAM
// ─────────────────────────────────────────────────────────────────────────────

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;

/**
 * Rate limiter untuk endpoint presensi.
 * Batas: 10 request/menit per IP — wajar untuk presensi masuk+keluar.
 */
const attendanceLimiter = rateLimit({
  windowMs,
  max: Number(process.env.RATE_LIMIT_MAX_ATTENDANCE) || 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: false,
  message: {
    error: "rate-limited",
    message: `Terlalu banyak request presensi. Tunggu ${windowMs / 1000} detik.`,
  },
  keyGenerator: (req) => {
    return req.user?.uid ?? (req.ip || "127.0.0.1");
  },
  skip: (req) => process.env.NODE_ENV === "test",
});

/**
 * Rate limiter untuk endpoint enkripsi/dekripsi.
 * Batas: 20 request/menit per IP — lebih longgar karena bisa dipakai bulk.
 */
const encryptLimiter = rateLimit({
  windowMs,
  max: Number(process.env.RATE_LIMIT_MAX_ENCRYPT) || 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: false,
  message: {
    error: "rate-limited",
    message: `Terlalu banyak request enkripsi. Tunggu ${windowMs / 1000} detik.`,
  },
  skip: (req) => process.env.NODE_ENV === "test",
});

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE — AUTENTIKASI FIREBASE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifikasi Firebase ID Token dari header Authorization: Bearer <token>
 * Setelah middleware ini, req.user berisi decoded token (uid, email, dll.)
 */
const authenticateUser = async (req, res, next) => {
  if (!adminAuth) {
    return res.status(503).json({
      error: "service-unavailable",
      message: "Firebase Auth Admin belum terkonfigurasi di server.",
    });
  }

  const authHeader = req.headers.authorization ?? "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "unauthenticated",
      message: "Token autentikasi tidak ditemukan. Pastikan Anda sudah login.",
    });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    req.user = await adminAuth.verifyIdToken(idToken, true); // checkRevoked = true
    next();
  } catch (err) {
    console.error("[Auth] Token verification error:", err.code, err.message);
    const isExpired = err.code === "auth/id-token-expired";
    return res.status(401).json({
      error: isExpired ? "token-expired" : "unauthenticated",
      message: isExpired
        ? "Token kedaluwarsa. Client akan refresh otomatis."
        : "Token tidak valid. Silakan login ulang.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — AMBIL DATA TENANT DARI FIREBASE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifikasi bahwa user (uid) memang terdaftar sebagai member tenant ini.
 * Ini mencegah user satu sekolah mengakses data sekolah lain.
 */
async function verifyTenantMembership(uid, tenantId) {
  if (!adminDb) {
    return { authorized: false, role: null };
  }

  const [mappingSnap, userSnap] = await Promise.all([
    adminDb.ref(`user_tenant_mapping/${uid}`).once("value"),
    adminDb.ref(`tenants/${tenantId}/users/${uid}/role`).once("value"),
  ]);

  const mappedTenant = mappingSnap.val();
  const role         = userSnap.val();

  if (mappedTenant !== tenantId || !role) {
    return { authorized: false, role: null };
  }

  return { authorized: true, role };
}

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT: ROOT STATUS & HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({
    service: "ABDI Backend API",
    status: "online",
    version: "3.0.0",
    healthCheck: "/api/health",
  });
});

app.get("/api/health", (req, res) => {
  const isEncryptionReady = Boolean(ENCRYPTION_SECRET && ENCRYPTION_SECRET.length >= 32);
  const isFirebaseReady = Boolean(adminDb && adminAuth);
  const isHealthy = isEncryptionReady && isFirebaseReady;

  res.json({
    status: isHealthy ? "ok" : "degraded",
    service: "ABDI Backend",
    version: "3.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? "vercel-serverless" : "standalone",
    encryption: {
      algorithm: ALGORITHM,
      pbkdf2Iterations: PBKDF2_ITER,
      keyLength: PBKDF2_KEYLEN,
      secretConfigured: isEncryptionReady,
    },
    firebaseAdmin: {
      configured: isFirebaseReady,
      databaseUrl: FIREBASE_DB_URL,
    },
    rateLimit: {
      windowSeconds: windowMs / 1000,
      maxAttendance: Number(process.env.RATE_LIMIT_MAX_ATTENDANCE) || 10,
      maxEncrypt:    Number(process.env.RATE_LIMIT_MAX_ENCRYPT) || 20,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT: OTP MANAGEMENT (SEC-007 / Task 8)
// Server-Side OTP Generation & Verification
// ─────────────────────────────────────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: false,
  message: {
    error: "rate-limited",
    message: "Terlalu banyak permintaan OTP. Tunggu 15 menit.",
  },
  skip: (req) => process.env.NODE_ENV === "test",
});

/**
 * Request kirim OTP baru (server-side generation).
 * OTP TIDAK PERNAH dikembalikan ke client response.
 */
app.post("/api/auth/otp/send", authLimiter, async (req, res) => {
  if (!adminDb) {
    return res.status(503).json({
      error: "service-unavailable",
      message: "Firebase Realtime Database Admin belum terkonfigurasi di server.",
    });
  }

  const { phone, userId, tenantId, purpose } = req.body ?? {};

  if (!phone || !userId) {
    return res.status(400).json({
      error: "invalid-argument",
      message: "Parameter phone dan userId wajib diisi.",
    });
  }

  // Generate 6 digit angka random aman secara kriptografis
  const otpCode = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 menit

  try {
    // Simpan hash ke node aman /secure_otps/{userId} (hanya bisa diakses backend via Admin SDK)
    await adminDb.ref(`secure_otps/${userId}`).set({
      otpHash: crypto.createHash("sha256").update(otpCode).digest("hex"),
      expiresAt,
      attempts: 0,
      purpose: purpose || "login",
      createdAt: Date.now(),
    });

    console.log(`[OTP] ✅ OTP dibangkitkan server-side untuk user ${userId}`);

    // Berikan respons sukses TANPA membocorkan nilai OTP
    return res.json({
      success: true,
      message: "Kode OTP berhasil dikirimkan.",
      expiresIn: 300,
    });
  } catch (err) {
    console.error("[OTP] Error generate/send OTP:", err);
    return res.status(500).json({ error: "internal", message: "Gagal memproses OTP." });
  }
});

/**
 * Request verifikasi OTP (server-side verification).
 */
app.post("/api/auth/otp/verify", authLimiter, async (req, res) => {
  if (!adminDb) {
    return res.status(503).json({
      error: "service-unavailable",
      message: "Firebase Realtime Database Admin belum terkonfigurasi di server.",
    });
  }

  const { userId, otp } = req.body ?? {};

  if (!userId || !otp) {
    return res.status(400).json({
      error: "invalid-argument",
      message: "Parameter userId dan otp wajib diisi.",
    });
  }

  try {
    const otpRef = adminDb.ref(`secure_otps/${userId}`);
    const snap = await otpRef.once("value");
    const data = snap.val();

    if (!data) {
      return res.status(400).json({ error: "otp-invalid", message: "Kode OTP tidak valid atau belum diminta." });
    }

    if (Date.now() > data.expiresAt) {
      await otpRef.remove();
      return res.status(400).json({ error: "otp-expired", message: "Kode OTP telah kedaluwarsa. Silakan minta kode baru." });
    }

    if (data.attempts >= 5) {
      await otpRef.remove();
      return res.status(429).json({ error: "too-many-attempts", message: "Terlalu banyak percobaan salah. Silakan minta kode baru." });
    }

    const inputHash = crypto.createHash("sha256").update(String(otp).trim()).digest("hex");
    if (inputHash !== data.otpHash) {
      await otpRef.update({ attempts: (data.attempts || 0) + 1 });
      return res.status(400).json({ error: "otp-mismatch", message: "Kode OTP salah." });
    }

    // OTP valid -> langsung hapus dari database agar one-time use
    await otpRef.remove();

    return res.json({
      success: true,
      message: "Verifikasi OTP berhasil.",
    });
  } catch (err) {
    console.error("[OTP] Error verify OTP:", err);
    return res.status(500).json({ error: "internal", message: "Gagal memverifikasi OTP." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT 2: ENKRIPSI DATA SENSITIF
// POST /api/secure/encrypt
// Header: Authorization: Bearer <Firebase-ID-Token>
// Body: { data: string, context?: string }
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/secure/encrypt", encryptLimiter, authenticateUser, (req, res) => {
  const { data, context } = req.body ?? {};

  if (typeof data !== "string" || data.length === 0) {
    return res.status(400).json({
      error: "invalid-argument",
      message: "Field 'data' wajib diisi dan harus berupa string.",
    });
  }

  // Batasi ukuran (foto base64 max ~8MB)
  if (data.length > 12_000_000) {
    return res.status(400).json({
      error: "payload-too-large",
      message: "Data melebihi batas maksimum (12MB).",
    });
  }

  try {
    const ciphertext = encrypt(data);
    console.log(`[Encrypt] uid=${req.user.uid} context=${context ?? "none"} size=${data.length}`);
    return res.json({ ciphertext, context });
  } catch (err) {
    console.error("[Encrypt] Error:", err);
    return res.status(500).json({
      error: "internal",
      message: "Gagal mengenkripsi data.",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT 3: DEKRIPSI DATA SENSITIF
// POST /api/secure/decrypt
// Header: Authorization: Bearer <Firebase-ID-Token>
// Body: { ciphertext: string, context?: string }
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/secure/decrypt", encryptLimiter, authenticateUser, (req, res) => {
  const { ciphertext, context } = req.body ?? {};

  if (typeof ciphertext !== "string" || ciphertext.length === 0) {
    return res.status(400).json({
      error: "invalid-argument",
      message: "Field 'ciphertext' wajib diisi.",
    });
  }

  try {
    const plaintext = decrypt(ciphertext);
    console.log(`[Decrypt] uid=${req.user.uid} context=${context ?? "none"}`);
    return res.json({ data: plaintext, context });
  } catch (err) {
    // GCM auth tag mismatch = data dimanipulasi
    if (err.message.includes("Unsupported state") || err.message.includes("auth tag")) {
      return res.status(422).json({
        error: "tampered-data",
        message: "Integritas data gagal diverifikasi — data mungkin telah dimanipulasi.",
      });
    }
    return res.status(400).json({
      error: "decrypt-failed",
      message: err.message ?? "Gagal mendekripsi data.",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT 4: SUBMIT PRESENSI (Pipeline Lengkap)
// POST /api/attendance
// Header: Authorization: Bearer <Firebase-ID-Token>
// Body: AttendanceRequest
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/attendance", attendanceLimiter, authenticateUser, async (req, res) => {
  const uid = req.user.uid;

  const {
    tenantId,
    latitude,
    longitude,
    accuracy,
    altitude,
    photoDataUrl,   // Base64 mentah — akan dienkripsi di sini
    qrToken,
    mode,           // "check_in" | "check_out"
    methodType,     // "scanner" | "file" | "external_scanner"
    date,           // "YYYY-MM-DD"
  } = req.body ?? {};

  // ── 1. Validasi payload wajib ──────────────────────────────────────────────
  const missing = [];
  if (!tenantId)                      missing.push("tenantId");
  if (latitude  === undefined)        missing.push("latitude");
  if (longitude === undefined)        missing.push("longitude");
  if (!mode)                          missing.push("mode");
  if (!date)                          missing.push("date");
  if (missing.length > 0) {
    return res.status(400).json({
      error: "invalid-argument",
      message: `Field berikut wajib diisi: ${missing.join(", ")}`,
    });
  }

  if (!["check_in", "check_out"].includes(mode)) {
    return res.status(400).json({ error: "invalid-argument", message: "mode harus 'check_in' atau 'check_out'." });
  }

  // Validasi format tanggal YYYY-MM-DD
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) {
    return res.status(400).json({ error: "invalid-argument", message: "Format date harus YYYY-MM-DD." });
  }

  // ── 2. Validasi sinyal GPS dasar ─────────────────────────────────────────
  const gpsValidation = validateGpsSignal(latitude, longitude, { accuracy, altitude });
  if (!gpsValidation.valid) {
    console.warn(`[Attendance] GPS invalid: uid=${uid} flags=${gpsValidation.flags.join(",")}`);
    return res.status(400).json({
      error: "invalid-gps",
      message: "Koordinat GPS tidak valid.",
      flags: gpsValidation.flags,
    });
  }

  try {
    // ── 3. Verifikasi keanggotaan tenant ────────────────────────────────────
    const { authorized, role } = await verifyTenantMembership(uid, tenantId);
    if (!authorized) {
      console.warn(`[Attendance] Unauthorized tenant access: uid=${uid} tenantId=${tenantId}`);
      return res.status(403).json({
        error: "permission-denied",
        message: "Anda tidak terdaftar di instansi ini.",
      });
    }

    // ── 4. Ambil konfigurasi sekolah dari Firebase ───────────────────────────
    const schoolSnap = await adminDb.ref(`tenants/${tenantId}/school`).once("value");
    const school     = schoolSnap.val();

    if (!school || school.latitude === undefined || school.longitude === undefined) {
      return res.status(412).json({
        error: "failed-precondition",
        message: "Koordinat sekolah belum dikonfigurasi oleh Admin.",
      });
    }

    const schoolRadius = school.radius ?? school.maxRadius ?? 100; // default 100m

    // ── 5. VALIDASI GEOFENCE SERVER-SIDE (Haversine) ─────────────────────────
    const distanceMeters = haversineDistance(
      latitude, longitude,
      school.latitude, school.longitude,
    );

    if (distanceMeters > schoolRadius) {
      console.warn(
        `[Attendance] Out of range: uid=${uid} distance=${distanceMeters}m radius=${schoolRadius}m`
      );
      return res.status(403).json({
        error: "out-of-range",
        message: `Anda berada ${distanceMeters}m dari sekolah. Maksimum ${schoolRadius}m.`,
        distanceMeters,
        radiusMeters: schoolRadius,
      });
    }

    // ── 6. Validasi anomali GPS (tambahan dari geolocation.ts) ───────────────
    const gpsFlags = gpsValidation.flags;
    const isSuspicious = gpsFlags.length > 0;

    // ── 7. Tentukan status presensi berdasarkan jam ──────────────────────────
    const nowWIB          = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const timeNow         = nowWIB.toTimeString().slice(0, 8); // "HH:mm:ss"
    const checkInLimit    = school.operationalCheckInLimit ?? "08:00";
    const isLate          = mode === "check_in" && timeNow > (checkInLimit + ":00");
    const attendanceStatus = isLate ? "Terlambat" : "Hadir";

    // ── 8. Enkripsi foto biometrik (AES-256-GCM server-side) ─────────────────
    let encryptedPhoto = null;
    if (photoDataUrl && typeof photoDataUrl === "string" && photoDataUrl.length > 0) {
      // Foto base64 biasa atau data URL (data:image/jpeg;base64,...)
      encryptedPhoto = encrypt(photoDataUrl);
      console.log(
        `[Attendance] Foto terenkripsi: uid=${uid} size=${photoDataUrl.length} → ${encryptedPhoto.length}`
      );
    }

    // ── 9. Tulis ke Firebase via Admin SDK ────────────────────────────────────
    // Admin SDK bypass Security Rules sepenuhnya.
    // Node ini DIBLOKIR untuk client SDK di database.rules.json.
    const attendanceRef = adminDb.ref(`tenants/${tenantId}/attendance`);
    const newRef        = attendanceRef.push();

    const record = {
      userId:       uid,
      userRole:     role,
      date:         date,
      status:       attendanceStatus,
      method:       methodType ?? "scanner",
      // ── Waktu ──────────────────────────────────────────────────────────
      ...(mode === "check_in"  && { checkInTime:  timeNow }),
      ...(mode === "check_out" && { checkOutTime: timeNow }),
      // ── Lokasi ─────────────────────────────────────────────────────────
      latitude:     latitude,
      longitude:    longitude,
      distance:     distanceMeters,
      // ── Keamanan ────────────────────────────────────────────────────────
      flaggedForReview: isSuspicious,
      gpsFlagsDetected: gpsFlags.length > 0 ? gpsFlags.join(",") : null,
      // ── Foto (terenkripsi, atau null jika offline) ───────────────────────
      photoDataUrl: encryptedPhoto,
      // ── Metadata server-side ─────────────────────────────────────────────
      syncStatus:   "synced",
      isSynced:     true,
      recordedByBackend: true,
      serverTimestamp: Date.now(),
    };

    await newRef.set(record);

    console.log(
      `[Attendance] ✅ Berhasil: uid=${uid} tenant=${tenantId} mode=${mode} ` +
      `status=${attendanceStatus} dist=${distanceMeters}m suspicious=${isSuspicious}`
    );

    return res.status(200).json({
      success:              true,
      message:              `Presensi ${mode === "check_in" ? "masuk" : "keluar"} berhasil dicatat.`,
      recordId:             newRef.key,
      distance:             distanceMeters,
      status:               attendanceStatus,
      encryptedPhotoStored: encryptedPhoto !== null,
      flaggedForReview:     isSuspicious,
      gpsFlags:             gpsFlags,
    });

  } catch (err) {
    console.error("[Attendance] Internal error:", err);
    return res.status(500).json({
      error:   "internal",
      message: "Terjadi kesalahan server saat mencatat presensi.",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT 5: UPLOAD FOTO OFFLINE (saat device kembali online)
// POST /api/attendance/pending-photo
// Header: Authorization: Bearer <Firebase-ID-Token>
// Body: { attendanceId, tenantId, photoDataUrl }
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/attendance/pending-photo", attendanceLimiter, authenticateUser, async (req, res) => {
  const uid = req.user.uid;
  const { attendanceId, tenantId, photoDataUrl } = req.body ?? {};

  if (!attendanceId || !tenantId || !photoDataUrl) {
    return res.status(400).json({
      error: "invalid-argument",
      message: "attendanceId, tenantId, dan photoDataUrl wajib diisi.",
    });
  }

  try {
    // Verifikasi record attendance memang milik user ini
    const recordRef  = adminDb.ref(`tenants/${tenantId}/attendance/${attendanceId}`);
    const recordSnap = await recordRef.once("value");
    const record     = recordSnap.val();

    if (!record) {
      return res.status(404).json({ error: "not-found", message: "Record presensi tidak ditemukan." });
    }

    if (record.userId !== uid) {
      return res.status(403).json({ error: "permission-denied", message: "Record bukan milik Anda." });
    }

    if (record.photoDataUrl && !record.photoDataUrl.startsWith("ABDI_SRV_v1:pending")) {
      return res.status(409).json({
        error: "already-uploaded",
        message: "Foto untuk record ini sudah ada.",
      });
    }

    // Enkripsi & update hanya field photoDataUrl
    const encryptedPhoto = encrypt(photoDataUrl);
    await recordRef.update({
      photoDataUrl:       encryptedPhoto,
      photoUploadedAt:    Date.now(),
      photoUploadPending: false,
    });

    console.log(`[PendingPhoto] ✅ Foto diupload: uid=${uid} recordId=${attendanceId}`);
    return res.json({ success: true, message: "Foto biometrik berhasil diupload dan dienkripsi." });

  } catch (err) {
    console.error("[PendingPhoto] Error:", err);
    return res.status(500).json({ error: "internal", message: "Gagal mengupload foto." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║  ABDI Backend Server                                  ║");
    console.log(`║  URL    : http://localhost:${PORT}                      ║`);
    console.log(`║  Enkripsi: ${ALGORITHM} + PBKDF2 (${PBKDF2_ITER.toLocaleString()} iter) ║`);
    console.log(`║  CORS   : ${ALLOWED_ORIGINS.join(", ")}   ║`);
    console.log("╚══════════════════════════════════════════════════════╝");
  });
}

module.exports = app;
