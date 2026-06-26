export type Role = 'admin' | 'kepala_madrasah' | 'guru' | 'staf_sekolah' | 'developer';

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
  opd?: string; // e.g. KEMENAG
  satuanKerja?: string; // e.g. Madrasah Aliyah Negeri 1
  jabatan?: string; // e.g. Guru Utama
  mapelUtama?: string; // e.g. "Fisika, Matematika" (bisa lebih dari satu)
  mapelSertifikasi?: string; // e.g. "Fisika"
  photoUrl?: string; // Base64 profile photo
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

export interface School {
  name: string;
  address: string;
  phone: string;
  operationalCheckInLimit?: string; // HH:mm
  adminEmail?: string;
  latitude?: number;
  longitude?: number;
  radius?: number; // in meters
  principalName?: string;
  principalNip?: string;
  logoUrl?: string;
  // Notification API Keys
  whatsappApiKey?: string;
  whatsappApiKeyOtp?: string;
  gasWebAppUrl?: string; // URL Web App dari Google Apps Script
}

export interface AcademicYear {
  id: string;
  name: string;
  semester: 'Ganjil' | 'Genap';
  isActive: boolean;
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  checkInTime?: string; // HH:mm:ss
  checkOutTime?: string; // HH:mm:ss
  status: 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpha';
  isSynced?: boolean;
  latitude?: number;
  longitude?: number;
  distance?: number; // distance from school center
  method?: 'scanner' | 'file' | 'manual';
  syncAttempts?: number;
  syncError?: string;
  syncStatus?: 'synced' | 'pending' | 'syncing' | 'failed';
  notes?: string;
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
