import React, { useState, useRef } from "react";
import { useAuth } from "./AuthContext";
import { db } from "../lib/db";
import { update } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { getTenantRef, auth, storage } from "../lib/firebase";
import {
  UserCircle,
  Building,
  Award,
  Calendar,
  Save,
  Eye,
  EyeOff,
  Camera,
  FolderOpen,
  LogOut,
  Upload
} from "lucide-react";
import { subDays, format, addDays } from "date-fns";
import { id as localeID } from "date-fns/locale";
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";
import { useLicense } from "../hooks/useLicense";
import { BiometricEnrollment } from "./BiometricEnrollment";

interface ProfileTabContentProps {
  /** Dipanggil saat tombol Keluar ditekan */
  onLogout?: () => void;
}

export function ProfileTabContent({ onLogout }: ProfileTabContentProps) {
  const { user, login } = useAuth();
  const { config: licenseConfig } = useLicense();
  const school: any = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
  const yayasanName =
    "YAYASAN " +
    (school.name || "AL-HIDAYAH")
      .replace(/^(mts\.|smp|sma|ma|sd|mi)\s+/i, "")
      .toUpperCase();

  const [activeTab, setActiveTab] = useState<
    "profil" | "foto" | "akun" | "biometrik" | "riwayat" | "kartu_qr"
  >("profil");

  const [personalLogoUrl, setPersonalLogoUrl] = useState<string>(() => {
    const saved = localStorage.getItem(
      `qr_embedded_logo_personal_${user?.id}`
    );
    return saved || school.logoUrl || "logo.png";
  });

  const [showPassword, setShowPassword] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string>("");
  const [selectedPhotoName, setSelectedPhotoName] = useState<string>("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [confirmProfile, setConfirmProfile] = useState(false);
  const [confirmAccount, setConfirmAccount] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [historyMonth, setHistoryMonth] = useState(
    format(new Date(), "yyyy-MM")
  );

  const [formData, setFormData] = useState({
    name: user?.name || "",
    nip: user?.nip || "",
    opd: user?.opd || "-",
    satker:
      user?.satuanKerja ||
      (user as any)?.satker ||
      school?.name ||
      "Nama Sekolah / Kampus",
    jabatan: user?.jabatan || "Guru / Dosen / Staf Utama",
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

  React.useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || "",
        nip: user.nip || "",
        opd: user.opd || "-",
        satker: user.satuanKerja || (user as any).satker || school?.name || "Nama Sekolah / Kampus",
        jabatan: user.jabatan || "Guru / Dosen / Staf Utama",
        gender: user.gender || "Laki-laki",
        phone: user.phone || "",
        email: user.email || "",
        address: user.address || "",
        mapelUtama: user.mapelUtama || "",
        mapelSertifikasi: user.mapelSertifikasi || "",
      }));
      setAccountData(prev => ({
        ...prev,
        username: user.username || "",
        password: user.password || "",
      }));
    }
  }, [
    user?.id,
    user?.name,
    user?.nip,
    user?.opd,
    user?.satuanKerja,
    (user as any)?.satker,
    user?.jabatan,
    user?.gender,
    user?.phone,
    user?.email,
    user?.address,
    user?.mapelUtama,
    user?.mapelSertifikasi,
    user?.username,
    user?.password
  ]);

  // ── Handlers ───────────────────────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccountData({ ...accountData, [e.target.name]: e.target.value });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.id) {
      toast.error("Gagal menyimpan: ID Pengguna tidak ditemukan.");
      return;
    }
    try {
      const { satker, ...restFormData } = formData;
      const dataToSave = { ...restFormData, satuanKerja: satker, phone: formData.phone, email: formData.email };
      
      const userRef = getTenantRef(`users/${user.id}`);
      
      console.log("=== DEBUG FIREBASE SAVE ===");
      console.log("1. User ID / Path:", user?.id, "Full Path:", `users/${user.id}`);
      console.log("2. Payload yang akan dikirim:", dataToSave);
      console.log("===========================");

      await update(userRef, dataToSave);
      
      if (auth.currentUser && dataToSave.name) {
        await updateProfile(auth.currentUser, { displayName: dataToSave.name });
      }

      db.updateUser(user.id, dataToSave);
      login({ ...user, ...dataToSave });
      setConfirmProfile(false);
      toast.success("Profil personel berhasil diperbarui.");
      window.dispatchEvent(new Event("users_updated"));
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan perubahan ke server");
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.id) {
      toast.error("Gagal menyimpan: ID Pengguna tidak ditemukan.");
      return;
    }
    try {
      const userRef = getTenantRef(`users/${user.id}`);

      console.log("=== DEBUG FIREBASE SAVE ===");
      console.log("1. User ID / Path:", user?.id, "Full Path:", `users/${user.id}`);
      console.log("2. Payload yang akan dikirim:", accountData);
      console.log("===========================");

      await update(userRef, accountData);
      
      db.updateUser(user.id, accountData);
      login({ ...user, ...accountData });
      setConfirmAccount(false);
      toast.success("Kredensial login akun berhasil diperbarui.");
      window.dispatchEvent(new Event("users_updated"));
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan kredensial ke server");
    }
  };

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!auth.currentUser || !user?.id) {
      toast.error("Sesi tidak valid, harap login ulang.");
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const uid = auth.currentUser.uid;
      const fileRef = storageRef(storage, `avatars/${uid}`);
      
      await uploadBytes(fileRef, file);
      const newUrl = await getDownloadURL(fileRef);

      await updateProfile(auth.currentUser, { photoURL: newUrl });
      
      const userRef = getTenantRef(`users/${user.id}`);
      await update(userRef, { photoUrl: newUrl });

      db.updateUser(user.id, { photoUrl: newUrl });
      setPhotoBase64(newUrl);
      login({ ...user, photoUrl: newUrl });
      
      toast.success("Foto profil berhasil diperbarui!");
      window.dispatchEvent(new Event("users_updated"));
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Gagal mengunggah foto profil");
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
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

  const handlePrintCard = () => window.print();

  // ── Attendance data ────────────────────────────────────────
  const attendance = user ? db.getAttendance().filter((a) => a.userId === user.id) : [];
  const today = new Date();
  let startDate = subDays(today, 364);
  const startDay = startDate.getDay();
  startDate = subDays(startDate, startDay === 0 ? 6 : startDay - 1);
  const daysCount = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const days = Array.from({ length: daysCount }).map((_, i) => addDays(startDate, i));

  const showTeacherSections =
    user?.role === "guru" ||
    user?.role === "dosen" ||
    user?.role === "staf_sekolah" ||
    user?.role === "staf_kampus" ||
    user?.role === "kepala_sekolah";

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-2">
      {/* ── Profile card + tabs ── */}
      <div className="space-y-4">
        {/* Profile Summary Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-3 overflow-hidden border-4 border-slate-100">
            {(photoBase64 || user?.photoUrl) ? (
              <img src={photoBase64 || user?.photoUrl} alt="Foto Profil" className="w-full h-full object-cover" />
            ) : (
              <UserCircle size={72} className="text-slate-300" strokeWidth={1} />
            )}
          </div>
          <h3 className="text-sm font-black text-slate-800 leading-none mb-1">{user?.name}</h3>
          <p className="text-[10px] text-indigo-600 font-extrabold uppercase bg-indigo-50 border border-indigo-100 px-3 py-0.5 rounded-full">
            {user?.role === "kepala_sekolah" ? "KEPALA SEKOLAH / REKTOR" : (user?.role || "").replace("_", " ")}
          </p>
          <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${licenseConfig.badgeColor}`}>
            <Award size={12} className="shrink-0" />
            <span>{licenseConfig.name}</span>
          </div>
          <div className="w-full border-t border-gray-100 mt-4 pt-3 space-y-2 text-left text-[11px] text-gray-500">
            <div className="flex items-center gap-2">
              <Building size={13} className="text-gray-400 shrink-0" />
              <span className="truncate">{user?.opd || "-"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Award size={13} className="text-gray-400 shrink-0" />
              <span className="truncate">{user?.jabatan || "Fungsional Umum"}</span>
            </div>
          </div>
        </div>

        {/* Form Tabs */}
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Tab buttons */}
          <div className="flex border-b border-gray-100 px-3 overflow-x-auto scrollbar-none gap-0.5">
            {(["profil", "foto", "akun", "biometrik"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2.5 my-1.5 font-bold text-[11px] whitespace-nowrap transition-all duration-200 rounded-xl border flex-shrink-0 ${
                  activeTab === tab
                    ? "bg-white/60 border-white/80 text-slate-800 shadow-sm backdrop-blur-md"
                    : "bg-transparent border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab === "profil" ? "Biodata" : tab === "foto" ? "Pas Foto" : tab === "biometrik" ? "Wajah (Biometrik)" : "Akun & Sandi"}
              </button>
            ))}
            {showTeacherSections && (
              <>
                <button
                  onClick={() => setActiveTab("riwayat")}
                  className={`px-3 py-2.5 my-1.5 font-bold text-[11px] whitespace-nowrap transition-all duration-200 rounded-xl border flex-shrink-0 ${
                    activeTab === "riwayat"
                      ? "bg-white/60 border-white/80 text-slate-800 shadow-sm backdrop-blur-md"
                      : "bg-transparent border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Riwayat
                </button>
                <button
                  onClick={() => setActiveTab("kartu_qr")}
                  className={`px-3 py-2.5 my-1.5 font-bold text-[11px] whitespace-nowrap transition-all duration-200 rounded-xl border flex-shrink-0 ${
                    activeTab === "kartu_qr"
                      ? "bg-white/60 border-white/80 text-slate-800 shadow-sm backdrop-blur-md"
                      : "bg-transparent border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Kartu QR
                </button>
              </>
            )}
          </div>

          {/* Tab content */}
          <div className="p-4">
            {/* ── TAB: BIODATA ── */}
            {activeTab === "profil" && (
              <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
                {[
                  { label: "Nama Lengkap *", name: "name", type: "text", required: true },
                  { label: "ID Pegawai / NIP / NIDN / NIK", name: "nip", type: "text", placeholder: "Masukkan ID Pegawai" },
                  { label: "Lembaga Induk / Dinas / Yayasan", name: "opd", type: "text" },
                  { label: "Satuan Kerja", name: "satker", type: "text" },
                  { label: "Jabatan / Posisi", name: "jabatan", type: "text" },
                  { label: "No Telepon/WA", name: "phone", type: "text" },
                  { label: "Email", name: "email", type: "email", placeholder: "nama@email.com" },
                ].map((field) => (
                  <div key={field.name}>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      name={field.name}
                      value={(formData as any)[field.name]}
                      onChange={handleChange}
                      placeholder={(field as any).placeholder}
                      required={(field as any).required}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Jenis Kelamin *
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:border-indigo-300 focus:outline-none transition"
                  >
                    <option>Laki-laki</option>
                    <option>Perempuan</option>
                  </select>
                </div>
                {(user?.role === "guru" || user?.role === "dosen") && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-wide mb-1">
                        MaPel Utama 📚
                      </label>
                      <input
                        type="text"
                        name="mapelUtama"
                        value={formData.mapelUtama}
                        onChange={handleChange}
                        placeholder="Contoh: Matematika, IPA"
                        className="w-full px-3 py-2 border border-sky-200 bg-sky-50/30 rounded-xl text-xs focus:border-sky-400 focus:outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-wide mb-1">
                        MaPel Sertifikasi 🏅
                      </label>
                      <input
                        type="text"
                        name="mapelSertifikasi"
                        value={formData.mapelSertifikasi}
                        onChange={handleChange}
                        placeholder="Contoh: Matematika"
                        className="w-full px-3 py-2 border border-sky-200 bg-sky-50/30 rounded-xl text-xs focus:border-sky-400 focus:outline-none transition"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Alamat Rumah
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:border-indigo-300 focus:outline-none transition resize-none"
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-4 border-t border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-gray-500">
                    <input
                      type="checkbox"
                      checked={confirmProfile}
                      onChange={(e) => setConfirmProfile(e.target.checked)}
                      required
                      className="rounded border-slate-300 text-indigo-600 w-3.5 h-3.5"
                    />
                    <span>Konfirmasi kesesuaian data</span>
                  </label>
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-5 font-bold text-white text-xs rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-lg hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-200 whitespace-nowrap"
                  >
                    <Save size={13} /> Simpan
                  </button>
                </div>
              </form>
            )}

            {/* ── TAB: PAS FOTO ── */}
            {activeTab === "foto" && (
              <div className="flex flex-col items-center py-4 space-y-4">
                <input
                  type="file"
                  ref={photoInputRef}
                  accept="image/*"
                  onChange={handleUploadAvatar}
                  className="hidden"
                  disabled={isUploadingPhoto}
                />
                <div className="relative group">
                  <div className="w-28 h-28 rounded-full p-1.5 bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 shadow-xl flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center border-2 border-white">
                      {(photoBase64 || user?.photoUrl) ? (
                        <img src={photoBase64 || user?.photoUrl} alt="Foto Profil" className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle size={96} className="text-slate-300" />
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg border-2 border-white hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Camera size={15} />
                  </button>
                </div>
                <div className="text-center max-w-xs px-2">
                  <h4 className="font-extrabold text-slate-800 text-sm mb-1">
                    Pas Foto Resmi
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Unggah pas foto formal. Foto ini digunakan pada biodata, kartu QR, dan laporan resmi.
                  </p>
                </div>
                
                <div className="flex flex-col items-center justify-center gap-3 w-full max-w-xs pt-2">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black text-xs shadow-lg shadow-purple-500/30 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isUploadingPhoto ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Mengunggah...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={14} />
                        <span>Ubah Foto Profil</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── TAB: BIOMETRIK ── */}
            {activeTab === "biometrik" && (
              <BiometricEnrollment />
            )}

            {/* ── TAB: AKUN & SANDI ── */}
            {activeTab === "akun" && (
              <form onSubmit={handleSaveAccount} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={accountData.username}
                    onChange={handleAccountChange}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:border-indigo-300 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Sandi Baru <span className="text-rose-500 normal-case font-medium">(opsional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={accountData.password}
                      onChange={handleAccountChange}
                      placeholder="•••••"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:border-indigo-300 focus:outline-none pr-10 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-4 border-t border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] text-gray-500">
                    <input
                      type="checkbox"
                      checked={confirmAccount}
                      onChange={(e) => setConfirmAccount(e.target.checked)}
                      required
                      className="rounded border-slate-300 text-indigo-600 w-3.5 h-3.5"
                    />
                    <span>Konfirmasi kesesuaian sandi</span>
                  </label>
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-5 font-bold text-white text-xs rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-lg hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-200 whitespace-nowrap"
                  >
                    <Save size={13} /> Simpan Sandi
                  </button>
                </div>
              </form>
            )}

            {/* ── TAB: RIWAYAT PRESENSI ── */}
            {activeTab === "riwayat" && showTeacherSections && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-extrabold text-gray-800 text-[11px] uppercase tracking-wide">
                      Kalender Presensi Bulanan
                    </h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">Status kehadiran harian bulan terpilih</p>
                  </div>
                  <input
                    type="month"
                    value={historyMonth}
                    onChange={(e) => setHistoryMonth(e.target.value)}
                    className="px-2 py-1.5 border border-gray-200 rounded-xl font-bold bg-white text-[11px]"
                  />
                </div>
                <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 pb-2">
                  {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {(() => {
                    const [yearStr, monthStr] = historyMonth.split("-");
                    const year = parseInt(yearStr);
                    const month = parseInt(monthStr);
                    const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
                    const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
                    const daysInMonth = new Date(year, month, 0).getDate();
                    const grid = [];
                    for (let i = 0; i < offset; i++) {
                      grid.push(<div key={`e-${i}`} className="h-12 bg-gray-50 rounded-xl border border-dashed border-gray-200" />);
                    }
                    for (let d = 1; d <= daysInMonth; d++) {
                      const dateString = `${historyMonth}-${String(d).padStart(2, "0")}`;
                      const record = attendance.find((a) => a.date === dateString);
                      const dayOfWeek = new Date(year, month - 1, d).getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      let statusColor = "text-gray-400 bg-white border-gray-200";
                      let statusText = "T/K";
                      if (record) {
                        if (record.status === "Hadir") { statusColor = "text-emerald-700 bg-emerald-50 border-emerald-100"; statusText = "Hadir"; }
                        else if (record.status === "Terlambat") { statusColor = "text-amber-700 bg-amber-50 border-amber-100"; statusText = "Telat"; }
                        else if (record.status === "Izin") { statusColor = "text-blue-700 bg-blue-50 border-blue-100"; statusText = "Izin"; }
                        else if (record.status === "Sakit") { statusColor = "text-purple-700 bg-purple-50 border-purple-100"; statusText = "Sakit"; }
                        else if (record.status === "Alpha") { statusColor = "text-rose-700 bg-rose-50 border-rose-100"; statusText = "Alpha"; }
                      } else if (isWeekend) {
                        statusColor = "text-gray-400 bg-slate-50 border-slate-200";
                        statusText = "Libur";
                      }
                      grid.push(
                        <div key={`d-${d}`} className={`h-12 p-1.5 border rounded-xl flex flex-col justify-between text-left ${statusColor}`}>
                          <span className="font-extrabold text-[11px]">{d}</span>
                          <span className="text-[7px] font-black uppercase tracking-wide truncate">{statusText}</span>
                        </div>
                      );
                    }
                    return grid;
                  })()}
                </div>
              </div>
            )}

            {/* ── TAB: KARTU QR ── */}
            {activeTab === "kartu_qr" && showTeacherSections && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-gray-800 text-[11px] uppercase tracking-wide">
                      Kartu Presensi Digital
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Tunjukkan atau cetak sebagai kartu ID</p>
                  </div>
                  <button
                    onClick={handlePrintCard}
                    className="flex items-center gap-1.5 py-2 px-4 font-bold text-white text-xs rounded-xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-md active:scale-95 transition-all"
                  >
                    <Calendar size={12} /> Cetak
                  </button>
                </div>
                <div
                  id="print-card-area"
                  className="w-full bg-gradient-to-br from-emerald-800 to-emerald-950 rounded-2xl p-4 text-white flex flex-col justify-between shadow-lg relative overflow-hidden border border-emerald-700"
                >
                  <div className="absolute top-[-30px] right-[-30px] w-24 h-24 bg-white/5 rounded-full blur-xl" />
                  <div className="flex gap-2 items-center border-b border-white/20 pb-2 mb-3">
                    <img src={school.logoUrl || "logo.png"} alt="Logo" className="w-7 h-7 object-contain shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"; }} />
                    <div>
                      <h5 className="text-[9px] font-black uppercase">{yayasanName}</h5>
                      <p className="text-[7px] text-emerald-300">{school.name.toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-center">
                    <div className="w-14 h-18 rounded-lg overflow-hidden bg-white/10 border border-white/20 shrink-0 flex items-center justify-center">
                      {(photoBase64 || user?.photoUrl) ? (
                        <img src={photoBase64 || user?.photoUrl} alt="Foto" className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle size={40} className="text-white/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <h6 className="font-extrabold text-[10px] uppercase text-yellow-300 truncate">{user?.name}</h6>
                      <p className="text-[8px] text-slate-300">NIP: {user?.nip || "—"}</p>
                      <p className="text-[8px] text-slate-300 truncate">{user?.jabatan || "Posisi Kerja"}</p>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg shrink-0">
                      <QRCodeSVG
                        value={JSON.stringify({ type: "personal_qr", userId: user?.id, name: user?.name, nip: user?.nip })}
                        size={60}
                        imageSettings={personalLogoUrl ? { src: personalLogoUrl, x: undefined, y: undefined, height: 14, width: 14, excavate: true } : undefined}
                      />
                    </div>
                  </div>
                  <div className="border-t border-white/20 pt-1.5 mt-3 flex justify-between text-[7px] font-mono text-slate-400 uppercase">
                    <span>KARTU PRESENSI DIGITAL</span>
                    <span className="text-emerald-300 font-bold">ONLINE</span>
                  </div>
                </div>
                {/* Logo customizer */}
                <div className="no-print bg-white border border-slate-200 p-3.5 rounded-2xl space-y-2">
                  <h5 className="text-[11px] font-bold text-gray-800">Sematan Logo QR (Kustom)</h5>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePersonalLogoUpload}
                    className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  {personalLogoUrl && personalLogoUrl !== (school.logoUrl || "logo.png") && (
                    <button
                      onClick={() => {
                        const defaultLogo = school.logoUrl || "logo.png";
                        setPersonalLogoUrl(defaultLogo);
                        localStorage.removeItem(`qr_embedded_logo_personal_${user?.id}`);
                        toast.success("Logo dikembalikan ke bawaan sistem.");
                      }}
                      className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                    >
                      Hapus Logo Kustom
                    </button>
                  )}
                </div>
                <style>{`
                  @media print {
                    body * { visibility: hidden; }
                    #print-card-area, #print-card-area * { visibility: visible; }
                    #print-card-area { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%) scale(1.4); border: none !important; box-shadow: none !important; }
                    .no-print { display: none !important; }
                  }
                `}</style>
              </div>
            )}
          </div>
        </div>

        {/* ── Annual Heatmap (teacher only) ── */}
        {showTeacherSections && (
          <div className="bg-white rounded-3xl border border-gray-200 p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-black text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                <Calendar size={14} className="text-indigo-600" />
                Disiplin Pegawai (Tahun Berjalan)
              </h3>
              <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                {attendance.length} Hari
              </span>
            </div>
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[560px]">
                <div className="flex gap-2">
                  <div className="grid grid-flow-row gap-[4px] text-[9px] font-bold text-gray-400 text-right w-6 select-none">
                    {["Sen", "", "Rab", "", "Jum", "", "Min"].map((d, i) => (
                      <div key={i} className="h-3 flex items-center justify-end">{d}</div>
                    ))}
                  </div>
                  <div className="flex-1">
                    <div className="grid grid-flow-col gap-[4px]" style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}>
                      {days.map((day) => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const record = attendance.find((a) => a.date === dateStr);
                        let colorClass = "bg-slate-100";
                        if (record) {
                          if (record.status === "Hadir") colorClass = "bg-emerald-500";
                          else if (record.status === "Terlambat") colorClass = "bg-amber-400";
                          else if (record.status === "Izin") colorClass = "bg-blue-400";
                          else if (record.status === "Sakit") colorClass = "bg-purple-400";
                          else colorClass = "bg-rose-500";
                        }
                        return (
                          <div
                            key={dateStr}
                            className={`w-3 h-3 rounded-[2px] ${colorClass} cursor-help transition-colors`}
                            title={`${format(day, "EEE, dd MMM yyyy", { locale: localeID })}: ${record ? record.status : "T/K Keluar"}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-[9px] font-bold text-gray-400 justify-end">
                  {[["bg-emerald-500", "Hadir"], ["bg-amber-400", "Terlambat"], ["bg-blue-400", "Izin"], ["bg-purple-400", "Sakit"], ["bg-rose-500", "Alpha"]].map(([color, label]) => (
                    <div key={label} className="flex items-center gap-1">
                      <div className={`w-3 h-3 rounded-[2px] ${color}`} />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── TOMBOL KELUAR (LOGOUT) ── */}
      {onLogout && (
        <div className="pt-2 pb-4">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black text-sm rounded-2xl border-2 border-red-700 shadow-xl shadow-red-600/25 transition-all duration-200 active:scale-[0.98]"
          >
            <LogOut size={18} />
            Keluar dari Akun
          </button>
          <p className="text-center text-[10px] text-gray-400 mt-2">
            Anda akan dikembalikan ke halaman login
          </p>
        </div>
      )}
    </div>
  );
}
