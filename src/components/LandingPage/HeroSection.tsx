import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

interface HeroSectionProps {
  landingConfig: any;
  quickLinks?: {title: string, url: string}[];
}

export function HeroSection({ landingConfig, quickLinks = [] }: HeroSectionProps) {
  return (
    <>
      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 lg:pt-24 lg:pb-32 px-6 overflow-hidden bg-gradient-to-b from-blue-50/60 via-white to-slate-50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">

          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100/80 text-blue-700 text-[10px] sm:text-xs font-extrabold border border-blue-200 shadow-sm">
              <Zap size={14} className="text-amber-500 fill-amber-500" /> Presensi Digital Multi-Akses Berbasis Awan
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.15]">
              {landingConfig?.heroTitleText || 'Efisiensi Waktu & Kehadiran dengan'} <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">{landingConfig?.heroTitleHighlight || 'Sistem Terpadu'}</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
              {landingConfig?.heroSubtitle || 'Solusi absensi digital yang akurat dengan deteksi lokasi, terhubung langsung antara cabang dan kantor pusat secara real-time.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
              <Link to="/login" className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-black shadow-xl shadow-blue-600/30 hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2.5">
                🚀 Mulai Uji Coba Gratis <ArrowRight size={16} />
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-[11px] sm:text-xs font-bold text-slate-500 pt-3">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Pengaturan Cepat</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Tanpa Kartu Kredit</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Bebas Kontrak</span>
            </div>
          </div>

          <div className="lg:col-span-5 relative flex items-center justify-center mt-6 lg:mt-0">
            <div className="absolute w-64 h-64 sm:w-72 sm:h-72 bg-blue-400/20 rounded-full blur-3xl -z-10 animate-pulse" />
            <div className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 relative">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 sm:mb-5">
                <div className="flex items-center gap-2 sm:gap-3">
                  <img src="/logo-abdi.png" alt="Logo" className="w-8 h-8 sm:w-9 sm:h-9 object-contain" />
                  <div><h4 className="font-black text-slate-900 text-xs sm:text-sm">ABDI Absensi Digital</h4><p className="text-[9px] sm:text-[10px] text-slate-400 font-bold">Sinkronisasi Kehadiran &bull; Instansi Terpadu</p></div>
                </div>
                <span className="px-2 py-1 sm:px-2.5 sm:py-1 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-[9px] sm:text-[10px] flex items-center gap-1 shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Terhubung</span>
              </div>
              <div className="relative rounded-2xl overflow-hidden mb-4 shadow-inner h-[280px] md:h-[360px] border border-slate-200 bg-slate-100">
                <iframe title="Google Maps Geofence" src={`https://maps.google.com/maps?q=Bintang%20Kembar%20MDL-525&z=18&output=embed&t=m`} className="absolute inset-0 w-full h-full border-0 pointer-events-none" allowFullScreen loading="lazy"></iframe>
                <div className="absolute inset-0 bg-blue-900/5 pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-40 sm:h-48 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent pointer-events-none" />
                <div className="relative z-10 h-full flex flex-col justify-end p-3">
                  <div className="bg-slate-900/85 backdrop-blur-md rounded-xl p-3 border border-slate-700/50 shadow-2xl text-center space-y-2">
                    <div><p className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Titik Koordinat Valid</p><p className="text-[10px] sm:text-[11px] font-black text-emerald-400 font-mono mt-0.5">Dalam Radius 48m</p></div>
                    <div className="w-full py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-[9px] sm:text-[10px] shadow-lg flex items-center justify-center gap-1.5"><ShieldCheck size={14} /> ABSENSI MASUK BERHASIL</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 text-center">
                <div className="bg-slate-50 p-2 sm:p-3 rounded-xl border border-slate-100"><p className="text-[9px] sm:text-[10px] text-slate-400 font-bold">Validasi Geofence</p><p className="text-[11px] sm:text-xs font-black text-slate-800">Aktif & Terlindungi</p></div>
                <div className="bg-slate-50 p-2 sm:p-3 rounded-xl border border-slate-100"><p className="text-[9px] sm:text-[10px] text-slate-400 font-bold">Laporan Rekapitulasi</p><p className="text-[11px] sm:text-xs font-black text-blue-600">Siap Diunduh</p></div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Stats Strip ── */}
      <section className="bg-blue-900 text-white py-8 md:py-12 px-6 shadow-md">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 text-center md:divide-x divide-blue-800/60">
          <div className="p-2">
            <p className="text-2xl sm:text-3xl md:text-4xl font-black text-white">Multi-Akses</p>
            <p className="text-[10px] sm:text-xs text-blue-200 font-bold mt-1">Integrasi Kantor Pusat & Cabang</p>
          </div>
          <div className="p-2">
            <p className="text-2xl sm:text-3xl md:text-4xl font-black text-amber-300">Otomatisasi</p>
            <p className="text-[10px] sm:text-xs text-blue-200 font-bold mt-1">Sinkronisasi Kehadiran Luring</p>
          </div>
          <div className="p-2">
            <p className="text-2xl sm:text-3xl md:text-4xl font-black text-emerald-300">Portabilitas</p>
            <p className="text-[10px] sm:text-xs text-blue-200 font-bold mt-1">Lancar di Ponsel & Komputer</p>
          </div>
          <div className="p-2">
            <p className="text-2xl sm:text-3xl md:text-4xl font-black text-sky-300">Validitas</p>
            <p className="text-[10px] sm:text-xs text-blue-200 font-bold mt-1">Geotagging & Keamanan Lokasi</p>
          </div>
        </div>
      </section>
    </>
  );
}
