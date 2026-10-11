import * as faceapi from 'face-api.js';

// ── [BUG-002 FIX] Singleton Loading Pattern ────────────────────────────────
// Gantikan boolean 'modelsLoaded' dengan promise singleton.
// Jika loadFaceModels() dipanggil berulang kali secara paralel (spam klik saat
// model sedang diunduh), hanya SATU Promise.all() yang berjalan — semua
// pemanggil berikutnya await promise yang SAMA, bukan membuat request baru.
let loadingPromise: Promise<boolean> | null = null;
let modelsLoaded = false;

// ── [BUG-010 FIX] Simpan error untuk ditampilkan ke UI ───────────────────────
let modelLoadError: string | null = null;

/**
 * Mengembalikan pesan error terakhir saat model gagal dimuat.
 * Digunakan komponen UI untuk menampilkan pesan actionable ke user.
 */
export function getModelLoadError(): string | null {
  return modelLoadError;
}

/**
 * Memuat model Machine Learning dari direktori public/models.
 * Hanya dipanggil secara asinkron saat kamera diaktifkan.
 *
 * SINGLETON PATTERN: Jika sudah ada proses loading yang berjalan,
 * langsung return promise yang sama alih-alih memulai load baru.
 * Ini mencegah race condition saat guru spam klik tombol kamera.
 */
export async function loadFaceModels(): Promise<boolean> {
  // Model sudah berhasil dimuat sebelumnya
  if (modelsLoaded) return true;

  // [BUG-002 FIX] Model sedang dalam proses loading — kembalikan promise yang sama
  if (loadingPromise) return loadingPromise;

  modelLoadError = null; // Reset error sebelum percobaan baru

  loadingPromise = (async () => {
    try {
      const MODEL_URL = '/models';

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);

      modelsLoaded = true;
      return true;
    } catch (error: any) {
      // [BUG-010 FIX] Simpan pesan error yang informatif dan actionable
      const isOffline = !navigator.onLine;
      if (isOffline) {
        modelLoadError = 'Tidak ada koneksi internet. Model AI wajah tidak dapat diunduh. Sambungkan ke internet lalu refresh halaman.';
      } else {
        modelLoadError = `Gagal mengunduh model AI wajah (${error?.message || 'unknown error'}). Pastikan folder /models tersedia di server dan refresh halaman.`;
      }
      console.error('[FaceRecognition] Gagal memuat model Face API:', error);

      // Reset promise agar bisa di-retry setelah koneksi pulih
      loadingPromise = null;
      return false;
    }
  })();

  return loadingPromise;
}

/**
 * Menghasilkan Face Descriptor (128 dimensi Array) dari elemen video/gambar.
 * @param videoEl Elemen HTMLVideoElement yang sedang aktif
 * @returns { descriptor: Float32Array, expressions: Object } atau null jika gagal
 */
export async function detectFace(videoEl: HTMLVideoElement) {
  if (!modelsLoaded) throw new Error("Model ML belum dimuat!");

  // Menggunakan TinyFaceDetector yang paling ringan dan optimal untuk web
  const detection = await faceapi
    .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceExpressions()
    .withFaceDescriptor();

  return detection || null;
}

/**
 * Membandingkan vektor referensi dari database dengan vektor baru dari kamera (Euclidean Distance).
 * @param descriptor1 Float32Array atau Array biasa
 * @param descriptor2 Float32Array atau Array biasa
 * @returns { isMatch: boolean, distance: number }
 */
export function matchFace(descriptor1: Float32Array | number[], descriptor2: Float32Array | number[]) {
  // Pastikan formatnya array Float32
  const arr1 = descriptor1 instanceof Float32Array ? descriptor1 : new Float32Array(descriptor1);
  const arr2 = descriptor2 instanceof Float32Array ? descriptor2 : new Float32Array(descriptor2);
  
  // Hitung Euclidean distance bawaan faceapi
  const distance = faceapi.euclideanDistance(arr1, arr2);
  
  // Threshold umum: jarak di bawah 0.6 dianggap orang yang sama
  const isMatch = distance < 0.6;
  
  return { isMatch, distance };
}
