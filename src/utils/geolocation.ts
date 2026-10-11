/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  ABDI Absen Digital — Geofencing & Anti-Fake GPS Engine          ║
 * ║  src/utils/geolocation.ts                                        ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  ARSITEKTUR KEAMANAN — LAPISAN 3: GEOFENCING & ANTI-FAKE GPS     ║
 * ║                                                                  ║
 * ║  Komponen:                                                       ║
 * ║  1. HAVERSINE FORMULA — Hitung jarak akurat antara dua titik     ║
 * ║     koordinat GPS di permukaan bumi (mempertimbangkan kelengkungan║
 * ║     bumi, lebih akurat dari Euclidean untuk jarak pendek)        ║
 * ║  2. GEOFENCING ENGINE — Validasi apakah pegawai berada dalam     ║
 * ║     radius yang diizinkan dari titik absensi                     ║
 * ║  3. ANTI-FAKE GPS — Deteksi multi-lapis manipulasi lokasi:       ║
 * ║     a. Browser: Analisis anomali telemetri GPS                   ║
 * ║     b. Android Native: Parameter isFromMockProvider (Capacitor)  ║
 * ║     c. Extension Detection: Peringatan untuk ekstensi manipulasi ║
 * ║  4. SECURITY INTEGRATION — Terintegrasi dengan securityGuard.ts  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Koordinat geografis standar */
export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

/** Titik absensi yang dikonfigurasi admin di sistem */
export interface AttendancePoint extends GeoCoordinate {
  /** Nama lokasi, misal: "Kantor Utama", "Ruang Kelas A" */
  name?: string;
  /** Radius geofence dalam meter (default: 50m) */
  radiusMeters: number;
}

/** Hasil kalkulasi jarak */
export interface DistanceResult {
  /** Jarak dalam meter */
  distanceMeters: number;
  /** Jarak dalam kilometer (2 desimal) */
  distanceKm: number;
  /** Bearing/arah dari titik A ke titik B dalam derajat (0-360°) */
  bearingDegrees: number;
}

/** Hasil validasi geofencing */
export interface GeofenceValidationResult {
  /** Apakah pegawai berada dalam radius yang diizinkan */
  isWithinRadius: boolean;
  /** Jarak aktual dari titik absensi dalam meter */
  distanceMeters: number;
  /** Radius yang diizinkan dalam meter */
  allowedRadiusMeters: number;
  /** Selisih jarak dengan batas radius (negatif = di dalam, positif = di luar) */
  marginMeters: number;
  /** Pesan status untuk ditampilkan ke pengguna */
  statusMessage: string;
}

/** Hasil deteksi Fake GPS multi-lapis */
export interface FakeGpsDetectionResult {
  /** Apakah ada indikasi Fake GPS yang terdeteksi */
  isMockLocationSuspected: boolean;
  /** Level kepercayaan deteksi */
  confidenceLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  /** Detail setiap layer deteksi */
  layers: {
    /** Layer 1: Native Android isFromMockProvider flag */
    androidNative: {
      checked: boolean;
      isMock: boolean;
      message: string;
    };
    /** Layer 2: Browser telemetri anomali */
    browserTelemetry: {
      checked: boolean;
      violations: string[];
      message: string;
    };
    /** Layer 3: Extension/tool deteksi */
    toolDetection: {
      checked: boolean;
      suspiciousSignals: string[];
      message: string;
    };
  };
  /** Ringkasan semua violation yang ditemukan */
  allViolations: string[];
  /** Rekomendasi tindakan */
  recommendation: string;
}

/**
 * Parameter posisi yang diperkaya dengan informasi native Android.
 * Digunakan saat aplikasi berjalan sebagai native app via Capacitor.
 *
 * Ref: Android Location API — `Location.isFromMockProvider()`
 * Sejak Android 12+: `Location.isMock()`
 */
export interface EnrichedPosition extends GeolocationPosition {
  /**
   * Flag dari Android Location API yang menandakan apakah lokasi ini
   * dihasilkan oleh aplikasi "mock location" (GPS palsu).
   *
   * ANDROID NATIVE ONLY. Harus diisi dari:
   *   - Capacitor Geolocation plugin yang ter-extend dengan flag ini
   *   - Atau dari backend validation setelah validasi server-side
   *
   * Web browser TIDAK dapat mendeteksi ini secara native.
   */
  isFromMockProvider?: boolean;
  /** Sumber posisi: 'web', 'native_android', 'native_ios' */
  source?: 'web' | 'native_android' | 'native_ios';
}

