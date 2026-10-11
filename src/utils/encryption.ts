/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  ABDI Absen Digital — Application-Layer Encryption Engine        ║
 * ║  src/utils/encryption.ts                                         ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  ARSITEKTUR KEAMANAN — LAPISAN 1: CLIENT-SIDE ENCRYPTION         ║
 * ║                                                                  ║
 * ║  Tujuan: Mengenkripsi data SANGAT SENSITIF (NIK, foto biometrik  ║
 * ║  selfi presensi, nomor kepegawaian) di sisi klien SEBELUM        ║
 * ║  dikirimkan ke Firebase. Meskipun Firebase sudah menggunakan     ║
 * ║  TLS (in-transit) dan AES-256 (at-rest) secara default,         ║
 * ║  lapisan ini memastikan bahwa bahkan jika terjadi pelanggaran    ║
 * ║  di level database, data sensitif tetap tidak terbaca.          ║
 * ║                                                                  ║
 * ║  Strategi:                                                       ║
 * ║  1. PRIMARY  — Web Crypto API (native browser, FIPS-140 grade)   ║
 * ║     • AES-GCM-256: Authenticated encryption, mencegah tampering  ║
 * ║     • PBKDF2: Key derivation dari env secret + user-specific salt ║
 * ║  2. FALLBACK — CryptoJS AES-256 (untuk browser lama)             ║
 * ║                                                                  ║
 * ║  PENTING: Secret key diambil dari environment variable.          ║
 * ║  Tambahkan ke .env: VITE_ENCRYPTION_SECRET=<random-32-char-key>  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import CryptoJS from 'crypto-js';

// ─────────────────────────────────────────────────────────────────────────────
// KONFIGURASI & KONSTANTA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kunci rahasia utama dari environment variable.
 * WAJIB diset di .env: VITE_ENCRYPTION_SECRET=<random-strong-key>
 *
 * Fallback hanya untuk development/testing — JANGAN digunakan di produksi.
 *
 * Cara generate key yang aman di terminal:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
const APP_ENCRYPTION_SECRET: string =
  (import.meta as any).env?.VITE_ENCRYPTION_SECRET ||
  'ABDI_DEV_FALLBACK_KEY_CHANGE_IN_PRODUCTION_32CH';

/** Jumlah iterasi PBKDF2 — semakin tinggi semakin aman tapi lebih lambat */
const PBKDF2_ITERATIONS = 100_000;

/** Panjang kunci AES-GCM dalam bit */
const AES_KEY_LENGTH = 256;

/** Versi format enkripsi — increment saat ada breaking change pada format */
const CIPHER_VERSION = 'v2';

/** Prefix identifier untuk membedakan format ciphertext versi ini */
const CIPHER_PREFIX = `ABDI_ENC_${CIPHER_VERSION}:`;

// ─────────────────────────────────────────────────────────────────────────────
// UTILITAS INTERNAL
// ─────────────────────────────────────────────────────────────────────────────

/** Mengecek apakah Web Crypto API tersedia di browser/lingkungan saat ini */
function isWebCryptoAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.crypto !== 'undefined' &&
    typeof window.crypto.subtle !== 'undefined'
  );
}

/** Konversi string ke ArrayBuffer (UTF-8) */
function stringToBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer as ArrayBuffer;
}

/** Konversi ArrayBuffer ke string Base64 yang aman untuk disimpan di Firebase */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Konversi string Base64 kembali ke ArrayBuffer */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB CRYPTO API — LAYER UTAMA (AES-GCM-256)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Menurunkan CryptoKey dari secret + salt menggunakan PBKDF2.
 *
 * ALUR:
 * 1. Import secret sebagai raw key material
 * 2. Derive key 256-bit menggunakan PBKDF2 + SHA-256 + salt
 * 3. Return CryptoKey siap pakai untuk AES-GCM
 *
 * @param salt - Salt unik per enkripsi (mencegah rainbow table attack)
 */
