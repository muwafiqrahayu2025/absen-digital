import React, { useState, useEffect, useRef } from "react";
import { Settings, Save, AlertTriangle, Monitor, Globe, Shield, PenTool } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { ref, onValue, update } from "firebase/database";
import { dbRealtime } from "../../lib/firebase"; 
import { db } from "../../lib/db";
import { useGlobalSettings } from "../../hooks/useGlobalSettings";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

export function SystemConfiguration() {
  useDocumentTitle("Konfigurasi Sistem");
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam || 'general';
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    platformName: "Absen Digital SaaS",
    isMaintenance: false,
    waFallbackEnabled: true,
    maxTenants: 0,
    isUnlimited: true
  });

  const prevMaxTenants = useRef(100);

  const school: any = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 });
  const { settings: globalSettings, updateSettings } = useGlobalSettings();

  const [apiFormData, setApiFormData] = useState({
    whatsappApiKey: school.whatsappApiKey || "",
    gasWebAppUrl: school.gasWebAppUrl || import.meta.env.VITE_GAS_EMAIL_URL || "https://script.google.com/macros/s/AKfycbxFdrxQCGEIXs5KE7MxQEw03ly4e_LWRBF5kflgpG4CGhzAdtRHcxj45AbH6d8q87ej/exec",
    waGatewayProvider: school.waGatewayProvider || "wablas",
    wablasServerUrl: school.wablasServerUrl || "https://smg.wablas.com",
    aiProvider: school.aiProvider || "gemini",
    aiCsApiKey: school.aiCsApiKey || school.aiApiKey || (school as any).geminiApiKey || localStorage.getItem('abdi_gemini_api_key') || "",
    aiAnalyticsApiKey: school.aiAnalyticsApiKey || "",
  });

  const [isSavingApi, setIsSavingApi] = useState(false);

  useEffect(() => {
    if (globalSettings) {
      if (globalSettings.aiProvider) {
        setApiFormData(prev => ({ ...prev, aiProvider: globalSettings.aiProvider }));
      }
      if (globalSettings.aiCsApiKey) {
        setApiFormData(prev => ({ ...prev, aiCsApiKey: globalSettings.aiCsApiKey }));
      } else if (globalSettings.aiApiKey) {
        setApiFormData(prev => ({ ...prev, aiCsApiKey: globalSettings.aiApiKey }));
      }
      if (globalSettings.aiAnalyticsApiKey) {
        setApiFormData(prev => ({ ...prev, aiAnalyticsApiKey: globalSettings.aiAnalyticsApiKey }));
      }
    }
  }, [globalSettings]);


  const handleSaveApi = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingApi(true);
    try {
      const updatedSchool = {
        ...school,
        ...apiFormData,
      };
      db.setSchool(updatedSchool);
      
      if (apiFormData.aiCsApiKey && apiFormData.aiProvider === 'gemini') {
        localStorage.setItem('abdi_gemini_api_key', apiFormData.aiCsApiKey);
      } else {
        localStorage.removeItem('abdi_gemini_api_key');
      }

      // Update to Firebase Realtime Database
      const configRef = ref(dbRealtime, 'global_settings/config');
      await update(configRef, {
        aiProvider: apiFormData.aiProvider,
        aiCsApiKey: apiFormData.aiCsApiKey,
        aiAnalyticsApiKey: apiFormData.aiAnalyticsApiKey
      });

      toast.success("Konfigurasi API Berhasil Diperbarui!");
    } catch {
      toast.error("Gagal menyimpan konfigurasi API.");
    } finally {
      setIsSavingApi(false);
    }
  };

  useEffect(() => {
    const configRef = ref(dbRealtime, 'global_settings/config');
    const unsubscribe = onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        const loadedMaxTenants = data.maxTenants !== undefined ? Number(data.maxTenants) : 0;
        const isUnlim = loadedMaxTenants === 0;
        if (!isUnlim) {
          prevMaxTenants.current = loadedMaxTenants;
        }
        
        setFormData({
          platformName: data.platformName || "Absen Digital SaaS",
          isMaintenance: data.isMaintenance || false,
          waFallbackEnabled: data.waFallbackEnabled !== false,
          maxTenants: loadedMaxTenants,
          isUnlimited: isUnlim
        });
      } else {
        // Defaults
        setFormData({
          platformName: "Absen Digital SaaS",
          isMaintenance: false,
          waFallbackEnabled: true,
          maxTenants: 0,
          isUnlimited: true
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error loading config:", error);
      toast.error("Gagal memuat konfigurasi");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUnlimitedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setFormData((prev) => ({
      ...prev,
      isUnlimited: checked,
      maxTenants: checked ? 0 : prevMaxTenants.current
    }));
  };

  const handleMaxTenantsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value, 10);
    const value = isNaN(raw) ? 0 : raw;
    if (value > 0) {
      prevMaxTenants.current = value;
    }
    setFormData((prev) => ({
      ...prev,
      maxTenants: value
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const toastId = toast.loading("Menyimpan konfigurasi sistem...");
    setIsSaving(true);
    
    try {
      const configRef = ref(dbRealtime, 'global_settings/config');
      const dataToSave = {
        platformName: formData.platformName,
        isMaintenance: formData.isMaintenance,
        waFallbackEnabled: formData.waFallbackEnabled,
        maxTenants: formData.isUnlimited ? 0 : Number(formData.maxTenants),
        updatedAt: new Date().toISOString()
      };
      
      await update(configRef, dataToSave);
      toast.success("Konfigurasi sistem berhasil disimpan.", { id: toastId });
    } catch (error: any) {
      console.error("Error saving config:", error);
      toast.error(`Gagal menyimpan: ${error.message}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Settings className="text-indigo-600" size={28} />
            Konfigurasi Sistem
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Pengaturan variabel global platform SaaS. Perubahan berdampak pada semua pengguna (Super Admin only).
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400 font-bold animate-pulse">
          Memuat konfigurasi...
        </div>
      ) : activeTab === 'general' && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Globe className="text-blue-500" size={20} />
                <h3 className="font-bold text-slate-800">Pengaturan Umum</h3>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Platform SaaS</label>
                <input
                  type="text"
                  required
                  value={formData.platformName}
                  onChange={(e) => setFormData({ ...formData, platformName: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all bg-slate-50 focus:bg-white"
                  placeholder="Misal: Absensi Digital Ku"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Batas Maksimal Instansi (Tenants)</label>
                <div className="flex items-center gap-4">
                  <input
                    id="max-tenants-input"
                    type="number"
                    min="1"
                    max="1000000000"
                    required={!formData.isUnlimited}
                    disabled={formData.isUnlimited}
                    value={formData.isUnlimited ? "" : formData.maxTenants || ""}
                    onChange={handleMaxTenantsChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm transition-all bg-slate-50 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    placeholder="Contoh: 100"
                  />
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer whitespace-nowrap">
                    <input 
                      id="unlimited-tenants-checkbox"
                      type="checkbox"
                      checked={formData.isUnlimited}
                      onChange={handleUnlimitedChange}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    Unlimited
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Shield className="text-rose-500" size={20} />
                <h3 className="font-bold text-slate-800">Pengaturan Lanjutan & Keamanan</h3>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-150">
                <div>
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                    Maintenance Mode
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Aktifkan untuk menangguhkan sementara akses klien.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.isMaintenance}
                    onChange={(e) => setFormData({ ...formData, isMaintenance: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-150">
                <div>
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Monitor size={16} className="text-emerald-500" />
                    WhatsApp Fallback 
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Izinkan klien tanpa API menggunakan link wa.me.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.waFallbackEnabled}
                    onChange={(e) => setFormData({ ...formData, waFallbackEnabled: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={18} />
              {isSaving ? "Menyimpan Perubahan..." : "Simpan Semua Konfigurasi"}
            </button>
          </div>
        </form>
      )}

      {/* Konfigurasi API Fonnte */}
      {!loading && activeTab === 'api-fonnte' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden mt-0 max-w-4xl animate-fade-in">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
            <Shield className="text-indigo-400" size={24} />
            <div>
              <h3 className="font-bold text-white text-lg">API WhatsApp (Fonnte)</h3>
              <p className="text-xs text-slate-400">Pengaturan token untuk gateway Fonnte.</p>
            </div>
          </div>

          <form onSubmit={(e) => {
            if (apiFormData.waGatewayProvider !== 'fonnte') {
              setApiFormData(prev => ({ ...prev, waGatewayProvider: 'fonnte' }));
            }
            handleSaveApi(e);
          }} className="space-y-5 relative z-10">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                WhatsApp Token (Fonnte API)
              </label>
              <input
                type="text"
                value={apiFormData.whatsappApiKey}
                onChange={(e) =>
                  setApiFormData({ ...apiFormData, whatsappApiKey: e.target.value })
                }
                className="w-full px-4 py-3 border border-slate-700 rounded-xl text-sm font-mono text-green-400 bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-700"
                placeholder="Masukkan Token Fonnte..."
              />
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
              <input 
                type="radio" 
                checked={apiFormData.waGatewayProvider === 'fonnte'} 
                onChange={() => setApiFormData({ ...apiFormData, waGatewayProvider: 'fonnte' })}
                className="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-700 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer" 
              />
              <span className="text-sm font-medium text-slate-300">Jadikan Fonnte sebagai Gateway Utama WhatsApp saat ini</span>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSavingApi}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-70 cursor-pointer"
              >
                <Save size={18} />
                {isSavingApi ? "Menyimpan..." : "Simpan Konfigurasi Fonnte"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Konfigurasi API Wablas */}
      {!loading && activeTab === 'api-wablas' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden mt-0 max-w-4xl animate-fade-in">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
            <Shield className="text-indigo-400" size={24} />
            <div>
              <h3 className="font-bold text-white text-lg">API WhatsApp (Wablas)</h3>
              <p className="text-xs text-slate-400">Pengaturan token & server untuk gateway Wablas API v2.</p>
            </div>
          </div>

          <form onSubmit={(e) => {
            if (apiFormData.waGatewayProvider !== 'wablas') {
              setApiFormData(prev => ({ ...prev, waGatewayProvider: 'wablas' }));
            }
            handleSaveApi(e);
          }} className="space-y-5 relative z-10">
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

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                Wablas API Key (Token.Secret)
              </label>
              <input
                type="text"
                value={apiFormData.whatsappApiKey}
                onChange={(e) =>
                  setApiFormData({ ...apiFormData, whatsappApiKey: e.target.value })
                }
                className="w-full px-4 py-3 border border-slate-700 rounded-xl text-sm font-mono text-green-400 bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-700"
                placeholder="token...secret"
              />
              <p className="text-[11px] text-amber-400 mt-1.5 font-medium">
                💡 Format Wablas digabung dengan titik: <code className="bg-slate-800 px-1 py-0.5 rounded text-white">token.secret</code>
              </p>
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
              <input 
                type="radio" 
                checked={apiFormData.waGatewayProvider === 'wablas'} 
                onChange={() => setApiFormData({ ...apiFormData, waGatewayProvider: 'wablas' })}
                className="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-700 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer" 
              />
              <span className="text-sm font-medium text-slate-300">Jadikan Wablas sebagai Gateway Utama WhatsApp saat ini</span>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSavingApi}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-70 cursor-pointer"
              >
                <Save size={18} />
                {isSavingApi ? "Menyimpan..." : "Simpan Konfigurasi Wablas"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Konfigurasi API AI */}
      {!loading && activeTab === 'api-ai' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden mt-0 max-w-4xl animate-fade-in">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
            <Shield className="text-indigo-400" size={24} />
            <div>
              <h3 className="font-bold text-white text-lg">API Artificial Intelligence</h3>
              <p className="text-xs text-slate-400">Pengaturan model dan kunci API untuk AI Helpdesk & Analytics.</p>
            </div>
          </div>

          <form onSubmit={handleSaveApi} className="space-y-5 relative z-10">
            <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 space-y-4">
              <div>
                <label className="block text-xs font-black text-purple-300 uppercase tracking-wider mb-2">
                  API KEY AI (LIVE CS HELPDESK)
                </label>
                <input
                  type="text"
                  value={apiFormData.aiCsApiKey}
                  onChange={(e) =>
                    setApiFormData({ ...apiFormData, aiCsApiKey: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-purple-500/50 rounded-xl text-sm font-mono text-purple-200 bg-slate-950 focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder:text-slate-600"
                  placeholder={apiFormData.aiProvider === 'gemini' ? "Masukkan API Key Gemini..." : "Masukkan API Key Groq..."}
                />
                <p className="text-[11px] text-purple-300 leading-relaxed mt-2">
                  💡 {apiFormData.aiProvider === 'gemini' 
                    ? 'Masukkan API Key untuk agen chatbot interaktif (Google Gemini).' 
                    : 'Masukkan API Key untuk agen chatbot interaktif (Groq Cloud).'}
                </p>
              </div>

              <div className="pt-2 border-t border-purple-500/30">
                <label className="block text-xs font-black text-purple-300 uppercase tracking-wider mb-2 mt-2">
                  API KEY AI (DATA ANALYTICS)
                </label>
                <input
                  type="text"
                  value={apiFormData.aiAnalyticsApiKey}
                  onChange={(e) =>
                    setApiFormData({ ...apiFormData, aiAnalyticsApiKey: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-purple-500/50 rounded-xl text-sm font-mono text-purple-200 bg-slate-950 focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder:text-slate-600"
                  placeholder="Masukkan API Key untuk pemrosesan data..."
                />
                <p className="text-[11px] text-purple-300 leading-relaxed mt-2">
                  💡 Masukkan API Key untuk pemrosesan dan analisis data laporan presensi tingkat lanjut (AI Analytics).
                </p>
              </div>
            </div>
            
            {/* Let's put GAS Email Script here or in general settings? Let's add it here at the bottom of AI config or separate box */}
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                  URL Web App Google Apps Script (Email Notification)
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
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSavingApi}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-70 cursor-pointer"
              >
                <Save size={18} />
                {isSavingApi ? "Menyimpan..." : "Simpan Konfigurasi AI & Email"}
              </button>
            </div>
          </form>
        </div>
      )}


    </div>
  );
}