// ─────────────────────────────────────────────────────────────────────────────
// KONSTANTA
// ─────────────────────────────────────────────────────────────────────────────

/** Radius bumi rata-rata dalam meter (WGS-84 mean radius) */
const EARTH_RADIUS_METERS = 6_371_000;

/** Default radius geofence jika tidak dikonfigurasi admin */
export const DEFAULT_GEOFENCE_RADIUS_METERS = 50;

/**
 * Daftar ekstensi browser yang diketahui dapat memanipulasi lokasi GPS.
 * Ini adalah nama-nama yang sering muncul di ekstensi Chrome Store.
 * (Deteksi ini bersifat heuristik, bukan 100% akurat)
 */
const KNOWN_LOCATION_SPOOFER_PATTERNS = [
  'Location Guard',
  'Manual Geolocation',
  'Change Geolocation',
  'Location Spoofer',
  'Fake GPS',
  'Mock Location',
];

// ─────────────────────────────────────────────────────────────────────────────
// HAVERSINE FORMULA — KALKULASI JARAK GEODETIK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ═══════════════════════════════════════════════════════════════
 * calculateHaversineDistance
 * ═══════════════════════════════════════════════════════════════
 *
 * Menghitung jarak geodetik antara dua titik koordinat menggunakan
 * Formula Haversine — formula standar untuk kalkulasi jarak di
 * permukaan bola (mempertimbangkan kelengkungan bumi).
 *
 * FORMULA:
 *   a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
 *   c = 2 × atan2(√a, √(1-a))
 *   d = R × c
 *
 * KEUNGGULAN vs Euclidean Distance:
 *  - Euclidean: Akurat hanya untuk jarak SANGAT pendek (<1km) di khatulistiwa
 *  - Haversine: Akurat untuk semua jarak, mempertimbangkan lengkungan bumi
 *  - Error Haversine: <0.5% untuk jarak pendek (absensi <500m)
 *
 * PENGGUNAAN:
 * ```typescript
 * const result = calculateHaversineDistance(
 *   { latitude: -7.2575, longitude: 112.7521 }, // Pegawai
 *   { latitude: -7.2570, longitude: 112.7515 }  // Kantor
 * );
 * console.log(`Jarak: ${result.distanceMeters.toFixed(1)}m`);
 * ```
 *
 * @param pointA - Koordinat pegawai (dari GPS browser)
 * @param pointB - Koordinat titik absensi (dari konfigurasi admin)
 * @returns DistanceResult — jarak dalam meter, km, dan bearing
 */
