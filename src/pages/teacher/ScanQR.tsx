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

/** Haversine formula – returns distance in metres */
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

/** Parse QR string – supports JSON and URL-query formats */
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

/** Strict two-step flow:
 *  - step === "idle"   → Hero card with Masuk/Pulang buttons
 *  - step === "qr"     → ONLY QR scanner (ModernQRScanner)
 *  - step === "selfie" → ONLY selfie capture (BiometricSelfie)
 *  - step === "result" → Success/error result card
 */
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

  // ── Refs ───────────────────────────────────────────────────
  const isMountedRef = useRef(true);
  const isSyncingRef = useRef(isSyncing);

  // ── Derived values ─────────────────────────────────────────
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const school = useMemo(() => db.getSchool(), []);
  const todayRecord = useMemo(
    () => attendance.find((a) => a.userId === user?.id && a.date === today),
    [attendance, user?.id, today],
  );

  // ── Unmount guard ──────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Sync ref with state ────────────────────────────────────
  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);

  // ─────────────────────────────────────────────────────────────
  // AUDIO FEEDBACK
  // ─────────────────────────────────────────────────────────────
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
        audioCtx.close().catch(() => {});
      };
    } catch (e) {
      console.warn("Audio feedback failed", e);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // ATTENDANCE HELPERS
  // ─────────────────────────────────────────────────────────────
  const saveAttendance = useCallback((newRecords: any[]) => {
    db.setAttendance(newRecords);
    if (isMountedRef.current) setAttendanceList(newRecords);
    window.dispatchEvent(new Event("attendance_synchronized"));
  }, []);

  // ─────────────────────────────────────────────────────────────
  // SYNC – listen to global attendance updates from other tabs
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleSyncEvent = () => {
      if (isMountedRef.current) setAttendanceList(db.getAttendance());
    };
    window.addEventListener("attendance_synchronized", handleSyncEvent);
    return () => window.removeEventListener("attendance_synchronized", handleSyncEvent);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // BACKGROUND AUTO-SYNC
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAndAutoSync = async () => {
      const pendingCount = db
        .getAttendance()
        .filter((a) => a.userId === user?.id && !a.isSynced).length;

      if (pendingCount > 0 && navigator.onLine && simMode !== "offline" && !isSyncingRef.current) {
        try {
          await syncOfflineAttendance();
        } catch (err) {
          console.warn("Background auto-sync failed, will retry on next cycle");
        }
      }
    };

    const interval = setInterval(checkAndAutoSync, 15003);
    return () => clearInterval(interval);
  }, [simMode, user?.id]);

  // ─────────────────────────────────────────────────────────────
  // MANUAL SYNC
  // ─────────────────────────────────────────────────────────────
  const handleManualSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const toastId = toast.loading("Memulai sinkronisasi antrean data lokal ke server Instansi / Sekolah...");
    try {
      const count = await syncOfflineAttendance();
      if (count > 0) {
        toast.success(
          `Berhasil menyinkronkan ${count} data absensi dari penyimpanan lokal ke server Instansi / Sekolah!`,
          { id: toastId, duration: 4000 },
        );
      } else {
        toast.success("Semua data Anda sudah sinkron dengan server induk.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menyinkronkan antrean data lokal.", { id: toastId, duration: 4000 });
    } finally {
      if (isMountedRef.current) setIsSyncing(false);
    }
  }, [isSyncing]);

  // ─────────────────────────────────────────────────────────────
  // GEOLOCATION HELPERS (with Security Check)
  // ─────────────────────────────────────────────────────────────
  const checkLocationAndReturn = useCallback(
    async (): Promise<LocationData | null> => {
      if (!school.latitude || !school.longitude || !school.radius) {
        return null;
      }
      if (!navigator.geolocation) {
        throw new Error("Perangkat Anda tidak mendukung geolokasi GPS untuk presensi instansi / sekolah.");
      }

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
              reject(
                new Error(
                  `Pemeriksaan Keamanan Gagal: ${secResult.violations[0] || "Manipulasi lokasi terdeteksi"}`,
                ),
              );
              return;
            }

            if (secResult.threatLevel === "medium") {
              setSecurityAlert({ level: secResult.threatLevel, violations: secResult.violations });
              toast(`⚠️ Anomali GPS terdeteksi (${secResult.violations.length} indikator).`, {
                duration: 5000,
                icon: "⚠️",
              });
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
              reject(
                new Error(
                  `Gagal: Anda di luar geofence wilayah instansi / sekolah / kampus (Jarak: ${Math.round(distance)}m, Maksimal: ${school.radius}m).`,
                ),
              );
            }
          },
          (error) => {
            if (!isMountedRef.current) return;
            setIsLocating(false);
            setIsSecurityChecking(false);
            let errorMsg = "Gagal mengakses GPS Anda.";
            if (error.code === error.PERMISSION_DENIED) {
              errorMsg =
                "Izin lokasi dilarang. Harap aktifkan izin lokasi GPS pada browser agar presensi berhasil.";
            }
            reject(new Error(errorMsg));
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        );
      });
    },
    [school],
  );

  // ─────────────────────────────────────────────────────────────
  // PROCESS ATTENDANCE – core logic (called after selfie capture)
  // ─────────────────────────────────────────────────────────────
  const processAttendance = useCallback(
    (
      qrDataStr: string,
      mode: "check_in" | "check_out",
      locationData?: LocationData,
      methodType: "scanner" | "file" | "external_scanner" = "scanner",
      photoDataUrl?: string,
    ) => {
      try {
        let qrData: any = { token: qrDataStr, date: today, type: mode };
        try {
          const parsed = parseQRData(qrDataStr);
          if (parsed && parsed.token) qrData = parsed;
        } catch (e) {
          // Treated as direct barcode string
        }

        const securityCheck = verifyScannedQrSecurity(qrData, today);
        if (!securityCheck.valid) {
          throw new Error(
            securityCheck.reason || "Token keamanan QR Code tidak valid atau telah kedaluwarsa.",
          );
        }

        const currentAttendance = [...db.getAttendance()];
        const existingRecordIndex = currentAttendance.findIndex(
          (a) => a.userId === user?.id && a.date === today,
        );
        const timeNow = format(new Date(), "HH:mm:ss");

        if (mode === "check_in") {
          if (existingRecordIndex >= 0) {
            playAudioFeedback("error");
            setAttendanceResult({ type: "error", text: "Anda sudah login masuk hari ini." });
            return;
          }
          const checkInLimit = school.operationalCheckInLimit || "08:00";
          const isLate = timeNow > checkInLimit + ":00";
          const newRecord = {
            id: "ATT-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
            userId: user!.id,
            date: today,
            checkInTime: timeNow,
            status: isLate ? "Terlambat" : "Hadir",
            isSynced: navigator.onLine && simMode === "healthy",
            syncStatus: navigator.onLine && simMode === "healthy" ? "synced" : "pending",
            latitude: locationData?.latitude,
            longitude: locationData?.longitude,
            distance: locationData?.distance,
            method: methodType,
            qrBarcodeData: qrDataStr,
            photoDataUrl: photoDataUrl,
            deviceInfo: detectUserDevice(),
          } as any;

          saveAttendance([...currentAttendance, newRecord]);
          recordDeviceSessionLog({
            userId: user!.id,
            userName: user!.name,
            userRole: user!.role,
            action: "PRESENSI_IN",
            details: `Presensi Masuk via ${methodType} (${qrDataStr.slice(0, 15)}) di radius ${locationData?.distance || 0}m`,
            status: "SUCCESS",
          });
          playAudioFeedback("success");
          setAttendanceResult({
            type: "success",
            text: `✅ Presensi MASUK berhasil [Barcode: ${qrDataStr.length > 20 ? qrDataStr.slice(0, 20) + "..." : qrDataStr}] pada pukul ${timeNow}!`,
          });
        } else if (mode === "check_out") {
          if (existingRecordIndex < 0) {
            playAudioFeedback("error");
            setAttendanceResult({ type: "error", text: "Anda belum mencatat presensi masuk." });
            return;
          }
          const existingRecord = currentAttendance[existingRecordIndex];
          if (existingRecord.checkOutTime) {
            playAudioFeedback("error");
            setAttendanceResult({
              type: "error",
              text: "Presensi pulang sudah direkam sebelumnya.",
            });
            return;
          }

          currentAttendance[existingRecordIndex] = {
            ...existingRecord,
            checkOutTime: timeNow,
            isSynced: navigator.onLine && simMode === "healthy",
            syncStatus: navigator.onLine && simMode === "healthy" ? "synced" : "pending",
            latitude: locationData?.latitude,
            longitude: locationData?.longitude,
            distance: locationData?.distance,
            method: methodType,
            qrBarcodeData: qrDataStr,
            photoDataUrl: photoDataUrl || existingRecord.photoDataUrl,
            deviceInfo: detectUserDevice(),
          } as any;
          saveAttendance([...currentAttendance]);
          recordDeviceSessionLog({
            userId: user!.id,
            userName: user!.name,
            userRole: user!.role,
            action: "PRESENSI_OUT",
            details: `Presensi Pulang via ${methodType} (${qrDataStr.slice(0, 15)})`,
            status: "SUCCESS",
          });
          playAudioFeedback("success");
          setAttendanceResult({
            type: "success",
            text: `✅ Presensi PULANG berhasil [Barcode: ${qrDataStr.length > 20 ? qrDataStr.slice(0, 20) + "..." : qrDataStr}] pada pukul ${timeNow}!`,
          });
        }

        // Transition to result screen
        setAttendanceFlowStep("result");
      } catch (e: any) {
        playAudioFeedback("error");
        setAttendanceResult({
          type: "error",
          text: e.message || "Tanda tangan digital QR Code tidak valid.",
        });
        setAttendanceFlowStep("result");
      }
    },
    [today, user?.id, simMode, school, saveAttendance, playAudioFeedback],
  );

  // ─────────────────────────────────────────────────────────────
  // STEP 1 → START SCAN (set mode, go to QR scanner)
  // ─────────────────────────────────────────────────────────────
  const handleStartScan = useCallback((mode: "check_in" | "check_out") => {
    setActiveMode(mode);
    setStep(1);
    setAttendanceFlowStep("qr");
    setAttendanceResult(null);
    setPendingSelfie(null);
    setSecurityAlert(null);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // STEP 1 → 2: QR scan succeeded → verify GPS → go to selfie
  // ─────────────────────────────────────────────────────────────
  const handleQRScanSuccess = useCallback(
    async (decodedText: string, method: "scanner" | "file" | "external_scanner") => {
      // Prevent double-fire
      if (attendanceFlowStep !== "qr") return;

      let locData: LocationData | null = null;

      if (school.latitude && school.longitude && school.radius) {
        const toastId = toast.loading("🛡️ Memeriksa lokasi & keamanan...");
        try {
          locData = await checkLocationAndReturn();
          toast.success("✅ Lokasi & keamanan terverifikasi.", { id: toastId });
        } catch (err: any) {
          toast.error(err.message, { id: toastId, duration: 5000 });
          // Stay on QR step on GPS failure so user can retry
          return;
        }
      }

      if (isMountedRef.current) {
        setPendingSelfie({
          decodedText,
          mode: activeMode!,
          locationData: locData || undefined,
          methodType: method,
        });
        // Transition to STEP 2: ONLY selfie shown
        setStep(2);
        setAttendanceFlowStep("selfie");
      }
    },
    [attendanceFlowStep, school, checkLocationAndReturn, activeMode],
  );

  // ─────────────────────────────────────────────────────────────
  // STEP 2 → RESULT: selfie captured → process attendance
  // ─────────────────────────────────────────────────────────────
  const handleSelfieSuccess = useCallback(
    (photoDataUrl: string) => {
      if (!pendingSelfie) return;
      processAttendance(
        pendingSelfie.decodedText,
        pendingSelfie.mode,
        pendingSelfie.locationData,
        pendingSelfie.methodType,
        photoDataUrl,
      );
      setPendingSelfie(null);
    },
    [pendingSelfie, processAttendance],
  );

  // ─────────────────────────────────────────────────────────────
  // URL PARAM SCAN (external QR app redirect)
  // Only runs once on mount
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    const dateParam = params.get("date");
    const typeParam = params.get("type");

    if (!tokenParam || !dateParam || !typeParam) return;

    const sessionParam = params.get("session") || "Absensi Harian";
    const timestampParam = Number(params.get("timestamp")) || Date.now();
    const currentSchool = db.getSchool();

    const qrData = {
      session: sessionParam,
      date: dateParam,
      type: typeParam,
      token: tokenParam,
      timestamp: timestampParam,
    };

    const processUrlScan = async () => {
      const externalMode = typeParam as "check_in" | "check_out";
      setActiveMode(externalMode);
      setAttendanceFlowStep("qr"); // momentarily in QR step while we verify

      let locData: LocationData | null = null;
      const toastId = toast.loading("Mendeteksi QR eksternal, memverifikasi GPS...");

      if (currentSchool.latitude && currentSchool.longitude && currentSchool.radius) {
        try {
          locData = await checkLocationAndReturn();
          toast.success("Verifikasi koordinat berhasil!", { id: toastId });
        } catch (e: any) {
          toast.error(e.message, { id: toastId, duration: 6000 });
          setAttendanceFlowStep("idle");
          return;
        }
      } else {
        toast.success("Presensi diproses!", { id: toastId });
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

    // Clean URL immediately so refresh doesn't re-trigger
    window.history.replaceState({}, document.title, window.location.pathname);
    processUrlScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────
  // RESET / BACK to idle
  // ─────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setAttendanceFlowStep("idle");
    setStep(1);
    setActiveMode(null);
    setPendingSelfie(null);
    setAttendanceResult(null);
    setLastVerifiedLocation(null);
    setSecurityAlert(null);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // SIM MODE TOGGLE
  // ─────────────────────────────────────────────────────────────
  const updateSimMode = useCallback((mode: "healthy" | "unstable" | "offline") => {
    localStorage.setItem("sync_sim_mode", mode);
    setSimModeState(mode);
    toast.success(
      `Mode Keandalan Jaringan diubah ke: ${
        mode === "healthy"
          ? "Koneksi Sempurna"
          : mode === "unstable"
          ? "Koneksi Tidak Stabil"
          : "Simulasi Offline"
      }`,
    );
  }, []);

  // ─────────────────────────────────────────────────────────────
  // MANUAL SUBMISSION
  // ─────────────────────────────────────────────────────────────
  const handleSubmitManual = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const existing = attendance.find((a) => a.userId === user?.id && a.date === today);
      if (existing?.checkInTime) {
        toast.error("Anda sudah terekam hadir hari ini.");
        return;
      }
      if ((existing as any)?.approvalStatus === "Pending") {
        toast.error("Anda memiliki pengajuan berjalan yang sedang diaudit atasan.");
        return;
      }
      if (manualType !== "Hadir" && !manualNotes.trim()) {
        toast.error("Mohon rincikan perihal surat keterangan atasan.");
        return;
      }

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
        toast.success(`Surat Pengajuan absensi ${manualType} berhasil dikirim ke atasan!`);
        setManualNotes("");
      } catch (err) {
        toast.error("Gagal mengajukan surat. Silakan coba lagi.");
      } finally {
        if (isMountedRef.current) setIsSubmittingManual(false);
      }
    },
    [attendance, user, today, manualType, manualNotes, saveAttendance],
  );

  // ─────────────────────────────────────────────────────────────
  // ── RENDER: STEP INDICATOR PILL ────────────────────────────
  // ─────────────────────────────────────────────────────────────
  const renderStepIndicator = () => {
    if (attendanceFlowStep === "idle" || attendanceFlowStep === "result") return null;

    const steps = [
      { id: "qr", label: "1", desc: "Scan QR" },
      { id: "selfie", label: "2", desc: "Selfie" },
    ];

    const currentIdx = attendanceFlowStep === "qr" ? 0 : 1;

    return (
      <div className="flex items-center justify-center gap-2 mb-4">
        {steps.map((s, idx) => (
          <React.Fragment key={s.id}>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300 ${
                  idx < currentIdx
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                    : idx === currentIdx
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 ring-2 ring-indigo-300"
                    : "bg-slate-200 text-slate-400"
                }`}
              >
                {idx < currentIdx ? "✓" : s.label}
              </div>
              <span
                className={`text-[10px] font-semibold transition-all duration-300 ${
                  idx === currentIdx ? "text-indigo-600" : idx < currentIdx ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                {s.desc}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 max-w-[40px] rounded-full transition-all duration-500 ${
                  idx < currentIdx ? "bg-emerald-400" : "bg-slate-200"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // ── RENDER: RESULT CARD ─────────────────────────────────────
  // ─────────────────────────────────────────────────────────────
  const renderResultCard = () => {
    if (!attendanceResult) return null;
    const isSuccess = attendanceResult.type === "success";
    return (
      <div className="mt-4 rounded-3xl overflow-hidden animate-fade-in">
        <div
          className={`p-6 flex flex-col items-center text-center gap-3 rounded-3xl ${
            isSuccess
              ? "bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100"
              : "bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100"
          }`}
        >
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${
              isSuccess ? "bg-emerald-500" : "bg-rose-500"
            }`}
          >
            {isSuccess ? (
              <CheckCircle className="w-9 h-9 text-white" />
            ) : (
              <XCircle className="w-9 h-9 text-white" />
            )}
          </div>
          <div>
            <p className={`font-bold text-sm ${isSuccess ? "text-emerald-700" : "text-rose-700"}`}>
              {isSuccess ? "Presensi Berhasil Dicatat" : "Verifikasi Gagal"}
            </p>
            <p
              className={`text-xs mt-1 leading-relaxed ${
                isSuccess ? "text-emerald-600/80" : "text-rose-600/80"
              }`}
            >
              {attendanceResult.text}
            </p>
          </div>
          <div className="flex gap-2.5 w-full pt-1">
            {!isSuccess && (
              <button
                onClick={() => {
                  setAttendanceResult(null);
                  setAttendanceFlowStep("qr");
                }}
                className="flex-1 py-2.5 rounded-full font-semibold text-xs text-white bg-gradient-to-r from-indigo-500 to-blue-500 shadow-md hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
              >
                🔄 Ulangi Scan
              </button>
            )}
            <button
              onClick={handleReset}
              className="flex-1 py-2.5 rounded-full font-semibold text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all duration-200"
            >
              {isSuccess ? "✨ Selesai" : "Tutup"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // ── RENDER: HERO STATUS CARD (Idle state) ───────────────────
  // ─────────────────────────────────────────────────────────────
  const renderHeroStatusCard = () => (
    <div className="rounded-[2rem] overflow-hidden shadow-sm border border-slate-200 bg-white relative">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-100 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />

      {/* Hero gradient header */}
      <div className="relative bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-600 px-6 py-6 text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

        <div className="relative flex items-center gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-white p-0.5 shadow-md shrink-0">
            <div className="w-full h-full rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
              <span className="text-xl font-bold text-indigo-600">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
          </div>
          {/* Identity */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-indigo-200 font-semibold uppercase tracking-[0.2em] mb-1">
              Kartu Presensi Digital
            </p>
            <h2 className="font-bold text-lg leading-tight truncate text-white">{user?.name}</h2>
            <p className="text-[11px] text-indigo-100 mt-0.5 truncate flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {user?.satker || school.name || "Instansi / Sekolah / Kampus"}
            </p>
          </div>
          {/* Live time chip */}
          <div className="text-right shrink-0">
            <div className="bg-white/20 backdrop-blur-md border border-white/20 rounded-xl px-3 py-1.5 shadow-sm">
              <p className="font-bold text-sm text-white">{format(new Date(), "HH:mm")}</p>
              <p className="text-[9px] text-indigo-100 font-medium mt-0.5">
                {format(new Date(), "dd MMM yy")}
              </p>
            </div>
          </div>
        </div>

        {/* Today's status pills */}
        <div className="flex gap-2.5 mt-5">
          <div
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-semibold backdrop-blur-md transition-all ${
              todayRecord?.checkInTime
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
            }`}
          >
            {todayRecord?.checkInTime ? (
              <CheckCircle size={12} className="text-emerald-400" />
            ) : (
              <Clock size={12} className="opacity-70" />
            )}
            <span>
              {todayRecord?.checkInTime ? `Masuk: ${todayRecord.checkInTime}` : "Belum Masuk"}
            </span>
          </div>
          <div
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-semibold backdrop-blur-md transition-all ${
              todayRecord?.checkOutTime
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
            }`}
          >
            {todayRecord?.checkOutTime ? (
              <CheckCircle size={12} className="text-emerald-400" />
            ) : (
              <Clock size={12} className="opacity-70" />
            )}
            <span>
              {todayRecord?.checkOutTime ? `Pulang: ${todayRecord.checkOutTime}` : "Belum Pulang"}
            </span>
          </div>
        </div>
      </div>

      {/* Panel body – CTA Buttons */}
      <div className="relative px-6 py-6 z-10 bg-slate-50">
        <div className="grid grid-cols-2 gap-4">
          {/* Absen Masuk */}
          <button
            onClick={() => handleStartScan("check_in")}
            disabled={isLocating || !!todayRecord?.checkInTime}
            className={`group relative flex flex-col items-center justify-center gap-3 py-6 px-4 rounded-3xl font-semibold text-center transition-all duration-300 active:scale-95 overflow-hidden ${
              todayRecord?.checkInTime
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                : "bg-white text-slate-800 border border-slate-200 shadow-sm hover:-translate-y-1 hover:shadow-md hover:border-blue-300"
            }`}
          >
            {!todayRecord?.checkInTime && (
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            )}
            <div
              className={`relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-transform duration-300 group-hover:scale-110 ${
                todayRecord?.checkInTime
                  ? "bg-slate-200"
                  : "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/30"
              }`}
            >
              {isLocating && activeMode === null ? (
                <RefreshCw size={24} className="animate-spin" />
              ) : (
                <LogIn size={24} />
              )}
            </div>
            <div className="relative z-10">
              <span className="block text-[13px] font-bold tracking-wide">
                {isLocating && activeMode === null
                  ? "Cek Lokasi…"
                  : todayRecord?.checkInTime
                  ? "✓ Sudah Masuk"
                  : "Absen Masuk"}
              </span>
              {!todayRecord?.checkInTime && (
                <span className="block text-[10px] text-slate-500 font-medium mt-0.5">
                  Ketuk untuk Scan
                </span>
              )}
            </div>
          </button>

          {/* Absen Pulang */}
          <button
            onClick={() => handleStartScan("check_out")}
            disabled={isLocating || !!todayRecord?.checkOutTime}
            className={`group relative flex flex-col items-center justify-center gap-3 py-6 px-4 rounded-3xl font-semibold text-center transition-all duration-300 active:scale-95 overflow-hidden ${
              todayRecord?.checkOutTime
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                : "bg-white text-slate-800 border border-slate-200 shadow-sm hover:-translate-y-1 hover:shadow-md hover:border-rose-300"
            }`}
          >
            {!todayRecord?.checkOutTime && (
              <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 to-rose-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            )}
            <div
              className={`relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-transform duration-300 group-hover:scale-110 ${
                todayRecord?.checkOutTime
                  ? "bg-slate-200"
                  : "bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-orange-500/30"
              }`}
            >
              <LogOut size={24} />
            </div>
            <div className="relative z-10">
              <span className="block text-[13px] font-bold tracking-wide">
                {todayRecord?.checkOutTime ? "✓ Sudah Pulang" : "Absen Pulang"}
              </span>
              {!todayRecord?.checkOutTime && (
                <span className="block text-[10px] text-slate-500 font-medium mt-0.5">
                  Ketuk untuk Scan
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Geofence info chip */}
        {school.radius && (
          <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-slate-500 bg-white py-2.5 px-4 rounded-full border border-slate-200 shadow-sm">
            <MapPin size={12} className="text-indigo-500" />
            <span>
              Geofence radius:{" "}
              <strong className="text-slate-700 font-semibold">{school.radius} m</strong> dari pusat
            </span>
          </div>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // ── RENDER: ACTIVE SCANNER PANEL (QR or Selfie – strictly separated)
  // ─────────────────────────────────────────────────────────────
  const renderActiveScannerPanel = () => {
    const modeLabel = activeMode === "check_in" ? "Absen Masuk" : "Absen Pulang";
    const modeColor = activeMode === "check_in" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200";

    return (
      <div className="animate-fade-in transition-all duration-500 bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200">
        {/* Mode label + back button */}
        <div className="flex items-center justify-between mb-4">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${modeColor}`}
          >
            {step === 1 ? <ScanLine size={10} /> : <Camera size={10} />}
            {step === 1 ? `Langkah 1 — Scan QR (${modeLabel})` : `Langkah 2 — Selfie (${modeLabel})`}
          </span>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-[11px] font-medium transition active:scale-95 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full"
          >
            <ArrowLeft size={12} /> Batal
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex items-center gap-1.5">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300 ${step === 1 ? "bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300" : "bg-emerald-500 text-white shadow-md"}`}>
              {step === 1 ? "1" : "✓"}
            </div>
            <span className={`text-[10px] font-semibold ${step === 1 ? "text-indigo-600" : "text-emerald-600"}`}>Scan QR</span>
          </div>
          <div className={`flex-1 h-0.5 max-w-[40px] rounded-full transition-all duration-500 ${step === 2 ? "bg-emerald-400" : "bg-slate-200"}`} />
          <div className="flex items-center gap-1.5">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300 ${step === 2 ? "bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300" : "bg-slate-200 text-slate-400"}`}>
              2
            </div>
            <span className={`text-[10px] font-semibold ${step === 2 ? "text-indigo-600" : "text-slate-400"}`}>Selfie</span>
          </div>
        </div>

        {/* STRICT TERNARY LOGIC AS REQUESTED */}
        {step === 1 ? (
          <ModernQRScanner
            mode={activeMode!}
            onScanSuccess={(decodedText, method) => handleQRScanSuccess(decodedText, method)}
            onCancel={handleReset}
            userName={user?.name || "Pegawai / Guru / Dosen"}
            schoolName={school.name}
            maxRadius={school.radius || 120}
            currentDistance={
              lastVerifiedLocation
                ? getDistance(
                    lastVerifiedLocation.latitude,
                    lastVerifiedLocation.longitude,
                    school.latitude || -6.2,
                    school.longitude || 106.816666,
                  )
                : 0
            }
            isLocating={isLocating}
          />
        ) : (
          pendingSelfie ? (
            <BiometricSelfie
              userName={user?.name}
              onCancel={handleReset}
              onCaptureSuccess={handleSelfieSuccess}
              onBackToQR={() => {
                setStep(1);
                setAttendanceFlowStep("qr");
              }}
              mode={activeMode!}
              schoolName={school.name}
              maxRadius={school.radius || 120}
              currentDistance={lastVerifiedLocation?.distance || 0}
              isLocating={isLocating}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-50 rounded-3xl border border-slate-200">
              <RefreshCw size={36} className="text-indigo-400 animate-spin mb-4" />
              <h3 className="font-bold text-slate-700">Menyiapkan Validasi</h3>
              <p className="text-[11px] text-slate-500 text-center mt-2 max-w-[200px]">
                {isLocating ? "Sedang mengunci koordinat GPS..." : "Memuat kamera selfie..."}
              </p>
            </div>
          )
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // ── RENDER: SECONDARY PANELS (shown only on idle step) ──────
  // ─────────────────────────────────────────────────────────────
  const renderSecondaryPanels = () => (
    <div className="space-y-5 animate-fade-in">
      {/* Offline Outbox Monitor */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database size={13} className="text-indigo-600" />
            <div>
              <p className="font-semibold text-slate-800 text-[11px]">Antrean Offline</p>
              <p className="text-[9px] text-slate-500 mt-0">Sinkronisasi otomatis saat sinyal kembali</p>
            </div>
          </div>
          <button
            disabled={isSyncing}
            onClick={handleManualSync}
            className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-full font-semibold text-white text-[10px] bg-gradient-to-r from-violet-500 to-purple-600 shadow-md hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            <RefreshCw size={10} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Mengunggah…" : "Sync Sekarang"}
          </button>
        </div>

        <div className="px-4 py-3">
          {attendance.filter((a) => a.userId === user?.id && !a.isSynced).length === 0 ? (
            <div className="flex items-center gap-2.5 py-2 text-emerald-600">
              <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle size={13} />
              </div>
              <div>
                <p className="font-semibold text-[11px]">Antrean Bersih</p>
                <p className="text-[9px] text-slate-400 font-normal">Semua data tersimpan di cloud.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-800">
                <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] leading-relaxed">
                  <strong>
                    {attendance.filter((a) => a.userId === user?.id && !a.isSynced).length} data
                  </strong>{" "}
                  menunggu sinkronisasi. Data aman tersimpan di perangkat.
                </p>
              </div>
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                {attendance
                  .filter((a) => a.userId === user?.id && !a.isSynced)
                  .map((item) => (
                    <div key={item.id} className="px-3 py-2.5 flex items-center justify-between text-[10px]">
                      <div className="font-semibold text-slate-200">
                        {format(new Date(item.date), "dd MMM")}
                        <span className="text-slate-400 font-normal ml-1">
                          {item.checkInTime
                            ? `· Masuk ${item.checkInTime}`
                            : `· Pulang ${item.checkOutTime}`}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          item.syncStatus === "syncing"
                            ? "bg-indigo-100 text-indigo-700"
                            : item.syncStatus === "failed"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {item.syncStatus === "syncing" ? "Menghubungkan" : item.syncStatus || "Pending"}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Network Sim Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-[10px] font-semibold tracking-widest text-indigo-600 uppercase flex items-center gap-1">
            <Settings size={10} /> Simulasi Jaringan HP
          </h3>
          <span
            className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
              simMode === "healthy"
                ? "bg-emerald-500/15 text-emerald-400"
                : simMode === "unstable"
                ? "bg-amber-500/15 text-amber-400"
                : "bg-rose-500/15 text-rose-400"
            }`}
          >
            {simMode === "healthy" ? "Kuat" : simMode === "unstable" ? "Lemah" : "Offline"}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
          Uji ketahanan sistem offline saat sinyal hilang:
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {(["healthy", "unstable", "offline"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => updateSimMode(mode)}
              className={`py-2 rounded-xl text-[9px] font-bold transition-all duration-150 active:scale-95 ${
                simMode === mode
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
              }`}
            >
              {mode === "healthy" ? "🟢 Kuat" : mode === "unstable" ? "🟡 Lemah" : "🔴 Offline"}
            </button>
          ))}
        </div>
      </div>

      {/* Manual Request Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-5">
        <h3 className="font-semibold text-slate-800 text-[12px] flex items-center gap-1.5 mb-1">
          <span>📝</span> Surat Keterangan Sela
        </h3>
        <p className="text-[10px] text-slate-500 leading-relaxed mb-4">
          Gunakan formulir ini untuk pengajuan Hadir Manual, Izin, atau Sakit jika terkendala GPS.
        </p>

        <form onSubmit={handleSubmitManual} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                {
                  type: "Hadir",
                  label: "🟢 Hadir",
                  activeClass:
                    "bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-300/50",
                },
                {
                  type: "Izin",
                  label: "🟡 Izin",
                  activeClass:
                    "bg-yellow-50 border-yellow-300 text-yellow-800 ring-2 ring-yellow-300/50",
                },
                {
                  type: "Sakit",
                  label: "🔵 Sakit",
                  activeClass: "bg-blue-50 border-blue-300 text-blue-800 ring-2 ring-blue-300/50",
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => setManualType(opt.type)}
                className={`py-2.5 rounded-xl border text-center font-semibold transition-all duration-150 text-[10px] active:scale-95 ${
                  manualType === opt.type
                    ? opt.activeClass
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Catatan Justifikasi <span className="text-rose-500">*</span>
            </label>
            <textarea
              placeholder="Rincikan perihal surat rekomendasi kedinasan atau detail sakit…"
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 border border-slate-200 bg-white text-slate-800 rounded-xl text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition resize-none"
              required={manualType !== "Hadir"}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmittingManual}
            className="w-full py-2.5 px-4 rounded-full font-semibold text-white text-xs bg-gradient-to-r from-violet-500 to-purple-600 shadow-md hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isSubmittingManual ? "Mengirim…" : "Kirim Berkas Pengajuan"}
          </button>
        </form>

        {todayRecord?.approvalStatus === "Pending" && (
          <div className="mt-4 flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-800">
            <span className="text-sm">⏳</span>
            <div>
              <p className="font-semibold text-[10px] uppercase tracking-wide">
                Surat Sedang Diverifikasi Atasan
              </p>
              <p className="text-[9px] mt-0.5 opacity-90 leading-relaxed">
                Tipe: <strong>{todayRecord.status}</strong>. Dalam proses pemeriksaan struktural Pimpinan.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Attendance History */}
      <div>
        <h3 className="font-semibold text-slate-600 text-[11px] uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
          <Activity size={12} className="text-indigo-600" /> Arsip Riwayat Presensi
        </h3>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-[10px] whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="px-3 py-2.5 font-semibold">Tanggal</th>
                <th className="px-3 py-2.5 font-semibold text-center">Masuk</th>
                <th className="px-3 py-2.5 font-semibold text-center">Pulang</th>
                <th className="px-3 py-2.5 font-semibold text-center">Status</th>
                <th className="px-3 py-2.5 font-semibold text-center">Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {attendance
                .filter((a) => a.userId === user?.id)
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 15)
                .map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition">
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {format(new Date(record.date), "dd MMM yy")}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono">{record.checkInTime || "—"}</td>
                    <td className="px-3 py-2.5 text-center font-mono">{record.checkOutTime || "—"}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          record.status === "Hadir"
                            ? "bg-emerald-100 text-emerald-700"
                            : record.status === "Terlambat"
                            ? "bg-amber-100 text-amber-700"
                            : record.status === "Izin"
                            ? "bg-blue-100 text-blue-700"
                            : record.status === "Sakit"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {record.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {record.isSynced ? (
                        <span className="text-emerald-500 font-bold">✓</span>
                      ) : (
                        <span className="text-amber-500 font-bold">⏳</span>
                      )}
                    </td>
                  </tr>
                ))}
              {attendance.filter((a) => a.userId === user?.id).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                    Belum ada riwayat presensi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // ── MAIN CONTENT ASSEMBLER ─────────────────────────────────
  // ─────────────────────────────────────────────────────────────
  const scanContent = (
    <div className="space-y-5">
      {/* Security alerts – always visible when present */}
      {isSecurityChecking && attendanceFlowStep === "idle" && (
        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200/80 rounded-2xl text-indigo-700 animate-pulse">
          <ShieldCheck size={15} className="shrink-0" />
          <div>
            <p className="font-semibold text-[11px]">Memverifikasi keamanan perangkat & GPS…</p>
            <p className="text-[10px] mt-0.5 text-indigo-500/90">Harap tunggu, proses berlangsung otomatis.</p>
          </div>
        </div>
      )}

      {securityAlert && securityAlert.violations.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-rose-50 border border-rose-200/80 rounded-2xl text-rose-700">
          <ShieldAlert size={15} className="shrink-0 mt-0.5 text-rose-500" />
          <div>
            <p className="font-semibold text-[11px] uppercase tracking-wide">⚠ Anomali Keamanan</p>
            <p className="text-[10px] text-rose-600/90 mt-0.5 leading-relaxed">
              {securityAlert.violations.join(", ")}. Presensi mungkin dibatasi.
            </p>
          </div>
        </div>
      )}

      {/* ── STEP: IDLE → Hero Status Card ─────────────────────── */}
      {attendanceFlowStep === "idle" && (
        <>
          {renderHeroStatusCard()}
          {renderSecondaryPanels()}
        </>
      )}

      {/* ── STEP: QR or SELFIE → Active scanner panel ─────────── */}
      {(attendanceFlowStep === "qr" || attendanceFlowStep === "selfie") && renderActiveScannerPanel()}

      {/* ── STEP: RESULT → Result card only ───────────────────── */}
      {attendanceFlowStep === "result" && renderResultCard()}
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // ── RENDER: MOBILE TEACHER LAYOUT ─────────────────────────
  // ─────────────────────────────────────────────────────────────
  if (isTeacherOrStaff) {
    return (
      <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col bg-slate-950 select-none md:my-6 md:rounded-3xl md:border md:border-slate-800/80 md:shadow-2xl overflow-hidden relative isolate">
          {/* TOP NAVBAR */}
          <header className="sticky top-0 z-30 w-full bg-blue-900 text-slate-100 px-4 sm:px-5 py-3.5 flex items-center justify-between shadow-lg shrink-0 backdrop-blur">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => navigate("/")}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition flex items-center justify-center mr-0.5 cursor-pointer"
                title="Kembali ke Beranda"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center p-1 border border-white/20 shrink-0 shadow-sm">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/e/ea/National_emblem_of_Indonesia_Garuda_Pancasila.svg"
                  alt="Garuda"
                  className="w-full h-full object-contain drop-shadow-md"
                />
              </div>
              <div className="text-left truncate">
                <h4 className="text-xs font-black tracking-widest leading-none font-mono truncate text-white">
                  PRESENSI MANDIRI
                </h4>
                <span className="text-[8px] opacity-90 uppercase leading-none mt-0.5 block font-bold truncate text-slate-300">
                  {school.name || "Pemerintah Kota Depok"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Bell
                size={16}
                className="text-white/90 hover:text-white cursor-pointer transition"
                onClick={() => toast("Tidak ada notifikasi baru")}
              />
              <button
                onClick={() => window.dispatchEvent(new Event("open_sidebar"))}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center justify-center cursor-pointer"
                title="Buka Menu Navigasi Utama"
              >
                <Menu size={18} className="text-white shrink-0" />
              </button>
            </div>
          </header>

          {/* SCROLL CONTENT */}
          <main className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4 pb-6 font-sans text-xs">
            {scanContent}
          </main>

          {/* BOTTOM TAB BAR */}
          <div className="sticky bottom-0 z-30 w-full bg-slate-950 backdrop-blur-md border-t border-slate-800 py-2.5 px-2 sm:px-4 flex justify-around items-center text-slate-600 shrink-0 select-none shadow-[0_-4px_10px_rgba(0,0,0,0.5)]">
            <button
              onClick={() => navigate("/")}
              className="flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 hover:text-slate-300 transition-colors"
            >
              <Smartphone size={16} />
              <span className="text-[9px] font-sans">Beranda</span>
            </button>
            <button className="flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 text-blue-400 font-black scale-105 transition-all">
              <Clock size={16} className="drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
              <span className="text-[9px] font-sans">Presensi</span>
            </button>
            <button
              onClick={() => navigate("/?tab=cuti")}
              className="flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 hover:text-slate-300 transition-colors"
            >
              <Calendar size={16} />
              <span className="text-[9px] font-sans">Izin/Cuti</span>
            </button>
            <button
              onClick={() => navigate("/?tab=kinerja")}
              className="flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 hover:text-slate-300 transition-colors"
            >
              <FileText size={16} />
              <span className="text-[9px] font-sans">Kinerja</span>
            </button>
            <button
              onClick={() => navigate("/?tab=riwayat")}
              className="flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 hover:text-slate-300 transition-colors"
            >
              <FileSpreadsheet size={16} />
              <span className="text-[9px] font-sans">Riwayat</span>
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 hover:text-slate-300 transition-colors"
            >
              <UserCircle size={16} />
              <span className="text-[9px] font-sans">Profil</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // ── RENDER: DESKTOP / ADMIN LAYOUT ─────────────────────────
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-4xl mx-auto text-left animate-fade-in font-sans text-xs">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Presensi Mandiri</h2>
        <span className="text-xs text-slate-400 font-medium">
          {format(new Date(), "EEEE, dd MMMM yyyy", { locale: id })}
        </span>
      </div>
      {scanContent}
    </div>
  );
}
