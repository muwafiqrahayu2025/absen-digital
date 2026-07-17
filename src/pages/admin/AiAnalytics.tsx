import React from "react";
import { AiExecutiveBriefing } from "../../components/AiExecutiveBriefing";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Award, Sparkles, TrendingUp, Users, CalendarCheck, ShieldAlert, BarChart3, ArrowUpRight } from "lucide-react";
import { db } from "../../lib/db";

export function AiAnalytics() {
  useDocumentTitle("AI Analytics & Executive Briefing");
  const school = db.getSchool();
  const attendance = db.getAttendance();
  const users = db.getUsers();

  // Hitung ringkasan cepat untuk header kartu
  const todayStr = new Date().toISOString().split("T")[0];
  const todayRecords = attendance.filter((a) => a.date === todayStr);
  const totalHadir = todayRecords.filter((a) => a.status === "Hadir" || a.status === "Terlambat").length;
  const totalIzin = todayRecords.filter((a) => a.status === "Izin" || a.status === "Sakit" || a.status === "Cuti Tahunan").length;
  const totalAlpha = todayRecords.filter((a) => a.status === "Alpha").length;
  const totalPegawai = users.filter((u) => u.role !== "admin" && u.role !== "developer").length;
  const persentaseKehadiran = totalPegawai > 0 ? Math.round((totalHadir / totalPegawai) * 100) : 0;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 text-xs font-black uppercase tracking-wider mb-2">
            <Sparkles size={14} className="text-amber-500 animate-spin-slow" /> Intelligence Dashboard &bull; Google Gemini AI
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <span>AI Executive Briefing &amp; Analytics</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Pusat analisis kedisiplinan berbasis kecerdasan buatan untuk pimpinan eksekutif <strong className="text-indigo-600">{school.name}</strong>. Dapatkan ringkasan otomatis, rekomendasi kebijakan, serta deteksi tren kehadiran pegawai secara komprehensif.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-3 rounded-2xl shadow-lg shadow-indigo-500/25 shrink-0">
          <Award size={22} className="text-amber-300 shrink-0" />
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider opacity-80">Indeks Kedisiplinan Hari Ini</div>
            <div className="text-xl font-black">{persentaseKehadiran}% <span className="text-xs font-normal opacity-90">({totalHadir}/{totalPegawai} Hadir)</span></div>
          </div>
        </div>
      </div>

      {/* Kartu Mini Status Cepat AI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black shrink-0">
            <CalendarCheck size={22} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block uppercase">Hadir Terverifikasi</span>
            <span className="text-lg font-black text-slate-800">{totalHadir} <span className="text-xs font-medium text-slate-500">Pegawai</span></span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black shrink-0">
            <TrendingUp size={22} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block uppercase">Izin / Sakit / Cuti</span>
            <span className="text-lg font-black text-slate-800">{totalIzin} <span className="text-xs font-medium text-slate-500">Pengajuan</span></span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black shrink-0">
            <ShieldAlert size={22} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block uppercase">Tanpa Keterangan (Alpha)</span>
            <span className="text-lg font-black text-slate-800">{totalAlpha} <span className="text-xs font-medium text-slate-500">Pegawai</span></span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black shrink-0">
            <BarChart3 size={22} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block uppercase">Total Staf Aktif</span>
            <span className="text-lg font-black text-slate-800">{totalPegawai} <span className="text-xs font-medium text-slate-500">Terdaftar</span></span>
          </div>
        </div>
      </div>

      {/* Komponen Utama AiExecutiveBriefing yang dipindahkan dari Beranda */}
      <div className="max-w-6xl mx-auto pt-2">
        <AiExecutiveBriefing />
      </div>
    </div>
  );
}