export function calculateHaversineDistance(
  pointA: GeoCoordinate,
  pointB: GeoCoordinate
): DistanceResult {
  // Konversi derajat ke radian
  const toRad = (deg: number): number => (deg * Math.PI) / 180;

  const lat1 = toRad(pointA.latitude);
  const lat2 = toRad(pointB.latitude);
  const deltaLat = toRad(pointB.latitude - pointA.latitude);
  const deltaLon = toRad(pointB.longitude - pointA.longitude);

  // Haversine formula
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = EARTH_RADIUS_METERS * c;

  // Kalkulasi bearing (arah dari A ke B)
  const bearingRad = Math.atan2(
    Math.sin(deltaLon) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon)
  );
  // Konversi ke derajat 0-360°
  const bearingDegrees = ((bearingRad * 180) / Math.PI + 360) % 360;

  return {
    distanceMeters,
    distanceKm: Math.round(distanceMeters / 10) / 100, // 2 desimal
    bearingDegrees: Math.round(bearingDegrees * 10) / 10, // 1 desimal
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GEOFENCING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ═══════════════════════════════════════════════════════════════
 * validateGeofence
 * ═══════════════════════════════════════════════════════════════
 *
 * Memvalidasi apakah koordinat pegawai berada dalam radius geofence
 * yang dikonfigurasi untuk titik absensi.
 *
 * ALUR VALIDASI:
 * 1. Hitung jarak aktual menggunakan Haversine
 * 2. Bandingkan dengan radius yang diizinkan
 * 3. Kembalikan hasil beserta margin dan pesan user-friendly
 *
 * CONTOH PENGGUNAAN:
 * ```typescript
 * // Ambil konfigurasi sekolah dari Firebase
 * const school = await getSchoolConfig(tenantId);
 *
 * const result = validateGeofence(
 *   { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
 *   {
 *     latitude: school.latitude,
 *     longitude: school.longitude,
 *     radiusMeters: school.radius || DEFAULT_GEOFENCE_RADIUS_METERS,
 *     name: school.name,
 *   }
 * );
 *
 * if (!result.isWithinRadius) {
 *   toast.error(result.statusMessage);
 *   return; // Tolak presensi
 * }
 * ```
 *
 * @param employeePosition - Koordinat GPS pegawai saat ini
 * @param attendancePoint  - Titik absensi dan radius yang dikonfigurasi
 * @returns GeofenceValidationResult
 */
export function validateGeofence(
  employeePosition: GeoCoordinate,
  attendancePoint: AttendancePoint
): GeofenceValidationResult {
  const distResult = calculateHaversineDistance(employeePosition, attendancePoint);
  const { distanceMeters } = distResult;
  const { radiusMeters, name = 'Titik Absensi' } = attendancePoint;

  const isWithinRadius = distanceMeters <= radiusMeters;
  const marginMeters = distanceMeters - radiusMeters; // Negatif = di dalam, Positif = di luar

  let statusMessage: string;

  if (isWithinRadius) {
    const distStr = distanceMeters < 1
      ? '<1 meter'
      : `${distanceMeters.toFixed(1)} meter`;
    statusMessage = `✅ Dalam radius. Jarak ke ${name}: ${distStr} (radius diizinkan: ${radiusMeters}m).`;
  } else {
    const overBy = Math.ceil(marginMeters);
    statusMessage = `❌ Di luar radius. Jarak ke ${name}: ${distanceMeters.toFixed(1)}m — melebihi batas ${radiusMeters}m sebesar ${overBy}m. Mohon pindah lebih dekat ke lokasi absensi.`;
  }

  return {
    isWithinRadius,
    distanceMeters,
    allowedRadiusMeters: radiusMeters,
    marginMeters,
    statusMessage,
  };
}

/**
 * Memvalidasi geofence untuk BEBERAPA titik absensi sekaligus.
 * Mengembalikan titik absensi terdekat yang valid (jika ada).
 *
 * Berguna untuk instansi dengan beberapa gedung/lokasi absensi.
 */
export function validateMultiPointGeofence(
  employeePosition: GeoCoordinate,
  attendancePoints: AttendancePoint[]
): { isValid: boolean; nearestPoint: AttendancePoint | null; result: GeofenceValidationResult | null } {
  if (!attendancePoints.length) {
    return { isValid: false, nearestPoint: null, result: null };
  }

  // Urutkan dari yang terdekat ke terjauh
  const sorted = [...attendancePoints]
    .map(point => ({
      point,
      result: validateGeofence(employeePosition, point),
    }))
    .sort((a, b) => a.result.distanceMeters - b.result.distanceMeters);

  const nearest = sorted[0];
  if (nearest.result.isWithinRadius) {
    return { isValid: true, nearestPoint: nearest.point, result: nearest.result };
  }

  return { isValid: false, nearestPoint: nearest.point, result: nearest.result };
}

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-FAKE GPS — DETEKSI MULTI-LAPIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LAYER 1: Deteksi Android Native Mock Location
 *
 * Ini adalah metode paling ANDAL untuk mendeteksi Fake GPS di Android.
 * Android OS sendiri yang menandai lokasi sebagai "mock" melalui
 * Location.isFromMockProvider() / Location.isMock() (Android 12+).
 *
 * INTEGRASI ANDROID (Capacitor):
 * Anda perlu meng-extend plugin Capacitor Geolocation untuk menyertakan
 * flag ini. Contoh implementasi di `android/app/src/main/java/.../MainActivity.java`:
 *
 * ```java
 * // Dalam callback LocationManager
 * Location location = ...; // lokasi dari LocationManager
 * JSObject result = new JSObject();
 * result.put("latitude", location.getLatitude());
 * result.put("longitude", location.getLongitude());
 * result.put("accuracy", location.getAccuracy());
 * // ─── TAMBAHKAN INI ───
 * if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
 *     result.put("isFromMockProvider", location.isMock()); // Android 12+
 * } else {
 *     result.put("isFromMockProvider", location.isFromMockProvider()); // Android <12
 * }
 * // ─────────────────────
 * ```
 *
 * Di `AndroidManifest.xml`, pastikan ada:
 * ```xml
 * <uses-permission android:name="android.permission.ACCESS_MOCK_LOCATION" />
 * ```
 *
 * Di Settings Android: "Allow Mock Locations" harus dimatikan untuk user biasa.
 */
function checkAndroidNativeMockLocation(position: EnrichedPosition): {
  checked: boolean;
  isMock: boolean;
  message: string;
} {
  // Cek apakah flag tersedia (hanya di native Android via Capacitor)
  const isNativeAndroid = position.source === 'native_android';

  if (!isNativeAndroid || position.isFromMockProvider === undefined) {
    return {
      checked: false,
      isMock: false,
      message:
        'Native Android check tidak tersedia (berjalan di browser atau flag tidak dikirim dari native layer).',
    };
  }

  return {
    checked: true,
    isMock: position.isFromMockProvider === true,
    message: position.isFromMockProvider
      ? '🚨 ANDROID CONFIRMED: Location.isFromMockProvider() = true — GPS dihasilkan oleh aplikasi Fake GPS.'
      : '✅ Android Location API memverifikasi ini BUKAN mock location.',
  };
}

/**
 * LAYER 2: Deteksi Anomali Telemetri Browser GPS
 *
 * Aplikasi Fake GPS menghasilkan data GPS simulasi yang memiliki ciri khas:
 *  - Akurasi terlalu sempurna (< 1 meter, mustahil di GPS nyata)
 *  - Tidak ada data altitude (GPS palsu sering skip elevasi)
 *  - Timestamp beku / tidak berubah antar pengukuran
 *  - Koordinat identik persis (GPS asli selalu punya microfluctuation)
 *  - Kecepatan persis 0.0 m/s dikombinasikan dengan anomali lain
 *
 * NOTE: Ini adalah heuristik — ada false positive di perangkat dengan GPS buruk.
 * Gunakan bersama Layer 1 (Android Native) untuk kepastian lebih tinggi.
 */
function checkBrowserTelemetryAnomalies(position: GeolocationPosition): {
  checked: boolean;
  violations: string[];
  message: string;
} {
  const coords = position.coords;
  const violations: string[] = [];

  // Anomali 1: Akurasi mencurigakan
  if (coords.accuracy !== null) {
    if (coords.accuracy <= 0) {
      violations.push(
        `Akurasi GPS nol/negatif (${coords.accuracy}m) — MUSTAHIL di GPS fisik`
      );
    } else if (coords.accuracy < 1.0) {
      violations.push(
        `Akurasi GPS terlalu presisi (${coords.accuracy.toFixed(3)}m) — GPS terbaik pun min. ±1-3m`
      );
    }
  }

  // Anomali 2: Tidak ada data elevasi
  // GPS nyata di smartphone SELALU menghasilkan altitude (meski tidak akurat).
  // null pada altitude adalah ciri khas Fake GPS yang tidak mensimulasikan elevasi.
  if (coords.altitude === null && coords.altitudeAccuracy === null) {
    violations.push(
      'Data elevasi (altitude) = null — Fake GPS biasanya tidak mensimulasikan elevasi'
    );
  }

  // Anomali 3: Timestamp GPS beku
  const prevTelemetry = sessionStorage.getItem('_abdi_geo_prev_ts');
  const prevTimestamp = prevTelemetry ? parseInt(prevTelemetry, 10) : null;
  sessionStorage.setItem('_abdi_geo_prev_ts', String(position.timestamp));

  if (prevTimestamp !== null && Math.abs(position.timestamp - prevTimestamp) < 50) {
    violations.push(
      `Timestamp GPS beku (selisih: ${position.timestamp - prevTimestamp}ms) — GPS statis/tidak diperbarui`
    );
  }

  // Anomali 4: Koordinat persis identik berulang (tidak ada microfluctuation)
  const prevCoords = sessionStorage.getItem('_abdi_geo_prev_coords');
  const prevPos = prevCoords ? JSON.parse(prevCoords) : null;
  sessionStorage.setItem(
    '_abdi_geo_prev_coords',
    JSON.stringify({ lat: coords.latitude, lon: coords.longitude })
  );

  if (prevPos !== null) {
    const latDiff = Math.abs(coords.latitude - prevPos.lat);
    const lonDiff = Math.abs(coords.longitude - prevPos.lon);
    if (latDiff === 0 && lonDiff === 0) {
      violations.push(
        'Koordinat PERSIS identik dengan pengukuran sebelumnya — GPS asli selalu memiliki microfluctuation'
      );
    }
  }

  // Anomali 5: Speed = 0 dikombinasikan dengan anomali lain
  if (coords.speed !== null && coords.speed === 0.0 && violations.length >= 2) {
    violations.push(
      'Kecepatan GPS persis 0.0 m/s dikombinasikan dengan anomali lain — pola klasik Tuyul/Mock Location'
    );
  }

  const isClean = violations.length === 0;
  const message = isClean
    ? `✅ Telemetri GPS browser bersih (${violations.length} anomali).`
    : `⚠️ ${violations.length} anomali telemetri GPS terdeteksi.`;

  return { checked: true, violations, message };
}

/**
 * LAYER 3: Deteksi Ekstensi Manipulasi Lokasi Browser
 *
 * PENTING UNTUK WEB APP:
 * Browser web tidak dapat secara teknis MEMBLOKIR ekstensi yang memanipulasi
 * geolokasi (karena ekstensi memiliki akses ke API yang sama dengan webpage).
 *
 * Strategi yang tersedia di level web:
 * 1. Analisis heuristik pola output GPS (Layer 2)
 * 2. Peringatan kepada pengguna untuk menonaktifkan ekstensi
 * 3. Kebijakan CSP (Content Security Policy) yang ketat
 * 4. Verifikasi server-side tambahan (IP geolokasi vs GPS claim)
 *
 * Untuk proteksi MAKSIMAL, gunakan native app (Capacitor Android)
 * yang memanfaatkan Android Location.isFromMockProvider() (Layer 1).
 *
 * Referensi ekstensi yang diketahui:
 * - "Location Guard" (Chrome Extension)
 * - "Manual Geolocation" (Chrome Extension)
 * - "Change Geolocation" (berbagai fork)
 */
function checkBrowserToolDetection(): {
  checked: boolean;
  suspiciousSignals: string[];
  message: string;
} {
  const signals: string[] = [];

  // Signal 1: WebDriver / Selenium (bisa mengset koordinat via CDP)
  if (navigator.webdriver) {
    signals.push(
      'navigator.webdriver = true — Browser dikendalikan Selenium/WebDriver (bisa set lokasi via CDP)'
    );
  }

  // Signal 2: Headless browser (dimensi window = 0)
  if (!window.outerWidth && !window.outerHeight) {
    signals.push('Dimensi window browser nol — kemungkinan headless browser');
  }

  // Signal 3: Tidak ada plugins (headless Chrome)
  if (
    navigator.plugins &&
    navigator.plugins.length === 0 &&
    !navigator.userAgent.toLowerCase().includes('mobile')
  ) {
    signals.push(
      'Tidak ada browser plugin (desktop browser normalnya memiliki plugin) — indikator headless'
    );
  }

  // Signal 4: Deteksi via User Agent yang tidak konsisten
  const ua = navigator.userAgent.toLowerCase();
  const hasMobileUA = ua.includes('android') || ua.includes('iphone') || ua.includes('ipad');
  const hasMobileFeature = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (hasMobileUA && !hasMobileFeature && typeof window !== 'undefined') {
    signals.push('User-Agent mengklaim mobile tapi tidak ada touch events — User-Agent palsu?');
  }

  // Signal 5: Permission API check (ekstensi spoofer sering tidak mengeset permissions dengan benar)
  // Async check — hanya sebagai tambahan, tidak blocking
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'geolocation' }).then(result => {
      if (result.state === 'denied') {
        // Jika geolocation denied tapi kita masih mendapat koordinat = anomali
        console.warn(
          '[ABDI GeoSecurity] Geolocation permission = denied tapi posisi diterima — kemungkinan ekstensi spoofer aktif'
        );
      }
    }).catch(() => {});
  }

  const message =
    signals.length === 0
      ? '✅ Tidak ada sinyal alat manipulasi browser terdeteksi.'
      : `⚠️ ${signals.length} sinyal mencurigakan terdeteksi di browser environment.`;

  return { checked: true, suspiciousSignals: signals, message };
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNGSI UTAMA YANG DIEKSPOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ═══════════════════════════════════════════════════════════════
 * detectFakeGPS — Deteksi Mock Location Multi-Lapis
 * ═══════════════════════════════════════════════════════════════
 *
 * Menjalankan semua layer deteksi Fake GPS secara bersamaan dan
 * mengkonsolidasikan hasilnya menjadi satu keputusan yang jelas.
 *
 * ALUR DETEKSI:
 * ┌─────────────────────────────────────────────────────────┐
 * │  Input: EnrichedPosition (GeolocationPosition + flag)   │
 * ├─────────────────────────────────────────────────────────┤
 * │  Layer 1: Android Native isFromMockProvider             │ ← Paling andal
 * │  Layer 2: Browser telemetri anomali (6 checks)          │ ← Heuristik
 * │  Layer 3: Tool/Extension detection (5 checks)           │ ← Heuristik
 * ├─────────────────────────────────────────────────────────┤
 * │  Konsolidasi → Confidence Level → Recommendation        │
 * └─────────────────────────────────────────────────────────┘
 *
 * CONTOH PENGGUNAAN:
 * ```typescript
 * navigator.geolocation.getCurrentPosition(async (pos) => {
 *   const enrichedPos: EnrichedPosition = {
 *     ...pos,
 *     isFromMockProvider: nativeResult?.isFromMockProvider, // dari Capacitor
 *     source: 'native_android',
 *   };
 *
 *   const detection = detectFakeGPS(enrichedPos);
 *
 *   if (detection.confidenceLevel === 'critical' || detection.confidenceLevel === 'high') {
 *     toast.error('❌ Manipulasi GPS terdeteksi. Presensi dibatalkan.');
 *     return;
 *   }
 *   if (detection.confidenceLevel === 'medium') {
 *     toast.warning('⚠️ Peringatan: Anomali GPS terdeteksi. Admin akan dinotifikasi.');
 *     // Tandai record untuk review admin (flaggedForReview: true)
 *   }
 *
 *   // Lanjut proses presensi...
 * });
 * ```
 *
 * @param position - Posisi GPS yang diperkaya dengan flag native Android
 * @returns FakeGpsDetectionResult — hasil analisis lengkap
 */
