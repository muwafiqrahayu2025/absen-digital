// ============================================================
// ABDI — Type Definitions (v2 — Universal Instansi/Kampus)
// ============================================================

/**
 * Role Hierarchy:
 * - developer     : SaaS developer, akses penuh ke semua fitur + console
 * - admin         : Administrator instansi/sekolah, kelola data & pengguna
 * - kepala_sekolah: Pimpinan (Kepala Sekolah / Rektor / Direktur), lihat rekap & setujui izin
 * - guru          : Pengajar (Guru / Dosen), presensi mandiri
 * - dosen         : Pengajar kampus, presensi mandiri (alias guru untuk perguruan tinggi)
 * - staf_sekolah  : Staf administrasi sekolah/madrasah, presensi mandiri
 * - staf_kampus   : Staf administrasi kampus/perguruan tinggi, presensi mandiri
 */
export type Role =
  | 'admin'
  | 'kepala_sekolah'
  | 'guru'
  | 'dosen'
  | 'staf_sekolah'
  | 'staf_kampus'
  | 'developer';

/** Label yang ramah untuk setiap role */
export const ROLE_LABELS: Record<Role, string> = {
  developer: 'SaaS Developer',
  admin: 'Administrator',
  kepala_sekolah: 'Pimpinan',
  guru: 'Pengajar',
  dosen: 'Pengajar',
  staf_sekolah: 'Staf',
  staf_kampus: 'Staf',
};

/** Semua role yang bisa melakukan presensi mandiri (scan QR / GPS) */
export const ATTENDANCE_ROLES: Role[] = [
  'guru',
  'dosen',
  'staf_sekolah',
  'staf_kampus',
  'kepala_sekolah',
];

/** Semua role yang punya akses manajemen (admin-level) */
export const MANAGEMENT_ROLES: Role[] = ['admin', 'developer'];

/** Wallpaper Latar Belakang Default 4K untuk Live TV Kiosk Proyektor */
export const DEFAULT_KIOSK_BG_URL = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80";

/** Untaian standar pengumuman panjang Teks Berjalan (Marquee) untuk Live QR Display */
export const DEFAULT_MARQUEE_TEXT = "📢 SELAMAT DATANG DI ABDI (ABSEN DIGITAL) - SISTEM PRESENSI CERDAS TERINTEGRASI • Solusi modern untuk pencatatan kehadiran yang akurat, aman, dan real-time • Fitur unggulan meliputi: QR Code Dinamis Anti-Kecurangan, Validasi Lokasi (GPS) Presisi, Verifikasi Wajah (Selfie), Rekapitulasi Data Otomatis, serta Dasbor Pemantauan Interaktif untuk Pengguna, Staf, dan Pimpinan Instansi • Mari wujudkan budaya disiplin yang transparan dan efisien • Terima kasih atas kedisiplinan Anda! • 🚀 Powered by Alpha Project. •";

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  password?: string;
  nip?: string;
  nuptk?: string;
  nrg?: string;
  pegId?: string;
  npk?: string;
  gender?: 'Laki-laki' | 'Perempuan';
  phone?: string;
  email?: string;
  address?: string;
  /** Induk organisasi, misal: "Dinas Pendidikan" / "Yayasan XYZ" / "Rektorat" */
  opd?: string;
  /** Unit kerja, misal: "SMAN 1 Kota X" / "Universitas Nusantara" */
  satuanKerja?: string;
  /** Jabatan fungsional, misal: "Guru Madya" / "Kepala Tata Usaha" */
  jabatan?: string;
  /** Mata pelajaran / bidang keahlian utama (bisa lebih dari satu, pisah koma) */
  mapelUtama?: string;
  /** Mata pelajaran sertifikasi */
  mapelSertifikasi?: string;
  /** Foto profil dalam format Base64 */
  photoUrl?: string;
  /** Tenant ID (sekolah) tempat pengguna bernaung. 'GLOBAL' untuk Super Admin */
  tenantId?: string;
}

export interface OPD {
  id: string;
  singkatan: string;
  nama: string;
}

export interface SatuanKerja {
  id: string;
  singkatan: string;
  nama: string;
  opdId: string;
}

export interface Jabatan {
  id: string;
  nama: string;
}

export interface CutiRequest {
  id: string;
  userId: string;
  jenis: 'Cuti Tahunan' | 'Izin' | 'Sakit' | 'Dinas/Lainnya';
  tanggalMulai: string;
  tanggalSelesai: string;
  alasan: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  dokumenUrl?: string;
}

