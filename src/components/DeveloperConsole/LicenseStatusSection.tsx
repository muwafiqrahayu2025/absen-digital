import React from "react";
import { format } from "date-fns";
import { id as localeID } from "date-fns/locale";
import { Calendar, Users as UsersIcon, Award, Check, X, Sparkles, RefreshCw } from "lucide-react";
import { useLicense } from "../../hooks/useLicense";
import { PackageActivationCard } from "../PackageActivationCard";

export function LicenseStatusSection({ setActiveTab }: { setActiveTab: (tab: any) => void }) {
  const { license, config, daysRemaining } = useLicense();

  return (
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
  );
}
