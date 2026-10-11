import React, { useState } from "react";
import { Monitor, Save, Sparkles, Check } from "lucide-react";
import toast from "react-hot-toast";
import { db } from "../../lib/db";

export function KioskConfigSection() {
  const school: any = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
  const [kioskBgInput, setKioskBgInput] = useState<string>(() => {
    return localStorage.getItem("qr_kiosk_bg_url") || school.kioskBgUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80";
  });
  const [isSavingKioskBg, setIsSavingKioskBg] = useState(false);

  const handleSaveKioskBg = (url: string) => {
    setIsSavingKioskBg(true);
    try {
      localStorage.setItem("qr_kiosk_bg_url", url);
      const updatedSchool = { ...school, kioskBgUrl: url };
      db.setSchool(updatedSchool);
      window.dispatchEvent(new Event("storage"));
      toast.success("✨ Latar belakang Kiosk berhasil diperbarui & disinkronisasikan!");
      setKioskBgInput(url);
    } catch (err) {
      toast.error("Gagal menyimpan latar belakang Kiosk.");
    } finally {
      setIsSavingKioskBg(false);
    }
  };

  const handleUploadKioskBgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1280;
          const MAX_HEIGHT = 720;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.75);
          handleSaveKioskBg(compressedDataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6 animate-fade-in max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-black uppercase tracking-wider mb-2">
            <Sparkles size={14} /> Aesthetics &amp; Kiosk Customization
          </div>
          <h3 className="text-xl font-extrabold text-slate-800">
            Konfigurasi Latar Belakang (Background) Live TV Kiosk
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Sesuaikan tampilan layar Kiosk (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-purple-600">/live-qr</code>) dari warna gelap menjadi cerah dan estetis dengan efek blur (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-purple-600">backdrop-filter: blur</code>). Pilih dari preset modern di bawah ini atau gunakan foto kustom Anda.
          </p>
        </div>
      </div>

      {/* Preset Wallpapers */}
      <div className="space-y-3">
        <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
          ✨ Pilih Preset Wallpaper Modern (Cerah &amp; Estetis):
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              name: "Aurora Pastel Glow",
              url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80",
            },
            {
              name: "Glass Architecture",
              url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1920&q=80",
            },
            {
              name: "Sunrise Horizon",
              url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80",
            },
            {
              name: "Tech Blue Luminous",
              url: "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1920&q=80",
            },
          ].map((preset, idx) => (
            <div
              key={idx}
              onClick={() => handleSaveKioskBg(preset.url)}
              className={`relative rounded-2xl overflow-hidden border-2 cursor-pointer group transition-all transform hover:scale-105 ${
                kioskBgInput === preset.url ? "border-purple-600 shadow-lg ring-2 ring-purple-300" : "border-slate-200"
              }`}
            >
              <img src={preset.url} alt={preset.name} className="w-full h-24 object-cover group-hover:opacity-90" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent flex items-end p-2.5">
                <span className="text-[11px] font-bold text-white tracking-tight drop-shadow truncate">{preset.name}</span>
              </div>
              {kioskBgInput === preset.url && (
                <div className="absolute top-2 right-2 bg-purple-600 text-white rounded-full p-1 shadow">
                  <Check size={12} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Custom URL & Upload Box */}
      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
        <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
          🔗 Atau Masukkan URL Gambar Latar Belakang / Unggah dari Komputer:
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={kioskBgInput}
            onChange={(e) => setKioskBgInput(e.target.value)}
            placeholder="https://contoh.com/wallpaper-kiosk.jpg"
            className="flex-1 px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
          />
          <button
            onClick={() => handleSaveKioskBg(kioskBgInput)}
            disabled={isSavingKioskBg || !kioskBgInput}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 text-xs shrink-0 cursor-pointer disabled:opacity-60"
          >
            <Save size={16} />
            {isSavingKioskBg ? "Menyimpan..." : "Simpan URL"}
          </button>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-purple-50 border border-purple-200 text-purple-700 font-bold text-xs rounded-xl shadow-xs transition-all">
            <Monitor size={15} />
            <span>Unggah Foto Kustom (.JPG / .PNG)</span>
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleUploadKioskBgFile}
              className="hidden"
            />
          </label>
          <button
            onClick={() => handleSaveKioskBg("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80")}
            className="text-xs text-slate-500 hover:text-slate-700 underline font-medium cursor-pointer"
          >
            Reset ke Default Cerah
          </button>
        </div>
      </div>

      {/* Live Preview Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-44 flex items-center justify-center shadow-inner">
        <img src={kioskBgInput} alt="Preview Background" className="absolute inset-0 w-full h-full object-cover filter blur-md scale-105" />
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl" />
        <div className="relative z-10 text-center p-4">
          <span className="px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
            🎯 KIOSK LIVE PREVIEW (BLUR EFFECT)
          </span>
          <h4 className="text-white font-black text-lg sm:text-xl mt-2 drop-shadow-md uppercase">
            {school.name || "Nama Instansi Belum Diatur"}
          </h4>
          <p className="text-xs text-slate-200 font-medium mt-0.5 drop-shadow">
            Tampilan Kiosk Anda kini lebih cerah, elegan, modern, dan sangat nyaman dipindai!
          </p>
        </div>
      </div>
    </div>
  );
}
