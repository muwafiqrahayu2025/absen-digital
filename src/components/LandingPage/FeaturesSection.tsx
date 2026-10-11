import React from 'react';
import { MapPin, QrCode, ShieldCheck, Clock, FileText, Smartphone } from 'lucide-react';

export function FeaturesSection() {
  return (
    <section id="fitur" className="py-16 md:py-24 px-6 max-w-7xl mx-auto space-y-10 md:space-y-16">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-blue-600">Modul Operasional Lengkap</h2>
        <p className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Fasilitas Pendukung Manajemen Kinerja</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 md:gap-8">
        <div className="bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 text-white p-6 md:p-8 rounded-3xl border border-indigo-500/30 shadow-2xl space-y-4 md:col-span-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] sm:text-xs font-black uppercase tracking-wider">
                🌐 Ekosistem Laporan Terpusat
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight leading-tight">
                Pemantauan Berjenjang & Cadangan Luring Otomatis
              </h3>
              <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed font-medium">
                Aplikasi ABDI memfasilitasi monitoring absensi yang terstruktur dari instansi induk hingga ke seluruh unit kerja. Dilengkapi teknologi <b>Penyimpanan Luring Terenkripsi</b> yang menampung data absensi secara lokal di perangkat ketika kehilangan sinyal internet, dan menyinkronkannya seketika saat koneksi kembali stabil.
              </p>
            </div>
            <div className="flex flex-row gap-3 shrink-0 w-full md:w-auto">
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 text-center flex-1 md:flex-none">
                <p className="text-[9px] sm:text-[10px] font-bold text-indigo-200 uppercase">Penggunaan Daya</p>
                <p className="text-base sm:text-lg font-black text-amber-300">Sangat Ringan</p>
                <p className="text-[8px] sm:text-[9px] text-white/70">Aman untuk HP Standar</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 text-center flex-1 md:flex-none">
                <p className="text-[9px] sm:text-[10px] font-bold text-indigo-200 uppercase">Sinkronisasi</p>
                <p className="text-base sm:text-lg font-black text-emerald-300">Otomatis</p>
                <p className="text-[8px] sm:text-[9px] text-white/70">Bebas Kendala Sinyal</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:border-blue-300 transition-all space-y-4 group">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
            <MapPin size={24} className="md:w-7 md:h-7" />
          </div>
          <h3 className="text-base md:text-lg font-black text-slate-900">Validasi Geofencing</h3>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Sistem mendeteksi letak koordinat pegawai berdasarkan batas wilayah yang diatur, dilengkapi penangkal Lokasi Palsu (Fake GPS).
          </p>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:border-indigo-300 transition-all space-y-4 group">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm">
            <QrCode size={24} className="md:w-7 md:h-7" />
          </div>
          <h3 className="text-base md:text-lg font-black text-slate-900">Anjungan Pemindai Lobi</h3>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Manfaatkan tablet atau PC di area lobi sebagai stasiun pemindai QR Code untuk mempermudah presensi staf secara cepat dan akurat.
          </p>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:border-emerald-300 transition-all space-y-4 group">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-sm">
            <ShieldCheck size={24} className="md:w-7 md:h-7" />
          </div>
          <h3 className="text-base md:text-lg font-black text-slate-900">Keamanan WhatsApp OTP</h3>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Akses akun dilindungi oleh kata sandi dinamis (OTP) yang dikirimkan langsung ke nomor WhatsApp resmi demi mencegah pencurian data.
          </p>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:border-purple-300 transition-all space-y-4 group">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-sm">
            <Clock size={24} className="md:w-7 md:h-7" />
          </div>
          <h3 className="text-base md:text-lg font-black text-slate-900">Manajemen Jam Kerja</h3>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Konfigurasi komprehensif terkait toleransi jam kedatangan, jadwal bergilir (shift), hingga pemotongan durasi keterlambatan pegawai otomatis.
          </p>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:border-sky-300 transition-all space-y-4 group">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors shadow-sm">
            <FileText size={24} className="md:w-7 md:h-7" />
          </div>
          <h3 className="text-base md:text-lg font-black text-slate-900">Ekspor Laporan Audit</h3>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Unduh rekap presensi bulanan lengkap dengan tata letak resmi instansi (Excel & PDF) hanya dalam satu klik praktis.
          </p>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:border-amber-300 transition-all space-y-4 group">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors shadow-sm">
            <Smartphone size={24} className="md:w-7 md:h-7" />
          </div>
          <h3 className="text-base md:text-lg font-black text-slate-900">Sentralisasi Cuti Pegawai</h3>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Alur persetujuan pengajuan absen (sakit/izin) yang dilengkapi dengan fasilitas unggah bukti dokumen langsung dari perangkat staf.
          </p>
        </div>
      </div>
    </section>
  );
}