export function detectFakeGPS(position: EnrichedPosition): FakeGpsDetectionResult {
  // Jalankan semua layer deteksi
  const androidCheck = checkAndroidNativeMockLocation(position);
  const telemetryCheck = checkBrowserTelemetryAnomalies(position);
  const toolCheck = checkBrowserToolDetection();

  // Kumpulkan semua violations
  const allViolations: string[] = [
    ...(androidCheck.isMock ? [androidCheck.message] : []),
    ...telemetryCheck.violations,
    ...toolCheck.suspiciousSignals,
  ];

  // Hitung confidence level berdasarkan priority
  let confidenceLevel: FakeGpsDetectionResult['confidenceLevel'] = 'none';
  let recommendation = '✅ Tidak ada indikasi Fake GPS. Presensi dapat diizinkan.';

  if (androidCheck.checked && androidCheck.isMock) {
    // Layer 1 konfirmasi = CRITICAL (konfirmasi oleh OS Android sendiri)
    confidenceLevel = 'critical';
    recommendation =
      '🚨 CRITICAL: Android OS mengkonfirmasi lokasi dari aplikasi Mock Provider. Presensi DIBLOKIR. Harap matikan aplikasi Fake GPS dan coba lagi.';
  } else if (allViolations.length >= 4) {
    confidenceLevel = 'high';
    recommendation =
      '🔴 HIGH: Banyak anomali GPS terdeteksi. Presensi diblokir. Admin harus memverifikasi secara manual.';
  } else if (allViolations.length >= 2) {
    confidenceLevel = 'medium';
    recommendation =
      '🟠 MEDIUM: Beberapa anomali GPS terdeteksi. Presensi diizinkan namun akan ditandai untuk verifikasi admin (flaggedForReview = true).';
  } else if (allViolations.length === 1) {
    confidenceLevel = 'low';
    recommendation =
      '🟡 LOW: Satu anomali GPS terdeteksi. Presensi diizinkan dengan catatan monitoring.';
  }

  return {
    isMockLocationSuspected: confidenceLevel !== 'none',
    confidenceLevel,
    layers: {
      androidNative: androidCheck,
      browserTelemetry: telemetryCheck,
      toolDetection: toolCheck,
    },
    allViolations,
    recommendation,
  };
}