async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    stringToBuffer(APP_ENCRYPTION_SECRET),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Enkripsi data menggunakan AES-GCM-256 via Web Crypto API.
 *
 * FORMAT OUTPUT (Base64-encoded JSON):
 * {
 *   "s": "<16-byte salt dalam Base64>",
 *   "iv": "<12-byte IV dalam Base64>",
 *   "ct": "<ciphertext + GCM auth tag dalam Base64>"
 * }
 *
 * KEUNGGULAN AES-GCM vs AES-CBC:
 * - Authenticated encryption: GCM menghasilkan authentication tag yang
 *   mendeteksi perubahan/tampering pada ciphertext secara otomatis
 * - Tidak perlu HMAC terpisah
 * - IV (nonce) 12-byte adalah rekomendasi NIST untuk GCM
 *
 * @param plaintext - Data sensitif yang akan dienkripsi
 * @returns Promise<string> - Ciphertext dalam format ABDI_ENC_v2:<base64-payload>
 */
async function encryptWithWebCrypto(plaintext: string): Promise<string> {
  // Generate salt dan IV secara kriptografis aman
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit nonce untuk GCM

  const key = await deriveKey(salt);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    stringToBuffer(plaintext)
  );

  // Paket semua komponen menjadi satu payload
  const payload = {
    s: bufferToBase64(salt.buffer),    // Salt untuk PBKDF2
    iv: bufferToBase64(iv.buffer),     // IV/Nonce untuk AES-GCM
    ct: bufferToBase64(encryptedBuffer), // Ciphertext + GCM Auth Tag
  };

  return `${CIPHER_PREFIX}${btoa(JSON.stringify(payload))}`;
}

/**
 * Dekripsi data yang dienkripsi dengan Web Crypto API.
 *
 * Proses: Parse payload → Derive key dari salt → Dekripsi AES-GCM
 * GCM otomatis memverifikasi auth tag — jika data dimanipulasi,
 * akan throw error "OperationError".
 *
 * @param ciphertext - String terenkripsi dari `encryptWithWebCrypto`
 * @returns Promise<string | null> - Plaintext asli, atau null jika gagal
 */
