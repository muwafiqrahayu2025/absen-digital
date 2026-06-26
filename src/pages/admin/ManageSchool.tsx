import React, { useState } from "react";
import { db } from "../../lib/db";
import { School } from "../../types";
import { MapPin, ShieldAlert, Navigation, Settings, Save, RefreshCw, X, Image as ImageIcon, Upload, Trash2, School as SchoolIcon, Send } from 'lucide-react';
import toast from "react-hot-toast";
import { format } from "date-fns";
import { useAuth } from "../../components/AuthContext";
import { NotificationService } from "../../lib/notifications";
import { dbRealtime } from "../../lib/firebase";
import { ref, set } from "firebase/database";
export function ManageSchool() {
  const { user } = useAuth();
  const [school, setSchool] = useState<School>(db.getSchool());
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(school);
  const [confirmClean, setConfirmClean] = useState(false);
  const [confirmFactory, setConfirmFactory] = useState(false);

  const [bgCustomData, setBgCustomData] = useState<string>(() => {
    return localStorage.getItem("login_bg_custom_data") || "";
  });

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          
          const MAX_WIDTH = 3840;
          const MAX_HEIGHT = 2160;
          
          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            const widthRatio = MAX_WIDTH / width;
            const heightRatio = MAX_HEIGHT / height;
            const ratio = Math.min(widthRatio, heightRatio);
            width = width * ratio;
            height = height * ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          
          const base64 = canvas.toDataURL("image/jpeg", 0.85);
          
          if (base64.length * 0.75 > 4.5 * 1024 * 1024) {
             toast.error("Maaf, ukuran gambar terlalu besar untuk penyimpanan browser.");
             return;
          }
          
          setBgCustomData(base64);
          localStorage.setItem("login_bg_custom_data", base64);
          toast.success("Latar belakang login berhasil diterapkan!");
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteCustomBg = () => {
    setBgCustomData("");
    localStorage.removeItem("login_bg_custom_data");
    toast.success("Latar belakang login berhasil dikembalikan ke default.");
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    db.setSchool(formData);
    setSchool(formData);
    setIsEditing(false);
    toast.success(
      "Konfigurasi madrasah/sekolah berhasil disimpan!",
    );
    window.dispatchEvent(new Event("attendance_synchronized"));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#111c2d] to-[#1d74f2] p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
              <MapPin className="text-yellow-400" size={22} />
              Profil & Lokasi Madrasah
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Nama, alamat, logo, koordinat pusat, dan radius aman untuk
              presensi Guru & Staf Madrasah.
            </p>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white border border-white/20 rounded-xl text-xs font-bold transition"
            >
              Ubah Konfigurasi Madrasah
            </button>
          )}
        </div>

        <div className="p-6">
          {isEditing ? (
            <form
              onSubmit={handleSave}
              className="space-y-4 text-xs font-sans text-left"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Nama Madrasah / Sekolah
                  </label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Alamat Madrasah / Sekolah Lengkap
                  </label>
                  <input
                    required
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Logo Madrasah / Sekolah
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement("canvas");
                            const MAX_WIDTH = 400;
                            const MAX_HEIGHT = 400;
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
                            setFormData({ ...formData, logoUrl: canvas.toDataURL("image/jpeg", 0.8) });
                          };
                          img.src = event.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, logoUrl: undefined })}
                      className="text-[10px] text-rose-600 hover:underline mt-1 block font-bold"
                    >
                      Hapus Logo Sekolah
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Navigation size={12} className="text-indigo-600" />
                    Bujur Lintang (Latitude)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.latitude ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        latitude: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-3.5 py-2 border border-slate-250 bg-white rounded-xl text-sm"
                    placeholder="-6.350397"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Navigation size={12} className="text-indigo-600" />
                    Garis Bujur (Longitude)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.longitude ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        longitude: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-3.5 py-2 border border-slate-250 bg-white rounded-xl text-sm"
                    placeholder="106.8064598"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-emerald-600 font-extrabold flex items-center gap-1">
                    🎯 Radius Aman Geofence (Meter)
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.radius ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        radius: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3.5 py-2 border border-slate-250 bg-white rounded-xl text-sm text-emerald-700 font-bold"
                    placeholder="120"
                    min={15}
                    max={5000}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Telepon Layanan
                  </label>
                  <input
                    required
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Notifikasi Surat Elektronik
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.adminEmail || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, adminEmail: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Nama Kepala Madrasah / Sekolah
                  </label>
                  <input
                    required
                    value={formData.principalName || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, principalName: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    NIP / PegID Kepala Madrasah
                  </label>
                  <input
                    required
                    value={formData.principalNip || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, principalNip: e.target.value })
                    }
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Batas Waktu Absen Masuk Pagi (Cutoff Alpha)
                </label>
                <input
                  type="time"
                  required
                  value={formData.operationalCheckInLimit || "08:00"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      operationalCheckInLimit: e.target.value,
                    })
                  }
                />
              </div>



              <div className="flex gap-3 pt-4 justify-end">
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                >
                  <Save className="w-4 h-4" /> Simpan Konfigurasi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData(school);
                  }}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                ><X size={16} /> Batal</button>
              </div>
            </form>
          ) : (
            <div className="space-y-6 text-left">
              <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr] gap-4 items-center">
                {/* Logo display card */}
                <div className="p-2 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center h-[90px] w-full shrink-0">
                  <img
                    src={school.logoUrl || "/logo.png"}
                    alt="Logo Sekolah"
                    className="max-h-full max-w-full object-contain rounded-xl drop-shadow-sm"
                  />
                </div>
                
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-sans h-full flex flex-col justify-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Nama Madrasah / Sekolah
                  </p>
                  <p className="font-extrabold text-slate-800 text-sm leading-snug">
                    {school.name}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-sans h-full flex flex-col justify-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Alamat Gedung
                  </p>
                  <p className="font-bold text-slate-600 text-xs leading-relaxed">
                    {school.address}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-sans">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Nomor Kontak
                  </p>
                  <p className="font-bold text-slate-700 text-xs">
                    {school.phone}
                  </p>
                </div>
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-sans">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Email Layanan Log
                  </p>
                  <p className="font-bold text-slate-700 text-xs">
                    {school.adminEmail || "—"}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-sans md:col-span-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Kepala Madrasah
                  </p>
                  <p className="font-extrabold text-slate-800 text-sm leading-snug">
                    {school.principalName || "—"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    NIP / PegID: {school.principalNip || "—"}
                  </p>
                </div>
              </div>

              {/* GEOFENCE RADAR SIMULATOR CARD */}
              <div className="border border-slate-150 rounded-3xl p-5 bg-gradient-to-r from-slate-50 to-slate-100 flex flex-col md:flex-row gap-5 items-center justify-between">
                <div className="space-y-2 max-w-sm">
                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase">
                    🎯 Geofence GPS Active
                  </span>
                  <h4 className="font-black text-slate-800 text-sm">
                    Pemetaan Radius Lokasi Madrasah / Sekolah
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                    Titik pusat berada pada koordinat GPS: <br />
                    <span className="font-mono font-bold text-indigo-600 block mt-1">
                      {school.latitude}, {school.longitude}
                    </span>
                  </p>
                  <p className="text-[11px] text-orange-600 font-semibold flex items-center gap-1.5 font-sans">
                    <ShieldAlert size={14} className="shrink-0" />
                    Absen di luar radius {school.radius}m akan otomatis gugur
                    dan ditolak.
                  </p>
                </div>

                {/* VISUAL radar mock circles */}
                <div className="relative w-44 h-44 bg-white/80 rounded-full border-2 border-slate-200 flex items-center justify-center shadow-inner overflow-hidden shrink-0">
                  <div className="absolute inset-0 bg-grid-slate-100 opacity-20 pointer-events-none" />

                  {/* Outer Limit Ring */}
                  <div className="w-36 h-36 border border-dashed border-rose-300 rounded-full flex items-center justify-center animate-ping absolute opacity-10" />
                  <div className="w-28 h-28 border border-emerald-300 bg-emerald-50/15 rounded-full flex items-center justify-center relative">
                    <div className="w-14 h-14 border border-indigo-200 bg-indigo-50/20 rounded-full flex items-center justify-center">
                      <div className="w-4 h-4 bg-[#1d74f2] text-white rounded-full flex items-center justify-center p-0.5 border border-white animate-pulse">
                        <Navigation size={6} className="rotate-45" />
                      </div>
                    </div>
                  </div>

                  <span className="absolute bottom-2 font-mono font-bold text-[9px] text-slate-400 bg-slate-100 px-2 rounded-full border">
                    R = {school.radius}m
                  </span>
                </div>
              </div>


            </div>
          )}
        </div>
      </div>

      {/* SECTION: LOGIN BACKGROUND CUSTOMIZER */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden text-left mt-6">
        <div className="bg-purple-50/50 p-6 border-b border-slate-100 flex items-center gap-3">
          <ImageIcon className="text-[#7928CA] shrink-0" size={24} />
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm">
              Kustomisasi Latar Belakang Portal Login
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Ganti gambar latar belakang halaman login publik dengan foto sekolah kustom Anda.
            </p>
          </div>
        </div>

        <div className="p-6 flex flex-col md:flex-row gap-6 items-center">
          {/* Preview Container */}
          <div className="w-full md:w-48 h-32 rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center relative shadow-inner">
            {bgCustomData ? (
              <img
                src={bgCustomData}
                alt="Latar Belakang Login"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-slate-400 text-[10px] font-bold">
                <ImageIcon size={20} />
                <span>Latar Default Aktif</span>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4">
            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
              Unggah file gambar baru (direkomendasikan berukuran lanskap/16:9 seperti 1920x1080) untuk dijadikan latar belakang. Sistem akan secara otomatis mengoptimalkan ukuran berkas gambar Anda agar dapat disimpan di memori lokal peramban.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() => document.getElementById("bg-upload-input")?.click()}
                className="flex items-center justify-center gap-2 py-2 px-5 font-bold text-white text-xs rounded-xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:-translate-y-[1px] active:translate-y-[1px] transition-all duration-200 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Pilih Gambar Baru
              </button>
              <input
                type="file"
                id="bg-upload-input"
                accept="image/*"
                className="hidden"
                onChange={handleBgUpload}
              />

              {bgCustomData && (
                <button
                  type="button"
                  onClick={handleDeleteCustomBg}
                  className="flex items-center justify-center gap-2 py-2 px-5 font-bold text-white text-xs rounded-xl bg-gradient-to-b from-[#ff4d4d] to-[#cc0000] border border-[#ff9999] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(204,0,0,0.4)] hover:from-[#ff6666] hover:to-[#e60000] hover:-translate-y-[1px] active:translate-y-[1px] transition-all duration-200 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus & Reset Latar Belakang
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: SYSTEM LOGS & EMAIL HISTORY */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden text-left mt-6">
        <div className="bg-indigo-50/30 p-6 border-b border-slate-100 flex items-center gap-3">
          <Settings className="text-indigo-650 shrink-0" size={24} />
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm">
              Log Transmisi Sistem & Riwayat Email
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Pantau jalannya modul otomatis kepegawaian, simulasi SMTP email server, dan aktivitas sinkronisasi transaksional.
            </p>
          </div>
        </div>

        <div className="p-6">
          <div className="border border-slate-150 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 text-[9px] text-slate-450 uppercase tracking-widest grid grid-cols-12 gap-2 border-b border-slate-150 font-bold">
              <span className="col-span-3">Stempel Waktu</span>
              <span className="col-span-2">Kategori Log</span>
              <span className="col-span-2">Penerima</span>
              <span className="col-span-5">Deskripsi Pesan Log</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[250px] overflow-y-auto custom-scrollbar">
              {db.getSystemLogs().map((log: any) => (
                <div
                  key={log.id}
                  className="p-3.5 grid grid-cols-12 gap-2 items-start text-[11px] hover:bg-slate-50/30 transition font-sans"
                >
                  <div className="col-span-3 font-semibold text-slate-500 font-mono">
                    {(() => {
                      try {
                        return format(new Date(log.timestamp), "dd MMM yyyy, HH:mm:ss");
                      } catch (e) {
                        return log.timestamp || "—";
                      }
                    })()}
                  </div>
                  <div className="col-span-2">
                    <span className="inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {log.type === "email_alert" ? "Email Alert" : log.type}
                    </span>
                  </div>
                  <div className="col-span-2 font-mono font-bold text-slate-700 truncate">
                    {log.recipient}
                  </div>
                  <div className="col-span-5 text-slate-600 leading-relaxed font-medium">
                    {log.message}
                  </div>
                </div>
              ))}
              {db.getSystemLogs().length === 0 && (
                <div className="p-6 text-center text-slate-400">
                  Belum ada log sistem terekam. Log otomatis akan terisi saat batas absensi masuk terlewati dan ada guru yang tidak hadir (Alpha).
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: DATABASE & TRANSACTION UTILITIES */}
      <div className="bg-red-50/50 rounded-3xl border border-red-100 overflow-hidden text-left mt-6">
        <div className="p-6 border-b border-red-100 flex items-start gap-4">
          <ShieldAlert className="text-red-500 shrink-0 mt-1" size={24} />
          <div>
            <h3 className="text-sm font-bold text-red-800">
              Sistem Manajemen Database & Format Ulang
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Kelola status penyimpanan sistem, hapus semua riwayat transaksi untuk semester baru, atau format aplikasi.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
            Gunakan fungsi berikut untuk mengosongkan seluruh log transaksi di dalam aplikasi (Absensi, Pengajuan Cuti/Izin, dan Laporan Kinerja Harian). Tindakan ini akan membuat aplikasi bersih seperti baru tanpa menghapus akun Guru & Staf, sehingga dapat langsung digunakan untuk operasional madrasah yang baru secara steril.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            {!confirmClean ? (
              <button
                type="button"
                onClick={() => setConfirmClean(true)}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw size={14} />
                Format Bersih Data Transaksi (Presensi & Cuti)
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-100 p-1.5 rounded-xl border border-red-200">
                <span className="text-[11px] font-bold text-red-700 px-2">Hapus SELURUH Riwayat Transaksi?</span>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('attendance');
                    localStorage.removeItem('cuti_requests');
                    localStorage.removeItem('kinerja_records');
                    set(ref(dbRealtime, 'attendance'), null);
                    set(ref(dbRealtime, 'cuti_requests'), null);
                    set(ref(dbRealtime, 'kinerja_records'), null);
                    toast.success("Database berhasil dibersihkan seperti baru!");
                    window.dispatchEvent(new Event("attendance_synchronized"));
                    window.dispatchEvent(new Event("cuti_updated"));
                    window.dispatchEvent(new Event("kinerja_updated"));
                    setConfirmClean(false);
                    setTimeout(() => window.location.reload(), 800);
                  }}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Ya, Hapus
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClean(false)}
                  className="px-3 py-1.5 bg-white text-slate-600 rounded-lg text-xs font-bold border border-slate-200 cursor-pointer"
                >
                  Batal
                </button>
              </div>
            )}

            {!confirmFactory ? (
              <button
                type="button"
                onClick={() => setConfirmFactory(true)}
                className="px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Format Total (Setel Ulang Pabrik / Reset Storage)
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 p-1.5 rounded-xl border border-red-200">
                <span className="text-[11px] font-bold text-red-700 px-2">Setel Ulang ke Pabrik Asal? Semua akun akan hilang!</span>
                <button
                  type="button"
                  onClick={async () => {
                    localStorage.clear();
                    await set(ref(dbRealtime, '/'), null);
                    toast.success("Seluruh sistem berhasil disetel ulang ke setelan awal pabrik.");
                    setConfirmFactory(false);
                    setTimeout(() => window.location.reload(), 800);
                  }}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Ya, Reset Total
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmFactory(false)}
                  className="px-3 py-1.5 bg-white text-slate-600 rounded-lg text-xs font-bold border border-slate-200 cursor-pointer"
                >
                  Batal
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
