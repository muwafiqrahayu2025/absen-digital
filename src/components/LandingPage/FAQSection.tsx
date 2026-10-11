import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Calendar, UserCheck, Send, Check, MessageCircle } from 'lucide-react';

const faqs = [
  {
    q: "Apakah memerlukan spesifikasi server atau HP khusus?",
    a: "Sama sekali tidak. ABDI dirancang sangat ringan berbasis cloud. Aplikasi dapat berjalan lancar di HP spesifikasi menengah maupun peramban web standar tanpa membebani perangkat."
  },
  {
    q: "Bagaimana jika koneksi internet di sekolah sedang terputus?",
    a: "Sistem dilengkapi fitur sinkronisasi offline. Staf tetap dapat menekan tombol absensi, dan data akan otomatis terkirim ke server pusat saat koneksi internet pulih kembali."
  },
  {
    q: "Apakah ada tagihan paksa setelah Uji Coba 14 Hari berakhir?",
    a: "Tidak ada tagihan tersembunyi atau pemotongan otomatis. Anda tidak perlu memasukkan kartu kredit. Setelah masa uji coba, Bapak/Ibu bebas menentukan apakah ingin beralih ke Paket Full via infaq sukarela."
  },
  {
    q: "Apakah format laporan siap digunakan untuk audit Dinas / BOSP?",
    a: "Tentu. Rekapitulasi Excel dan PDF telah diformat resmi, lengkap dengan kop instansi, rekap jam keterlambatan, cuti, dan kolom tanda tangan pimpinan."
  }
];