/**
 * ═══════════════════════════════════════════════════════════════
 * runFullAttendanceLocationCheck
 * ═══════════════════════════════════════════════════════════════
 *
 * Fungsi ALL-IN-ONE yang menggabungkan Geofencing + Anti-Fake GPS
 * menjadi satu keputusan final untuk proses presensi.
 *
 * Dipanggil TEPAT SEBELUM menyimpan record presensi ke Firebase.
 *
 * CONTOH PENGGUNAAN LENGKAP:
 * ```typescript
 * import { runFullAttendanceLocationCheck, DEFAULT_GEOFENCE_RADIUS_METERS } from '@/utils/geolocation';
 *
 * const handleAttendance = async () => {
 *   try {
 *     const pos = await new Promise<GeolocationPosition>((res, rej) =>
 *       navigator.geolocation.getCurrentPosition(res, rej, {
 *         enableHighAccuracy: true,
 *         timeout: 10000,
 *         maximumAge: 0, // Selalu minta posisi terbaru, jangan gunakan cache
 *       })
 *     );
 *
 *     const enrichedPos: EnrichedPosition = {
 *       ...pos,
 *       source: 'web', // atau 'native_android' dari Capacitor
 *     };
 *
 *     const checkResult = await runFullAttendanceLocationCheck(
 *       enrichedPos,
 *       {
 *         latitude: school.latitude!,
 *         longitude: school.longitude!,
 *         radiusMeters: school.radius || DEFAULT_GEOFENCE_RADIUS_METERS,
 *         name: school.name,
 *       }
 *     );
 *
 *     if (checkResult.isBlocked) {
 *       toast.error(checkResult.blockReason!);
 *       return;
 *     }
 *
 *     // Simpan ke Firebase dengan tambahan metadata keamanan
 *     await saveAttendance({
 *       ...attendanceData,
 *       latitude: pos.coords.latitude,
 *       longitude: pos.coords.longitude,
 *       distance: checkResult.geofenceResult.distanceMeters,
 *       flaggedForReview: checkResult.flaggedForReview,
 *       securityMeta: checkResult.securityMeta,
 *     });
 *
 *   } catch (err) { ... }
 * };
 * ```
 */
