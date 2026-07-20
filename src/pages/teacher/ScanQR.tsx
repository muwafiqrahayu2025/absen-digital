import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useAuth } from "../../components/AuthContext";
import { db, syncOfflineAttendance } from "../../lib/db";
import { ModernQRScanner } from "../../components/ModernQRScanner";
import { BiometricSelfie } from "../../components/BiometricSelfie";
import { detectUserDevice, recordDeviceSessionLog } from "../../lib/deviceDetection";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  CheckCircle,
  XCircle,
  Camera,
  ArrowLeft,
  MapPin,
  RefreshCw,
  CloudOff,
  AlertTriangle,
  Database,
  Activity,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Calendar,
  FileText,
  FileSpreadsheet,
  UserCircle,
  Bell,
  Menu,
  Smartphone,
  ScanLine,
  LogIn,
  LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { runSecurityCheck } from "../../lib/securityGuard";
import { verifyScannedQrSecurity } from "../../lib/qrScheduler";

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const parseQRData = (qrStr: string) => {
  try {
    const trimmed = qrStr.trim();
    if (trimmed.startsWith("{")) return JSON.parse(trimmed);

    const queryIndex = trimmed.indexOf("?");
    const queryString = queryIndex !== -1 ? trimmed.substring(queryIndex) : trimmed;
    const params = new URLSearchParams(queryString);
    if (!params.get("token")) throw new Error("Token tidak ditemukan");

    return {
      session: params.get("session") || "Absensi Harian",
      date: params.get("date") || "",
      type: params.get("type") || "check_in",
      token: params.get("token") || "",
      timestamp: Number(params.get("timestamp")) || Date.now(),
      cycle: (params.get("cycle") as any) || undefined,
      cycleStart: params.get("cycleStart") || undefined,
      cycleEnd: params.get("cycleEnd") || undefined,
      masterToken: params.get("masterToken") || undefined,
    };
  } catch {
    throw new Error("Format QR Code tidak dikenali atau tidak valid.");
  }
};

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface LocationData {
  latitude: number;
  longitude: number;
  distance: number;
}

type AttendanceStep = "idle" | "qr" | "selfie" | "result";

interface PendingSelfiePayload {
  decodedText: string;
  mode: "check_in" | "check_out";
  locationData?: LocationData;
  methodType: "scanner" | "file" | "external_scanner";
}

interface AttendanceResult {
  type: "success" | "error";
  text: string;
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export function ScanQR() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isTeacherOrStaff =
    user?.role === "guru" ||
    user?.role === "dosen" ||
    user?.role === "staf_sekolah" ||
    user?.role === "staf_kampus";

  // ── State ──────────────────────────────────────────────────
  const [attendanceFlowStep, setAttendanceFlowStep] = useState<AttendanceStep>("idle");
  const [step, setStep] = useState(1);
  const [activeMode, setActiveMode] = useState<"check_in" | "check_out" | null>(null);
  const [pendingSelfie, setPendingSelfie] = useState<PendingSelfiePayload | null>(null);
  const [attendanceResult, setAttendanceResult] = useState<AttendanceResult | null>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [isSecurityChecking, setIsSecurityChecking] = useState(false);
  const [securityAlert, setSecurityAlert] = useState<{ level: string; violations: string[] } | null>(null);

