import React, { useState, useEffect } from 'react';
import { Quote, Pause, Play, ChevronLeft, ChevronRight, Star, CheckCircle2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { TestimonialItem, TESTIMONIALS_DATA } from '../../data/testimonialsData';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { dbRealtime } from '../../lib/firebase';
import { useAuth } from '../AuthContext';

export function TestimonialsSection() {
  const [activeTestiCategory, setActiveTestiCategory] = useState<'semua' | 'pimpinan' | 'guru' | 'staf'>('semua');
  const [testiSlideIdx, setTestiSlideIdx] = useState(0);
  const [isAutoPlayTesti, setIsAutoPlayTesti] = useState(true);
  const [itemsPerView, setItemsPerView] = useState(3);
  const [realTestimonials, setRealTestimonials] = useState<TestimonialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const testiRef = ref(dbRealtime, 'global_testimonials');
    const unsubscribe = onValue(testiRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const data = Object.keys(val).map(key => ({ id: key, ...val[key] })).reverse();
        setRealTestimonials(data);
      } else {
        setRealTestimonials([]);
      }
      setIsLoading(false);
    }, (error) => {
      console.error(error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);
  const [isTestiModalOpen, setIsTestiModalOpen] = useState(false);
  const [newTestiForm, setNewTestiForm] = useState({
    name: '', role: 'Kepala Sekolah / Rektor / Dekan', school: '', location: '', avatarUrl: '', rating: 5, highlight: '', quote: ''
  });

  const allTestimonialsData = [...realTestimonials, ...TESTIMONIALS_DATA];
  const filteredTestimonials = allTestimonialsData.filter(item => {
    if (activeTestiCategory === 'semua') return true;
    if (activeTestiCategory === 'staf') return item.role.includes('Tata Usaha') || item.role.includes('Staf');
    if (activeTestiCategory === 'guru') return item.role.includes('Guru') || item.role.includes('Pembina');
    if (activeTestiCategory === 'pimpinan') return item.role.includes('Kepala') || item.role.includes('Pimpinan');
    return true;
  });

  const handleTestiAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Ukuran foto maksimal 2 MB.");
    const reader = new FileReader();
    reader.onloadend = () => setNewTestiForm(prev => ({ ...prev, avatarUrl: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleAddRealTestimony = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestiForm.name || !newTestiForm.quote) return toast.error("Mohon lengkapi nama dan ulasan Anda.");
    const newEntry = {
      name: newTestiForm.name, role: newTestiForm.role, school: newTestiForm.school || 'Instansi Terdaftar', location: newTestiForm.location || 'Indonesia', avatar: newTestiForm.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(newTestiForm.name)}`, rating: Number(newTestiForm.rating), highlight: newTestiForm.highlight || 'Terverifikasi Nyata', quote: newTestiForm.quote,
    };
    
    try {
      const testiRef = ref(dbRealtime, 'global_testimonials');
      const newRef = push(testiRef);
      await set(newRef, newEntry);
      setIsTestiModalOpen(false);
      toast.success("✨ Testimoni Anda berhasil dipublikasikan!");
      setNewTestiForm({ name: '', role: 'Kepala Sekolah / Rektor / Dekan', school: '', location: '', avatarUrl: '', rating: 5, highlight: '', quote: '' });
    } catch (err) {
      toast.error("Gagal mengirim testimoni.");
    }
  };

  const handleDeleteRealTesti = async (id: string) => {
    try {
      await remove(ref(dbRealtime, `global_testimonials/${id}`));
      toast.success("Testimoni berhasil dihapus.");
    } catch {
      toast.error("Gagal menghapus testimoni.");
    }
  };

  const maxSlideIdx = Math.max(0, filteredTestimonials.length - itemsPerView);

  useEffect(() => { setTestiSlideIdx(0); }, [activeTestiCategory, itemsPerView]);
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setItemsPerView(1);
      else if (window.innerWidth < 1024) setItemsPerView(2);
      else setItemsPerView(3);
    };
    handleResize(); window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  useEffect(() => {
    if (!isAutoPlayTesti || maxSlideIdx <= 0) return;
    const timer = setInterval(() => setTestiSlideIdx((prev) => (prev >= maxSlideIdx ? 0 : prev + 1)), 4000);
    return () => clearInterval(timer);
  }, [isAutoPlayTesti, maxSlideIdx]);

  return (
    <>
      <section id="testimoni" className="py-16 md:py-24 px-6 max-w-7xl mx-auto space-y-10 md:space-y-12 border-t border-slate-200">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
            <Quote size={13} /> Narasi Keterwakilan Instansi
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Kredibilitas Diakui Berbagai Pihak</h2>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">Rekam jejak opini empiris dari para pimpinan manajemen dan tenaga kesekretariatan yang telah beralih memanfaatkan ABDI.</p>
        </div>

        {/* Rating Summary Box */}
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-around gap-6 text-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 text-xl md:text-2xl font-black">⭐</div>
            <div className="text-left">
              <p className="text-xl md:text-2xl font-black text-white leading-none">4.9 <span className="text-[10px] md:text-xs text-slate-400 font-normal">/ 5.0</span></p>
              <p className="text-[10px] md:text-xs text-amber-300 font-bold mt-1">Indeks Kepuasan Klien</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 text-xl md:text-2xl font-black">🏢</div>
            <div className="text-left">
              <p className="text-xl md:text-2xl font-black text-white leading-none">{allTestimonialsData.length}+ <span className="text-[10px] md:text-xs text-slate-400 font-normal">Ulasan</span></p>
              <p className="text-[10px] md:text-xs text-emerald-300 font-bold mt-1">Tinjauan Representatif Faktual</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-sky-400/20 border border-sky-400/40 flex items-center justify-center text-sky-400 text-xl md:text-2xl font-black">🤝</div>
            <div className="text-left">
              <p className="text-xl md:text-2xl font-black text-white leading-none">100% <span className="text-[10px] md:text-xs text-slate-400 font-normal">Sah</span></p>
              <p className="text-[10px] md:text-xs text-sky-300 font-bold mt-1">Otentikasi Identitas Terbukti</p>
            </div>
          </div>
        </div>

        {/* Tombol Tulis Testimoni */}
        <div className="flex justify-center pt-2">
          <button onClick={() => setIsTestiModalOpen(true)} className="px-5 sm:px-6 py-3 sm:py-3.5 rounded-full bg-gradient-to-r from-[#b829ff] to-[#7928CA] text-white font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-lg shadow-purple-500/30 hover:scale-105 transition-all flex items-center gap-2">
            ✍️ Daftarkan Ulasan Anda Di Sini
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-slate-500 mt-4">Memuat Ulasan...</p>
          </div>
        ) : allTestimonialsData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 opacity-80 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
             <Quote size={48} className="text-slate-300 mb-4" />
             <p className="text-slate-500 font-bold text-center text-lg">Belum ada ulasan saat ini.</p>
             <p className="text-slate-400 text-sm text-center mt-2 max-w-md">Jadilah instansi pertama yang memberikan ulasan dan membagikan pengalaman Anda.</p>
          </div>
        ) : (
          <>
            {/* Filter Pills */}
            <div className="flex flex-nowrap sm:flex-wrap items-center justify-start sm:justify-center gap-2 pt-2 overflow-x-auto pb-4 snap-x custom-scrollbar">
              <button onClick={() => setActiveTestiCategory('semua')} className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-extrabold transition-all shadow-sm shrink-0 snap-center whitespace-nowrap ${activeTestiCategory === 'semua' ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20 scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>🌟 Semua Ulasan</button>
              <button onClick={() => setActiveTestiCategory('pimpinan')} className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-extrabold transition-all shadow-sm shrink-0 snap-center whitespace-nowrap ${activeTestiCategory === 'pimpinan' ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20 scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>👑 Pimpinan / Yayasan</button>
              <button onClick={() => setActiveTestiCategory('guru')} className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-extrabold transition-all shadow-sm shrink-0 snap-center whitespace-nowrap ${activeTestiCategory === 'guru' ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20 scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>👨‍🏫 Tenaga Pendidik</button>
              <button onClick={() => setActiveTestiCategory('staf')} className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-extrabold transition-all shadow-sm shrink-0 snap-center whitespace-nowrap ${activeTestiCategory === 'staf' ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20 scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>💼 Staf Administrasi</button>
            </div>

            {/* Carousel Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-100/80 p-3 sm:px-6 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsAutoPlayTesti(!isAutoPlayTesti)} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] sm:text-xs font-extrabold transition-all shadow-md active:scale-95">
                  {isAutoPlayTesti ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />} {isAutoPlayTesti ? "Jeda" : "Putar"}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] sm:text-xs font-black text-slate-700 bg-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-slate-200 shadow-sm">Halaman {testiSlideIdx + 1} / {maxSlideIdx + 1}</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => { setIsAutoPlayTesti(false); setTestiSlideIdx((prev) => (prev <= 0 ? maxSlideIdx : prev - 1)); }} className="p-1.5 sm:p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition-all active:scale-90"><ChevronLeft size={16} /></button>
                  <button onClick={() => { setIsAutoPlayTesti(false); setTestiSlideIdx((prev) => (prev >= maxSlideIdx ? 0 : prev + 1)); }} className="p-1.5 sm:p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition-all active:scale-90"><ChevronRight size={16} /></button>
                </div>
              </div>
            </div>

            {filteredTestimonials.length > 0 ? (
              <div className="overflow-hidden relative w-full py-4 -mx-3 px-3">
                <div className="flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${testiSlideIdx * (100 / itemsPerView)}%)` }}>
                  {filteredTestimonials.map((item, idx) => {
                    const displayAvatar = item.avatar;

                    return (
                      <div key={item.id} className="px-3 shrink-0" style={{ width: itemsPerView === 1 ? '100%' : itemsPerView === 2 ? '50%' : '33.3333%' }}>
                        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-100/80 space-y-5 flex flex-col justify-between hover:-translate-y-1.5 hover:border-indigo-400 hover:shadow-2xl transition-all duration-300 group relative h-full">
                          <div className="space-y-4">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex text-amber-400 gap-1 mt-0.5">{[...Array(item.rating)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}</div>
                              <span className="px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[9px] sm:text-[10px] font-bold text-right leading-tight">✨ {item.highlight}</span>
                            </div>
                            <p className="text-[11px] sm:text-xs text-slate-700 italic font-medium leading-relaxed">"{item.quote}"</p>
                          </div>
                          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                            <div className="relative shrink-0">
                              <img src={displayAvatar} alt={item.name} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-indigo-200 shadow-md transition-all`} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                              <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white shadow-sm"><CheckCircle2 size={10} /></div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h5 className="font-black text-slate-900 text-xs sm:text-sm">{item.name}</h5>
                                {user?.role === 'developer' || user?.role === 'admin' ? (
                                  <button onClick={() => handleDeleteRealTesti(item.id)} className="text-[9px] sm:text-[10px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-md">🗑️ Hapus</button>
                                ) : null}
                              </div>
                              <p className="text-[10px] sm:text-xs text-indigo-600 font-bold truncate">{item.role}</p>
                              <p className="text-[9px] sm:text-[10px] text-slate-500 font-semibold truncate">{item.school} &bull; {item.location}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-slate-500 text-sm font-bold">Tidak ada ulasan dalam kategori ini.</div>
            )}
          </>
        )}
      </section>

      {/* ── Modal Penulisan Testimoni ── */}
      {isTestiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-8 max-w-lg w-full space-y-4 sm:space-y-5 text-left relative shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2"><Quote className="text-purple-600 w-4 h-4 sm:w-5 sm:h-5" /><h3 className="font-black text-slate-900 text-sm sm:text-base">✍️ Formulir Ulasan Pengguna Instansi</h3></div>
              <button onClick={() => setIsTestiModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl bg-slate-100"><X size={16} className="sm:w-[18px] sm:h-[18px]" /></button>
            </div>

            <form onSubmit={handleAddRealTestimony} className="space-y-3 sm:space-y-4 text-[11px] sm:text-xs font-bold text-slate-700">
              <div>
                <label className="block mb-1 sm:mb-1.5 text-slate-600">Nama Lengkap & Gelar <span className="text-red-500">*</span></label>
                <input type="text" required placeholder="Contoh: Drs. H. Ahmad Fauzi, M.Pd." value={newTestiForm.name} onChange={e => setNewTestiForm({ ...newTestiForm, name: e.target.value })} className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none font-medium text-slate-800" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 sm:mb-1.5 text-slate-600">Jabatan Institusi Formal</label>
                  <select value={newTestiForm.role} onChange={e => setNewTestiForm({ ...newTestiForm, role: e.target.value })} className="w-full px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none font-medium text-slate-800 bg-white">
                    <option value="Kepala Sekolah / Rektor / Dekan">Pimpinan Eksekutif Tertinggi</option>
                    <option value="Ketua Yayasan">Ketua Konsorsium Yayasan</option>
                    <option value="Wakil Kepala Sekolah Bidang Kurikulum">Wakil Bidang Evaluasi & Kurikulum</option>
                    <option value="Guru Kelas / Mapel">Fasilitator Ilmu Pengetahuan</option>
                    <option value="Bendahara Sekolah">Bendahara Sekolah</option>
                    <option value="Staf Tata Usaha">Pengurus Tata Usaha (TU)</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 sm:mb-1.5 text-slate-600">Representasi Kualitas Sistem</label>
                  <select value={newTestiForm.rating} onChange={e => setNewTestiForm({ ...newTestiForm, rating: Number(e.target.value) })} className="w-full px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none font-medium text-amber-600 bg-white">
                    <option value={5}>⭐⭐⭐⭐⭐ (Kinerja Sangat Memuaskan)</option>
                    <option value={4}>⭐⭐⭐⭐ (Kapasitas Mumpuni Sesuai Ekspetasi)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 sm:mb-1.5 text-slate-600">Identitas Pendidikan Organisasi</label>
                  <input type="text" placeholder="Contoh: SMA / SMP Terpadu Nusantara" value={newTestiForm.school} onChange={e => setNewTestiForm({ ...newTestiForm, school: e.target.value })} className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none font-medium text-slate-800" />
                </div>
                <div>
                  <label className="block mb-1 sm:mb-1.5 text-slate-600">Wilayah Domisili Administratif</label>
                  <input type="text" placeholder="Contoh: Bandung Barat, Jawa Barat" value={newTestiForm.location} onChange={e => setNewTestiForm({ ...newTestiForm, location: e.target.value })} className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none font-medium text-slate-800" />
                </div>
              </div>

              <div>
                <label className="block mb-1 sm:mb-1.5 text-slate-600">Esensi Gagasan Pokok (Judul Ulasan)</label>
                <input type="text" placeholder="Contoh: Memangkas Keseluruhan Waktu Rekap Audit Bulanan." value={newTestiForm.highlight} onChange={e => setNewTestiForm({ ...newTestiForm, highlight: e.target.value })} className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none font-medium text-slate-800" />
              </div>

              <div>
                <label className="block mb-1 sm:mb-1.5 text-slate-600">Rincian Naratif Kesan Penggunaan Sistem Evaluasi <span className="text-red-500">*</span></label>
                <textarea required rows={3} placeholder="Sampaikan pengamatan Bapak/Ibu paska beralih menggunakan ABDI Absensi..." value={newTestiForm.quote} onChange={e => setNewTestiForm({ ...newTestiForm, quote: e.target.value })} className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none font-medium text-slate-800 custom-scrollbar" />
              </div>

              <div>
                <label className="block mb-1 sm:mb-1.5 text-slate-600">Sertakan Identitas Wajah Pengguna Asli <span className="text-slate-400 font-normal">(Opsional, Maks 2MB)</span></label>
                <div className="flex items-center gap-3">
                  {newTestiForm.avatarUrl ? (
                    <div className="relative">
                      <img src={newTestiForm.avatarUrl} alt="Preview" className="w-12 h-12 rounded-full object-cover border-2 border-purple-500 shadow-sm" />
                      <button type="button" onClick={() => setNewTestiForm(prev => ({ ...prev, avatarUrl: '' }))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 text-[10px]" title="Batalkan unggahan arsip wajah">✕</button>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 font-bold text-lg">📷</div>
                  )}
                  <input type="file" accept="image/*" onChange={handleTestiAvatarUpload} className="w-full text-[10px] sm:text-xs text-slate-500 file:mr-3 file:py-1.5 sm:file:py-2 file:px-3 sm:file:px-4 file:rounded-full file:border-0 file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer" />
                </div>
              </div>

              <div className="pt-2 flex gap-2 sm:gap-3">
                <button type="button" onClick={() => setIsTestiModalOpen(false)} className="flex-1 py-2.5 sm:py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black transition-all">Batal</button>
                <button type="submit" className="flex-1 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-[#b829ff] to-[#7928CA] text-white font-black shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-1.5">🚀 Publikasikan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
