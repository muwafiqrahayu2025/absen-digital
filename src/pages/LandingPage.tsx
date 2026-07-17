import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, MapPin, QrCode, FileText, CheckCircle2, ArrowRight, Smartphone, Users, Zap, Clock, Star, Lock, HelpCircle, PhoneCall, Gift, ChevronDown, ChevronLeft, ChevronRight, Check, Award, X, Shield, Play, Pause, RotateCcw, Volume2, Video, Layers, MessageCircle, Send, Sparkles, Building2, Monitor, BarChart3, PieChart, Laptop, CreditCard, UserCheck, Calendar, Bell, AlertTriangle, Quote, LogOut, Settings, Bot, Menu } from 'lucide-react';
import { db } from '../lib/db';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import toast from 'react-hot-toast';
import { TESTIMONIALS_DATA, TestimonialItem } from '../data/testimonialsData';
import { promptDesktopInstall } from '../lib/pwaInstall';

interface AiChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

export function LandingPage() {
  useDocumentTitle('ABDI — Solusi Presensi Digital Terpadu Sekolah');
  const school = db.getSchool();
  const brandName = school.name || 'ABDI Absen Digital';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [activeLegalModal, setActiveLegalModal] = useState<string | null>(null);
  const [activeDemoTab, setActiveDemoTab] = useState<'monitor' | 'geofence' | 'report'>('monitor');
  const [isAnnualBilling, setIsAnnualBilling] = useState(false);
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
    name: '',
    role: 'Kepala Sekolah / Rektor',
    school: '',
    location: '',
    rating: 5,
    highlight: '',
    quote: '',
    avatarUrl: ''
  });

  // Developer Mode & Landing Page Editing State
  const [isDevMode, setIsDevMode] = useState(() => {
    try {
      return localStorage.getItem('abdi_dev_mode_landing') === 'true';
    } catch { return false; }
  });

  useEffect(() => {
    const checkDevMode = () => {
      try {
        setIsDevMode(localStorage.getItem('abdi_dev_mode_landing') === 'true');
      } catch { /* ignore */ }
    };
    checkDevMode();
    window.addEventListener('storage', checkDevMode);
    return () => window.removeEventListener('storage', checkDevMode);
  }, []);

  const [landingConfig, setLandingConfig] = useState(() => {
    const defaultConfig = {
      promoBar: "PROMO EKSKLUSIF: Aplikasi Absensi Multi-Online (Pusat & Cabang), Semi-Online, & Siap Instal di Android!",
      heroTitleText: "Ekosistem Absensi Multi-Online,",
      heroTitleHighlight: "Pusat & Cabang Terpadu.",
      heroSubtitle: "Aplikasi absensi digital yang mendukung sistem multi-online (pusat & cabang). Online (Web Aplikasi), semi-online (sinkronisasi offline), dan aplikasi Android (khusus guru, staf, dan Kepala sekolah) yang bisa di instal.",
      priceStarterReg: "149.000",
      priceStarterAnn: "119.000",
      priceProReg: "349.000",
      priceProAnn: "279.000",
      priceEntReg: "799.000",
      priceEntAnn: "639.000",
      waHelpdesk: "6282297585638",
      geminiApiKey: ""
    };
    try {
      const saved = localStorage.getItem('abdi_landing_config');
      const parsed = saved ? JSON.parse(saved) : null;
      if (!parsed || !parsed.heroSubtitle?.toLowerCase().includes('multi-online')) {
        const merged = { ...defaultConfig, ...(parsed || {}), heroTitleText: defaultConfig.heroTitleText, heroTitleHighlight: defaultConfig.heroTitleHighlight, heroSubtitle: defaultConfig.heroSubtitle, promoBar: defaultConfig.promoBar };
        localStorage.setItem('abdi_landing_config', JSON.stringify(merged));
        return merged;
      }
      return parsed;
    } catch {
      return defaultConfig;
    }
  });

  const [isEditLandingModalOpen, setIsEditLandingModalOpen] = useState(false);
  const [editLandingForm, setEditLandingForm] = useState(landingConfig);

  // ── Live Chat Helpdesk State & Logic ──
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'Halo Kak! 👋 Saya Tim Live CS dari Helpdesk ABDI Absensi Digital. Ada yang bisa kami bantu seputar fitur, pilihan paket, atau cara aktivasi aplikasi instansi / sekolah kita?',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [aiInputText, setAiInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);

  const handleSendAiMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInputText.trim()) return;

    const userMsg: AiChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: aiInputText.trim(),
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    setAiMessages(prev => [...prev, userMsg]);
    const query = aiInputText.trim().toLowerCase();
    const currentInput = aiInputText.trim();
    setAiInputText('');
    setIsAiTyping(true);

    const activeGeminiKey = (landingConfig as any).geminiApiKey || (db.getSchool() as any).geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('abdi_gemini_api_key') || "";

    if (activeGeminiKey) {
      try {
        const historyPayload = aiMessages.slice(-6).map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }]
        }));

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeGeminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: `Kamu adalah Tim Live CS (Customer Service Spesialis) yang sangat profesional, ramah, sopan, dan sigap dari aplikasi "ABDI Absensi Digital" (Solusi Presensi Digital Instansi/Sekolah Akurat Real-Time). Tugasmu melayani pertanyaan Kepala Sekolah/Rektor/Guru/Staf dengan sapaan "Kak" atau "Bapak/Ibu" dan sisipan emoji ramah profesional. ATURAN KRUSIAL: 1. JANGAN PERNAH mengaku atau menyebut dirimu sebagai AI, bot, robot, atau program komputer. Kamu adalah staf Live CS manusia asli. 2. Jawablah padat, jelas, akurat, dan langsung membantu pemecahan masalah. PENGETAHUAN PRODUK: Paket Trial Gratis 2 Minggu (14 Hari, maksimal 10 personel tanpa kartu kredit). Paket Utama kita adalah "Paket Full (Infaq Seikhlasnya)" di mana instansi/sekolah bisa menikmati seluruh fitur penuh (personel tak terbatas, durasi 1 tahun/unlimited, rekap Excel/PDF, AI analitik) dengan kontribusi infaq sukarela/seikhlasnya demi keberlanjutan pengembangan aplikasi. Juga tersedia Paket Hibah Khusus (Gratis 100% selamanya untuk instansi/yayasan terpilih oleh pengembang). Fitur Unggulan: Geotagging GPS Anti-Fake GPS, Validasi Selfie Real-Time, Stasiun Scan QR Code Lobi, Notifikasi WhatsApp OTP 2FA, Rekap Laporan Resmi Excel & PDF siap unduh. Role Akses: Admin (atur instansi/sekolah & setujui izin/cuti) dan Guru/Dosen/Staf (absen GPS & ajukan cuti). Cara aktivasi/upgrade: Admin login -> Input Data Token Aktivasi (contoh FULL-2026-X1). Nomor WhatsApp resmi Helpdesk: +${landingConfig.waHelpdesk}.` }]
            },
            contents: [
              ...historyPayload,
              { role: 'user', parts: [{ text: currentInput }] }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500,
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const geminiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (geminiText) {
            const aiReply: AiChatMessage = {
              id: (Date.now() + 1).toString(),
              sender: 'ai',
              text: geminiText,
              time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            };
            setAiMessages(prev => [...prev, aiReply]);
            setIsAiTyping(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Live Gemini LLM API error, falling back to smart keyword responder:", err);
      }
    }

    setTimeout(() => {
      let replyText = '';

      if (query.includes('harga') || query.includes('biaya') || query.includes('bayar') || query.includes('paket') || query.includes('tarif') || query.includes('langganan') || query.includes('infaq')) {
        replyText = 'Sistem ABDI menyediakan 2 pilihan paket resmi untuk instansi/sekolah/kampus Kakak:\n\n1. Paket Trial: GRATIS 2 Minggu / 14 Hari (Hingga 10 personel, uji coba tanpa kartu kredit)\n2. Paket Full (Infaq Seikhlasnya): Nikmati seluruh fitur penuh dan kapasitas personel tak terbatas (Unlimited) dengan kontribusi infaq sukarela / seikhlasnya demi keberlanjutan aplikasi 😊\n3. Paket Hibah Khusus: GRATIS 100% dari pengembang untuk instansi / yayasan terpilih.\n\nTidak ada patokan biaya kaku, karena misi kami adalah membantu digitalisasi pendidikan Indonesia! 🙏';
      } else if (query.includes('trial') || query.includes('gratis') || query.includes('coba') || query.includes('uji coba')) {
        replyText = 'Paket Trial kita 100% GRATIS berupa Uji Coba 2 Minggu (14 Hari) ya Kak! Kakak bisa mendaftarkan hingga 10 Guru & Staf, menikmati fitur Geofencing GPS, selfie absensi, dan notifikasi WhatsApp OTP tanpa perlu kartu kredit sama sekali 👍';
      } else if (query.includes('durasi') || query.includes('berlaku') || query.includes('tahun') || query.includes('masa aktif')) {
        replyText = 'Paket Full (Infaq Seikhlasnya) maupun Paket Hibah Khusus berlaku penuh selama 1 Tahun Ajaran / Pelajaran (365 Hari atau selamanya) ya Kak. Khusus Trial berlaku 14 hari (2 minggu) uji coba.';
      } else if (query.includes('fitur') || query.includes('unggulan') || query.includes('kelebihan') || query.includes('bisa apa')) {
        replyText = 'Fitur unggulan aplikasi kita sangat lengkap Kak:\n\n📍 Geotagging GPS & Radius Geofence Anti-Fake GPS\n📸 Validasi Selfie Real-Time\n📱 Stasiun Scan QR Code untuk gerbang sekolah\n🔐 Notifikasi Login 2FA WhatsApp OTP\n📑 Manajemen Izin, Sakit & Cuti Operasional\n📊 Rekap Otomatis Laporan Excel & PDF siap unduh!';
      } else if (query.includes('whatsapp') || query.includes('wa') || query.includes('otp') || query.includes('notif')) {
        replyText = 'Betul Kak! Sistem ABDI sudah terintegrasi resmi dengan WhatsApp Gateway. Jadi setiap personel yang login atau absen akan verifikasi pakai kode OTP 6 digit via WhatsApp supaya keamanan akun instansi / sekolah terjamin 100% 🔒';
      } else if (query.includes('token') || query.includes('aktivasi') || query.includes('aktifkan')) {
        replyText = 'Untuk aktivasi atau upgrade paket mudah banget Kak! Login ke akun Admin -> klik menu Input Data Token Aktivasi atau kartu "Aktivasi Lisensi", lalu masukkan kode token resmi dari kita (contoh: FULL-2026-X1). Kuota dan masa aktif langsung otomatis bertambah!';
      } else if (query.includes('halo') || query.includes('hi') || query.includes('hai') || query.includes('pagi') || query.includes('siang') || query.includes('malam') || query.includes('assalamualaikum') || query.includes('ping')) {
        replyText = 'Halo Kak! 😊 Senang sekali Tim Live CS bisa membantu Kakak hari ini. Ada yang ingin kami jelaskan mengenai sistem absensi digital sekolah & kampus kita?';
      } else if (query.includes('testimoni') || query.includes('ulasan')) {
        replyText = 'Kakak bisa lihat langsung berbagai testimoni nyata dari para Kepala Sekolah dan Guru di bagian Testimoni Klien di halaman ini ya! Kakak juga bisa ikut menuliskan ulasan riil dengan klik tombol "✍️ Bagikan Testimoni Nyata Anda" 😊';
      } else if (query.includes('login') || query.includes('masuk') || query.includes('admin') || query.includes('role')) {
        replyText = 'Sistem ABDI memiliki 3 hak akses utama Kak:\n1. Admin (Akses via PC/Laptop untuk atur sekolah & persetujuan izin)\n2. Guru/Staf (Akses via HP untuk absen GPS/QR & ajukan cuti)\n3. Developer (Khusus pengembang teknis).';
      } else if (query.includes('kontak') || query.includes('hubungi') || query.includes('cs') || query.includes('helpdesk') || query.includes('manusia')) {
        replyText = `Tentu Kak! Tim Live CS siap membantu Kakak di sini 😊 Jika Kakak ingin konsultasi lebih lanjut via telepon atau WhatsApp langsung dengan tim sales senior kita, silakan hubungi nomor resmi di: +${landingConfig.waHelpdesk}`;
      } else {
        replyText = 'Terima kasih atas pertanyaannya Kak! 😊 Aplikasi ABDI Absensi Digital memang dirancang khusus agar pengelolaan kedisiplinan guru, dosen & staf instansi jadi sangat mudah, hemat, dan akurat.\n\nKakak bisa langsung mendaftar dengan klik tombol "Klaim Uji Coba Gratis 2 Minggu" di halaman ini atau klik tombol "Masuk Portal" di kanan atas ya!';
      }

      const aiReply: AiChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: replyText,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };

      setAiMessages(prev => [...prev, aiReply]);
      setIsAiTyping(false);
    }, 1200);
  };

  const handleSaveLandingConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setLandingConfig(editLandingForm);
    localStorage.setItem('abdi_landing_config', JSON.stringify(editLandingForm));
    setIsEditLandingModalOpen(false);
    toast.success("✨ Konten & Harga Landing Page berhasil diperbarui!");
  };

  // Realistic Full App Sandbox Demo State (Login -> Dashboard -> Features)
  const [isPlayingDemo, setIsPlayingDemo] = useState(true);
  const [simStep, setSimStep] = useState(0);
  const [demoScreen, setDemoScreen] = useState<'login' | 'dashboard'>('login');
  const [demoMenu, setDemoMenu] = useState<'overview' | 'attendance' | 'geofence' | 'report' | 'qr'>('overview');
  const [simModalOpen, setSimModalOpen] = useState(false);
  const [simRadius, setSimRadius] = useState(50);
  const [simDownloading, setSimDownloading] = useState(false);
  const [demoLoginInput, setDemoLoginInput] = useState('admin.sekolah@abdi.id');
  const [demoSearchInput, setDemoSearchInput] = useState('');

  useEffect(() => {
    if (!isPlayingDemo) return;
    const interval = setInterval(() => {
      setSimStep((prev) => {
        const next = (prev + 1) % 16;
        if (next === 0 || next === 1) {
          setDemoScreen('login');
        } else {
          setDemoScreen('dashboard');
          if (next === 2 || next === 3) {
            setDemoMenu('overview');
            if (next === 3) setSimModalOpen(true);
            else setSimModalOpen(false);
          } else if (next === 4 || next === 5 || next === 6) {
            setDemoMenu('attendance');
            setSimModalOpen(false);
          } else if (next === 7 || next === 8 || next === 9) {
            setDemoMenu('geofence');
            if (next === 9) setSimRadius(85);
            else setSimRadius(50);
          } else if (next === 10 || next === 11 || next === 12) {
            setDemoMenu('report');
            if (next === 12) setSimDownloading(true);
            else setSimDownloading(false);
          } else if (next === 13 || next === 14 || next === 15) {
            setDemoMenu('qr');
            setSimDownloading(false);
          }
        }
        return next;
      });
    }, 2200);
    return () => clearInterval(interval);
  }, [isPlayingDemo]);

  const allTestimonialsData = React.useMemo(() => [...realTestimonials, ...TESTIMONIALS_DATA], [realTestimonials]);

  const filteredTestimonials = allTestimonialsData.filter(item => {
    if (activeTestiCategory === 'semua') return true;
    if (activeTestiCategory === 'staf') return item.role.includes('Tata Usaha') || item.role.includes('Staf') || item.role.includes('Bendahara');
    if (activeTestiCategory === 'guru') return item.role.includes('Wakasek') || item.role.includes('Guru') || item.role.includes('Pembina');
    if (activeTestiCategory === 'pimpinan') return item.role.includes('Kepala') || item.role.includes('Ketua') || item.role.includes('Pimpinan') || item.role.includes('Pengawas');
    return true;
  });

  const handleTestiAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewTestiForm(prev => ({ ...prev, avatarUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddRealTestimony = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestiForm.name || !newTestiForm.quote) {
      toast.error("Mohon lengkapi nama dan ulasan testimoni Anda.");
      return;
    }
    const newEntry: TestimonialItem = {
      id: `real-${Date.now()}`,
      name: newTestiForm.name,
      role: newTestiForm.role,
      school: newTestiForm.school || 'SMA / SMP / Kampus Terpadu',
      location: newTestiForm.location || 'Indonesia',
      avatar: newTestiForm.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(newTestiForm.name)}`,
      rating: Number(newTestiForm.rating),
      highlight: newTestiForm.highlight || 'Terverifikasi Nyata',
      quote: newTestiForm.quote,
    };
    const updated = [newEntry, ...realTestimonials];
    setRealTestimonials(updated);
    localStorage.setItem('abdi_real_testimonials', JSON.stringify(updated));
    setIsTestiModalOpen(false);
    setNewTestiForm({ name: '', role: 'Kepala Sekolah / Rektor', school: '', location: '', rating: 5, highlight: '', quote: '', avatarUrl: '' });
    setActiveTestiCategory('semua');
    setTestiSlideIdx(0);
    toast.success("✨ Testimoni nyata Anda berhasil dipublikasikan!");
  };

  const handleDeleteRealTesti = (id: string) => {
    const updated = realTestimonials.filter(t => t.id !== id);
    setRealTestimonials(updated);
    localStorage.setItem('abdi_real_testimonials', JSON.stringify(updated));
    toast.success("Testimoni berhasil dihapus.");
  };

  const maxSlideIdx = Math.max(0, filteredTestimonials.length - itemsPerView);

  useEffect(() => {
    setTestiSlideIdx(0);
  }, [activeTestiCategory, itemsPerView]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setItemsPerView(1);
      else if (window.innerWidth < 1024) setItemsPerView(2);
      else setItemsPerView(3);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isAutoPlayTesti || maxSlideIdx <= 0) return;
    const timer = setInterval(() => {
      setTestiSlideIdx((prev) => (prev >= maxSlideIdx ? 0 : prev + 1));
    }, 4000);
    return () => clearInterval(timer);
  }, [isAutoPlayTesti, maxSlideIdx]);


  const getSimCursor = () => {
    switch (simStep) {
      case 0: return { x: 50, y: 45, label: "Memasukkan username admin..." };
      case 1: return { x: 50, y: 72, label: "Klik tombol Masuk ke Portal" };
      case 2: return { x: 75, y: 65, label: "Klik Lihat Foto Selfie & GPS" };
      case 3: return { x: 50, y: 50, label: "Verifikasi Wajah & Akurasi GPS" };
      case 4: return { x: 15, y: 32, label: "Buka Menu Kehadiran Guru" };
      case 5: return { x: 65, y: 28, label: "Filter kehadiran hari ini..." };
      case 6: return { x: 80, y: 55, label: "Setujui Koreksi Presensi Guru" };
      case 7: return { x: 15, y: 42, label: "Buka Pengaturan Geofence" };
      case 8: return { x: 60, y: 65, label: "Atur batas toleransi jarak" };
      case 9: return { x: 80, y: 65, label: "Radius diperluas ke 85 Meter" };
      case 10: return { x: 15, y: 52, label: "Buka Laporan Audit BOSP" };
      case 11: return { x: 70, y: 45, label: "Klik Unduh Excel Resmi BOSP" };
      case 12: return { x: 50, y: 35, label: "Mengunduh Laporan Siap Cetak..." };
      case 13: return { x: 15, y: 62, label: "Buka Anjungan Scanner Lobi" };
      case 14: return { x: 50, y: 50, label: "QR Code Wajah & Voice Aktif" };
      default: return { x: 50, y: 50, label: "Kembali ke Halaman Login" };
    }
  };

  // Lead Gen Form State
  const [leadName, setLeadName] = useState('');
  const [leadSchool, setLeadSchool] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadSize, setLeadSize] = useState('30-100');
  const [isLeadSubmitted, setIsLeadSubmitted] = useState(false);

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName || !leadPhone || !leadSchool) {
      toast.error('Mohon lengkapi Nama, Sekolah, dan Nomor WhatsApp Anda.');
      return;
    }
    setIsLeadSubmitted(true);
    toast.success('Permintaan Demo Terkirim! Tim Ahli kami segera menghubungi WhatsApp Anda.');
  };

  const faqs = [
    {
      q: "Apakah membutuhkan spesifikasi HP atau mesin server khusus?",
      a: "Tidak sama sekali. ABDI berbasis Progressive Web App (PWA) modern yang sangat ringan (< 3MB). Bisa dijalankan dengan lancar di smartphone Android Rp1 jutaan maupun browser laptop standar sekolah tanpa instalasi rumit."
    },
    {
      q: "Bagaimana jika koneksi internet Wi-Fi atau sinyal HP di sekolah mati?",
      a: "Tenang, ABDI dilengkapi teknologi Service Worker Cache lokal. Guru tetap bisa menekan tombol absen masuk/pulang saat kondisi offline. Begitu HP kembali mendapatkan koneksi internet, sistem akan otomatis menyinkronkan jam presensi tersebut ke Cloud."
    },
    {
      q: "Setelah masa uji coba gratis 2 minggu (14 hari) berakhir, apakah otomatis berbayar?",
      a: "Tidak ada pemotongan atau tagihan otomatis. Sistem kami 100% transparan tanpa kartu kredit. Setelah 14 hari berakhir, Anda dapat melanjutkan dengan Paket Full melalui kontribusi Infaq Sukarela / Seikhlasnya demi keberlanjutan aplikasi."
    },
    {
      q: "Apakah laporan kehadiran akhir bulan langsung siap cetak untuk audit BOSP/Dinas?",
      a: "Sangat bisa. Hanya dengan satu klik, Anda dapat mengunduh rekapitulasi bulanan resmi berformat Excel maupun PDF siap cetak lengkap dengan kop surat sekolah dan kolom tanda tangan Kepala Sekolah."
    }
  ];

  const legalContent: Record<string, { title: string; content: React.ReactNode }> = {
    tnc: {
      title: "Syarat & Ketentuan Layanan (Terms of Service)",
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-800">
          <p><strong>1. Penerimaan Syarat:</strong> Dengan mengakses atau menggunakan platform ABDI (Absen Digital Terpadu), pihak Sekolah/Yayasan menyatakan setuju mengikatkan diri pada syarat dan ketentuan ini.</p>
          <p><strong>2. Akun & Kredensial:</strong> Pendaftar bertanggung jawab penuh atas keamanan sandi akun Admin serta kebenaran data kepegawaian (Guru dan Staf) yang diinput ke dalam sistem.</p>
          <p><strong>3. Jaminan Uptime SLA:</strong> ABDI menjamin ketersediaan server cloud sebesar 99.8% setiap harinya di luar jadwal pemeliharaan sistem terinformasi.</p>
        </div>
      )
    },
    privacy: {
      title: "Kebijakan Privasi Data (Privacy Policy)",
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-800">
          <p><strong>1. Komitmen Perlindungan:</strong> Kami memegang teguh kerahasiaan data instansi Anda. Data kehadiran, foto swafoto, maupun informasi personal pegawai / guru / dosen tidak akan pernah dijual atau dibagikan kepada pihak ketiga/pengiklan.</p>
          <p><strong>2. Data yang Dikumpulkan:</strong> Sistem hanya merekam Nama, ID Pegawai / NIP / NIDN / NIK, Jabatan, Swafoto Absensi, serta koordinat geolokasi GPS semata-mata pada detik tombol absensi ditekan.</p>
        </div>
      )
    },
    security: {
      title: "Kebijakan Keamanan & Enkripsi (Security Policy)",
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-800">
          <p><strong>1. Enkripsi Transmisi:</strong> Seluruh lalu lintas komunikasi data antara smartphone guru dan pangkalan data cloud dilindungi oleh protokol enkripsi SSL/TLS 256-Bit kelas perbankan.</p>
          <p><strong>2. Keamanan Sandi Lokal:</strong> Kata sandi diproses di perangkat pengguna menggunakan metode algoritma hashing lokal sebelum disinkronkan.</p>
        </div>
      )
    },
    eula: {
      title: "Perjanjian Lisensi Pengguna Akhir (EULA)",
      content: (
        <div className="space-y-4 text-xs leading-relaxed text-slate-800">
          <p><strong>1. Hak Akses Lisensi:</strong> ABDI memberikan hak lisensi non-eksklusif kepada sekolah mitra untuk menggunakan perangkat lunak sesuai kuota personel paket aktif.</p>
          <p><strong>2. Larangan Modifikasi:</strong> Pengguna dilarang melakukan aktivitas decompile, reverse engineering, atau serangan penetrasi ilegal terhadap infrastruktur cloud ABDI.</p>
        </div>
      )
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-600 selection:text-white relative">
      
      {/* ── Top Promo Bar ── */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-[11px] sm:text-xs font-extrabold py-2.5 px-4 text-center shadow-sm relative z-50 flex items-center justify-center gap-2">
        <Gift size={15} className="animate-bounce text-amber-300 shrink-0" />
        <span>{landingConfig.promoBar}</span>
        <Link to="/login" className="underline ml-1 hover:text-amber-200 transition-colors hidden sm:inline">Klaim Sekarang &rarr;</Link>
      </div>

      {/* ── Navbar Clean SaaS ── */}
      <nav className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3 text-left cursor-pointer group shrink-0">
            <img src="/logo-abdi.png" alt="Logo ABDI" className="w-10 h-10 sm:w-11 sm:h-11 object-contain drop-shadow-sm group-hover:scale-105 transition-transform" />
            <div>
              <span className="font-black text-lg sm:text-xl tracking-tight text-slate-900">
                ABDI
              </span>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 -mt-1">Absen Digital</p>
            </div>
          </button>

          <div className="hidden md:flex items-center gap-8 text-xs font-extrabold text-slate-600">
            <a href="#fitur" className="hover:text-blue-600 transition-colors">Fitur Unggulan</a>
            <a href="#jadwaldemo" className="hover:text-blue-600 transition-colors">Demo Aplikasi</a>
            <a href="#harga" className="hover:text-blue-600 transition-colors">Paket Harga</a>
            <a href="#testimoni" className="hover:text-blue-600 transition-colors">Testimoni Klien</a>
            <a href="#faq" className="hover:text-blue-600 transition-colors">Tanya Jawab</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={promptDesktopInstall}
              className="hidden lg:inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow transition-all cursor-pointer border border-indigo-500/30"
              title="Instal Aplikasi Desktop PC/Laptop"
            >
              <span>💻 Instal Desktop</span>
            </button>
            <Link
              to="/login"
              className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/20 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-1.5 shrink-0"
            >
              <span>Masuk Portal</span> <ArrowRight size={14} className="hidden sm:inline" />
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              title="Buka Menu"
            >
              {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-6 py-4 space-y-3 shadow-xl animate-fade-in text-xs font-extrabold text-slate-700">
            <a href="#fitur" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 border-b border-slate-100 hover:text-blue-600">✨ Fitur Unggulan</a>
            <a href="#jadwaldemo" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 border-b border-slate-100 hover:text-blue-600">💻 Demo Aplikasi</a>
            <a href="#harga" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 border-b border-slate-100 hover:text-blue-600">💰 Paket Harga</a>
            <a href="#testimoni" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 border-b border-slate-100 hover:text-blue-600">⭐ Testimoni Klien</a>
            <a href="#faq" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 hover:text-blue-600">❓ Tanya Jawab</a>
          </div>
        )}
      </nav>

      {/* ── Hero Section (Absenku Style) ── */}
      <section className="relative pt-14 pb-20 lg:pt-24 lg:pb-32 px-6 overflow-hidden bg-gradient-to-b from-blue-50/60 via-white to-slate-50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/80 text-blue-700 text-xs font-extrabold border border-blue-200 shadow-sm">
              <Zap size={14} className="text-amber-500 fill-amber-500" /> Aplikasi Absensi Digital Multi-Online (Pusat & Cabang)
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.12]">
              {landingConfig.heroTitleText} <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">{landingConfig.heroTitleHighlight}</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
              {landingConfig.heroSubtitle}
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-black shadow-xl shadow-blue-600/30 hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2.5"
              >
                🚀 Klaim Uji Coba Gratis 2 Minggu (14 Hari) <ArrowRight size={16} />
              </Link>
              <button
                onClick={promptDesktopInstall}
                className="w-full sm:w-auto px-7 py-4 rounded-full bg-gradient-to-r from-slate-900 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 text-white text-sm font-black shadow-xl shadow-indigo-950/20 hover:scale-105 transition-all flex items-center justify-center gap-2.5 border border-indigo-500/40 cursor-pointer"
              >
                <span>💻 Instal Aplikasi Desktop (PC)</span>
              </button>
              <a
                href="#jadwaldemo"
                className="w-full sm:w-auto px-7 py-4 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-extrabold shadow-sm transition-all flex items-center justify-center gap-2 hover:border-blue-400"
              >
                <Monitor size={18} className="text-blue-600" /> Demo Live
              </a>
            </div>

            <div className="flex items-center justify-center lg:justify-start gap-6 text-xs font-bold text-slate-500 pt-3">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-emerald-500" /> Setup &lt; 5 Menit</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-emerald-500" /> Tanpa Kartu Kredit</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-emerald-500" /> Batal Kapan Saja</span>
            </div>
          </div>

          {/* Right Floating Graphic Showcase */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="absolute w-72 h-72 bg-blue-400/20 rounded-full blur-3xl -z-10 animate-pulse" />
            
            {/* Main Showcase Card */}
            <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 relative">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <img src="/logo-abdi.png" alt="Logo" className="w-9 h-9 object-contain" />
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">ABDI Absensi Digital</h4>
                    <p className="text-[10px] text-slate-400 font-bold">SMA / SMP / Kampus Terpadu &bull; Live Sync</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-[10px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Terhubung
                </span>
              </div>

              {/* Simulation Map Box */}
              <div className="bg-slate-900 rounded-2xl p-5 text-white relative overflow-hidden mb-4 shadow-inner">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />
                <div className="relative z-10 flex flex-col items-center text-center space-y-3 py-2">
                  <div className="w-14 h-14 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400 animate-bounce">
                    <MapPin size={28} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-300">Koordinat Valid Geofencing</p>
                    <p className="text-base font-black text-emerald-400 font-mono mt-0.5">Dalam Radius 48m (Akurat)</p>
                  </div>
                  <div className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs shadow-lg flex items-center justify-center gap-2">
                    <ShieldCheck size={16} /> BERHASIL ABSEN MASUK (06:58 WIB)
                  </div>
                </div>
              </div>

              {/* Status footer inside card */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold">Anti Fake GPS</p>
                  <p className="text-xs font-black text-slate-800">Aktif & Terproteksi</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold">Laporan Rekap</p>
                  <p className="text-xs font-black text-blue-600">Siap Unduh PDF</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Stats Strip ── */}
      <section className="bg-blue-900 text-white py-12 px-6 shadow-md">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-blue-800/60">
          <div>
            <p className="text-3xl sm:text-4xl font-black text-white">Multi-Online</p>
            <p className="text-xs text-blue-200 font-bold mt-1">Dinas Pusat, Yayasan & Sekolah Cabang</p>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-black text-amber-300">Semi-Online</p>
            <p className="text-xs text-blue-200 font-bold mt-1">Sinkronisasi Offline Otomatis</p>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-black text-emerald-300">App Android</p>
            <p className="text-xs text-blue-200 font-bold mt-1">Siap Instal Guru & Kepala Sekolah</p>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-black text-sky-300">100% Sah</p>
            <p className="text-xs text-blue-200 font-bold mt-1">Geofencing GPS & Anti-Fake GPS</p>
          </div>
        </div>
      </section>

      {/* ── Fitur Utama Grid ── */}
      <section id="fitur" className="py-24 px-6 max-w-7xl mx-auto space-y-16">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-blue-600">Solusi Lengkap Presensi</h2>
          <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Fitur Unggulan Pendukung Kedisiplinan</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          
          <div className="bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 text-white p-8 rounded-3xl border border-indigo-500/30 shadow-2xl space-y-4 md:col-span-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-3 max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-black uppercase tracking-wider">
                  🌐 Ekosistem Terpadu 3 Mode
                </div>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                  Dukung Sistem Multi-Online (Pusat & Cabang), Semi-Online, & Aplikasi Android
                </h3>
                <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed font-medium">
                  Aplikasi absensi digital yang mendukung sistem <b>multi-online</b> (pemantauan terpusat untuk Yayasan Pusat & seluruh Cabang Instansi / Sekolah / Kampus). Operasional lancar di segala kondisi dengan 3 mode utama: <b>Online</b> (Web Aplikasi Admin/Pusat), <b>Semi-Online</b> (sinkronisasi offline otomatis saat hilang sinyal), serta <b>Aplikasi Android</b> khusus untuk Guru, Staf, dan Kepala Sekolah yang bisa diinstal di HP!
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full md:w-auto">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 text-center">
                  <p className="text-[10px] font-bold text-indigo-200 uppercase">Instalasi Mobile</p>
                  <p className="text-lg font-black text-amber-300">Siap Instal HP</p>
                  <p className="text-[9px] text-white/70">Android & PWA</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 text-center">
                  <p className="text-[10px] font-bold text-indigo-200 uppercase">Sinkronisasi</p>
                  <p className="text-lg font-black text-emerald-300">Semi-Online</p>
                  <p className="text-[9px] text-white/70">Auto-Sync Offline</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:border-blue-300 transition-all space-y-4 group">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
              <MapPin size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900">Validasi Geofencing & Anti-Fake GPS</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Absensi mengunci otomatis dalam radius gerbang instansi atau sekolah. Sistem mendeteksi dan memblokir upaya manipulasi lokasi maupun HP Root.
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:border-indigo-300 transition-all space-y-4 group">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm">
              <QrCode size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900">Stasiun Pemindai QR Code Lobi</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Opsi absensi cepat menggunakan tablet/PC di lobi sekolah. Kode enkripsi harian berganti otomatis setiap hari mencegah titip absen.
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:border-emerald-300 transition-all space-y-4 group">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-sm">
              <ShieldCheck size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900">Otentikasi 2FA WhatsApp OTP</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Keamanan login berlapis melalui kode OTP otomatis yang dikirim langsung ke WhatsApp resmi Kepala Sekolah dan Admin terdaftar.
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:border-purple-300 transition-all space-y-4 group">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-sm">
              <Clock size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900">Manajemen Shift & Jam Mengajar</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Atur jam kerja reguler, shift satpam, hingga jadwal mata pelajaran harian guru dengan perhitungan otomatis keterlambatan.
            </p>
          </div>
          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:border-sky-300 transition-all space-y-4 group">
            <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors shadow-sm">
              <FileText size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900">Satu-Klik Ekspor Excel & PDF</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Unduh rekap bulanan resmi siap cetak berstempel kop surat instansi / sekolah lengkap dengan perhitungan otomatis keterlambatan dan jam kosong siap audit.
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:border-amber-300 transition-all space-y-4 group">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors shadow-sm">
              <Smartphone size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900">Pengajuan Izin & Cuti Mobile</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Guru dapat mengunggah surat keterangan sakit atau mengajukan cuti langsung dari aplikasi untuk di-approve oleh Kepala Sekolah.
            </p>
          </div>

        </div>
      </section>

      {/* ── UPDATE 1: DEMO DASBOR INTERAKTIF (Interactive Screenshot Showcase) ── */}
      <section id="demo" className="py-24 px-6 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto space-y-12 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
              <Laptop size={14} /> Showcase Panel Kepala Sekolah & Tata Usaha
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Tampilan Dasbor Intuitif & Hemat Waktu</h2>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">
              Didesain khusus agar mudah dipahami oleh staf Tata Usaha usia senior sekalipun. Klik tab di bawah untuk mencoba pratinjau dasbor.
            </p>

            {/* Interactive Sandbox Tab Switcher */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
              <button
                onClick={() => { setDemoScreen('login'); setSimStep(0); setIsPlayingDemo(false); }}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 shadow-sm ${demoScreen === 'login' ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/30 scale-105' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
              >
                🔐 1. Layar Login Asli
              </button>
              <button
                onClick={() => { setDemoScreen('dashboard'); setDemoMenu('overview'); setSimStep(2); setIsPlayingDemo(false); }}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 shadow-sm ${demoScreen === 'dashboard' && demoMenu === 'overview' ? 'bg-violet-600 text-white ring-4 ring-violet-500/30 scale-105' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
              >
                📊 2. Dasbor Utama (Light Theme)
              </button>
              <button
                onClick={() => { setDemoScreen('dashboard'); setDemoMenu('attendance'); setSimStep(5); setIsPlayingDemo(false); }}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 shadow-sm ${demoScreen === 'dashboard' && demoMenu === 'attendance' ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/30 scale-105' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
              >
                👥 3. Kehadiran &amp; Koreksi
              </button>
              <button
                onClick={() => { setDemoScreen('dashboard'); setDemoMenu('geofence'); setSimStep(8); setIsPlayingDemo(false); }}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 shadow-sm ${demoScreen === 'dashboard' && demoMenu === 'geofence' ? 'bg-amber-600 text-white ring-4 ring-amber-500/30 scale-105' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
              >
                📍 4. Radar Geofence GPS
              </button>
              <button
                onClick={() => { setDemoScreen('dashboard'); setDemoMenu('report'); setSimStep(11); setIsPlayingDemo(false); }}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 shadow-sm ${demoScreen === 'dashboard' && demoMenu === 'report' ? 'bg-purple-600 text-white ring-4 ring-purple-500/30 scale-105' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
              >
                📑 5. Laporan Audit BOSP
              </button>
              <button
                onClick={() => { setDemoScreen('dashboard'); setDemoMenu('qr'); setSimStep(14); setIsPlayingDemo(false); }}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 shadow-sm ${demoScreen === 'dashboard' && demoMenu === 'qr' ? 'bg-rose-600 text-white ring-4 ring-rose-500/30 scale-105' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
              >
                📲 6. Anjungan Scan Lobi
              </button>
            </div>
          </div>

          {/* Tab Content Box - Authentic Real App Replica Frame */}
          <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden select-none text-left">
            
            {/* VIRTUAL ANIMATED MOUSE POINTER (SIMULASI CURSOR ADMIN) */}
            {isPlayingDemo && (
              <div 
                className="absolute z-50 pointer-events-none transition-all duration-1000 ease-in-out flex items-start gap-2 drop-shadow-2xl"
                style={{ left: `${getSimCursor().x}%`, top: `${getSimCursor().y}%` }}
              >
                <div className="w-7 h-7 bg-white text-slate-900 rounded-full flex items-center justify-center font-bold text-base shadow-2xl border-2 border-indigo-600 animate-bounce">
                  👆
                </div>
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-extrabold px-3.5 py-1.5 rounded-full shadow-xl border border-indigo-300/40 whitespace-nowrap animate-pulse">
                  {getSimCursor().label}
                </div>
              </div>
            )}

            {/* Browser Header Bar */}
            <div className="bg-slate-900 px-6 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="ml-2 bg-slate-950 px-3 py-1 rounded-md border border-slate-800 text-slate-300 flex items-center gap-2 font-medium">
                  🔒 https://app.abdi-presensi.sch.id/{demoScreen === 'login' ? 'login' : `admin/${demoMenu}`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPlayingDemo(!isPlayingDemo)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${isPlayingDemo ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${isPlayingDemo ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                  {isPlayingDemo ? '🎬 PUTAR OTOMATIS AKTIF' : '🎮 MODE INTERAKTIF (SANDBOX)'}
                </button>
              </div>
            </div>

            {/* ── SCREEN 1: SIMULASI HALAMAN LOGIN ASLI (100% Mirip Login.tsx) ── */}
            {demoScreen === 'login' && (
              <div className="p-8 sm:p-16 bg-gradient-to-br from-indigo-900 via-slate-900 to-blue-950 min-h-[560px] flex items-center justify-center animate-fade-in">
                <div className="bg-white rounded-[2rem] shadow-[0_25px_60px_rgba(0,0,0,0.35)] border border-slate-100 p-8 max-w-md w-full relative overflow-hidden space-y-6 text-slate-800">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                  
                  {/* Logo & Title */}
                  <div className="text-center space-y-2">
                    <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 items-center justify-center text-white font-black text-2xl shadow-lg shadow-indigo-600/30 mb-1">A</div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">MASUK KE PORTAL ABDI</h3>
                    <p className="text-xs text-slate-500 font-medium">Sistem Presensi Digital Instansi, Sekolah &amp; Kampus</p>
                  </div>

                  {/* Role Tabs */}
                  <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 rounded-xl text-xs font-bold">
                    <button className="py-2 rounded-lg bg-white text-indigo-600 shadow-sm transition-all flex items-center justify-center gap-1.5">
                      🛡️ Admin Instansi
                    </button>
                    <button onClick={() => toast('Silakan login sebagai Admin untuk melihat fitur lengkap', { icon: 'ℹ️' })} className="py-2 rounded-lg text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center gap-1.5">
                      👤 Guru &amp; Staf
                    </button>
                  </div>

                  <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-center">
                    <span className="text-[11px] font-bold text-indigo-700">💡 Pratinjau Demo: Kredensial Admin Terisi Otomatis</span>
                  </div>

                  {/* Form Inputs */}
                  <div className="space-y-4 text-left text-xs">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1.5">Nomor WhatsApp / Username / ID Pegawai / NIP</label>
                      <input 
                        type="text" 
                        value={demoLoginInput} 
                        onChange={(e) => { setDemoLoginInput(e.target.value); setIsPlayingDemo(false); }}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-slate-900 font-mono text-sm focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1.5">Kata Sandi</label>
                      <input 
                        type="password" 
                        value="••••••••••••" 
                        readOnly 
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-slate-900 font-mono text-sm tracking-widest focus:bg-white outline-none font-bold"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked readOnly className="accent-indigo-600 rounded w-4 h-4" /> Ingat saya di perangkat ini</label>
                      <span className="text-indigo-600 hover:underline font-bold cursor-pointer">Lupa sandi?</span>
                    </div>
                    <button
                      onClick={() => { setDemoScreen('dashboard'); setDemoMenu('overview'); setIsPlayingDemo(false); }}
                      className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm flex items-center justify-center gap-2 group active:scale-95"
                    >
                      🚀 Masuk ke Portal Sekolah
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── SCREEN 2: SIMULASI DASBOR ADMIN SEKOLAH ASLI (100% Mirip Dashboard.tsx Light Theme) ── */}
            {demoScreen === 'dashboard' && (
              <div className="min-h-[600px] bg-[#f8fafc] text-slate-800 animate-fade-in flex flex-col">
                
                {/* Top Header Bar Asli */}
                <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap justify-between items-center gap-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center font-black text-white text-lg shadow-md shadow-indigo-500/20">A</div>
                    <div>
                      <h3 className="font-black text-slate-900 text-base leading-none">ABDI Sekolah</h3>
                      <p className="text-xs text-slate-500 mt-1 font-medium">SMA / SMP / Kampus Terpadu &bull; Tahun Ajaran 2025/2026</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative hidden sm:block">
                      <input 
                        type="text" 
                        placeholder="Cari guru atau NIP..." 
                        value={demoSearchInput}
                        onChange={(e) => { setDemoSearchInput(e.target.value); setIsPlayingDemo(false); }}
                        className="bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 w-52 focus:border-indigo-500 focus:bg-white outline-none transition-all font-medium"
                      />
                    </div>
                    <span className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 font-mono font-bold">📅 {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                      <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 font-extrabold flex items-center justify-center text-xs border border-violet-200 shrink-0">AF</div>
                      <div className="hidden md:block text-left">
                        <p className="text-xs font-bold text-slate-900 leading-tight">Drs. Ahmad Fauzi</p>
                        <p className="text-[10px] text-slate-500">Kepala Sekolah / Rektor</p>
                      </div>
                      <button onClick={() => setDemoScreen('login')} className="ml-2 text-slate-400 hover:text-rose-600 p-1.5 transition-colors" title="Keluar"><LogOut size={16} /></button>
                    </div>
                  </div>
                </div>

                {/* Navigation Tabs Bar Asli */}
                <div className="bg-white border-b border-slate-200 px-6 pt-2 flex gap-2 overflow-x-auto text-xs font-bold">
                  <button
                    onClick={() => { setDemoMenu('overview'); setIsPlayingDemo(false); }}
                    className={`px-4 py-2.5 rounded-t-xl border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${demoMenu === 'overview' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                  >
                    📊 Dasbor Utama
                  </button>
                  <button
                    onClick={() => { setDemoMenu('attendance'); setIsPlayingDemo(false); }}
                    className={`px-4 py-2.5 rounded-t-xl border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${demoMenu === 'attendance' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                  >
                    👥 Manajemen Kehadiran <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full text-[10px]">48</span>
                  </button>
                  <button
                    onClick={() => { setDemoMenu('geofence'); setIsPlayingDemo(false); }}
                    className={`px-4 py-2.5 rounded-t-xl border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${demoMenu === 'geofence' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                  >
                    📍 Radar Geofence GPS
                  </button>
                  <button
                    onClick={() => { setDemoMenu('report'); setIsPlayingDemo(false); }}
                    className={`px-4 py-2.5 rounded-t-xl border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${demoMenu === 'report' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                  >
                    📑 Laporan Audit BOSP
                  </button>
                  <button
                    onClick={() => { setDemoMenu('qr'); setIsPlayingDemo(false); }}
                    className={`px-4 py-2.5 rounded-t-xl border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${demoMenu === 'qr' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                  >
                    📲 Stasiun Scan QR Lobi
                  </button>
                </div>

                {/* Main Dashboard Content Area Asli */}
                <div className="flex-1 p-6 sm:p-8 overflow-y-auto space-y-6 relative max-h-[540px]">
                  
                  {/* ── MENU 1: DASBOR UTAMA (OVERVIEW LIGHT THEME) ── */}
                  {demoMenu === 'overview' && (
                    <div className="space-y-6 animate-fade-in relative">
                      
                      {/* Simulated Modal Selfie (Sleek Overlay) */}
                      {simModalOpen && (
                        <div className="absolute inset-0 z-40 bg-slate-900/80 backdrop-blur-md rounded-2xl p-6 flex flex-col items-center justify-center text-center animate-fade-in shadow-2xl">
                          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-slate-800 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto text-2xl shadow-inner font-bold">📸</div>
                            <div>
                              <h4 className="font-black text-slate-900 text-base">Verifikasi Selfie &amp; Biometrik GPS</h4>
                              <p className="text-xs text-indigo-600 font-bold mt-0.5">Budi Santoso, S.Pd. &bull; Masuk: 06:45:12 WIB</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs font-mono text-slate-700 space-y-2">
                              <p className="flex justify-between"><span>📍 Koordinat GPS:</span> <span className="font-bold">-7.2574, 112.7520</span></p>
                              <p className="flex justify-between"><span>📡 Akurasi Lokasi:</span> <span className="text-emerald-600 font-bold">3.8 Meter (Gerbang)</span></p>
                              <p className="flex justify-between"><span>🤖 AI Face Match:</span> <span className="text-emerald-600 font-bold">99.4% Valid Sah</span></p>
                              <p className="flex justify-between"><span>📱 Perangkat:</span> <span className="text-slate-500">Samsung Galaxy A54</span></p>
                            </div>
                            <button onClick={() => setSimModalOpen(false)} className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-extrabold shadow-md hover:shadow-lg transition-all">✅ Tutup &amp; Konfirmasi Sah</button>
                          </div>
                        </div>
                      )}

                      {/* Broadcast Panel Asli */}
                      <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                          <Send size={18} />
                        </div>
                        <div className="flex-1 w-full text-xs">
                          <h4 className="font-bold text-blue-950 text-sm">Siaran Pengumuman Massal WhatsApp (Broadcast)</h4>
                          <div className="flex gap-2 w-full mt-2">
                            <input type="text" readOnly value="Pemberitahuan: Rapat evaluasi kurikulum dipercepat jam 13:00 WIB di Ruang Guru." className="flex-1 bg-white border border-blue-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-700 outline-none shadow-inner" />
                            <button onClick={() => toast.success('Siaran WhatsApp berhasil dikirim ke 48 Guru & Staf!')} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-bold shadow transition-all whitespace-nowrap">Siarkan</button>
                          </div>
                        </div>
                      </div>

                      {/* 4 Stat Cards Asli */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-slate-100 flex items-center gap-4 hover:-translate-y-1 transition-all group">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0 group-hover:scale-110 transition-transform">
                            <Users size={22} />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Total Guru</p>
                            <p className="text-2xl font-black text-slate-800 leading-none mt-1">48</p>
                            <p className="text-[10px] text-slate-400 mt-1">Guru &amp; Staf</p>
                          </div>
                        </div>

                        <div className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-slate-100 flex items-center gap-4 hover:-translate-y-1 transition-all group">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white shadow-md shadow-pink-500/20 shrink-0 group-hover:scale-110 transition-transform">
                            <CheckCircle2 size={22} />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Hadir Hari Ini</p>
                            <p className="text-2xl font-black text-slate-800 leading-none mt-1">42</p>
                            <p className="text-[10px] text-emerald-600 font-bold mt-1">↑ 87.5% Tepat Waktu</p>
                          </div>
                        </div>

                        <div className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-slate-100 flex items-center gap-4 hover:-translate-y-1 transition-all group">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center text-white shadow-md shadow-fuchsia-500/20 shrink-0 group-hover:scale-110 transition-transform">
                            <FileText size={22} />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Izin / Cuti</p>
                            <p className="text-2xl font-black text-slate-800 leading-none mt-1">2</p>
                            <p className="text-[10px] text-slate-400 mt-1">Pengajuan Aktif</p>
                          </div>
                        </div>

                        <div className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-slate-100 flex items-center gap-4 hover:-translate-y-1 transition-all group">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0 group-hover:scale-110 transition-transform">
                            <Building2 size={22} />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Unit Sekolah / Kampus</p>
                            <p className="text-2xl font-black text-slate-800 leading-none mt-1">1</p>
                            <p className="text-[10px] text-slate-400 mt-1">Terdaftar Resmi</p>
                          </div>
                        </div>
                      </div>

                      {/* Live Feed Table Asli */}
                      <div className="bg-white rounded-[1.5rem] border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden">
                        <div className="p-5 bg-slate-50/80 border-b border-slate-200/80 font-bold text-xs flex flex-wrap justify-between items-center gap-2 text-slate-700">
                          <span className="text-sm font-black text-slate-900">⚡ Aktivitas Kehadiran Real-Time Hari Ini</span>
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold font-mono flex items-center gap-1.5">● LIVE CLOUD SYNC</span>
                        </div>
                        <div className="divide-y divide-slate-100 text-xs">
                          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center border border-blue-200 shrink-0">BS</div>
                              <div><p className="font-extrabold text-slate-900 text-sm">Budi Santoso, S.Pd.</p><p className="text-[11px] text-slate-500">Guru Matematika &bull; VIA GPS Ponsel</p></div>
                            </div>
                            <div className="flex items-center gap-2.5 self-end sm:self-auto">
                              <button onClick={() => { setSimModalOpen(true); setIsPlayingDemo(false); }} className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 font-bold border border-indigo-200 hover:bg-indigo-100 shadow-sm transition-all">📸 Lihat Foto Selfie</button>
                              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 font-mono font-bold border border-emerald-200">06:45 WIB</span>
                            </div>
                          </div>
                          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 font-extrabold flex items-center justify-center border border-purple-200 shrink-0">SR</div>
                              <div><p className="font-extrabold text-slate-900 text-sm">Siti Rahmawati, M.Pd.</p><p className="text-[11px] text-slate-500">Wakasek Kurikulum &bull; VIA SCAN QR Lobi</p></div>
                            </div>
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 font-mono font-bold border border-emerald-200 self-end sm:self-auto">06:51 WIB</span>
                          </div>
                          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 font-extrabold flex items-center justify-center border border-amber-200 shrink-0">RW</div>
                              <div><p className="font-extrabold text-slate-900 text-sm">Rina Wulandari, S.Kom</p><p className="text-[11px] text-slate-500">Guru TIK &bull; VIA GPS Ponsel</p></div>
                            </div>
                            <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 font-mono font-bold border border-amber-200 self-end sm:self-auto">07:12 WIB (Terlambat)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── MENU 2: KEHADIRAN GURU & STAF ── */}
                  {demoMenu === 'attendance' && (
                    <div className="space-y-4 animate-fade-in text-xs">
                      <div className="flex flex-wrap gap-2 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white font-bold shadow-sm">Semua Status (48)</span>
                          <span className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold cursor-pointer hover:bg-slate-200 transition-colors">Tepat Waktu (42)</span>
                          <span className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold cursor-pointer hover:bg-slate-200 transition-colors">Terlambat (4)</span>
                          <span className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold cursor-pointer hover:bg-slate-200 transition-colors">Izin/Cuti (2)</span>
                        </div>
                        <button onClick={() => toast.success('Koreksi kehadiran massal berhasil disetujui!')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 shadow transition-all"><Check size={16} /> Setujui Koreksi Massal</button>
                      </div>
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200">
                              <th className="p-4">Nama Guru &amp; Staf</th>
                              <th className="p-4">Jam Masuk</th>
                              <th className="p-4">Jam Pulang</th>
                              <th className="p-4">Metode Absen</th>
                              <th className="p-4">Status Validasi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            <tr className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-4 font-bold text-slate-900">Drs. H. Ahmad Fauzi</td>
                              <td className="p-4 font-mono font-bold text-emerald-600">06:30 WIB</td>
                              <td className="p-4 font-mono text-slate-500">16:00 WIB</td>
                              <td className="p-4 font-medium text-slate-700">GPS Ponsel</td>
                              <td className="p-4"><span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px]">Sah &amp; Tepat Waktu</span></td>
                            </tr>
                            <tr className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-4 font-bold text-slate-900">Rina Wulandari, S.Kom</td>
                              <td className="p-4 font-mono font-bold text-amber-600">07:12 WIB</td>
                              <td className="p-4 font-mono text-slate-400">--:-- WIB</td>
                              <td className="p-4 font-medium text-slate-700">Scan QR Lobi</td>
                              <td className="p-4"><span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg font-bold text-[11px]">Terlambat 12m</span></td>
                            </tr>
                            <tr className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-4 font-bold text-slate-900">Hj. Nuraini, S.Ag</td>
                              <td className="p-4 font-mono text-slate-400">--:-- WIB</td>
                              <td className="p-4 font-mono text-slate-400">--:-- WIB</td>
                              <td className="p-4 font-medium text-slate-700">Surat Dokter</td>
                              <td className="p-4"><span className="px-2.5 py-1 bg-violet-100 text-violet-800 rounded-lg font-bold text-[11px]">Izin Sakit (Disetujui)</span></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── MENU 3: RADAR GEOFENCE GPS ── */}
                  {demoMenu === 'geofence' && (
                    <div className="grid md:grid-cols-2 gap-6 items-center animate-fade-in">
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-black text-slate-900 text-base flex items-center gap-2"><MapPin size={18} className="text-rose-600" /> Pengaturan Titik Koordinat Sekolah</h4>
                          <span className="text-[11px] bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold">Anti-Fake GPS Aktif</span>
                        </div>
                        {simRadius === 85 && (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                            ✅ Berhasil memperbarui toleransi radius menjadi 85 Meter!
                          </div>
                        )}
                        <div className="space-y-3 text-xs font-semibold text-slate-700">
                          <div>
                            <label className="block mb-1.5 text-slate-500">Nama Lokasi Gerbang</label>
                            <input type="text" readOnly value="Gerbang Utama SMA / SMP / Kampus Terpadu" className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-mono" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div><label className="block mb-1.5 text-slate-500">Latitude</label><input type="text" readOnly value="-7.2574719" className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-indigo-600 font-mono font-bold" /></div>
                            <div><label className="block mb-1.5 text-slate-500">Longitude</label><input type="text" readOnly value="112.7520883" className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-indigo-600 font-mono font-bold" /></div>
                          </div>
                          <div>
                            <label className="block mb-1.5 text-slate-500">Radius Toleransi Jarak Absen</label>
                            <div className="flex items-center gap-3">
                              <input type="range" value={simRadius} onChange={(e) => { setSimRadius(Number(e.target.value)); setIsPlayingDemo(false); }} min="20" max="150" className="flex-1 accent-indigo-600 cursor-pointer" />
                              <span className="font-extrabold text-indigo-700 font-mono bg-indigo-50 px-3.5 py-1.5 rounded-xl border border-indigo-200">{simRadius} Meter</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm h-full flex flex-col items-center justify-center text-center relative min-h-[280px] overflow-hidden">
                        <div className="absolute inset-0 bg-radial from-indigo-500/5 to-transparent pointer-events-none" />
                        <div 
                          className="rounded-full border-2 border-dashed border-indigo-500/60 flex items-center justify-center relative animate-spin-slow bg-indigo-500/5 transition-all duration-300"
                          style={{ width: `${simRadius * 2}px`, height: `${simRadius * 2}px` }}
                        >
                          <div className="w-24 h-24 rounded-full border border-indigo-400/30 animate-ping absolute" />
                          <div className="w-6 h-6 rounded-full bg-indigo-600 absolute shadow-lg shadow-indigo-600" />
                        </div>
                        <MapPin size={42} className="text-rose-600 absolute -mt-12 animate-bounce drop-shadow-md" />
                        <p className="text-sm text-slate-900 font-black mt-6">Radar Geofencing Aktif ({simRadius} Meter)</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-xs font-medium">Guru di luar lingkaran hijau otomatis ditolak sistem dengan peringatan jarak langsung di smartphone mereka.</p>
                      </div>
                    </div>
                  )}

                  {/* ── MENU 4: LAPORAN REKAP BOSP ── */}
                  {demoMenu === 'report' && (
                    <div className="space-y-6 animate-fade-in text-xs">
                      {simDownloading && (
                        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-800 font-extrabold flex items-center justify-between animate-bounce shadow-sm">
                          <span className="flex items-center gap-2 text-sm">⬇️ Sedang menyusun &amp; mengunduh file Rekap_Absen_MAN1_Juni_2026.xlsx...</span>
                          <span className="bg-emerald-600 text-white px-3 py-1 rounded-lg font-mono text-xs">100% SIAP</span>
                        </div>
                      )}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
                        <div>
                          <h4 className="font-black text-slate-900 text-base flex items-center gap-2"><FileText className="text-emerald-600" /> Pembuat Laporan Resmi Siap Audit BOSP</h4>
                          <p className="text-slate-500 text-xs mt-1 font-medium">Otomatis merekap kehadiran, potongan keterlambatan, dan cuti bulanan dalam 1 klik.</p>
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => { setSimDownloading(true); setIsPlayingDemo(false); toast.success('Mengunduh Laporan Excel Resmi BOSP!'); }} className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"><FileText size={18} /> Unduh Excel BOSP</button>
                          <button onClick={() => { setSimDownloading(true); setIsPlayingDemo(false); toast.success('Menyiapkan dokumen PDF siap cetak!'); }} className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"><FileText size={18} /> Cetak PDF Dinas</button>
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-4 text-center font-mono">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                          <span className="text-emerald-600 font-extrabold text-sm block mb-1">✓ Kop Surat Sekolah</span>
                          <span className="text-xs text-slate-500 font-sans">Logo instansi &amp; alamat otomatis terlampir</span>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                          <span className="text-indigo-600 font-extrabold text-sm block mb-1">✓ QR Validasi Sah</span>
                          <span className="text-xs text-slate-500 font-sans">Anti pemalsuan tanda tangan Kepala Sekolah</span>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                          <span className="text-amber-600 font-extrabold text-sm block mb-1">✓ Standar Audit Resmi</span>
                          <span className="text-xs text-slate-500 font-sans">Format resmi sesuai pedoman Dinas Pendidikan / Yayasan / Rektorat</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── MENU 5: SCANNER LOBI SEKOLAH ── */}
                  {demoMenu === 'qr' && (
                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-4 animate-fade-in max-w-xl mx-auto">
                      <div className="inline-flex p-4 bg-slate-900 rounded-3xl shadow-2xl border-4 border-indigo-500/20">
                        <div className="w-48 h-48 bg-slate-950 rounded-2xl flex flex-col items-center justify-center text-white p-4 space-y-3 border-2 border-dashed border-indigo-500 animate-pulse">
                          <QrCode size={64} className="text-indigo-400" />
                          <span className="text-xs font-black tracking-wider uppercase font-mono">SCAN ID KARTU / WAJAH</span>
                        </div>
                      </div>
                      <h4 className="font-black text-slate-900 text-lg">Anjungan Presensi Mandiri Lobi Sekolah</h4>
                      <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed font-medium">Letakkan tablet atau HP Android di gerbang/lobi instansi, sekolah, atau kampus. Guru atau dosen cukup menghadapkan wajah atau memindai kartu QR untuk absen masuk dengan suara sapaan otomatis!</p>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Video Player Bottom Controls & Scrub Bar */}
            <div className="bg-slate-900 px-6 py-4 border-t border-slate-800 space-y-3">
              {/* Progress Scrub Bar */}
              <div 
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = (e.clientX - rect.left) / rect.width;
                  const targetStep = Math.floor(pos * 16);
                  setSimStep(targetStep);
                  setIsPlayingDemo(false);
                }}
                className="w-full h-2.5 bg-slate-950 rounded-full cursor-pointer overflow-hidden relative group border border-slate-800"
                title="Klik untuk melompati waktu video animasi"
              >
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-300 relative"
                  style={{ width: `${((simStep + 1) / 16) * 100}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md" />
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPlayingDemo(!isPlayingDemo)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold transition-all shadow-md active:scale-95"
                  >
                    {isPlayingDemo ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                    {isPlayingDemo ? "Jeda Otomatis" : "Putar Otomatis"}
                  </button>
                  <button
                    onClick={() => { setSimStep(0); setDemoScreen('login'); setIsPlayingDemo(true); }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="Ulangi dari Awal"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <span className="text-slate-400 hidden sm:inline font-medium text-[11px]">✨ Tips: Pengunjung dapat mengklik tombol apapun untuk mencoba aplikasi secara langsung!</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Status: <span className="text-indigo-400 font-bold">{demoScreen === 'login' ? 'Layar Login' : `Dasbor Admin (${demoMenu.toUpperCase()})`}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Cara Kerja 3 Langkah ── */}
      <section id="carakerja" className="py-24 px-6 bg-slate-100/70 border-y border-slate-200">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-blue-600">Alur Penggunaan Mudah</h2>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Cara Kerja ABDI dalam 3 Langkah</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-md border border-slate-200 relative text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-lg shadow-blue-600/30">1</div>
              <h4 className="font-black text-slate-900 text-lg">Registrasi & Pengaturan Peta</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Daftarkan sekolah/instansi Anda via Free Trial 2 Minggu (14 Hari). Tentukan koordinat gerbang utama pada peta digital beserta radius toleransi.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-md border border-slate-200 relative text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-lg shadow-blue-600/30">2</div>
              <h4 className="font-black text-slate-900 text-lg">Bagikan Akses ke Guru</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Sistem membuatkan akun otomatis. Bagikan link aplikasi ke grup WhatsApp guru agar mereka langsung bisa login dengan aman.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-md border border-slate-200 relative text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-lg shadow-blue-600/30">3</div>
              <h4 className="font-black text-slate-900 text-lg">Presensi Saku Real-Time</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Guru tiba di sekolah dan menekan tombol absen di HP masing-masing. Data langsung tercatat akurat di dasbor pemantauan Kepala Sekolah.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── UPDATE 2: TABEL PERBANDINGAN PAKET HARGA (Pricing Tiers) ── */}
      <section id="harga" className="py-24 px-6 max-w-7xl mx-auto space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-blue-600">Paket Kontribusi &amp; Berlangganan</h2>
          <p className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">Investasi Terbaik untuk Pendidikan, Infaq Seikhlasnya</p>
          <p className="text-sm text-slate-600 font-medium max-w-3xl mx-auto">
            Kami berkomitmen mendukung digitalisasi sekolah dan instansi di seluruh Indonesia. Mulai uji coba gratis selama 2 minggu, lalu lanjutkan dengan kontribusi infaq sukarela seikhlasnya tanpa beban biaya kaku!
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto items-stretch pt-6 sm:pt-8">
          
          {/* Tier 1: TRIAL 14 HARI (2 MINGGU) */}
          <div className="bg-slate-50 rounded-3xl p-7 sm:p-9 border border-slate-200/80 shadow-md flex flex-col justify-between hover:border-emerald-400 transition-all relative overflow-hidden group">
            <div className="space-y-6">
              <div>
                <span className="px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider">Uji Coba Gratis</span>
                <h3 className="text-3xl font-black text-slate-900 mt-3">Paket Trial</h3>
                <p className="text-sm text-slate-500 mt-1 font-medium">Tes langsung seluruh keunggulan sistem presensi digital.</p>
              </div>
              <div className="border-y border-slate-200/70 py-6 my-2 font-black">
                <div className="flex items-baseline">
                  <span className="text-4xl sm:text-5xl text-slate-900 tracking-tight">Gratis</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-slate-500 mt-2 leading-relaxed flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200">
                    ⏱️ Berlaku 2 Minggu (14 Hari)
                  </span>
                  <span>&bull; Hingga 10 Personel</span>
                </div>
                <p className="text-xs text-emerald-700 font-extrabold mt-4 italic leading-relaxed">
                  "Buktikan keandalan rekap absen otomatis dan geofencing GPS tanpa keluar biaya atau kartu kredit sepeser pun."
                </p>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-600 font-semibold">
                <li className="flex items-center gap-2.5"><Check size={18} className="text-emerald-600 shrink-0 font-bold" /> <span>Masa Uji Coba Penuh <strong>2 Minggu (14 Hari)</strong></span></li>
                <li className="flex items-center gap-2.5"><Check size={18} className="text-emerald-600 shrink-0 font-bold" /> <span>Kapasitas Hingga <strong>10 Guru &amp; Staf</strong></span></li>
                <li className="flex items-center gap-2.5"><Check size={18} className="text-emerald-600 shrink-0 font-bold" /> <span>Validasi Geofencing GPS Anti-Fake GPS &amp; Selfie</span></li>
                <li className="flex items-center gap-2.5"><Check size={18} className="text-emerald-600 shrink-0 font-bold" /> <span>Stasiun Scan QR Code untuk Gerbang Lobi</span></li>
                <li className="flex items-center gap-2.5"><Check size={18} className="text-emerald-600 shrink-0 font-bold" /> <span>Manajemen Izin, Sakit &amp; Cuti Operasional</span></li>
                <li className="flex items-center gap-2.5"><Check size={18} className="text-emerald-600 shrink-0 font-bold" /> <span>Notifikasi WhatsApp OTP 2FA</span></li>
              </ul>
            </div>
            <Link
              to="/login"
              className="w-full py-4 mt-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm text-center shadow-lg shadow-emerald-600/25 transition-all block group-hover:scale-[1.02]"
            >
              🚀 Mulai Uji Coba 2 Minggu Sekarang
            </Link>
          </div>

          {/* Tier 2: PAKET FULL (INFAQ SEIKHLASNYA) - UTAMA */}
          <div className="bg-gradient-to-b from-blue-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-7 sm:p-9 border-2 border-amber-400 shadow-2xl flex flex-col justify-between relative scale-100 md:scale-105 z-10 overflow-hidden">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-slate-950 px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5 whitespace-nowrap border border-white/20">
              <Sparkles size={15} className="animate-spin" /> PAKET UTAMA &amp; TERPOPULER
            </div>
            <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-6 pt-3 sm:pt-2">
              <div>
                <span className="px-3.5 py-1.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-black uppercase tracking-wider border border-amber-400/30">
                  💖 Kontribusi Sukarela
                </span>
                <h3 className="text-3xl font-black text-white mt-3 flex items-center gap-2">
                  <span>Paket Full</span>
                </h3>
                <p className="text-sm text-slate-300 mt-1 font-medium leading-relaxed">
                  Nikmati seluruh fitur premium tanpa batas untuk mendukung kemajuan sekolah Anda.
                </p>
              </div>
              <div className="border-y border-slate-800 py-6 my-2 font-black">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-300 to-amber-400 tracking-tight">
                    Infaq Seikhlasnya
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-slate-300 mt-2 leading-relaxed flex items-center gap-2">
                  <span className="bg-amber-400/10 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-400/20">
                    ✨ Berlaku 1 Tahun Ajaran / Unlimited
                  </span>
                </div>
                <p className="text-xs text-amber-200/90 font-bold mt-4 leading-relaxed bg-white/5 p-3.5 rounded-2xl border border-white/10">
                  🙏 <span className="italic">"Kami tidak menetapkan tarif kaku. Kontribusi infaq sukarela dari instansi Anda akan digunakan sepenuhnya untuk biaya server &amp; pengembangan berkelanjutan ABDI."</span>
                </p>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-200 font-semibold">
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-amber-400 shrink-0" /> <span><strong>Kapasitas Personel Tidak Terbatas (Unlimited)</strong></span></li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-amber-400 shrink-0" /> <span><strong>Akses Penuh Seluruh Fitur</strong> Tanpa Batasan Apa Pun</span></li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-amber-400 shrink-0" /> <span>Dynamic QR Code Scanner &amp; Multi-Stasiun Lobi</span></li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-amber-400 shrink-0" /> <span>Ekspor Laporan Resmi Kop Sekolah + Excel &amp; PDF</span></li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-amber-400 shrink-0" /> <span><strong>AI Analytics Insights</strong> Presensi Real-Time</span></li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-amber-400 shrink-0" /> <span>Dukungan Prioritas Customer Care Helpdesk via WA</span></li>
              </ul>
            </div>
            <a
              href={`https://wa.me/${landingConfig.waHelpdesk}?text=Halo%20Admin%20ABDI,%20instansi/sekolah%20kami%20ingin%20berkontribusi%20dan%20mengaktifkan%20*Paket%20Full%20(Infaq%20Seikhlasnya)*.%20Bagaimana%20prosedur%20dan%20panduannya?`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-4 mt-8 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-sm text-center shadow-xl shadow-amber-500/25 transition-all block scale-100 hover:scale-[1.02] active:scale-98"
            >
              💖 Berlangganan Paket Full via WA Sekarang
            </a>
          </div>

        </div>
      </section>

      {/* ── Testimoni & Bukti Klien ── */}
      {/* ── Testimoni & Bukti Klien ── */}
      <section id="testimoni" className="py-24 px-6 max-w-7xl mx-auto space-y-12 border-t border-slate-200">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
            <Quote size={13} /> Bukti Nyata Penggunaan di Berbagai Instansi
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Dipercaya Berbagai Sekolah & Kampus</h2>
          <p className="text-sm text-slate-600 font-medium">Ulasan asli terverifikasi dari Kepala Sekolah, Rektor, Ketua Yayasan, Staf TU, dan Guru/Dosen mengenai kemudahan ABDI.</p>
        </div>

        {/* Rating Summary Box */}
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-wrap items-center justify-around gap-6 text-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 text-2xl font-black">⭐</div>
            <div className="text-left">
              <p className="text-2xl font-black text-white leading-none">4.9 <span className="text-xs text-slate-400 font-normal">/ 5.0</span></p>
              <p className="text-xs text-amber-300 font-bold mt-1">Rata-rata Kepuasan Klien</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 text-2xl font-black">🏢</div>
            <div className="text-left">
              <p className="text-2xl font-black text-white leading-none">{allTestimonialsData.length}+ <span className="text-xs text-slate-400 font-normal">Testimoni</span></p>
              <p className="text-xs text-emerald-300 font-bold mt-1">Ulasan Nyata Terverifikasi</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-400/20 border border-sky-400/40 flex items-center justify-center text-sky-400 text-2xl font-black">🤝</div>
            <div className="text-left">
              <p className="text-2xl font-black text-white leading-none">100% <span className="text-xs text-slate-400 font-normal">Asli</span></p>
              <p className="text-xs text-sky-300 font-bold mt-1">Tanpa Ulasan Fiktif</p>
            </div>
          </div>
        </div>

        {/* Tombol Tulis Testimoni Nyata */}
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setIsTestiModalOpen(true)}
            className="px-6 py-3.5 rounded-full bg-gradient-to-r from-[#b829ff] to-[#7928CA] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-500/30 hover:scale-105 transition-all flex items-center gap-2"
          >
            ✍️ Bagikan Testimoni Nyata Anda
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <button
            onClick={() => setActiveTestiCategory('semua')}
            className={`px-5 py-2.5 rounded-full text-xs font-extrabold transition-all shadow-sm ${activeTestiCategory === 'semua' ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20 scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            🌟 Semua Ulasan ({allTestimonialsData.length})
          </button>
          <button
            onClick={() => setActiveTestiCategory('pimpinan')}
            className={`px-5 py-2.5 rounded-full text-xs font-extrabold transition-all shadow-sm ${activeTestiCategory === 'pimpinan' ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20 scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            👑 Kepala Sekolah / Yayasan (9)
          </button>
          <button
            onClick={() => setActiveTestiCategory('guru')}
            className={`px-5 py-2.5 rounded-full text-xs font-extrabold transition-all shadow-sm ${activeTestiCategory === 'guru' ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20 scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            👨‍🏫 Guru &amp; Wakasek (3)
          </button>
          <button
            onClick={() => setActiveTestiCategory('staf')}
            className={`px-5 py-2.5 rounded-full text-xs font-extrabold transition-all shadow-sm ${activeTestiCategory === 'staf' ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20 scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            💼 Tata Usaha &amp; Bendahara (3)
          </button>
        </div>

        {/* Carousel Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-100/80 p-3 sm:px-6 rounded-2xl border border-slate-200/80">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAutoPlayTesti(!isAutoPlayTesti)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition-all shadow-md active:scale-95"
            >
              {isAutoPlayTesti ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              {isAutoPlayTesti ? "Jeda Slide Otomatis" : "Putar Slide Otomatis"}
            </button>
            <span className="text-xs text-slate-500 hidden sm:inline font-medium">✨ Geser otomatis setiap 4 detik</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
              Slide {testiSlideIdx + 1} dari {maxSlideIdx + 1}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setIsAutoPlayTesti(false);
                  setTestiSlideIdx((prev) => (prev <= 0 ? maxSlideIdx : prev - 1));
                }}
                className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition-all active:scale-90"
                title="Slide Sebelumnya"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => {
                  setIsAutoPlayTesti(false);
                  setTestiSlideIdx((prev) => (prev >= maxSlideIdx ? 0 : prev + 1));
                }}
                className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition-all active:scale-90"
                title="Slide Selanjutnya"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Testimonials Slide Track */}
        <div className="overflow-hidden relative w-full py-4 -mx-3 px-3">
          <div 
            className="flex transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${testiSlideIdx * (100 / itemsPerView)}%)` }}
          >
            {filteredTestimonials.map((item) => (
              <div 
                key={item.id} 
                className="px-3 shrink-0"
                style={{ width: itemsPerView === 1 ? '100%' : itemsPerView === 2 ? '50%' : '33.3333%' }}
              >
                <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-100/80 space-y-5 flex flex-col justify-between hover:-translate-y-1.5 hover:border-indigo-400 hover:shadow-2xl transition-all duration-300 group relative overflow-hidden h-full">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-50 to-transparent rounded-bl-full pointer-events-none group-hover:from-indigo-100/60 transition-colors" />
                  <div className="space-y-4 relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex text-amber-400 gap-1">
                        {[...Array(item.rating)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                      </div>
                      <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold shadow-sm">
                        ✨ {item.highlight}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 italic leading-relaxed font-medium">
                      "{item.quote}"
                    </p>
                  </div>
                  <div className="flex items-center gap-3.5 pt-4 border-t border-slate-100 relative z-10">
                    <div className="relative shrink-0">
                      <img 
                        src={item.avatar} 
                        alt={item.name} 
                        className="w-12 h-12 rounded-full object-cover border-2 border-indigo-200 group-hover:border-indigo-600 transition-colors shadow-md"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white shadow-sm" title="Terverifikasi Klien Nyata">
                        <CheckCircle2 size={12} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h5 className="font-black text-slate-900 text-sm leading-tight flex items-center gap-1">
                          {item.name}
                        </h5>
                        {item.id.startsWith('real-') && (
                          <button
                            onClick={() => handleDeleteRealTesti(item.id)}
                            className="text-[10px] text-red-500 hover:text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded-md transition-colors"
                            title="Hapus ulasan Anda"
                          >
                            🗑️ Hapus
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-indigo-600 font-bold mt-0.5">{item.role}</p>
                      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{item.school} &bull; <span className="text-slate-400 font-medium">{item.location}</span></p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Slide Progress Dots */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {[...Array(maxSlideIdx + 1)].map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setIsAutoPlayTesti(false);
                setTestiSlideIdx(idx);
              }}
              className={`h-2.5 rounded-full transition-all duration-300 ${testiSlideIdx === idx ? 'w-8 bg-indigo-600 shadow-md' : 'w-2.5 bg-slate-300 hover:bg-slate-400'}`}
              title={`Lompat ke slide ${idx + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ── FAQ Section ── */}
      <section id="faq" className="py-24 px-6 bg-slate-100/80 border-t border-slate-200">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-blue-600">FAQ</h2>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Pertanyaan Umum Calon Pengguna</p>
          </div>

          <div className="space-y-4">
            {faqs.map((f, i) => (
              <div key={i} className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden transition-all">
                <button
                  onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                  className="w-full p-6 text-left font-black text-slate-900 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm sm:text-base">{f.q}</span>
                  <ChevronDown size={18} className={`text-blue-600 transition-transform ${activeFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {activeFaq === i && (
                  <div className="px-6 pb-6 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4 font-medium animate-fade-in">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── UPDATE 3: FORM LEAD GENERATION ("Jadwalkan Demo Eksklusif") ── */}
      <section id="jadwaldemo" className="py-24 px-6 bg-gradient-to-b from-slate-100 to-blue-50 border-t border-slate-200">
        <div className="max-w-5xl mx-auto grid md:grid-cols-12 gap-12 items-center bg-white rounded-3xl p-8 sm:p-14 shadow-2xl border border-slate-200/80">
          
          <div className="md:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-extrabold text-xs">
              <Calendar size={14} /> KONSULTASI & DEMO GRATIS
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Ingin Dipandu Langsung Oleh Ahli Sistem Kami?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              Isi formulir singkat di samping. Tim konsultan pendidikan kami akan mengirimkan akses sandi demo dasbor interaktif langsung ke WhatsApp Anda dalam waktu &lt; 5 menit.
            </p>
            <div className="space-y-3 pt-2 text-xs font-extrabold text-slate-700">
              <div className="flex items-center gap-2.5"><UserCheck size={18} className="text-blue-600 shrink-0" /> Pendampingan Migrasi Data Guru Gratis</div>
              <div className="flex items-center gap-2.5"><UserCheck size={18} className="text-blue-600 shrink-0" /> Simulasi Perhitungan Potongan Gaji</div>
              <div className="flex items-center gap-2.5"><UserCheck size={18} className="text-blue-600 shrink-0" /> Tanya Jawab Kebutuhan Khusus Sekolah</div>
            </div>
          </div>

          <div className="md:col-span-6">
            {!isLeadSubmitted ? (
              <form onSubmit={handleLeadSubmit} className="space-y-4 bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-inner text-xs font-bold text-slate-700">
                <h4 className="text-base font-black text-slate-900 mb-2">Form Jadwalkan Demo WA</h4>
                <div>
                  <label className="block mb-1.5">Nama Lengkap Kepala Sekolah / Admin</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Drs. H. Budi Santoso, M.Pd."
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    className="w-full p-3 rounded-xl bg-white border border-slate-300 focus:border-blue-600 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block mb-1.5">Nama Instansi / Sekolah / Kampus</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: SMA / SMP / Kampus Terpadu Surabaya"
                    value={leadSchool}
                    onChange={(e) => setLeadSchool(e.target.value)}
                    className="w-full p-3 rounded-xl bg-white border border-slate-300 focus:border-blue-600 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block mb-1.5">Nomor WhatsApp Aktif (Untuk Kirim Sandi Demo)</label>
                  <input
                    type="tel"
                    required
                    placeholder="Contoh: 081123456789"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    className="w-full p-3 rounded-xl bg-white border border-slate-300 focus:border-blue-600 outline-none font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block mb-1.5">Perkiraan Jumlah Tenaga Pendidik</label>
                  <select
                    value={leadSize}
                    onChange={(e) => setLeadSize(e.target.value)}
                    className="w-full p-3 rounded-xl bg-white border border-slate-300 focus:border-blue-600 outline-none font-medium"
                  >
                    <option value="<30">Di bawah 30 Personel Guru & Staf</option>
                    <option value="30-100">30 sampai 100 Personel (Standar)</option>
                    <option value=">100">Di atas 100 Personel (Kampus/Yayasan Besar)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-4 mt-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
                >
                  <Send size={16} /> Minta Sandi Demo Sekarang
                </button>
                <p className="text-[10px] text-slate-400 text-center font-medium mt-2">🔒 Data Anda aman 100% dan tidak akan distempel spam.</p>
              </form>
            ) : (
              <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-8 text-center space-y-4 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg">
                  <Check size={36} />
                </div>
                <h4 className="text-xl font-black text-slate-900">Permintaan Terkirim!</h4>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Terima kasih <strong>{leadName}</strong> dari <strong>{leadSchool}</strong>. Tim teknis kami sedang menyiapkan akun sandi demo interaktif dan mengirimkannya ke WhatsApp <strong>{leadPhone}</strong> sejenak lagi.
                </p>
                <a
                  href={`https://wa.me/6282297585638?text=Halo%20Tim%20ABDI,%20saya%20${leadName}%20dari%20${leadSchool}%20baru%20saja%20mengisi%20form%20minta%20demo.`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#25D366] text-white font-black text-xs shadow-md hover:scale-105 transition-transform"
                >
                  <MessageCircle size={16} /> Chat WA Prioritas Sekarang
                </a>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ── Big Pricing / CTA Box ── */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-10 md:p-16 text-center text-white space-y-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-4 max-w-3xl mx-auto relative z-10">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">Siap Mendigitalisasi Presensi Sekolah Anda Hari Ini?</h2>
            <p className="text-sm sm:text-base text-blue-100 font-medium leading-relaxed">
              Nikmati masa uji coba gratis selama 1 Tahun Ajaran tanpa biaya apa pun. Rasakan kemudahan pengelolaan kedisiplinan pengajar sekarang.
            </p>
          </div>

          <div className="pt-2 relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="w-full sm:w-auto px-9 py-4 rounded-full bg-white text-blue-700 hover:bg-blue-50 text-sm font-black shadow-2xl transition-all hover:scale-105 flex items-center justify-center gap-2"
            >
              🎁 Mulai Uji Coba Gratis 1 Tahun &rarr;
            </Link>
          </div>
          <p className="text-[11px] text-blue-200 font-bold">Langsung Aktif &bull; Tanpa Kartu Kredit &bull; Full Support Tim Ahli</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12 px-6 border-t border-slate-200 text-center text-xs text-slate-500 space-y-6 bg-white">
        <div className="flex flex-wrap items-center justify-center gap-6 font-black text-slate-950 text-xs sm:text-sm">
          <button onClick={() => setActiveLegalModal('tnc')} className="hover:text-blue-600 transition-colors">Syarat & Ketentuan</button>
          <button onClick={() => setActiveLegalModal('privacy')} className="hover:text-blue-600 transition-colors">Kebijakan Privasi</button>
          <button onClick={() => setActiveLegalModal('security')} className="hover:text-blue-600 transition-colors">Kebijakan Keamanan</button>
          <button onClick={() => setActiveLegalModal('eula')} className="hover:text-blue-600 transition-colors">Perjanjian Lisensi (EULA)</button>
          <button onClick={() => setIsAiChatOpen(true)} className="hover:text-blue-600 transition-colors cursor-pointer">Hubungi Kami</button>
        </div>
        
        <div className="flex items-center justify-center gap-3">
          <img src="/logo-abdi.png" alt="Logo" className="w-6 h-6 object-contain grayscale opacity-60" />
          <span className="font-black text-slate-700 tracking-wider">ABDI Absensi Digital</span>
        </div>
        <p className="font-medium">&copy; 2026 Alpha Project. All rights reserved</p>
      </footer>

      {/* ── Live Chat Window ── */}
      {isAiChatOpen && (
        <div className="fixed bottom-24 right-6 w-[360px] max-w-[calc(100vw-3rem)] h-[500px] max-h-[75vh] bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden animate-fade-in text-left">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#b829ff] via-[#7928CA] to-[#5e1e9d] p-4 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <img
                src="/cs-avatar.png"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=CS+Helpdesk&background=7928CA&color=fff&bold=true'; }}
                alt="Live CS"
                className="w-10 h-10 rounded-2xl object-cover border border-white/40 shadow-inner bg-purple-100"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-black text-sm">Live CS Helpdesk</h4>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <p className="text-[10px] text-purple-200 font-medium">Tim Live CS (Customer Success) &bull; Online</p>
              </div>
            </div>
            <button
              onClick={() => setIsAiChatOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50 text-xs">
            <div className="text-center my-2">
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[9px] uppercase tracking-wider border border-emerald-200">
                🟢 Terhubung dengan Live CS (Customer Success)
              </span>
            </div>
            {aiMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className={`flex items-end gap-2 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.sender === 'ai' && (
                    <img
                      src="/cs-avatar.png"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=CS&background=7928CA&color=fff&bold=true'; }}
                      alt="Live CS"
                      className="w-6 h-6 rounded-full object-cover shrink-0 mb-1 border border-purple-200 bg-purple-50"
                    />
                  )}
                  <div
                    className={`p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap font-medium shadow-sm ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none font-bold'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
                <span className={`text-[9px] text-slate-400 mt-1 px-1 font-bold ${msg.sender === 'ai' ? 'ml-8' : ''}`}>
                  {msg.time}
                </span>
              </div>
            ))}
            {isAiTyping && (
              <div className="flex items-start pl-8">
                <div className="bg-white text-slate-500 border border-slate-200 py-2.5 px-4 rounded-2xl rounded-bl-none flex items-center gap-2 shadow-sm">
                  <MessageCircle size={14} className="text-emerald-500 animate-bounce" />
                  <span className="text-[11px] font-bold text-slate-600 animate-pulse">Tim Live CS sedang mengetik pesan...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Footer */}
          <form onSubmit={handleSendAiMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={aiInputText}
              onChange={(e) => setAiInputText(e.target.value)}
              placeholder="Ketik pesan untuk Live CS..."
              className="flex-1 px-4 py-2.5 bg-slate-100 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-2xl text-xs font-semibold outline-none transition-all text-slate-800"
            />
            <button
              type="submit"
              disabled={!aiInputText.trim()}
              className="w-10 h-10 rounded-2xl bg-gradient-to-r from-[#b829ff] to-[#7928CA] hover:from-[#c24bff] hover:to-[#8630db] disabled:opacity-50 text-white flex items-center justify-center shadow-md transition-all cursor-pointer shrink-0"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      {/* ── Floating Live Chat Trigger Button ── */}
      <button
        onClick={() => setIsAiChatOpen(!isAiChatOpen)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-[#b829ff] via-[#7928CA] to-[#5e1e9d] hover:from-[#c24bff] hover:to-[#8630db] text-white p-4 rounded-full shadow-[0_8px_25px_rgba(121,40,202,0.5)] hover:scale-110 transition-all flex items-center justify-center group cursor-pointer border-2 border-white/20 animate-bounce"
        title="Live Chat Helpdesk"
      >
        <MessageCircle size={28} className="text-white fill-white/20 animate-pulse" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-500 font-black text-xs group-hover:pl-2.5">
          Live Chat
        </span>
      </button>

      {/* ── Legal Modal ── */}
      {activeLegalModal && legalContent[activeLegalModal] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-6 text-left relative shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <Shield className="text-blue-600" size={20} />
                <h3 className="font-black text-slate-900 text-base">{legalContent[activeLegalModal].title}</h3>
              </div>
              <button onClick={() => setActiveLegalModal(null)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl bg-slate-100">
                <X size={18} />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2">
              {legalContent[activeLegalModal].content}
            </div>

            <button
              onClick={() => setActiveLegalModal(null)}
              className="w-full py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs text-center shadow-md transition-all"
            >
              Saya Mengerti & Setuju
            </button>
          </div>
        </div>
      )}

      {/* ── Real Testimony Modal ── */}
      {isTestiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-5 text-left relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Quote className="text-purple-600" size={20} />
                <h3 className="font-black text-slate-900 text-base">✍️ Bagikan Testimoni Nyata Anda</h3>
              </div>
              <button onClick={() => setIsTestiModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddRealTestimony} className="space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="block mb-1 text-slate-600">Nama Lengkap & Gelar <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Drs. H. Ahmad Fauzi, M.Pd."
                  value={newTestiForm.name}
                  onChange={e => setNewTestiForm({...newTestiForm, name: e.target.value})}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-600">Jabatan / Posisi</label>
                  <select
                    value={newTestiForm.role}
                    onChange={e => setNewTestiForm({...newTestiForm, role: e.target.value})}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none font-medium text-slate-800 bg-white"
                  >
                    <option value="Kepala Sekolah / Rektor / Dekan">Kepala Sekolah / Rektor / Dekan</option>
                    <option value="Kepala Sekolah">Kepala Sekolah</option>
                    <option value="Ketua Yayasan">Ketua Yayasan</option>
                    <option value="Wakasek Kurikulum">Wakasek Kurikulum</option>
                    <option value="Guru Kelas / Mapel">Guru Kelas / Mapel</option>
                    <option value="Staf Tata Usaha">Staf Tata Usaha</option>
                    <option value="Bendahara Sekolah">Bendahara Sekolah</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-slate-600">Rating Penilaian</label>
                  <select
                    value={newTestiForm.rating}
                    onChange={e => setNewTestiForm({...newTestiForm, rating: Number(e.target.value)})}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none font-medium text-amber-600 bg-white"
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ (5/5)</option>
                    <option value={4}>⭐⭐⭐⭐ (4/5)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-600">Nama Instansi/Sekolah/Kampus</label>
                  <input
                    type="text"
                    placeholder="Contoh: SMA / SMP / Kampus Terpadu"
                    value={newTestiForm.school}
                    onChange={e => setNewTestiForm({...newTestiForm, school: e.target.value})}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-600">Kota / Provinsi</label>
                  <input
                    type="text"
                    placeholder="Contoh: Bandung"
                    value={newTestiForm.location}
                    onChange={e => setNewTestiForm({...newTestiForm, location: e.target.value})}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none font-medium text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-600">Judul / Sorotan Utama</label>
                <input
                  type="text"
                  placeholder="Contoh: Rekap BOSP Sangat Cepat & Akurat"
                  value={newTestiForm.highlight}
                  onChange={e => setNewTestiForm({...newTestiForm, highlight: e.target.value})}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-600">Ulasan Nyata Pengalaman Anda <span className="text-red-500">*</span></label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ceritakan pengalaman nyata atau manfaat efisiensi yang dirasakan instansi / sekolah Anda setelah menggunakan aplikasi ABDI..."
                  value={newTestiForm.quote}
                  onChange={e => setNewTestiForm({...newTestiForm, quote: e.target.value})}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-600">Upload Foto Profil <span className="text-slate-400 font-normal">(Opsional, maks. 2 MB)</span></label>
                <div className="flex items-center gap-3">
                  {newTestiForm.avatarUrl ? (
                    <div className="relative">
                      <img src={newTestiForm.avatarUrl} alt="Preview" className="w-12 h-12 rounded-full object-cover border-2 border-purple-500 shadow-sm" />
                      <button type="button" onClick={() => setNewTestiForm(prev => ({...prev, avatarUrl: ''}))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 text-[10px]" title="Hapus foto">✕</button>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 font-bold text-lg">📷</div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleTestiAvatarUpload}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsTestiModalOpen(false)}
                  className="flex-1 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-full bg-gradient-to-r from-[#b829ff] to-[#7928CA] text-white font-black text-xs shadow-lg shadow-purple-500/30 hover:scale-105 transition-all flex items-center justify-center gap-1.5"
                >
                  🚀 Publikasikan Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Floating Edit Button (Aktif HANYA ketika Mode Developer diaktifkan) ── */}
      {isDevMode && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 animate-fade-in">
          <button
            onClick={() => {
              setEditLandingForm(landingConfig);
              setIsEditLandingModalOpen(true);
            }}
            className="px-5 py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-black text-xs shadow-2xl hover:scale-105 transition-all flex items-center gap-2 animate-bounce ring-4 ring-purple-500/30"
          >
            ✏️ Edit Konten Landing Page
          </button>
          <button
            onClick={() => {
              setIsDevMode(false);
              localStorage.setItem('abdi_dev_mode_landing', 'false');
              toast.success("Mode Edit Landing Page ditutup.");
            }}
            className="w-10 h-10 rounded-full bg-slate-900/90 hover:bg-red-600 text-white font-black text-xs shadow-xl transition-all flex items-center justify-center border border-slate-700"
            title="Keluar dari Mode Edit Landing Page"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Modal Edit Konten Landing Page (Developer Mode) ── */}
      {isEditLandingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 font-black text-lg shadow-md">
                  🛠️
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 leading-tight">Edit Konten Landing Page</h3>
                  <p className="text-xs text-slate-500 font-medium">Khusus Pengembang / Developer Mode</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditLandingModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLandingConfig} className="space-y-4 max-h-[65vh] overflow-y-auto pr-2 text-left text-xs font-bold">
              <div>
                <label className="block mb-1 text-slate-700">Teks Top Promo Bar Atas</label>
                <input
                  type="text"
                  value={editLandingForm.promoBar}
                  onChange={e => setEditLandingForm({...editLandingForm, promoBar: e.target.value})}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-700">Headline Teks Biasa</label>
                  <input
                    type="text"
                    value={editLandingForm.heroTitleText}
                    onChange={e => setEditLandingForm({...editLandingForm, heroTitleText: e.target.value})}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-700">Headline Teks Gradasi Warna</label>
                  <input
                    type="text"
                    value={editLandingForm.heroTitleHighlight}
                    onChange={e => setEditLandingForm({...editLandingForm, heroTitleHighlight: e.target.value})}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none font-medium text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-700">Sub-Headline Deskripsi Singkat</label>
                <textarea
                  rows={2}
                  value={editLandingForm.heroSubtitle}
                  onChange={e => setEditLandingForm({...editLandingForm, heroSubtitle: e.target.value})}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none font-medium text-slate-800"
                />
              </div>

              <div className="border-t border-slate-200 pt-3">
                <h4 className="text-slate-800 font-black text-sm mb-2">Konfigurasi Harga &amp; Masa Uji Coba</h4>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-3 leading-relaxed">
                  💡 <strong>Info Sistem Baru:</strong> Paket publik kini berfokus pada <strong>Paket Trial (14 Hari / 2 Minggu)</strong> dan <strong>Paket Full (Infaq Seikhlasnya)</strong> agar lembaga pendidikan dapat mengakses fitur secara penuh tanpa hambatan biaya.
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-700">Nomor WhatsApp Live Helpdesk & Sales (tanpa tanda +)</label>
                <input
                  type="text"
                  value={editLandingForm.waHelpdesk}
                  onChange={e => setEditLandingForm({...editLandingForm, waHelpdesk: e.target.value})}
                  placeholder="Contoh: 6282297585638"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-700">API Key Google Gemini LLM <span className="text-purple-600 font-bold">(Opsional untuk Otak AI Live CS)</span></label>
                <input
                  type="text"
                  value={(editLandingForm as any).geminiApiKey || ""}
                  onChange={e => {
                    const val = e.target.value;
                    setEditLandingForm({...editLandingForm, geminiApiKey: val} as any);
                    localStorage.setItem('abdi_gemini_api_key', val);
                  }}
                  placeholder="Contoh: AIzaSyD..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 outline-none font-mono text-xs text-purple-700 bg-purple-50/50"
                />
                <p className="text-[10px] text-slate-500 font-normal mt-1">Jika diisi, Live CS akan menjawab secara otomatis menggunakan LLM Google Gemini 1.5 Flash. Jika dikosongkan, Live CS menggunakan sistem respons cerdas bawaan.</p>
              </div>

              <div className="pt-3 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditLandingModalOpen(false)}
                  className="flex-1 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-black shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-1.5"
                >
                  💾 Simpan Perubahan Landing Page
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
