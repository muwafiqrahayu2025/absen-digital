/**
 * ============================================================
 * ABDI Absen Digital — Security Guard Engine
 * ============================================================
 * Modul deteksi manipulasi lokasi GPS (Fake GPS / Tuyul),
 * DevTools/Automation injection, dan anomali telemetri perangkat.
 *
 * Bekerja murni di sisi klien (browser), tidak memerlukan backend.
 * ============================================================
 */

export interface LocationTelemetry {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface SecurityCheckResult {
  isClean: boolean;
  threatLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  violations: string[];
  recommendation: string;
}

// ─────────────────────────────────────────────────────────────
// Deteksi Fake GPS / Tuyul via analisis anomali telemetri GPS
// ─────────────────────────────────────────────────────────────

/**
 * Menganalisis telemetri koordinat posisi dari browser.
 * Aplikasi "Tuyul" / Fake GPS di Android menghasilkan data simulasi
 * yang biasanya memiliki ciri khas sebagai berikut:
 *  - accuracy = 0 atau sangat kecil (< 1m, mustahil di GPS nyata)
 *  - altitude = null (GPS palsu tidak menghitung elevasi)
 *  - speed = 0.0 (kecepatan statis, tidak berfluktuasi)
 *  - heading = null (tidak ada vektor arah)
 *  - Timestamp selalu konstan / tidak berubah (frozen clock GPS)
 */
export function analyzeLocationTelemetry(pos: GeolocationPosition): SecurityCheckResult {
  const coords = pos.coords;
  const violations: string[] = [];

  const telemetry: LocationTelemetry = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    altitude: coords.altitude,
    altitudeAccuracy: coords.altitudeAccuracy,
    heading: coords.heading,
    speed: coords.speed,
    timestamp: pos.timestamp,
  };

  // Simpan rekaman telemetri sebelumnya untuk analisis delta-waktu
  const prevRaw = sessionStorage.getItem('_abdi_gps_telemetry_prev');
  const prev: LocationTelemetry | null = prevRaw ? JSON.parse(prevRaw) : null;
  sessionStorage.setItem('_abdi_gps_telemetry_prev', JSON.stringify(telemetry));

  // ── Aturan Anomali 1: Akurasi Mencurigakan ──────────────────
  if (coords.accuracy !== null) {
    if (coords.accuracy <= 0) {
      violations.push('Akurasi GPS nol/negatif — mustahil terjadi di perangkat GPS asli');
    } else if (coords.accuracy < 1.0) {
      violations.push(`Akurasi GPS terlalu presisi (${coords.accuracy.toFixed(2)}m) — mencurigakan pada perangkat mobile`);
    }
  }

  // ── Aturan Anomali 2: Elevasi / Altitude Tidak Ada ─────────
  // GPS nyata pada smartphone SELALU menghasilkan nilai altitude (meski tidak akurat).
  // Nilai null pada altitude adalah ciri khas aplikasi Fake GPS yang tidak mensimulasikan elevasi.
  if (coords.altitude === null && coords.altitudeAccuracy === null) {
    violations.push('Data elevasi (altitude) tidak tersedia — indikator umum Mock Location di Android');
  }

  // ── Aturan Anomali 3: Timestamp GPS Beku / Tidak Berubah ───
  if (prev && Math.abs(pos.timestamp - prev.timestamp) < 50) {
    violations.push(`Timestamp GPS tidak berubah (selisih: ${pos.timestamp - prev.timestamp}ms) — indikator GPS statis/frozen`);
  }

  // ── Aturan Anomali 4: Koordinat Persis Sama Berulang ───────
  if (prev) {
    const latDiff = Math.abs(coords.latitude - prev.latitude);
    const lngDiff = Math.abs(coords.longitude - prev.longitude);
    // GPS asli selalu memiliki microfluctuation kecil bahkan saat diam
    if (latDiff === 0 && lngDiff === 0 && prev.timestamp !== 0) {
      violations.push('Koordinat persis identik dengan pengukuran sebelumnya — GPS asli selalu memiliki fluktuasi mikro');
    }
  }

  // ── Aturan Anomali 5: Kecepatan Statis Absolut ─────────────
  // Jika pengguna bergerak menuju kantor, speed tidak mungkin tepat 0.0 m/s
  // kecuali memang berdiri diam total, tapi dikombinasikan dengan anomali lain = kecurigaan tinggi
  if (coords.speed !== null && coords.speed === 0.0 && violations.length >= 2) {
    violations.push('Kecepatan GPS persis nol dikombinasikan dengan anomali lain — pola Tuyul terdeteksi');
  }

  // ── Aturan Anomali 6: Heading/Bearing Tidak Ada ────────────
  // GPS nyata pada smartphone biasanya menghasilkan heading saat bergerak
  if (coords.heading === null && coords.speed !== null && coords.speed > 0) {
    violations.push('Heading/arah pergerakan tidak tersedia meskipun kecepatan > 0 — data GPS tidak konsisten');
  }

  // ── Kalkulasi Tingkat Ancaman ───────────────────────────────
  let threatLevel: SecurityCheckResult['threatLevel'] = 'none';
  let recommendation = 'Lokasi GPS terverifikasi bersih. Presensi diizinkan.';

