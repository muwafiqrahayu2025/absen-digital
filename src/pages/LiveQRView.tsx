import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PremiumQRCard } from "../components/PremiumQRCard";
import { db } from "../lib/db";
import {
  Maximize2,
  Minimize2,
  X,
  ZoomIn,
  ZoomOut,
  Clock,
  Calendar,
  Radio,
  Volume2,
  Sparkles,
  CheckCircle2,
  Smartphone,
  Tv,
} from "lucide-react";
import { calculateCycleEndDate, QrCycleType } from "../lib/qrScheduler";
import { DEFAULT_KIOSK_BG_URL, DEFAULT_MARQUEE_TEXT } from "../types";

const FooterMarquee = React.memo(({ text }: { text: string }) => {
  return (
    <footer className="relative z-30 w-full bg-slate-950/85 backdrop-blur-lg border-t border-white/15 py-2 sm:py-3 px-3 sm:px-6 shadow-2xl flex items-center overflow-hidden shrink-0">
      <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300 font-extrabold text-[10px] sm:text-xs shrink-0 shadow-md whitespace-nowrap z-30 relative mr-2 sm:mr-3">
        <Radio size={12} className="animate-pulse text-amber-400 sm:w-3.5 sm:h-3.5" />
        <span className="hidden sm:inline">LIVE QR DISPLAY</span>
        <span className="sm:hidden">LIVE</span>
      </div>
      <div className="flex-1 min-w-0 overflow-hidden relative h-full flex items-center pl-4 sm:pl-6 lg:pl-8 border-l border-white/15">
        <div className="flex flex-row items-center whitespace-nowrap animate-marquee ease-linear text-[10px] sm:text-sm font-semibold tracking-wide text-slate-200 select-none">
          <span className="pr-8 sm:pr-12 shrink-0">{text}</span>
          <span className="pr-8 sm:pr-12 shrink-0">{text}</span>
        </div>
      </div>
    </footer>
  );
});

