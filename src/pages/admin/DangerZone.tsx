import React from "react";
import { useNavigate } from "react-router-dom";
import { idbStorage } from "../../lib/idbStorage";
import { Database, Zap } from "lucide-react";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

export function DangerZone() {
  useDocumentTitle("Danger Zone");
  const navigate = useNavigate();

  const clearCache = async () => {
    if (confirm("WARNING: Ini akan menghapus seluruh data lokal dan memaksa sistem mengambil data baru dari Firebase. Lanjutkan?")) {
      localStorage.clear();
      sessionStorage.clear();
      try {
        await idbStorage.clearAll();
      } catch { /* ignore */ }
      try {
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
      } catch { /* ignore */ }
      navigate("/", { replace: true });
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-4xl">
      <div className="bg-white border border-rose-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center gap-3 mb-2 text-rose-600">
            <Database size={22} />
            <h3 className="font-black text-lg">Purge Local Memory Cache</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Bersihkan seluruh memori cache lokal (IndexedDB &amp; Local Storage) di browser klien ini dan paksa aplikasi mengambil data baru dari Firebase.
          </p>
        </div>
        <button
          onClick={clearCache}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-700 border border-rose-200 font-extrabold rounded-xl hover:bg-rose-100 transition-all text-xs cursor-pointer self-start"
        >
          <Zap size={16} /> Purge Local Cache
        </button>
      </div>
    </div>
  );
}