export async function runFullAttendanceLocationCheck(
  position: EnrichedPosition,
  attendancePoint: AttendancePoint
): Promise<{
  /** Apakah presensi DIBLOKIR (tidak boleh dilanjutkan) */
  isBlocked: boolean;
  /** Alasan pemblokiran (jika isBlocked = true) */
  blockReason?: string;
  /** Apakah record perlu ditandai untuk review admin */
  flaggedForReview: boolean;
  /** Hasil validasi geofencing */
  geofenceResult: GeofenceValidationResult;
  /** Hasil deteksi Fake GPS */
  fakeGpsResult: FakeGpsDetectionResult;
  /** Metadata keamanan untuk disimpan bersama record absensi */
  securityMeta: {
    fakeGpsConfidence: string;
    fakeGpsViolations: string[];
    distanceMeters: number;
    gpsAccuracy: number | null;
    checkedAt: string;
  };
}> {
  // 1. Validasi geofencing
  const geofenceResult = validateGeofence(
    { latitude: position.coords.latitude, longitude: position.coords.longitude },
    attendancePoint
  );

  // 2. Deteksi Fake GPS
  const fakeGpsResult = detectFakeGPS(position);

  // 3. Keputusan final
  let isBlocked = false;
  let blockReason: string | undefined;
  let flaggedForReview = false;

  // BLOKIR jika: di luar radius ATAU Fake GPS level high/critical
  if (!geofenceResult.isWithinRadius) {
    isBlocked = true;
    blockReason = geofenceResult.statusMessage;
  } else if (
    fakeGpsResult.confidenceLevel === 'critical' ||
    fakeGpsResult.confidenceLevel === 'high'
  ) {
    isBlocked = true;
    blockReason = fakeGpsResult.recommendation;
  } else if (fakeGpsResult.confidenceLevel === 'medium') {
    // Medium: izinkan tapi flag untuk review admin
    flaggedForReview = true;
  }

  return {
    isBlocked,
    blockReason,
    flaggedForReview,
    geofenceResult,
    fakeGpsResult,
    securityMeta: {
      fakeGpsConfidence: fakeGpsResult.confidenceLevel,
      fakeGpsViolations: fakeGpsResult.allViolations,
      distanceMeters: geofenceResult.distanceMeters,
      gpsAccuracy: position.coords.accuracy,
      checkedAt: new Date().toISOString(),
    },
  };
}

