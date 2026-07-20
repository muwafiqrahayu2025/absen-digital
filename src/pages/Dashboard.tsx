import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../components/AuthContext";
import { useEditMode } from '../components/EditModeContext';
import { useGlobalStore } from '../lib/store';
import { db } from "../lib/db";
import { NotificationService } from "../lib/notifications";
import { EditableText } from "../components/EditableText";
import { ModernQRScanner } from "../components/ModernQRScanner";
import { BiometricSelfie } from "../components/BiometricSelfie";
import { analyzeLocationTelemetry } from "../lib/securityGuard";
import {
  format,
  subDays,
  isWithinInterval,
  parseISO,
  endOfMonth,
} from "date-fns";
import { id } from "date-fns/locale";
import { Users, FileText, CheckCircle, Clock, Download, Building, Layers, Briefcase, AlertTriangle, MapPin, Smartphone, Calendar, FileSpreadsheet, Send, HelpCircle, Award, ChevronRight, Menu, Bell, Search, BookOpen, Filter, CheckCircle2, XCircle, Moon, Sun, UserCheck, LayoutDashboard, Save, X, Plus, QrCode, UserCircle, BarChart2, ScanLine } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import toast from "react-hot-toast";
import { getDashboardTemplate, getSavedDashboardTemplateId } from "../lib/dashboardTemplates";
import { WindowControls } from "../components/WindowControls";
import { ProfileTabContent } from "../components/ProfileTabContent";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useFirebaseSync } from "../hooks/useFirebaseSync";
import { useFirebaseData } from "../hooks/useFirebaseData";
import { useGlobalSettings } from "../hooks/useGlobalSettings";