export interface KinerjaRecord {
  id: string;
  userId: string;
  tanggal: string;
  tupoksi: string;
  uraian: string;
  satuan: string;
  jumlahDokumen: number;
}

export interface KopSurat {
  logo_url?: string;
  nama_dinas?: string;
  nama_instansi?: string;
  alamat?: string;
  telepon?: string;
  email?: string;
  website?: string;
  kode_pos?: string;
  [key: string]: any;
}


export interface School {
  name: string;
  address: string;
  phone: string;
  /** Batas jam masuk tepat waktu, format HH:mm */
  operationalCheckInLimit?: string;
  adminEmail?: string;
  latitude?: number;
  longitude?: number;
  /** Radius geofence dalam meter */
  radius?: number;
  principalName?: string;
  principalNip?: string;
  /** URL logo instansi (Base64 atau URL) */
  logoUrl?: string;
  /** URL atau ID Video YouTube untuk tayangan Live QR Display */
  youtubeVideoUrl?: string;
  /** URL Background Kiosk Live TV (Base64 atau URL) */
  kioskBgUrl?: string;
  /** Teks Berjalan (Marquee) dinamis untuk Live QR Display */
  marqueeText?: string;
  // ── Field Khusus Kop Surat Resmi ──────────────────────────
  logo_url?: string;
  nama_dinas?: string;
  nama_instansi?: string;
  alamat?: string;
  telepon?: string;
  email?: string;
  website?: string;
  kode_pos?: string;
  kopSurat?: KopSurat;
  licenseStatus?: string;
  // ── Notification API ──────────────────────────────────────
  whatsappApiKey?: string;
  whatsappApiKeyOtp?: string;
  /** URL Google Apps Script Web App untuk notifikasi via GAS */
  gasWebAppUrl?: string;
  waGatewayProvider?: 'fonnte' | 'wablas';
  wablasServerUrl?: string;
  [key: string]: any;
}

export interface AcademicYear {
  id: string;
  name: string;
  semester: 'Ganjil' | 'Genap';
  isActive: boolean;
}

export interface Holiday {
  id: string;
  /** Format: YYYY-MM-DD */
  date: string;
  description: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  /** Format: YYYY-MM-DD */
  date: string;
  /** Format: HH:mm:ss */
  checkInTime?: string;
  /** Format: HH:mm:ss */
  checkOutTime?: string;
  status: 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpha' | 'Cuti Tahunan';
  isSynced?: boolean;
  latitude?: number;
  longitude?: number;
  /** Jarak dari pusat lokasi instansi dalam meter */
  distance?: number;
  method?: 'scanner' | 'file' | 'manual' | 'external_scanner';
  syncAttempts?: number;
  syncError?: string;
  syncStatus?: 'synced' | 'pending' | 'syncing' | 'failed';
  notes?: string;
  /** Data QR/Barcode yang dipindai */
  qrBarcodeData?: string;
  /** Foto selfie biometrik saat presensi (Base64 JPEG) */
  photoDataUrl?: string;
  /** Apakah data ini ditandai untuk verifikasi admin (anomali GPS) */
  flaggedForReview?: boolean;
  /** Informasi perangkat saat presensi (OS, Browser, Kategori) */
  deviceInfo?: DeviceInfo;
}

export interface ClassSchedule {
  id: string;
  teacherId: string;
  dayOfWeek: string;
  subject: string;
  className: string;
  startTime: string;
  endTime: string;
}

export type LicensePlan = 'trial' | 'full' | 'hibah' | 'starter' | 'pro' | 'enterprise';

export interface SchoolLicense {
  plan: LicensePlan;
  schoolName: string;
  /** Format: ISO date string */
  activatedAt: string;
  /** null = selamanya (hibah) */
  expiresAt: string | null;
  maxUsers: number;
  licenseKey: string;
  /** Username atau nama developer yang mengaktifkan */
  activatedBy: string;
  notes?: string;
}

export interface DeviceInfo {
  os: string;
  browser: string;
  category: 'Mobile' | 'Desktop' | 'Tablet' | 'Unknown';
  rawUserAgent?: string;
  screenResolution?: string;
}

export interface DeviceSessionLog {
  id: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  action: 'LOGIN' | 'PRESENSI_IN' | 'PRESENSI_OUT' | 'SECURITY_FLAG' | 'API_ACCESS' | 'USER_ACTION';
  timestamp: string; // Format ISO string
  ipAddress?: string;
  device: DeviceInfo;
  details?: string;
  status: 'SUCCESS' | 'SUSPICIOUS' | 'BLOCKED' | 'INFO';
}

