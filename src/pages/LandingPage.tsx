import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, MapPin, QrCode, FileText, CheckCircle2, ArrowRight, Smartphone, Users, Zap, Clock, Star, Lock, HelpCircle, PhoneCall, Gift, ChevronDown, ChevronLeft, ChevronRight, Check, Award, X, Shield, Play, Pause, RotateCcw, Volume2, Video, Layers, MessageCircle, Send, Sparkles, Building2, Monitor, BarChart3, PieChart, Laptop, CreditCard, UserCheck, Calendar, Bell, AlertTriangle, Quote, LogOut, Settings, Bot, Menu, Copy, UploadCloud, Receipt } from 'lucide-react';
import { db } from '../lib/db';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useGlobalSettings } from '../hooks/useGlobalSettings';
import toast from 'react-hot-toast';
import { TESTIMONIALS_DATA, TestimonialItem } from '../data/testimonialsData';

/**
 * Ekstrak Video ID dari berbagai format URL YouTube dan
 * kembalikan URL embed yang valid. Mendukung:
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/live/VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID (sudah valid, dikembalikan apa adanya)
 */
function formatYouTubeUrl(url: string): string | null {
  if (!url) return null;
  const regex = /(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  if (!match) return null;
  return `https://www.youtube.com/embed/${match[1]}`;
}

interface AiChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

export function LandingPage() {
  useDocumentTitle('ABDI — Solusi Presensi Digital Terpadu Sekolah');
  const school = db.getSchool();
  const { settings: globalSettings } = useGlobalSettings();
  const brandName = school.name || 'ABDI Absen Digital';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [activeLegalModal, setActiveLegalModal] = useState<string | null>(null);
  const [activeDemoTab, setActiveDemoTab] = useState<'monitor' | 'geofence' | 'report'>('monitor');
  const [activeTestiCategory, setActiveTestiCategory] = useState<'semua' | 'pimpinan' | 'guru' | 'staf'>('semua');
  const [testiSlideIdx, setTestiSlideIdx] = useState(0);
  const [isAutoPlayTesti, setIsAutoPlayTesti] = useState(true);
  const [itemsPerView, setItemsPerView] = useState(3);
  const [realTestimonials, setRealTestimonials] = useState<TestimonialItem[]>(() => {
    try {
      const saved = localStorage.getItem('abdi_real_testimonials');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isTestiModalOpen, setIsTestiModalOpen] = useState(false);
  const [newTestiForm, setNewTestiForm] = useState({
    name: '', role: 'Kepala Sekolah / Rektor', school: '', location: '', rating: 5, highlight: '', quote: '', avatarUrl: ''
  });

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

  const [isEditLandingModalOpen, setIsEditLandingModalOpen] = useState(false);
  const [editLandingForm, setEditLandingForm] = useState(landingConfig);

  // ── Layanan Pelanggan State & Logic ──
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([
    {
      id: '1', sender: 'ai', text: 'Halo! 👋 Saya Tim Layanan Pelanggan ABDI. Ada yang dapat kami bantu terkait fitur, pilihan paket, atau panduan aktivasi untuk instansi Bapak/Ibu?', time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [aiInputText, setAiInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);

  const handleSendAiMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInputText.trim()) return;

    const userMsg: AiChatMessage = { id: Date.now().toString(), sender: 'user', text: aiInputText.trim(), time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) };
    setAiMessages(prev => [...prev, userMsg]);
    const query = aiInputText.trim().toLowerCase();
    const currentInput = aiInputText.trim();
    setAiInputText('');
    setIsAiTyping(true);

    const activeGeminiKey = (landingConfig as any).geminiApiKey || (db.getSchool() as any).geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('abdi_gemini_api_key') || "";

    if (activeGeminiKey) {
      try {
        const historyPayload = aiMessages.slice(-6).map(m => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeGeminiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: `Anda adalah Tim Layanan Pelanggan profesional aplikasi "ABDI Absensi Digital". Sapa pengguna dengan "Bapak/Ibu". ATURAN: 1. Jangan mengaku sebagai AI. 2. Jawab ringkas. PENGETAHUAN PRODUK: Tersedia Uji Coba Gratis 14 Hari & Paket Full (Infaq Seikhlasnya). WA resmi: +${landingConfig.waHelpdesk}.` }] },
            contents: [...historyPayload, { role: 'user', parts: [{ text: currentInput }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
          })
        });
        if (response.ok) {
          const data = await response.json();
          const geminiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (geminiText) {
            setAiMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'ai', text: geminiText, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }]);
            setIsAiTyping(false); return;
          }
        }
      } catch (err) { console.warn("Live Gemini LLM error, falling back:", err); }
    }

    setTimeout(() => {
      let replyText = 'Terima kasih atas pertanyaannya. 😊 Silakan mulai dengan menekan tombol "Klaim Uji Coba Gratis 14 Hari" di halaman utama.';
      if (query.includes('harga') || query.includes('biaya') || query.includes('paket') || query.includes('infaq')) replyText = 'Kami menyediakan 2 opsi:\n1. Paket Uji Coba: GRATIS 14 Hari.\n2. Paket Full (Infaq Seikhlasnya): Akses fitur penuh dengan kontribusi sukarela. 😊';
      else if (query.includes('trial') || query.includes('gratis')) replyText = 'Paket Uji Coba 100% GRATIS selama 14 Hari, Bapak/Ibu. Dapat digunakan menguji keandalan GPS & Selfie. 👍';
      else if (query.includes('kontak') || query.includes('hubungi') || query.includes('cs')) replyText = `Tentu, Bapak/Ibu! Untuk konsultasi via WhatsApp, silakan hubungi tim kami di: +${landingConfig.waHelpdesk}`;

      setAiMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'ai', text: replyText, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }]);
      setIsAiTyping(false);
    }, 1200);
  };

  const handleSaveLandingConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setLandingConfig(editLandingForm);
    localStorage.setItem('abdi_landing_config', JSON.stringify(editLandingForm));
    setIsEditLandingModalOpen(false);
    toast.success("✨ Konfigurasi Landing Page berhasil disimpan!");
  };

  const allTestimonialsData = React.useMemo(() => [...realTestimonials, ...TESTIMONIALS_DATA], [realTestimonials]);
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

  const handleAddRealTestimony = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestiForm.name || !newTestiForm.quote) return toast.error("Mohon lengkapi nama dan ulasan Anda.");
    const newEntry: TestimonialItem = {
      id: `real-${Date.now()}`, name: newTestiForm.name, role: newTestiForm.role, school: newTestiForm.school || 'Instansi Terdaftar', location: newTestiForm.location || 'Indonesia', avatar: newTestiForm.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(newTestiForm.name)}`, rating: Number(newTestiForm.rating), highlight: newTestiForm.highlight || 'Terverifikasi Nyata', quote: newTestiForm.quote,
    };
    const updated = [newEntry, ...realTestimonials];
    setRealTestimonials(updated);
    localStorage.setItem('abdi_real_testimonials', JSON.stringify(updated));
    setIsTestiModalOpen(false);
    toast.success("✨ Testimoni Anda berhasil dipublikasikan!");
  };

  const handleDeleteRealTesti = (id: string) => {
    const updated = realTestimonials.filter(t => t.id !== id);
    setRealTestimonials(updated);
    localStorage.setItem('abdi_real_testimonials', JSON.stringify(updated));
    toast.success("Testimoni berhasil dihapus.");
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

  // ── FORM LEAD GENERATION STATE ──
  const [leadName, setLeadName] = useState('');
  const [leadSchool, setLeadSchool] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadSize, setLeadSize] = useState('30-100');
  const [isLeadSubmitted, setIsLeadSubmitted] = useState(false);

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName || !leadPhone || !leadSchool) return toast.error('Mohon lengkapi seluruh kolom yang diwajibkan.');
    setIsLeadSubmitted(true);
    toast.success('Permintaan Berhasil! Tim ahli kami akan segera menghubungi Bapak/Ibu.');
  };

  // ── SISTEM PEMBAYARAN PROFESIONAL (CHECKOUT/INVOICE STATE) ──
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1);
  const [checkoutForm, setCheckoutForm] = useState({
    name: '', school: '', email: '', wa: '', amount: '150000', method: 'BCA_VA'
  });
  const [orderId, setOrderId] = useState('');
  // paymentProof tidak dipakai karena kita beralih ke Midtrans penuh, namun dipertahankan untuk kompatibilitas fungsi.
  const [paymentProof, setPaymentProof] = useState<string | null>(null);

  const handleOpenCheckout = () => {
    setCheckoutStep(1);
    setIsCheckoutOpen(true);
  };

  const generateOrderId = () => {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    const randomStr = Math.floor(1000 + Math.random() * 9000);
    return `INV-${dateStr}-${randomStr}`;
  };

  // FUNGSI INI TELAH DI-UPDATE UNTUK MEMANGGIL API NETLIFY & MIDTRANS SNAP
  const handleCheckoutProcess = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!checkoutForm.name || !checkoutForm.school || !checkoutForm.wa || !checkoutForm.amount) {
      toast.error('Mohon lengkapi rincian pesanan terlebih dahulu.');
      return;
    }
    if (parseInt(checkoutForm.amount) < 50000) {
      toast.error('Mohon maaf, nominal infaq minimal adalah Rp 50.000.');
      return;
    }

    const toastId = toast.loading('Membangun koneksi aman ke gerbang pembayaran...');
    const newOrderId = generateOrderId();
    setOrderId(newOrderId);

    try {
      // 1. Menggunakan URL Endpoint dari Netlify Functions
      const functionUrl = '/.netlify/functions/createTransaction';

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: newOrderId,
          amount: checkoutForm.amount,
          name: checkoutForm.name,
          email: checkoutForm.email,
          phone: checkoutForm.wa,
          school: checkoutForm.school
        })
      });

      const data = await response.json();
      toast.dismiss(toastId);

      if (data.token) {
        // 2. Tutup Modal Manual Kita
        setIsCheckoutOpen(false);

        // 3. Panggil Popup Resmi dari Midtrans menggunakan SDK Window
        (window as any).snap.pay(data.token, {
          onSuccess: function (result: any) {
            toast.success("Alhamdulillah! Pembayaran Infaq Instansi Bapak/Ibu berhasil diproses.");
          },
          onPending: function (result: any) {
            toast.success("Tagihan dibuat! Silakan selesaikan pembayaran Bapak/Ibu.");
          },
          onError: function (result: any) {
            toast.error("Maaf, pembayaran gagal diproses.");
          },
          onClose: function () {
            toast.error("Bapak/Ibu menutup jendela pembayaran sebelum menyelesaikannya.");
          }
        });
      } else {
        toast.error('Gagal mendapatkan token pembayaran dari server.');
      }
    } catch (error) {
      toast.dismiss(toastId);
      toast.error('Terjadi kesalahan jaringan. Gagal terhubung ke peladen Netlify.');
      console.error(error);
    }
  };

  const handleCopyVa = () => {
    let va = "123456789012";
    if (checkoutForm.method === 'BCA_VA') va = "3901" + checkoutForm.wa.slice(-8);
    if (checkoutForm.method === 'MANDIRI_VA') va = "89508" + checkoutForm.wa.slice(-8);
    if (checkoutForm.method === 'BRI_VA') va = "2201" + checkoutForm.wa.slice(-8);

    navigator.clipboard.writeText(va);
    toast.success('Nomor Virtual Account berhasil disalin!');
  };

  const handleUploadProof = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast.error("Ukuran bukti transfer maksimal 3 MB.");

    const reader = new FileReader();
    reader.onloadend = () => {
      setPaymentProof(reader.result as string);
      toast.success('Bukti pembayaran berhasil diunggah.');
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmPayment = () => {
    setCheckoutStep(3);
    setTimeout(() => {
      const waMessage = `Halo Tim Finance ABDI,%0A%0ASaya telah melakukan pembayaran Infaq untuk sistem absensi. Berikut rinciannya:%0A%0A*Order ID:* ${orderId}%0A*Instansi:* ${checkoutForm.school}%0A*Nama:* ${checkoutForm.name}%0A*Email:* ${checkoutForm.email}%0A*Nominal:* Rp ${parseInt(checkoutForm.amount).toLocaleString('id-ID')}%0A*Metode:* ${checkoutForm.method}%0A%0AMohon bantuan untuk verifikasi dan aktivasi lisensi kami. Terima kasih.`;
      window.open(`https://wa.me/${landingConfig.waHelpdesk}?text=${waMessage}`, '_blank');
      toast.success('Pembayaran sedang diproses! Menuju WhatsApp Admin untuk verifikasi akhir.');
    }, 1500);
  };

  const formatCurrency = (value: string) => {
    const num = parseInt(value.replace(/\D/g, '')) || 0;
    return num.toLocaleString('id-ID');
  };

  // ── KONTEN DINAMIS (FAQs & Legal) ──
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
            <a href="#faq" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 hover:text-blue-600">❓ Pusat Bantuan</a>
          </div>
        )}
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 lg:pt-24 lg:pb-32 px-6 overflow-hidden bg-gradient-to-b from-blue-50/60 via-white to-slate-50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">

          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100/80 text-blue-700 text-[10px] sm:text-xs font-extrabold border border-blue-200 shadow-sm">
              <Zap size={14} className="text-amber-500 fill-amber-500" /> Presensi Digital Multi-Akses Berbasis Awan
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.15]">
              {landingConfig.heroTitleText} <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">{landingConfig.heroTitleHighlight}</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
              {landingConfig.heroSubtitle}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
              <Link to="/login" className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-black shadow-xl shadow-blue-600/30 hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2.5">
                🚀 Mulai Uji Coba Gratis <ArrowRight size={16} />
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-[11px] sm:text-xs font-bold text-slate-500 pt-3">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Pengaturan Cepat</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Tanpa Kartu Kredit</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> Bebas Kontrak</span>
            </div>
          </div>

          <div className="lg:col-span-5 relative flex items-center justify-center mt-6 lg:mt-0">
            <div className="absolute w-64 h-64 sm:w-72 sm:h-72 bg-blue-400/20 rounded-full blur-3xl -z-10 animate-pulse" />
            <div className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 relative">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 sm:mb-5">
                <div className="flex items-center gap-2 sm:gap-3">
                  <img src="/logo-abdi.png" alt="Logo" className="w-8 h-8 sm:w-9 sm:h-9 object-contain" />
                  <div><h4 className="font-black text-slate-900 text-xs sm:text-sm">ABDI Absensi Digital</h4><p className="text-[9px] sm:text-[10px] text-slate-400 font-bold">Sinkronisasi Kehadiran &bull; Instansi Terpadu</p></div>
                </div>
                <span className="px-2 py-1 sm:px-2.5 sm:py-1 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-[9px] sm:text-[10px] flex items-center gap-1 shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Terhubung</span>
              </div>
              <div className="relative rounded-2xl overflow-hidden mb-4 shadow-inner h-[280px] md:h-[360px] border border-slate-200 bg-slate-100">
                <iframe title="Google Maps Geofence" src={`https://maps.google.com/maps?q=Bintang%20Kembar%20MDL-525&z=18&output=embed&t=m`} className="absolute inset-0 w-full h-full border-0 pointer-events-none" allowFullScreen loading="lazy"></iframe>
                <div className="absolute inset-0 bg-blue-900/5 pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-40 sm:h-48 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent pointer-events-none" />
                <div className="relative z-10 h-full flex flex-col justify-end p-3">
                  <div className="bg-slate-900/85 backdrop-blur-md rounded-xl p-3 border border-slate-700/50 shadow-2xl text-center space-y-2">
                    <div><p className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Titik Koordinat Valid</p><p className="text-[10px] sm:text-[11px] font-black text-emerald-400 font-mono mt-0.5">Dalam Radius 48m</p></div>
                    <div className="w-full py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-[9px] sm:text-[10px] shadow-lg flex items-center justify-center gap-1.5"><ShieldCheck size={14} /> ABSENSI MASUK BERHASIL</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 text-center">
                <div className="bg-slate-50 p-2 sm:p-3 rounded-xl border border-slate-100"><p className="text-[9px] sm:text-[10px] text-slate-400 font-bold">Validasi Geofence</p><p className="text-[11px] sm:text-xs font-black text-slate-800">Aktif & Terlindungi</p></div>
                <div className="bg-slate-50 p-2 sm:p-3 rounded-xl border border-slate-100"><p className="text-[9px] sm:text-[10px] text-slate-400 font-bold">Laporan Rekapitulasi</p><p className="text-[11px] sm:text-xs font-black text-blue-600">Siap Diunduh</p></div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Stats Strip ── */}
      <section className="bg-blue-900 text-white py-8 md:py-12 px-6 shadow-md">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 text-center md:divide-x divide-blue-800/60">
          <div className="p-2">
            <p className="text-2xl sm:text-3xl md:text-4xl font-black text-white">Multi-Akses</p>
            <p className="text-[10px] sm:text-xs text-blue-200 font-bold mt-1">Integrasi Kantor Pusat & Cabang</p>
          </div>
          <div className="p-2">
            <p className="text-2xl sm:text-3xl md:text-4xl font-black text-amber-300">Otomatisasi</p>
            <p className="text-[10px] sm:text-xs text-blue-200 font-bold mt-1">Sinkronisasi Kehadiran Luring</p>
          </div>
          <div className="p-2">
            <p className="text-2xl sm:text-3xl md:text-4xl font-black text-emerald-300">Portabilitas</p>
            <p className="text-[10px] sm:text-xs text-blue-200 font-bold mt-1">Lancar di Ponsel & Komputer</p>
          </div>
          <div className="p-2">
            <p className="text-2xl sm:text-3xl md:text-4xl font-black text-sky-300">Validitas</p>
            <p className="text-[10px] sm:text-xs text-blue-200 font-bold mt-1">Geotagging & Keamanan Lokasi</p>
          </div>
        </div>
      </section>

      {/* ── Fitur Utama Grid ── */}
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

      {/* ── DEMO DASBOR INTERAKTIF ── */}
      <section id="demo" className="py-16 md:py-24 px-6 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto space-y-8 md:space-y-12 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
              <Laptop size={14} /> Video Demo Sistem
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">Kenyamanan Pengelolaan Instansi</h2>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">
              Tonton video demonstrasi berikut untuk melihat betapa mudahnya mengelola presensi dengan platform kami.
            </p>
          </div>

          <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden select-none text-left p-2 sm:p-4">
            {globalSettings?.demo_video_url ? (
              <div className="relative pb-[56.25%] h-0 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800">
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src={formatYouTubeUrl(globalSettings.demo_video_url) ?? ''}
                  title="Video Demo"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center text-slate-500 bg-slate-900 rounded-2xl border border-slate-800 p-6 text-center">
                <Video size={48} className="mb-4 opacity-50" />
                <h3 className="text-lg font-bold">Video Demo Segera Hadir</h3>
                <p className="text-sm mt-2 opacity-80">Video demonstrasi sedang dipersiapkan dan akan segera tersedia.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Cara Kerja 3 Langkah ── */}
      <section id="carakerja" className="py-16 md:py-24 px-6 bg-slate-100/70 border-y border-slate-200">
        <div className="max-w-6xl mx-auto space-y-10 md:space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-blue-600">Pelaksanaan Praktis</h2>
            <p className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Kesiapan Platform Terhitung Menit</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-md border border-slate-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-lg">1</div>
              <h4 className="font-black text-slate-900 text-base md:text-lg">Pengaturan Lokasi Inti</h4>
              <p className="text-[11px] sm:text-xs text-slate-600 font-medium">Buat akun instansi dan tentukan koordinat pusat gedung beserta radius toleransi kehadiran GPS.</p>
            </div>
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-md border border-slate-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-lg">2</div>
              <h4 className="font-black text-slate-900 text-base md:text-lg">Penyebaran Akses Pegawai</h4>
              <p className="text-[11px] sm:text-xs text-slate-600 font-medium">Sistem mendaftarkan profil staf. Pimpinan cukup membagikan tautan aplikasi ke grup komunikasi staf internal.</p>
            </div>
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-md border border-slate-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-lg">3</div>
              <h4 className="font-black text-slate-900 text-base md:text-lg">Laporan Terpusat Otomatis</h4>
              <p className="text-[11px] sm:text-xs text-slate-600 font-medium">Staf melakukan presensi via ponsel masing-masing. Hasil pemantauan langsung direkap sempurna ke meja admin.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PAKET HARGA (Pricing Tiers) DENGAN SISTEM PEMBAYARAN PROFESIONAL ── */}
      <section id="harga" className="py-16 md:py-24 px-6 max-w-7xl mx-auto space-y-10 md:space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-8 md:mb-16">
          <h2 className="text-xs font-black uppercase tracking-widest text-blue-600">Investasi Transparan</h2>
          <p className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Pilih Paket Sesuai Kebutuhan</p>
          <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
            Mulai dengan uji coba gratis, lalu lanjutkan dengan kontribusi operasional (infaq) seikhlasnya. Tanpa tarif kaku, tanpa beban anggaran bulanan.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-12 max-w-4xl mx-auto items-stretch">

          {/* Tier 1: TRIAL */}
          <div className="bg-white rounded-[2rem] p-6 lg:p-10 border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col relative hover:border-blue-400 transition-all duration-300 h-full">
            <div className="space-y-5 flex-1">
              <div>
                <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">Tahap Penjajakan Awal</span>
                <h3 className="text-2xl md:text-3xl font-black text-slate-900 mt-4">Paket Uji Coba</h3>
                <p className="text-[11px] md:text-xs text-slate-500 mt-1.5 font-medium leading-relaxed">Eksplorasi seluruh fitur utama secara gratis.</p>
              </div>
              <div className="py-4 border-y border-slate-100">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Rp 0</span>
                  <span className="text-[10px] md:text-xs font-bold text-slate-400">/ 14 Hari</span>
                </div>
              </div>
              <ul className="space-y-3.5 text-[11px] md:text-xs text-slate-600 font-medium">
                <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 shrink-0 mt-0.5" /> <span>Masa uji coba penuh <strong>14 Hari</strong>.</span></li>
                <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 shrink-0 mt-0.5" /> <span>Kapasitas hingga <strong>10 Pegawai</strong>.</span></li>
                <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 shrink-0 mt-0.5" /> <span>Geofencing GPS &amp; Validasi Wajah.</span></li>
                <li className="flex items-start gap-3"><Check size={16} className="text-emerald-500 shrink-0 mt-0.5" /> <span>Keamanan Otentikasi WhatsApp 2FA.</span></li>
              </ul>
            </div>
            <Link to="/login" className="w-full py-3.5 mt-8 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-black text-xs text-center shadow-sm transition-all block">
              Mulai Uji Coba
            </Link>
          </div>

          {/* Tier 2: PREMIUM */}
          <div className="bg-slate-900 text-white rounded-[2rem] p-6 lg:p-10 border-2 border-amber-400 shadow-2xl flex flex-col relative md:scale-105 mt-6 md:mt-0 transition-all duration-300 h-full overflow-visible">

            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 px-4 py-1.5 rounded-full text-[10px] font-black uppercase shadow-lg flex items-center gap-1.5 whitespace-nowrap z-20">
              <Sparkles size={14} className="animate-spin-slow" /> Pilihan Terpopuler
            </div>

            <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl" />
              <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
            </div>

            <div className="space-y-5 flex-1 relative z-10 pt-2 md:pt-0">
              <div>
                <span className="px-3 py-1.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase tracking-wider border border-amber-400/20">Kontribusi Sukarela</span>
                <h3 className="text-2xl md:text-3xl font-black text-white mt-4">Akses Premium</h3>
                <p className="text-[11px] md:text-xs text-slate-300 mt-1.5 font-medium leading-relaxed">Kapasitas total untuk menunjang kedisiplinan penuh.</p>
              </div>
              <div className="py-4 border-y border-slate-700/80">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400 tracking-tight">Infaq Seikhlasnya</span>
                </div>
                <p className="text-[10px] md:text-[11px] text-amber-200/80 font-medium mt-2 leading-relaxed">
                  *Alokasi dana difokuskan untuk pemeliharaan server awan.
                </p>
              </div>
              <ul className="space-y-3.5 text-[11px] md:text-xs text-slate-200 font-medium pb-4">
                <li className="flex items-start gap-3"><CheckCircle2 size={16} className="text-amber-400 shrink-0 mt-0.5" /> <span><strong>Kapasitas Pegawai Tanpa Batas</strong>.</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 size={16} className="text-amber-400 shrink-0 mt-0.5" /> <span>Masa aktif <strong>1 Tahun</strong> (Dapat diperpanjang).</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 size={16} className="text-amber-400 shrink-0 mt-0.5" /> <span>Akses eksklusif ke seluruh modul.</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 size={16} className="text-amber-400 shrink-0 mt-0.5" /> <span>Ekspor Laporan Resmi (Excel &amp; PDF).</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 size={16} className="text-amber-400 shrink-0 mt-0.5" /> <span>Jalur Bantuan Prioritas (WA Langsung).</span></li>
              </ul>
            </div>

            {/* Tombol yang memicu Checkout Modal */}
            <button
              onClick={handleOpenCheckout}
              className="relative z-10 w-full py-3.5 mt-8 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs text-center shadow-xl shadow-amber-500/20 transition-all block"
            >
              Aktifkan Paket Premium
            </button>
          </div>

        </div>
      </section>

      {/* ── Testimoni & Bukti Klien ── */}
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

        {/* Filter Pills */}
        <div className="flex flex-nowrap sm:flex-wrap items-center justify-start sm:justify-center gap-2 pt-2 overflow-x-auto pb-4 snap-x custom-scrollbar">
          <button onClick={() => setActiveTestiCategory('semua')} className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-extrabold transition-all shadow-sm shrink-0 snap-center whitespace-nowrap ${activeTestiCategory === 'semua' ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20 scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>🌟 Semua Ulasan ({allTestimonialsData.length})</button>
          <button onClick={() => setActiveTestiCategory('pimpinan')} className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-extrabold transition-all shadow-sm shrink-0 snap-center whitespace-nowrap ${activeTestiCategory === 'pimpinan' ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20 scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>👑 Pimpinan / Yayasan (9)</button>
          <button onClick={() => setActiveTestiCategory('guru')} className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-extrabold transition-all shadow-sm shrink-0 snap-center whitespace-nowrap ${activeTestiCategory === 'guru' ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20 scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>👨‍🏫 Tenaga Pendidik (3)</button>
          <button onClick={() => setActiveTestiCategory('staf')} className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-extrabold transition-all shadow-sm shrink-0 snap-center whitespace-nowrap ${activeTestiCategory === 'staf' ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20 scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>💼 Staf Administrasi (3)</button>
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

        {/* Testimonials Slide Track */}
        <div className="overflow-hidden relative w-full py-4 -mx-3 px-3">
          <div className="flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${testiSlideIdx * (100 / itemsPerView)}%)` }}>
            {filteredTestimonials.map((item, idx) => {
              const isReal = item.id.startsWith('real-');
              const dummy3DIcons = [
                "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Star-Struck.png",
                "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Smiling%20Face%20with%20Hearts.png",
                "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Smiling%20Face%20with%20Sunglasses.png",
                "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Beaming%20Face%20with%20Smiling%20Eyes.png",
                "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Partying%20Face.png",
                "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Smiling%20Face%20with%20Halo.png"
              ];
              const displayAvatar = isReal ? item.avatar : dummy3DIcons[idx % dummy3DIcons.length];

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
                        <img src={displayAvatar} alt={item.name} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${isReal ? 'object-cover border-2 border-indigo-200 shadow-md' : 'object-contain bg-indigo-50 border border-indigo-100 p-1.5 shadow-sm drop-shadow-md'} transition-all`} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                        <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white shadow-sm"><CheckCircle2 size={10} /></div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between"><h5 className="font-black text-slate-900 text-xs sm:text-sm">{item.name}</h5>{isReal && (<button onClick={() => handleDeleteRealTesti(item.id)} className="text-[9px] sm:text-[10px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-md">🗑️ Hapus</button>)}</div>
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
      </section>

      {/* ── FAQ Section ── */}
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

      {/* ── Footer ── */}
      <footer className="py-10 sm:py-12 px-6 border-t border-slate-200 text-center text-xs text-slate-500 space-y-6 bg-white">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
          <img src="/logo-abdi.png" alt="Logo" className="w-5 h-5 sm:w-6 sm:h-6 object-contain grayscale opacity-60" />
          <span className="font-black text-slate-700 tracking-wider text-[10px] sm:text-xs">Sistem Presensi Resmi ABDI Terpadu</span>
        </div>
        <p className="font-medium text-[9px] sm:text-[10px]">&copy; 2026 Hak Cipta Dilindungi Undang-Undang.</p>
      </footer>

      {/* ── SISTEM PEMBAYARAN PROFESIONAL (CHECKOUT & INVOICE MODALS) ── */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in">

          {checkoutStep === 1 && (
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300 max-h-[90vh] md:max-h-[85vh]">
              {/* Kiri: Ringkasan Pesanan */}
              <div className="bg-slate-900 text-white p-6 sm:p-8 md:w-5/12 flex flex-col justify-between shrink-0 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10">
                  <h3 className="text-xl sm:text-2xl font-black mb-2">Rincian Tagihan</h3>
                  <p className="text-slate-400 text-xs sm:text-sm font-medium mb-8">Penyelesaian aktivasi lisensi sistem ABDI.</p>

                  <div className="space-y-4">
                    <div className="bg-white/10 p-4 rounded-xl border border-white/10">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Paket Pilihan</p>
                      <p className="text-base sm:text-lg font-black text-amber-400">Akses Premium (Infaq)</p>
                      <p className="text-xs text-slate-300 mt-1">Kapasitas Unlimited &bull; 1 Tahun Ajaran</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-700/80 relative z-10">
                  <div className="flex justify-between items-center text-sm font-bold text-slate-300 mb-2">
                    <span>Subtotal</span>
                    <span>Rp {formatCurrency(checkoutForm.amount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-slate-300 mb-4">
                    <span>Pajak Sistem</span>
                    <span>Rp 0</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-bold text-slate-300">Total Pembayaran</span>
                    <span className="text-2xl sm:text-3xl font-black text-white">Rp {formatCurrency(checkoutForm.amount)}</span>
                  </div>
                </div>
              </div>

              {/* Kanan: Form Data Diri & Pembayaran */}
              <div className="p-6 sm:p-8 md:w-7/12 bg-white overflow-y-auto custom-scrollbar flex-1">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">Informasi Pembeli</h3>
                  <button onClick={() => setIsCheckoutOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"><X size={16} /></button>
                </div>

                <form onSubmit={handleCheckoutProcess} className="space-y-5 text-xs sm:text-sm font-bold text-slate-700">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div>
                      <label className="block mb-1.5 text-slate-600">Nama Pimpinan / PIC <span className="text-red-500">*</span></label>
                      <input type="text" required value={checkoutForm.name} onChange={e => setCheckoutForm({ ...checkoutForm, name: e.target.value })} placeholder="Contoh: Budi Santoso" className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-medium" />
                    </div>
                    <div>
                      <label className="block mb-1.5 text-slate-600">Nama Instansi <span className="text-red-500">*</span></label>
                      <input type="text" required value={checkoutForm.school} onChange={e => setCheckoutForm({ ...checkoutForm, school: e.target.value })} placeholder="Contoh: SMA Terpadu" className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-medium" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div>
                      <label className="block mb-1.5 text-slate-600">Email Instansi <span className="text-red-500">*</span></label>
                      <input type="email" required value={checkoutForm.email} onChange={e => setCheckoutForm({ ...checkoutForm, email: e.target.value })} placeholder="admin@sekolah.sch.id" className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-medium" />
                    </div>
                    <div>
                      <label className="block mb-1.5 text-slate-600">No. WhatsApp <span className="text-red-500">*</span></label>
                      <input type="tel" required value={checkoutForm.wa} onChange={e => setCheckoutForm({ ...checkoutForm, wa: e.target.value })} placeholder="08123456789" className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-mono" />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block mb-1.5 text-slate-600">Nominal Infaq Sukarela (Rp) <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">Rp</span>
                      <input type="text" required value={formatCurrency(checkoutForm.amount)} onChange={e => setCheckoutForm({ ...checkoutForm, amount: e.target.value.replace(/\D/g, '') })} className="w-full p-3 pl-12 rounded-xl border-2 border-amber-300 bg-amber-50 focus:border-amber-500 outline-none font-black text-slate-900 text-lg sm:text-xl tracking-tight" />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-1.5">Nominal minimal yang dianjurkan adalah Rp 50.000 untuk kelancaran administrasi server.</p>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <label className="block mb-3 text-slate-600">Pilih Metode Pembayaran</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div onClick={() => setCheckoutForm({ ...checkoutForm, method: 'BCA_VA' })} className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${checkoutForm.method === 'BCA_VA' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <CreditCard className={checkoutForm.method === 'BCA_VA' ? 'text-blue-600' : 'text-slate-400'} />
                        <span className="text-[10px] sm:text-xs text-center font-bold">BCA Virtual Account</span>
                      </div>
                      <div onClick={() => setCheckoutForm({ ...checkoutForm, method: 'MANDIRI_VA' })} className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${checkoutForm.method === 'MANDIRI_VA' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <CreditCard className={checkoutForm.method === 'MANDIRI_VA' ? 'text-blue-600' : 'text-slate-400'} />
                        <span className="text-[10px] sm:text-xs text-center font-bold">Mandiri Virtual Account</span>
                      </div>
                      <div onClick={() => setCheckoutForm({ ...checkoutForm, method: 'BRI_VA' })} className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${checkoutForm.method === 'BRI_VA' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <CreditCard className={checkoutForm.method === 'BRI_VA' ? 'text-blue-600' : 'text-slate-400'} />
                        <span className="text-[10px] sm:text-xs text-center font-bold">BRI Virtual Account</span>
                      </div>
                      <div onClick={() => setCheckoutForm({ ...checkoutForm, method: 'QRIS' })} className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${checkoutForm.method === 'QRIS' ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <QrCode className={checkoutForm.method === 'QRIS' ? 'text-emerald-500' : 'text-slate-400'} />
                        <span className="text-[10px] sm:text-xs text-center font-bold">QRIS (Semua Bank/E-Wallet)</span>
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="w-full py-4 mt-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-2">
                    Buat Tagihan (Invoice) <ArrowRight size={16} />
                  </button>
                </form>
              </div>
            </div>
          )}

          {checkoutStep === 2 && (
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-300 relative text-center">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

              <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
                <Receipt size={32} />
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Faktur Tersimpan!</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 mb-6">Selesaikan pembayaran sebelum batas waktu berakhir.</p>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-left space-y-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-400">Order ID</span>
                  <span className="text-xs font-black text-slate-800 font-mono bg-slate-200 px-2 py-0.5 rounded">{orderId}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-400">Metode</span>
                  <span className="text-xs font-black text-blue-600">{checkoutForm.method.replace('_', ' ')}</span>
                </div>

                <div className="pt-4 border-t border-slate-200 text-center">
                  <p className="text-[11px] font-bold text-slate-500 mb-2">Total Pembayaran</p>
                  <p className="text-3xl font-black text-slate-900 tracking-tight mb-4">Rp {formatCurrency(checkoutForm.amount)}</p>

                  {checkoutForm.method.includes('VA') ? (
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 mb-1.5">Nomor Virtual Account</p>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg sm:text-xl font-mono font-black text-slate-800 bg-white border border-slate-300 px-4 py-2 rounded-xl">
                          {checkoutForm.method === 'BCA_VA' ? '3901' : checkoutForm.method === 'MANDIRI_VA' ? '89508' : '2201'}
                          {checkoutForm.wa.slice(-8)}
                        </span>
                        <button onClick={handleCopyVa} className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors" title="Salin Nomor VA">
                          <Copy size={18} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 inline-block mx-auto">
                      <QrCode size={120} className="text-slate-800 mx-auto" />
                      <p className="text-[10px] font-bold text-slate-400 mt-2">Scan QRIS melalui M-Banking/E-Wallet</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 mb-6 flex items-center gap-3">
                <Clock className="text-amber-500 shrink-0" size={24} />
                <div className="text-left">
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Batas Pembayaran</p>
                  <p className="text-xs sm:text-sm font-black text-amber-600 font-mono">23 : 59 : 59</p>
                </div>
              </div>

              <button onClick={() => setCheckoutStep(3)} className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm shadow-xl transition-all mb-3">
                Saya Sudah Membayar
              </button>
              <button onClick={() => setIsCheckoutOpen(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600">Batal / Bayar Nanti</button>
            </div>
          )}

          {checkoutStep === 3 && (
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-8 animate-in slide-in-from-right-8 duration-300 relative text-center">
              <button onClick={() => setIsCheckoutOpen(false)} className="absolute right-4 top-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors"><X size={16} /></button>

              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={32} />
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Verifikasi Pembayaran</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 mb-6">Unggah tangkapan layar (screenshot) atau foto bukti transfer untuk mempercepat aktivasi lisensi.</p>

              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 mb-6 hover:bg-slate-50 hover:border-blue-400 transition-colors relative cursor-pointer group">
                <input type="file" accept="image/*" onChange={handleUploadProof} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                {paymentProof ? (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto"><CheckCircle2 size={24} /></div>
                    <p className="text-xs font-bold text-emerald-600">Bukti Transfer Dilampirkan</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform"><UploadCloud size={24} /></div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">Klik untuk mengunggah bukti bayar</p>
                      <p className="text-[10px] text-slate-400 mt-1">Format JPG, PNG (Maks 3MB)</p>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleConfirmPayment}
                disabled={!paymentProof}
                className="w-full py-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-50 disabled:grayscale text-white font-black text-sm shadow-xl shadow-green-500/20 transition-all flex items-center justify-center gap-2"
              >
                Kirim via WhatsApp Admin <MessageCircle size={16} />
              </button>
              <p className="text-[10px] text-slate-400 font-medium mt-4">Admin kami akan memvalidasi bukti Anda secara instan dan mengaktifkan akun sekolah/instansi Anda.</p>
            </div>
          )}

        </div>
      )}

      {/* ── Live Chat Window ── */}
      {isAiChatOpen && (
        <div className="fixed bottom-20 sm:bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[360px] h-[450px] sm:h-[500px] max-h-[80vh] bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden animate-fade-in text-left">
          <div className="bg-gradient-to-r from-[#b829ff] via-[#7928CA] to-[#5e1e9d] p-3 sm:p-4 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2 sm:gap-3">
              <img src="/cs-avatar.png" onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=Layanan+Pelanggan&background=7928CA&color=fff&bold=true'; }} alt="Layanan Pelanggan" className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl object-cover border border-white/40 shadow-inner bg-purple-100" />
              <div>
                <div className="flex items-center gap-1.5"><h4 className="font-black text-xs sm:text-sm">Pusat Layanan Pelanggan</h4><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-ping" /></div>
                <p className="text-[9px] sm:text-[10px] text-purple-200 font-medium">Tim Dukungan &bull; Aktif</p>
              </div>
            </div>
            <button onClick={() => setIsAiChatOpen(false)} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"><X size={16} /></button>
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
            <input type="text" value={aiInputText} onChange={(e) => setAiInputText(e.target.value)} placeholder="Tuliskan keluhan atau pertanyaan..." className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-100 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-2xl text-[11px] sm:text-xs font-semibold outline-none" />
            <button type="submit" disabled={!aiInputText.trim()} className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-r from-[#b829ff] to-[#7928CA] disabled:opacity-50 text-white flex items-center justify-center shadow-md"><Send size={14} className="sm:w-4 sm:h-4" /></button>
          </form>
        </div>
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

      {/* ── Floating Edit Button ── */}
      {isDevMode && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 animate-fade-in">
          <button onClick={() => { setEditLandingForm(landingConfig); setIsEditLandingModalOpen(true); }} className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-black text-[10px] sm:text-xs shadow-2xl hover:scale-105 transition-all flex items-center gap-1.5 sm:gap-2 animate-bounce ring-4 ring-purple-500/30">
            ✏️ Edit Laman Depan
          </button>
          <button onClick={() => { setIsDevMode(false); localStorage.setItem('abdi_dev_mode_landing', 'false'); toast.success("Sesi Pengembang Dimatikan."); }} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-900/90 hover:bg-red-600 text-white font-black text-xs shadow-xl transition-all flex items-center justify-center border border-slate-700" title="Keluar Mode Ahli">✕</button>
        </div>
      )}

      {/* ── Modal Edit Konten Landing Page ── */}
      {isEditLandingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-8 shadow-2xl border border-slate-200 space-y-4 sm:space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 sm:pb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 font-black text-base sm:text-lg shadow-md">🛠️</div>
                <div><h3 className="font-black text-sm sm:text-lg text-slate-900 leading-tight">Pengaturan Laman Promosi</h3><p className="text-[9px] sm:text-xs text-slate-500 font-medium">Batas Ruang Khusus Pengembang</p></div>
              </div>
              <button onClick={() => setIsEditLandingModalOpen(false)} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"><X size={16} className="sm:w-[18px] sm:h-[18px]" /></button>
            </div>

            <form onSubmit={handleSaveLandingConfig} className="space-y-3 sm:space-y-4 max-h-[65vh] overflow-y-auto pr-2 text-left text-[11px] sm:text-xs font-bold custom-scrollbar">
              <div>
                <label className="block mb-1 sm:mb-1.5 text-slate-700">Teks Pita Promosi Atas (Promo Bar)</label>
                <input type="text" value={editLandingForm.promoBar} onChange={e => setEditLandingForm({ ...editLandingForm, promoBar: e.target.value })} className="w-full px-3 sm:px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none font-medium text-slate-800" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 sm:mb-1.5 text-slate-700">Gagasan Slogan Netral (Hitam)</label>
                  <input type="text" value={editLandingForm.heroTitleText} onChange={e => setEditLandingForm({ ...editLandingForm, heroTitleText: e.target.value })} className="w-full px-3 sm:px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none font-medium text-slate-800" />
                </div>
                <div>
                  <label className="block mb-1 sm:mb-1.5 text-slate-700">Penegasan Kata Kunci (Gradasi Bersinar)</label>
                  <input type="text" value={editLandingForm.heroTitleHighlight} onChange={e => setEditLandingForm({ ...editLandingForm, heroTitleHighlight: e.target.value })} className="w-full px-3 sm:px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none font-medium text-slate-800" />
                </div>
              </div>

              <div>
                <label className="block mb-1 sm:mb-1.5 text-slate-700">Ringkasan Deskripsi Teks Bawah Judul</label>
                <textarea rows={3} value={editLandingForm.heroSubtitle} onChange={e => setEditLandingForm({ ...editLandingForm, heroSubtitle: e.target.value })} className="w-full px-3 sm:px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none font-medium text-slate-800 custom-scrollbar" />
              </div>

              <div className="border-t border-slate-200 pt-3">
                <h4 className="text-slate-800 font-black text-sm mb-2">Penyesuaian Konfigurasi Kontak</h4>
              </div>

              <div>
                <label className="block mb-1 sm:mb-1.5 text-slate-700">Nomor WhatsApp Pusat Bantuan (Format Tanpa '+' Awal)</label>
                <input type="text" value={editLandingForm.waHelpdesk} onChange={e => setEditLandingForm({ ...editLandingForm, waHelpdesk: e.target.value })} placeholder="Contoh: 6282297585638" className="w-full px-3 sm:px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none font-medium text-slate-800" />
              </div>

              <div>
                <label className="block mb-1 sm:mb-1.5 text-slate-700">Token API Google Gemini LLM Pemrosesan Interaksi <span className="text-purple-600 font-bold">(Opsional)</span></label>
                <input type="text" value={(editLandingForm as any).geminiApiKey || ""} onChange={e => { const val = e.target.value; setEditLandingForm({ ...editLandingForm, geminiApiKey: val } as any); localStorage.setItem('abdi_gemini_api_key', val); }} placeholder="Contoh: AIzaSyD..." className="w-full px-3 sm:px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none font-mono text-xs text-purple-700 bg-purple-50/50" />
                <p className="text-[9px] sm:text-[10px] text-slate-500 font-normal mt-1 leading-relaxed">Apabila dikosongkan, kotak sapaan pengguna eksternal akan dioperasikan secara mandiri terbatas berdasarkan pustaka kueri internal aplikasi.</p>
              </div>

              <div className="pt-2 sm:pt-3 flex gap-2 sm:gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsEditLandingModalOpen(false)} className="flex-1 py-2.5 sm:py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black transition-all">Batal</button>
                <button type="submit" className="flex-1 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-black shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-1.5">💾 Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}