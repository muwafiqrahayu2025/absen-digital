import React, { useState, useRef, useEffect } from "react";
import { AiExecutiveBriefing } from "../../components/AiExecutiveBriefing";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useGroqAnalyticsApiKey } from "../../hooks/useGroqAnalyticsApiKey";
import Groq from "groq-sdk";
import { useFirebaseQuery } from "../../hooks/useFirebaseQuery";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { db } from "../../lib/db";
import { 
  Sparkles, Award, CalendarCheck, TrendingUp, ShieldAlert, 
  BarChart3, MessageSquare, Bot, User, Send 
} from 'lucide-react';

export function AiAnalytics() {
  useDocumentTitle("AI Analytics & Executive Briefing");
  const school: any = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
  
  // Ambil data attendance 30 hari terakhir saja
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startStr = thirtyDaysAgo.toISOString().split("T")[0];
  const { data: rawAttendance } = useFirebaseQuery<any[]>('attendance', { orderByChild: 'date', startAt: startStr }, []);
  const attendance = React.useMemo(() => rawAttendance || [], [rawAttendance]);
  
  const users = db.getUsers();

  // Hitung ringkasan cepat untuk header kartu
  const todayStr = new Date().toISOString().split("T")[0];
  const todayRecords = attendance.filter((a) => a.date === todayStr);
  const totalHadir = todayRecords.filter((a) => a.status === "Hadir" || a.status === "Terlambat").length;
  const totalIzin = todayRecords.filter((a) => a.status === "Izin" || a.status === "Sakit" || a.status === "Cuti Tahunan").length;
  const totalAlpha = todayRecords.filter((a) => a.status === "Alpha").length;
  const totalPegawai = users.filter((u) => u.role !== "admin" && u.role !== "developer").length;
  const persentaseKehadiran = totalPegawai > 0 ? Math.round((totalHadir / totalPegawai) * 100) : 0;

  // Agregasi Data untuk Grafik (useMemo agar tidak re-render O(N) terus menerus)
  const chartData = React.useMemo(() => {
    const map = new Map<string, { date: string; hadir: number; terlambat: number; izin: number; alpha: number }>();
    
    // Inisialisasi 30 hari kosong agar sumbu X tidak terputus
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      map.set(ds, { date: ds, hadir: 0, terlambat: 0, izin: 0, alpha: 0 });
    }
    
    attendance.forEach((a: any) => {
      if (map.has(a.date)) {
        const entry = map.get(a.date)!;
        if (a.status === 'Hadir') entry.hadir++;
        else if (a.status === 'Terlambat') entry.terlambat++;
        else if (a.status === 'Alpha') entry.alpha++;
        else entry.izin++; 
      }
    });
    
    return Array.from(map.values()).map(d => ({
      ...d,
      dateFormatted: d.date.substring(8, 10) + '/' + d.date.substring(5, 7) // Format DD/MM
    }));
  }, [attendance]);

  // Chat state
  const [messages, setMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const groqApiKey = useGroqAnalyticsApiKey();

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsTyping(true);

    try {
      if (!groqApiKey) {
        throw new Error("No API Key");
      }
      
      const promptText = `Berdasarkan data kehadiran berikut, jawablah pertanyaan dengan ringkas dan profesional:
Total Pegawai: ${totalPegawai}
Kehadiran Hari Ini: ${totalHadir}
Tingkat Kehadiran: ${persentaseKehadiran}%
Alpha: ${totalAlpha}
Izin/Sakit/Cuti: ${totalIzin}

Pertanyaan: ${userText}`;

      const groq = new Groq({ apiKey: groqApiKey, dangerouslyAllowBrowser: true });
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: promptText }],
        model: "llama-3.1-8b-instant",
      });
      const aiResponse = chatCompletion.choices[0]?.message?.content || "";
      
      setMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
    } catch (error: any) {
      console.error(error);
      if (error.message === "No API Key") {
        setMessages(prev => [...prev, { role: 'ai', text: "Konfigurasi API belum diatur oleh Admin." }]);
      } else {
        const errorMessage = error?.message || "Terjadi kesalahan jaringan.";
        setMessages(prev => [...prev, { role: 'ai', text: `Gagal merespons: ${errorMessage}` }]);
      }
    } finally {
      setIsTyping(false);
    }
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

      {/* Tren Kehadiran 30 Hari Terakhir (Recharts) */}
      <div className="max-w-6xl mx-auto pt-6">
        <div className="bg-white rounded-[1.8rem] border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-indigo-600" /> Tren Kehadiran & Keterlambatan (30 Hari)
          </h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTerlambat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="dateFormatted" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                <Area type="monotone" name="Hadir" dataKey="hadir" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorHadir)" />
                <Area type="monotone" name="Terlambat" dataKey="terlambat" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorTerlambat)" />
                <Area type="monotone" name="Izin/Sakit" dataKey="izin" stroke="#3b82f6" strokeWidth={2} fillOpacity={0} />
                <Area type="monotone" name="Alpha" dataKey="alpha" stroke="#ef4444" strokeWidth={2} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
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
                placeholder={!groqApiKey ? "Memuat API Key..." : "Ketik pertanyaan Anda di sini..."}
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                disabled={isTyping || !groqApiKey}
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isTyping || !groqApiKey}
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
