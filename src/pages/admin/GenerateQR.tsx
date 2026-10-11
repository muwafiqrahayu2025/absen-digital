import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import QRCodeStyling from "qr-code-styling";
import { toast } from "react-hot-toast";
import { PremiumQRCard } from "../../components/PremiumQRCard";
import { useAuth } from "../../components/AuthContext";
import {
  QrCode,
  Printer,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Upload,
  Trash2,
  Calendar,
  ShieldCheck,
  Info,
  Tv,
  ExternalLink,
  Image as ImageIcon,
  RefreshCw,
  Megaphone,
} from "lucide-react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { db } from "../../lib/db";
import { DEFAULT_KIOSK_BG_URL, DEFAULT_MARQUEE_TEXT } from "../../types";
import {
  calculateCycleEndDate,
  syncAndAutoRefreshDailyQrToken,
  startQrSecurityCronJob,
  QrCycleType,
  QrPayloadData,
} from "../../lib/qrScheduler";

export function GenerateQR() {
  const navigate = useNavigate();
  const { user } = useAuth() || {};
  const qrStylingInstanceRef = useRef<QRCodeStyling | null>(null);
  const [sessionName, setSessionName] = useState("Absensi Harian");

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const school: any = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    const saved = localStorage.getItem("qr_embedded_logo_admin");
    return saved || school.logoUrl || "/logo.png";
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL("image/jpeg", 0.8);
          setLogoUrl(base64);
          localStorage.setItem("qr_embedded_logo_admin", base64);
          toast.success("Logo kustom berhasil dipasang pada QR Code!");
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const [kioskBgUrl, setKioskBgUrl] = useState<string>(() => {
    const saved = localStorage.getItem("qr_kiosk_bg_url");
    const schoolData: any = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
    return (saved && saved.trim() !== "")
      ? saved
      : (schoolData.kioskBgUrl && schoolData.kioskBgUrl.trim() !== "")
      ? schoolData.kioskBgUrl
      : DEFAULT_KIOSK_BG_URL;
  });

  const [youtubeVideoUrl, setYoutubeVideoUrl] = useState<string>(() => {
    const saved = localStorage.getItem("qr_youtube_video_url");
    const schoolData: any = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
    return (saved !== null && saved.trim() !== "") ? saved : (schoolData.youtubeVideoUrl || "");
  });

  const [marqueeText, setMarqueeText] = useState<string>(() => {
    const saved = localStorage.getItem("qr_marquee_text");
    const schoolData: any = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
    return (saved !== null && saved !== undefined) ? saved : (schoolData.marqueeText || "");
  });

  useEffect(() => {
    const handleStorageSync = () => {
      const saved = localStorage.getItem("qr_kiosk_bg_url");
      const schoolData: any = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
      const latestBg = saved || schoolData.kioskBgUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80";
      setKioskBgUrl(latestBg);

      const savedYt = localStorage.getItem("qr_youtube_video_url");
      const latestYt = (savedYt !== null && savedYt.trim() !== "") ? savedYt : (schoolData.youtubeVideoUrl || "");
      setYoutubeVideoUrl(latestYt);

      const savedMarquee = localStorage.getItem("qr_marquee_text");
      const latestMarquee = (savedMarquee !== null && savedMarquee !== undefined) ? savedMarquee : (schoolData.marqueeText || "");
      setMarqueeText(latestMarquee);
    };
    window.addEventListener("storage", handleStorageSync);
    window.addEventListener("school_updated", handleStorageSync);
    return () => {
      window.removeEventListener("storage", handleStorageSync);
      window.removeEventListener("school_updated", handleStorageSync);
    };
  }, []);

  const handleKioskBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1920;
          const MAX_HEIGHT = 1080;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL("image/jpeg", 0.85);
          setKioskBgUrl(base64);
          localStorage.setItem("qr_kiosk_bg_url", base64);
          const currentSchool = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
          db.updateSchool({ ...currentSchool, kioskBgUrl: base64 });
          window.dispatchEvent(new Event("storage"));
          window.dispatchEvent(new Event("school_updated"));
          toast.success("Background Live TV Kiosk berhasil diperbarui!");
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetKioskBg = () => {
    if (user?.role !== "admin" && user?.role !== "developer") {
      toast.error("Otoritas ditolak: Hanya Admin dan Developer yang memiliki otoritas untuk mereset background Kiosk.");
      return;
    }
    if (!window.confirm("Apakah Anda yakin ingin mereset Latar Belakang (Background) Live TV Kiosk ke desain default premium?")) {
      return;
    }
    setKioskBgUrl(DEFAULT_KIOSK_BG_URL);
    localStorage.removeItem("qr_kiosk_bg_url");
    const currentSchool = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
    db.updateSchool({ ...currentSchool, kioskBgUrl: "" });
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("firebase_sync_updated"));
    window.dispatchEvent(new Event("school_updated"));
    toast.success("Background Live TV Kiosk berhasil dikembalikan ke desain default premium secara real-time!");
  };

  const handleSaveYoutubeUrl = () => {
    const trimmed = youtubeVideoUrl.trim();
    localStorage.setItem("qr_youtube_video_url", trimmed);
    const currentSchool = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
    db.updateSchool({ ...currentSchool, youtubeVideoUrl: trimmed });
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("school_updated"));
    toast.success("URL Video YouTube berhasil disimpan untuk Live TV!");
  };

  const handleSaveMarqueeText = () => {
    if (user?.role !== "admin" && user?.role !== "developer") {
      toast.error("Otoritas ditolak: Hanya Admin dan Developer yang memiliki otoritas untuk menyimpan teks running.");
      return;
    }
    const trimmed = marqueeText.trim();
    localStorage.setItem("qr_marquee_text", trimmed);
    const currentSchool = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
    db.updateSchool({ ...currentSchool, marqueeText: trimmed });
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("firebase_sync_updated"));
    window.dispatchEvent(new Event("school_updated"));
    toast.success("Teks Berjalan (Marquee) berhasil disimpan secara real-time!");
  };

  const handleResetMarqueeText = () => {
    if (user?.role !== "admin" && user?.role !== "developer") {
      toast.error("Otoritas ditolak: Hanya Admin dan Developer yang memiliki otoritas untuk mereset teks running.");
      return;
    }
    if (!window.confirm("Apakah Anda yakin ingin mereset Teks Berjalan (Marquee) Live QR Display ke pengumuman standar default?")) {
      return;
    }
    setMarqueeText("");
    localStorage.removeItem("qr_marquee_text");
    const currentSchool = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
    db.updateSchool({ ...currentSchool, marqueeText: "" });
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("firebase_sync_updated"));
    window.dispatchEvent(new Event("school_updated"));
    toast.success("Teks Berjalan dikembalikan ke pengumuman standar default secara real-time!");
  };

  const [qrType, setQrType] = useState<"check_in" | "check_out">("check_in");
  const [qrCycle, setQrCycle] = useState<QrCycleType>(() => {
    const existing = localStorage.getItem("current_active_qr");
    if (existing) {
      try {
        return JSON.parse(existing).cycle || "daily";
      } catch (e) {}
    }
    return "daily";
  });

  const [token, setToken] = useState(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const existing = localStorage.getItem("current_active_qr");
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (parsed.date === todayStr) {
          return parsed.token;
        }
      } catch (e) {}
    }
    return "TOKEN-" + Math.random().toString(36).substring(2, 10).toUpperCase();
  });

  // Calculate date 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [logStartDate, setLogStartDate] = useState(
    sevenDaysAgo.toISOString().slice(0, 10),
  );
  const [logEndDate, setLogEndDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [logs, setLogs] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [qrTimestamp, setQrTimestamp] = useState<number>(() => {
    const existing = localStorage.getItem("current_active_qr");
    if (existing) {
      try {
        return JSON.parse(existing).timestamp || Date.now();
      } catch (e) {}
    }
    return Date.now();
  });

  const cycleStart = date;
  const cycleEnd = calculateCycleEndDate(date, qrCycle);
  const qrValue = `${window.location.origin}/teacher/scan?session=${encodeURIComponent(sessionName)}&date=${date}&type=${qrType}&token=${token}&timestamp=${qrTimestamp}&cycle=${qrCycle}&cycleStart=${cycleStart}&cycleEnd=${cycleEnd}&masterToken=${token}`;

  // Keep localStorage in sync so ScanQR can validate successfully
  useEffect(() => {
    const newTimestamp = Date.now();
    setQrTimestamp(newTimestamp);
    const payload: QrPayloadData = {
      session: sessionName,
      date: date,
      type: qrType,
      token: token,
      timestamp: newTimestamp,
      cycle: qrCycle,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      masterToken: token,
    };
    localStorage.setItem("current_active_qr", JSON.stringify(payload));
  }, [sessionName, date, qrType, token, qrCycle, cycleStart, cycleEnd]);

  // Auto-refresh token at midnight or daily turnover via cron job
  useEffect(() => {
    const stopCron = startQrSecurityCronJob((newQr, msg) => {
      if (newQr.date && newQr.date !== "universal") setDate(newQr.date);
      if (newQr.token) setToken(newQr.token);
      toast.success(msg || "Token QR otomatis diperbarui.");
    });
    return () => stopCron();
  }, []);

  // Sinkronisasi reaktif dari localStorage & Firebase untuk Kiosk BG dan Marquee
  useEffect(() => {
    const syncSettings = () => {
      const savedBg = localStorage.getItem("qr_kiosk_bg_url");
      const latestSchool = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
      const activeBg = (savedBg && savedBg.trim() !== "")
        ? savedBg
        : (latestSchool.kioskBgUrl && latestSchool.kioskBgUrl.trim() !== "")
        ? latestSchool.kioskBgUrl
        : DEFAULT_KIOSK_BG_URL;
      setKioskBgUrl((prev) => (prev === activeBg ? prev : activeBg));

      const savedMarquee = localStorage.getItem("qr_marquee_text");
      const activeMarquee = (savedMarquee !== null && savedMarquee !== undefined && savedMarquee.trim() !== "")
        ? savedMarquee
        : (latestSchool.marqueeText || "");
      setMarqueeText((prev) => (prev === activeMarquee ? prev : activeMarquee));
    };

    window.addEventListener("storage", syncSettings);
    window.addEventListener("firebase_sync_updated", syncSettings);
    window.addEventListener("school_updated", syncSettings);
    return () => {
      window.removeEventListener("storage", syncSettings);
      window.removeEventListener("firebase_sync_updated", syncSettings);
      window.removeEventListener("school_updated", syncSettings);
    };
  }, []);

  const handleRegenerateToken = () => {
    const newToken = "TOKEN-" + Math.random().toString(36).substring(2, 10).toUpperCase();
    setToken(newToken);
    toast.success("Token keamanan dan hash QR berhasil diregenerasi!");
  };

  const handleDownloadCanvasPng = () => {
    if (!qrStylingInstanceRef.current) {
      toast.error("QR Code belum siap untuk diunduh.");
      return;
    }
    qrStylingInstanceRef.current.download({
      name: `QR_Presensi_${sessionName.replace(/\s+/g, "_")}_${date}_${qrCycle.toUpperCase()}`,
      extension: "png",
    });
    toast.success("QR Code (PNG) premium berhasil diunduh!");
  };

  const handlePrint = () => {
    window.print();
  };


  const handleExportCSV = () => {
    if (logs.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    const headers = ["No", "Tanggal", "Nama Pegawai", "Waktu Scan", "Status"];
    const csvRows = [headers.join(",")];

    logs.forEach((log, index) => {
      csvRows.push(
        `${index + 1},"${log.date}","${log.name}","${log.time}","${log.status}"`,
      );
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const fileNameDate =
      logStartDate === logEndDate
        ? logStartDate
        : `${logStartDate}_to_${logEndDate}`;
    link.setAttribute("download", `Log_Scan_${fileNameDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const fetchLogs = () => {
      const allAttendance = db.getAttendance();
      const users = db.getUsers();

      const sessionRecords = allAttendance.filter(
        (a) => a.date >= logStartDate && a.date <= logEndDate,
      );

      const structuredLogs = sessionRecords
        .map((record) => {
          const user = users.find((u) => u.id === record.userId);
          return {
            id: record.id,
            date: record.date,
            name: user?.name || "Unknown",
            time: record.checkInTime || "",
            status: record.status,
          };
        })
        .filter((log) => log.time !== "")
        .sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return b.time.localeCompare(a.time);
        });

      setLogs(structuredLogs);

      // Calculate chart data
      const totalTeachers = users.length;
      const newTrendData = [];
      const start = new Date(logStartDate);
      const end = new Date(logEndDate);

      let current = new Date(start);
      let daysCount = 0;
      while (current <= end && daysCount < 60) {
        const dateStr = current.toISOString().slice(0, 10);
        const scansOnDate = structuredLogs.filter(
          (log) => log.date === dateStr,
        ).length;
        // Also format dates nicely if desired
        newTrendData.push({
          date: new Date(dateStr).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
          }),
          pemindaian: scansOnDate,
          totalPegawai: totalTeachers,
        });
        current.setDate(current.getDate() + 1);
        daysCount++;
      }
      setTrendData(newTrendData);
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000); // Poll for new scans
    return () => clearInterval(interval);
  }, [logStartDate, logEndDate]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 tracking-tight pb-4 border-b border-slate-200 print:hidden">
        Buat Kode QR Presensi
      </h2>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col lg:flex-row gap-8 items-start print:hidden">
        <div className="w-full lg:w-1/2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nama Sesi / Kelas
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-250 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium font-sans"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tanggal Mulai / Hari Ini
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-250 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium font-sans"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Masa Berlaku Siklus QR Code
            </label>
            <select
              value={qrCycle}
              onChange={(e) => setQrCycle(e.target.value as QrCycleType)}
              className="w-full px-4 py-2.5 border border-slate-250 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-semibold text-slate-800 bg-white"
            >
              <option value="daily">⭐ Harian (1 Hari) - Regenerasi Setiap Hari</option>
              <option value="weekly">📅 Mingguan (7 Hari) - Cetak Sekali untuk Seminggu</option>
              <option value="monthly">🗓️ Bulanan (30 Hari) - Cetak Sekali untuk Sebulan</option>
            </select>
            <div className="mt-1.5 flex items-start gap-1.5 px-3 py-2 bg-indigo-50/70 border border-indigo-150 rounded-xl text-xs text-indigo-900 font-medium leading-relaxed">
              <ShieldCheck size={16} className="text-indigo-600 shrink-0 mt-0.5" />
              <span>
                <b>Siklus {qrCycle === "daily" ? "Harian" : qrCycle === "weekly" ? "Mingguan" : "Bulanan"} Aktif</b> ({cycleStart} s.d. {cycleEnd}). Sistem cron otomatis merombak hash keamanan harian tepat pukul 00:00 malam agar QR anti-duplikasi, namun kode QR fisik Anda tetap berlaku sesuai siklus pilihan.
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tipe Presensi
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setQrType("check_in")}
                className={`flex items-center justify-center gap-2 py-2.5 px-6 font-bold text-white text-xs rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200 ${
                  qrType === "check_in" ? "opacity-100 scale-105" : "opacity-50 hover:opacity-75"
                }`}
              >
                📥 Presensi Masuk
              </button>
              <button
                type="button"
                onClick={() => setQrType("check_out")}
                className={`flex items-center justify-center gap-2 py-2.5 px-6 font-bold text-white text-xs rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200 ${
                  qrType === "check_out" ? "opacity-100 scale-105" : "opacity-50 hover:opacity-75"
                }`}
              >
                📤 Presensi Pulang
              </button>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm font-medium text-slate-700">
                Token Keamanan (Master Hash)
              </span>
              <button
                type="button"
                onClick={handleRegenerateToken}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                title="Ganti token baru secara instan"
              >
                🔄 Refresh Token
              </button>
            </div>
            <div className="px-3 py-2 bg-slate-50 text-slate-600 rounded-xl border border-slate-150 text-xs font-mono font-bold select-all tracking-wider text-center">
              {token}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Logo Tengah QR Code (Opsional)
            </label>
            <input
              type="file"
              id="qr-logo-upload"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => document.getElementById('qr-logo-upload')?.click()}
                className="flex items-center justify-center gap-2 w-full sm:w-auto py-2 px-4 font-bold text-white text-xs rounded-xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
              >
                <Upload size={14} /> Pilih File Logo
              </button>
              <span className="text-xs text-slate-400">
                {logoUrl && logoUrl !== (school.logoUrl || "/logo.png") ? "Logo kustom aktif" : "Tidak ada file yang dipilih"}
              </span>
              {logoUrl && logoUrl !== (school.logoUrl || "/logo.png") && (
                <button
                  type="button"
                  onClick={() => {
                    const defaultLogo = school.logoUrl || "/logo.png";
                    setLogoUrl(defaultLogo);
                    localStorage.removeItem("qr_embedded_logo_admin");
                    toast.success("Logo dikembalikan ke default sekolah.");
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-4 font-bold text-white text-xs rounded-xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3)] hover:from-[#c24bff] hover:to-[#8630db] active:translate-y-0.5 transition-all duration-200"
                >
                  <Trash2 size={14} /> Hapus Logo Kustom
                </button>
              )}
            </div>
          </div>

          {/* Background Live TV Kiosk Display & Preview Admin Option (RBAC Protected) */}
          {(user?.role === "admin" || user?.role === "developer") && (
            <div className="pt-3 border-t border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center justify-between">
                <span>Background Live TV Kiosk & Preview Admin</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">RBAC Protected</span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wider">Live Realtime</span>
                </div>
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Unggah foto latar belakang custom untuk tampilan layar Live TV / Kiosk Proyektor dan area preview admin ini.
              </p>
              <input
                type="file"
                id="qr-kiosk-bg-upload"
                accept="image/*"
                onChange={handleKioskBgUpload}
                className="hidden"
              />
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => document.getElementById('qr-kiosk-bg-upload')?.click()}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2 px-4 font-bold text-white text-xs rounded-xl bg-gradient-to-b from-[#1d74f2] to-[#1156c2] border border-[#60a5fa] shadow-[inset_0_2px_1px_rgba(255,255,255,0.4),_0_4px_12px_rgba(29,116,242,0.35)] hover:from-[#3b86ff] hover:to-[#1664db] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-200"
                >
                  <ImageIcon size={14} /> Upload Background Kiosk
                </button>
                <span className="text-xs text-slate-500 font-medium truncate max-w-[160px]">
                  {kioskBgUrl && kioskBgUrl !== DEFAULT_KIOSK_BG_URL ? "✓ Background custom aktif" : "Background default 4K"}
                </span>
                {kioskBgUrl && kioskBgUrl !== DEFAULT_KIOSK_BG_URL && (
                  <button
                    type="button"
                    id="reset-kiosk-bg-btn"
                    onClick={handleResetKioskBg}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 font-bold text-slate-700 hover:text-rose-700 text-xs rounded-xl bg-slate-100 hover:bg-rose-50 border border-slate-300 hover:border-rose-300 shadow-xs transition-all duration-200"
                    title="Kembalikan ke latar belakang default premium"
                  >
                    <RefreshCw size={13} className="text-rose-600 shrink-0" /> Reset Default
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="pt-3 border-t border-slate-200">
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center justify-between">
              <span>Video Profil YouTube (Opsional)</span>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wider">Live Realtime</span>
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Masukkan URL atau ID Video YouTube untuk diputar secara otomatis (tanpa suara) di layar Live TV / Kiosk Proyektor.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Contoh: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                value={youtubeVideoUrl}
                onChange={(e) => setYoutubeVideoUrl(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleSaveYoutubeUrl}
                className="flex items-center justify-center gap-2 py-2 px-4 font-bold text-white text-xs rounded-xl bg-gradient-to-b from-[#ff0000] to-[#cc0000] border border-[#ff4d4d] shadow-[inset_0_2px_1px_rgba(255,255,255,0.4),_0_4px_12px_rgba(255,0,0,0.35)] hover:from-[#ff3333] hover:to-[#e60000] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-200"
              >
                <Tv size={14} /> Simpan Video
              </button>
            </div>
          </div>

          {(user?.role === "admin" || user?.role === "developer") && (
            <div className="pt-3 border-t border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Megaphone size={16} className="text-amber-500" /> Teks Berjalan (Marquee) Live QR Display
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">RBAC Protected</span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wider">Live Realtime</span>
                </div>
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Sesuaikan teks pengumuman yang berjalan di bagian bawah layar Live TV / Kiosk secara real-time. Kosongkan untuk menggunakan pengumuman default.
              </p>
              <textarea
                rows={3}
                placeholder="📢 SELAMAT DATANG DI ABDI... (Ketik teks pengumuman khusus di sini)"
                value={marqueeText}
                onChange={(e) => setMarqueeText(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-y shadow-inner bg-slate-50/60"
              />
              <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                <div className="text-[11px] text-slate-500">
                  Status: <span className="font-semibold text-slate-700">{marqueeText.trim() ? "Teks custom aktif" : "Menggunakan fallback default"}</span>
                </div>
                <div className="flex items-center gap-2">
                  {marqueeText && (
                    <button
                      type="button"
                      id="reset-marquee-btn"
                      onClick={handleResetMarqueeText}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 font-bold text-slate-700 hover:text-rose-700 text-xs rounded-xl bg-slate-100 hover:bg-rose-50 border border-slate-300 hover:border-rose-300 shadow-xs transition-all duration-200"
                      title="Kembalikan ke pengumuman standar default"
                    >
                      <RefreshCw size={13} className="text-rose-600 shrink-0" /> Reset Default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveMarqueeText}
                    className="flex items-center justify-center gap-2 py-2 px-4 font-bold text-white text-xs rounded-xl bg-gradient-to-b from-[#f59e0b] to-[#d97706] border border-[#fbbf24] shadow-[inset_0_2px_1px_rgba(255,255,255,0.4),_0_4px_12px_rgba(245,158,11,0.35)] hover:from-[#fbbf24] hover:to-[#b45309] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-200"
                  >
                    <Megaphone size={14} /> Simpan & Tayangkan Live
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Pane: Live TV Kiosk Background & Realtime Admin Preview Container */}
        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center rounded-2xl p-6 sm:p-8 relative min-h-[460px] overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.35)] border border-slate-800 bg-slate-950">
          {/* Dynamic Aesthetic Live TV Kiosk Background Image */}
          <div
            className="absolute inset-0 z-0 pointer-events-none transition-all duration-700"
            style={{
              backgroundImage: `url("${kioskBgUrl}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />

          {/* Background Aurora Glow & Dark Glass Overlay (Parity with Live TV Kiosk) */}
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[3px] pointer-events-none z-0" />
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-500/25 rounded-full blur-3xl pointer-events-none animate-pulse z-0" />
          <div className="absolute top-1/3 -right-32 w-80 h-80 bg-purple-500/25 rounded-full blur-3xl pointer-events-none z-0" />
          <div className="absolute -bottom-32 left-1/3 w-80 h-80 bg-indigo-500/25 rounded-full blur-3xl pointer-events-none animate-pulse z-0" />

          {/* Badge Live TV Preview Indicator */}
          <div className="absolute top-3.5 left-4 z-20 flex items-center gap-2 bg-slate-900/80 border border-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-white shadow-md print:hidden">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Preview Live TV Kiosk Admin</span>
          </div>

          {/* Wrapper Tombol Aksi - Satu Baris Horizontal Sejajar di Atas QR Card */}
          <div className="w-full max-w-[380px] flex flex-row justify-between items-center gap-2 sm:gap-3 mb-4 z-20 print:hidden mt-6 sm:mt-4">
            <button
              onClick={() => {
                const sessionId = sessionName ? sessionName.toLowerCase().replace(/\s+/g, '-') : 'harian';
                window.open(`/live-qr/${sessionId}`, '_blank', 'noopener,noreferrer');
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 font-bold text-white text-[10px] sm:text-[11px] whitespace-nowrap rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:-translate-y-[2px] active:translate-y-[1px] transition-all duration-200"
              title="Buka tampilan Live TV / Proyektor di tab baru"
            >
              <Tv size={14} className="text-white shrink-0" />
              <span>Live TV</span>
            </button>
            <button
              onClick={handleDownloadCanvasPng}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 font-bold text-white text-[10px] sm:text-[11px] whitespace-nowrap rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:-translate-y-[2px] active:translate-y-[1px] transition-all duration-200"
              title="Unduh QR Code (PNG)"
            >
              <Download size={14} className="text-white shrink-0" />
              <span>Simpan</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 font-bold text-white text-[10px] sm:text-[11px] whitespace-nowrap rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:-translate-y-[2px] active:translate-y-[1px] transition-all duration-200"
              title="Cetak QR Code"
            >
              <Printer size={14} className="text-white shrink-0" />
              <span>Print</span>
            </button>
          </div>

          {/* QR Code Card Display */}
          <div className="z-20 w-full max-w-[380px] flex justify-center">
            <PremiumQRCard
              value={qrValue}
              sessionName={sessionName}
              dateOrCycle={`Berlaku: ${cycleStart} s.d. ${cycleEnd} • ${qrCycle === "daily" ? "HARIAN" : qrCycle === "weekly" ? "MINGGUAN" : "BULANAN"}`}
              logoUrl={logoUrl}
              qrType={qrType}
              size={280}
              subtitle="Arahkan kamera ke Kode QR presensi"
              onInstanceReady={(inst) => {
                qrStylingInstanceRef.current = inst;
              }}
              className="w-full"
            />
          </div>

          {/* Preview Marquee Footer in Admin Panel */}
          <div className="w-full mt-6 z-20 print:hidden overflow-hidden bg-slate-950/80 backdrop-blur-md border border-white/15 rounded-xl py-1.5 px-3 flex items-center shadow-lg">
            <span className="text-[10px] font-extrabold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded mr-2 shrink-0 whitespace-nowrap">
              MARQUEE PREVIEW
            </span>
            <div className="flex-1 overflow-hidden relative border-l border-white/15 pl-3">
              <div className="flex flex-row items-center whitespace-nowrap animate-marquee ease-linear text-[11px] font-medium text-slate-200 select-none">
                <span className="pr-10 shrink-0">
                  {marqueeText.trim()
                    ? marqueeText.trim()
                    : "📢 SELAMAT DATANG DI ABDI (ABSEN DIGITAL) - SISTEM PRESENSI CERDAS TERINTEGRASI • Solusi modern untuk pencatatan kehadiran yang akurat, aman, dan real-time • Fitur unggulan meliputi: QR Code Dinamis Anti-Kecurangan, Validasi Lokasi (GPS) Presisi, Verifikasi Wajah (Selfie), Rekapitulasi Data Otomatis, serta Dasbor Pemantauan Interaktif untuk Pengguna, Staf, dan Pimpinan Instansi • Mari wujudkan budaya disiplin yang transparan dan efisien • Terima kasih atas kedisiplinan Anda! • 🚀 Powered by Alpha Project. •"}
                </span>
                <span className="pr-10 shrink-0">
                  {marqueeText.trim()
                    ? marqueeText.trim()
                    : "📢 SELAMAT DATANG DI ABDI (ABSEN DIGITAL) - SISTEM PRESENSI CERDAS TERINTEGRASI • Solusi modern untuk pencatatan kehadiran yang akurat, aman, dan real-time • Fitur unggulan meliputi: QR Code Dinamis Anti-Kecurangan, Validasi Lokasi (GPS) Presisi, Verifikasi Wajah (Selfie), Rekapitulasi Data Otomatis, serta Dasbor Pemantauan Interaktif untuk Pengguna, Staf, dan Pimpinan Instansi • Mari wujudkan budaya disiplin yang transparan dan efisien • Terima kasih atas kedisiplinan Anda! • 🚀 Powered by Alpha Project. •"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:hidden mb-6">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Tren Partisipasi Presensi</h3>
        </div>
        <div style={{ width: '100%', minHeight: '300px' }} className="p-4">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={trendData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "#64748b" }}
                tickMargin={10}
                axisLine={{ stroke: "#cbd5e1" }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "#64748b" }}
                tickMargin={10}
                axisLine={{ stroke: "#cbd5e1" }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "0.5rem",
                  border: "none",
                  boxShadow:
                    "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
              <Line
                type="monotone"
                dataKey="pemindaian"
                name="Kehadiran Guru/Staf"
                stroke="#1d74f2"
                strokeWidth={3}
                activeDot={{ r: 8 }}
              />
              <Line
                type="monotone"
                dataKey="totalPegawai"
                name="Total Guru/Staf"
                stroke="#94a3b8"
                strokeDasharray="5 5"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4">
          <h3 className="font-bold text-slate-800">
            Riwayat Pemindaian ({logs.length})
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={logStartDate}
                onChange={(e) => setLogStartDate(e.target.value)}
                className="text-xs px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
              />
              <span className="text-slate-500 text-xs">s/d</span>
              <input
                type="date"
                value={logEndDate}
                onChange={(e) => setLogEndDate(e.target.value)}
                className="text-xs px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>

            {logStartDate === new Date().toISOString().slice(0, 10) &&
              logEndDate === new Date().toISOString().slice(0, 10) && (
                <span className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Real-time
                </span>
              )}
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
              title="Ekspor Log ke CSV"
            >
              <Download size={14} className="text-emerald-600" /> Ekspor CSV
            </button>
          </div>
        </div>
        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 py-12">
              <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>Belum ada yang melakukan pemindaian hari ini.</p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-slate-800">{log.name}</p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Clock size={12} /> {log.date} {log.time}
                  </p>
                </div>
                <div>
                  {log.status === "Hadir" && (
                    <span className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      <CheckCircle size={14} /> Hadir
                    </span>
                  )}
                  {log.status === "Terlambat" && (
                    <span className="flex items-center gap-1 text-sm text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                      <Clock size={14} /> Terlambat
                    </span>
                  )}
                  {(log.status === "Sakit" || log.status === "Izin") && (
                    <span className="flex items-center gap-1 text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                      <CheckCircle size={14} /> {log.status}
                    </span>
                  )}
                  {log.status === "Alpha" && (
                    <span className="flex items-center gap-1 text-sm text-red-600 bg-red-50 px-2 py-1 rounded-full">
                      <XCircle size={14} /> Alpha
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* DEDICATED PRINT TEMPLATE (ONLY VISIBLE WHEN PRINTING) */}
      <div className="hidden print:flex flex-col items-center justify-center min-h-screen py-6 px-8 w-full text-slate-900 bg-white box-border print-color-adjust-exact">
        
        {/* Main Poster Container */}
        <div className="w-full max-w-2xl h-full mx-auto flex flex-col border-2 border-slate-300 rounded-[2.5rem] shadow-sm overflow-hidden bg-white">
          
          {/* Header Area (Kop Surat) */}
          <div className="flex items-center justify-between px-8 py-6 bg-slate-50 border-b-2 border-slate-200 shrink-0">
            <div className="w-24 shrink-0 flex items-center justify-center">
              <img src={logoUrl} alt="Logo" className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-sm" />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <h1 className="text-2xl sm:text-3xl font-black uppercase text-center tracking-tight text-slate-800 leading-tight">
                {school.name}
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1 text-center">
                {school.address || "Sistem Presensi Digital Terpadu"}
              </p>
            </div>
            <div className="w-24 shrink-0 flex items-center justify-center">
                <div className="w-16 h-16 opacity-10">
                   <QrCode className="w-full h-full text-slate-800" />
                </div>
            </div>
          </div>

          {/* Body Area */}
          <div className="flex-1 flex flex-col items-center justify-center px-10 py-6 relative">
            
            {/* Status Badge */}
            <div className={`px-10 py-2 rounded-full border-2 text-lg font-black uppercase tracking-widest mb-6 ${
                qrType === "check_in" 
                  ? "bg-emerald-50 border-emerald-500 text-emerald-700" 
                  : "bg-amber-50 border-amber-500 text-amber-700"
              }`}>
              {qrType === "check_in" ? "📥 PRESENSI MASUK" : "📤 PRESENSI PULANG"}
            </div>

            <div className="mb-4 text-center">
               <h2 className="text-3xl font-extrabold uppercase tracking-widest text-slate-900">
                 {sessionName}
               </h2>
               <p className="text-lg font-bold text-slate-400 tracking-wider mt-1">{date}</p>
            </div>

            {/* QR Code Frame with Corner Accents */}
            {/* Premium QR Card in Dedicated Print Template */}
            <div className="my-6">
              <PremiumQRCard
                value={qrValue}
                sessionName={sessionName}
                dateOrCycle={`Berlaku: ${cycleStart} s.d. ${cycleEnd} • ${qrCycle.toUpperCase()}`}
                logoUrl={logoUrl}
                qrType={qrType}
                size={300}
                subtitle="Arahkan kamera ke Kode QR presensi"
                className="scale-95 sm:scale-100 shadow-none border-2 border-slate-300"
              />
            </div>

            <div className="mt-6 font-bold text-slate-700 text-lg uppercase tracking-widest bg-slate-100 px-6 py-2 rounded-full border border-slate-200">
              Arahkan Kamera ke Kode QR
            </div>
            
          </div>

          {/* Footer Area */}
          <div className="bg-slate-800 text-white py-5 px-10 text-center shrink-0">
             <p className="font-semibold text-xs tracking-wide opacity-90">
               TATA CARA: 1. Buka Aplikasi &nbsp;&bull;&nbsp; 2. Pilih Menu "Scan QR" &nbsp;&bull;&nbsp; 3. Pindai Secara Jelas
             </p>
          </div>

        </div>
      </div>
    </div>
  );
}
