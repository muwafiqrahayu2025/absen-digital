import React from 'react';
import { Laptop, Video } from 'lucide-react';

interface DemoTabsSectionProps {
  landingConfig: any;
}

function formatYouTubeUrl(url: string): string | null {
  if (!url) return null;
  const regex = /(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  if (!match) return null;
  return `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1&loop=1&playlist=${match[1]}`;
}

export function DemoTabsSection({ landingConfig }: DemoTabsSectionProps) {
  return (
    <>
      <section id="demo" className="py-16 md:py-24 px-6 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto space-y-8 md:space-y-12 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
              <Laptop size={14} /> Video Demo Sistem
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">Kenyamanan Pengelolaan Instansi</h2>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">
              Tonton video demonstrasi berikut untuk melihat betapa mudahnya mengelola presensi dengan platform kami.
            </p>
          </div>

          <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden select-none text-left p-2 sm:p-4 mt-6">
            {landingConfig?.youtubeUrl ? (
              <div className="relative pb-[56.25%] h-0 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800">
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src={formatYouTubeUrl(landingConfig.youtubeUrl) ?? ''}
                  title="Video Demo"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center text-slate-500 bg-slate-900 rounded-2xl border border-slate-800 p-6 text-center">
                <Video size={48} className="mb-4 opacity-50" />
                <h3 className="text-lg font-bold">Video Demo Segera Hadir</h3>
                <p className="text-sm mt-2 opacity-80">Video demonstrasi sedang dipersiapkan dan akan segera tersedia.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Cara Kerja 3 Langkah ── */}
      <section id="carakerja" className="py-16 md:py-24 px-6 bg-slate-100/70 border-y border-slate-200">
        <div className="max-w-6xl mx-auto space-y-10 md:space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-blue-600">Pelaksanaan Praktis</h2>
            <p className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Kesiapan Platform Terhitung Menit</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-md border border-slate-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-lg">1</div>
              <h4 className="font-black text-slate-900 text-base md:text-lg">Pengaturan Lokasi Inti</h4>
              <p className="text-[11px] sm:text-xs text-slate-600 font-medium">Buat akun instansi dan tentukan koordinat pusat gedung beserta radius toleransi kehadiran GPS.</p>
            </div>
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-md border border-slate-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-lg">2</div>
              <h4 className="font-black text-slate-900 text-base md:text-lg">Penyebaran Akses Pegawai</h4>
              <p className="text-[11px] sm:text-xs text-slate-600 font-medium">Sistem mendaftarkan profil staf. Pimpinan cukup membagikan tautan aplikasi ke grup komunikasi staf internal.</p>
            </div>
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-md border border-slate-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-lg">3</div>
              <h4 className="font-black text-slate-900 text-base md:text-lg">Laporan Terpusat Otomatis</h4>
              <p className="text-[11px] sm:text-xs text-slate-600 font-medium">Staf melakukan presensi via ponsel masing-masing. Hasil pemantauan langsung direkap sempurna ke meja admin.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
