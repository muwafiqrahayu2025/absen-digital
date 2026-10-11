/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ABDI Absen Digital — API Client (src/lib/apiClient.ts)              ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Thin fetch wrapper yang:                                            ║
 * ║  1. Auto-attach Firebase ID Token via onIdTokenChanged               ║
 * ║     (token di-refresh otomatis, tidak pernah kedaluwarsa)           ║
 * ║  2. Handle 401 → paksa logout + redirect ke /login                  ║
 * ║  3. Handle timeout (15 detik)                                        ║
 * ║  4. Base URL dari VITE_BACKEND_URL (aman — hanya URL, bukan secret)  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import { auth } from './firebase';
import { onIdTokenChanged, type User as FirebaseUser } from 'firebase/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Konfigurasi
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined)
  ?? 'http://localhost:3001';

const REQUEST_TIMEOUT_MS = 15_000;

// ─────────────────────────────────────────────────────────────────────────────
// Token cache — diperbarui otomatis via onIdTokenChanged
// ─────────────────────────────────────────────────────────────────────────────

/** Token yang selalu fresh — Firebase refresh otomatis setiap ~1 jam */
let _cachedToken: string | null = null;
let _tokenInitialized = false;
let _tokenInitPromise: Promise<void> | null = null;

/**
 * Mulai listen perubahan token saat modul dimuat.
 * onIdTokenChanged dipanggil oleh Firebase saat:
 *   - User pertama kali login
 *   - Token diperbarui otomatis (setiap ~1 jam)
 *   - User logout (token = null)
 */
function startTokenListener(): Promise<void> {
  if (_tokenInitPromise) return _tokenInitPromise;

  _tokenInitPromise = new Promise<void>((resolve) => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          // getIdToken() — gunakan token cache Firebase, bukan force-refresh tiap kali
          // Firebase sendiri sudah handle refresh jika token < 5 menit tersisa
          _cachedToken = await firebaseUser.getIdToken(false);
        } catch (err) {
          console.error('[apiClient] Gagal mendapatkan ID token:', err);
          _cachedToken = null;
        }
      } else {
        // User logout
        _cachedToken = null;
      }

      if (!_tokenInitialized) {
        _tokenInitialized = true;
        // Hanya unsubscribe listener "initial" — listener utama tetap aktif
        // untuk menangkap refresh token otomatis Firebase
        resolve();
      }
    });

    // Simpan unsubscribe ke closure — listener hidup sepanjang app session
    // Jika perlu cleanup (misal unit test), panggil stopTokenListener()
    _activeUnsubscribe = unsubscribe;
  });

  return _tokenInitPromise;
}

let _activeUnsubscribe: (() => void) | null = null;

export function stopTokenListener() {
  if (_activeUnsubscribe) {
    _activeUnsubscribe();
    _activeUnsubscribe = null;
  }
  _cachedToken = null;
  _tokenInitialized = false;
  _tokenInitPromise = null;
}

// Mulai listener segera saat modul di-import
startTokenListener();

// ─────────────────────────────────────────────────────────────────────────────
// Tipe Respons
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  ok: boolean;
}

export interface ApiError {
  error: string;
  message: string;
  status: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fungsi Internal
// ─────────────────────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  // Tunggu sampai token listener siap (biasanya < 100ms)
  await startTokenListener();

  if (!_cachedToken) {
    // Tidak ada user yang login — jangan throw di sini,
    // biarkan server yang reject dengan 401
    console.warn('[apiClient] Tidak ada token — user mungkin belum login.');
    return { 'Content-Type': 'application/json' };
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${_cachedToken}`,
  };
}

/**
 * Paksa refresh token (gunakan jika menerima 401 dari server).
 * Firebase normalnya refresh sendiri, tapi ada edge case
 * (misal jam sistem bergeser) yang perlu force-refresh.
 */
async function forceRefreshToken(): Promise<string | null> {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return null;

  try {
    _cachedToken = await firebaseUser.getIdToken(true); // force = true
    return _cachedToken;
  } catch (err) {
    console.error('[apiClient] Force refresh token gagal:', err);
    _cachedToken = null;
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timeout setelah ${ms}ms`)), ms),
    ),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fungsi Utama
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kirim request ke backend ABDI dengan:
 * - Auto-attach Firebase ID Token
 * - Retry sekali dengan force-refresh jika dapat 401
 * - Timeout 15 detik
 */
