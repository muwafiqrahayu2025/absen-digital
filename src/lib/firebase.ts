/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  ABDI Absen Digital — Firebase Initialization                    ║
 * ║  src/lib/firebase.ts                                             ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  ARSITEKTUR KEAMANAN — PILAR 4: APP CHECK (reCAPTCHA v3)        ║
 * ║                                                                  ║
 * ║  Firebase App Check memastikan HANYA aplikasi ABDI yang sah      ║
 * ║  (bukan bot/script/postman) yang bisa mengakses Firebase.        ║
 * ║                                                                  ║
 * ║  Provider: reCAPTCHA v3 (invisible, tidak ganggu UX)             ║
 * ║  - Score 0.0 (bot) s/d 1.0 (manusia)                            ║
 * ║  - Threshold default Firebase: ≥ 0.5 diizinkan                  ║
 * ║                                                                  ║
 * ║  ENV yang dibutuhkan:                                            ║
 * ║    VITE_RECAPTCHA_SITE_KEY = site key dari console.recaptcha.com ║
 * ║    VITE_APP_CHECK_DEBUG_TOKEN = debug token untuk development    ║
 * ║                                                                  ║
 * ║  DEPLOYMENT CHECKLIST:                                           ║
 * ║    1. Aktifkan App Check di Firebase Console                     ║
 * ║    2. Daftarkan reCAPTCHA v3 site key                            ║
 * ║    3. Mode: Monitor (2-3 hari) → Enforce                         ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  CustomProvider,
  type AppCheck,
} from "firebase/app-check";

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE CONFIG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ambil env var wajib — throw error jelas jika tidak ada.
 * TIDAK ada hardcoded fallback: credential tidak boleh ter-bundle ke JS production.
 * Jika build gagal di sini, set env var yang sesuai di .env (dev) atau
 * environment variable di platform deployment (Vercel/Netlify/dll).
 */
function requireEnv(key: string): string {
  const val = import.meta.env[key] as string | undefined;
  if (!val || val.trim() === '') {
    const msg = `[ABDI Firebase] Missing required environment variable: ${key}. Pastikan file .env sudah diset dengan benar.`;
    console.error(msg);
    throw new Error(msg);
  }
  return val.trim();
}

