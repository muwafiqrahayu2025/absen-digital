const express = require("express");
const cors = require("cors");
const { getDistance } = require("geolib");
const { initializeApp, cert } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getAuth } = require("firebase-admin/auth");

require("dotenv").config(); // Untuk membaca .env lokal jika ada

// Inisialisasi Firebase Admin
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Jika di Render, baca dari Environment Variable
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // Jika di localhost, baca file lokal (naik satu folder)
  serviceAccount = require("../serviceAccountKey.json");
}

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: "https://abdi-absendigital-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = getDatabase();
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Middleware Validasi Token Firebase
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "unauthenticated", message: "Akses ditolak. Token tidak ditemukan." });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({ error: "unauthenticated", message: "Token tidak valid atau kadaluarsa." });
  }
};

// Route: Submit Attendance
app.post("/api/submitAttendance", authenticateUser, async (req, res) => {
  const userId = req.user.uid;
  const { tenantId, latitude, longitude } = req.body;

  // 1. VALIDASI PAYLOAD
  if (!tenantId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({
      error: "invalid-argument",
      message: "Payload tidak lengkap. tenantId, latitude, dan longitude wajib diisi."
    });
  }

  try {
    // 2. AMBIL DATA KONFIGURASI SEKOLAH (DINAMIS DARI DATABASE)
    const schoolRef = db.ref(`tenants/${tenantId}/school`);
    const schoolSnapshot = await schoolRef.once("value");
    const schoolData = schoolSnapshot.val();

    // 3. VALIDASI KONFIGURASI ADMIN
    if (!schoolData || schoolData.latitude === undefined || schoolData.longitude === undefined || schoolData.maxRadius === undefined) {
      return res.status(412).json({
        error: "failed-precondition",
        message: "Titik lokasi sekolah belum diatur oleh Admin."
      });
    }

    const schoolLocation = {
      latitude: schoolData.latitude,
      longitude: schoolData.longitude,
    };
    const maxRadius = schoolData.maxRadius;

    // 4. KALKULASI RADIUS GPS (Haversine Formula)
    const userLocation = { latitude, longitude };
    const distance = getDistance(schoolLocation, userLocation);

    if (distance > maxRadius) {
      return res.status(403).json({
        error: "out-of-range",
        message: `Anda berada di luar jangkauan absensi. Jarak Anda: ${distance} meter dari sekolah. (Maksimal: ${maxRadius} meter)`
      });
    }

    // 5. PENENTUAN STATUS & SERVER TIMESTAMP
    const attendanceRecord = {
      userId: userId,
      latitude: latitude,
      longitude: longitude,
      distance: distance,
      status: "HADIR",
      timestamp: { ".sv": "timestamp" }, // Server Timestamp equivalent
    };

    // 6. SIMPAN KE DATABASE
    const attendanceRef = db.ref(`tenants/${tenantId}/attendance`);
    const newRecordRef = await attendanceRef.push(attendanceRecord);

    return res.status(200).json({
      success: true,
      message: "Absensi berhasil dicatat.",
      recordId: newRecordRef.key,
      distance: distance,
    });
  } catch (error) {
    console.error("Error submitting attendance:", error);
    return res.status(500).json({
      error: "internal",
      message: "Terjadi kesalahan internal pada server."
    });
  }
});

// Start Server (Lokal) atau Export (Vercel)
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server Absensi Digital berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