/**
 * ═══════════════════════════════════════════════════════════════
 * getCurrentPositionWithTimeout
 * ═══════════════════════════════════════════════════════════════
 *
 * Wrapper Promise untuk navigator.geolocation.getCurrentPosition
 * dengan timeout yang lebih baik dan opsi yang dioptimasi untuk
 * kebutuhan presensi (high accuracy, no cache).
 *
 * OPSI PENTING:
 * - enableHighAccuracy: true — gunakan GPS chip, bukan WiFi/cell tower
 * - maximumAge: 0 — selalu minta posisi TERBARU (cegah cached fake position)
 * - timeout: 15000 — timeout 15 detik
 *
 * @returns Promise<GeolocationPosition>
 */
export function getCurrentPositionWithTimeout(
  timeoutMs = 15_000
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation API tidak tersedia di browser ini.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Akses lokasi ditolak. Harap izinkan akses GPS di pengaturan browser.'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Posisi GPS tidak tersedia. Pastikan GPS aktif dan sinyal kuat.'));
            break;
          case error.TIMEOUT:
            reject(new Error(`GPS timeout setelah ${timeoutMs / 1000} detik. Coba lagi di area dengan sinyal GPS lebih baik.`));
            break;
          default:
            reject(new Error(`Error GPS tidak dikenal: ${error.message}`));
        }
      },
      {
        enableHighAccuracy: true, // Gunakan GPS chip (bukan WiFi/network)
        maximumAge: 0,            // JANGAN gunakan posisi yang di-cache
        timeout: timeoutMs,
      }
    );
  });
}

