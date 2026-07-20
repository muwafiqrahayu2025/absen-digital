import React, { useState, useRef, useEffect } from "react";
import { AiExecutiveBriefing } from "../../components/AiExecutiveBriefing";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Award, Sparkles, TrendingUp, Users, CalendarCheck, ShieldAlert, BarChart3, ArrowUpRight, Send, Bot, User, MessageSquare } from "lucide-react";
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

  // Chat state
  const [messages, setMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsTyping(true);

    const storedKey = localStorage.getItem('abdi_gemini_api_key');
    
    if (storedKey && storedKey.trim().length > 10) {
      try {
        const promptContext = `Sebagai AI Assistant untuk data kehadiran ${school.name}, jawab pertanyaan berikut: "${userText}". Data saat ini: ${totalHadir} hadir, ${totalAlpha} alpha dari total ${totalPegawai} pegawai. Jawablah dengan bahasa Indonesia yang profesional, ringkas, dan solutif.`;
        
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${storedKey.trim()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptContext }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiText) {
            setMessages(prev => [...prev, { role: 'ai', text: aiText }]);
            setIsTyping(false);
            return;
          }
        }
      } catch (error) {
        console.error("Gemini API Error in Chat:", error);
      }
    }

    // Fallback SMART LOCAL ENGINE
    setTimeout(() => {
      let localResponse = "Berdasarkan SMART LOCAL ENGINE: Saya berjalan pada mode luring saat ini. ";
      const lowerInput = userText.toLowerCase();
      if (lowerInput.includes("hadir") || lowerInput.includes("kedisiplinan")) {
        localResponse += `Hari ini terdapat ${totalHadir} personel yang telah hadir dari total ${totalPegawai} orang (Tingkat kehadiran: ${persentaseKehadiran}%).`;
      } else if (lowerInput.includes("alpha") || lowerInput.includes("tanpa keterangan")) {
        localResponse += `Terdapat ${totalAlpha} personel yang belum memberikan keterangan (Alpha) hari ini.`;
      } else {
        localResponse += "Silakan hubungkan API Key GOOGLE GEMINI 1.5 FLASH untuk analisa kontekstual yang lebih komprehensif, atau tanyakan spesifik mengenai 'kehadiran' atau 'alpha'.";
      }
      setMessages(prev => [...prev, { role: 'ai', text: localResponse }]);
      setIsTyping(false);
    }, 1000);
  };

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

      {/* Interactive AI Chat */}
      <div className="max-w-6xl mx-auto pt-6">
        <div className="bg-white rounded-[1.8rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[500px]">
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                <MessageSquare size={20} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight">Asisten AI Interaktif</h2>
                <p className="text-xs text-indigo-100 mt-0.5">Didukung oleh GOOGLE GEMINI 1.5 FLASH &amp; SMART LOCAL ENGINE</p>
              </div>
            </div>
          </div>
          
          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                <Bot size={48} className="opacity-20" />
                <p className="text-sm font-medium">Silakan ajukan pertanyaan seputar data absensi, tren kedisiplinan, atau kebijakan sekolah.</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   {msg.role === 'ai' && (
                     <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                       <Bot size={16} className="text-indigo-600" />
                     </div>
                   )}
                   <div className={`px-4 py-3 rounded-2xl max-w-[80%] text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'}`}>
                     <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br/>') }} />
                   </div>
                   {msg.role === 'user' && (
                     <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                       <User size={16} className="text-slate-600" />
                     </div>
                   )}
                </div>
              ))
            )}
            {isTyping && (
              <div className="flex gap-3 justify-start animate-fade-in">
                 <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                   <Bot size={16} className="text-indigo-600" />
                 </div>
                 <div className="px-4 py-3 rounded-2xl bg-white border border-slate-200 rounded-tl-none shadow-sm flex gap-1.5 items-center">
                   <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                   <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                   <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                 </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-white border-t border-slate-100 shrink-0">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ketik pertanyaan Anda di sini..."
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                disabled={isTyping}
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isTyping}
                className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
