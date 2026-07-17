import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../components/AuthContext";
import { db } from "../lib/db";
import { NotificationService } from "../lib/notifications";
import { EditableText } from "../components/EditableText";
import { ModernQRScanner } from "../components/ModernQRScanner";
import { BiometricSelfie } from "../components/BiometricSelfie";
import { analyzeLocationTelemetry } from "../lib/securityGuard";
import {
  format,
  subDays,
  startOfMonth,
  subMonths,
  isWithinInterval,
  parseISO,
  endOfMonth,
} from "date-fns";
import { id } from "date-fns/locale";
import { Users, FileText, CheckCircle, Clock, Download, Building, Layers, Briefcase, AlertTriangle, MapPin, Smartphone, Calendar, FileSpreadsheet, Send, HelpCircle, Award, ChevronRight, Menu, Bell, Search, BookOpen, Filter, CheckCircle2, XCircle, Moon, Sun, UserCheck, LayoutDashboard, Save, X, Plus, QrCode, UserCircle, BarChart2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import toast from "react-hot-toast";
import { getDashboardTemplate, getSavedDashboardTemplateId } from "../lib/dashboardTemplates";
import { DashboardTemplatePicker } from "../components/DashboardTemplatePicker";
import { WindowControls } from "../components/WindowControls";
import { ProfileTabContent } from "../components/ProfileTabContent";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useFirebaseSync } from "../hooks/useFirebaseSync";

