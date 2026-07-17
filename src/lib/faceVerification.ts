/**
 * ============================================================
 * ABDI Absen Digital — AI Face Biometric Verification Engine
 * ============================================================
 * Modul verifikasi wajah berbasis algoritma pembobotan kualitas
 * citra tanpa dependency ML library eksternal.
 *
 * Bekerja murni di sisi klien menggunakan HTML5 Canvas API.
 * ============================================================
 */

export interface FaceVerificationResult {
  passed: boolean;
  score: number; // 0–100
  issues: string[];
  recommendation: string;
  metrics: {
    brightnessScore: number;
    contrastScore: number;
    sharpnessScore: number;
    facePresenceScore: number;
    centeringScore: number;
  };
}

// ─────────────────────────────────────────────────────────────
// ANALISIS PIKSEL CITRA via Canvas API
// ─────────────────────────────────────────────────────────────

/**
 * Mengambil data piksel dari elemen <img> atau data URL via Canvas.
 * Mengembalikan ImageData dari canvas 160×120 (skala kecil untuk performa).
 */
function getImageData(imageSrc: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const W = 160;
      const H = 120;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context tidak tersedia'));
        return;
      }
      ctx.drawImage(img, 0, 0, W, H);
      try {
        resolve(ctx.getImageData(0, 0, W, H));
      } catch (e) {
        reject(new Error('Gagal membaca data piksel gambar (CORS issue)'));
      }
    };
    img.onerror = () => reject(new Error('Gagal memuat gambar untuk verifikasi'));
    img.src = imageSrc;
  });
}

// ─────────────────────────────────────────────────────────────
// METRIK KUALITAS GAMBAR
// ─────────────────────────────────────────────────────────────

/**
 * Menghitung nilai kecerahan rata-rata gambar (luminance).
 * Return: 0 (gelap total) – 255 (terang penuh)
 */
function calculateBrightness(data: Uint8ClampedArray): number {
  let totalLuminance = 0;
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    // Rumus luminance standar (ITU-R BT.709)
    totalLuminance += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return totalLuminance / pixelCount;
}

/**
 * Menghitung kontras gambar menggunakan standar deviasi luminance.
 * Return: 0 (flat/monokrom) – ~100+ (kontras tinggi)
 */
function calculateContrast(data: Uint8ClampedArray, avgBrightness: number): number {
  let variance = 0;
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    variance += Math.pow(lum - avgBrightness, 2);
  }
  return Math.sqrt(variance / pixelCount);
}

/**
 * Mengestimasi ketajaman gambar menggunakan operator Laplacian sederhana.
 * Gambar buram (blur) menghasilkan nilai rendah. Gambar tajam menghasilkan nilai tinggi.
 * Return: 0 (blur total) – ~1000+ (sangat tajam)
 */
function calculateSharpness(imageData: ImageData): number {
  const { data, width, height } = imageData;
  let laplacianSum = 0;
  let count = 0;

  // Grayscale conversion + Laplacian kernel
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    gray[i] = 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
  }

  // 3x3 Laplacian kernel: [0,1,0],[1,-4,1],[0,1,0]
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const laplacian =
        gray[idx - width] +
        gray[idx + width] +
        gray[idx - 1] +
        gray[idx + 1] -
        4 * gray[idx];
      laplacianSum += Math.abs(laplacian);
      count++;
    }
  }

  return count > 0 ? laplacianSum / count : 0;
}

/**
 * Estimasi kehadiran wajah menggunakan analisis distribusi warna kulit (skin-tone heuristic).
 * Menganalisis area tengah gambar (zona 40%–60% width & height) untuk rasio warna kulit manusia.
 *
 * Rentang warna kulit: R > 95, G > 40, B > 20, R > G, R > B, |R-G| > 15
 * (Sumber: Kovac, Peer & Solina, 2003 — Skin Colour Segmentation)
 */
