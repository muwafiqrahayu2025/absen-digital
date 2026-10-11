import React, { useState } from "react";
import { Key, Gift, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { activateNewLicense, PLAN_CONFIG } from "../../lib/license";
import { LicensePlan } from "../../types";
import { db } from "../../lib/db";
import { useAuth } from "../AuthContext";

export function LicenseActivationSection({ setActiveTab }: { setActiveTab: (tab: any) => void }) {
  const { user } = useAuth();
  const school: any = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
  const [actPlan, setActPlan] = useState<LicensePlan>("hibah");
  const [actSchoolName, setActSchoolName] = useState(school.name || "");
  const [actNotes, setActNotes] = useState("");

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

  const selectedPlanConfig = PLAN_CONFIG[actPlan];

  return (
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
  );
}
