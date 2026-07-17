import React from "react";
import { PackageActivationCard } from "../../components/PackageActivationCard";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { ShieldCheck, Award, Zap, CheckCircle2, HelpCircle, Layers } from "lucide-react";
import { db } from "../../lib/db";

export function ManageLicenses() {
  useDocumentTitle("Lisensi & Paket Instansi");
  const school = db.getSchool();

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-xs font-black uppercase tracking-wider mb-2">
            <Award size={14} /> Master Data &bull; Langganan Layanan
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
            Manajemen Lisensi &amp; Paket Instansi
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Kelola aktivasi lisensi resmi, pantau kuota pengguna instansi (<strong className="text-indigo-600">{school.name}</strong>), serta lakukan upgrade paket untuk membuka seluruh fitur eksekutif tanpa batas.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs shrink-0">
          <ShieldCheck className="text-emerald-500" size={18} />
          <span>Status Lisensi: <strong className="text-slate-900 uppercase">{school.licenseStatus || "PRO ACTIVE"}</strong></span>
        </div>
      </div>

      {/* Komponen Utama Activation Card yang dipindahkan dari Beranda */}
      <div className="max-w-5xl mx-auto">
        <PackageActivationCard />
      </div>

      {/* Informasi Perbandingan & Keunggulan Lisensi */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 max-w-5xl mx-auto">
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
            <Zap size={24} />
          </div>
          <h3 className="font-extrabold text-slate-800 text-base">Sinkronisasi Realtime Cloud</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Data absensi, pengajuan cuti, dan koordinat GPS geofencing tersinkron langsung ke server cloud berkinerja tinggi 24/7.
          </p>
          <ul className="space-y-2 pt-2 border-t border-slate-100 text-xs font-bold text-slate-700">
            <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-500 shrink-0" /> Kecepatan akses seketika</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-500 shrink-0" /> Pencadangan data harian</li>
          </ul>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-black">
            <Award size={24} />
          </div>
          <h3 className="font-extrabold text-slate-800 text-base">AI Executive Analytics</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Akses penuh ke modul analisis kecerdasan buatan (Google Gemini) yang memberikan wawasan eksekutif dan rekomendasi kedisiplinan.
          </p>
          <ul className="space-y-2 pt-2 border-t border-slate-100 text-xs font-bold text-slate-700">
            <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-500 shrink-0" /> Narasi briefing otomatis</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-500 shrink-0" /> Deteksi anomali absensi</li>
          </ul>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
            <ShieldCheck size={24} />
          </div>
          <h3 className="font-extrabold text-slate-800 text-base">Prioritas Dukungan Teknis</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Dukungan penuh dari tim teknis ABDI untuk penyesuaian geofence, migrasi master data, serta pemeliharaan sistem berkala.
          </p>
          <ul className="space-y-2 pt-2 border-t border-slate-100 text-xs font-bold text-slate-700">
            <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-500 shrink-0" /> Respons cepat via WhatsApp</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-500 shrink-0" /> Jaminan uptime 99.9%</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