export function Dashboard() {
  useFirebaseSync();
  useDocumentTitle("Dasbor Eksekutif");
  const { user } = useAuth();
  const [school, setSchool] = useState(() => db.getSchool());
  const [users, setUsers] = useState(() => db.getUsers());
  const [attendance, setAttendance] = useState(() => db.getAttendance());
  const [opds, setOpds] = useState(() => db.getOPDs());
  const [satuanKerjas, setSatuanKerjas] = useState(() => db.getSatuanKerjas());
  const [jabatans, setJabatans] = useState(() => db.getJabatans());
  const [cutiRequests, setCutiRequests] = useState(() => db.getCutiRequests());
  const [kinerjas, setKinerjas] = useState(() => db.getKinerjas());

  // Dashboard Template State
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [dashboardTemplate, setDashboardTemplate] = useState(() => getDashboardTemplate(getSavedDashboardTemplateId()));

  // Broadcast Message State
  const [broadcastMessage, setBroadcastMessage] = useState("");

  // Leaderboard Calculation (Gamification)
  const leaderboard = useMemo(() => {
    const currentMonth = format(new Date(), "yyyy-MM");
    const monthAttendance = attendance.filter(a => a.date && a.date.startsWith(currentMonth));
    
    const scores = users.filter(u => u.role !== 'admin').map(u => {
      const userAtt = monthAttendance.filter(a => a.userId === u.id);
      let score = 0;
      userAtt.forEach(a => {
        if (a.status === 'Hadir') score += 10;
        if (a.status === 'Terlambat') score += 5;
        if (a.status === 'Sakit' || a.status === 'Izin' || a.status === 'Cuti Tahunan') score += 2;
        if (a.status === 'Alpha') score -= 5;
      });
      return { user: u, score, attendanceCount: userAtt.length };
    });

    return scores.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [attendance, users]);

  const [broadcastSending, setBroadcastSending] = useState(false);

  const handleBroadcast = () => {
    if (!broadcastMessage.trim()) {
      toast.error("Pesan pengumuman tidak boleh kosong!");
      return;
    }

    // ── Cek konfigurasi API notifikasi sebelum broadcast ─────────────────
    const currentSchool = db.getSchool();
    const hasNotifApi = !!(currentSchool.gasWebAppUrl || currentSchool.whatsappApiKey);
    if (!hasNotifApi) {
      toast(
        "⚠️ API Notifikasi Belum Dikonfigurasi\n\nPesan broadcast tidak dapat dikirim via WhatsApp/Email. Silakan konfigurasikan Google Apps Script URL atau API WhatsApp terlebih dahulu di menu Profil & Kop Surat → Notifikasi API.",
        { icon: "🔧", duration: 7000 }
      );
      // Tetap lanjutkan broadcast in-app (toast lokal) meski API belum terkonfigurasi
    }

    // UX-03 FIX: disable button while sending to avoid double-clicks
    setBroadcastSending(true);
    const teachers = users.filter(u => u.role !== 'admin');
    teachers.forEach(t => {
      NotificationService.send(t, 'BROADCAST_MESSAGE', { extraInfo: broadcastMessage });
    });

    if (hasNotifApi) {
      toast.success(`Pengumuman berhasil disiarkan ke ${teachers.length} Guru/Staf!`);
    } else {
      toast.success(`Broadcast in-app terkirim ke ${teachers.length} pengguna (tanpa notifikasi eksternal).`);
    }
    setBroadcastMessage("");
    setTimeout(() => setBroadcastSending(false), 3000);
  };

  // Simulate Automated Attendance Reminder
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (user && user.role !== 'admin') {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const hasCheckedIn = db.getAttendance().some(a => a.date === todayStr && a.userId === user.id);
      const reminderKey = `reminder_sent_${todayStr}_${user.id}`;
      
      if (!hasCheckedIn && !sessionStorage.getItem(reminderKey)) {
        // Give it a small delay so it doesn't pop up exactly when dashboard mounts
        timeoutId = setTimeout(() => {
          NotificationService.send(user, 'ATTENDANCE_REMINDER');
        }, 3000);
        sessionStorage.setItem(reminderKey, "true");
      }
    }
    // Cleanup: cancel pending timeout if user navigates away before it fires
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [user]);

  useEffect(() => {
    const handleTemplateChange = () => {
      setDashboardTemplate(getDashboardTemplate(getSavedDashboardTemplateId()));
    };
    window.addEventListener('dashboard_template_changed', handleTemplateChange);
    return () => window.removeEventListener('dashboard_template_changed', handleTemplateChange);
  }, []);

  // Mobile UI States
  const [mobileTab, setMobileTab] = useState<
    "home" | "scan" | "cuti" | "kinerja" | "riwayat" | "bantuan" | "profil"
  >("home");
  const [activeQrMode, setActiveQrMode] = useState<"check_in" | "check_out" | null>(null);
  const [activeBiometricMode, setActiveBiometricMode] = useState<"check_in" | "check_out" | null>(null);
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    if (tab === "cuti" || tab === "kinerja" || tab === "scan" || tab === "riwayat") {
      setMobileTab(tab as any);
    }
  }, [location.search]);
  const [filterYear, setFilterYear] = useState(format(new Date(), "yyyy"));
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "MM"));
  const [isDarkMode, setIsDarkMode] = useState(false);
  // GPS real-time dari browser (bukan hardcoded)
  const [currentGps, setCurrentGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Upload Kinerja form state
  const [kinerjaDate, setKinerjaDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [kinerjaTupoksi, setKinerjaTupoksi] = useState(
    "Kepala Bidang Mutasi dan Promosi",
  );
  const [kinerjaUraian, setKinerjaUraian] = useState("");
  const [kinerjaSatuan, setKinerjaSatuan] = useState("Laporan");
  const [kinerjaJumlah, setKinerjaJumlah] = useState(1);

  // Cuti / Izin form state
  const [cutiJenis, setCutiJenis] = useState<
    "Cuti Tahunan" | "Izin" | "Sakit" | "Dinas/Lainnya"
  >("Izin");
  const [cutiMulai, setCutiMulai] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cutiSelesai, setCutiSelesai] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [cutiAlasan, setCutiAlasan] = useState("");
  const [cutiFile, setCutiFile] = useState("");

  // Admin simulation modals or inline addition states
  const [showAddOPD, setShowAddOPD] = useState(false);
  const [newOPDSingkatan, setNewOPDSingkatan] = useState("");
  const [newOPDNama, setNewOPDNama] = useState("");

  const [showAddSatker, setShowAddSatker] = useState(false);
  const [newSatkerSingkatan, setNewSatkerSingkatan] = useState("");
  const [newSatkerNama, setNewSatkerNama] = useState("");
  const [newSatkerOpd, setNewSatkerOpd] = useState("1");

  useEffect(() => {
    const handleFirebaseSync = () => {
      const updatedSchool = db.getSchool();
      setSchool(updatedSchool);
      setUsers(db.getUsers());
      setAttendance(db.getAttendance());
      setOpds(db.getOPDs());
      setSatuanKerjas(db.getSatuanKerjas());
      setJabatans(db.getJabatans());
      setCutiRequests(db.getCutiRequests());
      setKinerjas(db.getKinerjas());
    };
    window.addEventListener("firebase_sync_updated", handleFirebaseSync);
    return () => {
      window.removeEventListener("firebase_sync_updated", handleFirebaseSync);
    };
  }, []);

  useEffect(() => {
    const handleSync = () => {
      const updatedSchool = db.getSchool();
      setSchool(updatedSchool);
      setAttendance(db.getAttendance());
      setCutiRequests(db.getCutiRequests());
      setKinerjas(db.getKinerjas());
    };
    const handleUsersSync = () => {
      setUsers(db.getUsers());
    };
    window.addEventListener("attendance_synchronized", handleSync);
    window.addEventListener("cuti_updated", handleSync);
    window.addEventListener("kinerja_updated", handleSync);
    window.addEventListener("school_updated", handleSync);
    // Sync user list when profile is updated from Profile page
    window.addEventListener("users_updated", handleUsersSync);
    return () => {
      window.removeEventListener("attendance_synchronized", handleSync);
      window.removeEventListener("cuti_updated", handleSync);
      window.removeEventListener("kinerja_updated", handleSync);
      window.removeEventListener("school_updated", handleSync);
      window.removeEventListener("users_updated", handleUsersSync);
    };
  }, []);

  // OPD Addition handler
  const handleCreateOPD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOPDSingkatan || !newOPDNama) return;
    const current = db.getOPDs();
    const nextItem = {
      id: String(current.length + 1),
      singkatan: newOPDSingkatan.toUpperCase(),
      nama: newOPDNama.toUpperCase(),
    };
    const updated = [...current, nextItem];
    await db.setOPDs(updated);
    setOpds(updated);
    setNewOPDNama("");
    setNewOPDSingkatan("");
    setShowAddOPD(false);
    toast.success("Berhasil menambahkan OPD baru!");
  };

  // Satker Addition handler
  const handleCreateSatker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSatkerSingkatan || !newSatkerNama) return;
    const current = db.getSatuanKerjas();
    const nextItem = {
      id: String(current.length + 1),
      singkatan: newSatkerSingkatan.toUpperCase(),
      nama: newSatkerNama.toUpperCase(),
      opdId: newSatkerOpd,
    };
    const updated = [...current, nextItem];
    await db.setSatuanKerjas(updated);
    setSatuanKerjas(updated);
    setNewSatkerNama("");
    setNewSatkerSingkatan("");
    setShowAddSatker(false);
    toast.success("Berhasil menambahkan Satuan Kerja baru!");
  };

  // Kinerja Submission handler
  const handleKinerjaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kinerjaUraian) {
      toast.error("Silakan isi Uraian Kegiatan terlebih dahulu!");
      return;
    }
    const current = db.getKinerjas();
    const newKinerja = {
      id: String(Date.now()),
      userId: user?.id || "2",
      tanggal: kinerjaDate,
      tupoksi: kinerjaTupoksi,
      uraian: kinerjaUraian,
      satuan: kinerjaSatuan,
      jumlahDokumen: Number(kinerjaJumlah),
    };
    const updated = [newKinerja, ...current];
    await db.setKinerjas(updated);
    setKinerjas(updated);
    setKinerjaUraian("");
    setKinerjaJumlah(1);
    toast.success("Laporan Kinerja harian berhasil disubmit ke atasan!");
  };

  // Cuti Submission handler
  const handleCutiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cutiAlasan) {
      toast.error("Alasan pengajuan izin/cuti wajib diisi!");
      return;
    }
    const current = db.getCutiRequests();
    const newRequest = {
      id: String(Date.now()),
      userId: user?.id || "2",
      jenis: cutiJenis,
      tanggalMulai: cutiMulai,
      tanggalSelesai: cutiSelesai,
      alasan: cutiAlasan,
      status: "Pending" as const,
      dokumenUrl: cutiFile || undefined,
    };
    const updated = [newRequest, ...current];
    await db.setCutiRequests(updated);
    setCutiRequests(updated);
    setCutiAlasan("");
    setCutiFile("");
    toast.success(
      "Pengajuan Cuti/Izin berhasil dikirim dan menunggu persetujuan atasan!",
    );
  };

  // Presensi mandiri — menggunakan GPS real-time dari browser
  const handleMobileAttendance = async (
    type: "masuk" | "pulang",
    scannedBarcode?: string,
    scanMethod: string = "scanner",
    photoDataUrl?: string
  ) => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const existing = attendance.find((a) => a.date === todayStr && a.userId === user?.id);
    const timeStr = format(new Date(), "HH:mm:ss");
    const dbSchool = db.getSchool();
    const schoolLat = dbSchool.latitude || -6.200000;
    const schoolLng = dbSchool.longitude || 106.816666;
    const allowedRadius = dbSchool.radius || 120;

    // Ambil GPS real-time dari browser
    const getPosition = (): Promise<GeolocationPosition> =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Perangkat tidak mendukung GPS."));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        });
      });

    let userLat = schoolLat;
    let userLng = schoolLng;

    if (!scannedBarcode) {
      // Presensi mandiri (tanpa QR) — wajib GPS & Anti-Tuyul Check
      setGpsLoading(true);
      try {
        const pos = await getPosition();
        
        // ── Security Check: Deteksi Fake GPS / Mock Location ──
        const securityCheck = analyzeLocationTelemetry(pos);
        if (!securityCheck.isClean) {
          toast.error(
            `⚠️ Anomali GPS Terdeteksi!\n${securityCheck.violations[0]}\n${securityCheck.recommendation}`,
            { duration: 8000 }
          );
          setGpsLoading(false);
          return;
        }
        
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        setCurrentGps({ lat: userLat, lng: userLng });
        setGpsError(null);
      } catch (err: any) {
        setGpsLoading(false);
        const msg =
          err.code === 1
            ? "Izin GPS ditolak. Aktifkan lokasi di pengaturan browser."
            : err.code === 2
              ? "Sinyal GPS lemah. Coba di lokasi terbuka."
              : "GPS timeout. Pastikan lokasi aktif dan coba lagi.";
        setGpsError(msg);
        toast.error(msg, { duration: 6000 });
        return;
      } finally {
        setGpsLoading(false);
      }
    } else if (currentGps) {
      // Jika ada QR, gunakan GPS terakhir yang berhasil diambil (jika ada)
      userLat = currentGps.lat;
      userLng = currentGps.lng;
    }

    // Hitung jarak Haversine
    const R = 6371e3;
    const phi1 = (userLat * Math.PI) / 180;
    const phi2 = (schoolLat * Math.PI) / 180;
    const deltaPhi = ((schoolLat - userLat) * Math.PI) / 180;
    const deltaLambda = ((schoolLng - userLng) * Math.PI) / 180;
    const aDist =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const distanceMeters = Math.round(R * 2 * Math.atan2(Math.sqrt(aDist), Math.sqrt(1 - aDist)));

    // Validasi geofence (hanya untuk presensi mandiri tanpa QR)
    if (!scannedBarcode && distanceMeters > allowedRadius) {
      toast.error(
        `Presensi gagal. Jarak Anda ${distanceMeters}m dari lokasi kerja (batas: ${allowedRadius}m). Pastikan Anda berada di dalam area instansi.`,
        { duration: 7000 }
      );
      return;
    }

    let records = [...attendance];
    if (type === "masuk") {
      if (existing?.checkInTime) {
        toast.error("Anda sudah melakukan absen masuk hari ini.");
        return;
      }
      const isLate = timeStr > (dbSchool.operationalCheckInLimit || "08:00") + ":00";
      const record: any = {
        id: String(Date.now()),
        userId: user?.id || "",
        date: todayStr,
        checkInTime: timeStr,
        status: (isLate ? "Terlambat" : "Hadir") as any,
        isSynced: false,
        syncStatus: "pending" as const,
        latitude: userLat,
        longitude: userLng,
        distance: distanceMeters,
        method: scanMethod as any,
      };
      if (photoDataUrl) record.photoUrl = photoDataUrl;
      if (scannedBarcode) record.qrBarcodeData = scannedBarcode;
      records = [record, ...records];
      toast.success(
        `Absen masuk berhasil — ${timeStr}. Status: ${isLate ? "⚠️ Terlambat" : "✅ Tepat Waktu"}.`,
        { duration: 5000 }
      );
      if (user) {
        NotificationService.send(user, "ATTENDANCE_RECORDED", {
          time: timeStr,
          extraInfo: `Masuk (${isLate ? "Terlambat" : "Tepat Waktu"})${scannedBarcode ? " via Scan QR" : ""}`,
          location: `Jarak dari lokasi kerja: ${distanceMeters}m`,
        });
      }
    } else {
      if (!existing) {
        toast.error("Lakukan absen masuk terlebih dahulu sebelum absen pulang.");
        return;
      }
      if (existing.checkOutTime) {
        toast.error("Anda sudah melakukan absen pulang hari ini.");
        return;
      }
      const targetIdx = records.findIndex((r) => r.id === existing.id);
      if (targetIdx !== -1) {
        records[targetIdx] = {
          ...records[targetIdx],
          checkOutTime: timeStr,
          latitude: userLat,
          longitude: userLng,
          distance: distanceMeters,
          method: scanMethod as any,
        };
        if (photoDataUrl) (records[targetIdx] as any).photoUrl = photoDataUrl;
        if (scannedBarcode) (records[targetIdx] as any).qrBarcodeData = scannedBarcode;
      }
      toast.success(
        `Absen pulang berhasil — ${timeStr}. Semoga hari Anda menyenangkan! 😊`,
        { duration: 5000 }
      );
      if (user) {
        NotificationService.send(user, "ATTENDANCE_RECORDED", {
          time: timeStr,
          extraInfo: `Pulang${scannedBarcode ? " via Scan QR" : ""}`,
          location: `Jarak dari lokasi kerja: ${distanceMeters}m`,
        });
      }
    }

    await db.setAttendance(records);
    setAttendance(records);
    window.dispatchEvent(new Event("attendance_synchronized"));
  };

  const attendanceThisMonth = attendance.filter(a => {
    const monthPrefix = format(new Date(), "yyyy-MM-");
    return a.date && a.date.startsWith(monthPrefix);
  });

  const todayAttendance = attendance.filter((a) => a.date === todayStr);
  const statsData = {
    // Semua role kecuali developer dan admin sendiri
    pegawai: users.filter((u) => u.role !== "admin" && u.role !== "developer").length,
    opd: opds.length,
    satker: satuanKerjas.length,
    jabatan: jabatans.length,
    alpha: todayAttendance.filter((a) => a.status === "Alpha").length,
    sakit: todayAttendance.filter((a) => a.status === "Sakit").length,
    izin: todayAttendance.filter((a) => a.status === "Izin" || a.status === "Cuti Tahunan").length,
    dinas: todayAttendance.filter((a) => a.status === "Dinas/Lainnya").length,
    hadir: todayAttendance.filter((a) => a.status === "Hadir" || a.status === "Terlambat").length,
    terlambat: todayAttendance.filter((a) => a.status === "Terlambat").length,
  };

  // Grafik data bulanan — menggunakan filterYear dan filterMonth dari state
  const monthsAbbr = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
  const reportAttendanceData = monthsAbbr.map((abbr, idx) => {
    const monthStr = String(idx + 1).padStart(2, "0");
    const monthPrefix = `${filterYear}-${monthStr}-`;
    const monthRecords = attendance.filter((a) => a.date && a.date.startsWith(monthPrefix));
    return {
      name: abbr,
      hadir: monthRecords.filter((r) => r.status === "Hadir" || r.status === "Terlambat").length,
      sakit: monthRecords.filter((r) => r.status === "Sakit").length,
      izin: monthRecords.filter((r) => r.status === "Izin").length,
      alpha: monthRecords.filter((r) => r.status === "Alpha").length,
    };
  });

  const golonganData = [
    { golongan: "Pimpinan", jumlah: users.filter((u) => u.role === "kepala_sekolah").length },
    { golongan: "Guru", jumlah: users.filter((u) => u.role === "guru").length },
    { golongan: "Dosen", jumlah: users.filter((u) => u.role === "dosen").length },
    { golongan: "Staf Sekolah", jumlah: users.filter((u) => u.role === "staf_sekolah").length },
    { golongan: "Staf Kampus", jumlah: users.filter((u) => u.role === "staf_kampus").length },
    { golongan: "Admin", jumlah: users.filter((u) => u.role === "admin").length },
  ];

  // Helper arrays for Months and Years
  const indonesianMonths = [
    { val: "01", name: "Januari" },
    { val: "02", name: "Februari" },
    { val: "03", name: "Maret" },
    { val: "04", name: "April" },
    { val: "05", name: "Mei" },
    { val: "06", name: "Juni" },
    { val: "07", name: "Juli" },
    { val: "08", name: "Agustus" },
    { val: "09", name: "September" },
    { val: "10", name: "Oktober" },
    { val: "11", name: "November" },
    { val: "12", name: "Desember" },
  ];

  // Tampilkan dashboard admin/pimpinan
  if (user?.role === "admin" || user?.role === "kepala_sekolah" || user?.role === "developer") {
    const activityData = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dateStr = format(date, "yyyy-MM-dd");
      const dayLabel = format(date, "EEE", { locale: id }).replace(/^\./, "");
      const label = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1, 3);
      return { day: label, val: attendance.filter((a) => a.date === dateStr).length };
    });

    const adminLeaderboard = leaderboard.slice(0, 5);

    const totalToday = (statsData.hadir + statsData.sakit + statsData.izin + statsData.dinas) || 1;
    const hasData = (statsData.hadir + statsData.sakit + statsData.izin + statsData.dinas) > 0;
    const hadirPct = hasData ? Math.round((statsData.hadir / totalToday) * 100) : 0;
    const sakitPct = hasData ? Math.round((statsData.sakit / totalToday) * 100) : 0;
    const izinPct = hasData ? Math.round((statsData.izin / totalToday) * 100) : 0;
    const pendingCuti = cutiRequests.filter((c) => c.status === "Pending");

    return (
      <div className="space-y-6 animate-fade-in pb-12">
        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
          <div>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">Halo, {user?.name}! 👋</h2>
            <p className="text-gray-500 mt-1 text-sm font-medium">Ringkasan aktivitas dan kedisiplinan instansi / sekolah / kampus hari ini di <strong className="text-indigo-600">{school.name}</strong>.</p>
          </div>
        </div>

        {user?.role === "developer" && (
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-amber-500/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black uppercase tracking-wider">
                ⚙️ AKSES EKSKLUSIF PENGEMBANG (DEVELOPER)
              </div>
              <h3 className="text-xl font-black text-white">SaaS Developer Console &amp; Kendali Lisensi</h3>
              <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                Kelola langganan klien (Trial, Starter, Pro, Enterprise) serta suntikkan <strong className="text-amber-400">Paket Hibah Khusus</strong> (Gratis 100% selamanya untuk instansi / admin terpilih) via panel pengembang ini.
              </p>
            </div>
            <Link
              to="/admin/developer"
              className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/30 transition-all whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              🚀 Buka Developer Console
            </Link>
          </div>
        )}


        {/* --- BROADCAST MESSAGE PANEL --- */}
        <div className="theme-bg-soft border theme-border rounded-2xl p-5 mb-8 flex flex-col md:flex-row gap-4 items-center">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Send className="text-blue-600" size={20} />
          </div>
          <div className="flex-1 w-full">
            <h3 className="font-bold text-blue-900 text-sm mb-1">Siaran Pengumuman Massal (Broadcast)</h3>
            <div className="flex gap-2 w-full">
              <input 
                type="text" 
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Ketik pengumuman penting (cth: Rapat guru dipercepat jam 13:00)..."
                className="flex-1 bg-white border border-blue-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button 
                onClick={handleBroadcast}
                disabled={broadcastSending}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all whitespace-nowrap"
              >
                {broadcastSending ? "Menyiarkan..." : "Siarkan"}
              </button>
            </div>
          </div>
        </div>

        {/* ── 4 Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 – Total Guru -> Daftar Pengajar */}
          <Link
            to="/admin/users"
            className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100 flex items-center gap-4 hover:-translate-y-1.5 hover:shadow-xl hover:scale-[1.02] hover:border-indigo-200 cursor-pointer active:scale-95 transition-all duration-200 group relative overflow-hidden"
          >
            <div className="relative w-12 h-12 shrink-0 group-hover:scale-110 transition-transform">
              <div className="absolute right-0 bottom-0 w-[42px] h-[42px] rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm" />
              <div className="absolute left-0 top-0 w-[42px] h-[42px] rounded-full bg-white/20 backdrop-blur-md shadow-[0_4px_16px_0_rgba(0,0,0,0.15)] flex items-center justify-center overflow-hidden border border-white/50 text-white">
                <div className="absolute -top-2 -left-2 w-6 h-6 bg-white/90 rounded-full blur-[8px]" />
                <div className="absolute inset-0 rounded-full shadow-[inset_2px_2px_6px_rgba(255,255,255,0.9),inset_-2px_-2px_6px_rgba(0,0,0,0.05)] pointer-events-none" />
                <Users size={20} className="relative z-10 drop-shadow-sm" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 group-hover:text-indigo-600 transition-colors uppercase tracking-wide">Total Guru</p>
              <p className="text-2xl font-black text-gray-800 leading-none mt-0.5">{statsData.pegawai}</p>
              <p className="text-[10px] text-gray-400 group-hover:text-gray-500 mt-1 flex items-center gap-1">Guru &amp; Staf <span className="text-indigo-500 font-bold ml-0.5">→</span></p>
            </div>
          </Link>

          {/* Card 2 – Hadir Hari Ini -> Data Presensi */}
          <Link
            to="/admin/attendance"
            className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100 flex items-center gap-4 hover:-translate-y-1.5 hover:shadow-xl hover:scale-[1.02] hover:border-orange-200 cursor-pointer active:scale-95 transition-all duration-200 group relative overflow-hidden"
          >
            <div className="relative w-12 h-12 shrink-0 group-hover:scale-110 transition-transform">
              <div className="absolute right-0 bottom-0 w-[42px] h-[42px] rounded-full bg-gradient-to-br from-orange-400 to-pink-500 shadow-sm" />
              <div className="absolute left-0 top-0 w-[42px] h-[42px] rounded-full bg-white/20 backdrop-blur-md shadow-[0_4px_16px_0_rgba(0,0,0,0.15)] flex items-center justify-center overflow-hidden border border-white/50 text-white">
                <div className="absolute -top-2 -left-2 w-6 h-6 bg-white/90 rounded-full blur-[8px]" />
                <div className="absolute inset-0 rounded-full shadow-[inset_2px_2px_6px_rgba(255,255,255,0.9),inset_-2px_-2px_6px_rgba(0,0,0,0.05)] pointer-events-none" />
                <CheckCircle size={20} className="relative z-10 drop-shadow-sm" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 group-hover:text-orange-600 transition-colors uppercase tracking-wide">Hadir Hari Ini</p>
              <p className="text-2xl font-black text-gray-800 leading-none mt-0.5">{statsData.hadir}</p>
              <p className="text-[10px] text-gray-400 group-hover:text-gray-500 mt-1 flex items-center gap-1">↑ Presensi Aktif <span className="text-orange-500 font-bold ml-0.5">→</span></p>
            </div>
          </Link>

          {/* Card 3 – Izin / Cuti -> Izin & Cuti */}
          <Link
            to="/admin/leave"
            className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100 flex items-center gap-4 hover:-translate-y-1.5 hover:shadow-xl hover:scale-[1.02] hover:border-purple-200 cursor-pointer active:scale-95 transition-all duration-200 group relative overflow-hidden"
          >
            <div className="relative w-12 h-12 shrink-0 group-hover:scale-110 transition-transform">
              <div className="absolute right-0 bottom-0 w-[42px] h-[42px] rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 shadow-sm" />
              <div className="absolute left-0 top-0 w-[42px] h-[42px] rounded-full bg-white/20 backdrop-blur-md shadow-[0_4px_16px_0_rgba(0,0,0,0.15)] flex items-center justify-center overflow-hidden border border-white/50 text-white">
                <div className="absolute -top-2 -left-2 w-6 h-6 bg-white/90 rounded-full blur-[8px]" />
                <div className="absolute inset-0 rounded-full shadow-[inset_2px_2px_6px_rgba(255,255,255,0.9),inset_-2px_-2px_6px_rgba(0,0,0,0.05)] pointer-events-none" />
                <FileText size={20} className="relative z-10 drop-shadow-sm" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 group-hover:text-purple-600 transition-colors uppercase tracking-wide">Izin / Cuti</p>
              <p className="text-2xl font-black text-gray-800 leading-none mt-0.5">{statsData.izin + statsData.sakit}</p>
              <p className="text-[10px] text-gray-400 group-hover:text-gray-500 mt-1 flex items-center gap-1">Pengajuan Aktif <span className="text-purple-500 font-bold ml-0.5">→</span></p>
            </div>
          </Link>

          {/* Card 4 – Instansi/Sekolah -> Master Data / Unit Sekolah */}
          <Link
            to="/admin/school"
            className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100 flex items-center gap-4 hover:-translate-y-1.5 hover:shadow-xl hover:scale-[1.02] hover:border-amber-200 cursor-pointer active:scale-95 transition-all duration-200 group relative overflow-hidden"
          >
            <div className="relative w-12 h-12 shrink-0 group-hover:scale-110 transition-transform">
              <div className="absolute right-0 bottom-0 w-[42px] h-[42px] rounded-full bg-gradient-to-br from-orange-400 to-amber-500 shadow-sm" />
              <div className="absolute left-0 top-0 w-[42px] h-[42px] rounded-full bg-white/20 backdrop-blur-md shadow-[0_4px_16px_0_rgba(0,0,0,0.15)] flex items-center justify-center overflow-hidden border border-white/50 text-white">
                <div className="absolute -top-2 -left-2 w-6 h-6 bg-white/90 rounded-full blur-[8px]" />
                <div className="absolute inset-0 rounded-full shadow-[inset_2px_2px_6px_rgba(255,255,255,0.9),inset_-2px_-2px_6px_rgba(0,0,0,0.05)] pointer-events-none" />
                <Building size={20} className="relative z-10 drop-shadow-sm" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 group-hover:text-amber-600 transition-colors uppercase tracking-wide">Unit Sekolah / Kampus</p>
              <p className="text-2xl font-black text-gray-800 leading-none mt-0.5">{statsData.satker}</p>
              <p className="text-[10px] text-gray-400 group-hover:text-gray-500 mt-1 flex items-center gap-1">Terdaftar <span className="text-amber-500 font-bold ml-0.5">→</span></p>
            </div>
          </Link>
        </div>

        {/* ── Bottom 3-column Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Activity Line Chart (left, 6 cols) */}
          <div className="lg:col-span-6 bg-white rounded-[1.5rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-gray-800 text-sm"><EditableText originalText="Aktivitas Presensi" /></h3>
              <span className="text-[10px] bg-orange-50 text-orange-500 font-bold px-2.5 py-1 rounded-full">7 Hari Terakhir</span>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}
                    cursor={{ fill: "rgba(139,92,246,0.05)" }}
                  />
                  <Bar dataKey="val" name="Absensi" fill="url(#purpleGrad)" radius={[8, 8, 0, 0]} maxBarSize={30} />
                  <defs>
                    <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Leaderboard (middle, 3 cols) */}
          <div className="lg:col-span-3 bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-sm"><EditableText originalText="Peringkat Kehadiran" /></h3>
              <ChevronRight size={16} className="text-gray-400" />
            </div>
            <div className="space-y-2.5">
              {adminLeaderboard.map((item, i) => (
                <div key={item.user.id} className="flex items-center gap-3 bg-gray-50/50 p-2 rounded-xl border border-transparent hover:border-gray-100 transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm ${
                    i === 0 ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white ring-2 ring-yellow-200" :
                    i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-400 text-white ring-2 ring-slate-100" :
                    i === 2 ? "bg-gradient-to-br from-orange-300 to-amber-600 text-white ring-2 ring-orange-100" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {i < 3 ? <Award size={14} className="drop-shadow-sm" /> : (i + 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-700 truncate">{item.user.name}</p>
                    <p className="text-[10px] text-gray-400 capitalize flex items-center gap-1">
                      {item.user.role === "kepala_sekolah" ? "kepala sekolah / rektor" : item.user.role?.replace("_", " ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-indigo-600 block leading-none">{item.score} <span className="text-[9px] text-indigo-400 font-normal">pts</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Donut Chart (right, 3 cols) */}
          <div className="lg:col-span-3 bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 text-sm"><EditableText originalText="Status Presensi" /></h3>
              <ChevronRight size={16} className="text-gray-400" />
            </div>
            {/* Simple SVG Donut */}
            <div className="flex justify-center mb-4">
              <svg width="110" height="110" viewBox="0 0 110 110">
                {/* Background circle */}
                <circle cx="55" cy="55" r="40" fill="none" stroke="#F3F4F6" strokeWidth="16" />
                {/* Hadir (orange-pink) */}
                <circle cx="55" cy="55" r="40" fill="none" stroke="url(#donutOrange)" strokeWidth="16"
                  strokeDasharray={`${hadirPct * 2.513} 251.3`} strokeDashoffset="0" strokeLinecap="round"
                  transform="rotate(-90 55 55)" />
                {/* Izin (light purple) */}
                <circle cx="55" cy="55" r="40" fill="none" stroke="#c4b5fd" strokeWidth="16"
                  strokeDasharray={`${izinPct * 2.513} 251.3`} strokeDashoffset={`${-(hadirPct) * 2.513}`} strokeLinecap="round"
                  transform="rotate(-90 55 55)" />
                {/* Sakit (dark purple) */}
                <circle cx="55" cy="55" r="40" fill="none" stroke="#7c3aed" strokeWidth="16"
                  strokeDasharray={`${sakitPct * 2.513} 251.3`} strokeDashoffset={`${-(hadirPct + izinPct) * 2.513}`} strokeLinecap="round"
                  transform="rotate(-90 55 55)" />
                <defs>
                  <linearGradient id="donutOrange" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="space-y-2">
              {[
                { label: "Hadir", pct: hadirPct, color: "bg-gradient-to-r from-orange-400 to-pink-500" },
                { label: "Izin/Cuti", pct: izinPct, color: "bg-violet-300" },
                { label: "Sakit", pct: sakitPct, color: "bg-violet-700" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.color}`} />
                    <span className="text-xs text-gray-500">{item.label}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-700">{item.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Attendance Log Table ── */}
        <div className="bg-white rounded-[1.5rem] border border-gray-100 overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.06)]">
          <div className="p-5 flex justify-between items-center border-b border-gray-100">
            <h3 className="font-bold text-gray-800 text-sm">Log Presensi Terbaru</h3>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full">Live Audit</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans">
              <thead>
                <tr className="bg-gradient-to-r from-purple-600 to-pink-500 text-white text-[11px]">
                  <th className="p-4 font-bold">Tanggal & Waktu</th>
                  <th className="p-4 font-bold">Nama Guru / Staf</th>
                  <th className="p-4 font-bold">Metode</th>
                  <th className="p-4 font-bold text-center">Jarak GPS</th>
                  <th className="p-4 font-bold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">Belum ada log presensi.</td>
                  </tr>
                ) : (
                  attendance.slice(0, 8).map((record) => {
                    const teacher = users.find((u) => u.id === record.userId);
                    const dbSchool = db.getSchool();
                    return (
                      <tr key={record.id} className="hover:bg-purple-50/30 transition">
                        <td className="p-4">
                          <div className="font-bold text-gray-700">{format(new Date(record.date), "dd MMM yyyy")}</div>
                          <div className="text-[10px] text-purple-500 font-mono mt-0.5">
                            {record.checkInTime ? `📥 ${record.checkInTime}` : `📤 ${record.checkOutTime || "—"}`}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-gray-700">{teacher?.name || "Pegawai"}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5 capitalize">{teacher?.role === "kepala_sekolah" ? "kepala sekolah / rektor" : teacher?.role?.replace("_", " ") || "—"}</div>
                        </td>
                        <td className="p-4">
                          <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            {record.method === "scanner" ? "📸 Kamera QR" : "🖼️ Upload"}
                          </span>
                        </td>
                        <td className="p-4 text-center font-mono">
                          {record.distance !== undefined ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              record.distance <= (dbSchool.radius || 120)
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700"
                            }`}>
                              {record.distance}m
                            </span>
                          ) : "—"}
                        </td>
                        <td className="p-4 text-right">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            record.status === "Hadir" ? "bg-emerald-100 text-emerald-700" :
                            record.status === "Terlambat" ? "bg-amber-100 text-amber-700" :
                            "bg-rose-100 text-rose-700"
                          }`}>
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* OPD Modals */}
        {showAddOPD && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl">
              <h3 className="text-lg font-black text-gray-800 mb-4">Tambah OPD</h3>
              <form onSubmit={handleCreateOPD} className="space-y-4">
                <input type="text" value={newOPDSingkatan} onChange={(e) => setNewOPDSingkatan(e.target.value)} placeholder="Singkatan OPD" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" required />
                <input type="text" value={newOPDNama} onChange={(e) => setNewOPDNama(e.target.value)} placeholder="Nama Lengkap OPD" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" required />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowAddOPD(false)} className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"><X size={16} /> Batal</button>
                  <button type="submit" className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"><Save className="w-4 h-4" /> Simpan</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showAddSatker && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl">
              <h3 className="text-lg font-black text-gray-800 mb-4">Tambah Satuan Kerja</h3>
              <form onSubmit={handleCreateSatker} className="space-y-4">
                <input type="text" value={newSatkerSingkatan} onChange={(e) => setNewSatkerSingkatan(e.target.value)} placeholder="Singkatan Unit" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" required />
                <input type="text" value={newSatkerNama} onChange={(e) => setNewSatkerNama(e.target.value)} placeholder="Nama Lengkap Unit" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" required />
                <select value={newSatkerOpd} onChange={(e) => setNewSatkerOpd(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white">
                  {opds.map(op => <option key={op.id} value={op.id}>{op.singkatan} - {op.nama}</option>)}
                </select>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowAddSatker(false)} className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"><X size={16} /> Batal</button>
                  <button type="submit" className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"><Save className="w-4 h-4" /> Simpan</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // EMPLOYEE VIEW (MOCK SMARTPHONE SIMULATION)
  // Matching Pages 1, 4, 5, 6, 18 of PDF
  // ==========================================
  return (
    <div className={`w-full min-h-screen bg-[#F5F7FB] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between ${isDarkMode ? "dark" : ""}`}>
      {/* Container utama: edge-to-edge di mobile (w-full min-h-screen, rounded-none, border-0, m-0), dibatasi max-w-md mx-auto di desktop/tablet */}
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col bg-[#F5F7FB] dark:bg-slate-950 select-none md:my-6 md:rounded-3xl md:border md:border-slate-200/80 dark:md:border-slate-800/80 md:shadow-2xl overflow-hidden relative isolate">
        
        {/* WINDOW CONTROLS (FULLSCREEN API) */}
        <WindowControls />

        {/* BILAH NAVIGASI ATAS (TOP NAVBAR) - STICKY TOP */}
        <header className="sticky top-8 z-30 mt-8 w-full bg-gradient-to-r from-[#1976d2] to-[#1e88e5] text-white px-4 sm:px-5 py-3.5 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center p-1 border border-white shrink-0 shadow-sm">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/e/ea/National_emblem_of_Indonesia_Garuda_Pancasila.svg"
                alt="Garuda"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-left truncate">
              <h4 className="text-xs font-black tracking-widest leading-none font-mono truncate">
                ABSENSI-GO.ID
              </h4>
              <span className="text-[8px] opacity-90 uppercase leading-none mt-0.5 block font-bold truncate">
                {school.name || "Pemerintah Kota Depok"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center justify-center cursor-pointer"
              title="Ganti Mode Tema"
            >
              {isDarkMode ? <Sun size={15} className="text-amber-300" /> : <Moon size={15} className="text-white" />}
            </button>
            <Bell size={16} className="text-white/90 hover:text-white cursor-pointer transition" onClick={() => toast("Tidak ada notifikasi baru")} />
          </div>
        </header>

        {/* DYNAMIC SCROLL SCREEN CONTENT DENGAN PADDING INTERNAL */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4 pb-6">
          {/* Simulation Manual Controller */}
          <details className="bg-slate-900 dark:bg-slate-900/90 p-3 rounded-2xl text-slate-300 border border-slate-800 overflow-hidden shadow-sm text-xs mb-3">
            <summary className="font-extrabold text-[11px] uppercase tracking-wider text-yellow-400 flex items-center gap-1.5 cursor-pointer select-none">
              🛰️ Mode Pengujian / Simulasi Lokasi GPS Satelit (Klik untuk buka opsi)
            </summary>
            <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Pilih lokasi geolokasi HP Anda untuk menguji radius aman geofencing
                  lingkungan Instansi / Sekolah / Kampus ({school.name}):
                </p>
              </div>
              <div className="col-span-2 flex flex-col sm:flex-row gap-2 items-end">
                <button
                  onClick={() => {
                    setCurrentGps({ lat: -6.350397, lng: 106.8064598 });
                    toast.success(
                      "Lokasi disetel: Lingkungan Instansi / Sekolah (Jarak 0 Meter: AMAN!)",
                    );
                  }}
                  className={`flex-1 py-2 px-2.5 text-[10px] font-bold rounded-xl border transition ${
                    currentGps?.lat === -6.350397
                      ? "bg-emerald-600 border-emerald-500 text-gray-800"
                      : "bg-slate-900 border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  📍 1. Di Instansi (0m)
                </button>

                <button
                  onClick={() => {
                    setCurrentGps({ lat: -6.3498, lng: 106.8055 });
                    toast.success(
                      "Lokasi disetel: Kedai Depan Gerbang Sekolah (Jarak ~115 Meter: MARGINAL)"
                    );
                  }}
                  className={`flex-1 py-2 px-2.5 text-[10px] font-bold rounded-xl border transition ${
                    currentGps?.lat === -6.3498
                      ? "bg-amber-600 border-amber-500 text-gray-800"
                      : "bg-slate-900 border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  📍 2. Di Kedai (~110m)
                </button>

                <button
                  onClick={() => {
                    setCurrentGps({ lat: -6.17511, lng: 106.82715 });
                    toast.error(
                      "Lokasi disetel: Monas/Jakarta (Jarak ~19 KM: DI LUAR RADIUS!)",
                    );
                  }}
                  className={`flex-1 py-2 px-2.5 text-[10px] font-bold rounded-xl border transition ${
                    currentGps?.lat === -6.17511
                      ? "bg-rose-600 border-rose-500 text-gray-800"
                      : "bg-slate-900 border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  📍 3. Di Luar (~19KM)
                </button>
              </div>
            </div>
          </details>
              {/* TAB 1: HOME PAGE */}
              {mobileTab === "home" && (
                <div className="space-y-4 animate-fade-in text-gray-800">
                  {/* ─── HERO PROFILE CARD PREMIUM ─── */}
                  <div
                    className="relative overflow-hidden rounded-3xl shadow-xl"
                    style={{ background: "linear-gradient(135deg, #0f2b63 0%, #1a3a8a 45%, #0d1f4a 100%)" }}
                  >
                    {/* Decorative blobs */}
                    <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-white/5 -translate-y-16 translate-x-16 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-blue-400/10 translate-y-12 -translate-x-12 pointer-events-none" />
                    <div className="absolute top-1/2 right-4 w-20 h-20 rounded-full bg-indigo-500/10 pointer-events-none" />

                    <div className="relative p-5 flex flex-col items-center text-center">
                      {/* Status Online Badge */}
                      <div className="w-full flex justify-end mb-2">
                        <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                          </span>
                          ONLINE
                        </div>
                      </div>

                      {/* Profile Photo + QR ID Overlay */}
                      <div className="relative mb-3">
                        <div className="w-20 h-20 rounded-full overflow-hidden border-[3px] border-blue-400/60 shadow-[0_0_20px_rgba(96,165,250,0.4)] ring-4 ring-blue-500/20">
                          <img
                            src={user?.photoUrl || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"}
                            alt={user?.name || "Foto Pegawai"}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
                            }}
                          />
                        </div>
                        {/* QR ID Overlay Badge */}
                        <button
                          onClick={() => {
                            toast(`🪪 QR ID Pegawai: ${user?.nip || user?.pegId || user?.id || "ID-PEGAWAI"}`, { duration: 3000 });
                          }}
                          className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 border-2 border-white/60 flex items-center justify-center shadow-lg hover:scale-110 transition-transform active:scale-95 cursor-pointer"
                          title="Lihat QR ID Pegawai"
                        >
                          <QrCode size={12} className="text-white" />
                        </button>
                      </div>

                      {/* Nama */}
                      <h3 className="font-black text-white text-base tracking-tight leading-tight drop-shadow-sm">
                        {user?.name}
                      </h3>

                      {/* NIP */}
                      <p className="text-[10px] text-blue-200/80 font-mono mt-1 leading-none tracking-widest">
                        NIP: {user?.nip || user?.pegId || user?.username || "—"}
                      </p>

                      {/* Jabatan Badge */}
                      <span className="inline-flex items-center gap-1 mt-2.5 font-bold uppercase tracking-wider text-[9px] bg-amber-400 text-slate-900 px-3 py-1 rounded-full shadow-sm">
                        💼 {user?.jabatan || (user?.role === "dosen" ? "Dosen Pengajar" : user?.role === "guru" ? "Guru Pengajar" : "Tenaga Kependidikan")}
                      </span>

                      {/* Satuan Pendidikan — WAJIB label ini, bukan SKPD */}
                      <div className="mt-3 w-full bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-4 py-2.5">
                        <p className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-300/90 mb-0.5">
                          Satuan Pendidikan
                        </p>
                        <p className="text-xs font-bold text-white leading-tight">
                          {user?.satuanKerja || school.name || "—"}
                        </p>
                      </div>

                      {/* GPS Coordinates */}
                      <div className="mt-2.5 flex items-center justify-center gap-1 text-[9px] text-blue-300/60 font-mono">
                        <MapPin size={9} className="text-amber-400/70 shrink-0" />
                        <span>
                          {(currentGps?.lat ?? school.latitude ?? -6.350397).toFixed(5)},{" "}
                          {(currentGps?.lng ?? school.longitude ?? 106.8064598).toFixed(5)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ─── KARTU STATUS PRESENSI HARIAN (REAL-TIME) ─── */}
                  {(() => {
                    const todayRec = attendance.find(
                      (a) => a.date === todayStr && a.userId === user?.id
                    );
                    const checkInLimitRaw = school.operationalCheckInLimit || "07:30";
                    const checkInLimitFull =
                      checkInLimitRaw.length === 5
                        ? checkInLimitRaw + ":00"
                        : checkInLimitRaw;
                    const hasIn = !!todayRec?.checkInTime;
                    const hasOut = !!todayRec?.checkOutTime;
                    const isLate = hasIn
                      ? todayRec!.checkInTime! > checkInLimitFull
                      : false;
                    const notYetOut = hasIn && !hasOut;

                    let badgeText = "Belum Absen";
                    let badgeClass = "bg-slate-100 text-slate-500 border-slate-200";
                    if (hasIn) {
                      if (isLate) {
                        badgeText = "🔴 Terlambat";
                        badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
                      } else if (!hasOut) {
                        badgeText = "🔵 Belum Tap Pulang";
                        badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
                      } else {
                        badgeText = "🟢 Tepat Waktu";
                        badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                      }
                    }
                    return (
                      <div className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden">
                        {/* Header */}
                        <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1d74f2] to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                              <Clock size={15} className="text-white" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 leading-none">
                                Status Presensi Harian
                              </p>
                              <p className="text-[9px] text-slate-400 mt-0.5 leading-none">
                                {format(new Date(), "EEEE, dd MMMM yyyy", { locale: id })}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold border leading-none ${badgeClass}`}
                          >
                            {badgeText}
                          </span>
                        </div>

                        {/* 3-Column Stats */}
                        <div className="px-4 py-3.5 grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-wide text-slate-400 mb-1">Jam Masuk</p>
                            <p className="text-sm font-black text-slate-700 font-mono leading-none">
                              {checkInLimitRaw}
                            </p>
                            <p className="text-[8px] text-slate-400 mt-0.5">Terjadwal</p>
                          </div>
                          <div className="border-x border-slate-100">
                            <p className="text-[8px] font-black uppercase tracking-wide text-slate-400 mb-1">Tap Masuk</p>
                            <p
                              className={`text-sm font-black font-mono leading-none ${
                                hasIn
                                  ? isLate
                                    ? "text-rose-600"
                                    : "text-emerald-600"
                                  : "text-slate-300"
                              }`}
                            >
                              {hasIn ? todayRec!.checkInTime!.substring(0, 5) : "--:--"}
                            </p>
                            <p className="text-[8px] text-slate-400 mt-0.5">Aktual</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-wide text-slate-400 mb-1">Tap Pulang</p>
                            {notYetOut ? (
                              <span className="inline-block text-[8px] font-extrabold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-lg border border-blue-200 leading-none">
                                Belum
                              </span>
                            ) : (
                              <p
                                className={`text-sm font-black font-mono leading-none ${
                                  hasOut ? "text-slate-700" : "text-slate-300"
                                }`}
                              >
                                {hasOut ? todayRec!.checkOutTime!.substring(0, 5) : "--:--"}
                              </p>
                            )}
                            <p className="text-[8px] text-slate-400 mt-0.5">Aktual</p>
                          </div>
                        </div>

                        {/* Belum Tap Pulang Alert */}
                        {notYetOut && (
                          <div className="mx-4 mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-2">
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                            </span>
                            <p className="text-[10px] text-blue-700 font-semibold">
                              Belum Tap Pulang — Jangan lupa absen pulang!
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* QUICK ACTION BUTTONS (3 KOLOM) */}
                  <div className="grid grid-cols-3 gap-3 pb-1 items-center">
                    {/* 1. Rekan (Ke Riwayat/Leaderboard) */}
                    <button
                      onClick={() => setMobileTab("riwayat")}
                      className="bg-white hover:bg-slate-50 text-slate-700 font-extrabold py-3.5 rounded-3xl shadow-sm transition flex flex-col items-center justify-center text-center group border border-slate-100"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
                        <Users size={18} />
                      </div>
                      <span className="text-[10px] uppercase tracking-wide">
                        Rekan
                      </span>
                    </button>

                    {/* 2. Absen (Utama - Membuka Scanner QR) */}
                    <button
                      onClick={() => {
                        const todayRec = attendance.find(a => a.date === todayStr && a.userId === user?.id);
                        const isNotYetOut = !!todayRec?.checkInTime && !todayRec?.checkOutTime;
                        setActiveQrMode(isNotYetOut ? "check_out" : "check_in");
                        setMobileTab("scan");
                      }}
                      className={`${
                        (() => {
                          const todayRec = attendance.find(a => a.date === todayStr && a.userId === user?.id);
                          return (todayRec?.checkInTime && !todayRec?.checkOutTime) 
                            ? "bg-rose-500 hover:bg-rose-600 border-rose-400" 
                            : "bg-[#1d74f2] hover:bg-blue-600 border-blue-400";
                        })()
                      } text-white font-extrabold py-4 rounded-[2rem] shadow-lg shadow-blue-500/30 transition-all flex flex-col items-center justify-center text-center group border-2 transform hover:-translate-y-1 relative`}
                    >
                      {/* Pulse effect */}
                      <div className="absolute inset-0 rounded-[2rem] border-2 border-white/20 animate-ping opacity-50" style={{ animationDuration: '2s' }} />
                      
                      <div className="mb-1 text-white group-hover:scale-110 transition-transform drop-shadow-md">
                        <QrCode size={24} strokeWidth={2.5} />
                      </div>
                      <span className="text-[11px] uppercase tracking-wider font-black drop-shadow-sm">
                        ABSEN
                      </span>
                    </button>

                    {/* 3. Laporan (Ke Kinerja) */}
                    <button
                      onClick={() => setMobileTab("kinerja")}
                      className="bg-white hover:bg-slate-50 text-slate-700 font-extrabold py-3.5 rounded-3xl shadow-sm transition flex flex-col items-center justify-center text-center group border border-slate-100"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
                        <FileText size={18} />
                      </div>
                      <span className="text-[10px] uppercase tracking-wide">
                        Laporan
                      </span>
                    </button>
                  </div>

                  {/* BUG-10 FIX: Only show disciplinary warning if user actually has unexcused absences (Alpha > 0) */}
                  {(() => {
                    const alphaCount = attendanceThisMonth.filter(a => a.userId === user?.id && a.status === "Alpha").length;
                    if (alphaCount === 0) return null;
                    return (
                      <div className="bg-[#ea4335]/15 border border-red-200 rounded-3xl p-3.5 flex gap-2.5 text-[10px] text-red-800 dark:text-red-300">
                        <AlertTriangle
                          size={18}
                          className="text-red-600 shrink-0 mt-0.5 animate-pulse"
                        />
                        <div>
                          <p className="font-extrabold text-[11px] leading-tight text-[#ea4335]">
                            🛑 Peringatan Disiplin Kehadiran!
                          </p>
                          <p className="mt-1 leading-relaxed opacity-95">
                            &quot;Tercatat Tanpa Keterangan (Alpha) sebanyak {alphaCount} kali bulan ini. Harap segera melapor atau mengajukan susulan izin kepada atasan.&quot;
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* POLISHED BERITA TERBARU SLIDER SECTION */}
                  <div className="bg-white rounded-3xl p-4 shadow-md">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-200 mb-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                        Berita Terbaru
                      </span>
                      <span className="text-[9px] text-gray-500 font-bold">
                        Sistem Aturan
                      </span>
                    </div>
                    <div className="space-y-1 text-left">
                      <h4 className="text-[11px] font-bold leading-snug hover:text-indigo-600 cursor-pointer">
                        Aturan Pokok Disiplin Guru & Staf Yayasan, Sekolah, dan Kampus
                        tentang Kewajiban Presensi Kerja
                      </h4>
                      <p className="text-[9px] text-gray-500 mt-0.5">
                        Diterbitkan: 28 Juni 2023
                      </p>
                      <div className="h-px bg-white/5 my-2" />
                      <p className="text-[10px] text-gray-500 leading-relaxed font-sans">
                        Yayasan dan Dinas Pendidikan / Rektorat menegaskan bahwa pelanggaran rekap
                        presensi harian di luar radius geofence akan ditindaklanjuti secara struktural.
                      </p>
                    </div>
                  </div>

                  {/* QUICK SUBMIT DATA STATUS */}
                  <div className="bg-white/5 bg-white p-3 rounded-2xl flex justify-between items-center text-[10px] font-sans">
                    <span className="font-medium text-gray-500">
                      Log Presensi Hari Ini:
                    </span>
                    <span className="font-bold text-gray-700">
                      {attendance.filter(
                        (a) => a.date === todayStr && a.userId === user?.id,
                      ).length > 0
                        ? "✅ Sudah Absen"
                        : "❌ Belum Absen"}
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 2: BACKEND QR CODES SCAN & GPS MANUALLY */}
              {mobileTab === "scan" && (
                <div className="space-y-4 animate-fade-in text-left">
                  {activeQrMode ? (
                    <div className="py-2">
                      <ModernQRScanner
                        mode={activeQrMode}
                        onScanSuccess={(decodedText, method) => {
                          setActiveQrMode(null);
                          handleMobileAttendance(activeQrMode === "check_in" ? "masuk" : "pulang", decodedText, method);
                        }}
                        onCancel={() => setActiveQrMode(null)}
                        userName={user?.name || "Pegawai / Pengajar"}
                        schoolName={school.name}
                        maxRadius={school.radius || 120}
                        currentDistance={
                          user && user.role !== "admin"
                            ? Math.round(
                                Math.sqrt(
                                  Math.pow(((currentGps?.lat ?? school.latitude ?? -6.350397) - (school.latitude || -6.350397)) * 111320, 2) +
                                    Math.pow(((currentGps?.lng ?? school.longitude ?? 106.8064598) - (school.longitude || 106.8064598)) * 111320 * Math.cos(((school.latitude || -6.350397) * Math.PI) / 180), 2)
                                )
                              )
                            : 0
                        }
                        isLocating={false}
                      />
                    </div>
                  ) : activeBiometricMode ? (
                    <div className="py-2">
                      <BiometricSelfie 
                        userName={user?.name}
                        onCancel={() => setActiveBiometricMode(null)}
                        onCaptureSuccess={(photoDataUrl) => {
                          setActiveBiometricMode(null);
                          handleMobileAttendance(activeBiometricMode === "check_in" ? "masuk" : "pulang", undefined, "gps", photoDataUrl);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* MODE 1: MODERN QR SCANNER AI */}
                      <div className="bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-5 rounded-3xl border border-cyan-500/40 shadow-xl text-white relative overflow-hidden">
                        <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-cyan-500/10 blur-2xl pointer-events-none" />
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-400">
                              <Smartphone size={16} />
                            </div>
                            <div>
                              <span className="text-xs font-black tracking-wider uppercase text-cyan-400">Pindai QR AI Kekinian</span>
                              <p className="text-[9px] text-slate-300">Kamera dengan Cyber-HUD & Sintesis Suara</p>
                            </div>
                          </div>
                          <span className="text-[8px] px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 font-extrabold uppercase">
                            AI Voice
                          </span>
                        </div>

                        <p className="text-[10px] text-slate-300 mb-4 leading-relaxed">
                          Arahkan kamera ke QR Code di gerbang instansi / sekolah / lobi untuk verifikasi presensi instan dengan akurasi tinggi.
                        </p>

                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            onClick={() => setActiveQrMode("check_in")}
                            className="py-3 px-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-[10px] font-black text-white uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 border border-emerald-400/50 active:scale-95 transition"
                          >
                            <span>🎯 Scan Masuk</span>
                          </button>
                          <button
                            onClick={() => setActiveQrMode("check_out")}
                            className="py-3 px-3 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-[10px] font-black text-white uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 border border-rose-400/50 active:scale-95 transition"
                          >
                            <span>🎯 Scan Pulang</span>
                          </button>
                        </div>
                      </div>

                      {/* MODE 2: ABSEN MANDIRI GPS */}
                      <div className="bg-white p-5 rounded-3xl shadow-md border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-black text-gray-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                            <MapPin size={15} className="text-indigo-600" />
                            Absen Mandiri (GPS & Geofencing)
                          </h3>
                          <span className="text-[8px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold uppercase">
                            Satelit
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 mb-4 leading-relaxed">
                          Atau gunakan validasi koordinat GPS HP Anda jika berada dalam radius batas instansi / sekolah ({school.radius || 120} Meter).
                        </p>

                        <div className="space-y-4 font-sans text-xs">
                          {/* Simulated Check In state */}
                          <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                            <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                              STATUS VERIFIKASI SATELLITE
                            </p>
                            <div className="grid grid-cols-[100px_1fr] gap-x-1 text-[11px] font-medium text-gray-700">
                              <div>Lokasi Kerja</div>
                              <div className="font-bold">: {school.name}</div>
                              <div>Radius Batas</div>
                              <div className="text-emerald-600 font-bold">
                                : {school.radius || 120} Meter
                              </div>
                              <div>Status Hari Ini</div>
                              <div className="font-bold text-indigo-600">
                                :{" "}
                                {attendance.filter(
                                  (a) =>
                                    a.date === format(new Date(), "yyyy-MM-dd") &&
                                    a.userId === user?.id,
                                ).length > 0
                                  ? "✅ Sudah Hadir"
                                  : "⏳ Menunggu Absensi"}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <button
                              onClick={() => setActiveBiometricMode("check_in")}
                              className="w-full bg-[#1d74f2] hover:bg-blue-600 py-3 text-white font-extrabold rounded-2xl text-[10px] uppercase shadow-md flex items-center justify-center gap-1 active:scale-95 transition"
                            >
                              📥 Absen Masuk GPS
                            </button>
                            <button
                              onClick={() => setActiveBiometricMode("check_out")}
                              className="w-full bg-rose-500 hover:bg-rose-600 py-3 text-white font-extrabold rounded-2xl text-[10px] uppercase shadow-md flex items-center justify-center gap-1 active:scale-95 transition"
                            >
                              📤 Absen Pulang GPS
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PERMOHONAN IZIN / CUTI */}
              {mobileTab === "cuti" && (
                <div className="space-y-4 animate-fade-in text-left">
                  <div className="bg-white p-4 rounded-3xl shadow-md">
                    <h3 className="font-black text-gray-800 text-xs uppercase tracking-wide">
                      Pengajuan Permohonan Izin / Cuti
                    </h3>
                    <p className="text-[10px] text-gray-500 mt-1 mb-4 leading-relaxed">
                      Lengkapi form pengajuan di bawah untuk mendaftarkan
                      permohonan Cuti Tahunan, Sakit, atau Izin Operasional Sekolah.
                    </p>

                    <form
                      onSubmit={handleCutiSubmit}
                      className="space-y-3 font-sans text-xs"
                    >
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                          Jenis Izin / Cuti
                        </label>
                        <select
                          value={cutiJenis}
                          onChange={(e) => setCutiJenis(e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-200 bg-white dark:border-slate-700 rounded-xl bg-white text-[11px]"
                        >
                          <option value="Izin">Izin Keperluan Pribadi</option>
                          <option value="Sakit">
                            Sakit (Keterangan Dokter)
                          </option>
                          <option value="Cuti Tahunan">Cuti Tahunan Operasional</option>
                          <option value="Dinas/Lainnya">
                            Dinas Luar Operasional Sekolah
                          </option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                            Tgl Mulai
                          </label>
                          <input
                            type="date"
                            value={cutiMulai}
                            onChange={(e) => setCutiMulai(e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-200 bg-white dark:border-slate-700 rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                            Tgl Selesai
                          </label>
                          <input
                            type="date"
                            value={cutiSelesai}
                            onChange={(e) => setCutiSelesai(e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-200 bg-white dark:border-slate-700 rounded-xl"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                          Alasan Pengajuan
                        </label>
                        <textarea
                          value={cutiAlasan}
                          onChange={(e) => setCutiAlasan(e.target.value)}
                          placeholder="Tuliskan detail argumen dan kebutuhan cuti..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-200 bg-white dark:border-slate-700 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                          Lampiran Surat Keterangan / Dokumen Pendukung
                        </label>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setCutiFile(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="w-full px-3.5 py-1.5 border border-gray-200 bg-white dark:border-slate-700 rounded-xl text-[11px] file:mr-2.5 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                      </div>

                      <button
                        type="submit"
                        className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                      >
                        Submit Pengajuan Cuti
                      </button>
                    </form>
                  </div>

                  {/* ACTIVE CUTI HISTORY LIST */}
                  <div className="bg-white p-4 rounded-3xl shadow-md text-xs font-sans">
                    <h4 className="font-extrabold text-[#111c2d] dark:text-slate-100 text-[10px] uppercase tracking-wider mb-2">
                      Riwayat Izin/Cuti Terakhir
                    </h4>
                    <div className="divide-y divide-slate-100">
                      {cutiRequests
                        .filter((c) => c.userId === user?.id)
                        .map((c) => (
                          <div
                            key={c.id}
                            className="py-2 flex justify-between items-center"
                          >
                            <div className="text-left">
                              <p className="font-bold text-gray-800">
                                {c.jenis}
                              </p>
                              <span className="text-[9px] text-gray-500">
                                {c.tanggalMulai} s/d {c.tanggalSelesai}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                c.status === "Approved"
                                  ? "bg-emerald-100 text-emerald-850"
                                  : "bg-amber-100 text-amber-850"
                              }`}
                            >
                              {c.status}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: UPLOAD KINERJA & TUPOKSI MATCHING SCREENSHOT PAGE 6 */}
              {mobileTab === "kinerja" && (
                <div className="space-y-4 animate-fade-in text-left">
                  <div className="bg-white p-4 rounded-3xl shadow-md font-sans">
                    <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 mb-3 text-gray-800">
                      <h3 className="font-black text-xs uppercase tracking-wide">
                        Form Upload Kinerja
                      </h3>
                      <span className="text-[10px] font-bold text-gray-500">
                        GURU & STAF
                      </span>
                    </div>

                    <form
                      onSubmit={handleKinerjaSubmit}
                      className="space-y-3 font-sans text-xs"
                    >
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                          Tanggal Kegiatan
                        </label>
                        <input
                          type="date"
                          value={kinerjaDate}
                          onChange={(e) => setKinerjaDate(e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-200 bg-white dark:border-slate-700 bg-white rounded-xl text-[11px]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                          Tupoksi Terkait
                        </label>
                        <select
                          value={kinerjaTupoksi}
                          onChange={(e) => setKinerjaTupoksi(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 bg-white dark:border-slate-700 bg-white rounded-xl text-[11px]"
                        >
                          <option value="Mengesahkan Mutasi Pejabat Kepegawaian">
                            Mengesahkan Mutasi Pejabat Kepegawaian
                          </option>
                          <option value="Menyelenggarakan Evaluasi Disiplin Guru & Staf">
                            Menyelenggarakan Evaluasi Disiplin Guru & Staf
                          </option>
                          <option value="Mengurus Promosi Jabatan Instansi Daerah">
                            Mengurus Promosi Jabatan Instansi Daerah
                          </option>
                          <option value="Mengisi Laporan Evaluasi Harian">
                            Mengisi Laporan Evaluasi Harian
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                          Uraian Kegiatan
                        </label>
                        <textarea
                          value={kinerjaUraian}
                          onChange={(e) => setKinerjaUraian(e.target.value)}
                          placeholder="Tuliskan ringkasan detail hasil kerja harian Anda..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-200 bg-white dark:border-slate-700 rounded-xl text-[11px]"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                            Satuan Hasil
                          </label>
                          <select
                            value={kinerjaSatuan}
                            onChange={(e) => setKinerjaSatuan(e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-200 bg-white dark:border-slate-700 bg-white rounded-xl text-[11px]"
                          >
                            <option value="Laporan">Laporan</option>
                            <option value="Dokumen">Dokumen</option>
                            <option value="Berkas">Berkas fisik</option>
                            <option value="Kegiatan">Kegiatan</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                            Jumlah Dokumen
                          </label>
                          <input
                            type="number"
                            value={kinerjaJumlah}
                            onChange={(e) =>
                              setKinerjaJumlah(Number(e.target.value))
                            }
                            className="w-full px-3 py-1.5 border border-gray-200 bg-white dark:border-slate-700 rounded-xl"
                            min={1}
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                      >
                        Upload Bukti Kinerja harian
                      </button>
                    </form>
                  </div>

                  {/* ACTIVE KINERJA LOG SUBMISSIONS */}
                  {kinerjas.length > 0 && (
                    <div className="bg-white p-4 rounded-3xl shadow-md font-sans space-y-2">
                      <h4 className="font-extrabold text-[10px] uppercase tracking-wider text-gray-500">
                        Log Pengisian Kinerja Terbaru
                      </h4>
                      <div className="divide-y divide-slate-100 text-[10px]">
                        {kinerjas.map((k) => (
                          <div key={k.id} className="py-2.5 space-y-1">
                            <div className="flex justify-between items-center text-gray-800">
                              <span className="font-bold">{k.tupoksi}</span>
                              <span className="text-[9px] text-gray-500">
                                {k.tanggal}
                              </span>
                            </div>
                            <p className="text-gray-500 italic max-h-12 overflow-hidden truncate">
                              &quot;{k.uraian}&quot;
                            </p>
                            <p className="text-gray-500 font-bold text-[9px]">
                              Hasil: {k.jumlahDokumen} {k.satuan}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: RIWAYAT ABSEN MATCHING TABLE SCREENSHOT PAGE 5 & 6 RIGHT */}
              {mobileTab === "riwayat" && (
                <div className="space-y-4 animate-fade-in text-left">
                  <div className="bg-white p-4 rounded-3xl shadow-s flex flex-col font-sans">
                    <h3 className="font-black text-gray-800 text-xs uppercase tracking-wide">
                      Riwayat Absen Mandiri
                    </h3>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                      Laporan rekapitulasi digital personal bulanan terhitung
                      otomatis oleh server cloud.
                    </p>

                    {/* Filters exactly like screenshot right-side on Page 5 */}
                    <div className="grid grid-cols-2 gap-2 mt-4 mb-3">
                      <div>
                        <select
                          value={filterYear}
                          onChange={(e) => setFilterYear(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-[11px] font-bold border border-gray-200 bg-white bg-white rounded-xl"
                        >
                          <option value="2026">2026</option>
                          <option value="2025">2025</option>
                          <option value="2024">2024</option>
                        </select>
                      </div>
                      <div>
                        <select
                          value={filterMonth}
                          onChange={(e) => setFilterMonth(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-[11px] font-bold border border-gray-200 bg-white bg-white rounded-xl"
                        >
                          {indonesianMonths.map((m) => (
                            <option key={m.val} value={m.val}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* BUG-03 FIX: Removed fake filter button that only showed toast; data is now filtered live via dropdowns above */}

                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Riwayat Absensi:{" "}
                      {
                        indonesianMonths.find((m) => m.val === filterMonth)
                          ?.name
                      }{" "}
                      {filterYear}
                    </p>

                    {/* RIWAYAT TABLE IN PHONE MOCK */}
                    <div className="border border-slate-150 rounded-xl overflow-hidden text-[9px]">
                      <div className="bg-[#17a2b8] text-white uppercase font-bold py-2 px-2.5 grid grid-cols-12 gap-1 text-center">
                        <span className="col-span-3 text-left">Tanggal</span>
                        <span className="col-span-3">Masuk</span>
                        <span className="col-span-3">Pulang</span>
                        <span className="col-span-3">Keterangan</span>
                      </div>

                      <div className="divide-y divide-slate-100 text-gray-700">
                        {/* BUG-03 FIX: Apply filterMonth+filterYear from dropdowns to actual attendance data */}
                        {(() => {
                          const monthPrefix = `${filterYear}-${filterMonth}`;
                          const filtered = attendance
                            .filter((a) => a.userId === user?.id && a.date && a.date.startsWith(monthPrefix))
                            .sort((a, b) => b.date.localeCompare(a.date));
                          if (filtered.length === 0) {
                            return (
                              <div className="p-4 text-center text-gray-500">
                                Belum ada kunjungan di {indonesianMonths.find(m => m.val === filterMonth)?.name} {filterYear}.
                              </div>
                            );
                          }
                          return filtered.map((item) => (
                            <div
                              key={item.id}
                              className="py-2 px-2.5 grid grid-cols-12 gap-1 items-center hover:bg-white/5"
                            >
                              <span className="col-span-3 text-left font-bold text-gray-800">
                                {format(new Date(item.date), "dd-MM")}
                              </span>
                              <span className="col-span-3 text-center font-mono">
                                {item.checkInTime || "--:--"}
                              </span>
                              <span className="col-span-3 text-center font-mono">
                                {item.checkOutTime || "--:--"}
                              </span>
                              <span className="col-span-3 text-center">
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${
                                    item.status === "Hadir"
                                      ? "bg-green-100 text-green-700"
                                      : item.status === "Terlambat"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-rose-100 text-rose-700"
                                  }`}
                                >
                                  {item.status}
                                </span>
                              </span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: SUPPORT & COMPREHENSIVE BENEFITS (Page 7 & 8) */}
              {mobileTab === "bantuan" && (
                <div className="space-y-4 animate-fade-in text-left">
                  <div className="bg-white p-4 rounded-3xl shadow-md font-sans">
                    <h3 className="font-black text-gray-800 text-xs uppercase tracking-wide">
                      Pusat Layanan & Cara Kerja
                    </h3>
                    <p className="text-[10px] text-gray-500 mt-1 mb-4 leading-relaxed">
                      Teknologi ABSENSI-GO.ID mengintegrasikan cloud storage dan
                      GPS dengan 13 Manfaat Komprehensif:
                    </p>

                    <div className="space-y-3 font-sans text-xs">
                      {[
                        {
                          num: "01",
                          title: "Kemudahan Pengelolaan",
                          desc: "Pemantauan real-time oleh atasan langsung dan rekap harian cepat.",
                        },
                        {
                          num: "02",
                          title: "Akurasi Data Geofencing",
                          desc: "Meminimalkan kecurangan fake GPS menggunakan validasi letak koordinat.",
                        },
                        {
                          num: "03",
                          title: "Efisiensi Kerja Tinggi",
                          desc: "Mencegah antrean pegawai berdesakan menghemat waktu pelayanan.",
                        },
                        {
                          num: "04",
                          title: "Pengurangan Penggunaan Kertas",
                          desc: "Ramah lingkungan tanpa perlu form absensi fisik basah.",
                        },
                        {
                          num: "05",
                          title: "Transparansi Tunjangan TPP",
                          desc: "Sesuai dengan PP No. 94 Tahun 2021 tentang rekap disiplin pns.",
                        },
                      ].map((item) => (
                        <div
                          key={item.num}
                          className="p-3 bg-white/5 dark:bg-slate-950 rounded-2xl border border-gray-200 flex gap-3 text-left"
                        >
                          <span className="text-sm font-black text-indigo-600 font-mono mt-0.5">
                            {item.num}
                          </span>
                          <div>
                            <p className="font-bold text-gray-800">
                              {item.title}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                              {item.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: PROFILE — Full form dengan logout */}
              {mobileTab === "profil" && (
                <div className="animate-fade-in">
                  <ProfileTabContent onLogout={logout} />
                </div>
              )}
            </main>

            {/* BOTTOM NAVIGATION BAR (PWA) */}
            <div className="sticky bottom-0 z-30 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200/80 dark:border-slate-800 py-2.5 px-2 sm:px-4 flex justify-around items-center text-gray-500 dark:text-slate-400 shrink-0 select-none shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
              <button
                onClick={() => setMobileTab("home")}
                className={`flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 ${mobileTab === "home" ? "text-[#1d74f2] dark:text-blue-400 font-black scale-105 transition-all" : "hover:text-gray-700 transition-colors"}`}
              >
                <LayoutDashboard size={18} strokeWidth={mobileTab === "home" ? 2.5 : 2} />
                <span className="text-[9px] font-sans">Beranda</span>
              </button>

              <button
                onClick={() => setMobileTab("scan")}
                className={`flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 ${mobileTab === "scan" ? "text-[#1d74f2] dark:text-blue-400 font-black scale-105 transition-all" : "hover:text-gray-700 transition-colors"}`}
              >
                <QrCode size={18} strokeWidth={mobileTab === "scan" ? 2.5 : 2} />
                <span className="text-[9px] font-sans">Presensi</span>
              </button>

              <button
                onClick={() => setMobileTab("cuti")}
                className={`flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 ${mobileTab === "cuti" ? "text-[#1d74f2] dark:text-blue-400 font-black scale-105 transition-all" : "hover:text-gray-700 transition-colors"}`}
              >
                <Calendar size={18} strokeWidth={mobileTab === "cuti" ? 2.5 : 2} />
                <span className="text-[9px] font-sans">Izin/Cuti</span>
              </button>

              <button
                onClick={() => setMobileTab("kinerja")}
                className={`flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 ${mobileTab === "kinerja" ? "text-[#1d74f2] dark:text-blue-400 font-black scale-105 transition-all" : "hover:text-gray-700 transition-colors"}`}
              >
                <BarChart2 size={18} strokeWidth={mobileTab === "kinerja" ? 2.5 : 2} />
                <span className="text-[9px] font-sans">Kinerja</span>
              </button>

              <button
                onClick={() => setMobileTab("riwayat")}
                className={`flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 ${mobileTab === "riwayat" ? "text-[#1d74f2] dark:text-blue-400 font-black scale-105 transition-all" : "hover:text-gray-700 transition-colors"}`}
              >
                <Clock size={18} strokeWidth={mobileTab === "riwayat" ? 2.5 : 2} />
                <span className="text-[9px] font-sans">Riwayat</span>
              </button>

              <button
                onClick={() => setMobileTab("profil")}
                className={`flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 ${mobileTab === "profil" ? "text-[#1d74f2] dark:text-blue-400 font-black scale-105 transition-all" : "hover:text-gray-700 transition-colors"}`}
              >
                <UserCircle size={18} strokeWidth={mobileTab === "profil" ? 2.5 : 2} />
                <span className="text-[9px] font-sans">Profil</span>
              </button>
            </div>
          </div>
        </div>
    );
}