  if (violations.length === 0) {
    threatLevel = 'none';
  } else if (violations.length === 1) {
    threatLevel = 'low';
    recommendation = 'Satu anomali GPS terdeteksi. Presensi diizinkan dengan catatan pengawasan admin.';
  } else if (violations.length === 2) {
    threatLevel = 'medium';
    recommendation = 'Dua anomali GPS terdeteksi. Admin direkomendasikan melakukan verifikasi manual foto selfie.';
  } else if (violations.length >= 3) {
    threatLevel = 'critical';
    recommendation = 'Pola manipulasi lokasi GPS (Tuyul / Mock Location) terdeteksi. Presensi diblokir untuk integritas data.';
  }

  return {
    isClean: threatLevel === 'none' || threatLevel === 'low',
    threatLevel,
    violations,
    recommendation,
  };
}

// ─────────────────────────────────────────────────────────────
// Deteksi DevTools / Automation Injection (Webdriver / Puppeteer)
// ─────────────────────────────────────────────────────────────

/**
 * Mendeteksi apakah browser sedang dikendalikan oleh alat otomasi
 * seperti Selenium WebDriver, Puppeteer, Playwright, atau Cypress.
 * Alat-alat ini dapat digunakan untuk memanipulasi koordinat GPS
 * secara programatik via Chrome DevTools Protocol (CDP).
 */
export function detectAutomationInjection(): { detected: boolean; signals: string[] } {
  const signals: string[] = [];

  try {
    // Signal 1: WebDriver flag
    if (navigator.webdriver) {
      signals.push('navigator.webdriver = true (Selenium/WebDriver terdeteksi)');
    }

    // Signal 2: Phantom/Ghost JS properties
    if ((window as any).phantom || (window as any).__phantom || (window as any)._phantom) {
      signals.push('PhantomJS terdeteksi di window object');
    }

    // Signal 3: Chrome automation extension
    if ((window as any).chrome && (window as any).chrome.runtime) {
      const ext = (window as any).chrome.runtime;
      if (ext && ext.id && ext.id.length > 0) {
        // Legitimate Chrome extensions have IDs, but automation flags are different
        if (document.documentElement.getAttribute('webdriver')) {
          signals.push('Chrome WebDriver attribute terdeteksi di DOM');
        }
      }
    }

    // Signal 4: Headless browser indicators
    if (!window.outerWidth && !window.outerHeight) {
      signals.push('Dimensi jendela browser nol — kemungkinan browser headless');
    }

    // Signal 5: Missing browser features that headless browsers lack
    if (navigator.plugins && navigator.plugins.length === 0 && !navigator.userAgent.includes('Mobile')) {
      signals.push('Tidak ada browser plugin — indikator headless Chrome');
    }
  } catch (e) {
    // Jika error saat pengecekan, anggap aman
  }

  return {
    detected: signals.length > 0,
    signals,
  };
}

// ─────────────────────────────────────────────────────────────
// Pemeriksaan Keamanan Komprehensif Sebelum Presensi
// ─────────────────────────────────────────────────────────────

/**
 * Fungsi utama yang dipanggil sebelum proses presensi dimulai.
 * Menggabungkan semua lapisan pengecekan keamanan menjadi
 * satu hasil keputusan yang jelas.
 */
export async function runSecurityCheck(gpsPosition?: GeolocationPosition): Promise<SecurityCheckResult> {
  const combinedViolations: string[] = [];

  // Cek 1: Automation injection
  const automationResult = detectAutomationInjection();
  if (automationResult.detected) {
    combinedViolations.push(...automationResult.signals);
  }

  // Cek 2: Analisis telemetri GPS
  let gpsResult: SecurityCheckResult = {
    isClean: true,
    threatLevel: 'none',
    violations: [],
    recommendation: 'Lokasi GPS tidak diverifikasi (GPS tidak tersedia).',
  };

  if (gpsPosition) {
    gpsResult = analyzeLocationTelemetry(gpsPosition);
    combinedViolations.push(...gpsResult.violations);
  }

  // Tentukan level ancaman gabungan
  let finalThreatLevel: SecurityCheckResult['threatLevel'] = 'none';
  let finalRecommendation = 'Semua pemeriksaan keamanan lulus. Presensi diizinkan.';

  if (automationResult.detected) {
    finalThreatLevel = 'critical';
    finalRecommendation = 'Alat otomasi/manipulasi browser terdeteksi. Presensi diblokir.';
  } else {
    finalThreatLevel = gpsResult.threatLevel;
    finalRecommendation = gpsResult.recommendation;
  }

  // Catat hasil pemeriksaan ke session log
  const log = {
    timestamp: new Date().toISOString(),
    threatLevel: finalThreatLevel,
    violations: combinedViolations,
  };
  try {
    const existingLogs = JSON.parse(sessionStorage.getItem('_abdi_security_logs') || '[]');
    existingLogs.push(log);
    // Batasi maksimum 20 log terakhir
    sessionStorage.setItem('_abdi_security_logs', JSON.stringify(existingLogs.slice(-20)));
  } catch (e) {
    // Abaikan error penyimpanan log
  }

  return {
    isClean: finalThreatLevel === 'none' || finalThreatLevel === 'low',
    threatLevel: finalThreatLevel,
    violations: combinedViolations,
    recommendation: finalRecommendation,
  };
}

/**
 * Mengambil log keamanan dari sesi saat ini untuk ditampilkan di Developer Console.
 */
export function getSecuritySessionLogs(): Array<{ timestamp: string; threatLevel: string; violations: string[] }> {
  try {
    return JSON.parse(sessionStorage.getItem('_abdi_security_logs') || '[]');
  } catch {
    return [];
  }
}
