import { encryptData, decryptData } from './localCrypto';

const DB_NAME = 'ABDI_ABSEN_DIGITAL_DB';
const DB_VERSION = 1;

export interface IDBStoreNames {
  attendance_logs: string;
  offline_sync_queue: string;
  device_config: 'reg_token' | 'last_sync';
}

/**
 * Native IndexedDB Wrapper Zero-Dependency
 */
class IDBStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('IndexedDB error:', event);
        reject('Failed to open IndexedDB');
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('attendance_logs')) {
          db.createObjectStore('attendance_logs');
        }
        if (!db.objectStoreNames.contains('offline_sync_queue')) {
          db.createObjectStore('offline_sync_queue');
        }
        if (!db.objectStoreNames.contains('device_config')) {
          db.createObjectStore('device_config');
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Cek apakah perangkat masih Clean Slate (belum teregistrasi)
   */
  async isCleanSlate(): Promise<boolean> {
    try {
      const token = await this.getItem('device_config', 'reg_token');
      const regLocal = localStorage.getItem('abdi_registration_token');
      return !token && !regLocal;
    } catch (e) {
      return !localStorage.getItem('abdi_registration_token');
    }
  }

  /**
   * Simpan item terenkripsi ke store IndexedDB
   */
  async setItem(storeName: string, key: string, data: any): Promise<void> {
    try {
      const db = await this.getDB();
      const encrypted = encryptData(data);
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(encrypted, key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error(`Error saving to IDB store ${storeName}:`, err);
    }
  }

  /**
   * Ambil dan dekripsi item dari store IndexedDB
   */
  async getItem<T = any>(storeName: string, key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => {
          const encrypted = request.result;
          if (!encrypted) return resolve(null);
          const decrypted = decryptData<T>(encrypted);
          resolve(decrypted);
        };
        request.onerror = () => resolve(null);
      });
    } catch (err) {
      console.error(`Error reading from IDB store ${storeName}:`, err);
      return null;
    }
  }

  /**
   * Hapus item dari store
   */
  async removeItem(storeName: string, key: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error(`Error removing from IDB store ${storeName}:`, err);
    }
  }

  /**
   * Hapus seluruh data pada satu objectStore tertentu
   */
  async clearStore(storeName: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error(`Error clearing IDB store ${storeName}:`, err);
    }
  }

  /**
   * Hapus seluruh data IndexedDB dan kembalikan ke kondisi kosong seperti baru
   */
  async clearAll(): Promise<void> {
    try {
      if (this.dbPromise) {
        try {
          const db = await this.dbPromise;
          db.close();
        } catch { /* ignore */ }
        this.dbPromise = null;
      }
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    } catch (err) {
      console.error('Error deleting IDB database:', err);
    }
  }

  /**
   * (Deprecated) Removed hydration to localStorage to prevent QuotaExceededError
   */
  async hydrateLocalStorage(): Promise<void> {
    // No-op
  }
}

export const idbStorage = new IDBStorage();
