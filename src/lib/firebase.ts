import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBLCQuQrw5OA4rKLq-4cm6u2lSgpniuPTA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "abdi-absendigital.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://abdi-absendigital-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "abdi-absendigital",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "abdi-absendigital.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "930702422848",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:930702422848:web:905abc037172936260c0a5",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-EPWJELBHEY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const dbRealtime = getDatabase(app);
export const storage = getStorage(app);

// Initialize Analytics if supported
export let analytics: any = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

// ─── HELPER MULTI-TENANT ───────────────────────────────────────────
import { ref, DatabaseReference } from "firebase/database";

export function getTenantPath(path: string = ''): string {
  // Biarkan path global tidak tersentuh
  if (path.startsWith('user_tenant_mapping') || path.startsWith('global_')) {
    return path;
  }
  
  const tenantId = localStorage.getItem("abdi_active_tenant_id");
  
  // Jika tidak ada tenantId (belum login) atau merupakan Super Admin GLOBAL,
  // idealnya mereka tidak boleh menulis ke root (kecuali admin).
  if (!tenantId || tenantId === 'GLOBAL') {
    return path; 
  }
  
  // Jika path sudah memiliki format tenants/xxx, jangan double prefix
  if (path.startsWith('tenants/')) {
    return path;
  }

  return path ? `tenants/${tenantId}/${path}` : `tenants/${tenantId}`;
}

/**
 * Pengganti ref(dbRealtime, path) yang secara otomatis akan menambahkan 
 * prefix tenants/$tenantId/ ke dalam path.
 */
export function getTenantRef(path: string = ''): DatabaseReference {
  return ref(dbRealtime, getTenantPath(path));
}
