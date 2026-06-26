import React, { useState } from "react";
import { db } from "../../lib/db";
import toast from "react-hot-toast";
import { Save, Terminal, ShieldAlert, Zap, Database } from "lucide-react";

export function DeveloperConsole() {
  const school = db.getSchool();
  const [formData, setFormData] = useState({
    whatsappApiKey: school.whatsappApiKey || "",
    gasWebAppUrl: school.gasWebAppUrl || "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updatedSchool = {
        ...school,
        ...formData,
      };
      db.setSchool(updatedSchool);
      toast.success("Sistem Berhasil Diperbarui!");
    } catch (error) {
      toast.error("Gagal menyimpan konfigurasi.");
    } finally {
      setIsSaving(false);
    }
  };

  const clearCache = () => {
    if (confirm("WARNING: Ini akan menghapus seluruh data lokal dan memaksa sistem mengambil data baru dari Firebase. Lanjutkan?")) {
      localStorage.clear();
      window.location.href = "/";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
            <Terminal className="text-indigo-600" />
            Developer Console
          </h2>
          <p className="text-gray-500 mt-1 text-sm font-medium">
            Pengaturan API dan Konfigurasi Inti Sistem.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
        
        <div className="flex items-center gap-3 mb-6 border-b border-slate-700/50 pb-4">
          <ShieldAlert className="text-rose-500" size={24} />
          <h3 className="font-bold text-white text-lg">Konfigurasi API Notifikasi</h3>
        </div>

        <form onSubmit={handleSave} className="space-y-5 relative z-10">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
              WhatsApp Token (Fonnte API)
            </label>
            <input
              type="text"
              value={formData.whatsappApiKey}
              onChange={(e) =>
                setFormData({ ...formData, whatsappApiKey: e.target.value })
              }
              className="w-full px-4 py-3 border border-slate-700 rounded-xl text-sm font-mono text-green-400 bg-slate-950 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-700"
              placeholder="Masukkan Token Fonnte..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
              URL Web App Google Apps Script (Email)
            </label>
            <input
              type="text"
              value={formData.gasWebAppUrl}
              onChange={(e) =>
                setFormData({ ...formData, gasWebAppUrl: e.target.value })
              }
              className="w-full px-4 py-3 border border-slate-700 rounded-xl text-sm font-mono text-green-400 bg-slate-950 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-700"
              placeholder="https://script.google.com/macros/s/.../exec"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] disabled:opacity-70"
            >
              <Save size={18} />
              {isSaving ? "Menyimpan..." : "Simpan Konfigurasi"}
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-rose-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4 text-rose-600">
            <Zap size={20} />
            <h3 className="font-bold">Aksi Berbahaya (Danger Zone)</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Bersihkan seluruh memory cache (IndexedDB/Local Storage) dan paksa aplikasi untuk menarik ulang seluruh data dari Firebase.
          </p>
          <button
            onClick={clearCache}
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 font-bold rounded-lg hover:bg-rose-100 transition-all text-sm"
          >
            <Database size={16} /> Purge Local Cache
          </button>
        </div>
      </div>

    </div>
  );
}
