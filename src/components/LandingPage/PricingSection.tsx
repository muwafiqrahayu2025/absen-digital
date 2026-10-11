import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles, CheckCircle2 } from 'lucide-react';

interface PricingSectionProps {
  onOpenCheckout: () => void;
}

export function PricingSection({ onOpenCheckout }: PricingSectionProps) {
  return (
    <section id="harga" className="py-16 md:py-24 px-6 max-w-7xl mx-auto space-y-10 md:space-y-16">
      <div className="text-center max-w-3xl mx-auto space-y-3 mb-8 md:mb-16">
        <h2 className="text-xs font-black uppercase tracking-widest text-blue-600">Investasi Transparan</h2>
        <p className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Pilih Paket Sesuai Kebutuhan</p>
        <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
          Mulai dengan uji coba gratis, lalu lanjutkan dengan kontribusi operasional (infaq) seikhlasnya. Tanpa tarif kaku, tanpa beban anggaran bulanan.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 lg:gap-12 max-w-4xl mx-auto items-stretch">

        {/* Tier 1: TRIAL */}
        <div className="bg-white rounded-[2rem] p-6 lg:p-10 border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col relative hover:border-blue-400 transition-all duration-300 h-full">
          <div className="space-y-5 flex-1">
            <div>
              <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">Tahap Penjajakan Awal</span>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 mt-4">Paket Uji Coba</h3>
              <p className="text-[11px] md:text-xs text-slate-500 mt-1.5 font-medium leading-relaxed">Eksplorasi seluruh fitur utama secara gratis.</p>
            </div>
            <div className="py-4 border-y border-slate-100">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Rp 0</span>
                <span className="text-[10px] md:text-xs font-bold text-slate-400">/ 14 Hari</span>
              </div>
            </div>
            <ul className="space-y-3.5 text-[11px] md:text-xs text-slate-600 font-medium">
              <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 shrink-0 mt-0.5" /> <span>Masa uji coba penuh <strong>14 Hari</strong>.</span></li>
              <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 shrink-0 mt-0.5" /> <span>Kapasitas hingga <strong>10 Pegawai</strong>.</span></li>
              <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 shrink-0 mt-0.5" /> <span>Geofencing GPS &amp; Validasi Wajah.</span></li>
              <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 shrink-0 mt-0.5" /> <span>Keamanan Otentikasi WhatsApp 2FA.</span></li>
            </ul>
          </div>
          <Link to="/login" className="w-full py-3.5 mt-8 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-black text-xs text-center shadow-sm transition-all block">
            Mulai Uji Coba
          </Link>
        </div>

        {/* Tier 2: PREMIUM */}
        <div className="bg-slate-900 text-white rounded-[2rem] p-6 lg:p-10 border-2 border-amber-400 shadow-2xl flex flex-col relative md:scale-105 mt-6 md:mt-0 transition-all duration-300 h-full overflow-visible">

          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 px-4 py-1.5 rounded-full text-[10px] font-black uppercase shadow-lg flex items-center gap-1.5 whitespace-nowrap z-20">
            <Sparkles size={14} className="animate-spin-slow" /> Pilihan Terpopuler
          </div>

          <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl" />
            <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
          </div>

          <div className="space-y-5 flex-1 relative z-10 pt-2 md:pt-0">
            <div>
              <span className="px-3 py-1.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase tracking-wider border border-amber-400/20">Kontribusi Sukarela</span>
              <h3 className="text-2xl md:text-3xl font-black text-white mt-4">Akses Premium</h3>
              <p className="text-[11px] md:text-xs text-slate-300 mt-1.5 font-medium leading-relaxed">Kapasitas total untuk menunjang kedisiplinan penuh.</p>
            </div>
            <div className="py-4 border-y border-slate-700/80">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400 tracking-tight">Infaq Seikhlasnya</span>
              </div>
              <p className="text-[10px] md:text-[11px] text-amber-200/80 font-medium mt-2 leading-relaxed">
                *Alokasi dana difokuskan untuk pemeliharaan server awan.
              </p>
            </div>
            <ul className="space-y-3.5 text-[11px] md:text-xs text-slate-200 font-medium pb-4">
              <li className="flex items-start gap-3"><CheckCircle2 size={16} className="text-amber-400 shrink-0 mt-0.5" /> <span><strong>Kapasitas Pegawai Tanpa Batas</strong>.</span></li>
              <li className="flex items-start gap-3"><CheckCircle2 size={16} className="text-amber-400 shrink-0 mt-0.5" /> <span>Masa aktif <strong>1 Tahun</strong> (Dapat diperpanjang).</span></li>
              <li className="flex items-start gap-3"><CheckCircle2 size={16} className="text-amber-400 shrink-0 mt-0.5" /> <span>Akses eksklusif ke seluruh modul.</span></li>
              <li className="flex items-start gap-3"><CheckCircle2 size={16} className="text-amber-400 shrink-0 mt-0.5" /> <span>Ekspor Laporan Resmi (Excel &amp; PDF).</span></li>
              <li className="flex items-start gap-3"><CheckCircle2 size={16} className="text-amber-400 shrink-0 mt-0.5" /> <span>Jalur Bantuan Prioritas (WA Langsung).</span></li>
            </ul>
          </div>

          <button
            onClick={onOpenCheckout}
            className="relative z-10 w-full py-3.5 mt-8 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs text-center shadow-xl shadow-amber-500/20 transition-all block"
          >
            Aktifkan Paket Premium
          </button>
        </div>

      </div>
    </section>
  );
}