/**
 * ═══════════════════════════════════════════════════════════════
 * formatCoordinates — Format Koordinat untuk Display
 * ═══════════════════════════════════════════════════════════════
 *
 * Memformat koordinat menjadi format DMS (Degrees Minutes Seconds)
 * yang mudah dibaca manusia, berguna untuk audit log.
 */
export function formatCoordinates(coord: GeoCoordinate): string {
  const formatDMS = (deg: number, isLat: boolean): string => {
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = ((abs - d - m / 60) * 3600).toFixed(2);
    const dir = isLat ? (deg >= 0 ? 'N' : 'S') : deg >= 0 ? 'E' : 'W';
    return `${d}°${m}'${s}"${dir}`;
  };

  return `${formatDMS(coord.latitude, true)}, ${formatDMS(coord.longitude, false)}`;
}

/**
 * ═══════════════════════════════════════════════════════════════
 * PERINGATAN KEAMANAN BROWSER — Mock Location Extension
 * ═══════════════════════════════════════════════════════════════
 *
 * Menampilkan warning di console developer dan (opsional) UI
 * untuk mengingatkan pengguna agar menonaktifkan ekstensi
 * manipulasi lokasi.
 *
 * CATATAN: Tidak ada cara teknis untuk MEMBLOKIR ekstensi browser
 * dari memanipulasi geolokasi. Proteksi terbaik adalah:
 * 1. Peringatan yang jelas kepada pengguna
 * 2. Deteksi anomali telemetri (Layer 2)
 * 3. Kebijakan penggunaan native app (Android) untuk keamanan maksimal
 */
export function warnAboutLocationSpoofingExtensions(): {
  warningMessage: string;
  technicalNote: string;
} {
  const warningMessage =
    '🔒 KEAMANAN ABDI: Untuk menjaga integritas presensi, pastikan tidak ada ekstensi browser yang memanipulasi lokasi GPS aktif (seperti "Location Guard", "Manual Geolocation", "Fake GPS", atau ekstensi serupa). Penggunaan alat manipulasi GPS adalah pelanggaran kebijakan dan dapat mengakibatkan sanksi disiplin.';

  const technicalNote =
    `[ABDI GeoSecurity] Diketahui ekstensi yang dapat memanipulasi geolokasi: ${KNOWN_LOCATION_SPOOFER_PATTERNS.join(', ')}. ` +
    'Browser web tidak dapat secara teknis memblokir ekstensi, namun sistem kami menggunakan analisis anomali telemetri GPS multi-lapis untuk deteksi. ' +
    'Untuk keamanan presensi maksimal, gunakan aplikasi native Android ABDI yang memanfaatkan Android Location.isFromMockProvider() API.';

  console.group('%c🔒 ABDI GeoSecurity Warning', 'color: #FF6B35; font-weight: bold; font-size: 14px;');
  console.warn(warningMessage);
  console.info(technicalNote);
  console.groupEnd();

  return { warningMessage, technicalNote };
}
