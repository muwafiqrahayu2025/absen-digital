import { LicensePlan, SchoolLicense } from '../types';
import { pushToFirebase } from './firebaseSync';
import { addDays, addYears, differenceInDays } from 'date-fns';

export interface PlanConfigItem {
  name: string;
  plan: LicensePlan;
  durationString: string;
  durationDays: number | null; // null = unlimited
  maxUsers: number; // 999999 = unlimited
  maxUsersString: string;
  gpsSelfie: boolean;
  scanQr: boolean;
  whatsappNotif: boolean;
  exportPdf: boolean;
  exportExcel: boolean;
  leaveManagement: boolean;
  fullRecap: boolean;
  aiAnalytics: boolean;
  multiSchool: boolean;
  prioritySupport: boolean;
  pricePerMonth: number;
  priceString: string;
  description: string;
  badgeColor: string;
}

export const PLAN_CONFIG: Record<LicensePlan, PlanConfigItem> = {
  trial: {
    name: 'Paket Trial',
    plan: 'trial',
    durationString: '2 Minggu Uji Coba',
    durationDays: 14,
    maxUsers: 10,
    maxUsersString: '10 Guru & Staf',
    gpsSelfie: true,
    scanQr: true,
    whatsappNotif: true,
    exportPdf: false,
    exportExcel: false,
    leaveManagement: true,
    fullRecap: false,
    aiAnalytics: false,
    multiSchool: false,
    prioritySupport: false,
    pricePerMonth: 0,
    priceString: 'Gratis (Rp 0)',
    description: 'Cocok untuk pengujian awal sistem presensi digital instansi, sekolah, atau kampus selama 2 minggu penuh.',
    badgeColor: 'bg-slate-500 text-white border-slate-600',
  },
  full: {
    name: 'Paket Full (Infaq Seikhlasnya)',
    plan: 'full',
    durationString: '1 Tahun Ajaran / Penuh',
    durationDays: 365,
    maxUsers: 999999,
    maxUsersString: 'Tak Terbatas (Unlimited)',
    gpsSelfie: true,
    scanQr: true,
    whatsappNotif: true,
    exportPdf: true,
    exportExcel: true,
    leaveManagement: true,
    fullRecap: true,
    aiAnalytics: true,
    multiSchool: true,
    prioritySupport: true,
    pricePerMonth: 0,
    priceString: 'Infaq Seikhlasnya',
    description: 'Nikmati seluruh fitur penuh tanpa batas personel dengan kontribusi infaq sukarela / seikhlasnya demi keberlanjutan aplikasi.',
    badgeColor: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-700 shadow-lg shadow-blue-500/30',
  },
  hibah: {
    name: 'Paket Hibah Khusus',
    plan: 'hibah',
    durationString: 'Selamanya (Unlimited)',
    durationDays: null,
    maxUsers: 999999,
    maxUsersString: 'Tak Terbatas (Unlimited)',
    gpsSelfie: true,
    scanQr: true,
    whatsappNotif: true,
    exportPdf: true,
    exportExcel: true,
    leaveManagement: true,
    fullRecap: true,
    aiAnalytics: true,
    multiSchool: true,
    prioritySupport: true,
    pricePerMonth: 0,
    priceString: 'Hibah Gratis 100%',
    description: 'Akses penuh gratis 100% yang disuntikkan langsung oleh Pengembang kepada instansi, sekolah, atau kampus terpilih.',
    badgeColor: 'bg-gradient-to-r from-amber-500 to-emerald-600 text-white border-amber-600',
  },
};

const INITIAL_LICENSE: SchoolLicense = {
  plan: 'trial',
  schoolName: 'SMA / SMP / Kampus Unggulan Nusantara',
  activatedAt: new Date().toISOString(),
  expiresAt: addDays(new Date(), 14).toISOString(),
  maxUsers: 10,
  licenseKey: 'ABDI-TRIAL-INIT-0000',
  activatedBy: 'System Auto',
  notes: 'Lisensi Trial otomatis saat inisialisasi awal (Berlaku 14 Hari / 2 Minggu Uji Coba).',
};

export const getLicense = (): SchoolLicense => {
  const stored = localStorage.getItem('abdi_school_license');
  if (!stored) {
    localStorage.setItem('abdi_school_license', JSON.stringify(INITIAL_LICENSE));
    return INITIAL_LICENSE;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return INITIAL_LICENSE;
  }
};

export const setLicense = (license: SchoolLicense): void => {
  localStorage.setItem('abdi_school_license', JSON.stringify(license));
  pushToFirebase('license', license);
  window.dispatchEvent(new Event('license_updated'));
};

export const generateLicenseKey = (plan: LicensePlan): string => {
  const prefix = plan.toUpperCase().slice(0, 4);
  const rand1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const rand2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ABDI-${prefix}-${rand1}-${rand2}`;
};

export const activateNewLicense = (
  plan: LicensePlan,
  schoolName: string,
  activatedBy: string,
  notes?: string
): SchoolLicense => {
  const config = PLAN_CONFIG[plan];
  const now = new Date();
  let expiresAt: string | null = null;
  
  if (config.durationDays !== null) {
    expiresAt = addDays(now, config.durationDays).toISOString();
  }

  const newLicense: SchoolLicense = {
    plan,
    schoolName,
    activatedAt: now.toISOString(),
    expiresAt,
    maxUsers: config.maxUsers,
    licenseKey: generateLicenseKey(plan),
    activatedBy,
    notes: notes || `Aktivasi paket ${config.name}`,
  };

  setLicense(newLicense);
  return newLicense;
};

export const isLicenseExpired = (license: SchoolLicense): boolean => {
  if (!license.expiresAt) return false; // selamanya
  return new Date(license.expiresAt) < new Date();
};

export const getDaysRemaining = (license: SchoolLicense): number | null => {
  if (!license.expiresAt) return null; // unlimited/lifetime
  const diff = differenceInDays(new Date(license.expiresAt), new Date());
  return Math.max(0, diff);
};

export const activateByToken = (
  token: string,
  schoolName: string,
  activatedBy: string
): { success: boolean; license?: SchoolLicense; message: string } => {
  const upper = token.trim().toUpperCase();
  if (!upper) {
    return { success: false, message: "Token aktivasi tidak boleh kosong!" };
  }
  if (upper.length < 5) {
    return { success: false, message: "Format token aktivasi terlalu pendek atau tidak valid!" };
  }

  let targetPlan: LicensePlan = "full"; // default fallback for new general token
  if (upper.includes("FULL") || upper.includes("INFAQ") || upper.includes("DONASI") || upper.includes("SEIKHLASNYA")) targetPlan = "full";
  else if (upper.includes("HIBAH") || upper.includes("FREE") || upper.includes("VIP")) targetPlan = "hibah";
  else if (upper.includes("TRIAL")) targetPlan = "trial";

  const config = PLAN_CONFIG[targetPlan];
  const now = new Date();
  let expiresAt: string | null = null;
  if (config.durationDays !== null) {
    expiresAt = addDays(now, config.durationDays).toISOString();
  }

  const newLicense: SchoolLicense = {
    plan: targetPlan,
    schoolName,
    activatedAt: now.toISOString(),
    expiresAt,
    maxUsers: config.maxUsers,
    licenseKey: upper,
    activatedBy,
    notes: `Diaktifkan via token aktivasi resmi (${config.name})`,
  };

  setLicense(newLicense);
  return { success: true, license: newLicense, message: `Selamat! ${config.name} berhasil diaktifkan dengan token ${upper}.` };
};

