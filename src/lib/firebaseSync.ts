import { dbRealtime, getTenantRef } from "./firebase";
import { ref, set } from "firebase/database";
import { db } from "./db";
import { idbStorage } from "./idbStorage";

let isSyncing = false;
let syncTimer: any = null;
let onlineListener: (() => void) | null = null;

export interface OfflineSyncItem {
  id: string;
  path: string;
  data: any;
  timestamp: number;
  retryCount?: number;
}

let memoryQueue: OfflineSyncItem[] = [];

// Initialize memory queue from IndexedDB on startup
idbStorage.getItem('offline_sync_queue', 'queue').then(data => {
  if (data && Array.isArray(data)) {
    memoryQueue = data;
    window.dispatchEvent(new Event('offline_sync_queue_changed'));
  }
});

export function getOfflineQueue(): OfflineSyncItem[] {
  return memoryQueue;
}

export function getOfflineQueueCount(): number {
  return memoryQueue.length;
}

function saveOfflineQueue(queue: OfflineSyncItem[]) {
  try {
    memoryQueue = queue;
    idbStorage.setItem('offline_sync_queue', 'queue', queue);
    window.dispatchEvent(new Event('offline_sync_queue_changed'));
  } catch (e) {
    console.error("Failed to save offline sync queue to IDB:", e);
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
    // [C2] Perbaikan Data Destruction & Stacking
    // Alih-alih melakukan set() ke root 'attendance', kita kirim record satu per satu.

    // ── [BUG-003 FIX] Definisikan `attendance` sebelum digunakan ─────────
    // Sebelumnya variabel ini tidak terdefinisi di scope ini, menyebabkan
    // ReferenceError: attendance is not defined saat runtime.
    const attendance = db.getAttendance();

    const unsyncedRecords = attendance.filter(a => !a.isSynced || !(a as any).is_synced);
    if (unsyncedRecords.length > 0 && navigator.onLine) {
      console.log(`[Offline-Online Sync] Menemukan ${unsyncedRecords.length} data absensi lokal belum tersinkron.`);
      let syncedCount = 0;
      const updatedAttendance = [...attendance];

      await Promise.allSettled(
        unsyncedRecords.map(async (att) => {
          try {
            const syncedAtt = { ...att, isSynced: true, is_synced: true, syncStatus: 'synced' as const, syncError: undefined };
            // KIRIM SECARA INDIVIDUAL ke node-nya masing-masing
            await set(getTenantRef(`attendance/${att.id}`), syncedAtt);
            
            // Tandai sukses di lokal
            const idx = updatedAttendance.findIndex(a => a.id === att.id);
            if (idx !== -1) {
              updatedAttendance[idx] = syncedAtt;
            }
            syncedCount++;
          } catch (e) {
            console.warn(`[Offline-Online Sync] Gagal sinkron absen ${att.id}:`, e);
          }
        })
      );

      if (syncedCount > 0) {
        db.setAttendance(updatedAttendance);
        window.dispatchEvent(new Event('firebase_sync_updated'));
      }
    }
    return { synced: 0, pending: 0 };
  }

  console.log(`[Offline-Online Sync] Memproses ${queue.length} antrean data ke Cloud...`);
  let syncedCount = 0;
  const remainingQueue: OfflineSyncItem[] = [];

  for (const item of queue) {
    try {
      await set(getTenantRef(item.path), item.data);
      syncedCount++;
      console.log(`[Offline-Online Sync] Sukses menyinkronkan: ${item.path}`);

      // If we just synced attendance, update local attendance records to isSynced = true
      if (item.path === 'attendance') {
        const attendance = db.getAttendance();
        const updatedAttendance = attendance.map(a => ({
          ...a,
          isSynced: true,
          is_synced: true,
          syncStatus: 'synced' as const,
          syncError: undefined
        }));
        db.setAttendance(updatedAttendance);
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
    await set(getTenantRef(path), data);
    // If successfully synced attendance right now, make sure local state reflects that
    if (path === 'attendance' && data) {
      const attendance = db.getAttendance();
      let modified = false;
      const updatedAttendance = attendance.map(a => {
        if (!a.isSynced || !(a as any).is_synced) {
          modified = true;
          return { ...a, isSynced: true, is_synced: true, syncStatus: 'synced' as const, syncError: undefined };
        }
        return a;
      });
      if (modified) {
        db.setAttendance(updatedAttendance);
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
