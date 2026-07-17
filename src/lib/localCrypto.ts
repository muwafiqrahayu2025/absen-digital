/**
 * ============================================================
 * ABDI Absen Digital — Local Crypto Engine (v2)
 * ============================================================
 * - AES-256 symmetric encryption untuk IndexedDB (tetap)
 * - PBKDF2 + SHA-256 salted password hashing (BARU)
 * - Brute-force Rate Limiter / Account Lockout (BARU)
 * ============================================================
 */

import CryptoJS from 'crypto-js';

const FALLBACK_SECRET = 'ABDI_DIGITAL_AES_KEY_2026_SECURE_OFFLINE_FIRST';

// ─────────────────────────────────────────────────────────────
// KUNCI ENKRIPSI DINAMIS
// ─────────────────────────────────────────────────────────────

/**
 * Mendapatkan kunci enkripsi dinamis berdasarkan kombinasi Token Instansi / Kode Registrasi.
 */
export function getSecretKey(): string {
  try {
    const regToken = localStorage.getItem('abdi_registration_token') || '';
    const schoolData = localStorage.getItem('school');
    let schoolName = 'ABDI_INSTANSI_SEKOLAH';
    if (schoolData) {
      try {
        const parsed = JSON.parse(schoolData);
        if (parsed.name) schoolName = parsed.name;
      } catch (e) {}
    }
    return `${regToken}_${schoolName}_${FALLBACK_SECRET}`;
  } catch (err) {
    return FALLBACK_SECRET;
  }
}

// ─────────────────────────────────────────────────────────────
// AES-256 ENKRIPSI / DEKRIPSI (IndexedDB)
// ─────────────────────────────────────────────────────────────

/**
 * Enkripsi simetris AES-256 sebelum data disimpan ke dalam IndexedDB.
 */
export function encryptData(data: any): string {
  if (data === null || data === undefined) return '';
  try {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonStr, getSecretKey()).toString();
  } catch (err) {
    console.error('Error encrypting local data:', err);
    return '';
  }
}

/**
 * Dekripsi data AES-256 saat dibaca dari IndexedDB.
 */
