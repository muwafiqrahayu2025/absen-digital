import { dbRealtime } from "./firebase";
import { ref, set, onValue, get } from "firebase/database";
import { db } from "./db";

let isSyncing = false;

export function initializeFirebaseSync() {
  if (isSyncing) return;
  isSyncing = true;

  const dbRef = ref(dbRealtime, '/');

  // Listen for changes from Firebase
  onValue(dbRef, (snapshot) => {
    if (!snapshot.exists()) {
      // If Firebase is completely empty, let's seed it with our LocalStorage / Initial Mock Data
      // so the user doesn't lose their current data
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
      set(dbRef, seedData);
      return;
    }

    if (snapshot.exists()) {
      const data = snapshot.val();
      
      if (data.school) localStorage.setItem('school', JSON.stringify(data.school));
      
      // For arrays, Firebase might return objects if keys are used, or arrays.
      // We normalize them.
      const normalizeArray = (obj: any) => {
        if (!obj) return [];
        if (Array.isArray(obj)) return obj;
        return Object.values(obj);
      };

      if (data.users) localStorage.setItem('users', JSON.stringify(normalizeArray(data.users)));
      if (data.attendance) localStorage.setItem('attendance', JSON.stringify(normalizeArray(data.attendance)));
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
}

// Helper to push data
export const pushToFirebase = async (path: string, data: any) => {
  try {
    await set(ref(dbRealtime, path), data);
  } catch (error) {
    console.error(`Failed to sync ${path} to Firebase:`, error);
  }
};
