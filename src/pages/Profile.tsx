import React, { useState } from "react";
import { useAuth } from "../components/AuthContext";
import { db } from "../lib/db";
import { UserCircle, Shield, Building, Award, Calendar, Save, Eye, EyeOff } from 'lucide-react';
import { subDays, format, addDays } from "date-fns";
import { id as localeID } from "date-fns/locale";
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";

export function Profile() {
  const { user, login } = useAuth();
  const school = db.getSchool();
  const yayasanName = "YAYASAN " + (school.name || "AL-HIDAYAH").replace(/^(mts\.|smp|sma|ma|sd|mi)\s+/i, "").toUpperCase();
  const [activeTab, setActiveTab] = useState<"profil" | "foto" | "akun" | "riwayat" | "kartu_qr">(
    "profil",
  );
  const [personalLogoUrl, setPersonalLogoUrl] = useState<string>(() => {
    const saved = localStorage.getItem(`qr_embedded_logo_personal_${user?.id}`);
    return saved || school.logoUrl || "/logo-kemenag.png";
  });
  const [showPassword, setShowPassword] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string>("");

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          setPhotoBase64(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoUpload = () => {
    if (!photoBase64) {
      toast.error("Silakan pilih file foto terlebih dahulu.");
      return;
    }
    if (user) {
      db.updateUser(user.id, { photoUrl: photoBase64 });
      login({ ...user, photoUrl: photoBase64 });
      toast.success("Foto profil berhasil diperbarui!");
      window.dispatchEvent(new Event("users_updated"));
    }
  };

  const handlePersonalLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPersonalLogoUrl(base64);
        localStorage.setItem(`qr_embedded_logo_personal_${user?.id}`, base64);
        toast.success("Logo kustom berhasil disematkan di Kartu QR Anda!");
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePrintCard = () => {
    window.print();
  };

  const [historyMonth, setHistoryMonth] = useState(format(new Date(), "yyyy-MM"));
  const [formData, setFormData] = useState({
    name: user?.name || "",
    nip: user?.nip || "",
    opd: user?.opd || "KEMENAG",
    satker: user?.satuanKerja || user?.satker || school?.name || "Nama Madrasah",
    jabatan: user?.jabatan || "Guru Utama/Pembina",
    gender: user?.gender || "Laki-laki",
    phone: user?.phone || "",
    email: user?.email || "",
    address: user?.address || "",
    mapelUtama: user?.mapelUtama || "",
    mapelSertifikasi: user?.mapelSertifikasi || "",
  });

  const [accountData, setAccountData] = useState({
    username: user?.username || "",
    password: user?.password || "",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccountData({ ...accountData, [e.target.name]: e.target.value });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const dataToSave = {
      ...formData,
      satuanKerja: formData.satker, // keep in sync with schema
    };

    const usersList = db.getUsers();
    const updatedUsers = usersList.map((u) =>
      u.id === user.id ? { ...u, ...dataToSave } : u,
    );

    db.setUsers(updatedUsers);
    login({ ...user, ...dataToSave });
    toast.success("Profil personel berhasil diperbarui.");
    window.dispatchEvent(new Event("users_updated"));
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const usersList = db.getUsers();
    const updatedUsers = usersList.map((u) =>
      u.id === user.id ? { ...u, ...accountData } : u,
    );

    db.setUsers(updatedUsers);
    login({ ...user, ...accountData });
    toast.success("Kredensial login akun berhasil diperbarui.");
    window.dispatchEvent(new Event("users_updated"));
  };

  const attendance = user
    ? db.getAttendance().filter((a) => a.userId === user.id)
    : [];
  const today = new Date();

  let startDate = subDays(today, 364);
  const startDay = startDate.getDay();
  const diffToMonday = startDay === 0 ? 6 : startDay - 1;
  startDate = subDays(startDate, diffToMonday);

  const daysCount =
    Math.floor(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1;
  const days = Array.from({ length: daysCount }).map((_, i) =>
    addDays(startDate, i),
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left animate-fade-in font-sans text-xs sm:text-xs">
      <h2 className="text-2xl font-black text-slate-850 tracking-tight border-b border-gray-200 pb-3">
        {user?.role === "developer" ? "Profil Sistem Pengembang" : user?.role === "admin" ? "Profil Administrator" : "Profil Kepegawaian Guru & Staf"}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-3xl border border-slate-205 p-6 flex flex-col items-center text-center h-fit">
          <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-4 overflow-hidden border-4 border-slate-50">
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="Foto Profil" className="w-full h-full object-cover" />
            ) : (
              <UserCircle size={84} className="text-slate-350" strokeWidth={1} />
            )}
          </div>
          <h3 className="text-sm font-black text-[#111c2d] leading-none mb-1.5">
            {user?.name}
          </h3>
          <p className="text-[10px] text-indigo-600 font-extrabold uppercase bg-indigo-50 border border-indigo-100 px-3.5 py-0.5 rounded-full">
            {user?.role.replace("_", " ")}
          </p>

          <div className="w-full border-t border-gray-200 mt-5 pt-4 space-y-2.5 text-left text-[11px] text-gray-500 font-medium">
            <div className="flex items-center gap-2">
              <Building size={14} className="text-gray-500 shrink-0" />
              <span className="truncate">{user?.opd || "KEMENAG"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Award size={14} className="text-gray-500 shrink-0" />
              <span className="truncate">
                {user?.jabatan || "Fungsional Umum"}
              </span>
            </div>
          </div>
        </div>

        {/* Edit Form tab */}
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-md">
          <div className="flex border-b border-gray-200 px-4">
            <button
              onClick={() => setActiveTab("profil")}
              className={`px-4 py-2.5 my-2 mx-1 font-bold text-xs transition-all duration-200 rounded-2xl border ${activeTab === "profil" ? "bg-white/60 border-white/80 text-slate-800 shadow-[0_4px_10px_rgba(0,0,0,0.02)] backdrop-blur-md" : "bg-transparent border-transparent text-gray-500 hover:bg-white/40"}`}
            >
              Biodata Pegawai
            </button>
            <button
              onClick={() => setActiveTab("foto")}
              className={`px-4 py-2.5 my-2 mx-1 font-bold text-xs transition-all duration-200 rounded-2xl border ${activeTab === "foto" ? "bg-white/60 border-white/80 text-slate-800 shadow-[0_4px_10px_rgba(0,0,0,0.02)] backdrop-blur-md" : "bg-transparent border-transparent text-gray-500 hover:bg-white/40"}`}
            >
              Pas Foto Resmi
            </button>
            <button
              onClick={() => setActiveTab("akun")}
              className={`px-4 py-2.5 my-2 mx-1 font-bold text-xs transition-all duration-200 rounded-2xl border ${activeTab === "akun" ? "bg-white/60 border-white/80 text-slate-800 shadow-[0_4px_10px_rgba(0,0,0,0.02)] backdrop-blur-md" : "bg-transparent border-transparent text-gray-500 hover:bg-white/40"}`}
            >
              Akun & Password
            </button>
            {user?.role === "guru" && (
              <button
                onClick={() => setActiveTab("riwayat")}
                className={`px-4 py-2.5 my-2 mx-1 font-bold text-xs transition-all duration-200 rounded-2xl border ${activeTab === "riwayat" ? "bg-white/60 border-white/80 text-slate-800 shadow-[0_4px_10px_rgba(0,0,0,0.02)] backdrop-blur-md" : "bg-transparent border-transparent text-gray-500 hover:bg-white/40"}`}
              >
                Riwayat Presensi
              </button>
            )}
            {(user?.role === "guru" || user?.role === "staf_sekolah") && (
              <button
                onClick={() => setActiveTab("kartu_qr")}
                className={`px-4 py-2.5 my-2 mx-1 font-bold text-xs transition-all duration-200 rounded-2xl border ${activeTab === "kartu_qr" ? "bg-white/60 border-white/80 text-slate-800 shadow-[0_4px_10px_rgba(0,0,0,0.02)] backdrop-blur-md" : "bg-transparent border-transparent text-gray-500 hover:bg-white/40"}`}
              >
                Kartu Presensi QR
              </button>
            )}
          </div>

          <div className="p-6">
            {activeTab === "profil" && (
              <form
                onSubmit={handleSaveProfile}
                className="space-y-4 font-bold text-gray-800/90"
              >
                <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                  <label className="text-[10px] uppercase font-mono text-gray-500">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl"
                    required
                  />
                </div>
                <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                  <label className="text-[10px] uppercase font-mono text-gray-500">
                    NUPTK / NRG / PegID / NPK
                  </label>
                  <input
                    type="text"
                    name="nip"
                    value={formData.nip}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl"
                    placeholder="Masukkan NUPTK / NRG / PegID / NPK"
                  />
                </div>
                <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                  <label className="text-[10px] uppercase font-mono text-gray-500">
                    Nama Lembaga Naungan
                  </label>
                  <input
                    type="text"
                    name="opd"
                    value={formData.opd}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                  <label className="text-[10px] uppercase font-mono text-gray-500">
                    Satuan Kerja
                  </label>
                  <input
                    type="text"
                    name="satker"
                    value={formData.satker}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                  <label className="text-[10px] uppercase font-mono text-gray-500">
                    Jabatan Guru / Staf
                  </label>
                  <input
                    type="text"
                    name="jabatan"
                    value={formData.jabatan}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl"
                  />
                </div>
                {user?.role === "guru" && (
                  <>
                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                      <label className="text-[10px] uppercase font-mono text-sky-700 font-bold">
                        MaPel Utama 📚
                      </label>
                      <input
                        type="text"
                        name="mapelUtama"
                        value={formData.mapelUtama}
                        onChange={handleChange}
                        placeholder="Contoh: Matematika, IPA (Bisa lebih dari satu)"
                        className="w-full px-3 py-1.5 border border-sky-200 bg-sky-50/20 rounded-xl focus:border-sky-400 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                      <label className="text-[10px] uppercase font-mono text-sky-700 font-bold">
                        MaPel Sertifikasi 🏅
                      </label>
                      <input
                        type="text"
                        name="mapelSertifikasi"
                        value={formData.mapelSertifikasi}
                        onChange={handleChange}
                        placeholder="Contoh: Matematika"
                        className="w-full px-3 py-1.5 border border-sky-200 bg-sky-50/20 rounded-xl focus:border-sky-400 focus:outline-none"
                      />
                    </div>
                  </>
                )}
                <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                  <label className="text-[10px] uppercase font-mono text-gray-500">
                    Jenis Kelamin *
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white"
                    required
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                  <label className="text-[10px] uppercase font-mono text-gray-500">
                    No Telepon/WA
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                  <label className="text-[10px] uppercase font-mono text-gray-500">
                    Surat Elektronik (Email)
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="nama@email.com"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                  <label className="text-[10px] uppercase font-mono text-gray-500">
                    Alamat Rumah
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-xl min-h-[70px]"
                  />
                </div>
                <div className="grid grid-cols-[130px_1fr] items-center gap-4 pt-4 border-t border-gray-200">
                  <div></div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        required
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span className="text-gray-500">
                        Konfirmasi kesesuaian data
                      </span>
                    </label>
                    <button
                      type="submit"
                      className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                    >
                  <Save className="w-4 h-4" /> Simpan Perubahan
                </button>
                  </div>
                </div>
              </form>
            )}

            {activeTab === "foto" && (
              <div className="flex flex-col items-center justify-center py-6 space-y-4">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center overflow-hidden border">
                  {user?.photoUrl ? (
                    <img src={user.photoUrl} alt="Foto Profil" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle size={84} className="text-slate-300" />
                  )}
                </div>
                <div className="w-full max-w-xs text-center">
                  <p className="text-[10px] text-gray-500 mb-1.5 italic">
                    Unggah pas foto formal Guru / Staf (Format latar merah/biru disarankan)
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-2.5 file:px-6 file:border file:border-[#d185ff] file:text-sm file:font-bold file:rounded-2xl file:text-white file:bg-gradient-to-b file:from-[#b829ff] file:to-[#7928CA] file:shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:file:from-[#c24bff] hover:file:to-[#8630db] hover:file:-translate-y-[2px] file:transition-all file:duration-200 file:cursor-pointer cursor-pointer focus:outline-none bg-slate-50/50 rounded-2xl pr-4 border border-slate-200"
                    />
                    <button
                      onClick={handlePhotoUpload}
                      className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200 shrink-0"
                    >
                      Upload
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "akun" && (
              <form
                onSubmit={handleSaveAccount}
                className="space-y-4 font-bold text-slate-705 text-gray-800/90"
              >
                <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                  <label className="text-[10px] uppercase font-mono text-gray-500">
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={accountData.username}
                    onChange={handleAccountChange}
                    className="w-full px-3 py-1.5 border border-slate-205 rounded-xl"
                    required
                  />
                </div>
                <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-800/90">
                      Sandi Baru
                    </label>
                    <span className="text-[9px] text-[#ea4335]">
                      (opsional)
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={accountData.password}
                      onChange={handleAccountChange}
                      className="w-full text-sm px-4 py-2 bg-white border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#6741d9] pr-10"
                      placeholder="•••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-[130px_1fr] items-center gap-4 pt-4 border-t border-gray-200">
                  <div></div>
                  <div className="flex items-center justify-between col-span-1">
                    <label className="flex items-center gap-1.5 cursor-pointer selection:bg-white/5">
                      <input
                        type="checkbox"
                        required
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-505 w-4 h-4"
                      />
                      <span className="text-gray-500">
                        Konfirmasi kesesuaian sandi
                      </span>
                    </label>
                    <button
                      type="submit"
                      className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                    >
                  <Save className="w-4 h-4" /> Simpan Sandi
                </button>
                  </div>
                </div>
              </form>
            )}

            {activeTab === "riwayat" && (
              <div className="space-y-4 font-sans animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h4 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">
                      Kalender Presensi Bulanan Saya
                    </h4>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Lihat status kehadiran Anda secara harian untuk bulan terpilih.
                    </p>
                  </div>
                  <input
                    type="month"
                    value={historyMonth}
                    onChange={(e) => setHistoryMonth(e.target.value)}
                    className="px-3 py-1.5 border border-gray-200 rounded-xl font-bold bg-white text-[11px]"
                  />
                </div>

                <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200 pb-2 select-none">
                  <div>Sen</div>
                  <div>Sel</div>
                  <div>Rab</div>
                  <div>Kam</div>
                  <div>Jum</div>
                  <div>Sab</div>
                  <div>Min</div>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {(() => {
                    const [yearStr, monthStr] = historyMonth.split("-");
                    const year = parseInt(yearStr);
                    const month = parseInt(monthStr);

                    const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // Sunday is 0
                    const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
                    const daysInMonth = new Date(year, month, 0).getDate();

                    const grid = [];

                    for (let i = 0; i < offset; i++) {
                      grid.push(<div key={`empty-${i}`} className="h-14 bg-white/5/20 rounded-2xl border border-dashed border-gray-200" />);
                    }

                    for (let d = 1; d <= daysInMonth; d++) {
                      const dayStr = String(d).padStart(2, "0");
                      const dateString = `${historyMonth}-${dayStr}`;
                      const record = attendance.find((a) => a.date === dateString);

                      const dayOfWeek = new Date(year, month - 1, d).getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                      let statusColor = "text-gray-500 bg-white/5/40 border-gray-200";
                      let statusText = "T/K Keluar";

                      if (record) {
                        if (record.status === "Hadir") {
                          statusColor = "text-emerald-700 bg-emerald-50 border-emerald-100";
                          statusText = "Hadir";
                        } else if (record.status === "Terlambat") {
                          statusColor = "text-amber-700 bg-amber-50 border-amber-100 font-bold";
                          statusText = "Telat";
                        } else if (record.status === "Izin") {
                          statusColor = "text-blue-700 bg-blue-50 border-blue-100 font-bold";
                          statusText = "Izin";
                        } else if (record.status === "Sakit") {
                          statusColor = "text-purple-700 bg-purple-50 border-purple-100 font-bold";
                          statusText = "Sakit";
                        } else if (record.status === "Alpha") {
                          statusColor = "text-rose-700 bg-rose-50 border-rose-100 font-bold";
                          statusText = "Alpha";
                        }
                      } else if (isWeekend) {
                        statusColor = "text-gray-500 bg-white/5/60 border-slate-150";
                        statusText = "A. Pekan";
                      }

                      grid.push(
                        <div
                          key={`day-${d}`}
                          className={`h-14 p-2 border rounded-2xl flex flex-col justify-between text-left transition hover:shadow-2xs ${statusColor}`}
                        >
                          <span className="font-extrabold text-xs">{d}</span>
                          <span className="text-[7.5px] font-black uppercase tracking-wider truncate">
                            {statusText}
                          </span>
                        </div>
                      );
                    }

                    return grid;
                  })()}
                </div>
              </div>
            )}

            {activeTab === "kartu_qr" && (
              <div className="space-y-6 animate-fade-in font-sans">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
                  <div>
                    <h4 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">
                      Kartu Presensi Digital Guru/Staf
                    </h4>
                    <p className="text-[10px] text-slate-405 text-gray-500 mt-0.5">
                      Tunjukkan Kode QR ini di layar HP Anda atau cetak sebagai kartu ID fisik.
                    </p>
                  </div>
                  <button
                    onClick={handlePrintCard}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                  >
                    <Calendar size={14} /> Cetak Kartu Presensi
                  </button>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  {/* Visual ID Card Face */}
                  <div
                    id="print-card-area"
                    className="w-[350px] h-[210px] bg-gradient-to-br from-emerald-800 to-emerald-950 rounded-2xl p-4 text-gray-800 flex flex-col justify-between shadow-lg relative overflow-hidden border border-emerald-700 shrink-0 font-sans"
                  >
                    {/* Background decorations */}
                    <div className="absolute top-[-30px] right-[-30px] w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
                    <div className="absolute bottom-[-30px] left-[-30px] w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />

                    {/* Card Header */}
                    <div className="flex gap-2 items-center border-b border-gray-200 pb-2 shrink-0">
                      <img src={school.logoUrl || "/logo-kemenag.png"} alt="Logo" className="w-8 h-8 object-contain shrink-0" onError={(e) => { e.currentTarget.src = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png" }} />
                      <div className="text-left">
                        <h5 className="text-[10px] font-black tracking-tight leading-tight uppercase">{yayasanName}</h5>
                        <p className="text-[7.5px] font-bold text-emerald-300 leading-none">{school.name.toUpperCase()}</p>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="flex gap-3 items-center flex-1 py-2">
                      {/* Photo */}
                      <div className="w-16 h-20 rounded-lg overflow-hidden bg-white/5/10 border border-gray-200 shrink-0 flex items-center justify-center relative">
                        <UserCircle size={48} className="text-gray-800/30" />
                      </div>

                      {/* Profile details */}
                      <div className="text-left flex-1 min-w-0 space-y-1">
                        <h6 className="font-extrabold text-[11px] leading-snug truncate uppercase tracking-wide text-yellow-300">
                          {user?.name}
                        </h6>
                        <div className="space-y-0.5 text-[8.5px] font-medium text-slate-205 text-slate-200">
                          <p className="truncate">NIP: {user?.nip || "—"}</p>
                          <p className="truncate">Role: {user?.role.replace("_", " ").toUpperCase()}</p>
                          <p className="truncate">Jabatan: {user?.jabatan || "Guru Utama"}</p>
                        </div>
                      </div>

                      {/* QR Code */}
                      <div className="bg-white p-1.5 rounded-lg shrink-0 flex items-center justify-center border border-white/20">
                        <QRCodeSVG
                          value={JSON.stringify({
                            type: "personal_qr",
                            userId: user?.id,
                            name: user?.name,
                            nip: user?.nip,
                          })}
                          size={70}
                          imageSettings={personalLogoUrl ? {
                            src: personalLogoUrl,
                            x: undefined,
                            y: undefined,
                            height: 16,
                            width: 16,
                            excavate: true,
                          } : undefined}
                        />
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="border-t border-gray-200 pt-1.5 flex justify-between items-center text-[7.5px] font-mono text-slate-350 tracking-wider shrink-0 uppercase">
                      <span>KARTU PRESENSI PERSONAL GURU</span>
                      <span className="font-bold text-emerald-300">ONLINE</span>
                    </div>
                  </div>

                  {/* Logo customizer */}
                  <div className="no-print flex-1 w-full bg-white/5 bg-white border border-slate-150 p-4 rounded-2xl space-y-3 text-left">
                    <h5 className="text-[11px] font-bold text-gray-800/90">Sematan Logo QR Code (Kustom)</h5>
                    <p className="text-[10px] text-slate-450 leading-relaxed">
                      Unggah logo yayasan, madrasah, atau logo pribadi Anda untuk ditampilkan tepat di tengah Kode QR Anda.
                    </p>
                    
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePersonalLogoUpload}
                      className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />

                    {personalLogoUrl && personalLogoUrl !== (school.logoUrl || "/logo-kemenag.png") && (
                      <button
                        onClick={() => {
                          const defaultLogo = school.logoUrl || "/logo-kemenag.png";
                          setPersonalLogoUrl(defaultLogo);
                          localStorage.removeItem(`qr_embedded_logo_personal_${user?.id}`);
                          toast.success("Logo dikembalikan ke default sekolah.");
                        }}
                        className="text-[10px] text-rose-600 hover:underline font-bold block cursor-pointer"
                      >
                        Hapus Logo Kustom
                      </button>
                    )}
                  </div>
                </div>

                <style>
                  {`
                    @media print {
                      body * {
                        visibility: hidden;
                      }
                      #print-card-area, #print-card-area * {
                        visibility: visible;
                      }
                      #print-card-area {
                        position: absolute;
                        left: 50%;
                        top: 40%;
                        transform: translate(-50%, -50%) scale(1.4);
                        border: none !important;
                        box-shadow: none !important;
                      }
                      .no-print {
                        display: none !important;
                      }
                    }
                  `}
                </style>
              </div>
            )}
          </div>
        </div>
      </div>

      {user?.role === "guru" && (
        <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 mt-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-black text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar size={18} className="text-indigo-600" />
              Kalender Disiplin Pegawai (Tahun Berjalan)
            </h3>
            <span className="text-[10px] font-extrabold text-[#111c2d] bg-indigo-50 border border-indigo-100 px-3.5 py-1 rounded-full">
              {attendance.length} Hari Masuk Kerja
            </span>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="min-w-[800px]">
              <div className="flex gap-3">
                <div className="grid grid-flow-row gap-[6px] text-[10px] font-bold text-gray-500 text-right w-8 select-none">
                  <div className="h-3 flex items-center justify-end">Sen</div>
                  <div className="h-3 flex items-center justify-end"></div>
                  <div className="h-3 flex items-center justify-end">Rab</div>
                  <div className="h-3 flex items-center justify-end"></div>
                  <div className="h-3 flex items-center justify-end">Jum</div>
                  <div className="h-3 flex items-center justify-end"></div>
                  <div className="h-3 flex items-center justify-end">Min</div>
                </div>
                <div className="flex-1">
                  <div
                    className="grid grid-flow-col gap-[6px]"
                    style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}
                  >
                    {days.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const record = attendance.find((a) => a.date === dateStr);
                      // Default colors
                      let colorClass = "bg-white/5 hover:bg-slate-200";
                      if (record) {
                        if (record.status === "Hadir")
                          colorClass = "bg-emerald-500 hover:bg-emerald-600";
                        else if (record.status === "Terlambat")
                          colorClass = "bg-amber-400 hover:bg-amber-500";
                        else if (record.status === "Izin")
                          colorClass = "bg-blue-400 hover:bg-blue-500";
                        else if (record.status === "Sakit")
                          colorClass = "bg-purple-400 hover:bg-purple-500";
                        else colorClass = "bg-rose-500 hover:bg-rose-600";
                      }

                      return (
                        <div
                          key={dateStr}
                          className={`w-3 h-3 rounded-[2px] ${colorClass} transition-colors cursor-help`}
                          title={`${format(day, "EEEE, dd MMM yyyy", { locale: localeID })}: ${record ? record.status : "T/K Keluar"}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 mt-6 text-[10px] font-bold text-gray-500 justify-end font-sans select-none">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-[2px] bg-emerald-500"></div>
                  <span>Hadir</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-[2px] bg-amber-400"></div>
                  <span>Terlambat</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-[2px] bg-blue-400"></div>
                  <span>Izin/Cuti</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-[2px] bg-purple-400"></div>
                  <span>Sakit</span>
                </div>
                <div className="flex items-center gap-1.5 border-r border-gray-200 pr-6">
                  <div className="w-3 h-3 rounded-[2px] bg-rose-500"></div>
                  <span>Alpha</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>Tidak ada data</span>
                  <div className="w-3 h-3 rounded-[2px] bg-white/5"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