  const [attendance, setAttendanceList] = useState(() => db.getAttendance());
  const [manualType, setManualType] = useState<"Hadir" | "Izin" | "Sakit">("Hadir");
  const [manualNotes, setManualNotes] = useState("");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastVerifiedLocation, setLastVerifiedLocation] = useState<LocationData | null>(null);
  const [simMode, setSimModeState] = useState<"healthy" | "unstable" | "offline">(
    () => (localStorage.getItem("sync_sim_mode") as any) || "healthy",
  );

  const isMountedRef = useRef(true);
  const isSyncingRef = useRef(isSyncing);

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const school = useMemo(() => db.getSchool(), []);
  const todayRecord = useMemo(
    () => attendance.find((a) => a.userId === user?.id && a.date === today),
    [attendance, user?.id, today],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);

  const playAudioFeedback = useCallback((type: "success" | "error") => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      const duration = type === "success" ? 0.2 : 0.3;

      if (type === "success") {
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      } else {
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
        oscillator.frequency.linearRampToValueAtTime(200, audioCtx.currentTime + duration);
      }

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + duration);

      oscillator.onended = () => {
        audioCtx.close().catch(() => { });
      };
    } catch (e) {
      console.warn("Audio feedback failed", e);
    }
  }, []);

  const saveAttendance = useCallback((newRecords: any[]) => {
    db.setAttendance(newRecords);
    if (isMountedRef.current) setAttendanceList(newRecords);
    window.dispatchEvent(new Event("attendance_synchronized"));
  }, []);

  useEffect(() => {
    const handleSyncEvent = () => {
      if (isMountedRef.current) setAttendanceList(db.getAttendance());
    };
    window.addEventListener("attendance_synchronized", handleSyncEvent);
    return () => window.removeEventListener("attendance_synchronized", handleSyncEvent);
  }, []);

  useEffect(() => {
    const checkAndAutoSync = async () => {
      const pendingCount = db
        .getAttendance()
        .filter((a) => a.userId === user?.id && !a.isSynced).length;

      if (pendingCount > 0 && navigator.onLine && simMode !== "offline" && !isSyncingRef.current) {
        try {
          await syncOfflineAttendance();
        } catch (err) {
          console.warn("Background auto-sync failed");
        }
      }
    };
    const interval = setInterval(checkAndAutoSync, 15003);
    return () => clearInterval(interval);
  }, [simMode, user?.id]);

  const handleManualSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const toastId = toast.loading("Memulai sinkronisasi...");
    try {
      const count = await syncOfflineAttendance();
      if (count > 0) {
        toast.success(`Berhasil menyinkronkan ${count} data!`, { id: toastId, duration: 4000 });
      } else {
        toast.success("Semua data sinkron.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal sinkron.", { id: toastId, duration: 4000 });
    } finally {
      if (isMountedRef.current) setIsSyncing(false);
    }
  }, [isSyncing]);

  const checkLocationAndReturn = useCallback(async (): Promise<LocationData | null> => {
    if (!school.latitude || !school.longitude || !school.radius) return null;
    if (!navigator.geolocation) throw new Error("GPS tidak didukung.");

    setIsLocating(true);
    setIsSecurityChecking(true);

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (!isMountedRef.current) return;
          setIsLocating(false);

          const secResult = await runSecurityCheck(position);
          setIsSecurityChecking(false);

          if (secResult.threatLevel === "critical") {
            setSecurityAlert({ level: secResult.threatLevel, violations: secResult.violations });
            reject(new Error(`Pemeriksaan Keamanan Gagal: ${secResult.violations[0]}`));
            return;
          }

          const distance = getDistance(
            position.coords.latitude,
            position.coords.longitude,
            school.latitude!,
            school.longitude!,
          );

          if (distance <= school.radius!) {
            const loc: LocationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              distance: Math.round(distance),
            };
            setLastVerifiedLocation(loc);
            resolve(loc);
          } else {
            reject(new Error(`Di luar jangkauan (${Math.round(distance)}m)`));
          }
        },
        (error) => {
          if (!isMountedRef.current) return;
          setIsLocating(false);
          setIsSecurityChecking(false);
          reject(new Error("Gagal mengakses GPS. Pastikan Izin Lokasi aktif."));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  }, [school]);

  const processAttendance = useCallback(
    async (
      qrDataStr: string,
      mode: "check_in" | "check_out",
      locationData?: LocationData,
      methodType: "scanner" | "file" | "external_scanner" = "scanner",
      photoDataUrl?: string,
    ) => {
      try {
        const schoolId = user?.tenantId;
        const userId = user?.id;

        // 1. VALIDASI SUPER KETAT (Rem Darurat)
        // Mencegah "Salah Alamat" dengan memastikan id tidak kosong
        if (!schoolId || schoolId === 'undefined' || schoolId === 'null') {
          playAudioFeedback("error");
          setAttendanceResult({ type: "error", text: "Error: Data Sekolah (schoolId) hilang! Silakan relogin." });
          setAttendanceFlowStep("result");
          return;
        }

        if (!userId || userId === 'undefined' || userId === 'null') {
          playAudioFeedback("error");
          setAttendanceResult({ type: "error", text: "Error: Data User (userId) tidak valid! Silakan relogin." });
          setAttendanceFlowStep("result");
          return;
        }

        const timeNow = format(new Date(), "HH:mm:ss");
        const checkInLimit = school?.operationalCheckInLimit || "08:00";
        const isLate = timeNow > checkInLimit + ":00";

        // 2. PATH AMAN (Variabel sudah pasti ada isinya)
        const { getDatabase, ref, push, set, serverTimestamp } = await import("firebase/database");
        const dbInstance = getDatabase();
        // Menggunakan path aman yang menghindari Permission Denied
        const dbPath = `tenants/${schoolId}/attendance`;
        const attendanceRef = ref(dbInstance, dbPath);

        const newRecordRef = push(attendanceRef); 
        await set(newRecordRef, {
          userId: userId,
          date: today,
          checkInTime: mode === "check_in" ? timeNow : undefined,
          checkOutTime: mode === "check_out" ? timeNow : undefined,
          status: isLate && mode === "check_in" ? "Terlambat" : "Hadir",
          latitude: locationData?.latitude,
          longitude: locationData?.longitude,
          distance: locationData?.distance,
          method: methodType,
          photoDataUrl: photoDataUrl,
          waktuAbsen: serverTimestamp()
        });

        recordDeviceSessionLog({
          userId: userId,
          userName: user!.name,
          userRole: user!.role,
          action: mode === "check_in" ? "PRESENSI_IN" : "PRESENSI_OUT",
          details: `Presensi ${mode} via ${methodType} (Jalur Rem Darurat)`,
          status: "SUCCESS",
        });

        playAudioFeedback("success");
        setAttendanceResult({ type: "success", text: `✅ Absensi ${mode === "check_in" ? "MASUK" : "PULANG"} berhasil dicatat!` });
        setAttendanceFlowStep("result");
      } catch (e: any) {
        console.error("Gagal menyimpan data:", e);
        playAudioFeedback("error");
        setAttendanceResult({ type: "error", text: "Error: Permission Denied atau Koneksi Gagal." });
        setAttendanceFlowStep("result");
      }
    },
    [today, user?.id, simMode, school, saveAttendance, playAudioFeedback],
  );

  const handleStartScan = useCallback((mode: "check_in" | "check_out") => {
    setActiveMode(mode);
    setStep(1);
    setAttendanceFlowStep("qr");
    setAttendanceResult(null);
    setPendingSelfie(null);
    setSecurityAlert(null);
  }, []);

  const handleQRScanSuccess = useCallback(
    async (decodedText: string, method: "scanner" | "file" | "external_scanner") => {
      if (attendanceFlowStep !== "qr") return;
      let locData: LocationData | null = null;
      if (school.latitude && school.longitude && school.radius) {
        const toastId = toast.loading("🛡️ Memeriksa lokasi...");
        try {
          locData = await checkLocationAndReturn();
          toast.success("✅ Lokasi terverifikasi.", { id: toastId });
        } catch (err: any) {
          toast.error(err.message, { id: toastId, duration: 5000 });
          return;
        }
      }

      if (isMountedRef.current) {
        setPendingSelfie({ decodedText, mode: activeMode!, locationData: locData || undefined, methodType: method });
        setStep(2);
        setAttendanceFlowStep("selfie");
      }
    },
    [attendanceFlowStep, school, checkLocationAndReturn, activeMode],
  );

  const handleSelfieSuccess = useCallback((photoDataUrl: string) => {
    if (!pendingSelfie) return;
    processAttendance(pendingSelfie.decodedText, pendingSelfie.mode, pendingSelfie.locationData, pendingSelfie.methodType, photoDataUrl);
    setPendingSelfie(null);
  }, [pendingSelfie, processAttendance]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    const dateParam = params.get("date");
    const typeParam = params.get("type");

    if (!tokenParam || !dateParam || !typeParam) return;

    const qrData = {
      session: params.get("session") || "Absensi Harian",
      date: dateParam,
      type: typeParam,
      token: tokenParam,
      timestamp: Number(params.get("timestamp")) || Date.now(),
    };

    const processUrlScan = async () => {
      const externalMode = typeParam as "check_in" | "check_out";
      setActiveMode(externalMode);
      setAttendanceFlowStep("qr");

      let locData: LocationData | null = null;
      if (school.latitude && school.longitude && school.radius) {
        try {
          locData = await checkLocationAndReturn();
        } catch (e: any) {
          toast.error(e.message, { duration: 6000 });
          setAttendanceFlowStep("idle");
          return;
        }
      }

      if (isMountedRef.current) {
        setPendingSelfie({
          decodedText: JSON.stringify(qrData),
          mode: externalMode,
          locationData: locData || undefined,
          methodType: "external_scanner",
        });
        setStep(2);
        setAttendanceFlowStep("selfie");
      }
    };
    window.history.replaceState({}, document.title, window.location.pathname);
    processUrlScan();
  }, []);

  const handleReset = useCallback(() => {
    setAttendanceFlowStep("idle");
    setStep(1);
    setActiveMode(null);
    setPendingSelfie(null);
    setAttendanceResult(null);
    setLastVerifiedLocation(null);
    setSecurityAlert(null);
  }, []);

  const updateSimMode = useCallback((mode: "healthy" | "unstable" | "offline") => {
    localStorage.setItem("sync_sim_mode", mode);
    setSimModeState(mode);
    toast.success(`Mode Keandalan Jaringan: ${mode}`);
  }, []);

  const handleSubmitManual = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const existing = attendance.find((a) => a.userId === user?.id && a.date === today);
      if (existing?.checkInTime) { toast.error("Sudah absen."); return; }
      if ((existing as any)?.approvalStatus === "Pending") { toast.error("Ada pengajuan pending."); return; }

      setIsSubmittingManual(true);
      const timeNow = format(new Date(), "HH:mm:ss");
      const newRecord = {
        id: "MANUAL-" + Math.random().toString(36).substring(2, 9).toUpperCase(),
        userId: user!.id,
        date: today,
        checkInTime: timeNow,
        checkOutTime: manualType === "Hadir" ? timeNow : undefined,
        status: manualType,
        approvalStatus: "Pending",
        notes: manualNotes.trim(),
        isSynced: navigator.onLine,
      } as any;

      try {
        saveAttendance([...attendance, newRecord]);
        toast.success(`Pengajuan ${manualType} dikirim!`);
        setManualNotes("");
      } catch (err) {
        toast.error("Gagal mengirim.");
      } finally {
        if (isMountedRef.current) setIsSubmittingManual(false);
      }
    },
    [attendance, user, today, manualType, manualNotes, saveAttendance],
  );

  const renderResultCard = () => {
    if (!attendanceResult) return null;
    const isSuccess = attendanceResult.type === "success";
    return (
      <div className="mt-4 rounded-3xl overflow-hidden animate-fade-in">
        <div className={`p-6 flex flex-col items-center text-center gap-3 rounded-3xl ${isSuccess ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${isSuccess ? "bg-emerald-500" : "bg-rose-500"}`}>
            {isSuccess ? <CheckCircle className="w-9 h-9 text-white" /> : <XCircle className="w-9 h-9 text-white" />}
          </div>
          <div>
            <p className={`font-bold text-sm ${isSuccess ? "text-emerald-700" : "text-rose-700"}`}>
              {isSuccess ? "Presensi Berhasil" : "Verifikasi Gagal"}
            </p>
            <p className={`text-xs mt-1 ${isSuccess ? "text-emerald-600" : "text-rose-600"}`}>{attendanceResult.text}</p>
          </div>
          <div className="flex gap-2.5 w-full pt-1">
            <button onClick={handleReset} className="flex-1 py-2.5 rounded-full font-semibold text-xs text-slate-700 bg-white border border-slate-300 shadow-sm hover:bg-slate-50 transition-all">
              {isSuccess ? "✨ Selesai" : "Tutup"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderHeroStatusCard = () => (
    <div className="rounded-[2rem] overflow-hidden shadow-sm border border-slate-200 bg-white relative">
      <div className="relative bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-600 px-6 py-6 text-white overflow-hidden">
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white p-0.5 shadow-md shrink-0">
            <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center">
              <span className="text-xl font-bold text-indigo-600">{user?.name?.charAt(0).toUpperCase() || "U"}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-indigo-200 font-semibold uppercase tracking-[0.2em] mb-1">Kartu Presensi Digital</p>
            <h2 className="font-bold text-lg leading-tight truncate text-white">{user?.name}</h2>
            <p className="text-[11px] text-indigo-100 mt-0.5 truncate flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {user?.satker || school.name}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="bg-white/20 backdrop-blur-md border border-white/20 rounded-xl px-3 py-1.5 shadow-sm">
              <p className="font-bold text-sm text-white">{format(new Date(), "HH:mm")}</p>
              <p className="text-[9px] text-indigo-100 font-medium">{format(new Date(), "dd MMM yy")}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2.5 mt-5">
          <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-semibold bg-white/10 border border-white/20 text-white">
            {todayRecord?.checkInTime ? <CheckCircle size={12} className="text-emerald-300" /> : <Clock size={12} className="opacity-70" />}
            <span>{todayRecord?.checkInTime ? `Masuk: ${todayRecord.checkInTime}` : "Belum Masuk"}</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-semibold bg-white/10 border border-white/20 text-white">
            {todayRecord?.checkOutTime ? <CheckCircle size={12} className="text-emerald-300" /> : <Clock size={12} className="opacity-70" />}
            <span>{todayRecord?.checkOutTime ? `Pulang: ${todayRecord.checkOutTime}` : "Belum Pulang"}</span>
          </div>
        </div>
      </div>

      <div className="relative px-6 py-6 z-10 bg-white">
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleStartScan("check_in")}
            disabled={isLocating || !!todayRecord?.checkInTime}
            className={`group relative flex flex-col items-center justify-center gap-3 py-6 px-4 rounded-3xl font-semibold text-center transition-all duration-300 shadow-sm border ${todayRecord?.checkInTime ? "bg-slate-50 text-slate-400 border-slate-200" : "bg-white text-slate-800 border-slate-200 hover:border-indigo-300 hover:shadow-md hover:-translate-y-1"}`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${todayRecord?.checkInTime ? "bg-slate-200" : "bg-indigo-100 text-indigo-600"}`}>
              {isLocating && activeMode === null ? <RefreshCw size={24} className="animate-spin" /> : <LogIn size={24} />}
            </div>
            <div>
              <span className="block text-[13px] font-bold">{isLocating && activeMode === null ? "Cek Lokasi…" : todayRecord?.checkInTime ? "✓ Masuk" : "Absen Masuk"}</span>
            </div>
          </button>
          <button
            onClick={() => handleStartScan("check_out")}
            disabled={isLocating || !!todayRecord?.checkOutTime}
            className={`group relative flex flex-col items-center justify-center gap-3 py-6 px-4 rounded-3xl font-semibold text-center transition-all duration-300 shadow-sm border ${todayRecord?.checkOutTime ? "bg-slate-50 text-slate-400 border-slate-200" : "bg-white text-slate-800 border-slate-200 hover:border-rose-300 hover:shadow-md hover:-translate-y-1"}`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${todayRecord?.checkOutTime ? "bg-slate-200" : "bg-rose-100 text-rose-600"}`}>
              <LogOut size={24} />
            </div>
            <div>
              <span className="block text-[13px] font-bold">{todayRecord?.checkOutTime ? "✓ Pulang" : "Absen Pulang"}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  const renderActiveScannerPanel = () => {
    const modeLabel = activeMode === "check_in" ? "Absen Masuk" : "Absen Pulang";
    return (
      <div className="animate-fade-in bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-indigo-50 text-indigo-700 border-indigo-200">
            {step === 1 ? <ScanLine size={10} /> : <Camera size={10} />}
            {step === 1 ? `1 - QR (${modeLabel})` : `2 - Selfie (${modeLabel})`}
          </span>
          <button onClick={handleReset} className="flex items-center gap-1 text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full text-[11px] font-medium">
            <ArrowLeft size={12} /> Batal
          </button>
        </div>

        {/* LOGIKA TERNARY KETAT */}
        {step === 1 ? (
          <ModernQRScanner
            mode={activeMode!}
            onScanSuccess={(decodedText, method) => handleQRScanSuccess(decodedText, method)}
            onCancel={handleReset}
            userName={user?.name || "Pegawai"}
            schoolName={school.name}
            maxRadius={school.radius || 120}
            currentDistance={lastVerifiedLocation ? getDistance(lastVerifiedLocation.latitude, lastVerifiedLocation.longitude, school.latitude || -6.2, school.longitude || 106.816666) : 0}
            isLocating={isLocating}
          />
        ) : (
          pendingSelfie ? (
            <BiometricSelfie
              userName={user?.name}
              onCancel={handleReset}
              onCaptureSuccess={handleSelfieSuccess}
              onBackToQR={() => { setStep(1); setAttendanceFlowStep("qr"); }}
              mode={activeMode!}
              schoolName={school.name}
              maxRadius={school.radius || 120}
              currentDistance={lastVerifiedLocation?.distance || 0}
              isLocating={isLocating}
            />
          ) : (
            <div className="py-16 px-4 bg-slate-50 rounded-3xl border border-slate-200 text-center text-slate-600">
              <RefreshCw size={36} className="text-indigo-400 animate-spin mx-auto mb-4" />
              Menyiapkan Validasi...
            </div>
          )
        )}
      </div>
    );
  };

  const renderSecondaryPanels = () => (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-5">
        <h3 className="font-semibold text-slate-800 text-[12px] mb-4 flex items-center gap-1.5"><span>📝</span> Surat Izin Manual</h3>
        <form onSubmit={handleSubmitManual} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(["Hadir", "Izin", "Sakit"] as const).map((opt) => (
              <button key={opt} type="button" onClick={() => setManualType(opt)} className={`py-2 rounded-xl border text-center font-semibold text-[10px] ${manualType === opt ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
                {opt}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Catatan..."
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 bg-white text-slate-800 rounded-xl text-[11px] focus:ring-2 focus:ring-indigo-500"
            required={manualType !== "Hadir"}
          />
          <button type="submit" disabled={isSubmittingManual} className="w-full py-2.5 rounded-full font-semibold text-white text-xs bg-indigo-600 hover:bg-indigo-700 transition">
            Kirim Pengajuan
          </button>
        </form>
      </div>
    </div>
  );

  const scanContent = (
    <div className="space-y-5">
      {attendanceFlowStep === "idle" && (
        <>
          {renderHeroStatusCard()}
          {renderSecondaryPanels()}
        </>
      )}
      {(attendanceFlowStep === "qr" || attendanceFlowStep === "selfie") && renderActiveScannerPanel()}
      {attendanceFlowStep === "result" && renderResultCard()}
    </div>
  );

  if (isTeacherOrStaff) {
    return (
      <div className="w-full min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col bg-white select-none md:my-6 md:rounded-3xl md:border md:border-slate-200 md:shadow-xl overflow-hidden relative isolate">
          {/* HEADER PUTIH ELEGAN */}
          <header className="sticky top-0 z-30 w-full bg-white text-slate-800 px-4 sm:px-5 py-3.5 flex items-center justify-between shadow-sm border-b border-slate-100 shrink-0 backdrop-blur">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => navigate("/")} className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition">
                <ArrowLeft size={16} />
              </button>
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center p-1 border border-slate-200">
                <img src="https://upload.wikimedia.org/wikipedia/commons/e/ea/National_emblem_of_Indonesia_Garuda_Pancasila.svg" alt="Garuda" className="w-full h-full object-contain drop-shadow-sm" />
              </div>
              <div className="text-left truncate">
                <h4 className="text-xs font-black tracking-widest leading-none font-mono text-slate-800">PRESENSI MANDIRI</h4>
                <span className="text-[8px] uppercase font-bold text-slate-500">{school.name || "Portal Kepegawaian"}</span>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4 pb-6 bg-slate-50 font-sans text-xs">
            {scanContent}
          </main>

          {/* BOTTOM NAVIGATION TERANG */}
          <div className="sticky bottom-0 z-30 w-full bg-white backdrop-blur-md border-t border-slate-200 py-2.5 px-2 sm:px-4 flex justify-around items-center text-slate-500 shadow-sm">
            <button onClick={() => navigate("/")} className="flex flex-col items-center gap-1 flex-1 py-1 hover:text-indigo-600">
              <Smartphone size={16} /><span className="text-[9px]">Beranda</span>
            </button>
            <button className="flex flex-col items-center gap-1 flex-1 py-1 text-indigo-600 font-black">
              <Clock size={16} /><span className="text-[9px]">Presensi</span>
            </button>
            <button onClick={() => navigate("/?tab=cuti")} className="flex flex-col items-center gap-1 flex-1 py-1 hover:text-indigo-600">
              <Calendar size={16} /><span className="text-[9px]">Izin/Cuti</span>
            </button>
            <button onClick={() => navigate("/profile")} className="flex flex-col items-center gap-1 flex-1 py-1 hover:text-indigo-600">
              <UserCircle size={16} /><span className="text-[9px]">Profil</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-left bg-white text-slate-800 p-6 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-xl font-bold">Presensi Mandiri</h2>
      </div>
      {scanContent}
    </div>
  );
}