async function decryptWithWebCrypto(ciphertext: string): Promise<string | null> {
  try {
    if (!ciphertext.startsWith(CIPHER_PREFIX)) {
      throw new Error('Format ciphertext tidak dikenal');
    }

    const base64Payload = ciphertext.slice(CIPHER_PREFIX.length);
    const payload = JSON.parse(atob(base64Payload));

    const salt = new Uint8Array(base64ToBuffer(payload.s));
    const iv = new Uint8Array(base64ToBuffer(payload.iv));
    const encryptedBuffer = base64ToBuffer(payload.ct);

    const key = await deriveKey(salt);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encryptedBuffer
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    console.error('[ABDI Encryption] Dekripsi Web Crypto gagal:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRYPTOJS — FALLBACK LAYER (AES-256-CBC + PBKDF2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enkripsi fallback menggunakan CryptoJS untuk browser yang tidak mendukung
 * Web Crypto API. Format output diberi prefix berbeda agar mudah diidentifikasi.
 */
function encryptWithCryptoJS(plaintext: string): string {
  const salt = CryptoJS.lib.WordArray.random(16);
  const key = CryptoJS.PBKDF2(APP_ENCRYPTION_SECRET, salt, {
    keySize: 256 / 32,
    iterations: 10_000, // Lebih rendah dari WC karena CryptoJS lebih lambat
    hasher: CryptoJS.algo.SHA256,
  });
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, { iv });

  const payload = {
    s: salt.toString(CryptoJS.enc.Base64),
    iv: iv.toString(CryptoJS.enc.Base64),
    ct: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
    _fb: true, // marker bahwa ini fallback CryptoJS
  };

  return `${CIPHER_PREFIX}${btoa(JSON.stringify(payload))}`;
}

/** Dekripsi fallback menggunakan CryptoJS */
function decryptWithCryptoJS(ciphertext: string): string | null {
  try {
    if (!ciphertext.startsWith(CIPHER_PREFIX)) return null;

    const payload = JSON.parse(atob(ciphertext.slice(CIPHER_PREFIX.length)));
    if (!payload._fb) return null;

    const salt = CryptoJS.enc.Base64.parse(payload.s);
    const iv = CryptoJS.enc.Base64.parse(payload.iv);
    const ct = CryptoJS.enc.Base64.parse(payload.ct);

    const key = CryptoJS.PBKDF2(APP_ENCRYPTION_SECRET, salt, {
      keySize: 256 / 32,
      iterations: 10_000,
      hasher: CryptoJS.algo.SHA256,
    });

    const decrypted = CryptoJS.AES.decrypt({ ciphertext: ct } as any, key, { iv });
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    return result || null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API PUBLIK — FUNGSI YANG DIEKSPOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ═══════════════════════════════════════════════════════════════
 * FUNGSI UTAMA: encryptSensitiveData
 * ═══════════════════════════════════════════════════════════════
 *
 * Mengenkripsi data sangat sensitif (NIK, foto biometrik, dll.)
 * di sisi klien SEBELUM dikirim ke Firebase.
 *
 * Gunakan ini untuk field berikut sebelum menyimpan ke database:
 *  - NIK (Nomor Induk Kependudukan)
 *  - NIP/NRG/NUPTK
 *  - photoDataUrl (foto selfie biometrik presensi)
 *  - Data biometrik lainnya
 *
 * CONTOH PENGGUNAAN:
 * ```typescript
 * import { encryptSensitiveData } from '@/utils/encryption';
 *
 * // Sebelum menyimpan record presensi ke Firebase:
 * const encryptedPhoto = await encryptSensitiveData(photoBase64String);
 * const encryptedNIK   = await encryptSensitiveData(user.nik);
 *
 * await set(ref(db, `tenants/${tenantId}/attendance/${id}`), {
 *   ...attendanceData,
 *   photoDataUrl: encryptedPhoto,  // Terenkripsi AES-GCM-256
 * });
 * ```
 *
 * @param plaintext - Data sensitif yang akan dienkripsi (string/JSON)
 * @returns Promise<string> - Ciphertext aman untuk disimpan di Firebase
 */
export async function encryptSensitiveData(plaintext: string | object): Promise<string> {
  if (plaintext === null || plaintext === undefined) return '';

  // Serialisasi objek menjadi JSON string jika diperlukan
  const dataString =
    typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);

  if (!dataString) return '';

  try {
    if (isWebCryptoAvailable()) {
      // Path utama: Web Crypto API (AES-GCM-256 + PBKDF2)
      return await encryptWithWebCrypto(dataString);
    } else {
      // Path fallback: CryptoJS (lingkungan tanpa Web Crypto)
      console.warn('[ABDI Encryption] Web Crypto tidak tersedia, menggunakan CryptoJS fallback.');
      return encryptWithCryptoJS(dataString);
    }
  } catch (err) {
    console.error('[ABDI Encryption] Enkripsi gagal:', err);
    // KEPUTUSAN KEAMANAN: Jika enkripsi gagal, JANGAN simpan data plaintext.
    // Lempar error agar proses upstream tahu enkripsi gagal dan bisa menangani.
    throw new Error(`[ABDI Encryption] Enkripsi data sensitif gagal: ${String(err)}`);
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * FUNGSI UTAMA: decryptSensitiveData
 * ═══════════════════════════════════════════════════════════════
 *
 * Mendekripsi data yang sebelumnya dienkripsi oleh `encryptSensitiveData`.
 * Otomatis mendeteksi metode enkripsi (WebCrypto atau CryptoJS fallback).
 *
 * CONTOH PENGGUNAAN:
 * ```typescript
 * import { decryptSensitiveData } from '@/utils/encryption';
 *
 * // Saat membaca data dari Firebase:
 * const record = await get(ref(db, `tenants/${tenantId}/attendance/${id}`));
 * const decryptedPhoto = await decryptSensitiveData(record.photoDataUrl);
 * ```
 *
 * @param ciphertext - Data terenkripsi dari Firebase
 * @returns Promise<string | null> - Plaintext asli, atau null jika gagal/bukan ciphertext
 */
export async function decryptSensitiveData(ciphertext: string): Promise<string | null> {
  if (!ciphertext || typeof ciphertext !== 'string') return null;

  // Jika data tidak memiliki prefix enkripsi ABDI, kembalikan apa adanya
  // (kompatibilitas mundur dengan data lama yang belum dienkripsi)
  if (!ciphertext.startsWith(CIPHER_PREFIX)) {
    return ciphertext;
  }

  try {
    let payload: any;
    try {
      payload = JSON.parse(atob(ciphertext.slice(CIPHER_PREFIX.length)));
    } catch {
      return null;
    }

    if (payload._fb) {
      // Fallback CryptoJS
      return decryptWithCryptoJS(ciphertext);
    } else {
      // Primary Web Crypto
      if (isWebCryptoAvailable()) {
        return await decryptWithWebCrypto(ciphertext);
      }
      // Jika sekarang tidak ada WebCrypto tapi data dienkripsi dengan WebCrypto
      console.error('[ABDI Encryption] Data dienkripsi WebCrypto tapi browser tidak support. Tidak bisa dekripsi.');
      return null;
    }
  } catch (err) {
    console.error('[ABDI Encryption] Dekripsi gagal:', err);
    return null;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * FUNGSI UTILITAS: decryptSensitiveDataAsObject
 * ═══════════════════════════════════════════════════════════════
 *
 * Mendekripsi dan langsung mem-parse hasil dekripsi sebagai objek JSON.
 * Berguna untuk data yang disimpan sebagai JSON terenkripsi.
 *
 * @template T - Tipe data yang diharapkan setelah parsing
 */
export async function decryptSensitiveDataAsObject<T = any>(
  ciphertext: string
): Promise<T | null> {
  const plaintext = await decryptSensitiveData(ciphertext);
  if (!plaintext) return null;
  try {
    return JSON.parse(plaintext) as T;
  } catch {
    return plaintext as unknown as T;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * FUNGSI UTILITAS: isEncrypted
 * ═══════════════════════════════════════════════════════════════
 *
 * Mengecek apakah sebuah string sudah dienkripsi oleh modul ini.
 * Berguna untuk logika conditional saat membaca data Firebase
 * (membedakan data lama plaintext vs data baru yang terenkripsi).
 *
 * @param value - String yang akan dicek
 * @returns boolean - true jika sudah dienkripsi
 */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(CIPHER_PREFIX);
}

/**
 * ═══════════════════════════════════════════════════════════════
 * FUNGSI UTILITAS: encryptAttendancePhoto
 * ═══════════════════════════════════════════════════════════════
 *
 * Helper khusus untuk mengenkripsi foto selfie biometrik presensi.
 * Foto Base64 bisa sangat besar (>200KB), jadi fungsi ini menambahkan
 * metadata tambahan untuk audit trail.
 *
 * @param photoBase64 - Foto selfie dalam format Base64 Data URL
 * @param userId - UID pengguna (untuk metadata audit)
 * @returns Promise<string> - Ciphertext foto terenkripsi
 */
export async function encryptAttendancePhoto(
  photoBase64: string,
  userId: string
): Promise<string> {
  const payload = {
    photo: photoBase64,
    userId,
    encryptedAt: new Date().toISOString(),
    version: CIPHER_VERSION,
  };
  return encryptSensitiveData(JSON.stringify(payload));
}

/**
 * ═══════════════════════════════════════════════════════════════
 * FUNGSI UTILITAS: getEncryptionStatus
 * ═══════════════════════════════════════════════════════════════
 *
 * Mengembalikan status konfigurasi enkripsi saat ini.
 * Gunakan di Developer Console untuk audit keamanan.
 */
export function getEncryptionStatus(): {
  isWebCryptoAvailable: boolean;
  isSecretFromEnv: boolean;
  cipherVersion: string;
  algorithm: string;
  keyDerivation: string;
} {
  const isFromEnv = !!(import.meta as any).env?.VITE_ENCRYPTION_SECRET;
  return {
    isWebCryptoAvailable: isWebCryptoAvailable(),
    isSecretFromEnv: isFromEnv,
    cipherVersion: CIPHER_VERSION,
    algorithm: isWebCryptoAvailable() ? 'AES-GCM-256' : 'AES-CBC-256 (CryptoJS fallback)',
    keyDerivation: `PBKDF2-SHA256 (${isWebCryptoAvailable() ? PBKDF2_ITERATIONS.toLocaleString() : '10,000'} iterations)`,
  };
}