export function decryptData<T = any>(ciphertext: string): T | null {
  if (!ciphertext || typeof ciphertext !== 'string') return null;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, getSecretKey());
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedStr) return null;
    try {
      return JSON.parse(decryptedStr) as T;
    } catch (e) {
      return decryptedStr as unknown as T;
    }
  } catch (err) {
    // Jika gagal dekripsi (misal kunci berganti atau data corrupt/plaintext lama)
    try {
      return JSON.parse(ciphertext) as T;
    } catch (e) {
      return null;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// PBKDF2 + SHA-256 SALTED PASSWORD HASHING (BARU)
// ─────────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 10000;
const PBKDF2_KEY_SIZE = 8; // 256-bit = 8 x 32-bit words

/**
 * Menghasilkan salt acak 16-karakter hex.
 */
function generateSalt(): string {
  return CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
}

/**
 * Hash password menggunakan PBKDF2 + SHA-256 dengan salt unik.
 * Format output: "salt:hash" (keduanya dalam hex)
 *
 * Digunakan saat: pertama kali login sukses (upgrade password lama ke hashed)
 */
export function hashPassword(plainPassword: string): string {
  const salt = generateSalt();
  const key = CryptoJS.PBKDF2(plainPassword, salt, {
    keySize: PBKDF2_KEY_SIZE,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });
  return `${salt}:${key.toString(CryptoJS.enc.Hex)}`;
}

/**
 * Memverifikasi password plaintext terhadap hash PBKDF2 yang tersimpan.
 * Mendukung dua mode:
 *  1. Hash PBKDF2 baru (format "salt:hash") → gunakan PBKDF2
 *  2. Password plaintext lama (tidak mengandung ":") → bandingkan langsung
 *     (untuk kompatibilitas mundur; akan di-upgrade saat login berikutnya)
 */
export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  if (!storedHash) return false;

  // Mode 1: PBKDF2 hash baru
  if (storedHash.includes(':') && storedHash.split(':')[0].length === 32) {
    try {
      const [salt, expectedHash] = storedHash.split(':');
      const key = CryptoJS.PBKDF2(plainPassword, salt, {
        keySize: PBKDF2_KEY_SIZE,
        iterations: PBKDF2_ITERATIONS,
        hasher: CryptoJS.algo.SHA256,
      });
      return key.toString(CryptoJS.enc.Hex) === expectedHash;
    } catch {
      return false;
    }
  }

  // Mode 2: Plaintext legacy (kompatibilitas mundur)
  return plainPassword === storedHash;
}

/**
 * Mengecek apakah password sudah dalam format PBKDF2 hash atau masih plaintext.
 */
export function isHashedPassword(storedValue: string): boolean {
  if (!storedValue) return false;
  const parts = storedValue.split(':');
  return parts.length === 2 && parts[0].length === 32 && parts[1].length === 64;
}

// ─────────────────────────────────────────────────────────────
// BRUTE-FORCE RATE LIMITER / ACCOUNT LOCKOUT (BARU)
// ─────────────────────────────────────────────────────────────

const LOCKOUT_KEY_PREFIX = 'abdi_login_attempts_';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 menit

interface LoginAttemptRecord {
  count: number;
  lastFailedAt: number;
  lockedUntil: number | null;
}

function getAttemptRecord(username: string): LoginAttemptRecord {
  try {
    const raw = localStorage.getItem(`${LOCKOUT_KEY_PREFIX}${username.toLowerCase()}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { count: 0, lastFailedAt: 0, lockedUntil: null };
}

function saveAttemptRecord(username: string, record: LoginAttemptRecord): void {
  try {
    localStorage.setItem(
      `${LOCKOUT_KEY_PREFIX}${username.toLowerCase()}`,
      JSON.stringify(record)
    );
  } catch {}
}

/**
 * Mencatat percobaan login yang gagal untuk username tertentu.
 * Mengunci akun selama 15 menit setelah 5 kali gagal berturut-turut.
 *
 * @returns Objek dengan status apakah akun terkunci dan info tambahan
 */
export function recordFailedLogin(username: string): {
  isLocked: boolean;
  attemptsRemaining: number;
  lockedUntil: Date | null;
  message: string;
} {
  const record = getAttemptRecord(username);
  const now = Date.now();

  // Reset jika sudah lebih dari 15 menit dari percobaan gagal terakhir
  if (record.lastFailedAt && now - record.lastFailedAt > LOCKOUT_DURATION_MS) {
    record.count = 0;
    record.lockedUntil = null;
  }

  record.count++;
  record.lastFailedAt = now;

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    saveAttemptRecord(username, record);
    const lockedUntilDate = new Date(record.lockedUntil);
    const timeStr = lockedUntilDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return {
      isLocked: true,
      attemptsRemaining: 0,
      lockedUntil: lockedUntilDate,
      message: `Akun dikunci sementara karena terlalu banyak percobaan gagal. Coba lagi setelah pukul ${timeStr}.`,
    };
  }

  saveAttemptRecord(username, record);
  const remaining = MAX_FAILED_ATTEMPTS - record.count;
  return {
    isLocked: false,
    attemptsRemaining: remaining,
    lockedUntil: null,
    message: `Password salah. ${remaining} percobaan tersisa sebelum akun dikunci.`,
  };
}

/**
 * Mengecek apakah akun sedang terkunci sebelum mencoba login.
 */
export function checkAccountLockout(username: string): {
  isLocked: boolean;
  lockedUntil: Date | null;
  message: string;
} {
  const record = getAttemptRecord(username);
  const now = Date.now();

  if (record.lockedUntil && now < record.lockedUntil) {
    const lockedUntilDate = new Date(record.lockedUntil);
    const remainingMs = record.lockedUntil - now;
    const remainingMin = Math.ceil(remainingMs / 60000);
    return {
      isLocked: true,
      lockedUntil: lockedUntilDate,
      message: `Akun dikunci. Silakan coba lagi dalam ${remainingMin} menit.`,
    };
  }

  return { isLocked: false, lockedUntil: null, message: '' };
}

/**
 * Mereset hitungan percobaan login saat login berhasil.
 */
export function resetLoginAttempts(username: string): void {
  try {
    localStorage.removeItem(`${LOCKOUT_KEY_PREFIX}${username.toLowerCase()}`);
  } catch {}
}

/**
 * Mendapatkan status semua akun yang sedang terkunci (untuk Developer Console).
 */
export function getLockedAccounts(): Array<{ username: string; lockedUntil: Date; remainingMin: number }> {
  const locked: Array<{ username: string; lockedUntil: Date; remainingMin: number }> = [];
  const now = Date.now();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LOCKOUT_KEY_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const record: LoginAttemptRecord = JSON.parse(raw);
          if (record.lockedUntil && now < record.lockedUntil) {
            locked.push({
              username: key.replace(LOCKOUT_KEY_PREFIX, ''),
              lockedUntil: new Date(record.lockedUntil),
              remainingMin: Math.ceil((record.lockedUntil - now) / 60000),
            });
          }
        }
      }
    }
  } catch {}
  return locked;
}
