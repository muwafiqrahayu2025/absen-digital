import React, { useState } from 'react';
import { X, MessageCircle, Send, Bot } from 'lucide-react';
import toast from 'react-hot-toast';
import Groq from 'groq-sdk';
import { useGroqCSApiKey } from '../../hooks/useGroqCSApiKey';

interface AiChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

interface AiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiChatModal({ isOpen, onClose }: AiChatModalProps) {
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([
    {
      id: '1', sender: 'ai', text: 'Halo! 👋 Saya Tim Layanan Pelanggan ABDI. Ada yang dapat kami bantu terkait fitur, pilihan paket, atau panduan aktivasi untuk instansi Bapak/Ibu?', time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [aiInputText, setAiInputText] = useState('');
  const groqApiKey = useGroqCSApiKey();
  const [isAiTyping, setIsAiTyping] = useState(false);

  const handleSendAiMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInputText.trim()) return;

    const userMsg: AiChatMessage = { id: Date.now().toString(), sender: 'user', text: aiInputText.trim(), time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) };
    setAiMessages(prev => [...prev, userMsg]);
    const query = aiInputText.trim();
    setAiInputText('');
    setIsAiTyping(true);

    try {
      if (!groqApiKey) {
        toast.error("API Key Groq belum diatur.");
        throw new Error("No API Key");
      }
      const groq = new Groq({ apiKey: groqApiKey, dangerouslyAllowBrowser: true });
      const systemPrompt = "Anda adalah Customer Service dari ABDI (Absen Digital), platform absensi sekolah. Jawablah dengan ramah dan ringkas dalam Bahasa Indonesia.";
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query }
        ],
        model: "llama-3.1-8b-instant",
      });
      const aiResponse = chatCompletion.choices[0]?.message?.content || "";
      setAiMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'ai', text: aiResponse, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }]);
    } catch (error: any) {
      console.error(error);
      if (error.message === "No API Key") {
        setAiMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'ai', text: 'Konfigurasi API belum diatur.', time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }]);
      } else {
        const errorMessage = error?.message || "Terjadi kesalahan.";
        setAiMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'ai', text: `Gagal merespons: ${errorMessage}`, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }]);
      }
    } finally {
      setIsAiTyping(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-20 sm:bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[360px] h-[450px] sm:h-[500px] max-h-[80vh] bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden animate-fade-in text-left">
          <div className="bg-gradient-to-r from-[#b829ff] via-[#7928CA] to-[#5e1e9d] p-3 sm:p-4 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2 sm:gap-3">
              <img src="/cs-avatar.png" onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=Layanan+Pelanggan&background=7928CA&color=fff&bold=true'; }} alt="Layanan Pelanggan" className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl object-cover border border-white/40 shadow-inner bg-purple-100" />
              <div>
                <div className="flex items-center gap-1.5"><h4 className="font-black text-xs sm:text-sm">Pusat Layanan Pelanggan</h4><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-ping" /></div>
                <p className="text-[9px] sm:text-[10px] text-purple-200 font-medium">Tim Dukungan &bull; Aktif</p>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"><X size={16} /></button>
          </div>

          <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 bg-slate-50 text-[11px] sm:text-xs">
            <div className="text-center my-2"><span className="px-2 sm:px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[8px] sm:text-[9px] uppercase tracking-wider border border-emerald-200">🟢 Tersambung dengan Layanan Pelanggan Pusat</span></div>
            {aiMessages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-end gap-2 max-w-[90%] sm:max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.sender === 'ai' && (<img src="/cs-avatar.png" onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=CS&background=7928CA&color=fff&bold=true'; }} alt="CS" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover mb-1 border border-purple-200 bg-purple-50" />)}
                  <div className={`p-2.5 sm:p-3.5 rounded-2xl font-medium shadow-sm whitespace-pre-wrap ${msg.sender === 'user' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none font-bold' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'}`}>{msg.text}</div>
                </div>
                <span className={`text-[8px] sm:text-[9px] text-slate-400 mt-1 px-1 font-bold ${msg.sender === 'ai' ? 'ml-7 sm:ml-8' : ''}`}>{msg.time}</span>
              </div>
            ))}
            {isAiTyping && (
              <div className="flex items-start pl-7 sm:pl-8"><div className="bg-white text-slate-500 border border-slate-200 py-2 px-3 sm:px-4 rounded-2xl rounded-bl-none flex items-center gap-2 shadow-sm"><MessageCircle size={12} className="text-emerald-500 animate-bounce" /><span className="text-[10px] sm:text-[11px] font-bold text-slate-600 animate-pulse">Mengetik balasan...</span></div></div>
            )}
          </div>

          <form onSubmit={handleSendAiMessage} className="p-2 sm:p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input type="text" value={aiInputText} onChange={(e) => setAiInputText(e.target.value)} placeholder={!groqApiKey ? "Memuat API Key..." : "Tuliskan keluhan atau pertanyaan..."} className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-100 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-2xl text-[11px] sm:text-xs font-semibold outline-none" disabled={isAiTyping || !groqApiKey} />
            <button type="submit" disabled={!aiInputText.trim() || isAiTyping || !groqApiKey} className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-r from-[#b829ff] to-[#7928CA] disabled:opacity-50 text-white flex items-center justify-center shadow-md"><Send size={14} className="sm:w-4 sm:h-4" /></button>
          </form>
        </div>
      )}
    </>
  );
}
