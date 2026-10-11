import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLicense } from "../../hooks/useLicense";
import { activateNewLicense, PLAN_CONFIG } from "../../lib/license";
import { LicensePlan } from "../../types";
import { PackageActivationCard } from "../../components/PackageActivationCard";
import { useAuth } from "../../components/AuthContext";
import toast from "react-hot-toast";
import {
  Award,
  Key,
  RefreshCw,
  Gift,
  Calendar,
  Users as UsersIcon,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeID } from "date-fns/locale";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

export function ManageLicenses() {
  useDocumentTitle("Lisensi & Paket Instansi");
  const { user } = useAuth();
  const school: any = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
  const { license, config, daysRemaining } = useLicense();
  
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get('tab') as "license" | "activate" | "clients" | null;

  const [activeTab, setActiveTab] = useState<"license" | "activate" | "clients">(tabParam || "license");

  useEffect(() => {
    if (tabParam && ["license", "activate", "clients"].includes(tabParam)) {
      setActiveTab(tabParam as any);
    } else if (!tabParam) {
      setActiveTab("license");
    }
  }, [tabParam]);

  const handleTabChange = (tab: "license" | "activate" | "clients") => {
    setActiveTab(tab);
    if (tab === "license") {
      navigate("/admin/licenses");
    } else {
      navigate(`/admin/licenses?tab=${tab}`);
    }
  };
  const [actPlan, setActPlan] = useState<LicensePlan>("hibah");
  const [actSchoolName, setActSchoolName] = useState(school.name || "");
  const [actNotes, setActNotes] = useState("");

  const [tenants, setTenants] = useState<any[]>([]);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [editLicenseType, setEditLicenseType] = useState("trial");
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  React.useEffect(() => {
    if (user?.role !== 'developer' && user?.tenantId !== 'GLOBAL') return;
    const unsub = onSnapshot(collection(db, "tenants"), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setTenants(data);
    });
    return () => unsub();
  }, [user]);

  const handleUpdateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    setIsUpdating(true);
    try {
      const tenantRef = doc(db, "tenants", selectedTenant.id);
      
      let newStatus = "active";
      if (editExpiryDate) {
        const expiry = new Date(editExpiryDate);
        if (expiry < new Date()) {
          newStatus = "expired";
        }
      }

      await updateDoc(tenantRef, {
        "license.type": editLicenseType,
        "license.expiryDate": editExpiryDate || null,
        "license.status": newStatus,
        status: newStatus
      });
      toast.success("Berhasil memperbarui lisensi klien!");
      setIsManageModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Gagal memperbarui lisensi.");
    } finally {
      setIsUpdating(false);
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
      handleTabChange("license");
    } catch {
      toast.error("Gagal mengaktifkan lisensi baru.");
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
            <Award size={14} /> {user?.role === 'developer' || user?.role === 'superadmin' ? 'SaaS Developer Console' : 'Informasi Lisensi Instansi'}
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            Lisensi &amp; Aktivasi
          </h2>
          <p className="text-slate-400 mt-1 text-sm font-medium">
            Kelola Lisensi Klien dan Paket Subscription SaaS.
          </p>
        </div>
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
                  onClick={() => handleTabChange("activate")}
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
      {activeTab === "activate" && user?.role === 'developer' && (
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

      {/* Tab 3: Kelola Semua Klien */}
      {activeTab === "clients" && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-4 rounded-tl-xl">Nama Instansi</th>
                  <th className="px-6 py-4">Paket Saat Ini</th>
                  <th className="px-6 py-4">Masa Aktif</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 rounded-tr-xl text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map(tenant => {
                  const licType = tenant.license?.type || tenant.subscriptionPlan || "trial";
                  const expiry = tenant.license?.expiryDate || tenant.subscriptionExpiry;
                  const status = tenant.license?.status || tenant.status || "active";
                  return (
                    <tr key={tenant.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{tenant.name || tenant.id}</td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold capitalize">
                          {licType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {expiry ? format(new Date(expiry), "dd MMM yyyy", { locale: localeID }) : "Selamanya"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold capitalize ${status === 'active' || status === 'Aktif' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {status === 'active' || status === 'Aktif' ? 'Aktif' : 'Kedaluwarsa'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => {
                            setSelectedTenant(tenant);
                            setEditLicenseType(licType);
                            setEditExpiryDate(expiry ? new Date(expiry).toISOString().split('T')[0] : "");
                            setIsManageModalOpen(true);
                          }}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          Kelola Lisensi
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-medium">Memuat data klien...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manage Modal */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800">Kelola Lisensi Klien</h3>
              <button onClick={() => setIsManageModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleUpdateLicense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Instansi</label>
                <input type="text" readOnly value={selectedTenant?.name || ""} className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Jenis Paket</label>
                <select 
                  value={editLicenseType} 
                  onChange={(e) => setEditLicenseType(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="trial">Trial</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="hibah">Hibah</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Batas Waktu Berlaku</label>
                <input 
                  type="date" 
                  value={editExpiryDate} 
                  onChange={(e) => setEditExpiryDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                />
                <p className="text-[10px] text-slate-400 mt-1">Kosongkan jika paket berlaku selamanya (Lifetime).</p>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsManageModalOpen(false)} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer">Batal</button>
                <button type="submit" disabled={isUpdating} className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors disabled:opacity-70 cursor-pointer">
                  {isUpdating ? "Memperbarui..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
