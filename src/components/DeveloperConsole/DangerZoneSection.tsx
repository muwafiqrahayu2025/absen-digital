import React, { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

export function DangerZoneSection() {
  const [isClearing, setIsClearing] = useState(false);

  const clearCache = async () => {
    if (!window.confirm("PERINGATAN KRITIKAL: Tindakan ini akan MENGHAPUS SELURUH CACHE browser, data lokal (localStorage, sessionStorage), dan konfigurasi PWA (IndexedDB) di perangkat ini. Pengguna mungkin harus login ulang. Apakah Anda yakin?")) {
      return;
    }

    setIsClearing(true);
    const toastId = toast.loading("Menghancurkan Cache & Local Data...");
    try {
      localStorage.clear();
      sessionStorage.clear();
      
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        if (db.name) window.indexedDB.deleteDatabase(db.name);
      }
      
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
        }
      }
      
      toast.success("SELURUH CACHE BERHASIL DIHANCURKAN! Memuat ulang sistem dalam 3 detik...", { id: toastId, duration: 3000 });
      setTimeout(() => window.location.reload(), 3000);
    } catch (err: any) {
      toast.error(`Gagal menghapus cache: ${err.message}`, { id: toastId });
      setIsClearing(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-rose-200 shadow-sm animate-fade-in relative overflow-hidden max-w-4xl">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-red-600" />
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-black uppercase tracking-widest mb-3 border border-rose-200 shadow-inner">
            <AlertTriangle size={14} /> Zona Bahaya (Super Admin Only)
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 mb-1">
            Force Clear Cache &amp; Local Storage (Hard Reset)
          </h3>
          <p className="text-xs font-medium text-slate-500 leading-relaxed max-w-2xl">
            Tindakan ini bersifat destruktif! Akan menghapus seluruh rekaman cache lokal (LocalStorage, SessionStorage, IndexedDB), <em>unregister</em> Service Worker, dan memaksa <em>refresh</em> paksa (Hard Reload) pada mesin klien ini. Gunakan hanya jika aplikasi mengalami <em>stuck state</em> atau <em>glitch</em> parah yang tidak bisa diselesaikan dengan <em>refresh</em> biasa.
          </p>
        </div>
        <button
          onClick={clearCache}
          disabled={isClearing}
          className="flex items-center gap-2 px-6 py-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition-all shadow-xl shadow-rose-600/20 cursor-pointer disabled:opacity-50 hover:scale-105 shrink-0 uppercase tracking-widest"
        >
          <Trash2 size={18} />
          {isClearing ? "MENGHANCURKAN..." : "NUKE CACHE SEKARANG"}
        </button>
      </div>
      <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <p className="text-[11px] text-slate-400 font-mono">
          <strong className="text-slate-600 font-bold uppercase mr-2">Catatan Teknis:</strong> 
          Script akan menjalankan `localStorage.clear()`, `indexedDB.deleteDatabase()`, dan `caches.delete()` sebelum `location.reload()`.
        </p>
      </div>
    </div>
  );
}
