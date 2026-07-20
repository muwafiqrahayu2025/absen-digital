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
  // STUBBED MASTER DATA FUNCTIONS
  // These have been deprecated in favor of useFirebaseData (Full Online Migration)
  // They return empty structures to satisfy TypeScript during refactoring.
  getUsers: (includeSystemAccounts: boolean = false): any[] => { console.warn('db.getUsers is deprecated. Use useFirebaseData.'); return []; },
  setUsers: (users: any[]) => { console.warn('db.setUsers is deprecated.'); },
  updateUserPassword: () => false,
  updateUser: () => false,
  getSchool: (): any => { console.warn('db.getSchool is deprecated.'); return {}; },
  setSchool: () => {},
  updateSchool: () => ({}),
  getOPDs: (): any[] => [],
  setOPDs: () => {},
  getSatuanKerjas: (): any[] => [],
  setSatuanKerjas: () => {},
  getJabatans: (): any[] => [],
  setJabatans: () => {},
  getCutiRequests: (): any[] => [],
  setCutiRequests: () => {},
  getKinerjas: (): any[] => [],
  setKinerjas: () => {},
  getAcademicYears: (): any[] => [],
  setAcademicYears: () => {},
  getHolidays: (): any[] => [],
  setHolidays: () => {},
  getSchedules: (): any[] => [],
  saveSchedule: () => {},
  deleteSchedule: () => {},

  // ==========================================
  // OFFLINE ATTENDANCE & LOGS (KEPT INTACT)
  // ==========================================
  getAttendance: (): AttendanceRecord[] => { return parseArrayStorage<AttendanceRecord>('attendance', []); },
  setAttendance: (a: AttendanceRecord[]) => {
    const formatted = a.filter(rec => rec && typeof rec === 'object').map(rec => ({
      ...rec,
      is_synced: rec.isSynced !== undefined ? rec.isSynced : false,
      updated_at: (rec as any).updated_at || new Date().toISOString()
    }));
    localStorage.setItem('attendance', JSON.stringify(formatted));
    idbStorage.setItem('attendance_logs', 'attendance', formatted);
    // Note: To sync to Firebase, you should now call enqueueOfflineSync from the component,
    // or we can import pushToFirebase. For now, since we only want to write locally here
    // and rely on offline queue for syncing, we don't automatically pushToFirebase here.
    // Actually, LiveQRView/ScanQR handles the network push or enqueues it.
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
  localStorage.setItem('attendance', JSON.stringify(processing));
  window.dispatchEvent(new Event('attendance_synchronized'));

  const queueRes = await processOfflineQueue();
  if (queueRes.pending > 0 && queueRes.synced === 0) {
    throw new Error(`Sebagian atau seluruh data (${queueRes.pending} antrean) gagal disinkronkan karena gangguan jaringan Cloud. Sistem akan terus mencoba di latar belakang.`);
  }

  return queueRes.synced;
};