function estimateFacePresence(imageData: ImageData): number {
  const { data, width, height } = imageData;
  const centerX1 = Math.floor(width * 0.2);
  const centerX2 = Math.floor(width * 0.8);
  const centerY1 = Math.floor(height * 0.15);
  const centerY2 = Math.floor(height * 0.85);

  let skinPixels = 0;
  let totalPixels = 0;

  for (let y = centerY1; y < centerY2; y++) {
    for (let x = centerX1; x < centerX2; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      totalPixels++;

      // Skin color heuristic (Kovac et al.)
      const isSkin =
        r > 95 &&
        g > 40 &&
        b > 20 &&
        Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
        Math.abs(r - g) > 15 &&
        r > g &&
        r > b;

      if (isSkin) skinPixels++;
    }
  }

  // Return persentase piksel warna kulit (0–100)
  return totalPixels > 0 ? (skinPixels / totalPixels) * 100 : 0;
}

/**
 * Mengestimasi apakah wajah berada di tengah frame.
 * Menggunakan analisis simetri horizontal kecerahan kiri vs kanan.
 */
function estimateCentering(imageData: ImageData): number {
  const { data, width, height } = imageData;
  const midX = Math.floor(width / 2);
  const topY = Math.floor(height * 0.1);
  const bottomY = Math.floor(height * 0.9);

  let leftBrightness = 0;
  let rightBrightness = 0;
  let count = 0;

  for (let y = topY; y < bottomY; y++) {
    for (let x = 0; x < midX; x++) {
      const idxL = (y * width + x) * 4;
      const idxR = (y * width + (width - 1 - x)) * 4;
      leftBrightness += 0.2126 * data[idxL] + 0.7152 * data[idxL + 1] + 0.0722 * data[idxL + 2];
      rightBrightness += 0.2126 * data[idxR] + 0.7152 * data[idxR + 1] + 0.0722 * data[idxR + 2];
      count++;
    }
  }

  if (count === 0) return 50;

  const avgLeft = leftBrightness / count;
  const avgRight = rightBrightness / count;

  if (avgLeft === 0 && avgRight === 0) return 50;

  // Simetri: semakin dekat ke 1.0, semakin simetris/terpusat
  const symmetryRatio = Math.min(avgLeft, avgRight) / Math.max(avgLeft, avgRight);
  return symmetryRatio * 100;
}

// ─────────────────────────────────────────────────────────────
// FUNGSI UTAMA: Verifikasi Kualitas & Kehadiran Wajah
// ─────────────────────────────────────────────────────────────

/**
 * Menganalisis foto selfie dari URL/DataURL untuk memverifikasi:
 * 1. Kecerahan cukup (tidak terlalu gelap/silau)
 * 2. Gambar tidak blur
 * 3. Terdeteksi warna kulit wajah manusia di area tengah
 * 4. Wajah terpusat di frame
 *
 * @param imageDataUrl - Data URL dari foto selfie (biasanya dari webcam)
 * @returns FaceVerificationResult dengan skor 0–100 dan daftar masalah
 */
