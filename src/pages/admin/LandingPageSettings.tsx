import React, { useState, useEffect } from "react";
import { PenTool, ToggleLeft, ToggleRight, LayoutTemplate, Save, Settings, Trash2, Plus, Monitor } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useEditMode } from "../../components/EditModeContext";
import { DeveloperSettingsModal } from "../../components/DeveloperSettingsModal";
import { db } from "../../lib/firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

export function LandingPageSettings() {
  useDocumentTitle("Pengaturan Landing Page");
  const navigate = useNavigate();
  const { isEditMode, toggleEditMode, saveEdits } = useEditMode();
  const [showDevSettings, setShowDevSettings] = useState(false);

  const [quickLinks, setQuickLinks] = useState<{ title: string; url: string }[]>([]);
  const [isSavingLinks, setIsSavingLinks] = useState(false);

  const [demoVideoUrl, setDemoVideoUrl] = useState("");
  const [isSavingDisplay, setIsSavingDisplay] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_config', 'landing_page'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.quickLinks) {
          // Ensure it's an array to prevent .map crashes during render
          setQuickLinks(Array.isArray(data.quickLinks) ? data.quickLinks : Object.values(data.quickLinks));
        }
        if (data.demoVideoUrl !== undefined) setDemoVideoUrl(data.demoVideoUrl || "");
      }
    }, (error) => {
      console.error("LandingPageSettings Firestore Error:", error);
    });
    return () => unsub();
  }, []);

  const formatYouTubeUrl = (url: string): string => {
    if (!url) return "";
    const regex = /(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
    return url;
  };

  const handleSaveDisplayConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDisplay(true);
    try {
      const formattedUrl = formatYouTubeUrl(demoVideoUrl);
      setDemoVideoUrl(formattedUrl);
      await setDoc(doc(db, 'system_config', 'landing_page'), { demoVideoUrl: formattedUrl }, { merge: true });
      toast.success("Konfigurasi Tampilan Berhasil Diperbarui!");
    } catch {
      toast.error("Gagal menyimpan konfigurasi tampilan.");
    } finally {
      setIsSavingDisplay(false);
    }
  };

  const handleSaveQuickLinks = async () => {
    setIsSavingLinks(true);
    try {
      await setDoc(doc(db, 'system_config', 'landing_page'), { quickLinks }, { merge: true });
      toast.success("Tautan interaktif berhasil disimpan!");
    } catch (error: any) {
      toast.error("Gagal menyimpan tautan: " + error.message);
    } finally {
      setIsSavingLinks(false);
    }
  };

  const addQuickLink = () => {
    setQuickLinks([...quickLinks, { title: "", url: "" }]);
  };

  const removeQuickLink = (index: number) => {
    setQuickLinks(quickLinks.filter((_, i) => i !== index));
  };

  const updateQuickLink = (index: number, field: 'title' | 'url', value: string) => {
    const newLinks = [...quickLinks];
    newLinks[index][field] = value;
    setQuickLinks(newLinks);
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <LayoutTemplate className="text-indigo-600" size={28} />
            Pengaturan Landing Page
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Kontrol tampilan dan mode edit visual untuk Landing Page.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Mode Edit Visual</h3>
              <p className="text-sm text-slate-500 mt-1">
                Aktifkan mode edit untuk mengubah teks dan elemen UI secara langsung di aplikasi (Live Edit).
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <button
                onClick={toggleEditMode}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all border cursor-pointer ${
                  isEditMode
                    ? "bg-indigo-600 text-white border-indigo-700 shadow-lg shadow-indigo-200"
                    : "bg-white text-slate-700 hover:bg-slate-100 border-slate-200 shadow-sm"
                }`}
              >
                {isEditMode ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                <span>{isEditMode ? "Mode Edit: ON" : "Mode Edit: OFF"}</span>
              </button>

              {isEditMode && (
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={saveEdits}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition border border-emerald-700 shadow-lg shadow-emerald-200 cursor-pointer"
                  >
                    <Save size={18} /> Simpan Perubahan
                  </button>
                  <button
                    onClick={() => setShowDevSettings(true)}
                    className="flex items-center justify-center w-12 h-12 rounded-xl bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200 shadow-sm transition cursor-pointer shrink-0"
                    title="Pengaturan Tema & Logo"
                  >
                    <Settings size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5 flex flex-col justify-center">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Edit Live Konten</h3>
            <p className="text-sm text-slate-500 mt-1">
              Buka Landing Page dalam mode edit khusus developer untuk mengubah konten utama.
            </p>
          </div>
          <div className="mt-4">
            <button
              onClick={() => {
                localStorage.setItem('abdi_dev_mode_landing', 'true');
                navigate('/');
                toast.success("🚀 Mode Developer Landing Page Aktif!");
              }}
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <PenTool size={20} /> Edit Live Konten Landing Page Sekarang
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
        <div>
          <h3 className="font-bold text-slate-800 text-lg">Dynamic Quick Links</h3>
          <p className="text-sm text-slate-500 mt-1">
            Tambahkan tautan cepat yang akan ditampilkan di halaman publik (Landing Page).
          </p>
        </div>
        
        <div className="space-y-3">
          {Array.isArray(quickLinks) && quickLinks.map((link, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <input
                type="text"
                placeholder="Judul Tautan"
                value={link.title}
                onChange={(e) => updateQuickLink(idx, 'title', e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <input
                type="url"
                placeholder="URL (https://...)"
                value={link.url}
                onChange={(e) => updateQuickLink(idx, 'url', e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={() => removeQuickLink(idx)}
                className="shrink-0 p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                title="Hapus Tautan"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}

          {(!Array.isArray(quickLinks) || quickLinks.length === 0) && (
            <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
              Belum ada tautan.
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={addQuickLink}
            className="w-full sm:w-auto px-4 py-2 flex items-center justify-center gap-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl font-bold text-sm transition cursor-pointer"
          >
            <Plus size={16} /> Tambah Tautan
          </button>
          
          <button
            onClick={handleSaveQuickLinks}
            disabled={isSavingLinks}
            className="w-full sm:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            {isSavingLinks ? "Menyimpan..." : "Simpan Tautan"}
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
          <Monitor className="text-blue-400" size={24} />
          <div>
            <h3 className="font-bold text-white text-lg">Konfigurasi Tampilan (Landing Page)</h3>
            <p className="text-xs text-slate-400">Pengaturan video demo dan elemen visual Landing Page.</p>
          </div>
        </div>

        <form onSubmit={handleSaveDisplayConfig} className="space-y-5 relative z-10">
          <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 space-y-2">
            <label className="block text-xs font-black text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
              URL Video Demo YouTube (Landing Page)
            </label>
            <input
              type="text"
              value={demoVideoUrl}
              onChange={(e) => setDemoVideoUrl(e.target.value)}
              className="w-full px-4 py-3 border border-blue-500/50 rounded-xl text-sm font-mono text-blue-200 bg-slate-950 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600"
              placeholder="Contoh: https://www.youtube.com/watch?v=..."
            />
            <p className="text-[11px] text-blue-300 leading-relaxed">
              💡 URL YouTube untuk ditampilkan di Landing Page publik. Biarkan kosong untuk menyembunyikan video.
            </p>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSavingDisplay}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 disabled:opacity-70 cursor-pointer"
            >
              <Save size={18} />
              {isSavingDisplay ? "Menyimpan..." : "Simpan Konfigurasi Tampilan"}
            </button>
          </div>
        </form>
      </div>

      {showDevSettings && (
        <DeveloperSettingsModal onClose={() => setShowDevSettings(false)} />
      )}
    </div>
  );
}
