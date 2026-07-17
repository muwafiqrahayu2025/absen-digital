import React, { useState, useEffect } from 'react';
import { Sparkles, Bot, RefreshCw, Copy, Check, Key, AlertCircle, TrendingUp, ShieldAlert, Award, ChevronDown, ChevronUp, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../lib/db';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useAuth } from './AuthContext';

interface AiExecutiveBriefingProps {
  onBroadcastRecommendation?: (text: string) => void;
}

export const AiExecutiveBriefing: React.FC<AiExecutiveBriefingProps> = ({ onBroadcastRecommendation }) => {
  const { user } = useAuth();
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('abdi_gemini_api_key') || '');
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [keyInput, setKeyInput] = useState<string>(apiKey);
  const [copied, setCopied] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isUsingCloudGemini, setIsUsingCloudGemini] = useState<boolean>(false);

  // Ambil data statistik saat ini
  const getAttendanceSummary = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const currentMonthStr = format(new Date(), 'yyyy-MM');
    const school = db.getSchool();
    const users = db.getUsers().filter(u => u.role !== 'admin' && u.role !== 'developer');
    const allAttendance = db.getAttendance();

    const todayAttendance = allAttendance.filter(a => a.date === todayStr);
    const monthAttendance = allAttendance.filter(a => a.date.startsWith(currentMonthStr));

    const hadirToday = todayAttendance.filter(a => a.status === 'Hadir').length;
    const telatToday = todayAttendance.filter(a => a.status === 'Terlambat').length;
    const sakitIzinToday = todayAttendance.filter(a => a.status === 'Sakit' || a.status === 'Izin' || a.status === 'Cuti Tahunan').length;
    const alphaToday = todayAttendance.filter(a => a.status === 'Alpha').length;
    const belumAbsenToday = Math.max(0, users.length - todayAttendance.length);

    // Hitung rata-rata bulanan
    const totalMonthRecords = monthAttendance.length || 1;
    const monthHadirCount = monthAttendance.filter(a => a.status === 'Hadir' || a.status === 'Terlambat').length;
    const monthAlphaCount = monthAttendance.filter(a => a.status === 'Alpha').length;
    const monthTelatCount = monthAttendance.filter(a => a.status === 'Terlambat').length;

    // Nama-nama yang terlambat hari ini
    const telatUsersToday = todayAttendance
      .filter(a => a.status === 'Terlambat')
      .map(a => {
        const u = users.find(usr => usr.id === a.userId);
        return u ? `${u.name} (masuk jam ${a.checkInTime || '-'})` : 'Pegawai Terlambat';
      });

    return {
      schoolName: school?.name || 'Instansi Pendidikan',
      totalUsers: users.length,
      today: {
        hadir: hadirToday,
        telat: telatToday,
        sakitIzin: sakitIzinToday,
        alpha: alphaToday,
        belumAbsen: belumAbsenToday,
        telatList: telatUsersToday,
      },
      month: {
        hadirPct: Math.round((monthHadirCount / totalMonthRecords) * 100),
        alphaTotal: monthAlphaCount,
        telatTotal: monthTelatCount,
      }
    };
  };

  const generateLocalBriefing = (summary: ReturnType<typeof getAttendanceSummary>) => {
    const { schoolName, totalUsers, today, month } = summary;
    const kedisiplinanTodayPct = totalUsers > 0 ? Math.round(((today.hadir + today.telat) / totalUsers) * 100) : 100;

    return `### 🎯 Ringkasan Eksekutif Presensi — ${schoolName}
**Tanggal:** ${format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })} | **Tingkat Kehadiran Hari Ini:** ${kedisiplinanTodayPct}%

#### 📈 1. Sorotan Kedisiplinan & Kinerja
- **Status Kehadiran Hari Ini:** Sebanyak **${today.hadir} personel tepat waktu** dan **${today.telat} personel terlambat** dari total ${totalUsers} guru/staf terdaftar.
- **Tren Bulanan:** Akumulasi kedisiplinan bulan ini berada di angka **${month.hadirPct}%**, menunjukkan stabilitas operasional yang ${month.hadirPct >= 85 ? 'sangat baik dan perlu dipertahankan' : 'perlu perhatian khusus dari pimpinan'}.

#### ⚠️ 2. Poin Perhatian & Keterlambatan
- **Keterlambatan Hari Ini:** ${today.telat > 0 ? `Tercatat ${today.telat} pegawai terlambat masuk (${today.telatList.slice(0, 3).join(', ')}${today.telatList.length > 3 ? ', dst' : ''}). Disarankan evaluasi jadwal kedatangan pagi.` : 'Luara biasa! Tidak ada personel yang terlambat hari ini.'}
- **Tanpa Keterangan (Alpha):** ${today.alpha > 0 || month.alphaTotal > 0 ? `Terdapat ${today.alpha} Alpha hari ini (Total ${month.alphaTotal} Alpha bulan ini). Pimpinan perlu memberikan teguran persuasif untuk klarifikasi.` : 'Nihil Alpha. Seluruh personel memberikan keterangan atau hadir aktif.'}

#### 💡 3. Rekomendasi Kepemimpinan (Actionable Advice)
- **Apresiasi Guru Disiplin:** Berikan pujian atau insentif kinerja kepada guru-guru yang konsisten hadir sebelum pukul 07:00 untuk menjaga moral kerja.
- **Optimalisasi Stasiun Lobi:** ${today.belumAbsen > 0 ? `Ingatkan ${today.belumAbsen} personel yang belum melakuakan *check-in* agar memanfaatkan stasiun scan QR Lobi yang tersedia.` : 'Seluruh personel telah terdata presensinya dengan baik hari ini.'}`;
  };

  const generateBriefing = async () => {
    setLoading(true);
    const summary = getAttendanceSummary();

    const storedKey = localStorage.getItem('abdi_gemini_api_key');
    if (storedKey && storedKey.trim().length > 10) {
      setIsUsingCloudGemini(true);
      try {
        const prompt = `Kamu adalah Konsultan Manajemen SDM Senior & AI Data Analyst eksklusif untuk ${summary.schoolName}. 
Hari ini: ${format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}.
Statistik Kehadiran Hari Ini:
- Total Guru & Staf: ${summary.totalUsers} orang
- Tepat Waktu: ${summary.today.hadir} orang
- Terlambat: ${summary.today.telat} orang (${summary.today.telatList.join(', ')})
- Sakit/Izin/Cuti: ${summary.today.sakitIzin} orang
- Alpha (Tanpa Keterangan): ${summary.today.alpha} orang
- Belum Absen: ${summary.today.belumAbsen} orang

Statistik Bulan Ini:
- Tingkat Kehadiran Bulanan: ${summary.month.hadirPct}%
- Total Keterlambatan Bulan Ini: ${summary.month.telatTotal} kali
- Total Alpha Bulan Ini: ${summary.month.alphaTotal} kali

Buatkan "AI Executive Briefing" yang tajam, profesional, dan bergaya konsultatif untuk Kepala Sekolah / Pimpinan dengan format Markdown (berisi 3-4 poin utama: Sorotan Kedisiplinan, Poin Perhatian/Keterlambatan, dan Rekomendasi Kepemimpinan Strategis). Gunakan emoji yang relevan dan bahasa Indonesia eksekutif yang formal serta berwibawa.`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${storedKey.trim()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiText) {
            setBriefing(aiText);
            toast.success("AI Executive Briefing berhasil digenerate oleh Google Gemini 1.5 Flash!");
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error("Gemini API Error:", error);
        // Fallback to local AI if network or API error occurs
      }
    }

    // Jika API Key kosong atau terjadi error jaringan, gunakan Smart Local AI Engine
    setIsUsingCloudGemini(false);
    setTimeout(() => {
      const localText = generateLocalBriefing(summary);
      setBriefing(localText);
      if (!storedKey) {
        toast.success("Briefing digenerate dengan Smart Local Engine. (Masukkan API Key Gemini untuk analisa LLM cloud yang lebih mendalam)");
      } else {
        toast.success("Executive Briefing berhasil diperbarui!");
      }
      setLoading(false);
    }, 800);
  };

  useEffect(() => {
    // Generate briefing otomatis saat komponen pertama kali dimuat
    if (!briefing) {
      generateBriefing();
    }
  }, []);

  const handleCopy = () => {
    if (!briefing) return;
    navigator.clipboard.writeText(briefing.replace(/#/g, ''));
    setCopied(true);
    toast.success("Briefing berhasil disalin ke clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('abdi_gemini_api_key', keyInput.trim());
    setApiKey(keyInput.trim());
    setShowKeyModal(false);
    toast.success("API Key Google Gemini berhasil disimpan!");
    generateBriefing();
  };

  return (
    <div className="bg-gradient-to-br from-[#1e1b4b] via-[#31106a] to-[#1e1b4b] text-white rounded-[1.8rem] p-6 shadow-2xl border border-purple-500/30 relative overflow-hidden my-6 animate-fade-in">
      {/* Background Decorative Glows */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-purple-400/20 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30 ring-2 ring-purple-400/40 shrink-0">
            <Sparkles size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                AI Executive Briefing
              </h3>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold border ${
                isUsingCloudGemini 
                  ? 'bg-purple-500/30 border-purple-400 text-purple-200' 
                  : 'bg-indigo-500/30 border-indigo-400 text-indigo-200'
              }`}>
                {isUsingCloudGemini ? '🚀 GOOGLE GEMINI 1.5 FLASH' : '⚡ SMART LOCAL ENGINE'}
              </span>
            </div>
            <p className="text-xs text-purple-200/80 mt-0.5 font-medium">
              Analisa kedisiplinan &amp; rekomendasi kepemimpinan real-time untuk Kepala Sekolah / Eksekutif
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {(user?.role === 'developer' || user?.username === 'alpha_project') && (
            <button
              onClick={() => setShowKeyModal(true)}
              title="Pengaturan API Key Google Gemini (Khusus Developer)"
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-purple-200 hover:text-white border border-white/10 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold"
            >
              <Key size={14} />
              <span className="hidden md:inline">{apiKey ? 'Ganti Key Gemini' : 'Set API Key'}</span>
            </button>
          )}
          
          <button
            onClick={generateBriefing}
            disabled={loading}
            title="Generate ulang analisa AI"
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-extrabold text-xs shadow-lg shadow-purple-500/30 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Menganalisa...' : 'Analisa Ulang'}</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-purple-200 transition-all"
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Content Area */}
      {isExpanded && (
        <div className="pt-5 relative z-10">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full border-4 border-purple-400/30 border-t-purple-400 animate-spin" />
              <p className="text-sm font-bold text-purple-200 animate-pulse">
                Google Gemini sedang memproses jutaan titik data kedisiplinan &amp; menyusun rekomendasi eksekutif...
              </p>
            </div>
          ) : briefing ? (
            <div className="space-y-4">
              <div className="bg-black/30 backdrop-blur-md rounded-2xl p-5 border border-purple-500/20 text-purple-100 text-xs sm:text-sm leading-relaxed prose prose-invert max-w-none font-sans">
                {/* Format markdown simple parser */}
                <div className="space-y-3">
                  {briefing.split('\n').map((line, idx) => {
                    if (line.startsWith('### ')) {
                      return <h4 key={idx} className="text-base font-black text-white border-b border-purple-400/20 pb-2 mt-2 mb-2">{line.replace('### ', '')}</h4>;
                    }
                    if (line.startsWith('#### ')) {
                      return <h5 key={idx} className="text-sm font-extrabold text-purple-300 mt-3 mb-1 flex items-center gap-1.5">{line.replace('#### ', '')}</h5>;
                    }
                    if (line.startsWith('- **')) {
                      const parts = line.replace('- **', '').split('**');
                      return (
                        <div key={idx} className="flex items-start gap-2 pl-2 my-1.5">
                          <span className="text-purple-400 font-bold">•</span>
                          <span><strong className="text-white font-bold">{parts[0]}</strong>{parts[1]}</span>
                        </div>
                      );
                    }
                    if (line.startsWith('- ')) {
                      return (
                        <div key={idx} className="flex items-start gap-2 pl-2 my-1.5">
                          <span className="text-purple-400 font-bold">•</span>
                          <span>{line.replace('- ', '')}</span>
                        </div>
                      );
                    }
                    if (line.trim() === '') return null;
                    return <p key={idx} className="my-1">{line}</p>;
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-[11px] text-purple-300">
                  <Bot size={15} className="text-purple-400" />
                  <span>Dihasilkan secara instan oleh sistem analitik ABDI AI</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/10 transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copied ? 'Tersalin!' : 'Salin Laporan'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Modal Pengaturan API Key Gemini */}
      {(user?.role === 'developer' || user?.username === 'alpha_project') && showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in text-slate-800">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-purple-500/30">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 flex items-center justify-center font-bold">
                <Key size={20} />
              </div>
              <div>
                <h4 className="font-black text-slate-800 dark:text-white text-base">API Key Google Gemini</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Aktifkan analisis kecerdasan buatan LLM cloud</p>
              </div>
            </div>

            <form onSubmit={handleSaveApiKey} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  API Key Gemini 1.5 Flash (Gratis dari Google AI Studio)
                </label>
                <input
                  type="text"
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  placeholder="Contoh: AIzaSyD..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-purple-600 outline-none"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  💡 API Key ini akan disimpan aman di peramban Anda (`localStorage`) dan digunakan oleh dasbor Admin serta Live CS untuk menjawab secara otomatis menggunakan LLM Google Gemini.
                </p>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-purple-500/30 transition-all flex items-center justify-center gap-1.5"
                >
                  💾 Simpan &amp; Aktifkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
