import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeFirebaseSync } from "./lib/firebaseSync";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { idbStorage } from "./lib/idbStorage";
import { registerSW } from "virtual:pwa-register";

// --- PWA AUTO-UPDATE SERVICE WORKER ---
// Memastikan cache lama langsung dibersihkan dan halaman dimuat ulang secara otomatis saat ada pembaruan build baru
try {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log("Versi baru aplikasi terdeteksi, memperbarui cache PWA...");
      updateSW(true);
    },
    onOfflineReady() {
      console.log("Aplikasi siap digunakan secara offline.");
    },
  });
} catch (e) {
  console.warn("Service Worker registration check failed:", e);
}

// --- BOOT-UP STORAGE SANITIZER (Zero Null/Corrupt Entries Guarantee) ---
// Membersihkan elemen null/undefined/rusak dari seluruh koleksi array di localStorage SEBELUM React dimuat
const ARRAY_STORAGE_KEYS = [
  'users',
  'opds',
  'satuan_kerjas',
  'jabatans',
  'cuti_requests',
  'kinerja_records',
  'academicYears',
  'holidays',
  'class_schedules',
  'attendance',
  'system_logs',
  'device_session_logs',
  'instansi_shift_schedules',
  'madrasah_shift_schedules'
];

ARRAY_STORAGE_KEYS.forEach((key) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) {
        const list = Array.isArray(parsed) ? parsed : Object.values(parsed);
        const cleaned = list.filter(
          (item: any) => item !== null && item !== undefined && typeof item === 'object'
        );
        if (cleaned.length !== list.length || !Array.isArray(parsed)) {
          localStorage.setItem(key, JSON.stringify(cleaned));
        }
      }
    }
  } catch (e) {
    // Ignore invalid JSON
  }
});

// Hydrate offline data from encrypted IndexedDB then sync with cloud
idbStorage.hydrateLocalStorage().finally(() => {
  initializeFirebaseSync();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