export function LiveQRView() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  // ──────────────────────────────────────────────────────────
  // STATE
  // ──────────────────────────────────────────────────────────
  const [school, setSchool] = useState(() => db.getSchool());
  // scale hanya berlaku di layar lg (≥1024px). Di mobile selalu 1.
  const [scale, setScale] = useState<number>(1);
  const [isDesktop, setIsDesktop] = useState<boolean>(
    () => window.innerWidth >= 1024
  );
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    !!document.fullscreenElement
  );
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [speechIndex, setSpeechIndex] = useState<number>(0);
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(true);

  // Ambil data QR aktif dari localStorage
  const [activeQrData, setActiveQrData] = useState<any>(() => {
    const saved = localStorage.getItem("current_active_qr");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }
    return {
      session: id ? id.replace(/-/g, " ").toUpperCase() : "ABSENSI HARIAN",
      date: new Date().toISOString().slice(0, 10),
      type: "check_in",
      token: "TOKEN-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
      timestamp: Date.now(),
      cycle: "daily" as QrCycleType,
    };
  });

  const [logoUrl, setLogoUrl] = useState<string>(() => {
    const saved = localStorage.getItem("qr_embedded_logo_admin");
    const schoolData = db.getSchool();
    return saved || schoolData.logoUrl || schoolData.kopSurat?.logo_url || "/logo.png";
  });

  const [kioskBgUrl, setKioskBgUrl] = useState<string>(() => {
    const savedBg = localStorage.getItem("qr_kiosk_bg_url");
    const schoolData = db.getSchool();
    return (savedBg && savedBg.trim() !== "")
      ? savedBg
      : (schoolData.kioskBgUrl && schoolData.kioskBgUrl.trim() !== "")
      ? schoolData.kioskBgUrl
      : DEFAULT_KIOSK_BG_URL;
  });

  const [youtubeUrl, setYoutubeUrl] = useState<string>(() => {
    const savedYt = localStorage.getItem("qr_youtube_video_url");
    const schoolData = db.getSchool();
    return (savedYt !== null && savedYt.trim() !== "")
      ? savedYt
      : (schoolData.youtubeVideoUrl || "");
  });

  const [marqueeText, setMarqueeText] = useState<string>(() => {
    const savedMarquee = localStorage.getItem("qr_marquee_text");
    const schoolData = db.getSchool();
    return (savedMarquee !== null && savedMarquee !== undefined && savedMarquee.trim() !== "")
      ? savedMarquee
      : (schoolData.marqueeText || "");
  });

  const displayMarqueeText = useMemo(() => {
    const trimmed = (marqueeText || "").trim();
    return trimmed.length > 0 ? trimmed : DEFAULT_MARQUEE_TEXT;
  }, [marqueeText]);

  const extractYoutubeId = (url: string) => {
    if (!url) return null;
    const trimmed = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = trimmed.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const youtubeVideoId = extractYoutubeId(youtubeUrl);
  const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ──────────────────────────────────────────────────────────
  // EFFECT: Deteksi ukuran layar (desktop = lg ≥1024px)
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      // Reset scale ke 1 saat beralih ke mobile agar tidak ada overflow
      if (!desktop) setScale(1);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ──────────────────────────────────────────────────────────
  // EFFECT: Jam Real-Time
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ──────────────────────────────────────────────────────────
  // EFFECT: Fullscreen state sync
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // ──────────────────────────────────────────────────────────
  // EFFECT: Kunci overflow body/html (true fullscreen 100vh)
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    const origBodyOverflow = document.body.style.overflow;
    const origHtmlOverflow = document.documentElement.style.overflow;
    if (isDesktop) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = origBodyOverflow;
      document.documentElement.style.overflow = origHtmlOverflow;
    };
  }, [isDesktop]);

  // ──────────────────────────────────────────────────────────
  // EFFECT: Sinkronisasi live data dari localStorage/Firebase
  // ──────────────────────────────────────────────────────────
  const syncFromStorage = useCallback(() => {
    const saved = localStorage.getItem("current_active_qr");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setActiveQrData((prev: any) => {
          if (JSON.stringify(prev) === JSON.stringify(parsed)) return prev;
          return parsed;
        });
      } catch (_) {}
    }

    const savedLogo = localStorage.getItem("qr_embedded_logo_admin");
    if (savedLogo) {
      setLogoUrl((prev) => (prev === savedLogo ? prev : savedLogo));
    }

    const savedBg = localStorage.getItem("qr_kiosk_bg_url");
    const latestSchool = db.getSchool();
    const activeBg = (savedBg && savedBg.trim() !== "")
      ? savedBg
      : (latestSchool.kioskBgUrl && latestSchool.kioskBgUrl.trim() !== "")
      ? latestSchool.kioskBgUrl
      : DEFAULT_KIOSK_BG_URL;
    setKioskBgUrl((prev) => (prev === activeBg ? prev : activeBg));

    const savedYt = localStorage.getItem("qr_youtube_video_url");
    const activeYt = (savedYt !== null && savedYt.trim() !== "")
      ? savedYt
      : (latestSchool.youtubeVideoUrl || "");
    setYoutubeUrl((prev) => (prev === activeYt ? prev : activeYt));

    const savedMarquee = localStorage.getItem("qr_marquee_text");
    const activeMarquee = (savedMarquee !== null && savedMarquee !== undefined && savedMarquee.trim() !== "")
      ? savedMarquee
      : (latestSchool.marqueeText || "");
    setMarqueeText((prev) => (prev === activeMarquee ? prev : activeMarquee));

    const newSchool = db.getSchool();
    setSchool((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(newSchool)) return prev;
      return newSchool;
    });
  }, []);

  useEffect(() => {
    window.addEventListener("storage", syncFromStorage);
    window.addEventListener("firebase_sync_updated", syncFromStorage);
    window.addEventListener("school_updated", syncFromStorage);
    const pollInterval = setInterval(syncFromStorage, 2000);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener("firebase_sync_updated", syncFromStorage);
      window.removeEventListener("school_updated", syncFromStorage);
      clearInterval(pollInterval);
    };
  }, [syncFromStorage]);

  // ──────────────────────────────────────────────────────────
  // EFFECT: Animasi berkedip mata maskot
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      blinkTimeoutRef.current = setTimeout(() => setIsBlinking(false), 220);
    }, 3800);
    return () => {
      clearInterval(blinkInterval);
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
    };
  }, []);

  // ──────────────────────────────────────────────────────────
  // MEMO: speechDialogs
  // ──────────────────────────────────────────────────────────
  const speechDialogs = useMemo(
    () => [
      "Halo Sobat Pintar! 👋 Selamat datang di Live QR Display Presensi Digital!",
      "📱 Buka kamera HP atau Aplikasi Presensi Anda, lalu arahkan ke QR Code di atas!",
      "⚡ QR Code ini dilindungi enkripsi dinamis & diperbarui otomatis setiap pukul 00:00!",
      "📍 Pastikan izin lokasi (GPS) dan kamera Anda aktif saat memindai presensi!",
      "🎉 Sukses selalu! Mari jadikan hari ini penuh kedisiplinan dan semangat berprestasi!",
    ],
    []
  );

  // ──────────────────────────────────────────────────────────
  // EFFECT: Rotasi dialog panduan maskot
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    const speechTimer = setInterval(() => {
      setIsSpeaking(true);
      setSpeechIndex((prev) => (prev + 1) % speechDialogs.length);
    }, 5500);
    return () => clearInterval(speechTimer);
  }, [speechDialogs.length]);

  // ──────────────────────────────────────────────────────────
  // HANDLERS
  // ──────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Zoom hanya untuk desktop (lg+)
  const zoomIn = useCallback(() => {
    if (isDesktop) setScale((prev) => Math.min(prev + 0.1, 1.4));
  }, [isDesktop]);

  const zoomOut = useCallback(() => {
    if (isDesktop) setScale((prev) => Math.max(prev - 0.1, 0.7));
  }, [isDesktop]);

  // ──────────────────────────────────────────────────────────
  // COMPUTED: Nilai QR
  // ──────────────────────────────────────────────────────────
  const cycle = activeQrData.cycle || "daily";
  const cycleStart =
    activeQrData.cycleStart || activeQrData.date || new Date().toISOString().slice(0, 10);
  const cycleEnd =
    activeQrData.cycleEnd || calculateCycleEndDate(cycleStart, cycle);
  const qrValue = `${window.location.origin}/teacher/scan?session=${encodeURIComponent(
    activeQrData.session || "Absensi"
  )}&date=${activeQrData.date}&type=${activeQrData.type || "check_in"}&token=${
    activeQrData.token
  }&timestamp=${activeQrData.timestamp || Date.now()}&cycle=${cycle}&cycleStart=${cycleStart}&cycleEnd=${cycleEnd}&masterToken=${
    activeQrData.token
  }`;

  // ──────────────────────────────────────────────────────────
  // HELPERS: Formatter tanggal & waktu Indonesia WIB
  // ──────────────────────────────────────────────────────────
  const formatIndonesianDate = useCallback((d: Date) => {
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }, []);

  const formatTimeStr = useCallback((d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }, []);

  // ──────────────────────────────────────────────────────────
  // Scale transform: HANYA aktif di desktop (lg ≥1024px)
  // Di mobile selalu scale=1 untuk mencegah overflow
  // ──────────────────────────────────────────────────────────
  const activeScale = isDesktop ? scale : 1;

  // ──────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen lg:h-screen w-full bg-slate-950 text-white relative overflow-y-auto lg:overflow-hidden flex flex-col justify-between font-sans select-none"
      style={{
        transform: `scale(${activeScale})`,
        transformOrigin: "top center",
        transition: "transform 0.3s ease",
        // Kompensasi height agar tetap cover layar saat di-zoom out di desktop
        minHeight: isDesktop && activeScale < 1 ? `${100 / activeScale}vh` : "100vh",
      }}
    >
      {/* ── Dynamic Background ─────────────────────────────── */}
      <div
        className="absolute inset-0 z-0 pointer-events-none transition-all duration-700"
        style={{
          backgroundImage: `url("${kioskBgUrl}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* ── Aurora Glow ────────────────────────────────────── */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none animate-pulse z-0" />
      <div className="absolute top-1/3 -right-32 w-[30rem] h-[30rem] bg-purple-500/20 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none animate-pulse z-0" />

      {/* ── HEADER ─────────────────────────────────────────── */}
      {/*
        Responsif: flex-col di mobile, flex-row di sm+.
        Padding kanan tidak lagi hardcoded (pr-280px) —
        Window Controls di-absolut-kan secara independen.
      */}
      <header className="relative z-20 w-full border-b border-white/15 bg-slate-900/40 shadow-[0_4px_30px_rgba(0,0,0,0.5)] shrink-0">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
          {/* Identitas Instansi */}
          <div className="flex items-center gap-3 sm:gap-4 w-full lg:w-auto">
            <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-xl sm:rounded-2xl bg-white p-1 sm:p-1.5 shadow-md border border-white/20 flex items-center justify-center">
              <img
                src={logoUrl || school.logoUrl || school.kopSurat?.logo_url || "/logo.png"}
                alt="Logo Instansi"
                className="w-full h-full object-contain rounded-lg sm:rounded-xl"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-extrabold tracking-widest uppercase text-indigo-300 drop-shadow-sm leading-tight truncate">
                {school.kopSurat?.nama_dinas || school.nama_dinas || "DINAS PENDIDIKAN DAN KEBUDAYAAN"}
              </p>
              <h1 className="text-sm sm:text-xl lg:text-2xl font-black tracking-tight text-white drop-shadow-md uppercase leading-snug truncate">
                {school.kopSurat?.nama_instansi || school.nama_instansi || school.name || "SMA UNGGULAN NUSANTARA"}
              </h1>
              <p className="text-[10px] text-slate-300/80 font-medium truncate hidden sm:block">
                {school.kopSurat?.alamat || school.alamat || school.address || "Jl. Pendidikan No. 1, Indonesia"}
              </p>
            </div>
          </div>

          {/* Right Section: Real-Time Clock & Window Controls (Terdistribusi rapi, sejajar proporsional, & tidak berdempetan) */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2.5 sm:gap-4 shrink-0 w-full lg:w-auto">
            {/* Real-Time Clock */}
            <div className="flex items-center gap-3 sm:gap-6 bg-slate-900/60 border border-white/20 px-3 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.4)] shrink-0">
              <div className="text-right">
                <div className="flex items-center justify-end gap-1.5 sm:gap-2 text-indigo-300 text-[9px] sm:text-xs font-bold uppercase tracking-wider mb-0.5">
                  <Calendar size={11} className="sm:w-3.5 sm:h-3.5" />
                  <span className="truncate max-w-[140px] sm:max-w-none">
                    {formatIndonesianDate(currentTime)}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1.5 sm:gap-2 font-mono text-lg sm:text-2xl lg:text-3xl font-black tracking-widest text-amber-300 drop-shadow-[0_2px_10px_rgba(252,211,77,0.3)]">
                  <Clock size={15} className="text-amber-400 animate-pulse sm:w-5 sm:h-5" />
                  <span>{formatTimeStr(currentTime)}</span>
                  <span className="text-[9px] sm:text-xs font-sans font-bold bg-amber-400/20 text-amber-300 px-1 sm:px-1.5 py-0.5 rounded ml-1 self-center">
                    WIB
                  </span>
                </div>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-900/90 backdrop-blur-xl border border-white/20 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl shadow-2xl shrink-0">
              {isDesktop && (
                <>
                  <button
                    onClick={zoomOut}
                    className="p-1.5 sm:p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg sm:rounded-xl transition-all"
                    title="Perkecil UI (Zoom Out)"
                  >
                    <ZoomOut size={14} className="sm:w-4 sm:h-4" />
                  </button>
                  <span className="text-[10px] sm:text-xs font-mono font-bold text-indigo-300 px-0.5 sm:px-1">
                    {Math.round(activeScale * 100)}%
                  </span>
                  <button
                    onClick={zoomIn}
                    className="p-1.5 sm:p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg sm:rounded-xl transition-all"
                    title="Perbesar UI (Zoom In)"
                  >
                    <ZoomIn size={14} className="sm:w-4 sm:h-4" />
                  </button>
                  <div className="h-4 sm:h-5 w-px bg-white/15 mx-0.5" />
                </>
              )}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 sm:p-2 text-amber-300 hover:text-white hover:bg-amber-500/20 rounded-lg sm:rounded-xl transition-all"
                title={isFullscreen ? "Keluar Fullscreen" : "Mode Layar Penuh (Fullscreen)"}
              >
                {isFullscreen ? (
                  <Minimize2 size={14} className="sm:w-4 sm:h-4" />
                ) : (
                  <Maximize2 size={14} className="sm:w-4 sm:h-4" />
                )}
              </button>
              <button
                onClick={() => navigate("/admin/generate-qr")}
                className="p-1.5 sm:p-2 text-red-300 hover:text-white hover:bg-red-500/30 rounded-lg sm:rounded-xl transition-all"
                title="Tutup & Kembali"
              >
                <X size={14} className="sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ───────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-center lg:items-stretch justify-center lg:justify-between gap-5 sm:gap-6 md:gap-8 lg:gap-8 xl:gap-12 px-3 sm:px-6 md:px-8 lg:px-12 py-4 sm:py-6 lg:py-3 w-full lg:min-h-0 lg:overflow-hidden">

        {/* LEFT: QR CODE CARD */}
        <div className="w-full lg:w-auto flex flex-col items-center justify-center shrink-0 lg:h-full lg:min-h-0 py-2 sm:py-4 lg:py-0">
          <PremiumQRCard
            value={qrValue}
            sessionName={activeQrData.session || "Absensi Harian Guru & Staf"}
            dateOrCycle={
              activeQrData.date ? `Tanggal: ${activeQrData.date}` : "Sesi Presensi Aktif"
            }
            logoUrl={logoUrl}
            qrType={activeQrData.type}
            // Size responsif: mengecil proporsional di mobile & tablet, 280 presisi di desktop (lg)
            size={typeof window !== "undefined" && window.innerWidth < 480 ? 210 : typeof window !== "undefined" && window.innerWidth < 1024 ? 240 : 280}
            subtitle="Arahkan kamera HP ke Kode QR ini untuk presensi"
            className="w-full max-w-[280px] sm:max-w-[330px] md:max-w-[360px] lg:max-w-[380px] shadow-[0_25px_65px_rgba(0,0,0,0.7)]"
          />
        </div>

        {/* RIGHT: MASCOT, YOUTUBE & INSTRUCTION */}
        <div className="w-full lg:flex-1 flex flex-col justify-evenly items-center lg:items-stretch gap-4 sm:gap-5 md:gap-6 lg:gap-5 min-w-0 max-w-full sm:max-w-xl md:max-w-2xl lg:max-w-2xl lg:h-full py-2 lg:py-1 lg:min-h-0 lg:overflow-hidden">

          {/* 1. YOUTUBE VIDEO (Opsional - Posisi Paling Atas) */}
          {youtubeVideoId && (
            <div className="w-full shrink-0 max-w-full sm:max-w-[95%] lg:max-w-xl ml-auto mr-0 self-end lg:max-h-[42vh] bg-slate-900/65 border border-white/25 backdrop-blur-2xl p-2 sm:p-2.5 rounded-2xl shadow-[0_15px_40px_0_rgba(0,0,0,0.6)] relative overflow-hidden transition-all duration-300 hover:border-white/35 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-1.5 px-1.5 shrink-0 w-full">
                <div className="flex items-center gap-2 text-indigo-300 text-[11px] sm:text-xs font-extrabold uppercase tracking-widest">
                  <Tv size={15} className="text-red-500 animate-pulse shrink-0" />
                  <span>Profil Instansi</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-[9px] sm:text-[10px] font-bold text-red-300 tracking-wider shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                  <span>LIVE STREAM</span>
                </div>
              </div>
              <div className="relative w-full aspect-video lg:max-h-[34vh] lg:max-w-[calc(34vh*16/9)] mx-auto rounded-xl overflow-hidden border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.8)] bg-black flex items-center justify-center">
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=1&loop=1&playlist=${youtubeVideoId}&controls=0&showinfo=0&rel=0&modestbranding=1`}
                  title="YouTube video player"
                  className="absolute inset-0 w-full h-full pointer-events-none scale-[1.03]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* 2. HOLOGRAM UI + MASCOT (Posisi Tengah) */}
          <div className={`flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 lg:gap-5 w-full shrink-0 ${youtubeVideoId ? "my-0 py-1" : "my-auto py-4"}`}>

            {/* MASCOT AVATAR */}
            <div className="flex flex-col items-center shrink-0 justify-center">
              <div
                className={`relative animate-bounce-slow flex items-center justify-center transition-all duration-500
                  ${youtubeVideoId
                    ? "w-14 h-14 sm:w-18 sm:h-18 lg:w-22 lg:h-22"
                    : "w-20 h-20 sm:w-28 sm:h-28 lg:w-36 lg:h-36"
                  }`}
              >
                <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 blur-2xl opacity-40 animate-pulse" />
                <svg viewBox="0 0 200 200" className="w-full h-full relative z-10 drop-shadow-xl">
                  <defs>
                    <linearGradient id="mascotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#818CF8" />
                      <stop offset="100%" stopColor="#4F46E5" />
                    </linearGradient>
                    <linearGradient id="visorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0F172A" />
                      <stop offset="100%" stopColor="#1E1B4B" />
                    </linearGradient>
                  </defs>
                  <circle cx="100" cy="24" r="8" fill="#FBBF24" className="animate-ping" />
                  <circle cx="100" cy="24" r="6" fill="#F59E0B" />
                  <line x1="100" y1="30" x2="100" y2="48" stroke="#818CF8" strokeWidth="4" strokeLinecap="round" />
                  <rect x="42" y="48" width="116" height="90" rx="35" fill="url(#mascotGrad)" stroke="#C7D2FE" strokeWidth="3" />
                  <rect x="30" y="75" width="12" height="34" rx="6" fill="#4338CA" />
                  <rect x="158" y="75" width="12" height="34" rx="6" fill="#4338CA" />
                  <rect x="54" y="62" width="92" height="62" rx="22" fill="url(#visorGrad)" stroke="#6366F1" strokeWidth="2" />
                  {isBlinking ? (
                    <g>
                      <line x1="72" y1="85" x2="86" y2="85" stroke="#38BDF8" strokeWidth="4" strokeLinecap="round" />
                      <line x1="114" y1="85" x2="128" y2="85" stroke="#38BDF8" strokeWidth="4" strokeLinecap="round" />
                    </g>
                  ) : (
                    <g>
                      <circle cx="79" cy="85" r="9" fill="#38BDF8" />
                      <circle cx="76" cy="82" r="3" fill="#FFFFFF" />
                      <circle cx="121" cy="85" r="9" fill="#38BDF8" />
                      <circle cx="118" cy="82" r="3" fill="#FFFFFF" />
                    </g>
                  )}
                  <path
                    d={speechIndex % 2 === 0 ? "M 82 105 Q 100 118 118 105" : "M 85 105 Q 100 112 115 105"}
                    stroke="#34D399"
                    strokeWidth="4"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path d="M 60 148 L 140 148 L 125 175 C 120 185 80 185 75 175 Z" fill="#3730A3" />
                  <circle cx="100" cy="162" r="6" fill="#6EE7B7" className="animate-pulse" />
                </svg>
              </div>
              <div className="w-16 sm:w-24 h-2.5 sm:h-3 bg-black/40 rounded-full blur-md mx-auto -mt-2 animate-pulse" />
            </div>

            {/* HOLOGRAM SPEECH BUBBLE */}
            <div className="relative bg-cyan-950/40 border border-cyan-400/80 backdrop-blur-xl p-2.5 sm:p-3.5 lg:p-4 rounded-2xl shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all duration-300 flex-1 min-w-0 w-full flex flex-col justify-center">
              <div className="absolute top-1/2 -left-[11px] -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-r-[12px] border-r-cyan-400/80 border-b-[8px] border-b-transparent drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] hidden sm:block" />
              <div className="flex items-center gap-1.5 text-cyan-300 text-[10px] sm:text-xs font-extrabold uppercase tracking-widest mb-1 sm:mb-1.5">
                <Sparkles size={12} className="text-cyan-400 animate-spin shrink-0" />
                <span className="drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">ABDI Assistant</span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-cyan-50 leading-relaxed min-h-[2.2rem] sm:min-h-[2.5rem] flex items-center drop-shadow-md">
                {speechDialogs[speechIndex]}
              </p>
              <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-cyan-500/30 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-cyan-200 font-bold tracking-widest opacity-80">
                  <Volume2 size={11} className="text-cyan-400 animate-pulse" />
                  <span>AUDIO SYNC</span>
                </div>
                <div className="flex items-end gap-0.5 h-3 sm:h-3.5">
                  <div className={`w-1 rounded-full bg-cyan-300 ${isSpeaking ? "animate-bounce h-2.5 sm:h-3" : "h-1"}`} />
                  <div className={`w-1 rounded-full bg-blue-400 ${isSpeaking ? "animate-pulse h-3 sm:h-3.5" : "h-1.5"}`} />
                  <div className={`w-1 rounded-full bg-cyan-200 ${isSpeaking ? "animate-bounce h-2 sm:h-2.5" : "h-1"}`} />
                  <div className={`w-1 rounded-full bg-blue-300 ${isSpeaking ? "animate-pulse h-2.5 sm:h-3" : "h-1.5"}`} />
                  <div className={`w-1 rounded-full bg-cyan-400 ${isSpeaking ? "animate-bounce h-2 sm:h-2.5" : "h-1"}`} />
                </div>
              </div>
            </div>
          </div>

          {/* 3. STEPS GUIDE */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 lg:gap-4 w-full text-left shrink-0">
            <div className="bg-slate-900/55 border border-white/20 backdrop-blur-xl p-2.5 sm:p-2.5 rounded-xl flex flex-row items-center gap-2 sm:gap-2 lg:gap-2.5 shadow-[0_6px_25px_rgba(0,0,0,0.5)] transition-all hover:bg-slate-900/70 hover:border-white/30">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 shrink-0">
                <Smartphone size={15} className="sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[11px] sm:text-xs lg:text-sm font-bold text-white leading-tight">1. Siapkan HP</h4>
                <p className="text-[9px] sm:text-[10px] lg:text-xs text-slate-300 leading-snug mt-0.5 block truncate">Buka menu presensi</p>
              </div>
            </div>

            <div className="bg-slate-900/55 border border-white/20 backdrop-blur-xl p-2.5 sm:p-2.5 rounded-xl flex flex-row items-center gap-2 sm:gap-2 lg:gap-2.5 shadow-[0_6px_25px_rgba(0,0,0,0.5)] transition-all hover:bg-slate-900/70 hover:border-white/30">
              <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 shrink-0">
                <Sparkles size={15} className="sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[11px] sm:text-xs lg:text-sm font-bold text-white leading-tight">2. Scan QR</h4>
                <p className="text-[9px] sm:text-[10px] lg:text-xs text-slate-300 leading-snug mt-0.5 block truncate">Arahkan ke tengah QR</p>
              </div>
            </div>

            <div className="bg-slate-900/55 border border-white/20 backdrop-blur-xl p-2.5 sm:p-2.5 rounded-xl flex flex-row items-center gap-2 sm:gap-2 lg:gap-2.5 shadow-[0_6px_25px_rgba(0,0,0,0.5)] transition-all hover:bg-slate-900/70 hover:border-white/30">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0">
                <CheckCircle2 size={15} className="sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[11px] sm:text-xs lg:text-sm font-bold text-white leading-tight">3. Sukses</h4>
                <p className="text-[9px] sm:text-[10px] lg:text-xs text-slate-300 leading-snug mt-0.5 block truncate">Presensi otomatis tercatat</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── FOOTER MARQUEE (MEMOIZED TO PREVENT TIMER RE-RENDER RESET) ── */}
      <FooterMarquee text={displayMarqueeText} />
    </div>
  );
}
