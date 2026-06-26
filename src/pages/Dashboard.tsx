import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../components/AuthContext";
import { db } from "../lib/db";
import { NotificationService } from "../lib/notifications";
import { EditableText } from "../components/EditableText";
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
import { Users, FileText, CheckCircle, Clock, Download, Building, Layers, Briefcase, AlertTriangle, MapPin, Smartphone, Calendar, FileSpreadsheet, Send, HelpCircle, Award, ChevronRight, Menu, Bell, Search, BookOpen, Filter, CheckCircle2, XCircle, Moon, Sun, UserCheck, LayoutDashboard, Save, X, Plus } from 'lucide-react';
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

export function Dashboard() {
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

  const handleBroadcast = () => {
    if (!broadcastMessage.trim()) {
      toast.error("Pesan pengumuman tidak boleh kosong!");
      return;
    }
    const teachers = users.filter(u => u.role !== 'admin');
    teachers.forEach(t => {
      NotificationService.send(t, 'BROADCAST_MESSAGE', { extraInfo: broadcastMessage });
    });
    toast.success(`Pengumuman berhasil disiarkan ke ${teachers.length} Guru/Staf!`);
    setBroadcastMessage("");
  };

  // Simulate Automated Attendance Reminder
  useEffect(() => {
    if (user && user.role !== 'admin') {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const hasCheckedIn = db.getAttendance().some(a => a.date === todayStr && a.userId === user.id);
      const reminderKey = `reminder_sent_${todayStr}_${user.id}`;
      
      if (!hasCheckedIn && !sessionStorage.getItem(reminderKey)) {
        // Give it a small delay so it doesn't pop up exactly when dashboard mounts
        setTimeout(() => {
          NotificationService.send(user, 'ATTENDANCE_REMINDER');
        }, 3000);
        sessionStorage.setItem(reminderKey, "true");
      }
    }
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
  const [filterYear, setFilterYear] = useState("2026");
  const [filterMonth, setFilterMonth] = useState("06");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [manualGps, setManualGps] = useState({
    lat: school.latitude ?? -6.350397,
    lng: school.longitude ?? 106.8064598,
  });
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
    const handleSync = () => {
      const updatedSchool = db.getSchool();
      setSchool(updatedSchool);
      setAttendance(db.getAttendance());
      setCutiRequests(db.getCutiRequests());
      setKinerjas(db.getKinerjas());
      setManualGps({
        lat: updatedSchool.latitude ?? -6.350397,
        lng: updatedSchool.longitude ?? 106.8064598,
      });
    };
    window.addEventListener("attendance_synchronized", handleSync);
    window.addEventListener("cuti_updated", handleSync);
    window.addEventListener("kinerja_updated", handleSync);
    return () => {
      window.removeEventListener("attendance_synchronized", handleSync);
      window.removeEventListener("cuti_updated", handleSync);
      window.removeEventListener("kinerja_updated", handleSync);
    };
  }, []);

  // OPD Addition handler
  const handleCreateOPD = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOPDSingkatan || !newOPDNama) return;
    const current = db.getOPDs();
    const nextItem = {
      id: String(current.length + 1),
      singkatan: newOPDSingkatan.toUpperCase(),
      nama: newOPDNama.toUpperCase(),
    };
    const updated = [...current, nextItem];
    db.setOPDs(updated);
    setOpds(updated);
    setNewOPDNama("");
    setNewOPDSingkatan("");
    setShowAddOPD(false);
    toast.success("Berhasil menambahkan OPD baru!");
  };

  // Satker Addition handler
  const handleCreateSatker = (e: React.FormEvent) => {
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
    db.setSatuanKerjas(updated);
    setSatuanKerjas(updated);
    setNewSatkerNama("");
    setNewSatkerSingkatan("");
    setShowAddSatker(false);
    toast.success("Berhasil menambahkan Satuan Kerja baru!");
  };

  // Kinerja Submission handler
  const handleKinerjaSubmit = (e: React.FormEvent) => {
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
    db.setKinerjas(updated);
    setKinerjas(updated);
    setKinerjaUraian("");
    setKinerjaJumlah(1);
    toast.success("Laporan Kinerja harian berhasil disubmit ke atasan!");
  };

  // Cuti Submission handler
  const handleCutiSubmit = (e: React.FormEvent) => {
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
    db.setCutiRequests(updated);
    setCutiRequests(updated);
    setCutiAlasan("");
    setCutiFile("");
    toast.success(
      "Pengajuan Cuti/Izin berhasil dikirim dan menunggu persetujuan atasan!",
    );
  };

  // Mobile Mock Clock-In / Clock-Out
  const handleMobileAttendance = (type: "masuk" | "pulang") => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const existing = attendance.find(
      (a) => a.date === todayStr && a.userId === user?.id,
    );
    const timeStr = format(new Date(), "HH:mm:ss");
    const dbSchool = db.getSchool();

    // Coordinates calculation (distance)
    const schoolLat = dbSchool.latitude || -6.350397;
    const schoolLng = dbSchool.longitude || 106.8064598;

    // distance calculate standard
    const R = 6371e3; // metres
    const phi1 = (manualGps.lat * Math.PI) / 180;
    const phi2 = (schoolLat * Math.PI) / 180;
    const deltaPhi = ((schoolLat - manualGps.lat) * Math.PI) / 180;
    const deltaLambda = ((schoolLng - manualGps.lng) * Math.PI) / 180;
    const aDist =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) *
        Math.sin(deltaLambda / 2);
    const cDist = 2 * Math.atan2(Math.sqrt(aDist), Math.sqrt(1 - aDist));
    const distanceMeters = Math.round(R * cDist);

    if (distanceMeters > (dbSchool.radius || 120)) {
      toast.error(
        `Presensi Gagal! Jarak Anda ${distanceMeters}m dari lokasi kerja (Diluar radius aman ${dbSchool.radius}m).`,
      );
      return;
    }

    let records = [...attendance];
    if (type === "masuk") {
      if (existing?.checkInTime) {
        toast.error("Anda sudah melakukan Absen Masuk hari ini!");
        return;
      }
      const isLate =
        timeStr > (dbSchool.operationalCheckInLimit || "08:00") + ":00";
      const record = {
        id: String(Date.now()),
        userId: user?.id || "2",
        date: todayStr,
        checkInTime: timeStr,
        status: (isLate ? "Terlambat" : "Hadir") as any,
        isSynced: true,
        syncStatus: "synced" as const,
        latitude: manualGps.lat,
        longitude: manualGps.lng,
        distance: distanceMeters,
        method: "scanner" as const,
      };
      records = [record, ...records];
      toast.success(
        `Absen MASUK Berhasil pada ${timeStr}! Status: ${isLate ? "Terlambat" : "Hadir"}`,
      );
      if (user) {
        NotificationService.send(user, 'ATTENDANCE_RECORDED', { 
          time: timeStr, 
          extraInfo: `Masuk (${isLate ? "Terlambat" : "Tepat Waktu"})`,
          location: `Area Madrasah (Jarak: ${distanceMeters}m)`
        });
      }
    } else {
      if (!existing) {
        toast.error(
          "Anda harus melakukan Absen Masuk terlebih dahulu hari ini!",
        );
        return;
      }
      if (existing.checkOutTime) {
        toast.error("Anda sudah melakukan Absen Pulang hari ini!");
        return;
      }
      const targetIdx = records.findIndex((r) => r.id === existing.id);
      if (targetIdx !== -1) {
        records[targetIdx] = {
          ...records[targetIdx],
          checkOutTime: timeStr,
          latitude: manualGps.lat,
          longitude: manualGps.lng,
          distance: distanceMeters,
        };
      }
      toast.success(`Absen PULANG Berhasil pada ${timeStr}! Terima kasih.`);
      if (user) {
        NotificationService.send(user, 'ATTENDANCE_RECORDED', { 
          time: timeStr, 
          extraInfo: `Pulang`,
          location: `Area Madrasah (Jarak: ${distanceMeters}m)`
        });
      }
    }

    db.setAttendance(records);
    setAttendance(records);
    window.dispatchEvent(new Event("attendance_synchronized"));
  };

  const attendanceThisMonth = attendance.filter(a => {
    const monthPrefix = format(new Date(), "yyyy-MM-");
    return a.date && a.date.startsWith(monthPrefix);
  });

  // Precalculated general stats for admin (dynamically counted from live database tables)
  const statsMock = {
    pegawai: users.filter((u) => u.role !== "admin").length,
    opd: opds.length,
    satker: satuanKerjas.length,
    jabatan: jabatans.length,
    tanpaKet: attendance.filter((a) => a.status === "Alpha").length,
    sakit:
      cutiRequests.filter((c) => c.jenis === "Sakit" && c.status === "Approved")
        .length,
    izin:
      cutiRequests.filter((c) => c.jenis === "Izin" && c.status === "Approved")
        .length,
    dinas:
      cutiRequests.filter(
        (c) => c.jenis === "Dinas/Lainnya" && c.status === "Approved",
      ).length,
    hadir: attendanceThisMonth.filter((a) => a.status === "Hadir").length,
  };

  // Dynamic monthly attendance chart data aggregated from the live active system
  const monthsAbbr = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun"];
  const currentYear = format(new Date(), "yyyy");
  const reportAttendanceData = monthsAbbr.map((abbr, idx) => {
    const monthStr = String(idx + 1).padStart(2, "0");
    const monthPrefix = `${currentYear}-${monthStr}-`;
    const monthRecords = attendance.filter(
      (a) => a.date && a.date.startsWith(monthPrefix),
    );
    return {
      name: abbr,
      hadir: monthRecords.filter((r) => r.status === "Hadir").length,
      sakit: monthRecords.filter((r) => r.status === "Sakit").length,
      izin: monthRecords.filter((r) => r.status === "Izin").length,
      alpha: monthRecords.filter((r) => r.status === "Alpha").length,
    };
  });

  const golonganData = [
    { golongan: "Kepala Madrasah", jumlah: users.filter((u) => u.role === "kepala_madrasah").length },
    { golongan: "Guru", jumlah: users.filter((u) => u.role === "guru").length },
    { golongan: "Staf", jumlah: users.filter((u) => u.role === "staf_sekolah").length },
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

  // If user is Admin or Kepala Dinas / OPD
  if (user?.role === "admin" || user?.role === "kepala_madrasah" || user?.role === "developer") {
    // Activity data for line chart (7 days)
    const activityData = [
      { day: "Sen", val: attendanceThisMonth.filter(a => a.date === format(subDays(new Date(), 6), "yyyy-MM-dd")).length },
      { day: "Sel", val: attendanceThisMonth.filter(a => a.date === format(subDays(new Date(), 5), "yyyy-MM-dd")).length },
      { day: "Rab", val: attendanceThisMonth.filter(a => a.date === format(subDays(new Date(), 4), "yyyy-MM-dd")).length },
      { day: "Kam", val: attendanceThisMonth.filter(a => a.date === format(subDays(new Date(), 3), "yyyy-MM-dd")).length },
      { day: "Jum", val: attendanceThisMonth.filter(a => a.date === format(subDays(new Date(), 2), "yyyy-MM-dd")).length },
      { day: "Sab", val: attendanceThisMonth.filter(a => a.date === format(subDays(new Date(), 1), "yyyy-MM-dd")).length },
      { day: "Min", val: attendanceThisMonth.filter(a => a.date === todayStr).length },
    ];

    // Leaderboard: Use gamified leaderboard from state
    const adminLeaderboard = leaderboard.slice(0, 5);

    // Donut data for attendance status breakdown
    const hasData = (statsMock.hadir + statsMock.sakit + statsMock.izin + statsMock.dinas) > 0;
    const totalA = (statsMock.hadir + statsMock.sakit + statsMock.izin + statsMock.dinas) || 1;
    const hadirPct = hasData ? Math.round((statsMock.hadir / totalA) * 100) : 0;
    const sakitPct = hasData ? Math.round((statsMock.sakit / totalA) * 100) : 0;
    const izinPct = hasData ? 100 - hadirPct - sakitPct : 0;

    return (
      <div className="space-y-6 animate-fade-in pb-12">
        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
          <div>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">
              Dasbor Presensi
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{school.name}</p>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">Halo, {user?.name}! 👋</h2>
            <p className="text-gray-500 mt-1 text-sm font-medium">Ringkasan aktivitas dan kedisiplinan madrasah hari ini.</p>
          </div>
        </div>

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
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all whitespace-nowrap"
              >
                Siarkan
              </button>
            </div>
          </div>
        </div>

        {/* ── 4 Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 – Total Guru */}
          <div className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100 flex items-center gap-4 hover:-translate-y-1 transition-all group">
            <div className="relative w-12 h-12 shrink-0 group-hover:scale-110 transition-transform">
              <div className="absolute right-0 bottom-0 w-[42px] h-[42px] rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm" />
              <div className="absolute left-0 top-0 w-[42px] h-[42px] rounded-full bg-white/20 backdrop-blur-md shadow-[0_4px_16px_0_rgba(0,0,0,0.15)] flex items-center justify-center overflow-hidden border border-white/50 text-white">
                <div className="absolute -top-2 -left-2 w-6 h-6 bg-white/90 rounded-full blur-[8px]" />
                <div className="absolute inset-0 rounded-full shadow-[inset_2px_2px_6px_rgba(255,255,255,0.9),inset_-2px_-2px_6px_rgba(0,0,0,0.05)] pointer-events-none" />
                <Users size={20} className="relative z-10 drop-shadow-sm" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Total Guru</p>
              <p className="text-2xl font-black text-gray-800 leading-none mt-0.5">{statsMock.pegawai}</p>
              <p className="text-[10px] text-gray-400 mt-1">Guru & Staf</p>
            </div>
          </div>

          {/* Card 2 – Hadir Hari Ini */}
          <div className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100 flex items-center gap-4 hover:-translate-y-1 transition-all group">
            <div className="relative w-12 h-12 shrink-0 group-hover:scale-110 transition-transform">
              <div className="absolute right-0 bottom-0 w-[42px] h-[42px] rounded-full bg-gradient-to-br from-orange-400 to-pink-500 shadow-sm" />
              <div className="absolute left-0 top-0 w-[42px] h-[42px] rounded-full bg-white/20 backdrop-blur-md shadow-[0_4px_16px_0_rgba(0,0,0,0.15)] flex items-center justify-center overflow-hidden border border-white/50 text-white">
                <div className="absolute -top-2 -left-2 w-6 h-6 bg-white/90 rounded-full blur-[8px]" />
                <div className="absolute inset-0 rounded-full shadow-[inset_2px_2px_6px_rgba(255,255,255,0.9),inset_-2px_-2px_6px_rgba(0,0,0,0.05)] pointer-events-none" />
                <CheckCircle size={20} className="relative z-10 drop-shadow-sm" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Hadir Hari Ini</p>
              <p className="text-2xl font-black text-gray-800 leading-none mt-0.5">{statsMock.hadir}</p>
              <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">↑ Presensi Aktif</p>
            </div>
          </div>

          {/* Card 3 – Izin / Cuti */}
          <div className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100 flex items-center gap-4 hover:-translate-y-1 transition-all group">
            <div className="relative w-12 h-12 shrink-0 group-hover:scale-110 transition-transform">
              <div className="absolute right-0 bottom-0 w-[42px] h-[42px] rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 shadow-sm" />
              <div className="absolute left-0 top-0 w-[42px] h-[42px] rounded-full bg-white/20 backdrop-blur-md shadow-[0_4px_16px_0_rgba(0,0,0,0.15)] flex items-center justify-center overflow-hidden border border-white/50 text-white">
                <div className="absolute -top-2 -left-2 w-6 h-6 bg-white/90 rounded-full blur-[8px]" />
                <div className="absolute inset-0 rounded-full shadow-[inset_2px_2px_6px_rgba(255,255,255,0.9),inset_-2px_-2px_6px_rgba(0,0,0,0.05)] pointer-events-none" />
                <FileText size={20} className="relative z-10 drop-shadow-sm" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Izin / Cuti</p>
              <p className="text-2xl font-black text-gray-800 leading-none mt-0.5">{statsMock.izin + statsMock.sakit}</p>
              <p className="text-[10px] text-gray-400 mt-1">Pengajuan Aktif</p>
            </div>
          </div>

          {/* Card 4 – Madrasah */}
          <div className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100 flex items-center gap-4 hover:-translate-y-1 transition-all group">
            <div className="relative w-12 h-12 shrink-0 group-hover:scale-110 transition-transform">
              <div className="absolute right-0 bottom-0 w-[42px] h-[42px] rounded-full bg-gradient-to-br from-orange-400 to-amber-500 shadow-sm" />
              <div className="absolute left-0 top-0 w-[42px] h-[42px] rounded-full bg-white/20 backdrop-blur-md shadow-[0_4px_16px_0_rgba(0,0,0,0.15)] flex items-center justify-center overflow-hidden border border-white/50 text-white">
                <div className="absolute -top-2 -left-2 w-6 h-6 bg-white/90 rounded-full blur-[8px]" />
                <div className="absolute inset-0 rounded-full shadow-[inset_2px_2px_6px_rgba(255,255,255,0.9),inset_-2px_-2px_6px_rgba(0,0,0,0.05)] pointer-events-none" />
                <Building size={20} className="relative z-10 drop-shadow-sm" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Unit Madrasah</p>
              <p className="text-2xl font-black text-gray-800 leading-none mt-0.5">{statsMock.satker}</p>
              <p className="text-[10px] text-gray-400 mt-1">Terdaftar</p>
            </div>
          </div>
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
                      {item.user.role?.replace("_", " ")}
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
                          <div className="text-[10px] text-gray-400 mt-0.5 capitalize">{teacher?.role?.replace("_", " ") || "—"}</div>
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
    <div
      className={`space-y-6 pb-12 ${isDarkMode ? "dark bg-slate-900 text-slate-100" : ""}`}
    >
      <h2 className="text-xl font-bold text-gray-800 tracking-tight border-b border-gray-200 pb-3 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Smartphone className="text-indigo-600" size={20} />
          Demo Simulasi Genggam Pegawai (Smartphone View)
        </span>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2 rounded-full border border-gray-200 hover:bg-white/5 text-gray-500 transition text-xs flex items-center gap-1.5"
        >
          {isDarkMode ? (
            <Sun size={14} className="text-amber-500" />
          ) : (
            <Moon size={14} className="text-indigo-600" />
          )}
          {isDarkMode ? "Mode Terang" : "Mode Gelap"}
        </button>
      </h2>

      {/* Simulation Manual Controller */}
      <div className="bg-slate-950 p-4 rounded-3xl text-slate-300 grid grid-cols-1 md:grid-cols-3 gap-5 border border-slate-800 overflow-hidden shadow-md">
        <div>
          <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-yellow-400 flex items-center gap-1.5">
            🛰️ Kontrol Simulasi GPS Satelit Anda
          </h4>
          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
            Pilih lokasi geolokasi HP Anda untuk menguji radius aman geofencing
            lingkungan Madrasah ({school.name}):
          </p>
        </div>
        <div className="col-span-2 flex flex-col sm:flex-row gap-2.5 items-end">
          <button
            onClick={() => {
              setManualGps({ lat: -6.350397, lng: 106.8064598 });
              toast.success(
                "Lokasi disetel: Lingkungan Madrasah (Jarak 0 Meter: AMAN!)",
              );
            }}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border transition ${
              manualGps.lat === -6.350397
                ? "bg-emerald-600 border-emerald-500 text-gray-800"
                : "bg-slate-900 border-slate-800 hover:bg-slate-800"
            }`}
          >
            📍 1. Berada di Lingkungan Madrasah (0m)
          </button>

          <button
            onClick={() => {
              setManualGps({ lat: -6.3498, lng: 106.8055 });
              toast.success(
                "Lokasi disetel: Kedai Depan Gerbang Sekolah (Jarak ~115 Meter: MARGINAL)"
              );
            }}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border transition ${
              manualGps.lat === -6.3498
                ? "bg-amber-600 border-amber-500 text-gray-800"
                : "bg-slate-900 border-slate-800 hover:bg-slate-800"
            }`}
          >
            📍 2. Di Kedai Depan (~110m)
          </button>

          <button
            onClick={() => {
              setManualGps({ lat: -6.17511, lng: 106.82715 });
              toast.error(
                "Lokasi disetel: Monas/Jakarta (Jarak ~19 KM: DI LUAR RADIUS!)",
              );
            }}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border transition ${
              manualGps.lat === -6.17511
                ? "bg-rose-600 border-rose-500 text-gray-800"
                : "bg-slate-900 border-slate-800 hover:bg-slate-800"
            }`}
          >
            📍 3. Sedang di Monas (~19KM)
          </button>
        </div>
      </div>

      <div className="flex justify-center items-center py-6 bg-white/5 p-2 sm:p-6 rounded-3xl">
        {/* PHYSICAL SMARTPHONE FRAME CASE */}
        <div className="w-[380px] min-h-[720px] bg-slate-900 rounded-[42px] p-[11px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] border-[6px] border-slate-800 flex flex-col relative overflow-hidden isolate">
          {/* CAMERA NOTCH MOCK */}
          <div className="absolute top-[16px] left-1/2 transform -translate-x-1/2 w-24 h-5 bg-black rounded-full z-50 flex items-center justify-center p-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-900 border border-blue-950 block" />
            <div className="w-8 h-2 bg-slate-900/60 rounded ml-2" />
          </div>

          {/* INTERNAL SCREEN CONTAINER */}
          <div className="flex-1 bg-[#F5F7FB] dark:bg-slate-950 select-none pb-2 rounded-[31px] overflow-hidden flex flex-col">
            {/* PHONE STATUS BAR */}
            <div className="bg-[#1e88e5] text-gray-800 pt-6 pb-2 px-6 flex justify-between items-center text-[10px] font-mono font-bold font-sans">
              <span>Waktu SAKTI: {format(new Date(), "HH:mm")}</span>
              <div className="flex items-center gap-1.5 uppercase font-sans">
                <span>⚡ GPS ON</span>
                <div className="w-3.5 h-2 bg-white border border-gray-200 rounded-xs flex p-[1px]">
                  <div className="flex-1 bg-green-500" />
                </div>
                <span>73%</span>
              </div>
            </div>

            {/* MAIN APP BLUE NAVBAR HEADER */}
            <header className="bg-gradient-to-r from-[#1976d2] to-[#1e88e5] text-gray-800 px-5 py-4 flex items-center justify-between shadow-md shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center p-1 border border-white">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/e/ea/National_emblem_of_Indonesia_Garuda_Pancasila.svg"
                    alt="Garuda"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-left">
                  <h4 className="text-xs font-black tracking-widest leading-none font-mono">
                    ABSENSI-GO.ID
                  </h4>
                  <span className="text-[8px] opacity-80 uppercase leading-none mt-0.5 block font-bold">
                    Pemerintah Kota Depok
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Bell
                  size={14}
                  className="text-gray-800 hover:opacity-85 cursor-pointer"
                />
                <button
                  onClick={() => {
                    toast.success("Membuka menu drawer samping (Simulasi)");
                  }}
                >
                  <Menu size={16} className="text-gray-800 shrink-0" />
                </button>
              </div>
            </header>

            {/* DYNAMIC SCROLL SCREEN CONTENT */}
            <main className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* TAB 1: HOME PAGE */}
              {mobileTab === "home" && (
                <div className="space-y-4 animate-fade-in text-gray-800">
                  {/* HERO EMPLOYEE BIODATA CARD MATCHING PHOTO */}
                  <div className="bg-gradient-to-br from-[#1d74f2] to-[#155fc9] text-gray-800 p-4 rounded-3xl shadow-sm relative overflow-hidden text-center flex flex-col items-center">
                    {/* Circle Background decorative items */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full" />

                    {/* Employee avatar from PDF */}
                    <div className="w-16 h-16 rounded-full bg-white border-2 border-white overflow-hidden shadow-md flex items-center justify-center mb-2 shrink-0">
                      <img
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                        alt="Lisal Faisal Avatar"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src =
                            "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
                        }}
                      />
                    </div>

                    <h3 className="font-extrabold text-sm tracking-tight">
                      {user?.name}
                    </h3>
                    <p className="text-[10px] text-gray-600 font-mono mt-0.5 leading-none">
                      ID: {user?.nip || "198001012005011001"}
                    </p>
                    <span className="inline-block mt-2 font-bold uppercase tracking-wider text-[8px] bg-yellow-400 text-slate-900 px-2.5 py-0.5 rounded-full">
                      💼 {user?.jabatan || "Kepala Bidang"}
                    </span>

                    {user?.role === "guru" && (user?.mapelUtama || user?.mapelSertifikasi) && (
                      <div className="mt-2 text-center text-[9px] text-gray-800/95 space-y-1 bg-black/10 p-2 rounded-xl border border-white/5 w-full">
                        {user.mapelUtama && (
                          <div>
                            <span className="font-bold text-sky-200">MaPel Utama:</span> {user.mapelUtama}
                          </div>
                        )}
                        {user.mapelSertifikasi && (
                          <div>
                            <span className="font-bold text-emerald-300">Sertifikasi:</span> {user.mapelSertifikasi}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Live GPS locator text beneath employee */}
                    <div className="mt-2.5 pt-2 border-t border-gray-200 w-full flex items-center justify-center gap-1 text-[9px] text-gray-600 font-mono">
                      <MapPin size={10} className="text-yellow-400 shrink-0" />
                      <span>
                        {manualGps.lat.toFixed(6)}, {manualGps.lng.toFixed(6)}
                      </span>
                    </div>
                  </div>

                  {/* DOUBLE ACTION BUTTONS MATCHING SCREENSHOT */}
                  <div className="grid grid-cols-2 gap-3 pb-1">
                    <button
                      onClick={() => handleMobileAttendance("masuk")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-3xl shadow-md transition flex flex-col items-center justify-center text-center group border border-emerald-500"
                    >
                      <Clock
                        size={18}
                        className="mb-1 text-gray-800 group-hover:scale-105"
                      />
                      <span className="text-[10px] uppercase tracking-wide">
                        ABSEN MASUK
                      </span>
                      <span className="text-[8px] font-mono opacity-80 mt-0.5 leading-none font-normal">
                        Mulai 07:00
                      </span>
                    </button>

                    <button
                      onClick={() => handleMobileAttendance("pulang")}
                      className="bg-rose-500 hover:bg-rose-600 text-white font-extrabold py-3.5 rounded-3xl shadow-md transition flex flex-col items-center justify-center text-center group border border-rose-400"
                    >
                      <Clock
                        size={18}
                        className="mb-1 text-gray-800 group-hover:scale-105"
                      />
                      <span className="text-[10px] uppercase tracking-wide">
                        ABSEN PULANG
                      </span>
                      <span className="text-[8px] font-mono opacity-80 mt-0.5 leading-none font-normal">
                        Mulai 16:00
                      </span>
                    </button>
                  </div>

                  {/* THREE QUICK CIRCULAR TAB OPTIONS */}
                  <div className="bg-white p-2.5 rounded-3xl grid grid-cols-3 gap-1 text-center text-gray-800 dark:text-slate-150 shadow-md">
                    <button
                      onClick={() => setMobileTab("kinerja")}
                      className="p-1.5 flex flex-col items-center hover:bg-white/5 rounded-2xl transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-slate-800 text-[#1d74f2] flex items-center justify-center mb-1 border border-blue-100">
                        <FileText size={16} />
                      </div>
                      <span className="text-[10px] font-bold">Kinerja</span>
                    </button>

                    <button
                      onClick={() => setMobileTab("cuti")}
                      className="p-1.5 flex flex-col items-center hover:bg-white/5 rounded-2xl transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-slate-800 text-emerald-600 flex items-center justify-center mb-1 border border-emerald-100">
                        <Calendar size={16} />
                      </div>
                      <span className="text-[10px] font-bold">Izin/Cuti</span>
                    </button>

                    <button
                      onClick={() => setMobileTab("bantuan")}
                      className="p-1.5 flex flex-col items-center hover:bg-white/5 rounded-2xl transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-slate-800 text-indigo-600 flex items-center justify-center mb-1 border border-indigo-100">
                        <HelpCircle size={16} />
                      </div>
                      <span className="text-[10px] font-bold">Bantuan</span>
                    </button>
                  </div>

                  {/* RED CRITICAL DISCIPLINARY WARNING */}
                  <div className="bg-[#ea4335]/15 border border-red-200 rounded-3xl p-3.5 flex gap-2.5 text-[10px] text-red-800 dark:text-red-300">
                    <AlertTriangle
                      size={18}
                      className="text-red-600 shrink-0 mt-0.5 animate-pulse"
                    />
                    <div>
                      <p className="font-extrabold text-[11px] leading-tight text-[#ea4335]">
                        🛑 Pelanggaran Disiplin Terdeteksi!
                      </p>
                      <p className="mt-1 leading-relaxed opacity-95">
                        &quot;Anda Sudah Tidak Masuk Sebanyak 15 kali!
                        Pemotongan Tunjangan Kinerja Sebesar 25% Selama 9
                        Bulan.&quot;
                      </p>
                    </div>
                  </div>

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
                        Aturan Pokok Disiplin Guru & Staf Yayasan dan Madrasah
                        tentang Kewajiban Presensi Kerja
                      </h4>
                      <p className="text-[9px] text-gray-500 mt-0.5">
                        Diterbitkan: 28 Juni 2023
                      </p>
                      <div className="h-px bg-white/5 my-2" />
                      <p className="text-[10px] text-gray-500 leading-relaxed font-sans">
                        Yayasan dan Kementerian Agama menegaskan bahwa pelanggaran rekap
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
                  <div className="bg-white p-4 rounded-3xl shadow-md">
                    <h3 className="font-black text-gray-800 text-xs uppercase tracking-wide">
                      Absen Mandiri (GPS)
                    </h3>
                    <p className="text-[10px] text-gray-500 mt-1 mb-4 leading-relaxed">
                      Sistem akan mengambil koordinat GPS HP Anda untuk validasi
                      jarak radius aman ke lingkungan {school.name}.
                    </p>

                    <div className="space-y-4 font-sans text-xs">
                      {/* Simulated Check In state */}
                      <div className="bg-white/5 dark:bg-slate-950 p-3 rounded-xl border border-gray-200 space-y-2">
                        <p className="text-[10px] font-bold text-gray-500">
                          STATUS SEBELUMNYA
                        </p>
                        <div className="grid grid-cols-[100px_1fr] gap-x-1 text-[11px] font-medium text-gray-700">
                          <div>Lokasi Kerja</div>
                          <div>: {school.name}</div>
                          <div>Radius Batas</div>
                          <div className="text-emerald-600 font-bold">
                            : {school.radius || 120} Meter
                          </div>
                          <div>Status Hari Ini</div>
                          <div className="font-bold">
                            :{" "}
                            {attendance.filter(
                              (a) =>
                                a.date === format(new Date(), "yyyy-MM-dd") &&
                                a.userId === user?.id,
                            ).length > 0
                              ? "Sudah Hadir"
                              : "Menunggu Absensi"}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <button
                          onClick={() => handleMobileAttendance("masuk")}
                          className="w-full bg-[#1d74f2] hover:bg-blue-700 py-2.5 text-white font-extrabold rounded-2xl text-[10px] uppercase shadow-md shrink-0"
                        >
                          📥 Melakukan Absen Masuk
                        </button>
                        <button
                          onClick={() => handleMobileAttendance("pulang")}
                          className="w-full bg-[#ea4335] hover:bg-rose-600 py-2.5 text-white font-extrabold rounded-2xl text-[10px] uppercase shadow-md shrink-0"
                        >
                          📤 Melakukan Absen Pulang
                        </button>
                      </div>
                    </div>
                  </div>
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
                          <option value="Izin">Izin (Urusan Mendesak)</option>
                          <option value="Sakit">
                            Sakit (Kondisi Kesehatan)
                          </option>
                          <option value="Cuti Tahunan">Cuti Tahunan Yayasan</option>
                          <option value="Dinas/Lainnya">
                            Dinas Keluar Kantor
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

                    <button
                      onClick={() =>
                        toast.success("Data Riwayat telah difilter!")
                      }
                      className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                    >
                      Filter Data Riwayat
                    </button>

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
                        {attendance.filter((a) => a.userId === user?.id)
                          .length === 0 ? (
                          <div className="p-4 text-center text-gray-500">
                            Belum ada kunjungan bulan ini.
                          </div>
                        ) : (
                          attendance
                            .filter((a) => a.userId === user?.id)
                            .map((item) => (
                              <div
                                key={item.id}
                                className="py-2 px-2.5 grid grid-cols-12 gap-1 items-center hover:bg-white/5"
                              >
                                <span className="col-span-3 text-left font-bold text-gray-800">
                                  {format(new Date(item.date), "dd-MM")}
                                </span>
                                <span className="col-span-3 text-center font-mono">
                                  {item.checkInTime || "00:00:00"}
                                </span>
                                <span className="col-span-3 text-center font-mono">
                                  {item.checkOutTime || "00:00:00"}
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
                            ))
                        )}
                        {/* Static fallback list similar to screenshot on Page 5 */}
                        <div className="py-2 px-2.5 grid grid-cols-12 gap-1 items-center opacity-40">
                          <span className="col-span-3 text-left font-bold font-sans text-gray-800">
                            20-06
                          </span>
                          <span className="col-span-3 text-center font-mono">
                            00:00:00
                          </span>
                          <span className="col-span-3 text-center font-mono">
                            00:00:00
                          </span>
                          <span className="col-span-3 text-center">
                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-rose-100 text-rose-700">
                              Libur
                            </span>
                          </span>
                        </div>
                        <div className="py-2 px-2.5 grid grid-cols-12 gap-1 items-center opacity-40">
                          <span className="col-span-3 text-left font-bold font-sans text-gray-800">
                            19-06
                          </span>
                          <span className="col-span-3 text-center font-mono">
                            00:00:00
                          </span>
                          <span className="col-span-3 text-center font-mono">
                            00:00:00
                          </span>
                          <span className="col-span-3 text-center">
                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-white/5 text-gray-800/90">
                              Tidak Hadir
                            </span>
                          </span>
                        </div>
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

              {/* TAB 7: PROFILE */}
              {mobileTab === "profil" && (
                <div className="space-y-4 animate-fade-in text-left">
                  <div className="bg-white p-4 rounded-3xl shadow-md text-xs font-sans">
                    <h3 className="font-black text-gray-800 text-xs uppercase tracking-wide">
                      Profil Pegawai Mandiri
                    </h3>

                    <div className="space-y-3 mt-4 text-gray-700">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-500">
                          Nama Lengkap
                        </span>
                        <p className="font-bold text-gray-800 text-xs">
                          {user?.name}
                        </p>
                      </div>
                      <div className="h-px bg-white/5" />

                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-500">
                          NUPTK / NRG / PegID / NPK
                        </span>
                        <p className="font-mono text-gray-600 dark:text-slate-300 text-xs">
                          {user?.nip || "198001012005011001"}
                        </p>
                      </div>
                      <div className="h-px bg-white/5" />

                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-500">
                          Lembaga Induk
                        </span>
                        <p className="font-semibold text-gray-700 text-xs">
                          {user?.opd || "Kementerian Agama"}
                        </p>
                      </div>
                      <div className="h-px bg-white/5" />

                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-500">
                          Satuan Kerja / Madrasah
                        </span>
                        <p className="font-semibold text-gray-700 text-[11px] leading-relaxed">
                          {user?.satuanKerja || school.name}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </main>

            {/* MOCK SMARTPHONE BOTTOM NAVIGATION BUTTONS */}
            <div className="bg-white border-t border-gray-100 py-2.5 px-4 flex justify-between items-center text-gray-500 shrink-0 select-none">
              <button
                onClick={() => setMobileTab("home")}
                className={`flex flex-col items-center gap-0.5 justify-center flex-1 ${mobileTab === "home" ? "text-purple-600 font-black scale-105 transition-all" : "opacity-65 hover:opacity-100"}`}
              >
                <Smartphone size={15} />
                <span className="text-[8px] font-sans">Beranda</span>
              </button>

              <button
                onClick={() => setMobileTab("scan")}
                className={`flex flex-col items-center gap-0.5 justify-center flex-1 ${mobileTab === "scan" ? "text-purple-600 font-black scale-105 transition-all" : "opacity-65 hover:opacity-100"}`}
              >
                <Clock size={15} />
                <span className="text-[8px] font-sans">Absensi</span>
              </button>

              <button
                onClick={() => setMobileTab("kinerja")}
                className={`flex flex-col items-center gap-0.5 justify-center flex-1 ${mobileTab === "kinerja" ? "text-purple-600 font-black scale-105 transition-all" : "opacity-65 hover:opacity-100"}`}
              >
                <FileText size={15} />
                <span className="text-[8px] font-sans">Kinerja</span>
              </button>

              <button
                onClick={() => setMobileTab("cuti")}
                className={`flex flex-col items-center gap-0.5 justify-center flex-1 ${mobileTab === "cuti" ? "text-purple-600 font-black scale-105 transition-all" : "opacity-65 hover:opacity-100"}`}
              >
                <Calendar size={15} />
                <span className="text-[8px] font-sans">Izin/Cuti</span>
              </button>

              <button
                onClick={() => setMobileTab("riwayat")}
                className={`flex flex-col items-center gap-0.5 justify-center flex-1 ${mobileTab === "riwayat" ? "text-purple-600 font-black scale-105 transition-all" : "opacity-65 hover:opacity-100"}`}
              >
                <FileSpreadsheet size={15} />
                <span className="text-[8px] font-sans">Riwayat</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
