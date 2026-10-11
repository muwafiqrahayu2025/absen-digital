import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Gift, ArrowRight, Menu, X, Shield, Bot, MessageCircle } from 'lucide-react';
import { db as firestoreDb } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { dbRealtime } from '../lib/firebase';
import { ref, onValue } from 'firebase/database';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useGlobalSettings } from '../hooks/useGlobalSettings';
import toast from 'react-hot-toast';

// Import Child Components
import { HeroSection } from '../components/LandingPage/HeroSection';
import { FeaturesSection } from '../components/LandingPage/FeaturesSection';
import { DemoTabsSection } from '../components/LandingPage/DemoTabsSection';
import { PricingSection } from '../components/LandingPage/PricingSection';
import { TestimonialsSection } from '../components/LandingPage/TestimonialsSection';
import { FAQSection } from '../components/LandingPage/FAQSection';
import { FooterSection } from '../components/LandingPage/FooterSection';
import { AiChatModal } from '../components/LandingPage/AiChatModal';
import { CheckoutModal } from '../components/LandingPage/CheckoutModal';
import { EditLandingConfigModal } from '../components/LandingPage/EditLandingConfigModal';

export function LandingPage() {
  useDocumentTitle('ABDI — Solusi Presensi Digital Terpadu Sekolah');
  const school: any = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
  const { settings: globalSettings } = useGlobalSettings();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeLegalModal, setActiveLegalModal] = useState<string | null>(null);

  const [isDevMode, setIsDevMode] = useState(() => {
    try { return localStorage.getItem('abdi_dev_mode_landing') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    const checkDevMode = () => {
      try { setIsDevMode(localStorage.getItem('abdi_dev_mode_landing') === 'true'); } catch { /* ignore */ }
    };
    checkDevMode();
    window.addEventListener('storage', checkDevMode);
    return () => window.removeEventListener('storage', checkDevMode);
  }, []);

  const [landingConfig, setLandingConfig] = useState(() => {
    const defaultConfig = {
      promoBar: "PROMO EKSKLUSIF: Aplikasi Absensi Terpadu, Sinkronisasi Luring, & Siap Diinstal di Android!",
      heroTitleText: "Ekosistem Presensi Digital,",
      heroTitleHighlight: "Pusat & Cabang Terpadu.",
      heroSubtitle: "Tersedia dalam versi Web Terpusat, Semi-Daring (sinkronisasi offline otomatis), dan Aplikasi Android mandiri untuk para pendidik yang dapat diinstal langsung di perangkat.",
      waHelpdesk: "6282297585638",
      geminiApiKey: ""
    };
    try {
      const saved = localStorage.getItem('abdi_landing_config');
      const parsed = saved ? JSON.parse(saved) : null;
      if (!parsed) {
        localStorage.setItem('abdi_landing_config', JSON.stringify(defaultConfig));
        return defaultConfig;
      }
      return { ...defaultConfig, ...parsed };
    } catch {
      return defaultConfig;
    }
  });

  useEffect(() => {
    const configRef = ref(dbRealtime, 'global_settings/landingConfig');
    const unsubscribe = onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setLandingConfig((prev: any) => ({ ...prev, ...data }));
      }
    });
    return () => unsubscribe();
  }, []);

  const [quickLinks, setQuickLinks] = useState<{title: string, url: string}[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(doc(firestoreDb, 'system_config', 'landing_page'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().quickLinks) {
        setQuickLinks(docSnap.data().quickLinks);
      }
    });
    return () => unsub();
  }, []);

  const [isEditLandingModalOpen, setIsEditLandingModalOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // ── KONTEN DINAMIS (Legal) ──
  const legalContent: Record<string, { title: string; content: React.ReactNode }> = {
    tnc: {
      title: "Syarat & Ketentuan Layanan",
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-800">
          <p>Dengan mengakses platform ABDI, Instansi Anda menyetujui ketentuan layanan kami.</p>
          <p>Keamanan akun admin dan kebenaran data kepegawaian sepenuhnya menjadi tanggung jawab institusi terdaftar.</p>
          <p>ABDI menjamin ketersediaan peladen (Uptime SLA) mencapai 99.8% setiap bulannya di luar jam pemeliharaan terjadwal.</p>
        </div>
      )
    },
    privacy: {
      title: "Kebijakan Privasi",
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-800">
          <p>Kami memegang teguh privasi data instansi. Informasi kepegawaian, riwayat absensi, dan swafoto tidak akan pernah didistribusikan kepada pihak ketiga.</p>
          <p>Sistem hanya merekam data geolokasi GPS secara eksklusif pada detik tombol absensi ditekan.</p>
        </div>
      )
    },
    security: {
      title: "Kebijakan Keamanan",
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-800">
          <p>Seluruh transmisi data dienkripsi menggunakan protokol SSL/TLS 256-Bit standar industri perbankan.</p>
          <p>Kata sandi diproses dengan sistem kriptografi hashing sebelum disimpan ke server, memastikan tidak ada data mentah yang dapat diakses sembarangan.</p>
        </div>
      )
    },
    eula: {
      title: "Lisensi Pengguna Akhir (EULA)",
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-800">
          <p>Lisensi non-eksklusif diberikan kepada instansi selama mematuhi ketentuan layanan perangkat lunak ABDI.</p>
          <p>Dilarang keras melakukan manipulasi, reverse engineering, atau penyalinan kode sumber aplikasi untuk tujuan komersial sepihak.</p>
        </div>
      )
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-600 selection:text-white relative">
      {/* ── Top Promo Bar ── */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-[11px] sm:text-xs font-extrabold py-2.5 px-4 text-center shadow-sm relative z-50 flex items-center justify-center gap-2">
        <Gift size={15} className="text-amber-300 shrink-0" />
        <span>{landingConfig.promoBar}</span>
        <Link to="/login" className="underline ml-1 hover:text-amber-200 transition-colors hidden sm:inline">Coba Sekarang &rarr;</Link>
      </div>

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2 sm:gap-3 text-left cursor-pointer group shrink-0">
            <img src="/logo-abdi.png" alt="Logo ABDI" className="w-8 h-8 sm:w-11 sm:h-11 object-contain drop-shadow-sm group-hover:scale-105 transition-transform" />
            <div>
              <span className="font-black text-base sm:text-xl tracking-tight text-slate-900">ABDI</span>
              <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-slate-400 -mt-0.5 sm:-mt-1">Absen Digital</p>
            </div>
          </button>

          <div className="hidden lg:flex items-center gap-8 text-xs font-extrabold text-slate-600">
            <a href="#fitur" className="hover:text-blue-600 transition-colors">Fitur Sistem</a>
            <a href="#jadwaldemo" className="hover:text-blue-600 transition-colors">Pratinjau</a>
            <a href="#harga" className="hover:text-blue-600 transition-colors">Paket Langganan</a>
            <a href="#testimoni" className="hover:text-blue-600 transition-colors">Ulasan Klien</a>
            <a href="#faq" className="hover:text-blue-600 transition-colors">Pusat Bantuan</a>
            <div className="relative group cursor-pointer flex items-center">
              <span className="hover:text-blue-600 transition-colors">Link</span>
              <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-100 shadow-xl rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                <div className="py-2 flex flex-col">
                  {quickLinks && quickLinks.length > 0 ? (
                    quickLinks.map((link, idx) => (
                      <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                        {link.title}
                      </a>
                    ))
                  ) : (
                    <span className="px-4 py-2 text-sm font-medium text-slate-400 italic">Belum ada link</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/20 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-1.5 shrink-0">
              <span>Masuk Portal</span> <ArrowRight size={14} className="hidden sm:inline" />
            </Link>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-6 py-4 space-y-3 shadow-xl animate-fade-in text-xs font-extrabold text-slate-700">
            <a href="#fitur" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 border-b border-slate-100 hover:text-blue-600">✨ Fitur Sistem</a>
            <a href="#jadwaldemo" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 border-b border-slate-100 hover:text-blue-600">💻 Minta Demo</a>
            <a href="#harga" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 border-b border-slate-100 hover:text-blue-600">💰 Paket Langganan</a>
            <a href="#testimoni" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 border-b border-slate-100 hover:text-blue-600">⭐ Ulasan Klien</a>
            <a href="#faq" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 border-b border-slate-100 hover:text-blue-600">❓ Pusat Bantuan</a>
            {quickLinks.length > 0 && (
              <div className="py-2 border-b border-slate-100">
                <div className="text-slate-700 mb-2 flex items-center gap-2">
                  <span>🔗</span> Link
                </div>
                <div className="pl-6 space-y-1">
                  {quickLinks.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block py-2 text-slate-500 hover:text-blue-600 font-medium"
                    >
                      {link.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Sections Extracted */}
      <HeroSection landingConfig={landingConfig} />
      
      {/* Stats Strip Componentized in HeroSection earlier or we can just leave it? Wait, I didn't extract Stats Strip. I should extract it or just keep it in FeaturesSection. Let's see if FeaturesSection has it. If not, it might be missing. I will check FeaturesSection. */}
      <FeaturesSection />
      <DemoTabsSection landingConfig={landingConfig} />
      <PricingSection onOpenCheckout={() => setIsCheckoutOpen(true)} />
      <TestimonialsSection />
      <FAQSection />
      
      {/* legal modals */}
      <div className="py-10 text-center flex flex-col md:flex-row items-center justify-center gap-4 text-xs font-bold text-slate-500">
         <button onClick={() => setActiveLegalModal('tnc')} className="hover:text-blue-600">Syarat & Ketentuan</button>
         <button onClick={() => setActiveLegalModal('privacy')} className="hover:text-blue-600">Kebijakan Privasi</button>
         <button onClick={() => setActiveLegalModal('security')} className="hover:text-blue-600">Keamanan Data</button>
         <button onClick={() => setActiveLegalModal('eula')} className="hover:text-blue-600">EULA</button>
      </div>

      <FooterSection />

      {/* ── Modals ── */}
      <AiChatModal isOpen={isAiChatOpen} onClose={() => setIsAiChatOpen(false)} />
      {isCheckoutOpen && <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} landingConfig={landingConfig} />}
      {isEditLandingModalOpen && (
        <EditLandingConfigModal 
          landingConfig={landingConfig} 
          setLandingConfig={setLandingConfig} 
          isOpen={isEditLandingModalOpen} 
          onClose={() => setIsEditLandingModalOpen(false)} 
        />
      )}

      {/* ── Floating Chat Button ── */}
      <button
        onClick={() => setIsAiChatOpen(!isAiChatOpen)}
        className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 bg-white hover:bg-slate-50 text-slate-800 p-3 sm:p-4 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.18)] hover:-translate-y-1 transition-all duration-300 flex items-center justify-center group cursor-pointer border border-slate-200"
        title="Layanan Bantuan Pelanggan"
      >
        <div className="relative flex items-center justify-center">
          <MessageCircle size={28} className="sm:w-8 sm:h-8 text-blue-600" strokeWidth={1.5} />
          <Bot size={14} className="sm:w-4 sm:h-4 text-blue-600 absolute" strokeWidth={2} />
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-emerald-500 border-2 border-white"></span>
          </span>
        </div>
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-500 font-bold text-xs sm:text-sm group-hover:pl-3 text-slate-700">Pusat Bantuan</span>
      </button>

      {/* ── Modal Dokumen Legal ── */}
      {activeLegalModal && legalContent[activeLegalModal] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-4 sm:space-y-6 text-left relative shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 sm:pb-4">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <Shield className="text-blue-600 w-4 h-4 sm:w-5 sm:h-5" />
                <h3 className="font-black text-slate-900 text-sm sm:text-base">{legalContent[activeLegalModal].title}</h3>
              </div>
              <button onClick={() => setActiveLegalModal(null)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl bg-slate-100"><X size={16} className="sm:w-[18px] sm:h-[18px]" /></button>
            </div>
            <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">{legalContent[activeLegalModal].content}</div>
            <button onClick={() => setActiveLegalModal(null)} className="w-full py-3 sm:py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm text-center shadow-md transition-all">Saya Mengerti & Setuju</button>
          </div>
        </div>
      )}

      {/* ── Floating Edit Button ── */}
      {isDevMode && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 animate-fade-in">
          <button onClick={() => { setIsEditLandingModalOpen(true); }} className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-black text-[10px] sm:text-xs shadow-2xl hover:scale-105 transition-all flex items-center gap-1.5 sm:gap-2 animate-bounce ring-4 ring-purple-500/30">
            ✏️ Edit Laman Depan
          </button>
          <button onClick={() => { setIsDevMode(false); localStorage.setItem('abdi_dev_mode_landing', 'false'); toast.success("Sesi Pengembang Dimatikan."); }} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-900/90 hover:bg-red-600 text-white font-black text-xs shadow-xl transition-all flex items-center justify-center border border-slate-700" title="Keluar Mode Ahli">✕</button>
        </div>
      )}
    </div>
  );
}
