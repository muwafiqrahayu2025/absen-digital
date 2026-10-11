import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { db } from "../../lib/db";
import { School } from "../../types";
import { MapPin, ShieldAlert, Navigation, Settings, Save, RefreshCw, X, Image as ImageIcon, Upload, Trash2, School as SchoolIcon, Send, Building, Printer, Eye, FileText, CheckCircle, Tv, Clock } from 'lucide-react';
import toast from "react-hot-toast";
import { format } from "date-fns";
import { useAuth } from "../../components/AuthContext";
import { NotificationService } from "../../lib/notifications";
import { dbRealtime, getTenantRef } from "../../lib/firebase";
import { ref, set, remove } from "firebase/database";
import { useFirebaseData } from "../../hooks/useFirebaseData";
import { idbStorage } from "../../lib/idbStorage";

export function ManageSchool() {
  const { user } = useAuth();
  const { data: schoolData, isOffline, loading } = useFirebaseData('school');
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tab = searchParams.get('tab') || 'profile';


  const [school, setSchool] = useState<School>(() => ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 }));
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>(() => ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 }));
  const [confirmClean, setConfirmClean] = useState(false);
  const [confirmFactory, setConfirmFactory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isEditingKop, setIsEditingKop] = useState(false);
  const [isSavingKop, setIsSavingKop] = useState(false);
  const [kopData, setKopData] = useState(() => {
    const current: any = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 });
    return current.kopSurat || {
      nama_dinas: current.nama_dinas || 'Nama Yayasan/Dinas Belum Diatur',
      nama_instansi: current.nama_instansi || current.name || 'SMA / SMP / KAMPUS UNGGULAN NUSANTARA',
      alamat: current.alamat || current.address || 'Jl. Pendidikan Nasional No. 1, Kota / Kabupaten, Provinsi Jawa Barat',
      telepon: current.telepon || current.phone || '021-88997766',
      email: current.email || current.adminEmail || 'admin@sekolah-kampus.id',
      website: current.website || 'https://sekolah-kampus.id',
      kode_pos: current.kode_pos || '44151',
      logo_url: current.logo_url || current.logoUrl || '',
    };
  });

  React.useEffect(() => {
    if (schoolData) {
       setSchool(schoolData as School);
       setFormData((prev: any) => isEditing ? prev : schoolData);
       setKopData((prev: any) => isEditingKop ? prev : (schoolData.kopSurat || {
          nama_dinas: schoolData.nama_dinas || 'Nama Yayasan/Dinas Belum Diatur',
          nama_instansi: schoolData.nama_instansi || schoolData.name || 'SMA / SMP / KAMPUS UNGGULAN NUSANTARA',
          alamat: schoolData.alamat || schoolData.address || 'Jl. Pendidikan Nasional No. 1, Kota / Kabupaten, Provinsi Jawa Barat',
          telepon: schoolData.telepon || schoolData.phone || '021-88997766',
          email: schoolData.email || schoolData.adminEmail || 'admin@sekolah-kampus.id',
          website: schoolData.website || 'https://sekolah-kampus.id',
          kode_pos: schoolData.kode_pos || '44151',
          logo_url: schoolData.logo_url || schoolData.logoUrl || '',
       }));
    }
  }, [schoolData, isEditing, isEditingKop]);

  const handleLogoKopUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Ukuran file terlalu besar! Maksimal sebelum kompresi adalah 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 600;
          const MAX_HEIGHT = 600;
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

          const base64 = canvas.toDataURL("image/jpeg", 0.85);
          setKopData({ ...kopData, logo_url: base64 });
          toast.success("Logo instansi berhasil diunggah dan dikompresi otomatis!");
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveKop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) { toast.error("Koneksi terputus. Tidak bisa menyimpan saat offline."); return; }
    setIsSavingKop(true);
    try {
      const currentSchool = school;
      const updatedSchool: any = {
        ...currentSchool,
        name: kopData.nama_instansi || currentSchool.name,
        address: kopData.alamat || currentSchool.address,
        phone: kopData.telepon || currentSchool.phone,
        adminEmail: kopData.email || currentSchool.adminEmail,
        logoUrl: kopData.logo_url || currentSchool.logoUrl,
        logo_url: kopData.logo_url,
        nama_dinas: kopData.nama_dinas,
        nama_instansi: kopData.nama_instansi,
        telepon: kopData.telepon,
        email: kopData.email,
        website: kopData.website,
        kode_pos: kopData.kode_pos,
        kopSurat: {
          ...kopData
        }
      };
      await set(getTenantRef('school'), updatedSchool);
      setIsEditingKop(false);
      toast.success("Data Kop Surat Resmi berhasil disimpan dan diterapkan pada cetak PDF/rekapitulasi!");
    } finally {
      setIsSavingKop(false);
    }
  };

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

  const [kioskBgData, setKioskBgData] = useState<string>(() => {
    const saved = localStorage.getItem("qr_kiosk_bg_url");
    const schoolData: any = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 });
    return saved || schoolData.kioskBgUrl || "";
  });

  const handleKioskBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          const MAX_WIDTH = 1920;
          const MAX_HEIGHT = 1080;

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

          setKioskBgData(base64);
          localStorage.setItem("qr_kiosk_bg_url", base64);
          if (!isOffline) {
             const currentSchool = school;
             const updated = { ...currentSchool, kioskBgUrl: base64 };
             set(getTenantRef('school'), updated);
          }
          window.dispatchEvent(new Event("storage"));
          toast.success("Latar belakang Live TV Kiosk berhasil diunggah & diterapkan secara real-time!");
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteKioskBg = async () => {
    setKioskBgData("");
    localStorage.removeItem("qr_kiosk_bg_url");
    if (!isOffline) {
       const currentSchool = school;
       const updated = { ...currentSchool, kioskBgUrl: "" };
       await set(getTenantRef('school'), updated);
    }
    window.dispatchEvent(new Event("storage"));
    toast.success("Latar belakang Live TV Kiosk berhasil dikembalikan ke default.");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) { toast.error("Koneksi terputus. Tidak bisa menyimpan saat offline."); return; }
    setIsSaving(true);
    try {
      await set(getTenantRef('school'), formData);
      setIsEditing(false);
      toast.success(
        "Konfigurasi instansi/sekolah/kampus berhasil disimpan!",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

      {isOffline && (
        <div className="bg-amber-100 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center gap-3">
          <div className="shrink-0">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-sm">Mode Luring (Offline) Aktif</p>
            <p className="text-xs mt-0.5">Koneksi terputus. Pengaturan sekolah membutuhkan koneksi internet aktif. Form CRUD telah dikunci.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-8 text-slate-400 font-medium">Memuat data...</div>
      ) : (
      <>
      {tab === 'profile' && (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#111c2d] to-[#1d74f2] p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
              <MapPin className="text-yellow-400" size={22} />
              Profil & Lokasi Instansi / Sekolah / Kampus
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Nama, alamat, logo, koordinat pusat, and radius aman untuk
              presensi Pegawai / Guru / Dosen.
            </p>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center justify-center gap-2 py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
            >
              Ubah Konfigurasi Instansi
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
                    Nama Instansi / Sekolah / Kampus
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
                    Alamat Instansi / Sekolah / Kampus
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
                    Logo Instansi / Sekolah / Kampus
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
                    Nama Kepala Sekolah / Rektor / Direktur
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
                    NIP / ID Pimpinan / Kepala Sekolah
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                <div>
                  <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1 flex items-center gap-1.5">
                    <Clock size={12} />
                    Batas Waktu Absen Masuk Pagi (Cutoff Alpha)
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.operationalCheckInLimit || "07:30"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        operationalCheckInLimit: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 border border-indigo-200 bg-white rounded-xl text-sm text-indigo-900 font-bold"
                  />
                  <p className="text-[9px] text-indigo-500 mt-1">Lewat jam ini sistem menandai terlambat / alpha otomatis.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-rose-700 uppercase mb-1 flex items-center gap-1.5">
                    <Clock size={12} />
                    Batas Waktu Absen Pulang (Checkout)
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.operationalCheckOutLimit || "15:30"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        operationalCheckOutLimit: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 border border-rose-200 bg-white rounded-xl text-sm text-rose-900 font-bold"
                  />
                  <p className="text-[9px] text-rose-500 mt-1">Jam yang berlaku untuk memulai sesi absen pulang.</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4 justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" /> {isSaving ? "Menyimpan..." : "Simpan Konfigurasi"}
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
                    Nama Instansi / Sekolah / Kampus
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
                    Kepala Sekolah / Rektor / Direktur
                  </p>
                  <p className="font-extrabold text-slate-800 text-sm leading-snug">
                    {school.principalName || "—"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    NIP / ID Pimpinan: {school.principalNip || "—"}
                  </p>
                </div>

                {/* TAMPILAN READ-ONLY JAM MASUK DAN JAM PULANG */}
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 font-sans md:col-span-3 flex justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-indigo-500 uppercase mb-1 flex items-center gap-1"><Clock size={12} /> Batas Absen Masuk Pagi</p>
                    <p className="font-black text-indigo-900 text-lg font-mono">
                      {school.operationalCheckInLimit || "07:30"} <span className="text-[10px] font-bold text-indigo-500 font-sans uppercase">WIB</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-rose-500 uppercase mb-1 flex items-center justify-end gap-1"><Clock size={12} /> Batas Absen Pulang</p>
                    <p className="font-black text-rose-900 text-lg font-mono">
                      {(school as any).operationalCheckOutLimit || "15:30"} <span className="text-[10px] font-bold text-rose-500 font-sans uppercase">WIB</span>
                    </p>
                  </div>
                </div>

              </div>

              {/* GEOFENCE RADAR SIMULATOR CARD */}
              <div className="border border-slate-150 rounded-3xl p-5 bg-gradient-to-r from-slate-50 to-slate-100 flex flex-col md:flex-row gap-5 items-center justify-between">
                <div className="space-y-2 max-w-sm">
                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase">
                    🎯 Geofence GPS Active
                  </span>
                  <h4 className="font-black text-slate-800 text-sm">
                    Pemetaan Radius Lokasi Instansi / Sekolah / Kampus
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
      )}

      {/* SECTION: PENGATURAN DATA KOP SURAT RESMI INSTANSI & LIVE PREVIEW */}
      {tab === 'kop-surat' && (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden text-left mt-6">
        <div className="bg-gradient-to-r from-[#1e293b] to-[#334155] p-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
              <Building className="text-emerald-400" size={22} />
              Input & Pengaturan Data Kop Surat Instansi
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Data kop resmi yang otomatis terpasang pada cetak laporan PDF & rekapitulasi absensi.
            </p>
          </div>
          {!isEditingKop && (
            <button
              onClick={() => setIsEditingKop(true)}
              className="flex items-center justify-center gap-2 py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
            >
              Ubah Data Kop Surat
            </button>
          )}
        </div>

        <div className="p-6 space-y-8">
          {/* Form Editing */}
          {isEditingKop ? (
            <form onSubmit={handleSaveKop} className="space-y-5 text-xs font-sans border-b border-slate-100 pb-8">
              <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
                <Printer className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <div className="text-amber-900 leading-relaxed text-xs">
                  <span className="font-extrabold block">Petunjuk Pengisian Kop Surat Resmi:</span>
                  Data yang Anda masukkan di bawah ini langsung terlihat hasilnya di kotak <b>Live Preview</b> sebelah bawah dan akan otomatis menjadi header resmi saat mencetak laporan PDF/Excel/Rekapitulasi Absensi.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Nama Dinas / Yayasan / Kementerian (Baris 1)
                  </label>
                  <input
                    required
                    value={kopData.nama_dinas || ""}
                    onChange={(e) => setKopData({ ...kopData, nama_dinas: e.target.value })}
                    placeholder="cth: PEMERINTAH PROVINSI JAWA BARAT / DINAS PENDIDIKAN"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Nama Resmi Instansi / Sekolah / Kampus (Baris 2 Utama)
                  </label>
                  <input
                    required
                    value={kopData.nama_instansi || ""}
                    onChange={(e) => setKopData({ ...kopData, nama_instansi: e.target.value })}
                    placeholder="cth: SMA NEGERI 1 UNGGULAN GARUT"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-black uppercase text-indigo-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Alamat Lengkap Instansi (Jalan, Kelurahan, Kecamatan, Kota/Kabupaten, Provinsi)
                </label>
                <textarea
                  required
                  rows={2}
                  value={kopData.alamat || ""}
                  onChange={(e) => setKopData({ ...kopData, alamat: e.target.value })}
                  placeholder="cth: Jl. Merdeka No. 123, Kel. Haurpanggung, Kec. Tarogong Kidul, Kab. Garut, Jawa Barat"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Nomor Telepon / Fax
                  </label>
                  <input
                    value={kopData.telepon || ""}
                    onChange={(e) => setKopData({ ...kopData, telepon: e.target.value })}
                    placeholder="cth: (0262) 234567"
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Alamat Email Resmi
                  </label>
                  <input
                    type="email"
                    value={kopData.email || ""}
                    onChange={(e) => setKopData({ ...kopData, email: e.target.value })}
                    placeholder="info@sman1garut.sch.id"
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Website Instansi
                  </label>
                  <input
                    value={kopData.website || ""}
                    onChange={(e) => setKopData({ ...kopData, website: e.target.value })}
                    placeholder="https://sman1garut.sch.id"
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold text-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Kode Pos
                  </label>
                  <input
                    value={kopData.kode_pos || ""}
                    onChange={(e) => setKopData({ ...kopData, kode_pos: e.target.value })}
                    placeholder="44151"
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                  Upload Logo Instansi untuk Kop Surat (Maksimal 2MB - Kompresi Otomatis)
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-150">
                  <div className="w-20 h-20 bg-white border border-slate-200 rounded-xl flex items-center justify-center p-1.5 shrink-0 shadow-sm">
                    <img
                      src={kopData.logo_url || school.logoUrl || "/logo.png"}
                      alt="Preview Logo Kop"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="flex-1 space-y-2 text-left">
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Format gambar PNG atau JPG dengan resolusi persegi (1:1) direkomendasikan. Logo akan secara otomatis diubah ukurannya agar pas dengan rasio cetak kop surat resmi.
                    </p>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-2 py-2 px-4 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs cursor-pointer shadow-sm transition-all">
                        <Upload size={14} className="text-indigo-600" />
                        Unggah Logo Instansi
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoKopUpload}
                          className="hidden"
                        />
                      </label>
                      {kopData.logo_url && (
                        <button
                          type="button"
                          onClick={() => setKopData({ ...kopData, logo_url: "" })}
                          className="text-xs text-rose-600 font-bold hover:underline"
                        >
                          Hapus Logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2 justify-end">
                <button
                  type="submit"
                  disabled={isSavingKop}
                  className="flex items-center justify-center gap-2 py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#10b981] to-[#059669] border border-[#34d399] shadow-[inset_0_2px_1px_rgba(255,255,255,0.4),_0_6px_15px_rgba(16,185,129,0.3)] hover:from-[#34d399] hover:to-[#10b981] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" /> {isSavingKop ? "Menyimpan..." : "Simpan Data Kop Surat"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingKop(false);
                    setKopData(school.kopSurat || kopData);
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 px-6 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all"
                >
                  <X size={16} /> Batal
                </button>
              </div>
            </form>
          ) : null}

          {/* INSTANT LIVE PREVIEW BOX */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="text-indigo-600" size={18} />
                <h4 className="font-extrabold text-slate-800 text-sm tracking-tight">
                  Live Preview Instan Kop Surat Resmi
                </h4>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black tracking-wider uppercase">
                <CheckCircle size={12} /> Siap Cetak PDF & Laporan
              </span>
            </div>

            {/* Kotak Preview Kop Surat Bergaya Resmi */}
            <div className="p-6 md:p-8 bg-white border-2 border-slate-200 rounded-2xl shadow-sm text-slate-900 font-serif">
              <div className="flex items-center justify-between gap-4 pb-4 border-b-4 border-double border-slate-900">
                {/* Logo Kiri */}
                <div className="w-20 sm:w-24 shrink-0 flex items-center justify-center">
                  <img
                    src={(isEditingKop ? kopData.logo_url : school.kopSurat?.logo_url) || school.logoUrl || "/logo.png"}
                    alt="Logo Instansi"
                    className="max-h-20 sm:max-h-24 max-w-full object-contain"
                  />
                </div>

                {/* Teks Kop Tengah */}
                <div className="flex-1 text-center space-y-0.5 font-sans">
                  <p className="text-xs sm:text-sm font-bold tracking-wide uppercase text-slate-700">
                    {(isEditingKop ? kopData.nama_dinas : school.kopSurat?.nama_dinas) || school.nama_dinas || "Nama Yayasan/Dinas Belum Diatur"}
                  </p>
                  <h3 className="text-base sm:text-xl md:text-2xl font-black uppercase text-slate-900 tracking-tight leading-tight">
                    {(isEditingKop ? kopData.nama_instansi : school.kopSurat?.nama_instansi) || school.nama_instansi || school.name || "Nama Instansi Belum Diatur"}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-700 font-medium max-w-2xl mx-auto leading-snug pt-0.5">
                    {(isEditingKop ? kopData.alamat : school.kopSurat?.alamat) || school.alamat || school.address || "Alamat Belum Diatur"}
                  </p>
                  <div className="text-[10px] sm:text-[11px] text-slate-600 font-medium pt-0.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
                    <span><b>Telp:</b> {(isEditingKop ? kopData.telepon : school.kopSurat?.telepon) || school.phone || "—"}</span>
                    <span><b>Email:</b> {(isEditingKop ? kopData.email : school.kopSurat?.email) || school.adminEmail || "—"}</span>
                    <span><b>Website:</b> {(isEditingKop ? kopData.website : school.kopSurat?.website) || "—"}</span>
                    <span><b>Kode Pos:</b> {(isEditingKop ? kopData.kode_pos : school.kopSurat?.kode_pos) || "—"}</span>
                  </div>
                </div>

                {/* Spacer Kanan agar persis seimbang dengan logo kiri */}
                <div className="w-20 sm:w-24 shrink-0 hidden md:block" />
              </div>
              <div className="mt-3 text-center text-[10px] text-slate-400 font-sans italic">
                * Tampilan di atas adalah representasi akurat kop surat yang otomatis disematkan pada setiap cetakan dokumen/PDF/rekapitulasi absensi.
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* SECTION: LOGIN BACKGROUND CUSTOMIZER */}
      {tab === 'login-bg' && (
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
      )}

      {/* SECTION: LIVE TV / KIOSK BACKGROUND */}
      {tab === 'kiosk-bg' && (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden text-left mt-6">
        <div className="bg-indigo-50/50 p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Tv className="text-indigo-600 shrink-0" size={24} />
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">
                Kustomisasi Latar Belakang Layar Live TV Kiosk Proyektor
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Atur wallpaper custom untuk tampilan display absensi di layar TV / Proyektor / Tablet Kiosk dan Preview Admin.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-2.5 py-1 rounded-full border border-indigo-200 uppercase tracking-wider">
            Sinkron Real-time
          </span>
        </div>

        <div className="p-6 flex flex-col md:flex-row gap-6 items-center">
          {/* Preview Container */}
          <div className="w-full md:w-48 h-32 rounded-2xl border border-slate-200 overflow-hidden bg-slate-950 shrink-0 flex items-center justify-center relative shadow-inner">
            {kioskBgData ? (
              <img
                src={kioskBgData}
                alt="Latar Belakang Live TV Kiosk"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-slate-400 text-[10px] font-bold">
                <Tv size={20} className="text-indigo-400" />
                <span>Background Default 4K</span>
              </div>
            )}
            <div className="absolute inset-0 bg-slate-950/40 pointer-events-none" />
          </div>

          <div className="flex-1 space-y-4">
            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
              Unggah gambar beresolusi lanskap 16:9 untuk langsung memperbarui latar belakang layar TV / Kiosk presensi secara instan tanpa perlu memuat ulang peramban.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() => document.getElementById("kiosk-bg-upload-input")?.click()}
                className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
              >
                <Upload className="w-3.5 h-3.5" />
                Unggah Foto Background Kiosk
              </button>
              <input
                type="file"
                id="kiosk-bg-upload-input"
                accept="image/*"
                className="hidden"
                onChange={handleKioskBgUpload}
              />

              {kioskBgData && (
                <button
                  type="button"
                  onClick={handleDeleteKioskBg}
                  className="flex items-center justify-center gap-2 py-2 px-5 font-bold text-white text-xs rounded-xl bg-gradient-to-b from-[#ff4d4d] to-[#cc0000] border border-[#ff9999] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(204,0,0,0.4)] hover:from-[#ff6666] hover:to-[#e60000] hover:-translate-y-[1px] active:translate-y-[1px] transition-all duration-200 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus & Reset ke Default
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* SECTION: SYSTEM LOGS & EMAIL HISTORY */}
      {tab === 'log-transmisi' && (
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
      )}

      {/* SECTION: DATABASE & TRANSACTION UTILITIES */}
      {tab === 'db-utils' && (
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
            Gunakan fungsi berikut untuk mengosongkan seluruh log transaksi di dalam aplikasi (Absensi, Pengajuan Cuti/Izin, dan Laporan Kinerja Harian). Tindakan ini akan membuat aplikasi bersih seperti baru tanpa menghapus akun Pegawai / Guru / Dosen & Staf, sehingga dapat langsung digunakan untuk operasional instansi atau sekolah yang baru secara steril.
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
                  onClick={async () => {
                    if (isOffline) { toast.error("Koneksi terputus. Operasi dibatalkan."); return; }
                    try {
                      Promise.race([
                        Promise.all([
                          set(getTenantRef('attendance'), null),
                          set(getTenantRef('cuti_requests'), null),
                          set(getTenantRef('kinerja_records'), null),
                        ]),
                        new Promise((_, reject) => setTimeout(reject, 1500))
                      ]).catch(() => { });
                    } catch { /* ignore */ }
                    toast.success("Database berhasil dibersihkan seperti baru!");
                    setConfirmClean(false);
                    setTimeout(() => window.location.reload(), 500);
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
                    if (isOffline) { toast.error("Koneksi terputus. Factory Reset dibatalkan."); return; }
                    toast.error("Factory Reset dinonaktifkan dalam mode Full Online untuk menghindari penghapusan data server publik.");
                    setConfirmFactory(false);
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
      )}
      </>
      )}
    </div>
  );
}
