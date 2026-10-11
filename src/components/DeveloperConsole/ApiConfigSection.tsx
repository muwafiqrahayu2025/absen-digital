import React, { useState, useEffect } from "react";
import { ShieldAlert, Sparkles, Monitor, Save, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { ref, onValue, update } from "firebase/database";
import { dbRealtime } from "../../lib/firebase";

export function ApiConfigSection() {
  const [apiFormData, setApiFormData] = useState({
    whatsappApiKey: "",
    gasWebAppUrl: "",
    waGatewayProvider: "wablas",
    wablasServerUrl: "https://smg.wablas.com",
  });
  const [demoVideoUrl, setDemoVideoUrl] = useState("");
  const [groqCSApiKey, setGroqCSApiKey] = useState("");
  const [groqAnalyticsApiKey, setGroqAnalyticsApiKey] = useState("");
  const [showGroqCSKey, setShowGroqCSKey] = useState(false);
  const [showGroqAnalyticsKey, setShowGroqAnalyticsKey] = useState(false);
  const [isSavingApi, setIsSavingApi] = useState(false);
  const [isSavingDisplay, setIsSavingDisplay] = useState(false);
  const [isSavingGroq, setIsSavingGroq] = useState(false);

  useEffect(() => {
    const configRef = ref(dbRealtime, 'global_settings/landingConfig');
    const unsubscribeConfig = onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setDemoVideoUrl(data.youtubeUrl || "");
      }
    });

    const groqCSRef = ref(dbRealtime, 'global_settings/apiKeys/groq_cs');
    const unsubscribeGroqCS = onValue(groqCSRef, (snapshot) => {
      if (snapshot.exists()) setGroqCSApiKey(snapshot.val());
    });

    const groqAnalyticsRef = ref(dbRealtime, 'global_settings/apiKeys/groq_analytics');
    const unsubscribeGroqAnalytics = onValue(groqAnalyticsRef, (snapshot) => {
      if (snapshot.exists()) setGroqAnalyticsApiKey(snapshot.val());
    });

    const notifApiRef = ref(dbRealtime, 'global_settings/apiKeys/notif');
    const unsubscribeNotifApi = onValue(notifApiRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setApiFormData({
          whatsappApiKey: data.whatsappApiKey || "",
          gasWebAppUrl: data.gasWebAppUrl || "",
          waGatewayProvider: data.waGatewayProvider || "wablas",
          wablasServerUrl: data.wablasServerUrl || "https://smg.wablas.com",
        });
      }
    });

    return () => {
      unsubscribeConfig();
      unsubscribeGroqCS();
      unsubscribeGroqAnalytics();
      unsubscribeNotifApi();
    };
  }, []);

  const handleSaveApi = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingApi(true);
    const toastId = toast.loading("Menyimpan Konfigurasi API Notifikasi...");
    try {
      const apiRef = ref(dbRealtime, 'global_settings/apiKeys/notif');
      await update(apiRef, {
        whatsappApiKey: apiFormData.whatsappApiKey,
        gasWebAppUrl: apiFormData.gasWebAppUrl,
        waGatewayProvider: apiFormData.waGatewayProvider,
        wablasServerUrl: apiFormData.wablasServerUrl,
      });
      
      toast.success("Konfigurasi API Berhasil Diperbarui!", { id: toastId });
    } catch (error: any) {
      toast.error(`Gagal menyimpan konfigurasi API: ${error.message}`, { id: toastId });
    } finally {
      setIsSavingApi(false);
    }
  };

  const handleSaveGroqConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const toastId = toast.loading("Menyimpan Konfigurasi Groq AI...");
    setIsSavingGroq(true);
    try {
      const groqCSRef = ref(dbRealtime, 'global_settings/apiKeys');
      await update(groqCSRef, {
        groq_cs: groqCSApiKey,
        groq_analytics: groqAnalyticsApiKey
      });
      toast.success("Konfigurasi Groq AI Berhasil Diperbarui!", { id: toastId });
    } catch (error: any) {
      toast.error(`Gagal menyimpan: ${error.message}`, { id: toastId });
    } finally {
      setIsSavingGroq(false);
    }
  };

  const formatYouTubeUrl = (url: string): string => {
    if (!url) return "";
    const regex = /(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1&loop=1&playlist=${match[1]}`;
    }
    return url;
  };

  const handleSaveLandingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const toastId = toast.loading("Menyimpan Konfigurasi Tampilan...");
    setIsSavingDisplay(true);
    try {
      const formattedUrl = formatYouTubeUrl(demoVideoUrl);
      setDemoVideoUrl(formattedUrl);
      const configRef = ref(dbRealtime, 'global_settings/landingConfig');
      await update(configRef, { youtubeUrl: formattedUrl, updatedAt: new Date().toISOString() });
      toast.success("Konfigurasi Tampilan Berhasil Diperbarui!", { id: toastId });
    } catch (error: any) {
      toast.error(`Gagal menyimpan: ${error.message}`, { id: toastId });
    } finally {
      setIsSavingDisplay(false);
    }
  };

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden max-w-4xl">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
          <ShieldAlert className="text-indigo-400" size={24} />
          <div>
            <h3 className="font-bold text-white text-lg">Konfigurasi API Notifikasi &amp; Server</h3>
            <p className="text-xs text-slate-400">Hubungan ke WhatsApp Gateway Fonnte &amp; Google Apps Script.</p>
          </div>
        </div>

        <form onSubmit={handleSaveApi} className="space-y-5 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                Penyedia WhatsApp Gateway
              </label>
              <select
                value={apiFormData.waGatewayProvider}
                onChange={(e) => setApiFormData({ ...apiFormData, waGatewayProvider: e.target.value as any })}
                className="w-full px-4 py-3 border border-slate-700 rounded-xl text-sm font-bold text-amber-400 bg-slate-950 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="wablas">Wablas API v2</option>
                <option value="fonnte">Fonnte API</option>
              </select>
            </div>

            {apiFormData.waGatewayProvider === 'wablas' && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                  URL Server Wablas
                </label>
                <input
                  type="text"
                  value={apiFormData.wablasServerUrl}
                  onChange={(e) => setApiFormData({ ...apiFormData, wablasServerUrl: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-700 rounded-xl text-sm font-mono text-green-400 bg-slate-950 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://smg.wablas.com"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
              {apiFormData.waGatewayProvider === 'wablas' ? 'Wablas API Key (Token.Secret)' : 'WhatsApp Token (Fonnte API)'}
            </label>
            <input
              type="text"
              value={apiFormData.whatsappApiKey}
              onChange={(e) =>
                setApiFormData({ ...apiFormData, whatsappApiKey: e.target.value })
              }
              className="w-full px-4 py-3 border border-slate-700 rounded-xl text-sm font-mono text-green-400 bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-700"
              placeholder={apiFormData.waGatewayProvider === 'wablas' ? 'token...secret' : 'Masukkan Token Fonnte...'}
            />
            {apiFormData.waGatewayProvider === 'wablas' && (
              <p className="text-[11px] text-amber-400 mt-1.5 font-medium">
                💡 Format Wablas digabung dengan titik: <code className="bg-slate-800 px-1 py-0.5 rounded text-white">token.secret</code> (Contoh: <code className="bg-slate-800 px-1 py-0.5 rounded text-white">f1nsc3bxt...09s1E.ZT5frc0v</code>)
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
              URL Web App Google Apps Script (Email)
            </label>
            <input
              type="text"
              value={apiFormData.gasWebAppUrl}
              onChange={(e) =>
                setApiFormData({ ...apiFormData, gasWebAppUrl: e.target.value })
              }
              className="w-full px-4 py-3 border border-slate-700 rounded-xl text-sm font-mono text-green-400 bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-700"
              placeholder="https://script.google.com/macros/s/.../exec"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSavingApi}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-70 cursor-pointer"
            >
              <Save size={18} />
              {isSavingApi ? "Menyimpan..." : "Simpan Konfigurasi API"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden max-w-4xl mt-6">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
          <Sparkles className="text-amber-400" size={24} />
          <div>
            <h3 className="font-bold text-white text-lg">Konfigurasi AI (Groq)</h3>
            <p className="text-xs text-slate-400">Pengaturan API Key untuk Live CS Helpdesk & AI Analytics.</p>
          </div>
        </div>

        <form onSubmit={handleSaveGroqConfig} className="space-y-5 relative z-10">
          <div>
            <label className="block text-xs font-black text-amber-300 uppercase tracking-wider mb-2">
              API KEY GROQ CLOUD (OTAK AI AGENT LIVE CHAT)
            </label>
            <div className="relative">
              <input
                type={showGroqCSKey ? "text" : "password"}
                value={groqCSApiKey}
                onChange={(e) => setGroqCSApiKey(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-slate-700 rounded-xl text-sm font-mono text-amber-400 bg-slate-950 focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-700"
                placeholder="gsk_..."
              />
              <button
                type="button"
                onClick={() => setShowGroqCSKey(!showGroqCSKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400 transition-colors"
              >
                {showGroqCSKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
              Groq API Key (AI Analytics & Executive Briefing)
            </label>
            <div className="relative">
              <input
                type={showGroqAnalyticsKey ? "text" : "password"}
                value={groqAnalyticsApiKey}
                onChange={(e) => setGroqAnalyticsApiKey(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-slate-700 rounded-xl text-sm font-mono text-amber-400 bg-slate-950 focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-700"
                placeholder="gsk_..."
              />
              <button
                type="button"
                onClick={() => setShowGroqAnalyticsKey(!showGroqAnalyticsKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400 transition-colors"
              >
                {showGroqAnalyticsKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSavingGroq}
              className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-600/30 disabled:opacity-70 cursor-pointer"
            >
              <Save size={18} />
              {isSavingGroq ? "Menyimpan..." : "Simpan Konfigurasi Groq"}
            </button>
          </div>
        </form>
      </div>

      {/* Card Baru: Konfigurasi Tampilan */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden max-w-4xl mt-6">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
          <Monitor className="text-blue-400" size={24} />
          <div>
            <h3 className="font-bold text-white text-lg">Konfigurasi Tampilan (Landing Page)</h3>
            <p className="text-xs text-slate-400">Pengaturan video demo dan elemen visual Landing Page.</p>
          </div>
        </div>

        <form onSubmit={handleSaveLandingConfig} className="space-y-5 relative z-10">
          <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 space-y-2">
            <label className="block text-xs font-black text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
              URL Video Demo YouTube (Landing Page)
            </label>
            <input
              type="text"
              value={demoVideoUrl}
              onChange={(e) => setDemoVideoUrl(e.target.value)}
              className="w-full px-4 py-3 border border-blue-500/50 rounded-xl text-sm font-mono text-blue-200 bg-slate-950 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600"
              placeholder="Contoh: https://www.youtube.com/watch?v=..."
            />
            <p className="text-[11px] text-blue-300 leading-relaxed">
              💡 URL YouTube untuk ditampilkan di Landing Page publik. Anda dapat memasukkan link YouTube biasa, dan sistem akan otomatis mengubahnya menjadi format embed. Biarkan kosong untuk menyembunyikan video.
            </p>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSavingDisplay}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 disabled:opacity-70 cursor-pointer"
            >
              <Save size={18} />
              {isSavingDisplay ? "Menyimpan..." : "Simpan Konfigurasi Tampilan"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