const firebaseConfig = {
  apiKey:            requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain:        requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  databaseURL:       requireEnv('VITE_FIREBASE_DATABASE_URL'),
  projectId:         requireEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket:     requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId:             requireEnv('VITE_FIREBASE_APP_ID'),
  // measurementId opsional — Analytics tidak kritis
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZE FIREBASE APP
// ─────────────────────────────────────────────────────────────────────────────

export const app = initializeApp(firebaseConfig);

// ─────────────────────────────────────────────────────────────────────────────
// PILAR 4: FIREBASE APP CHECK — ANTI-BOT & DDoS PROTECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Status App Check untuk monitoring dan Developer Console.
 * Bisa digunakan untuk menampilkan badge keamanan di UI.
 */
export const appCheckStatus: {
  initialized: boolean;
  provider: 'recaptcha-v3' | 'debug' | 'none';
  isDebugMode: boolean;
} = {
  initialized: false,
  provider: 'none',
  isDebugMode: false,
};

export let appCheck: AppCheck | null = null;

/**
 * Inisialisasi Firebase App Check.
 *
 * ALUR INISIALISASI:
 * ┌─────────────────────────────────────────────────────┐
 * │  Ada VITE_RECAPTCHA_SITE_KEY?                        │
 * │  YES → initializeAppCheck(ReCaptchaV3Provider)       │ ← Production
 * │  NO  → Ada VITE_APP_CHECK_DEBUG_TOKEN?               │
 * │         YES → CustomProvider (debug token)           │ ← Development
 * │         NO  → Skip (App Check tidak aktif)           │ ← Dev fallback
 * └─────────────────────────────────────────────────────┘
 *
 * MODE DEBUG (Development):
 * Tambahkan ke .env:
 *   VITE_APP_CHECK_DEBUG_TOKEN=<token dari Firebase Console>
 *
 * Untuk mendapatkan debug token:
 * 1. Set self.FIREBASE_APPCHECK_DEBUG_TOKEN = true di browser console
 * 2. Muat ulang halaman
 * 3. Lihat console — Firebase akan print debug token
 * 4. Daftarkan token tersebut di Firebase Console → App Check → Apps → Debug tokens
 */
function initAppCheck(): void {
  try {
    const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
    const debugToken = import.meta.env.VITE_APP_CHECK_DEBUG_TOKEN as string | undefined;
    const isDev = import.meta.env.DEV === true;

    // ── PRODUCTION: reCAPTCHA v3 ─────────────────────────────────────
    if (recaptchaSiteKey && recaptchaSiteKey !== 'your-recaptcha-v3-site-key') {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        // Auto-refresh token setiap ~60 menit (sebelum expired)
        isTokenAutoRefreshEnabled: true,
      });

      appCheckStatus.initialized = true;
      appCheckStatus.provider = 'recaptcha-v3';
      appCheckStatus.isDebugMode = false;

      console.info(
        '%c🛡️ ABDI App Check: Aktif (reCAPTCHA v3)',
        'color: #22c55e; font-weight: bold;'
      );
      return;
    }

    // ── DEVELOPMENT: Debug Token ──────────────────────────────────────
    if (isDev && debugToken && debugToken.length > 0) {
      // Aktifkan debug mode Firebase App Check
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;

      appCheck = initializeAppCheck(app, {
        provider: new CustomProvider({
          getToken: () =>
            Promise.resolve({
              token: debugToken,
              expireTimeMillis: Date.now() + 3_600_000, // 1 jam
            }),
        }),
        isTokenAutoRefreshEnabled: false,
      });

      appCheckStatus.initialized = true;
      appCheckStatus.provider = 'debug';
      appCheckStatus.isDebugMode = true;

      console.warn(
        '%c🔧 ABDI App Check: Debug Mode (development only)',
        'color: #f59e0b; font-weight: bold;'
      );
      return;
    }

    // ── FALLBACK: App Check tidak dikonfigurasi ───────────────────────
    // Ini NORMAL di development jika belum setup reCAPTCHA.
    // Di PRODUCTION, pastikan VITE_RECAPTCHA_SITE_KEY sudah diset!
    if (isDev) {
      console.warn(
        '[ABDI App Check] Tidak aktif — set VITE_RECAPTCHA_SITE_KEY untuk production ' +
        'atau VITE_APP_CHECK_DEBUG_TOKEN untuk development.'
      );
    } else {
      // Di production tanpa key = peringatan kritis
      console.error(
        '[ABDI App Check] ⚠️ PRODUCTION: App Check tidak aktif! ' +
        'Set VITE_RECAPTCHA_SITE_KEY di environment variables untuk proteksi DDoS/bot.'
      );
    }

  } catch (err) {
    // Jangan biarkan kegagalan App Check menghentikan aplikasi
    console.error('[ABDI App Check] Inisialisasi gagal:', err);
  }
}

// Panggil inisialisasi App Check SEBELUM service Firebase lain digunakan
initAppCheck();

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE SERVICES
// ─────────────────────────────────────────────────────────────────────────────

export const auth = getAuth(app);
export const db = getFirestore(app);
export const dbRealtime = getDatabase(app);
export const storage = getStorage(app);

// Analytics — inisialisasi async (tidak blocking)
export let analytics: any = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPER MULTI-TENANT
// ─────────────────────────────────────────────────────────────────────────────
import { ref, DatabaseReference } from "firebase/database";

export function getTenantPath(path: string = ''): string {
  // Path global tidak disentuh
  if (path.startsWith('user_tenant_mapping') || path.startsWith('global_')) {
    return path;
  }

  const tenantId = localStorage.getItem("abdi_active_tenant_id");

  if (!tenantId || tenantId === 'GLOBAL') {
    return path;
  }

  // Jika path sudah memiliki format tenants/xxx, jangan double prefix
  if (path.startsWith('tenants/')) {
    return path;
  }

  return path ? `tenants/${tenantId}/${path}` : `tenants/${tenantId}`;
}

/**
 * Pengganti ref(dbRealtime, path) yang secara otomatis menambahkan
 * prefix tenants/$tenantId/ ke dalam path.
 */
export function getTenantRef(path: string = ''): DatabaseReference {
  return ref(dbRealtime, getTenantPath(path));
}

