import { AttendanceRecord } from '../types';
import { processOfflineQueue } from './firebaseSync';
import { idbStorage } from './idbStorage';

const DB_VERSION_KEY = 'instansi_sekolah_db_version';
const CURRENT_DB_VERSION = 'v18_full_online';
if (localStorage.getItem(DB_VERSION_KEY) !== CURRENT_DB_VERSION) {
  const preservedKeys: Record<string, string | null> = {
    qr_kiosk_bg_url: localStorage.getItem('qr_kiosk_bg_url'),
    qr_embedded_logo_admin: localStorage.getItem('qr_embedded_logo_admin'),
    current_active_qr: localStorage.getItem('current_active_qr'),
    abdi_registration_token: localStorage.getItem('abdi_registration_token'),
    active_session_user: localStorage.getItem('active_session_user'),
    login_bg_custom_data: localStorage.getItem('login_bg_custom_data'),
  };
  localStorage.clear();
  localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);
  Object.entries(preservedKeys).forEach(([key, val]) => {
    if (val) localStorage.setItem(key, val);
  });
}

// In-memory cache for attendance to allow synchronous reads without localStorage limit
let memoryAttendance: AttendanceRecord[] = [];
// Initialize from IndexedDB
idbStorage.getItem('attendance_logs', 'attendance').then(data => {
  if (data && Array.isArray(data)) {
    memoryAttendance = data.filter((item: any) => item !== null && item !== undefined && typeof item === 'object');
    window.dispatchEvent(new Event('attendance_synchronized'));
  }
});

function parseArrayStorage<T = any>(key: string, initialData: T[] = []): T[] {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return initialData;
    const parsed = JSON.parse(stored);
    if (!parsed) return initialData;
    const list = Array.isArray(parsed) ? parsed : Object.values(parsed);
    const validList = list.filter((item: any) => item !== null && item !== undefined && typeof item === 'object');
    return validList.length > 0 ? (validList as T[]) : initialData;
  } catch (e) {
    return initialData;
  }
}