export function Dashboard() {
  useDocumentTitle("Dasbor Eksekutif");
  const { user, logout } = useAuth();
  const { data: schoolData, isOffline: isOfflineSchool } = useFirebaseData('school');
  const { data: usersData, isOffline: isOfflineUsers } = useFirebaseData('users');
  const { data: attendanceData } = useFirebaseData('attendance');
  const { data: opdsData } = useFirebaseData('opds');
  const { data: satuanKerjasData } = useFirebaseData('satuankerja');
  const { data: jabatansData } = useFirebaseData('jabatans');
  const { data: cutiRequestsData } = useFirebaseData('cuti_requests');
  const { data: kinerjasData } = useFirebaseData('kinerjas');

  const [school, setSchool] = useState<any>({});
  const [users, setUsers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [opds, setOpds] = useState<any[]>([]);
  const [satuanKerjas, setSatuanKerjas] = useState<any[]>([]);
  const [jabatans, setJabatans] = useState<any[]>([]);
  const [cutiRequests, setCutiRequests] = useState<any[]>([]);
  const [kinerjas, setKinerjas] = useState<any[]>([]);

  useEffect(() => {
    if (schoolData) setSchool(schoolData);
    if (usersData) setUsers(Object.values(usersData));
    
    if (attendanceData) {
      const cloudAtt = Object.values(attendanceData) as any[];
      const localAtt = db.getAttendance().filter((a: any) => !a.isSynced);
      
      const allMap = new Map();
      cloudAtt.forEach(c => allMap.set(c.id, c));
      localAtt.forEach(l => {
        if (!allMap.has(l.id)) allMap.set(l.id, l);
      });
      setAttendance(Array.from(allMap.values()).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } else {
      setAttendance(db.getAttendance());
    }

    if (opdsData) setOpds(Object.values(opdsData));
    if (satuanKerjasData) setSatuanKerjas(Object.values(satuanKerjasData));
    if (jabatansData) setJabatans(Object.values(jabatansData));
    if (cutiRequestsData) setCutiRequests(Object.values(cutiRequestsData));
    if (kinerjasData) setKinerjas(Object.values(kinerjasData));
  }, [schoolData, usersData, attendanceData, opdsData, satuanKerjasData, jabatansData, cutiRequestsData, kinerjasData]);

  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);

  const [scanStep, setScanStep] = useState(1);
  const [pendingQrData, setPendingQrData] = useState<{ decodedText: string, method: string } | null>(null);

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

    const currentSchool = db.getSchool();
    const hasNotifApi = !!(currentSchool.gasWebAppUrl || currentSchool.whatsappApiKey);
    
    const teachers = users.filter(u => u.role !== 'admin');
    
    if (!hasNotifApi) {
      if (!globalSettingsLoading && globalSettings.wa_fallback_enabled) {
        setWaFallbackMessage(broadcastMessage);
        setWaFallbackModalOpen(true);
        return;
      }
      toast("⚠️ API Notifikasi Belum Dikonfigurasi\n\nPesan siaran tidak dapat dikirim via WhatsApp/Email.", { icon: "🔧", duration: 7000 });
    }

    setBroadcastSending(true);
    teachers.forEach(t => {
      NotificationService.send(t, 'BROADCAST_MESSAGE', { extraInfo: broadcastMessage });
    });

    if (hasNotifApi) {
      toast.success(`Pengumuman berhasil disiarkan ke ${teachers.length} Guru/Staf!`);
    } else {
      toast.success(`Siaran dalam aplikasi terkirim ke ${teachers.length} pengguna.`);
    }
    setBroadcastMessage("");
    setTimeout(() => setBroadcastSending(false), 3000);
  };

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (user && user.role !== 'admin') {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const hasCheckedIn = db.getAttendance().some(a => a.date === todayStr && a.userId === user.id);
      const reminderKey = `reminder_sent_${todayStr}_${user.id}`;

      if (!hasCheckedIn && !sessionStorage.getItem(reminderKey)) {
        timeoutId = setTimeout(() => {
          NotificationService.send(user, 'ATTENDANCE_REMINDER');
        }, 3000);
        sessionStorage.setItem(reminderKey, "true");
      }
    }
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [user]);

  const [mobileTab, setMobileTab] = useState<"home" | "scan" | "cuti" | "kinerja" | "riwayat" | "profil">("home");
  const [activeQrMode, setActiveQrMode] = useState<"check_in" | "check_out" | null>(null);

  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    if (tab === "cuti" || tab === "kinerja" || tab === "scan" || tab === "riwayat") {
      setMobileTab(tab as any);
    }
  }, [location.search]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentGps, setCurrentGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const todayRec = useMemo(() => attendance.find((a) => a.date === todayStr && a.userId === user?.id), [attendance, todayStr, user?.id]);
  const hasIn = !!todayRec?.checkInTime;
  const hasOut = !!todayRec?.checkOutTime;

  // DI SINI SUDAH KITA SAMBUNGKAN KE DATABASE UI
  const checkInLimitRaw = school.operationalCheckInLimit || "07:00";
  const checkOutLimitRaw = (school as any).operationalCheckOutLimit || "15:30";

  const checkInLimitFull = checkInLimitRaw.length === 5 ? checkInLimitRaw + ":00" : checkInLimitRaw;
  const isLate = hasIn ? todayRec!.checkInTime! > checkInLimitFull : false;

  const [kinerjaDate, setKinerjaDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [kinerjaTupoksi, setKinerjaTupoksi] = useState("");
  const [kinerjaUraian, setKinerjaUraian] = useState("");
  const [kinerjaSatuan, setKinerjaSatuan] = useState("Laporan");
  const [kinerjaJumlah, setKinerjaJumlah] = useState(1);

  const [cutiJenis, setCutiJenis] = useState<"Cuti Tahunan" | "Izin" | "Sakit" | "Dinas/Lainnya">("Izin");
  const [cutiMulai, setCutiMulai] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cutiSelesai, setCutiSelesai] = useState(format(new Date(), "yyyy-MM-dd"));
  const [cutiAlasan, setCutiAlasan] = useState("");
  const [cutiFile, setCutiFile] = useState("");

  const [showAddOPD, setShowAddOPD] = useState(false);
  const [newOPDSingkatan, setNewOPDSingkatan] = useState("");
  const [newOPDNama, setNewOPDNama] = useState("");
  const [showAddSatker, setShowAddSatker] = useState(false);
  const [newSatkerSingkatan, setNewSatkerSingkatan] = useState("");
  const [newSatkerNama, setNewSatkerNama] = useState("");
  const [newSatkerOpd, setNewSatkerOpd] = useState("");
  
  const { waFallbackModalOpen, setWaFallbackModalOpen, waFallbackMessage, setWaFallbackMessage } = useGlobalStore();
  
  const { settings: globalSettings, loading: globalSettingsLoading } = useGlobalSettings();

  useEffect(() => {
    const handleFirebaseSync = () => {
      const localAtt = db.getAttendance().filter((a: any) => !a.isSynced);
      if (attendanceData) {
        const cloudAtt = Object.values(attendanceData) as any[];
        const allMap = new Map();
        cloudAtt.forEach(c => allMap.set(c.id, c));
        localAtt.forEach(l => {
          if (!allMap.has(l.id)) allMap.set(l.id, l);
        });
        setAttendance(Array.from(allMap.values()).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } else {
        setAttendance(db.getAttendance());
      }
    };
    window.addEventListener("attendance_synchronized", handleFirebaseSync);
    return () => window.removeEventListener("attendance_synchronized", handleFirebaseSync);
  }, [attendanceData]);

  const handleCreateOPD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOPDSingkatan || !newOPDNama) return;
    
    const updated = [...opds, { id: String(opds.length + 1), singkatan: newOPDSingkatan.toUpperCase(), nama: newOPDNama.toUpperCase() }];
    
    // Lazy load the ref to avoid adding many imports inside this chunk
    const { ref, set } = await import('firebase/database');
    const { dbRealtime } = await import('../lib/firebase');
    
    const obj = updated.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
    
    const fullRef = getTenantRef('opds');
    console.log("=== DEBUG YAYASAN/OPD SAVE (DASHBOARD) ===");
    console.log("PATH REF: ", fullRef.toString());
    
    try {
      await set(fullRef, obj);
      setNewOPDNama(""); setNewOPDSingkatan(""); setShowAddOPD(false);
      toast.success("Berhasil menambahkan OPD baru!");
    } catch (error: any) {
      console.error("FIREBASE ERROR ON SAVE OPD (DASHBOARD):", error);
      toast.error(`Akses Ditolak (Dashboard OPD)!`);
    }
  };

  const handleCreateSatker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSatkerSingkatan || !newSatkerNama) return;
    const updated = [...satuanKerjas, { id: String(satuanKerjas.length + 1), singkatan: newSatkerSingkatan.toUpperCase(), nama: newSatkerNama.toUpperCase(), opdId: newSatkerOpd }];
    const obj = updated.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
    
    const { set } = await import('firebase/database');
    
    const fullRef = getTenantRef('satuanKerjas');
    console.log("=== DEBUG SATKER SAVE (DASHBOARD) ===");
    console.log("PATH REF: ", fullRef.toString());
    
    try {
      await set(fullRef, obj);
      setNewSatkerNama(""); setNewSatkerSingkatan(""); setShowAddSatker(false);
      toast.success("Berhasil menambahkan Satuan Kerja!");
    } catch (error: any) {
      console.error("FIREBASE ERROR ON SAVE SATKER (DASHBOARD):", error);
      toast.error(`Akses Ditolak (Dashboard Satker)!`);
    }
  };

  const handleKinerjaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kinerjaTupoksi) { toast.error("Silakan isi Tupoksi Terkait!"); return; }
    if (!kinerjaUraian) { toast.error("Silakan isi Uraian Kegiatan!"); return; }
    const updated = [{ id: String(Date.now()), userId: user?.id || "2", tanggal: kinerjaDate, tupoksi: kinerjaTupoksi, uraian: kinerjaUraian, satuan: kinerjaSatuan, jumlahDokumen: Number(kinerjaJumlah) }, ...kinerjas];
    
    const { ref, set } = await import('firebase/database');
    const { dbRealtime } = await import('../lib/firebase');
    
    const obj = updated.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
    await set(getTenantRef('kinerjas'), obj);
    
    setKinerjaTupoksi(""); setKinerjaUraian(""); setKinerjaJumlah(1);
    toast.success("Laporan Kinerja harian berhasil disubmit!");
  };

  const handleCutiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cutiAlasan) { toast.error("Alasan pengajuan wajib diisi!"); return; }
    const updated = [{ id: String(Date.now()), userId: user?.id || "2", jenis: cutiJenis, tanggalMulai: cutiMulai, tanggalSelesai: cutiSelesai, alasan: cutiAlasan, status: "Pending" as const, dokumenUrl: cutiFile || undefined }, ...cutiRequests];
    
    const { ref, set } = await import('firebase/database');
    const { dbRealtime } = await import('../lib/firebase');
    
    const obj = updated.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
    await set(getTenantRef('cuti_requests'), obj);
    
    setCutiAlasan(""); setCutiFile("");
    toast.success("Pengajuan Cuti/Izin berhasil dikirim!");
  };

  const handleMobileAttendance = async (
    type: "masuk" | "pulang",
    scannedBarcode?: string,
    scanMethod: string = "scanner",
    photoDataUrl?: string
  ) => {
    const timeStr = format(new Date(), "HH:mm:ss");
    const dbSchool = db.getSchool();
    const schoolLat = dbSchool.latitude || -6.200000;
    const schoolLng = dbSchool.longitude || 106.816666;
    const allowedRadius = dbSchool.radius || 120;

    const getPosition = (): Promise<GeolocationPosition> =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error("GPS tidak didukung.")); return; }
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
      });

    let userLat = schoolLat;
    let userLng = schoolLng;

    if (!scannedBarcode) {
      setGpsLoading(true);
      try {
        const pos = await getPosition();
        const securityCheck = analyzeLocationTelemetry(pos);
        if (!securityCheck.isClean) {
          toast.error(`⚠️ Anomali GPS!\n${securityCheck.violations[0]}`, { duration: 8000 });
          setGpsLoading(false); return;
        }
        userLat = pos.coords.latitude; userLng = pos.coords.longitude;
        setCurrentGps({ lat: userLat, lng: userLng });
      } catch (err: any) {
        setGpsLoading(false);
        toast.error("Gagal mendapat GPS.", { duration: 6000 }); return;
      } finally { setGpsLoading(false); }
    } else if (currentGps) {
      userLat = currentGps.lat; userLng = currentGps.lng;
    }

    const R = 6371e3;
    const phi1 = (userLat * Math.PI) / 180;
    const phi2 = (schoolLat * Math.PI) / 180;
    const deltaPhi = ((schoolLat - userLat) * Math.PI) / 180;
    const deltaLambda = ((schoolLng - userLng) * Math.PI) / 180;
    const aDist = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const distanceMeters = Math.round(R * 2 * Math.atan2(Math.sqrt(aDist), Math.sqrt(1 - aDist)));

    if (!scannedBarcode && distanceMeters > allowedRadius) {
      toast.error(`Jarak Anda ${distanceMeters}m (batas: ${allowedRadius}m). Di luar area instansi.`, { duration: 7000 }); return;
    }

    let records = [...attendance];
    if (type === "masuk") {
      if (todayRec?.checkInTime) { toast.error("Sudah absen masuk."); return; }
      const isLateStatus = timeStr > checkInLimitFull;
      const record: any = { id: String(Date.now()), userId: user?.id || "", date: todayStr, checkInTime: timeStr, status: (isLateStatus ? "Terlambat" : "Hadir") as any, isSynced: false, syncStatus: "pending" as const, latitude: userLat, longitude: userLng, distance: distanceMeters, method: scanMethod as any };
      if (photoDataUrl) record.photoUrl = photoDataUrl;
      if (scannedBarcode) record.qrBarcodeData = scannedBarcode;
      records = [record, ...records];
      toast.success(`Absen masuk berhasil — ${timeStr}.`);
    } else {
      if (!todayRec) { toast.error("Lakukan absen masuk dahulu."); return; }
      if (todayRec.checkOutTime) { toast.error("Sudah absen pulang."); return; }
      const targetIdx = records.findIndex((r) => r.id === todayRec.id);
      if (targetIdx !== -1) {
        records[targetIdx] = { ...records[targetIdx], checkOutTime: timeStr, latitude: userLat, longitude: userLng, distance: distanceMeters, method: scanMethod as any };
        if (photoDataUrl) (records[targetIdx] as any).photoUrl = photoDataUrl;
        if (scannedBarcode) (records[targetIdx] as any).qrBarcodeData = scannedBarcode;
      }
      toast.success(`Absen pulang berhasil — ${timeStr}.`);
    }

    await db.setAttendance(records);
    setAttendance(records);
    window.dispatchEvent(new Event("attendance_synchronized"));
    setMobileTab("home");
  };

  const statsData = {
    pegawai: users.filter((u) => u.role !== "admin" && u.role !== "developer").length,
    opd: opds.length, satker: satuanKerjas.length, jabatan: jabatans.length,
    hadir: attendance.filter((a) => a.date === todayStr && (a.status === "Hadir" || a.status === "Terlambat")).length,
    alpha: attendance.filter((a) => a.date === todayStr && a.status === "Alpha").length,
    sakit: attendance.filter((a) => a.date === todayStr && a.status === "Sakit").length,
    izin: attendance.filter((a) => a.date === todayStr && (a.status === "Izin" || a.status === "Cuti Tahunan")).length,
    dinas: attendance.filter((a) => a.date === todayStr && a.status === "Dinas/Lainnya").length,
  };

  const renderDetailStatusCard = () => (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden font-sans">
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-indigo-600" />
          <span className="text-[12px] font-black text-slate-700">Tanggal</span>
        </div>
        <span className="text-[12px] font-bold text-slate-700">{format(new Date(), "EEEE, dd MMMM yyyy", { locale: id })}</span>
      </div>

      <div className="p-4 space-y-3.5">
        <div className="flex justify-between items-center text-[11px]">
          <div className="flex items-center gap-2 text-slate-500 font-bold"><CheckCircle2 size={14} className="text-indigo-500" /> Status</div>
          <div className="font-bold text-slate-800">Normal</div>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <div className="flex items-center gap-2 text-slate-500 font-bold"><Clock size={14} className="text-indigo-500" /> Jadwal</div>
          <div className="font-bold text-slate-800 text-right max-w-[180px] truncate">Skema Reguler 5 Hari Kerja</div>
        </div>
        <div className="border-t border-dashed border-slate-200 my-2"></div>
        <div className="flex justify-between items-center text-[11px]">
          <div className="flex items-center gap-2 text-slate-500 font-bold"><ScanLine size={14} className="text-indigo-500" /> Masuk</div>
          <div className="font-bold text-slate-800 flex items-center gap-1">{format(new Date(), "dd MMMM yyyy", { locale: id })} <Clock size={12} className="text-rose-500 ml-1" /> {checkInLimitRaw}</div>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <div className="flex items-center gap-2 text-slate-500 font-bold"><Clock size={14} className="text-indigo-500" /> Tap Masuk</div>
          <div className="font-bold text-slate-800 flex items-center gap-1">{hasIn ? format(new Date(), "dd MMMM yyyy", { locale: id }) : "-"} <Clock size={12} className="text-rose-500 ml-1" /> {hasIn ? todayRec!.checkInTime!.substring(0, 5) : "-"}</div>
        </div>

        {hasIn ? (
          <div className={`w-full py-2.5 rounded-xl text-center text-[12px] font-black text-white shadow-sm flex items-center justify-center gap-1.5 ${isLate ? "bg-rose-500" : "bg-emerald-500"}`}>
            <CheckCircle2 size={16} /> {isLate ? "Terlambat" : "Tepat Waktu"}
          </div>
        ) : (
          <div className="w-full py-2.5 rounded-xl text-center text-[12px] font-black text-white shadow-sm flex items-center justify-center gap-1.5 bg-slate-300">
            Belum Tap Masuk
          </div>
        )}

        <div className="border-t border-dashed border-slate-200 my-2"></div>

        <div className="flex justify-between items-center text-[11px]">
          <div className="flex items-center gap-2 text-slate-500 font-bold"><ScanLine size={14} className="text-indigo-500" /> Pulang</div>
          <div className="font-bold text-slate-800 flex items-center gap-1">{format(new Date(), "dd MMMM yyyy", { locale: id })} <Clock size={12} className="text-rose-500 ml-1" /> {checkOutLimitRaw}</div>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <div className="flex items-center gap-2 text-slate-500 font-bold"><Clock size={14} className="text-indigo-500" /> Tap Pulang</div>
          <div className="font-bold text-slate-800 flex items-center gap-1">{hasOut ? format(new Date(), "dd MMMM yyyy", { locale: id }) : "-"} <Clock size={12} className="text-rose-500 ml-1" /> {hasOut ? todayRec!.checkOutTime!.substring(0, 5) : "-"}</div>
        </div>

        {hasOut ? (
          <div className="w-full py-2.5 rounded-xl text-center text-[12px] font-black text-white shadow-sm flex items-center justify-center gap-1.5 bg-emerald-500">
            <CheckCircle2 size={16} /> Sudah Pulang
          </div>
        ) : (
          <div className="w-full py-2.5 rounded-xl text-center text-[12px] font-black text-white shadow-sm flex items-center justify-center gap-1.5 bg-[#4c84ff]">
            <ScanLine size={16} /> Belum Tap Pulang
          </div>
        )}
      </div>
    </div>
  );

  // =========================================================================
  // ADMIN DASHBOARD
  // =========================================================================
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

    return (
      <div className="space-y-6 animate-fade-in pb-12">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
          <div>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">Halo, {user?.name}! 👋</h2>
            <p className="text-gray-500 mt-1 text-sm font-medium">Ringkasan aktivitas hari ini di <strong className="text-indigo-600">{school.name}</strong>.</p>
          </div>
        </div>

        {user?.role === "developer" && (
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-amber-500/40 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black uppercase tracking-wider">
                ⚙️ AKSES EKSKLUSIF PENGEMBANG
              </div>
              <h3 className="text-xl font-black text-white">SaaS Developer Console</h3>
            </div>
            <Link to="/admin/developer" className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/30 transition-all">Buka Developer Console</Link>
          </div>
        )}

        <div className="bg-white border rounded-2xl p-5 mb-8 flex flex-col md:flex-row gap-4 items-center shadow-[0_4px_20px_rgb(0,0,0,0.06)]">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><Send className="text-blue-600" size={20} /></div>
          <div className="flex-1 w-full">
            <h3 className="font-bold text-blue-900 text-sm mb-1">Siaran Pengumuman Massal (Broadcast)</h3>
            <div className="flex gap-2 w-full">
              <input type="text" value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} placeholder="Tulis pengumuman untuk semua guru/staf..." className="flex-1 border border-blue-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-100" />
              {(!db.getSchool().gasWebAppUrl && !db.getSchool().whatsappApiKey && !globalSettingsLoading && globalSettings.wa_fallback_enabled) ? (
                <button onClick={handleBroadcast} disabled={broadcastSending || !broadcastMessage.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md">Kirim via WA Web</button>
              ) : (
                <button onClick={handleBroadcast} disabled={broadcastSending} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md">{broadcastSending ? "Menyiarkan..." : "Siarkan"}</button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/admin/users" className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100 flex items-center gap-4 hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200 group">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white"><Users size={20} /></div>
            <div><p className="text-[11px] font-bold text-gray-400 group-hover:text-indigo-600 uppercase">Total Guru</p><p className="text-2xl font-black text-gray-800">{statsData.pegawai}</p></div>
          </Link>
          <Link to="/admin/attendance" className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100 flex items-center gap-4 hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200 group">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white"><CheckCircle size={20} /></div>
            <div><p className="text-[11px] font-bold text-gray-400 group-hover:text-orange-600 uppercase">Hadir Hari Ini</p><p className="text-2xl font-black text-gray-800">{statsData.hadir}</p></div>
          </Link>
          <Link to="/admin/leave" className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100 flex items-center gap-4 hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200 group">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center text-white"><FileText size={20} /></div>
            <div><p className="text-[11px] font-bold text-gray-400 group-hover:text-purple-600 uppercase">Izin / Cuti</p><p className="text-2xl font-black text-gray-800">{statsData.izin + statsData.sakit}</p></div>
          </Link>
          <Link to="/admin/school" className="bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100 flex items-center gap-4 hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200 group">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white"><Building size={20} /></div>
            <div><p className="text-[11px] font-bold text-gray-400 group-hover:text-amber-600 uppercase">Unit Sekolah</p><p className="text-2xl font-black text-gray-800">{statsData.satker}</p></div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 bg-white rounded-[1.5rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100">
            <h3 className="font-bold text-gray-800 text-sm mb-5">Aktivitas Presensi (7 Hari)</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                  <Bar dataKey="val" fill="url(#purpleGrad)" radius={[8, 8, 0, 0]} maxBarSize={30} />
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

          <div className="lg:col-span-3 bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100">
            <h3 className="font-bold text-gray-800 text-sm mb-4">Peringkat Kehadiran</h3>
            <div className="space-y-2.5">
              {adminLeaderboard.map((item, i) => (
                <div key={item.user.id} className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border border-transparent">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs">{i + 1}</div>
                  <div className="flex-1"><p className="text-xs font-bold text-gray-700">{item.user.name}</p></div>
                  <span className="text-sm font-black text-indigo-600">{item.score} <span className="text-[9px] font-normal">pts</span></span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white rounded-[1.5rem] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100">
            <h3 className="font-bold text-gray-800 text-sm mb-4">Status Presensi</h3>
            <div className="flex justify-center mb-4">
              <svg width="110" height="110" viewBox="0 0 110 110">
                <circle cx="55" cy="55" r="40" fill="none" stroke="#F3F4F6" strokeWidth="16" />
                <circle cx="55" cy="55" r="40" fill="none" stroke="#f97316" strokeWidth="16" strokeDasharray={`${hadirPct * 2.513} 251.3`} strokeDashoffset="0" strokeLinecap="round" transform="rotate(-90 55 55)" />
                <circle cx="55" cy="55" r="40" fill="none" stroke="#c4b5fd" strokeWidth="16" strokeDasharray={`${izinPct * 2.513} 251.3`} strokeDashoffset={`${-(hadirPct) * 2.513}`} strokeLinecap="round" transform="rotate(-90 55 55)" />
              </svg>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center"><span className="text-xs text-gray-500"><span className="w-2 h-2 inline-block bg-orange-500 rounded-full mr-1"></span>Hadir</span><span className="text-xs font-bold">{hadirPct}%</span></div>
              <div className="flex justify-between items-center"><span className="text-xs text-gray-500"><span className="w-2 h-2 inline-block bg-violet-300 rounded-full mr-1"></span>Izin/Cuti</span><span className="text-xs font-bold">{izinPct}%</span></div>
              <div className="flex justify-between items-center"><span className="text-xs text-gray-500"><span className="w-2 h-2 inline-block bg-violet-700 rounded-full mr-1"></span>Sakit</span><span className="text-xs font-bold">{sakitPct}%</span></div>
            </div>
          </div>
        </div>

        {/* LOG PRESENSI TERBARU (TABLE) */}
        <div className="bg-white rounded-[1.5rem] border border-gray-100 overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.06)]">
          <div className="p-5 flex justify-between items-center border-b border-gray-100">
            <h3 className="font-bold text-gray-800 text-sm">Log Presensi Terbaru</h3>
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
                  <tr><td colSpan={5} className="p-8 text-center text-gray-400">Belum ada log presensi.</td></tr>
                ) : (
                  attendance.slice(0, 8).map((record) => {
                    const teacher = users.find((u) => u.id === record.userId);
                    return (
                      <tr key={record.id} className="hover:bg-purple-50/30 transition">
                        <td className="p-4"><div className="font-bold text-gray-700">{format(new Date(record.date), "dd MMM yyyy")}</div><div className="text-[10px] text-purple-500 font-mono mt-0.5">{record.checkInTime ? `📥 ${record.checkInTime}` : `📤 ${record.checkOutTime || "—"}`}</div></td>
                        <td className="p-4"><div className="font-bold text-gray-700">{teacher?.name || "Pegawai"}</div></td>
                        <td className="p-4"><span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold text-[10px]">{record.method === "scanner" ? "📸 Kamera QR" : "🖼️ Upload"}</span></td>
                        <td className="p-4 text-center font-mono">{record.distance !== undefined ? `${record.distance}m` : "—"}</td>
                        <td className="p-4 text-right"><span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${record.status === "Hadir" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{record.status}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showAddOPD && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl">
              <h3 className="text-lg font-black text-gray-800 mb-4">Tambah OPD</h3>
              <form onSubmit={handleCreateOPD} className="space-y-4">
                <input type="text" value={newOPDSingkatan} onChange={(e) => setNewOPDSingkatan(e.target.value)} placeholder="Singkatan" className="w-full px-4 py-2.5 border rounded-xl" required />
                <input type="text" value={newOPDNama} onChange={(e) => setNewOPDNama(e.target.value)} placeholder="Nama Lengkap" className="w-full px-4 py-2.5 border rounded-xl" required />
                <div className="flex gap-2 justify-end"><button type="button" onClick={() => setShowAddOPD(false)} className="px-4 py-2 bg-gray-100 rounded-xl">Batal</button><button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-xl">Simpan</button></div>
              </form>
            </div>
          </div>
        )}
        {showAddSatker && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl">
              <h3 className="text-lg font-black text-gray-800 mb-4">Tambah Satuan Kerja</h3>
              <form onSubmit={handleCreateSatker} className="space-y-4">
                <input type="text" value={newSatkerSingkatan} onChange={(e) => setNewSatkerSingkatan(e.target.value)} placeholder="Singkatan" className="w-full px-4 py-2.5 border rounded-xl" required />
                <input type="text" value={newSatkerNama} onChange={(e) => setNewSatkerNama(e.target.value)} placeholder="Nama Lengkap" className="w-full px-4 py-2.5 border rounded-xl" required />
                <select value={newSatkerOpd} onChange={(e) => setNewSatkerOpd(e.target.value)} className="w-full px-4 py-2.5 border rounded-xl">{opds.map(op => <option key={op.id} value={op.id}>{op.singkatan}</option>)}</select>
                <div className="flex gap-2 justify-end"><button type="button" onClick={() => setShowAddSatker(false)} className="px-4 py-2 bg-gray-100 rounded-xl">Batal</button><button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-xl">Simpan</button></div>
              </form>
            </div>
          </div>
        )}
        
        {/* MODAL WA FALLBACK BROADCAST */}
        {waFallbackModalOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] max-w-xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Kirim Siaran via WA Web</h3>
                    <p className="text-xs text-slate-500">Pilih kontak untuk mengirim pesan ini secara manual</p>
                  </div>
                </div>
                <button onClick={() => setWaFallbackModalOpen(false)} className="p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition">
                  <X size={18} />
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs mb-4 flex gap-3">
                <AlertTriangle className="shrink-0 text-amber-500 mt-0.5" size={16} />
                <div>
                  <strong className="block mb-0.5">Kirim Massal Terbatas</strong>
                  Tip: Gunakan API WhatsApp Gateway pada pengaturan Konsol Pengembang untuk mengirim pesan massal secara otomatis di latar belakang tanpa perlu klik satu per satu.
                </div>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-xl mb-4 border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Isi Pesan:</div>
                <div className="text-sm font-medium text-slate-800 whitespace-pre-wrap">{waFallbackMessage}</div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-2 custom-scrollbar">
                {users.filter(u => u.role !== 'admin').map((usr, i) => {
                  let phoneNumber = usr.phone || "";
                  if (phoneNumber.startsWith('0')) phoneNumber = '62' + phoneNumber.substring(1);
                  if (phoneNumber.startsWith('+')) phoneNumber = phoneNumber.substring(1);
                  
                  const isWaValid = phoneNumber && phoneNumber.length > 8;
                  const finalMsg = encodeURIComponent(`*PENGUMUMAN INSTITUSI*\n\nHalo ${usr.name},\n\n${waFallbackMessage}\n\n_Pesan otomatis dari Sistem Kepegawaian_`);
                  const waLink = `https://wa.me/${phoneNumber}?text=${finalMsg}`;
                  
                  return (
                    <div key={usr.id || i} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:border-emerald-200 transition">
                      <div>
                        <div className="font-bold text-sm text-slate-800">{usr.name}</div>
                        <div className="text-xs text-slate-500">{usr.phone || "Tidak ada nomor"}</div>
                      </div>
                      {isWaValid ? (
                        <a 
                          href={waLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                        >
                          <Send size={14} /> Kirim
                        </a>
                      ) : (
                        <span className="px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-[10px] font-bold">Nomor Invalid</span>
                      )}
                    </div>
                  );
                })}
                {users.filter(u => u.role !== 'admin').length === 0 && (
                  <div className="text-center p-6 text-slate-400 text-sm">Belum ada data pegawai/guru.</div>
                )}
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setWaFallbackModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold transition"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------
  // EMPLOYEE VIEW (MOCK SMARTPHONE SIMULATION)
  // ---------------------------------------------------------
  return (
    <div className={`w-full min-h-screen bg-[#F5F7FB] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between ${isDarkMode ? "dark" : ""}`}>
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col bg-[#F5F7FB] dark:bg-slate-950 select-none md:my-6 md:rounded-3xl md:border md:border-slate-200/80 dark:md:border-slate-800/80 md:shadow-2xl overflow-hidden relative isolate">

        <WindowControls />

        <header className="sticky top-8 z-30 mt-8 w-full bg-[#0f2b63] text-white px-4 sm:px-5 py-3.5 flex items-center justify-between shadow-md shrink-0 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <img
                src="/logo.png"
                alt="ABDI"
                className="w-full h-full object-contain drop-shadow-md"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = "/favicon.ico";
                }}
              />
            </div>
            <div className="text-left truncate">
              <h4 className="text-[13px] font-black tracking-widest leading-none truncate drop-shadow-sm">ABDI</h4>
              <span className="text-[8px] opacity-90 uppercase leading-none mt-0.5 block font-bold truncate">
                Absen Digital • {school.name}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center justify-center cursor-pointer">
              {isDarkMode ? <Sun size={15} className="text-amber-300" /> : <Moon size={15} className="text-white" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4 pb-6">
          <details className="bg-slate-900 dark:bg-slate-900/90 p-3 rounded-2xl text-slate-300 border border-slate-800 overflow-hidden shadow-sm text-xs mb-3">
            <summary className="font-extrabold text-[11px] uppercase tracking-wider text-yellow-400 flex items-center gap-1.5 cursor-pointer select-none">
              🛰️ Mode Simulasi GPS Satelit
            </summary>
            <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><p className="text-[10px] text-gray-400">Pilih lokasi GPS Anda untuk menguji geofencing:</p></div>
              <div className="col-span-2 flex gap-2 items-end">
                <button onClick={() => { setCurrentGps({ lat: -6.350397, lng: 106.8064598 }); toast.success("Lokasi disetel: Di Instansi (Aman)"); }} className="flex-1 py-2 text-[10px] bg-emerald-600 rounded-xl text-white">📍 Instansi (0m)</button>
                <button onClick={() => { setCurrentGps({ lat: -6.17511, lng: 106.82715 }); toast.error("Lokasi disetel: Monas (Di Luar)"); }} className="flex-1 py-2 text-[10px] bg-rose-600 rounded-xl text-white">📍 Luar Kota (19KM)</button>
              </div>
            </div>
          </details>

          {/* TAB 1: HOME PAGE */}
          {mobileTab === "home" && (
            <div className="space-y-4 animate-fade-in text-gray-800">
              <div className="relative overflow-hidden rounded-3xl shadow-xl" style={{ background: "linear-gradient(135deg, #0f2b63 0%, #1a3a8a 45%, #0d1f4a 100%)" }}>
                <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-white/5 -translate-y-16 translate-x-16 pointer-events-none" />
                <div className="relative p-5 flex flex-col items-center text-center">
                  <div className="w-full flex justify-end mb-2">
                    <div className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide">ONLINE</div>
                  </div>
                  <div className="relative mb-3">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-[3px] border-blue-400/60 shadow-[0_0_20px_rgba(96,165,250,0.4)] ring-4 ring-blue-500/20">
                      <img src={user?.photoUrl || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"} alt="Profil" className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <h3 className="font-black text-white text-base tracking-tight leading-tight drop-shadow-sm">{user?.name}</h3>
                  <p className="text-[10px] text-blue-200/80 font-mono mt-1">NIP: {user?.nip || user?.username}</p>
                  <span className="inline-flex mt-2.5 font-bold uppercase text-[9px] bg-amber-400 text-slate-900 px-3 py-1 rounded-full shadow-sm">💼 {user?.jabatan || "Guru Pengajar"}</span>
                  <div className="mt-3 w-full bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-4 py-2.5">
                    <p className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-300/90 mb-0.5">Satuan Pendidikan</p>
                    <p className="text-xs font-bold text-white leading-tight">{user?.satuanKerja || school.name}</p>
                  </div>
                </div>
              </div>

              {renderDetailStatusCard()}

              <div className="grid grid-cols-3 gap-3 pb-1 items-center">
                <button onClick={() => setMobileTab("riwayat")} className="bg-white hover:bg-slate-50 text-slate-700 font-extrabold py-3.5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center transition active:scale-95">
                  <div className="w-10 h-10 rounded-full bg-[#1da1f2]/10 text-[#1da1f2] flex items-center justify-center mb-1"><Users size={18} /></div><span className="text-[10px] font-black uppercase">Rekan</span>
                </button>
                <button
                  onClick={() => setMobileTab("scan")}
                  className="bg-[#1d74f2] hover:bg-blue-600 text-white font-extrabold py-4 rounded-[2rem] shadow-lg shadow-blue-500/30 flex flex-col items-center justify-center relative transform hover:-translate-y-1 transition active:scale-95"
                >
                  <div className="mb-1 text-white"><ScanLine size={24} strokeWidth={2.5} /></div><span className="text-[11px] uppercase font-black tracking-wider">ABSEN</span>
                </button>
                <button onClick={() => setMobileTab("kinerja")} className="bg-white hover:bg-slate-50 text-slate-700 font-extrabold py-3.5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center transition active:scale-95">
                  <div className="w-10 h-10 rounded-full bg-[#f2851d]/10 text-[#f2851d] flex items-center justify-center mb-1"><FileText size={18} /></div><span className="text-[10px] font-black uppercase">Laporan</span>
                </button>
              </div>

              <div className="bg-white rounded-3xl p-4 shadow-md">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200 mb-2">
                  <span className="text-[10px] font-extrabold uppercase text-indigo-600">Berita Terbaru</span>
                </div>
                <div className="space-y-1 text-left">
                  <h4 className="text-[11px] font-bold leading-snug">Aturan Pokok Disiplin Pegawai</h4>
                  <p className="text-[9px] text-gray-500">Diterbitkan: 28 Juni 2023</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MENU PRESENSI / SCAN */}
          {mobileTab === "scan" && (
            <div className="space-y-4 animate-fade-in text-left">

              {!activeQrMode ? (
                <div className="space-y-4">
                  {renderDetailStatusCard()}

                  <div className="grid grid-cols-2 gap-3 pb-1">
                    <button
                      onClick={() => { setActiveQrMode("check_in"); setScanStep(1); }}
                      className="bg-[#5c4fff] hover:bg-indigo-700 text-white font-extrabold py-5 rounded-[1.5rem] shadow-md flex flex-col items-center justify-center transition active:scale-95"
                    >
                      <ScanLine size={28} strokeWidth={2.5} className="mb-2" />
                      <span className="text-[12px] font-black uppercase tracking-wider">Absen Masuk</span>
                    </button>
                    <button
                      onClick={() => { setActiveQrMode("check_out"); setScanStep(1); }}
                      className="bg-[#ff2d55] hover:bg-rose-600 text-white font-extrabold py-5 rounded-[1.5rem] shadow-md flex flex-col items-center justify-center transition active:scale-95"
                    >
                      <ScanLine size={28} strokeWidth={2.5} className="mb-2" />
                      <span className="text-[12px] font-black uppercase tracking-wider">Absen Pulang</span>
                    </button>
                  </div>
                </div>

              ) : (
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${activeQrMode === "check_in" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                      {scanStep === 1 ? `1 - Pindai QR (${activeQrMode === "check_in" ? "Masuk" : "Pulang"})` : `2 - Ambil Selfie`}
                    </span>
                    <button onClick={() => { setActiveQrMode(null); setScanStep(1); }} className="text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition">Batal</button>
                  </div>

                  {scanStep === 1 ? (
                    <ModernQRScanner
                      mode={activeQrMode}
                      onScanSuccess={(decodedText, method) => {
                        setPendingQrData({ decodedText, method });
                        setScanStep(2);
                      }}
                      onCancel={() => { setActiveQrMode(null); setScanStep(1); }}
                      userName={user?.name || "Pegawai"}
                      schoolName={school.name}
                      maxRadius={school.radius || 120}
                      currentDistance={0}
                      isLocating={false}
                    />
                  ) : (
                    <BiometricSelfie
                      userName={user?.name}
                      onCancel={() => { setActiveQrMode(null); setScanStep(1); }}
                      onCaptureSuccess={(photoDataUrl) => {
                        if (pendingQrData) {
                          handleMobileAttendance(activeQrMode === "check_in" ? "masuk" : "pulang", pendingQrData.decodedText, pendingQrData.method, photoDataUrl);
                          setActiveQrMode(null);
                          setScanStep(1);
                        }
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: IZIN CUTI */}
          {mobileTab === "cuti" && (
            <div className="space-y-4 animate-fade-in text-left">
              <div className="bg-white p-4 rounded-3xl shadow-md">
                <h3 className="font-black text-gray-800 text-xs uppercase tracking-wide">Pengajuan Permohonan Izin / Cuti</h3>
                <p className="text-[10px] text-gray-500 mt-1 mb-4 leading-relaxed">
                  Lengkapi form pengajuan di bawah untuk mendaftarkan permohonan.
                </p>

                <form onSubmit={handleCutiSubmit} className="space-y-3 font-sans text-xs mt-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Jenis Izin / Cuti</label>
                    <select value={cutiJenis} onChange={(e) => setCutiJenis(e.target.value as any)} className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white text-[11px]">
                      <option value="Izin">Izin Keperluan Pribadi</option>
                      <option value="Sakit">Sakit (Keterangan Dokter)</option>
                      <option value="Cuti Tahunan">Cuti Tahunan Operasional</option>
                      <option value="Dinas/Lainnya">Dinas Luar Operasional Sekolah</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Tgl Mulai</label><input type="date" value={cutiMulai} onChange={(e) => setCutiMulai(e.target.value)} className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white" /></div>
                    <div><label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Tgl Selesai</label><input type="date" value={cutiSelesai} onChange={(e) => setCutiSelesai(e.target.value)} className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white" /></div>
                  </div>
                  <div><label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Alasan Pengajuan</label><textarea value={cutiAlasan} onChange={(e) => setCutiAlasan(e.target.value)} placeholder="Tuliskan detail argumen..." rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white" /></div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Lampiran Dokumen</label>
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { const reader = new FileReader(); reader.onloadend = () => setCutiFile(reader.result as string); reader.readAsDataURL(file); }
                    }} className="w-full px-3.5 py-1.5 border border-gray-200 bg-white rounded-xl text-[11px] file:mr-2.5 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                  </div>
                  <button type="submit" className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-[#5c4fff] shadow-md transition-all duration-200 active:scale-95">Submit Pengajuan Cuti</button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: KINERJA */}
          {mobileTab === "kinerja" && (
            <div className="space-y-4 animate-fade-in text-left">
              <div className="bg-white p-4 rounded-3xl shadow-md font-sans">
                <div className="flex items-center justify-between pb-2.5 border-b border-gray-200 mb-3 text-gray-800">
                  <h3 className="font-black text-xs uppercase tracking-wide">Form Upload Kinerja</h3>
                </div>
                <form onSubmit={handleKinerjaSubmit} className="space-y-3 font-sans text-xs">
                  <div><label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Tanggal Kegiatan</label><input type="date" value={kinerjaDate} onChange={(e) => setKinerjaDate(e.target.value)} className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-[11px]" required /></div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Tupoksi Terkait</label>
                    <input
                      type="text"
                      value={kinerjaTupoksi}
                      onChange={(e) => setKinerjaTupoksi(e.target.value)}
                      placeholder="Ketik tupoksi kegiatan..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white text-[11px]"
                      required
                    />
                  </div>

                  <div><label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Uraian Kegiatan</label><textarea value={kinerjaUraian} onChange={(e) => setKinerjaUraian(e.target.value)} placeholder="Tuliskan ringkasan detail..." rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white text-[11px]" required /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Satuan Hasil</label><select value={kinerjaSatuan} onChange={(e) => setKinerjaSatuan(e.target.value)} className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white text-[11px]"><option value="Laporan">Laporan</option><option value="Dokumen">Dokumen</option><option value="Berkas">Berkas fisik</option><option value="Kegiatan">Kegiatan</option></select></div>
                    <div><label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Jumlah Dokumen</label><input type="number" value={kinerjaJumlah} onChange={(e) => setKinerjaJumlah(Number(e.target.value))} className="w-full px-3 py-1.5 border border-gray-200 rounded-xl bg-white" min={1} required /></div>
                  </div>
                  <button type="submit" className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-[#5c4fff] shadow-md transition-all duration-200 active:scale-95">Upload Bukti Kinerja</button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 5: RIWAYAT */}
          {mobileTab === "riwayat" && (
            <div className="space-y-4 animate-fade-in text-left">
              <div className="bg-white p-4 rounded-3xl shadow-sm flex flex-col font-sans">
                <h3 className="font-black text-gray-800 text-xs uppercase tracking-wide">Riwayat Absen Mandiri</h3>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed mb-4">Laporan rekapitulasi digital personal bulanan terhitung otomatis oleh server cloud.</p>
                <div className="border border-slate-150 rounded-xl overflow-hidden text-[9px]">
                  <div className="bg-[#17a2b8] text-white uppercase font-bold py-2 px-2.5 grid grid-cols-12 gap-1 text-center">
                    <span className="col-span-3 text-left">Tanggal</span><span className="col-span-3">Masuk</span><span className="col-span-3">Pulang</span><span className="col-span-3">Status</span>
                  </div>
                  <div className="divide-y divide-slate-100 text-gray-700">
                    {attendance.filter(a => a.userId === user?.id).map((item) => (
                      <div key={item.id} className="py-2 px-2.5 grid grid-cols-12 gap-1 items-center hover:bg-slate-50">
                        <span className="col-span-3 text-left font-bold text-gray-800">{format(new Date(item.date), "dd-MM")}</span>
                        <span className="col-span-3 text-center font-mono">{item.checkInTime || "--:--"}</span>
                        <span className="col-span-3 text-center font-mono">{item.checkOutTime || "--:--"}</span>
                        <span className="col-span-3 text-center"><span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${item.status === "Hadir" ? "bg-green-100 text-green-700" : item.status === "Terlambat" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{item.status}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: PROFIL */}
          {mobileTab === "profil" && <ProfileTabContent onLogout={logout} />}
        </main>

        <div className="sticky bottom-0 z-30 w-full bg-white/95 backdrop-blur-md border-t border-gray-200 py-2.5 px-2 flex justify-around items-center text-gray-500 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <button onClick={() => setMobileTab("home")} className={`flex flex-col items-center gap-1 ${mobileTab === "home" ? "text-[#1d74f2] font-black scale-105" : "hover:text-gray-700"}`}><Smartphone size={18} /><span className="text-[9px]">Beranda</span></button>
          <button onClick={() => { setActiveQrMode(null); setScanStep(1); setMobileTab("scan"); }} className={`flex flex-col items-center gap-1 ${mobileTab === "scan" ? "text-[#1d74f2] font-black scale-105" : "hover:text-gray-700"}`}><QrCode size={18} /><span className="text-[9px]">Presensi</span></button>
          <button onClick={() => setMobileTab("cuti")} className={`flex flex-col items-center gap-1 ${mobileTab === "cuti" ? "text-[#1d74f2] font-black scale-105" : "hover:text-gray-700"}`}><Calendar size={18} /><span className="text-[9px]">Izin/Cuti</span></button>
          <button onClick={() => setMobileTab("kinerja")} className={`flex flex-col items-center gap-1 ${mobileTab === "kinerja" ? "text-[#1d74f2] font-black scale-105" : "hover:text-gray-700"}`}><FileText size={18} /><span className="text-[9px]">Kinerja</span></button>
          <button onClick={() => setMobileTab("riwayat")} className={`flex flex-col items-center gap-1 ${mobileTab === "riwayat" ? "text-[#1d74f2] font-black scale-105" : "hover:text-gray-700"}`}><Clock size={18} /><span className="text-[9px]">Riwayat</span></button>
          <button onClick={() => setMobileTab("profil")} className={`flex flex-col items-center gap-1 ${mobileTab === "profil" ? "text-[#1d74f2] font-black scale-105" : "hover:text-gray-700"}`}><UserCircle size={18} /><span className="text-[9px]">Profil</span></button>
        </div>
      </div>
    </div>
  );
}
