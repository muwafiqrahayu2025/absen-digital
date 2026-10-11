import React, { useState } from "react";
import { useLicense } from "../hooks/useLicense";
import { activateByToken } from "../lib/license";
import { useAuth } from "./AuthContext";
import { db } from "../lib/db";
import toast from "react-hot-toast";
import { Sparkles, Key, CheckCircle2, Award, Users, Calendar } from "lucide-react";

export function PackageActivationCard({ isModal = false }: { isModal?: boolean }) {
  const { config, isExpired, daysRemaining } = useLicense();
  const { user } = useAuth();
  const [tokenInput, setTokenInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      toast.error("Harap masukkan token aktivasi paket!");
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      const school: any = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
      const res = activateByToken(
        tokenInput.trim(),
        school.name || "Instansi / Sekolah / Kampus",
        user?.name || "Administrator"
      );
      setIsSubmitting(false);
      if (res.success) {
        toast.success(res.message);
        setTokenInput("");
        window.dispatchEvent(new Event("license_updated"));
      } else {
        toast.error(res.message);
      }
    }, 400);
  };

  return (
    <div
      className={
        isModal
          ? "text-white text-left font-sans my-2"
          : "bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-indigo-500/30 shadow-xl relative overflow-hidden animate-fade-in text-left font-sans my-5 transition-all"
      }
    >
      {!isModal && (
        <>
          <div className="absolute -right-12 -top-12 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-12 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-3 max-w-xl flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-400/20 text-amber-300 text-xs font-black uppercase tracking-wider border border-amber-400/30 shadow-2xs">
              <Award size={13} className="shrink-0" /> Status Lisensi: {config.name}
            </span>
            {isExpired ? (
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold uppercase inline-flex items-center gap-1 shadow-2xs">
                <Calendar size={12} /> Kedaluwarsa
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold uppercase inline-flex items-center gap-1 shadow-2xs">
                <CheckCircle2 size={12} /> {daysRemaining !== null ? `Aktif (${daysRemaining} Hari Lagi)` : "Aktif Selamanya"}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs">
              <Users size={12} /> Kuota: {config.maxUsersString || `${config.maxUsers} Personel`}
            </span>
          </div>

          <div>
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
              🔑 Aktivasi &amp; Upgrade Lisensi Paket Instansi / Sekolah
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-1">
              Masukkan kode token aktivasi resmi (misal: <code className="bg-slate-800/80 px-1.5 py-0.5 rounded text-amber-300 font-mono text-xs">FULL-2026-X1</code> atau <code className="bg-slate-800/80 px-1.5 py-0.5 rounded text-amber-300 font-mono text-xs">INFAQ-2026-V1</code>) untuk membuka kuota personel dan seluruh fitur penuh secara instan.
            </p>
          </div>
        </div>

        {(user?.role === "admin" || user?.role === "developer" || isModal) && (
          <form onSubmit={handleActivate} className="w-full lg:w-auto flex-1 max-w-md shrink-0">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Key size={16} />
                </div>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Ketik Token Aktivasi..."
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-slate-800/90 border border-slate-600 focus:border-purple-400 rounded-xl text-xs sm:text-sm font-mono text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 uppercase tracking-widest transition shadow-inner"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 py-2.5 sm:py-3 px-5 sm:px-6 font-bold text-white text-xs sm:text-sm rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border border-purple-400/40 shadow-lg shadow-purple-500/20 active:scale-98 transition-all duration-200 shrink-0 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Sparkles size={15} className="shrink-0" />
                <span>{isSubmitting ? "Memproses..." : "Aktifkan Paket"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
