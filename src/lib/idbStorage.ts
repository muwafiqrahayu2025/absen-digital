import { encryptData, decryptData } from './localCrypto';

const DB_NAME = 'ABDI_ABSEN_DIGITAL_DB';
const DB_VERSION = 1;

export interface IDBStoreNames {
  master_users: 'users';
  master_school: 'school';
  attendance_logs: string;
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
        
        if (!db.objectStoreNames.contains('master_users')) {
          db.createObjectStore('master_users');
        }
        if (!db.objectStoreNames.contains('master_school')) {
          db.createObjectStore('master_school');
        }
        if (!db.objectStoreNames.contains('attendance_logs')) {
          db.createObjectStore('attendance_logs');
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
   * Sinkronisasi awal saat boot agar localStorage tersinkron dengan IndexedDB Terenkripsi
   */
  async hydrateLocalStorage(): Promise<void> {
    try {
      const users = await this.getItem('master_users', 'users');
      if (users && Array.isArray(users)) {
        const cleanUsers = users.filter((u: any) => u !== null && u !== undefined && typeof u === 'object');
        if (cleanUsers.length > 0) localStorage.setItem('users', JSON.stringify(cleanUsers));
      }
      const school = await this.getItem('master_school', 'school');
      if (school && typeof school === 'object') {
        localStorage.setItem('school', JSON.stringify(school));
      }
      const attendance = await this.getItem('attendance_logs', 'attendance');
      if (attendance && Array.isArray(attendance)) {
        const cleanAtt = attendance.filter((a: any) => a !== null && a !== undefined && typeof a === 'object');
        localStorage.setItem('attendance', JSON.stringify(cleanAtt));
      }
    } catch (err) {
      console.error('Error hydrating local storage from IDB:', err);
    }
  }
}

export const idbStorage = new IDBStorage();