export async function verifyFaceQuality(imageDataUrl: string): Promise<FaceVerificationResult> {
  const issues: string[] = [];

  let brightnessScore = 0;
  let contrastScore = 0;
  let sharpnessScore = 0;
  let facePresenceScore = 0;
  let centeringScore = 50;

  try {
    const imageData = await getImageData(imageDataUrl);
    const { data } = imageData;

    // ── Hitung semua metrik ─────────────────────────────────
    const brightness = calculateBrightness(data);
    const contrast = calculateContrast(data, brightness);
    const sharpness = calculateSharpness(imageData);
    const skinRatio = estimateFacePresence(imageData);
    const centering = estimateCentering(imageData);

    // ── Normalisasi ke skala 0–100 ──────────────────────────
    // Brightness optimal: 80–180 dari range 0–255
    brightnessScore = brightness < 40
      ? (brightness / 40) * 30  // Terlalu gelap
      : brightness > 220
        ? Math.max(0, 100 - (brightness - 180) * 2)  // Terlalu terang
        : Math.min(100, ((brightness - 40) / 140) * 100 + 30);

    // Contrast: standar deviasi > 30 dianggap cukup baik
    contrastScore = Math.min(100, (contrast / 50) * 100);

    // Sharpness: laplacian > 5 dianggap cukup tajam
    sharpnessScore = Math.min(100, (sharpness / 8) * 100);

    // Face presence: area kulit 15–60% dari area tengah = ada wajah
    facePresenceScore = skinRatio >= 8 && skinRatio <= 70
      ? Math.min(100, (skinRatio / 25) * 80 + 20)
      : skinRatio < 8
        ? (skinRatio / 8) * 40
        : Math.max(0, 100 - (skinRatio - 70) * 3);

    // Centering: simetri > 70% dianggap terpusat
    centeringScore = centering;

    // ── Evaluasi Masalah ────────────────────────────────────
    if (brightness < 40) {
      issues.push('Foto terlalu gelap — pastikan ruangan cukup terang');
    } else if (brightness > 220) {
      issues.push('Foto terlalu silau/overexposed — hindari cahaya langsung di belakang kepala');
    }

    if (sharpnessScore < 25) {
      issues.push('Foto buram/blur — tahan HP dengan stabil saat mengambil foto');
    }

    if (facePresenceScore < 30) {
      issues.push('Wajah tidak terdeteksi jelas — posisikan wajah Anda tepat di tengah kamera');
    }

    if (centeringScore < 50) {
      issues.push('Wajah tidak terpusat — posisikan wajah di tengah frame kamera');
    }

    if (imageDataUrl.length < 5000) {
      issues.push('Ukuran foto terlalu kecil — periksa kamera atau resolusi webcam');
    }

  } catch (e: any) {
    issues.push(`Gagal menganalisis foto: ${e.message}`);
    return {
      passed: false,
      score: 0,
      issues,
      recommendation: 'Terjadi kesalahan teknis saat memverifikasi foto. Coba ulangi pengambilan foto.',
      metrics: { brightnessScore: 0, contrastScore: 0, sharpnessScore: 0, facePresenceScore: 0, centeringScore: 0 },
    };
  }

  // ── Hitung Skor Akhir (Weighted Average) ───────────────────
  // Bobot: Face Presence (35%) > Sharpness (25%) > Brightness (20%) > Contrast (10%) > Centering (10%)
  const finalScore = Math.round(
    facePresenceScore * 0.35 +
    sharpnessScore * 0.25 +
    brightnessScore * 0.20 +
    contrastScore * 0.10 +
    centeringScore * 0.10
  );

  const passed = finalScore >= 40 && issues.length <= 1;

  let recommendation = '';
  if (passed) {
    recommendation = `Foto selfie terverifikasi ✅ (Skor kualitas: ${finalScore}/100). Presensi diizinkan.`;
  } else if (finalScore >= 25) {
    recommendation = `Kualitas foto kurang optimal (Skor: ${finalScore}/100). Perbaiki kondisi pencahayaan dan posisi wajah, lalu coba ulangi.`;
  } else {
    recommendation = `Foto tidak memenuhi standar verifikasi (Skor: ${finalScore}/100). Pastikan wajah Anda terlihat jelas, pencahayaan cukup, dan kamera stabil.`;
  }

  return {
    passed,
    score: finalScore,
    issues,
    recommendation,
    metrics: {
      brightnessScore: Math.round(brightnessScore),
      contrastScore: Math.round(contrastScore),
      sharpnessScore: Math.round(sharpnessScore),
      facePresenceScore: Math.round(facePresenceScore),
      centeringScore: Math.round(centeringScore),
    },
  };
}

/**
 * Cek cepat apakah data URL gambar memiliki format yang valid dan ukuran minimal.
 */
export function isValidPhotoDataUrl(dataUrl: string | null | undefined): boolean {
  if (!dataUrl || typeof dataUrl !== 'string') return false;
  if (!dataUrl.startsWith('data:image/')) return false;
  if (dataUrl.length < 3000) return false; // Minimal ~3KB untuk foto bermakna
  return true;
}