export const db = {
  // ─────────────────────────────────────────────────────────────
  // COMPATIBILITY LAYER (MIGRATION IN PROGRESS)
  // Master data kini dikelola secara reaktif via useFirebaseData(),
  // namun method ini dipertahankan agar komponen-komponen yang masih
  // memanggil db.getUsers(), db.getSchool(), db.getSchedules(), dll.
  // tetap berjalan stabil tanpa runtime error / crash.
  // ─────────────────────────────────────────────────────────────
  getUsers: (_includeSystemAccounts: boolean = false): any[] => parseArrayStorage<any>('users', []),
  setUsers: (users?: any[]) => { if (users) localStorage.setItem('users', JSON.stringify(users)); },
  updateUserPassword: (_id?: string, _newPassword?: string) => false,
  updateUser: (_id?: string, _data?: any) => false,
  getSchool: (): any => {
    try {
      const s = localStorage.getItem('school');
      return s ? JSON.parse(s) : {};
    } catch { return {}; }
  },
  setSchool: (school?: any) => { if (school) localStorage.setItem('school', JSON.stringify(school)); },
  updateSchool: (_school?: any) => ({}),
  getOPDs: (): any[] => parseArrayStorage<any>('opds', []),
  setOPDs: (_opds?: any[]) => {},
  getSatuanKerjas: (): any[] => parseArrayStorage<any>('satuan_kerjas', []),
  setSatuanKerjas: (_satuanKerjas?: any[]) => {},
  getJabatans: (): any[] => parseArrayStorage<any>('jabatans', []),
  setJabatans: (_jabatans?: any[]) => {},
  getCutiRequests: (): any[] => parseArrayStorage<any>('cuti_requests', []),
  setCutiRequests: (_cutis?: any[]) => {},
  getKinerjas: (): any[] => parseArrayStorage<any>('kinerjas', []),
  setKinerjas: (_kinerjas?: any[]) => {},
  getAcademicYears: (): any[] => parseArrayStorage<any>('academic_years', []),
  setAcademicYears: (_years?: any[]) => {},
  getHolidays: (): any[] => parseArrayStorage<any>('holidays', []),
  setHolidays: (_holidays?: any[]) => {},
  getSchedules: (): any[] => parseArrayStorage<any>('schedules', []),
  setSchedules: (schedules?: any[]) => { if (schedules) localStorage.setItem('schedules', JSON.stringify(schedules)); },
  deleteSchedule: (_id?: string) => {},
  getSettings: (): any => ({}),
  setSettings: (_settings?: any) => {},
  updateSettings: (_settings?: any) => ({}),
  getGlobalSettings: (): any => ({}),
  getTenants: (): any[] => parseArrayStorage<any>('tenants', []),
  setTenants: (_tenants?: any[]) => {},

  // ==========================================
  // OFFLINE ATTENDANCE & LOGS (KEPT INTACT)
  // ==========================================
  getAttendance: (): AttendanceRecord[] => { return memoryAttendance; },
  setAttendance: (a: AttendanceRecord[]) => {
    const formatted = a.filter(rec => rec && typeof rec === 'object').map(rec => ({
      ...rec,
      is_synced: rec.isSynced !== undefined ? rec.isSynced : false,
      updated_at: (rec as any).updated_at || new Date().toISOString()
    }));
    memoryAttendance = formatted as AttendanceRecord[];
    // ONLY save to IndexedDB to avoid 5MB localStorage limit QuotaExceededError
    idbStorage.setItem('attendance_logs', 'attendance', formatted);
  },

  getSystemLogs: (): any[] => { return parseArrayStorage<any>('system_logs', []); },
  addSystemLog: (log: { type: string; title: string; message: string; recipient: string }) => {
    const logs = db.getSystemLogs();
    const newLog = {
      id: String(Date.now() + Math.random()),
      timestamp: new Date().toISOString(),
      ...log
    };
    localStorage.setItem('system_logs', JSON.stringify([newLog, ...logs].slice(0, 100)));
    window.dispatchEvent(new Event('system_logs_updated'));
  },

  getDeviceSessionLogs: (): any[] => {
    const logs = parseArrayStorage<any>('device_session_logs', []);
    if (logs.length === 0) {
      const initLog = [
        {
          id: 'devlog-init-1',
          timestamp: new Date().toISOString(),
          userId: 'alpha_project',
          userName: 'Alpha Project Dev',
          userRole: 'developer',
          action: 'LOGIN',
          ipAddress: '127.0.0.1 (Local Verified)',
          device: {
            os: 'Windows 11',
            browser: 'Google Chrome 138',
            category: 'Desktop',
            screenResolution: '1920x1080',
            rawUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
          },
          details: 'Sesi developer login dan inisialisasi modul keamanan',
          status: 'SUCCESS'
        }
      ];
      localStorage.setItem('device_session_logs', JSON.stringify(initLog));
      return initLog;
    }
    return logs;
  },
  addDeviceSessionLog: (log: any) => {
    const logs = db.getDeviceSessionLogs();
    const updated = [log, ...logs].slice(0, 500);
    localStorage.setItem('device_session_logs', JSON.stringify(updated));
    window.dispatchEvent(new Event('device_session_logs_updated'));
  }
};

export const getSyncSimulationMode = (): 'healthy' | 'unstable' | 'offline' =>
  (localStorage.getItem('sync_sim_mode') as any) || 'healthy';

export const setSyncSimulationMode = (mode: 'healthy' | 'unstable' | 'offline') =>
  localStorage.setItem('sync_sim_mode', mode);

export const syncOfflineAttendance = async (): Promise<number> => {
  const simMode = getSyncSimulationMode();

  if (simMode === 'offline' || !navigator.onLine) {
    throw new Error('Koneksi internet terputus. Data tersimpan dengan aman di perangkat lokal dan akan otomatis diunggah saat internet terhubung kembali.');
  }

  const attendance = db.getAttendance();
  const unsynced = attendance.filter(a => !a.isSynced || (a as any).is_synced === false || a.syncStatus === 'failed' || a.syncStatus === 'pending');
  if (unsynced.length === 0) {
    const queueRes = await processOfflineQueue();
    if (queueRes.pending > 0 && queueRes.synced === 0) {
      throw new Error(`Gagal mengunggah ${queueRes.pending} data antrean ke server Cloud. Periksa stabilitas koneksi atau izin Firebase Anda.`);
    }
    return queueRes.synced;
  }

  const processing = attendance.map(a => {
    if (!a.isSynced || !(a as any).is_synced || a.syncStatus === 'failed' || a.syncStatus === 'pending') {
      return { ...a, syncStatus: 'syncing' as const };
    }
    return a;
  });
  db.setAttendance(processing);
  window.dispatchEvent(new Event('attendance_synchronized'));

  const queueRes = await processOfflineQueue();
  if (queueRes.pending > 0 && queueRes.synced === 0) {
    throw new Error(`Sebagian atau seluruh data (${queueRes.pending} antrean) gagal disinkronkan karena gangguan jaringan Cloud. Sistem akan terus mencoba di latar belakang.`);
  }

  return queueRes.synced;
};