export function FAQSection() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  
  // Lead form state
  const [leadName, setLeadName] = useState('');
  const [leadSchool, setLeadSchool] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadSize, setLeadSize] = useState('30-100');
  const [isLeadSubmitted, setIsLeadSubmitted] = useState(false);

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName || !leadSchool || !leadPhone) return;
    setIsLeadSubmitted(true);
  };

  return (
    <>
      <section id="faq" className="py-16 md:py-24 px-6 bg-slate-100/80 border-t border-slate-200">
        <div className="max-w-4xl mx-auto space-y-10 md:space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-blue-600">Pusat Bantuan</h2>
            <p className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Pertanyaan Umum Pengguna Baru</p>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {faqs.map((f, i) => (
              <div key={i} className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden transition-all">
                <button onClick={() => setActiveFaq(activeFaq === i ? null : i)} className="w-full p-5 sm:p-6 text-left font-black text-slate-900 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <span className="text-xs sm:text-sm md:text-base leading-snug">{f.q}</span>
                  <ChevronDown size={18} className={`text-blue-600 transition-transform shrink-0 ${activeFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {activeFaq === i && (<div className="px-5 sm:px-6 pb-5 sm:pb-6 text-[11px] sm:text-xs md:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4 font-medium animate-fade-in">{f.a}</div>)}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORM LEAD GENERATION ── */}
      <section id="jadwaldemo" className="py-16 md:py-24 px-6 bg-gradient-to-b from-slate-100 to-blue-50 border-t border-slate-200">
        <div className="max-w-5xl mx-auto grid md:grid-cols-12 gap-8 md:gap-12 items-center bg-white rounded-3xl p-6 md:p-8 lg:p-14 shadow-2xl border border-slate-200/80">

          <div className="md:col-span-6 space-y-5 sm:space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-extrabold text-[10px] sm:text-xs">
              <Calendar size={14} /> JADWALKAN PRESENTASI
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Butuh Panduan Langsung Dari Ahli Kami?
            </h2>
            <p className="text-[11px] sm:text-xs md:text-sm text-slate-600 leading-relaxed font-medium">
              Lengkapi formulir di samping. Tim ahli kami akan segera mengirimkan tautan akses simulasi interaktif ke WhatsApp Bapak/Ibu dalam kurun waktu kurang dari 5 menit.
            </p>
            <div className="space-y-3 pt-2 text-[11px] sm:text-xs font-extrabold text-slate-700">
              <div className="flex items-center gap-2.5"><UserCheck size={16} className="text-blue-600 shrink-0" /> Pembebasan Biaya Pemindahan Data Awal Guru</div>
              <div className="flex items-center gap-2.5"><UserCheck size={16} className="text-blue-600 shrink-0" /> Analisa Kalkulasi Otomatis Rekap Keterlambatan</div>
              <div className="flex items-center gap-2.5"><UserCheck size={16} className="text-blue-600 shrink-0" /> Tanya Jawab Evaluasi Kebijakan Khas Instansi</div>
            </div>
          </div>

          <div className="md:col-span-6">
            {!isLeadSubmitted ? (
              <form onSubmit={handleLeadSubmit} className="space-y-4 bg-slate-50 p-5 sm:p-6 lg:p-8 rounded-2xl border border-slate-200 shadow-inner text-[11px] sm:text-xs font-bold text-slate-700">
                <h4 className="text-sm sm:text-base font-black text-slate-900 mb-2">Formulir Penjadwalan Demo WA</h4>
                <div>
                  <label className="block mb-1.5">Nama Lengkap &amp; Jabatan Pimpinan</label>
                  <input type="text" required placeholder="Contoh: Drs. H. Budi Santoso, M.Pd." value={leadName} onChange={(e) => setLeadName(e.target.value)} className="w-full p-2.5 sm:p-3 rounded-xl bg-white border border-slate-300 focus:border-blue-600 outline-none font-medium" />
                </div>
                <div>
                  <label className="block mb-1.5">Nama Lengkap Lingkungan Pendidikan</label>
                  <input type="text" required placeholder="Contoh: SMA / SMP Terpadu" value={leadSchool} onChange={(e) => setLeadSchool(e.target.value)} className="w-full p-2.5 sm:p-3 rounded-xl bg-white border border-slate-300 focus:border-blue-600 outline-none font-medium" />
                </div>
                <div>
                  <label className="block mb-1.5">Nomor WhatsApp Valid Aktif</label>
                  <input type="tel" required placeholder="Contoh: 081123456789" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} className="w-full p-2.5 sm:p-3 rounded-xl bg-white border border-slate-300 focus:border-blue-600 outline-none font-mono font-bold" />
                </div>
                <div>
                  <label className="block mb-1.5">Kapasitas Staf Pegawai</label>
                  <select value={leadSize} onChange={(e) => setLeadSize(e.target.value)} className="w-full p-2.5 sm:p-3 rounded-xl bg-white border border-slate-300 focus:border-blue-600 outline-none font-medium">
                    <option value="<30">Kurang dari 30 Guru &amp; Staf</option>
                    <option value="30-100">Kisar Normal 30 - 100 Staf</option>
                    <option value=">100">Lebih Dari 100 Anggota Pegawai</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-3 sm:py-4 mt-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2">
                  <Send size={16} /> Jadwalkan Simulasi Sekarang
                </button>
                <p className="text-[9px] sm:text-[10px] text-slate-400 text-center font-medium mt-2">🔒 Privasi data Bapak/Ibu sepenuhnya terbebas dari ancaman Spam.</p>
              </form>
            ) : (
              <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-6 sm:p-8 text-center space-y-4 animate-fade-in">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg"><Check size={32} className="sm:w-9 sm:h-9" /></div>
                <h4 className="text-lg sm:text-xl font-black text-slate-900">Validasi Formulir Berhasil!</h4>
                <p className="text-[11px] sm:text-xs text-slate-600 font-medium leading-relaxed">
                  Kami mengapresiasi partisipasi Bapak/Ibu <strong>{leadName}</strong> dari <strong>{leadSchool}</strong>. Kredensial masuk ke sistem demonstrasi interaktif telah diproses dan akan segera mendarat di WhatsApp <strong>{leadPhone}</strong>.
                </p>
                <a href={`https://wa.me/6282297585638?text=Halo%20Tim%20ABDI,%20saya%20${leadName}%20dari%20${leadSchool}%20baru%20saja%20mengisi%20form%20minta%20demo.`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center w-full sm:w-auto gap-2 px-5 sm:px-6 py-3 rounded-full bg-[#25D366] text-white font-black text-[10px] sm:text-xs shadow-md hover:scale-105 transition-transform">
                  <MessageCircle size={16} /> Akses Layanan via WhatsApp
                </a>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ── Big Pricing / CTA Box ── */}
      <section className="py-16 md:py-20 px-6 max-w-6xl mx-auto">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-8 sm:p-10 md:p-16 text-center text-white space-y-6 md:space-y-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="space-y-3 sm:space-y-4 max-w-3xl mx-auto relative z-10">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight">Siap Memulai Transformasi Kedisiplinan Instansi Anda?</h2>
            <p className="text-xs sm:text-sm md:text-base text-blue-100 font-medium leading-relaxed">
              Jejaki efisiensi infrastruktur aplikasi kami. Rasakan kemudahan manajemen pemantauan integritas secara mutlak hari ini juga tanpa paksaan biaya kaku.
            </p>
          </div>
          <div className="pt-2 relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login" className="w-full sm:w-auto px-8 py-3.5 sm:py-4 rounded-full bg-white text-blue-700 hover:bg-blue-50 text-xs sm:text-sm font-black shadow-2xl transition-all hover:scale-105 flex items-center justify-center gap-2">
              🎁 Klaim Uji Coba Gratis Sekarang &rarr;
            </Link>
          </div>
          <p className="text-[9px] sm:text-[11px] text-blue-200 font-bold px-4">Autentikasi Akses Instan &bull; Tanpa Kartu Kredit &bull; Bantuan Prioritas Berkelanjutan</p>
        </div>
      </section>
    </>
  );
}