async function request<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  body?: unknown,
  retrying = false,
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`;
  const headers = await getAuthHeaders();

  const fetchOptions: RequestInit = {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let response: Response;
  try {
    response = await withTimeout(fetch(url, fetchOptions), REQUEST_TIMEOUT_MS);
  } catch (err: any) {
    throw { error: 'network-error', message: err.message ?? 'Gagal terhubung ke server.', status: 0 } as ApiError;
  }

  // ── Handle 401: coba refresh token sekali ──────────────────────────────
  if (response.status === 401 && !retrying) {
    console.warn('[apiClient] 401 diterima — mencoba refresh token...');
    const refreshed = await forceRefreshToken();

    if (refreshed) {
      // Retry dengan token baru
      return request<T>(method, path, body, true);
    } else {
      // Tidak bisa refresh → user harus login ulang
      console.error('[apiClient] Refresh gagal. Redirect ke /login.');
      window.location.href = '/login';
      throw { error: 'unauthenticated', message: 'Sesi habis. Silakan login kembali.', status: 401 } as ApiError;
    }
  }

  // ── Handle 429: Rate Limited ─────────────────────────────────────────────
  if (response.status === 429) {
    throw {
      error: 'rate-limited',
      message: 'Terlalu banyak permintaan. Tunggu beberapa saat.',
      status: 429,
    } as ApiError;
  }

  // ── Handle 403 ──────────────────────────────────────────────────────────
  if (response.status === 403) {
    const body = await response.json().catch(() => ({}));
    throw {
      error: 'permission-denied',
      message: (body as any)?.message ?? 'Akses ditolak.',
      status: 403,
    } as ApiError;
  }

  // ── Parse respons ────────────────────────────────────────────────────────
  let data: T;
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    data = await response.json() as T;
  } else {
    data = (await response.text()) as unknown as T;
  }

  if (!response.ok) {
    throw {
      error: (data as any)?.error ?? 'server-error',
      message: (data as any)?.message ?? `Server error ${response.status}`,
      status: response.status,
    } as ApiError;
  }

  return { data, status: response.status, ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export const apiClient = {
  get: <T = unknown>(path: string) =>
    request<T>('GET', path),

  post: <T = unknown>(path: string, body: unknown) =>
    request<T>('POST', path, body),

  put: <T = unknown>(path: string, body: unknown) =>
    request<T>('PUT', path, body),

  patch: <T = unknown>(path: string, body: unknown) =>
    request<T>('PATCH', path, body),

  delete: <T = unknown>(path: string) =>
    request<T>('DELETE', path),
};

// ─────────────────────────────────────────────────────────────────────────────
// Tipe Spesifik untuk Endpoint ABDI
// ─────────────────────────────────────────────────────────────────────────────

/** Request ke POST /api/attendance */
export interface AttendanceRequest {
  tenantId: string;
  latitude: number;
  longitude: number;
  photoDataUrl?: string;      // Base64 foto mentah — dienkripsi di server
  qrToken?: string;
  mode: 'check_in' | 'check_out';
  methodType: 'scanner' | 'file' | 'external_scanner';
  date: string;               // Format YYYY-MM-DD
  biometricStatus?: string;
}

/** Respons dari POST /api/attendance */
export interface AttendanceResponse {
  success: boolean;
  message: string;
  recordId?: string;
  distance?: number;
  encryptedPhotoStored?: boolean;
  status?: string;
  flaggedForReview?: boolean;
}

/** Request ke POST /api/secure/encrypt */
export interface EncryptRequest {
  data: string;
  context?: string;
}

/** Respons dari POST /api/secure/encrypt */
export interface EncryptResponse {
  ciphertext: string;
  context?: string;
}

/** Request ke POST /api/attendance/pending-photo */
export interface PendingPhotoUploadRequest {
  attendanceId: string;
  tenantId: string;
  photoDataUrl: string;       // Base64 foto saat sudah online kembali
}

/** Request ke POST /api/auth/otp/send (SEC-007) */
export interface OtpSendRequest {
  phone: string;
  userId: string;
  tenantId?: string;
  purpose?: 'login' | 'reset';
}

/** Request ke POST /api/auth/otp/verify (SEC-007) */
export interface OtpVerifyRequest {
  userId: string;
  otp: string;
}

export const authApi = {
  sendOtp: (payload: OtpSendRequest) =>
    apiClient.post<{ success: boolean; message: string }>('/api/auth/otp/send', payload),
  verifyOtp: (payload: OtpVerifyRequest) =>
    apiClient.post<{ success: boolean; message: string }>('/api/auth/otp/verify', payload),
};
