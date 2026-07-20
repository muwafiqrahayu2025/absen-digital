import React, { useState, useEffect } from "react";
import { db } from "../../lib/db";
import { useAuth } from "../../components/AuthContext";
import { useLicense } from "../../hooks/useLicense";
import { useGlobalSettings } from "../../hooks/useGlobalSettings";
import { activateNewLicense, PLAN_CONFIG } from "../../lib/license";
import { LicensePlan, DeviceSessionLog } from "../../types";
import { useNavigate } from "react-router-dom";
import { PackageActivationCard } from "../../components/PackageActivationCard";
import { idbStorage } from "../../lib/idbStorage";
import { detectUserDevice, recordDeviceSessionLog } from "../../lib/deviceDetection";
import toast from "react-hot-toast";
import {
  Save,
  Terminal,
  ShieldAlert,
  Zap,
  Database,
  Award,
  Key,
  RefreshCw,
  Gift,
  Calendar,
  Users as UsersIcon,
  CheckCircle2,
  Settings,
  Sparkles,
  Check,
  X,
  Activity,
  ShieldCheck,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeID } from "date-fns/locale";

export function DeveloperConsole() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const school = db.getSchool();
  const { license, config, isExpired, daysRemaining } = useLicense();
  const { settings: globalSettings, updateSettings } = useGlobalSettings();
  
  const [activeTab, setActiveTab] = useState<"license" | "activate" | "api" | "device_logs" | "kiosk_config" | "danger">("license");
  const [deviceLogs, setDeviceLogs] = useState<DeviceSessionLog[]>([]);
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

  useEffect(() => {
    // Muat log perangkat setiap kali komponen di-mount atau diperbarui
    const loadLogs = () => {
      const logs = db.getDeviceSessionLogs();
      setDeviceLogs(logs);
    };
    loadLogs();
    window.addEventListener("device_session_logs_updated", loadLogs);
    return () => window.removeEventListener("device_session_logs_updated", loadLogs);
  }, []);

  // CONDITIONAL RENDERING KETAT: Hanya role 'developer' ('alpha_project') yang boleh membuka dan melihat panel rahasia ini
  if (user?.role !== 'developer') {
    return (
      <div className="bg-white rounded-3xl p-10 border border-rose-200 shadow-xl text-center max-w-lg mx-auto my-12 animate-fade-in">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600 mb-4">
          <ShieldAlert size={36} />
        </div>
        <h3 className="text-xl font-extrabold text-slate-800">Akses Internal Ditolak</h3>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          Halaman dan fitur <b>SaaS Developer Console &amp; Log Perangkat</b> ini bersifat rahasia dan HANYA dapat diakses oleh pengguna dengan role <b>System Developer Dev (`developer`)</b>.
        </p>
      </div>
    );
  }

  // Form API State
  const [apiFormData, setApiFormData] = useState({
    whatsappApiKey: school.whatsappApiKey || "",
    gasWebAppUrl: school.gasWebAppUrl || "",
    waGatewayProvider: school.waGatewayProvider || "wablas",
    wablasServerUrl: school.wablasServerUrl || "https://smg.wablas.com",
    geminiApiKey: (school as any).geminiApiKey || localStorage.getItem('abdi_gemini_api_key') || "",
  });
  const [demoVideoUrl, setDemoVideoUrl] = useState("");
  
  useEffect(() => {
    if (globalSettings?.demo_video_url !== undefined) {
      setDemoVideoUrl(globalSettings.demo_video_url);
    }
  }, [globalSettings]);

  const [isSavingApi, setIsSavingApi] = useState(false);
  const [isSavingDisplay, setIsSavingDisplay] = useState(false);

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
      await updateSettings({ demo_video_url: formattedUrl });
      toast.success("Konfigurasi Tampilan Berhasil Diperbarui!");
    } catch {
      toast.error("Gagal menyimpan konfigurasi tampilan.");
    } finally {
      setIsSavingDisplay(false);
    }
  };

  // Form Activation State
  const [actPlan, setActPlan] = useState<LicensePlan>("hibah");
  const [actSchoolName, setActSchoolName] = useState(school.name || "");
  const [actNotes, setActNotes] = useState("");

  const handleSaveApi = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingApi(true);
    try {
      const updatedSchool = {
        ...school,
        ...apiFormData,
      };
      db.setSchool(updatedSchool);
      if (apiFormData.geminiApiKey) {
        localStorage.setItem('abdi_gemini_api_key', apiFormData.geminiApiKey);
      } else {
        localStorage.removeItem('abdi_gemini_api_key');
      }
      toast.success("Konfigurasi API Berhasil Diperbarui!");
    } catch {
      toast.error("Gagal menyimpan konfigurasi.");
    } finally {
      setIsSavingApi(false);
    }
  };

  const handleActivateLicense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actSchoolName) {
      toast.error("Nama Instansi/Sekolah/Kampus wajib diisi.");
      return;
    }
    try {
      const newLic = activateNewLicense(
        actPlan,
        actSchoolName,
        user?.name || "Developer",
        actNotes
      );
      toast.success(`Berhasil mengaktifkan ${PLAN_CONFIG[actPlan].name}! Kunci: ${newLic.licenseKey}`);
      setActiveTab("license");
    } catch {
      toast.error("Gagal mengaktifkan lisensi baru.");
    }
  };

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

  const selectedPlanConfig = PLAN_CONFIG[actPlan];

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header Title */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-xs font-black uppercase tracking-wider mb-3">
            <Terminal size={14} /> SaaS Developer Console
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            Pusat Kendali Platform ABDI
          </h2>
          <p className="text-slate-400 mt-1 text-sm font-medium">
            Kelola Lisensi Klien, Paket Subscription SaaS, dan Inject Kunci API Global.
          </p>
        </div>
        <div className="z-10 flex items-center">
          <button
            onClick={() => {
              localStorage.setItem('abdi_dev_mode_landing', 'true');
              navigate('/');
              toast.success("🛠️ Mode Developer Landing Page Aktif!");
            }}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg hover:scale-105 transition-all flex items-center gap-2"
          >
            ✏️ Edit Live Konten Landing Page
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        <button
          onClick={() => setActiveTab("license")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "license"
              ? "bg-slate-900 text-white shadow-md"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Award size={18} className={activeTab === "license" ? "text-amber-400" : ""} />
          Status Lisensi Aktif
        </button>
        <button
          onClick={() => setActiveTab("activate")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "activate"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Key size={18} className={activeTab === "activate" ? "text-slate-950" : ""} />
          Aktivasi / Hibah Lisensi
        </button>
        <button
          onClick={() => setActiveTab("api")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "api"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Settings size={18} />
          Konfigurasi API
        </button>
        <button
          onClick={() => setActiveTab("device_logs")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "device_logs"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Activity size={18} />
          Log Perangkat &amp; Sesi
        </button>
        <button
          onClick={() => setActiveTab("kiosk_config")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "kiosk_config"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Monitor size={18} />
          Live TV Kiosk Background
        </button>
        <button
          onClick={() => setActiveTab("danger")}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "danger"
              ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
              : "text-rose-600 hover:bg-rose-50"
          }`}
        >
          <Zap size={18} />
          Danger Zone
        </button>
      </div>

      {/* Tab 1: Status Lisensi Aktif */}
      {activeTab === "license" && (
        <div className="space-y-6">
          <PackageActivationCard />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-6">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Instansi Klien Terdaftar</span>
                <h3 className="text-2xl font-black text-slate-800 mt-1">{license.schoolName}</h3>
              </div>
              <div className={`px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-wider self-start sm:self-auto border ${config.badgeColor}`}>
                {config.name}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
                  <Calendar size={14} /> Diaktifkan Pada
                </div>
                <p className="text-sm font-black text-slate-800">
                  {format(new Date(license.activatedAt), "dd MMMM yyyy", { locale: localeID })}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Oleh: {license.activatedBy}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
                  <Calendar size={14} /> Masa Berlaku
                </div>
                <p className="text-sm font-black text-slate-800">
                  {license.expiresAt
                    ? format(new Date(license.expiresAt), "dd MMMM yyyy", { locale: localeID })
                    : "Selamanya (Lifetime)"}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{config.durationString}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
                  <UsersIcon size={14} /> Batas Personel
                </div>
                <p className="text-sm font-black text-slate-800">{config.maxUsersString}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Guru & Staf Aktif</p>
              </div>
            </div>

            {/* License Key Box */}
            <div className="bg-slate-900 rounded-2xl p-5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Kunci Lisensi Terenkripsi</span>
                <span className="font-mono text-lg font-bold tracking-widest text-amber-400 select-all">{license.licenseKey}</span>
              </div>
              <button
                onClick={() => setActiveTab("activate")}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs transition-all flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw size={14} /> Ganti / Upgrade Lisensi
              </button>
            </div>

            {license.notes && (
              <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 text-xs text-amber-800 leading-relaxed font-medium">
                <strong>Catatan Lisensi:</strong> {license.notes}
              </div>
            )}
          </div>

          {/* Right Column: Features Summary */}
          <div className="lg:col-span-4 bg-slate-900 text-white rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center gap-2.5 mb-6 text-amber-400 border-b border-slate-800 pb-4">
                <Award size={22} />
                <h4 className="font-bold text-base">Hak Akses Fitur Aktif</h4>
              </div>

              <div className="space-y-3.5 text-xs font-medium">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Absen GPS Geofencing</span>
                  <Check size={16} className="text-emerald-400" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Stasiun Scan QR Code</span>
                  <Check size={16} className="text-emerald-400" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Manajemen Izin & Cuti</span>
                  <Check size={16} className="text-emerald-400" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Notifikasi WhatsApp API</span>
                  {config.whatsappNotif ? <Check size={16} className="text-emerald-400" /> : <X size={16} className="text-rose-500" />}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Ekspor Laporan PDF</span>
                  {config.exportPdf ? <Check size={16} className="text-emerald-400" /> : <X size={16} className="text-rose-500" />}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Ekspor Laporan Excel</span>
                  {config.exportExcel ? <Check size={16} className="text-emerald-400" /> : <X size={16} className="text-rose-500" />}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">AI Analytics Insights</span>
                  {config.aiAnalytics ? <Check size={16} className="text-emerald-400" /> : <X size={16} className="text-rose-500" />}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Dukungan Multi-Instansi / Sekolah / Kampus</span>
                  {config.multiSchool ? <Check size={16} className="text-emerald-400" /> : <X size={16} className="text-rose-500" />}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400">
              {daysRemaining !== null ? (
                <p>Sisa waktu: <span className="text-amber-400 font-bold">{daysRemaining} hari lagi</span></p>
              ) : (
                <p className="text-emerald-400 font-bold flex items-center gap-1"><Sparkles size={13} /> Akses Permanen Seumur Hidup</p>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Tab 2: Aktivasi / Hibah Lisensi Baru */}
      {activeTab === "activate" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4 text-slate-800">
              <Key className="text-amber-500" size={24} />
              <div>
                <h3 className="font-black text-xl">Suntik Kunci Lisensi Baru</h3>
                <p className="text-xs text-slate-500">Pilih paket dan aktifkan langsung di browser klien ini.</p>
              </div>
            </div>

            <form onSubmit={handleActivateLicense} className="space-y-5">
              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2">
                  Pilih Paket Penjualan / Hibah
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['trial', 'full', 'hibah'] as LicensePlan[]).map((p) => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setActPlan(p)}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative ${
                        actPlan === p
                          ? "border-amber-500 bg-amber-50/50 ring-2 ring-amber-500"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-sm text-slate-800">{PLAN_CONFIG[p].name}</span>
                        {p === 'hibah' && <Gift size={16} className="text-amber-500" />}
                        {p === 'full' && <Sparkles size={16} className="text-blue-500" />}
                      </div>
                      <p className="text-[11px] font-bold text-slate-500">{PLAN_CONFIG[p].priceString}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{PLAN_CONFIG[p].maxUsersString} &bull; {PLAN_CONFIG[p].durationString}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2">
                  Nama Resmi Instansi / Sekolah / Kampus Klien
                </label>
                <input
                  type="text"
                  required
                  value={actSchoolName}
                  onChange={(e) => setActSchoolName(e.target.value)}
                  placeholder="Contoh: SMAN 1 / SMPN 1 / Universitas Unggulan"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2">
                  Catatan Internal Developer (Opsional)
                </label>
                <input
                  type="text"
                  value={actNotes}
                  onChange={(e) => setActNotes(e.target.value)}
                  placeholder="Contoh: Gratis Hibah CSR untuk Yayasan Al-Barokah"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-2xl shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles size={18} /> Aktifkan Lisensi Sekarang
                </button>
              </div>
            </form>
          </div>

          {/* Preview Selected Plan */}
          <div className="lg:col-span-5 bg-slate-900 text-white rounded-3xl p-6 md:p-8 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">Preview Paket Terpilih</span>
              <h4 className="text-2xl font-black text-white">{selectedPlanConfig.name}</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">{selectedPlanConfig.description}</p>

              <div className="my-6 pt-6 border-t border-slate-800 space-y-3 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Harga Paket:</span>
                  <strong className="text-amber-400 font-bold">{selectedPlanConfig.priceString}</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Masa Aktif:</span>
                  <strong className="text-white">{selectedPlanConfig.durationString}</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Kapasitas Personel:</span>
                  <strong className="text-white">{selectedPlanConfig.maxUsersString}</strong>
                </div>
              </div>

              {actPlan === 'hibah' && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 leading-relaxed">
                  💡 <strong>INFO HIBAH:</strong> Paket Hibah tidak akan pernah ditampilkan di Landing Page publik situs web. Hanya bisa disuntikkan secara rahasia oleh Anda via panel ini.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Konfigurasi API */}
      {activeTab === "api" && (
        <>
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden max-w-4xl">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
            <ShieldAlert className="text-indigo-400" size={24} />
            <div>
              <h3 className="font-bold text-white text-lg">Konfigurasi API Notifikasi &amp; Server</h3>
              <p className="text-xs text-slate-400">Hubungan ke WhatsApp Gateway Fonnte &amp; Google Apps Script.</p>
            </div>
          </div>

          <form onSubmit={handleSaveApi} className="space-y-5 relative z-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                  Penyedia WhatsApp Gateway
                </label>
                <select
                  value={apiFormData.waGatewayProvider}
                  onChange={(e) => setApiFormData({ ...apiFormData, waGatewayProvider: e.target.value as any })}
                  className="w-full px-4 py-3 border border-slate-700 rounded-xl text-sm font-bold text-amber-400 bg-slate-950 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="wablas">Wablas API v2</option>
                  <option value="fonnte">Fonnte API</option>
                </select>
              </div>

              {apiFormData.waGatewayProvider === 'wablas' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                    URL Server Wablas
                  </label>
                  <input
                    type="text"
                    value={apiFormData.wablasServerUrl}
                    onChange={(e) => setApiFormData({ ...apiFormData, wablasServerUrl: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-700 rounded-xl text-sm font-mono text-green-400 bg-slate-950 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://smg.wablas.com"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                {apiFormData.waGatewayProvider === 'wablas' ? 'Wablas API Key (Token.Secret)' : 'WhatsApp Token (Fonnte API)'}
              </label>
              <input
                type="text"
                value={apiFormData.whatsappApiKey}
                onChange={(e) =>
                  setApiFormData({ ...apiFormData, whatsappApiKey: e.target.value })
                }
                className="w-full px-4 py-3 border border-slate-700 rounded-xl text-sm font-mono text-green-400 bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-700"
                placeholder={apiFormData.waGatewayProvider === 'wablas' ? 'token...secret' : 'Masukkan Token Fonnte...'}
              />
              {apiFormData.waGatewayProvider === 'wablas' && (
                <p className="text-[11px] text-amber-400 mt-1.5 font-medium">
                  💡 Format Wablas digabung dengan titik: <code className="bg-slate-800 px-1 py-0.5 rounded text-white">token.secret</code> (Contoh: <code className="bg-slate-800 px-1 py-0.5 rounded text-white">f1nsc3bxt...09s1E.ZT5frc0v</code>)
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                URL Web App Google Apps Script (Email)
              </label>
              <input
                type="text"
                value={apiFormData.gasWebAppUrl}
                onChange={(e) =>
                  setApiFormData({ ...apiFormData, gasWebAppUrl: e.target.value })
                }
                className="w-full px-4 py-3 border border-slate-700 rounded-xl text-sm font-mono text-green-400 bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-700"
                placeholder="https://script.google.com/macros/s/.../exec"
              />
            </div>

            <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 space-y-2">
              <label className="block text-xs font-black text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={16} className="text-purple-400 animate-pulse" />
                API Key Google Gemini LLM (Otak AI Agent Live Chat)
              </label>
              <input
                type="text"
                value={apiFormData.geminiApiKey}
                onChange={(e) =>
                  setApiFormData({ ...apiFormData, geminiApiKey: e.target.value })
                }
                className="w-full px-4 py-3 border border-purple-500/50 rounded-xl text-sm font-mono text-purple-200 bg-slate-950 focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder:text-slate-600"
                placeholder="Contoh: AIzaSyD..."
              />
              <p className="text-[11px] text-purple-300 leading-relaxed">
                💡 Masukkan API Key gratis dari Google AI Studio. Jika terisi, Live CS Helpdesk di Landing Page otomatis dijawab oleh LLM Google Gemini 1.5 Flash yang cerdas dan profesional!
              </p>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSavingApi}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-70 cursor-pointer"
              >
                <Save size={18} />
                {isSavingApi ? "Menyimpan..." : "Simpan Konfigurasi API"}
              </button>
            </div>
          </form>
        </div>

        {/* Card Baru: Konfigurasi Tampilan */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden max-w-4xl mt-6">
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
                💡 URL YouTube untuk ditampilkan di Landing Page publik. Anda dapat memasukkan link YouTube biasa, dan sistem akan otomatis mengubahnya menjadi format embed. Biarkan kosong untuk menyembunyikan video.
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
        </>
      )}

      {/* Tab: Log Perangkat & Sesi */}
      {activeTab === "device_logs" && (
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black uppercase tracking-wider mb-2">
                <ShieldCheck size={14} /> Telemetry &amp; Anti-Cheat Audit
              </div>
              <h3 className="text-xl font-extrabold text-slate-800">
                Log Perangkat &amp; Jejak Sesi Pengguna
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
                Rekam jejak otomatis menggunakan <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-emerald-600">navigator.userAgent</code> / <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-emerald-600">userAgentData</code> untuk mendeteksi sistem operasi, tipe peramban, dan kategori perangkat demi investigasi indikasi kecurangan (seperti login admin di HP atau emulasi palsu).
              </p>
            </div>
            <button
              onClick={() => {
                setDeviceLogs(db.getDeviceSessionLogs());
                toast.success("Log perangkat diperbarui!");
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer shrink-0 self-start sm:self-center"
            >
              <RefreshCw size={14} /> Muat Ulang Log
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-inner">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white border-b border-slate-800 uppercase tracking-wider text-[11px] font-black">
                  <th className="py-3.5 px-4">Waktu &amp; Aksi</th>
                  <th className="py-3.5 px-4">Pengguna</th>
                  <th className="py-3.5 px-4 text-center">Kategori</th>
                  <th className="py-3.5 px-4">Sistem Operasi &amp; Browser</th>
                  <th className="py-3.5 px-4">Detail Telemetri</th>
                  <th className="py-3.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {deviceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-normal">
                      Belum ada log aktivitas atau sesi perangkat tercatat.
                    </td>
                  </tr>
                ) : (
                  deviceLogs.map((log) => {
                    const dev = log.device || { os: "Unknown OS", browser: "Unknown Browser", category: "Desktop" };
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900">
                            {format(new Date(log.timestamp || Date.now()), "dd MMM yyyy, HH:mm:ss", { locale: localeID })}
                          </div>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${
                            log.action === 'LOGIN' ? 'bg-blue-100 text-blue-700' :
                            log.action === 'PRESENSI_IN' ? 'bg-emerald-100 text-emerald-700' :
                            log.action === 'PRESENSI_OUT' ? 'bg-amber-100 text-amber-700' :
                            log.action === 'SECURITY_FLAG' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{log.userName || "Unknown User"}</div>
                          <div className="text-[11px] text-slate-400 capitalize">{log.userRole || "klien"} ({log.userId || "N/A"})</div>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                            dev.category === 'Mobile' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                            dev.category === 'Tablet' ? 'bg-cyan-100 text-cyan-700 border border-cyan-200' :
                            'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {dev.category === 'Mobile' && <Smartphone size={14} />}
                            {dev.category === 'Tablet' && <Tablet size={14} />}
                            {dev.category === 'Desktop' && <Monitor size={14} />}
                            {dev.category || 'Desktop'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{dev.os}</div>
                          <div className="text-slate-500">{dev.browser}</div>
                          {dev.screenResolution && dev.screenResolution !== 'Unknown' && (
                            <div className="text-[10px] text-slate-400 mt-0.5">Layar: {dev.screenResolution}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="text-slate-700 line-clamp-2" title={log.details || ""}>
                            {log.details || "Aktivitas standar terverifikasi"}
                          </div>
                          {dev.rawUserAgent && (
                            <div className="text-[10px] text-slate-400 truncate mt-0.5 font-mono max-w-[200px]" title={dev.rawUserAgent}>
                              UA: {dev.rawUserAgent}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            log.status === 'SUSPICIOUS' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            log.status === 'BLOCKED' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {log.status || 'SUCCESS'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-400 italic pt-2">
            <span>🛡️ Data log ini disimpan di memori dan Firebase (hanya dapat dilihat oleh System Developer Dev).</span>
            <span>Total Log Tersimpan: <b>{deviceLogs.length}</b> sesi</span>
          </div>
        </div>
      )}

      {/* Tab: Konfigurasi Background Live TV Kiosk */}
      {activeTab === "kiosk_config" && (
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
      )}

      {/* Tab 4: Danger Zone */}
      {activeTab === "danger" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
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
      )}
    </div>
  );
}
