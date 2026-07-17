import { dbRealtime } from "./firebase";
import { ref, set, onValue } from "firebase/database";
import { db } from "./db";
import { idbStorage } from "./idbStorage";

let isSyncing = false;
let syncTimer: any = null;
let unsubscribeDb: (() => void) | null = null;
let onlineListener: (() => void) | null = null;

export interface OfflineSyncItem {
  id: string;
  path: string;
  data: any;
  timestamp: number;
  retryCount?: number;
}

const OFFLINE_QUEUE_KEY = 'offline_sync_queue';

export function getOfflineQueue(): OfflineSyncItem[] {
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

export function getOfflineQueueCount(): number {
  return getOfflineQueue().length;
}

function saveOfflineQueue(queue: OfflineSyncItem[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new Event('offline_sync_queue_changed'));
  } catch (e) {
    console.error("Failed to save offline sync queue:", e);
  }
}

export function enqueueOfflineSync(path: string, data: any) {
  const queue = getOfflineQueue();
  // If item with exact same path already exists, update its payload so queue stays compact
  const existingIndex = queue.findIndex(item => item.path === path);
  if (existingIndex !== -1) {
    queue[existingIndex].data = data;
    queue[existingIndex].timestamp = Date.now();
  } else {
    queue.push({
      id: `${path}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      path,
      data,
      timestamp: Date.now(),
      retryCount: 0
    });
  }
  saveOfflineQueue(queue);
  console.log(`[Offline-Online Sync] Data untuk '${path}' disimpan di antrean offline lokal.`);
}

export async function processOfflineQueue(): Promise<{ synced: number; pending: number }> {
  if (!navigator.onLine) {
    return { synced: 0, pending: getOfflineQueueCount() };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    // Check if there are any locally stored attendance records waiting that aren't in queue
    const attendance = db.getAttendance();
    const hasUnsynced = attendance.some(a => !a.isSynced || !(a as any).is_synced);
    if (hasUnsynced && navigator.onLine) {
      try {
        const aMap = attendance.reduce((acc, att) => {
          const syncedAtt = { ...att, isSynced: true, is_synced: true, syncStatus: 'synced', syncError: undefined };
          acc[att.id] = syncedAtt;
          return acc;
        }, {} as Record<string, any>);
        await set(ref(dbRealtime, 'attendance'), aMap);
        const updatedAttendance = attendance.map(a => ({
          ...a,
          isSynced: true,
          is_synced: true,
          syncStatus: 'synced',
          syncError: undefined
        }));
        localStorage.setItem('attendance', JSON.stringify(updatedAttendance));
        window.dispatchEvent(new Event('attendance_synchronized'));
        window.dispatchEvent(new Event('firebase_sync_updated'));
      } catch (e) {
        console.warn("[Offline-Online Sync] Background attendance push check failed:", e);
      }
    }
    return { synced: 0, pending: 0 };
  }

  console.log(`[Offline-Online Sync] Memproses ${queue.length} antrean data ke Cloud...`);
  let syncedCount = 0;
  const remainingQueue: OfflineSyncItem[] = [];

  for (const item of queue) {
    try {
      await set(ref(dbRealtime, item.path), item.data);
      syncedCount++;
      console.log(`[Offline-Online Sync] Sukses menyinkronkan: ${item.path}`);

      // If we just synced attendance, update local attendance records to isSynced = true
      if (item.path === 'attendance') {
        const attendance = db.getAttendance();
        const updatedAttendance = attendance.map(a => ({
          ...a,
          isSynced: true,
          is_synced: true,
          syncStatus: 'synced',
          syncError: undefined
        }));
        localStorage.setItem('attendance', JSON.stringify(updatedAttendance));
        window.dispatchEvent(new Event('attendance_synchronized'));
      }
    } catch (error: any) {
      console.warn(`[Offline-Online Sync] Gagal sinkronisasi antrean ${item.path}:`, error);
      const retryCount = (item.retryCount || 0) + 1;
      const errMsg = error?.message || String(error || '');
      const errCode = error?.code || '';
      
      // Mencegah antrean macet permanen (Poison Pill):
      // Jika path root '/', atau error PERMISSION_DENIED / payload terlalu besar, atau gagal >= 5 kali
      if (item.path === '/' || errCode.includes('PERMISSION_DENIED') || errMsg.includes('Permission denied') || errMsg.includes('Data is too large') || retryCount >= 5) {
        console.error(`[Offline-Online Sync] Menghapus item antrean macet/permanen ('${item.path}') setelah ${retryCount} percobaan gagal atau kendala izin Firebase.`, error);
      } else {
        remainingQueue.push({ ...item, retryCount });
      }
    }
  }

  saveOfflineQueue(remainingQueue);
  if (syncedCount > 0) {
    window.dispatchEvent(new Event('firebase_sync_updated'));
  }
  return { synced: syncedCount, pending: remainingQueue.length };
}

// Helper to push data dynamically (Full Online + Offline Fallback)
export const pushToFirebase = async (path: string, data: any): Promise<boolean> => {
  // If navigator is offline right now, enqueue directly without waiting for network timeout
  if (!navigator.onLine) {
    console.warn(`[Offline-Online Sync] Offline terdeteksi. Menyimpan '${path}' ke antrean offline...`);
    enqueueOfflineSync(path, data);
    return false;
  }

  try {
    await set(ref(dbRealtime, path), data);
    // If successfully synced attendance right now, make sure local state reflects that
    if (path === 'attendance' && data) {
      const attendance = db.getAttendance();
      let modified = false;
      const updatedAttendance = attendance.map(a => {
        if (!a.isSynced || !(a as any).is_synced) {
          modified = true;
          return { ...a, isSynced: true, is_synced: true, syncStatus: 'synced', syncError: undefined };
        }
        return a;
      });
      if (modified) {
        localStorage.setItem('attendance', JSON.stringify(updatedAttendance));
        window.dispatchEvent(new Event('attendance_synchronized'));
      }
    }
    return true;
  } catch (error) {
    console.warn(`[Offline-Online Sync] Gagal kirim '${path}' ke Firebase Cloud karena koneksi/error. Masuk ke antrean offline...`, error);
    enqueueOfflineSync(path, data);
    return false;
  }
};

export function cleanupFirebaseSync() {
  if (unsubscribeDb) {
    unsubscribeDb();
    unsubscribeDb = null;
  }
  if (onlineListener) {
    window.removeEventListener('online', onlineListener);
    onlineListener = null;
  }
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  isSyncing = false;
}

export function initializeFirebaseSync(): () => void {
  if (isSyncing) return cleanupFirebaseSync;
  isSyncing = true;

  const dbRef = ref(dbRealtime, '/');

  // Listen for changes from Firebase Realtime Database (Full Online Mode)
  unsubscribeDb = onValue(dbRef, (snapshot) => {
    if (!snapshot.exists()) {
      // If Firebase is completely empty, seed it with initial seed/local data
      const seedData = {
        users: db.getUsers(),
        school: db.getSchool(),
        opds: db.getOPDs(),
        satuan_kerjas: db.getSatuanKerjas(),
        jabatans: db.getJabatans(),
        academicYears: db.getAcademicYears(),
        holidays: db.getHolidays(),
        class_schedules: db.getSchedules(),
        attendance: db.getAttendance()
      };
      set(dbRef, seedData).catch((err) => {
        console.warn("[Offline-Online Sync] Gagal menulis seed data ke root '/', mencoba menyinkronkan per kategori utama...", err);
        if (seedData.school) enqueueOfflineSync('school', seedData.school);
        if (seedData.users) enqueueOfflineSync('users', seedData.users);
      });
      return;
    }

    if (snapshot.exists()) {
      const data = snapshot.val();
      
      // Check if we have unpushed offline queue items. If so, don't overwrite local pending work with older cloud state right now!
      const pendingQueue = getOfflineQueue();
      if (pendingQueue.length > 0) {
        console.log(`[Offline-Online Sync] Terdapat ${pendingQueue.length} data di antrean lokal belum ter-upload. Menunda timpa data dari Cloud...`);
        processOfflineQueue();
        return;
      }

      if (data.school) {
        localStorage.setItem('school', JSON.stringify(data.school));
        idbStorage.setItem('master_school', 'school', data.school);
        // Sinkronisasi kioskBgUrl dan marqueeText dari Firebase ke localStorage agar LiveQRView.tsx selalu reaktif
        if (data.school.kioskBgUrl && data.school.kioskBgUrl.trim() !== "") {
          localStorage.setItem('qr_kiosk_bg_url', data.school.kioskBgUrl);
        } else {
          localStorage.removeItem('qr_kiosk_bg_url');
        }
        if (data.school.marqueeText !== undefined && data.school.marqueeText !== null && data.school.marqueeText.trim() !== "") {
          localStorage.setItem('qr_marquee_text', data.school.marqueeText);
        } else {
          localStorage.removeItem('qr_marquee_text');
        }
        // Selalu dispatch firebase_sync_updated & school_updated event setelah sync agar komponen langsung merespons perubahan / reset default
        window.dispatchEvent(new Event('firebase_sync_updated'));
        window.dispatchEvent(new Event('school_updated'));
      }
      
      const normalizeArray = (obj: any) => {
        if (!obj) return [];
        const list = Array.isArray(obj) ? obj : Object.values(obj);
        return list.filter((item: any) => item !== null && item !== undefined && typeof item === 'object');
      };

      if (data.users) {
        const normUsers = normalizeArray(data.users);
        const currentLocalUsers = db.getUsers();
        // Gabungkan (merge) data cloud dengan password lokal yang tersimpan agar password tidak hilang/terhapus
        const mergedUsers = normUsers.map((cloudUser: any) => {
          const localMatch = currentLocalUsers.find(u => u.id === cloudUser.id || u.username === cloudUser.username);
          return {
            ...cloudUser,
            password: cloudUser.password || localMatch?.password || (cloudUser.username === 'alpha_project' ? 'garut001' : cloudUser.username === 'admin' ? 'admin' : '')
          };
        });
        localStorage.setItem('users', JSON.stringify(mergedUsers));
        idbStorage.setItem('master_users', 'users', mergedUsers);
      }
      if (data.attendance) {
        const normAtt = normalizeArray(data.attendance);
        localStorage.setItem('attendance', JSON.stringify(normAtt));
        idbStorage.setItem('attendance_logs', 'attendance', normAtt);
      }
      if (data.opds) localStorage.setItem('opds', JSON.stringify(normalizeArray(data.opds)));
      if (data.satuan_kerjas) localStorage.setItem('satuan_kerjas', JSON.stringify(normalizeArray(data.satuan_kerjas)));
      if (data.jabatans) localStorage.setItem('jabatans', JSON.stringify(normalizeArray(data.jabatans)));
      if (data.cuti_requests) localStorage.setItem('cuti_requests', JSON.stringify(normalizeArray(data.cuti_requests)));
      if (data.kinerja_records) localStorage.setItem('kinerja_records', JSON.stringify(normalizeArray(data.kinerja_records)));
      if (data.academicYears) localStorage.setItem('academicYears', JSON.stringify(normalizeArray(data.academicYears)));
      if (data.holidays) localStorage.setItem('holidays', JSON.stringify(normalizeArray(data.holidays)));
      if (data.class_schedules) localStorage.setItem('class_schedules', JSON.stringify(normalizeArray(data.class_schedules)));
      
      window.dispatchEvent(new Event('firebase_sync_updated'));
    }
  });

  // Setup automatic background sync listeners for offline->online recovery
  onlineListener = () => {
    console.log('[Offline-Online Sync] Koneksi internet pulih. Memulai sinkronisasi otomatis...');
    processOfflineQueue();
  };
  window.addEventListener('online', onlineListener);

  // Periodic background check every 15 seconds when online
  if (!syncTimer) {
    syncTimer = setInterval(() => {
      if (navigator.onLine && getOfflineQueueCount() > 0) {
        processOfflineQueue();
      }
    }, 15000);
  }

  return cleanupFirebaseSync;
}
