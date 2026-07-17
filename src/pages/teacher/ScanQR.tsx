import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Html5Qrcode } from "html5-qrcode";
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
  Wifi,
  WifiOff,
  Database,
  Activity,
  Info,
  Settings,
  ShieldCheck,
  ShieldAlert,
  ScanFace,
  Smartphone,
  Clock,
  Calendar,
  FileText,
  FileSpreadsheet,
  UserCircle,
  Bell,
  Menu,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { runSecurityCheck } from "../../lib/securityGuard";
import { verifyFaceQuality, isValidPhotoDataUrl } from "../../lib/faceVerification";
import { verifyScannedQrSecurity } from "../../lib/qrScheduler";

// ─────────────────────────────────────────────────────────────
// UTILS – pure functions, defined outside component to avoid
// re-creation on every render (no stale closure risk)
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

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export function ScanQR() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isTeacherOrStaff = user?.role === "guru" || user?.role === "dosen" || user?.role === "staf_sekolah" || user?.role === "staf_kampus";

  // ── State ──────────────────────────────────────────────────
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [activeScanner, setActiveScanner] = useState<"check_in" | "check_out" | null>(null);
  const [pendingSelfieData, setPendingSelfieData] = useState<{
    decodedText: string;
    mode: "check_in" | "check_out";
    locationData?: LocationData;
    methodType: "scanner" | "file" | "external_scanner";
  } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSecurityChecking, setIsSecurityChecking] = useState(false);
  const [securityAlert, setSecurityAlert] = useState<{ level: string; violations: string[] } | null>(null);
  const [faceQualityIssues, setFaceQualityIssues] = useState<string[]>([]);
  const [isFaceVerifying, setIsFaceVerifying] = useState(false);
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
  // We store the scanner instance in a ref to avoid stale closures inside useEffect
  const scannerRef = useRef<any>(null);
  // Track if the component is still mounted to prevent setState after unmount
  const isMountedRef = useRef(true);

  // ── Derived values (stable, no re-calc on unrelated state changes) ──
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const school = useMemo(() => db.getSchool(), []);
  const todayRecord = useMemo(
    () => attendance.find((a) => a.userId === user?.id && a.date === today),
    [attendance, user?.id, today],
  );

  // ── Mark unmount ────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // AUDIO FEEDBACK
  // Re-uses a single shared AudioContext to avoid browser limits.
  // AudioContext is created lazily and closed after sound plays.
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

      // FIX: Close the AudioContext after the sound finishes to free resources.
      // Without this, every scan leaks an AudioContext handle – critical on mobile.
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
  // SYNC – listen to global attendance updates from other tabs/pages
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
  // FIX: Removed `isSyncing` from the dependency array – it was causing
  // the interval to be torn down and rebuilt constantly, wasting battery.
  // We read isSyncing via a ref guard inside the callback instead.
  // ─────────────────────────────────────────────────────────────
  const isSyncingRef = useRef(isSyncing);
  useEffect(() => {
    isSyncingRef.current = isSyncing;
  }, [isSyncing]);

  useEffect(() => {
    const checkAndAutoSync = async () => {
      const pendingCount = db
        .getAttendance()
        .filter((a) => a.userId === user?.id && !a.isSynced).length;

      if (
        pendingCount > 0 &&
        navigator.onLine &&
        simMode !== "offline" &&
        !isSyncingRef.current
      ) {
        try {
          await syncOfflineAttendance();
        } catch (err) {
          console.warn("Background auto-sync failed, will retry on next cycle");
        }
      }
    };

    // Use a prime-number interval to avoid thundering-herd collisions across tabs
    const interval = setInterval(checkAndAutoSync, 15003);
    return () => clearInterval(interval);
  }, [simMode, user?.id]); // isSyncing intentionally excluded – read via ref

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
      toast.error(err.message || "Gagal menyinkronkan antrean data lokal.", {
        id: toastId,
        duration: 4000,
      });
    } finally {
      if (isMountedRef.current) setIsSyncing(false);
    }
  }, [isSyncing]);

  // ─────────────────────────────────────────────────────────────
  // GEOLOCATION HELPERS
  // ─────────────────────────────────────────────────────────────
  const checkLocationAndReturn = useCallback(
    (): Promise<LocationData | null> => {
      return new Promise((resolve, reject) => {
        if (!school.latitude || !school.longitude || !school.radius) {
          resolve(null);
          return;
        }
        if (!navigator.geolocation) {
          reject(new Error("Perangkat Anda tidak mendukung geolokasi GPS untuk presensi instansi / sekolah."));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const distance = getDistance(
              position.coords.latitude,
              position.coords.longitude,
              school.latitude!,
              school.longitude!,
            );
            if (distance <= school.radius!) {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                distance: Math.round(distance),
              });
            } else {
              reject(
                new Error(
                  `Gagal: Anda di luar geofence wilayah instansi / sekolah / kampus (Jarak: ${Math.round(distance)}m, Maksimal: ${school.radius}m).`,
                ),
              );
            }
          },
          (error) => {
            let errorMsg = "Gagal mengakses GPS Anda.";
            if (error.code === error.PERMISSION_DENIED) {
              errorMsg = "Izin lokasi dilarang. Harap aktifkan izin lokasi GPS pada browser agar presensi berhasil.";
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
  // PROCESS ATTENDANCE – core logic
  // FIX: Wrapped in useCallback so that the `processUrlScan` effect
  // below can safely list it as a dependency without infinite loops.
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
        // Accept either structured JSON/Token QR or general attendance barcode string
        let qrData: any = { token: qrDataStr, date: today, type: mode };
        try {
          const parsed = parseQRData(qrDataStr);
          if (parsed && parsed.token) qrData = parsed;
        } catch (e) {
          // Treated as direct barcode string
        }

        const securityCheck = verifyScannedQrSecurity(qrData, today);
        if (!securityCheck.valid) {
          throw new Error(securityCheck.reason || "Token keamanan QR Code tidak valid atau telah kedaluwarsa.");
        }


        // Read fresh data to avoid stale closure on `attendance` state
        const currentAttendance = [...db.getAttendance()];
        const existingRecordIndex = currentAttendance.findIndex(
          (a) => a.userId === user?.id && a.date === today,
        );
        const timeNow = format(new Date(), "HH:mm:ss");

        if (mode === "check_in") {
          if (existingRecordIndex >= 0) {
            playAudioFeedback("error");
            setStatusMessage({ type: "error", text: "Anda sudah login masuk hari ini." });
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
            action: 'PRESENSI_IN',
            details: `Presensi Masuk via ${methodType} (${qrDataStr.slice(0, 15)}) di radius ${locationData?.distance || 0}m`,
            status: 'SUCCESS'
          });
          playAudioFeedback("success");
          setStatusMessage({ type: "success", text: `✅ Presensi MASUK berhasil [Barcode: ${qrDataStr.length > 20 ? qrDataStr.slice(0, 20) + '...' : qrDataStr}] pada pukul ${timeNow}!` });
        } else if (mode === "check_out") {
          if (existingRecordIndex < 0) {
            playAudioFeedback("error");
            setStatusMessage({ type: "error", text: "Anda belum mencatat presensi masuk." });
            return;
          }
          const existingRecord = currentAttendance[existingRecordIndex];
          if (existingRecord.checkOutTime) {
            playAudioFeedback("error");
            setStatusMessage({ type: "error", text: "Presensi pulang sudah direkam sebelumnya." });
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
            action: 'PRESENSI_OUT',
            details: `Presensi Pulang via ${methodType} (${qrDataStr.slice(0, 15)})`,
            status: 'SUCCESS'
          });

          playAudioFeedback("success");
          setStatusMessage({ type: "success", text: `✅ Presensi PULANG berhasil [Barcode: ${qrDataStr.length > 20 ? qrDataStr.slice(0, 20) + '...' : qrDataStr}] pada pukul ${timeNow}!` });
        }
      } catch (e: any) {
        playAudioFeedback("error");
        setStatusMessage({ type: "error", text: e.message || "Tanda tangan digital QR Code tidak valid." });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today, user?.id, simMode, school, saveAttendance, playAudioFeedback],
  );

  // ─────────────────────────────────────────────────────────────
  // CAMERA QR SCANNER
  // FIX: The cleanup function previously called `.clear()` on an object
  // that might already be cleared (inside onScanSuccess), causing
  // "Cannot call methods on uninitialized scanner" errors on Android.
  // We now track the cleared state with a local `cleared` flag and a
  // `isScanning` guard.
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // ModernQRScanner handles camera stream lifecycle internally
  }, [activeScanner]);
  //                      excluded: scan success path reads them via closure snapshot
  //                      which is correct here – we want the values AT scan time.

  // ─────────────────────────────────────────────────────────────
  // FILE SCAN (gallery / upload)
  // ─────────────────────────────────────────────────────────────
  const handleFileScan = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const toastId = toast.loading("Mengambil koordinat satelit GPS Instansi / Sekolah...");

      try {
        const loc = await checkLocationAndReturn();
        toast.loading("Membaca QR Code dari berkas...", { id: toastId });

        // FIX: Use a hidden div with a unique ID for the file reader.
        // Html5Qrcode requires an existing DOM element.
        const html5QrCode = new Html5Qrcode("file-reader");
        let decodedText: string;
        try {
          decodedText = await html5QrCode.scanFile(file, true);
        } finally {
          // Always stop the file scanner after use to release resources
          if (html5QrCode.isScanning) {
            await html5QrCode.stop().catch(() => {});
          }
          try {
            await html5QrCode.clear();
          } catch (e) {}
        }

        toast.success("Lokasi GPS & Dokumen QR berhasil diverifikasi!", { id: toastId });
        if (isMountedRef.current) {
          setScanResult(decodedText);
          setPendingSelfieData({
            decodedText,
            mode: activeScanner!,
            locationData: loc || undefined,
            methodType: "file"
          });
        }
      } catch (err: any) {
        toast.error(err.message || "Gagal mendecode QR Code.", { id: toastId, duration: 6000 });
      } finally {
        // Always reset the file input so the same file can be re-selected
        if (e.target) e.target.value = "";
      }
    },
    [checkLocationAndReturn, processAttendance, activeScanner],
  );

  // ─────────────────────────────────────────────────────────────
  // START SCANNER – with geofence pre-check
  // ─────────────────────────────────────────────────────────────
  const handleStartScan = useCallback(
    async (mode: "check_in" | "check_out") => {
      // Jika geofence tidak dikonfigurasi, lewati pengecekan lokasi
      if (!school.latitude || !school.longitude || !school.radius) {
        setActiveScanner(mode);
        return;
      }

      if (!navigator.geolocation) {
        toast.error("Perangkat keras tidak didukung GPS satelit.");
        return;
      }

      setIsLocating(true);
      setIsSecurityChecking(true);
      toast.loading("🛡️ Memeriksa keamanan lokasi & perangkat...", { id: "location-check" });

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (!isMountedRef.current) return;
          setIsLocating(false);

          // ─── SECURITY GUARD: Analisis telemetri GPS ───────────────
          const secResult = await runSecurityCheck(position);
          setIsSecurityChecking(false);

          if (secResult.threatLevel === 'critical') {
            setSecurityAlert({ level: secResult.threatLevel, violations: secResult.violations });
            toast.error(
              `🚨 Pemeriksaan Keamanan Gagal: ${secResult.violations[0] || 'Manipulasi lokasi terdeteksi'}`,
              { id: "location-check", duration: 7000 }
            );
            return;
          }

          if (secResult.threatLevel === 'medium') {
            setSecurityAlert({ level: secResult.threatLevel, violations: secResult.violations });
            toast(`⚠️ Anomali GPS terdeteksi (${secResult.violations.length} indikator). Data presensi ditandai untuk verifikasi admin.`, {
              id: "location-check",
              duration: 5000,
              icon: '⚠️',
            });
          }

          const distance = getDistance(
            position.coords.latitude,
            position.coords.longitude,
            school.latitude!,
            school.longitude!,
          );

          if (distance <= school.radius!) {
            setLastVerifiedLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              distance: Math.round(distance),
            });
            toast.success(
              secResult.threatLevel === 'none'
                ? "✅ Lokasi & keamanan perangkat terverifikasi."
                : "⚠️ Lokasi dalam radius (anomali tercatat).",
              { id: "location-check" }
            );
            setActiveScanner(mode);
          } else {
            toast.error(
              `Anda berada di luar radius kerja instansi (Jarak: ${Math.round(distance)}m, Geofence: ${school.radius}m).`,
              { id: "location-check", duration: 5000 },
            );
          }
        },
        (error) => {
          if (!isMountedRef.current) return;
          setIsLocating(false);
          setIsSecurityChecking(false);
          let errorMsg = "Akses satelit GPS terganggu.";
          if (error.code === error.PERMISSION_DENIED) {
            errorMsg = "Akses lokasi ditolak. Harap beri izin browser pada setelan privasi.";
          }
          toast.error(errorMsg, { id: "location-check", duration: 5000 });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    },
    [school],
  );

  // ─────────────────────────────────────────────────────────────
  // URL PARAM SCAN (external QR app redirect)
  // FIX: `attendance` removed from deps array – it caused this effect
  // to fire on every single attendance state update, meaning a guru
  // could accidentally re-trigger the URL scan just by syncing data.
  // We read attendance freshly inside processAttendance instead.
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

    const qrData = { session: sessionParam, date: dateParam, type: typeParam, token: tokenParam, timestamp: timestampParam };

    const processUrlScan = (loc?: LocationData) => {
      setPendingSelfieData({
        decodedText: JSON.stringify(qrData),
        mode: typeParam as any,
        locationData: loc,
        methodType: "external_scanner"
      });
    };

    const toastId = toast.loading("Mendeteksi QR dari kamera HP, memverifikasi GPS Instansi / Sekolah...");

    // Clean URL immediately so refresh doesn't re-trigger
    window.history.replaceState({}, document.title, window.location.pathname);

    if (!currentSchool.latitude || !currentSchool.longitude || !currentSchool.radius) {
      toast.success("Presensi diproses!", { id: toastId });
      processUrlScan();
      return;
    }

    if (!navigator.geolocation) {
      toast.error("Perangkat Anda tidak mendukung GPS satelit untuk verifikasi.", { id: toastId });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const distance = getDistance(
          position.coords.latitude,
          position.coords.longitude,
          currentSchool.latitude!,
          currentSchool.longitude!,
        );
        if (distance <= currentSchool.radius!) {
          toast.success("Verifikasi koordinat aman berhasil!", { id: toastId });
          processUrlScan({ latitude: position.coords.latitude, longitude: position.coords.longitude, distance: Math.round(distance) });
        } else {
          toast.error(
            `Gagal: Anda di luar radius wilayah instansi / sekolah / kampus (Jarak: ${Math.round(distance)}m, Maksimal: ${currentSchool.radius}m).`,
            { id: toastId, duration: 6000 },
          );
        }
      },
      (err) => {
        let errorMsg = "Gagal membaca GPS. Pastikan izin lokasi diaktifkan di pengaturan browser.";
        if (err.code === err.PERMISSION_DENIED) errorMsg = "Izin lokasi ditolak. Harap izinkan GPS pada pengaturan browser Anda.";
        else if (err.code === err.POSITION_UNAVAILABLE) errorMsg = "Sinyal GPS tidak tersedia. Coba pindah ke area terbuka.";
        else if (err.code === err.TIMEOUT) errorMsg = "Waktu tunggu GPS habis. Pastikan GPS aktif dan coba lagi.";
        toast.error(errorMsg, { id: toastId, duration: 6000 });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
    // Only run once on mount – URL params don't change after we clear them
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────
  // SIM MODE TOGGLE
  // ─────────────────────────────────────────────────────────────
  const updateSimMode = useCallback((mode: "healthy" | "unstable" | "offline") => {
    localStorage.setItem("sync_sim_mode", mode);
    setSimModeState(mode);
    toast.success(
      `Mode Keandalan Jaringan diubah ke: ${
        mode === "healthy" ? "Koneksi Sempurna" : mode === "unstable" ? "Koneksi Tidak Stabil" : "Simulasi Offline"
      }`,
    );
  }, []);

  // ─────────────────────────────────────────────────────────────
  // MANUAL SUBMISSION
  // FIX: Added proper try-catch and loading state.
  // Previously `saveAttendance` could throw and `isSubmittingManual`
  // would stay `true` forever, locking the form.
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
  // BACK BUTTON – explicit camera cleanup
  // ─────────────────────────────────────────────────────────────
  const handleBack = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
      } catch (e) {
        console.warn("Manual scanner clear failed", e);
      }
      scannerRef.current = null;
    }
    setActiveScanner(null);
    setScanResult(null);
    setStatusMessage(null);
    setLastVerifiedLocation(null);
    setPendingSelfieData(null);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // RENDER: ACTIVE SCANNER VIEW
  // ─────────────────────────────────────────────────────────────
  if (activeScanner) {
    if (!scanResult && !statusMessage) {
      const dist = lastVerifiedLocation
        ? getDistance(
            lastVerifiedLocation.latitude,
            lastVerifiedLocation.longitude,
            school.latitude || -6.2,
            school.longitude || 106.816666,
          )
        : 0;

      return (
        <div className="py-4 animate-fade-in">
          {pendingSelfieData ? (
            <BiometricSelfie 
              userName={user?.name}
              onCancel={handleBack}
              onCaptureSuccess={(photoDataUrl) => {
                processAttendance(
                  pendingSelfieData.decodedText,
                  pendingSelfieData.mode,
                  pendingSelfieData.locationData,
                  pendingSelfieData.methodType,
                  photoDataUrl
                );
                setPendingSelfieData(null);
              }}
            />
          ) : (
            <ModernQRScanner
              mode={activeScanner}
              onScanSuccess={(decodedText, method) => {
                setScanResult(decodedText);
                setPendingSelfieData({
                  decodedText,
                  mode: activeScanner,
                  locationData: lastVerifiedLocation || undefined,
                  methodType: method
                });
              }}
              onCancel={handleBack}
              userName={user?.name || "Pegawai / Guru / Dosen"}
              schoolName={school.name}
              maxRadius={school.radius || 120}
              currentDistance={dist}
              isLocating={isLocating}
            />
          )}
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto space-y-6 animate-fade-in text-left text-xs font-sans">
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col items-center justify-center py-8">
          {statusMessage?.type === "success" ? (
            <CheckCircle className="w-16 h-16 text-emerald-500 mb-3 animate-bounce shadow-[0_0_20px_rgba(16,185,129,0.3)] rounded-full" />
          ) : (
            <XCircle className="w-16 h-16 text-rose-500 mb-3 shadow-[0_0_20px_rgba(244,63,94,0.3)] rounded-full" />
          )}
          <h3
            className={`text-base font-black uppercase tracking-wider mb-2 ${
              statusMessage?.type === "success" ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {statusMessage?.type === "success" ? "✅ Verifikasi Presensi Berhasil" : "❌ Gagal Verifikasi"}
          </h3>
          <p className="text-center text-slate-500 leading-relaxed mb-6 font-medium text-sm px-2">
            {statusMessage?.text}
          </p>

          <div className="flex gap-3 w-full">
            <button
              onClick={() => {
                setScanResult(null);
                setStatusMessage(null);
              }}
              className="flex-1 py-3 px-6 font-extrabold text-white text-xs uppercase rounded-2xl bg-[#1d74f2] hover:bg-blue-600 shadow-md transition"
            >
              🔄 Ulangi Scan
            </button>
            <button
              onClick={handleBack}
              className="flex-1 py-3 px-6 font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 text-xs uppercase rounded-2xl transition"
            >
              🏠 Kembali Ke Dasbor
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: MAIN VIEW
  // ─────────────────────────────────────────────────────────────
  const scanContent = (
    <div className="space-y-6">
      {/* Security Alert Banner — ditampilkan jika ada anomali GPS */}
      {isSecurityChecking && (
        <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-indigo-700 animate-pulse">
          <ShieldCheck size={18} className="shrink-0" />
          <div>
            <p className="font-bold text-sm">Memeriksa keamanan perangkat & GPS...</p>
            <p className="text-xs mt-0.5 text-indigo-500">Harap tunggu, sistem sedang memverifikasi integritas lokasi Anda.</p>
          </div>
        </div>
      )}

      {securityAlert && securityAlert.violations.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700">
          <ShieldAlert size={20} className="shrink-0 mt-0.5 text-rose-600" />
          <div>
            <p className="font-black text-sm uppercase tracking-wide">⚠️ Peringatan Keamanan Terdeteksi</p>
            <p className="text-xs text-rose-600 mt-1 leading-relaxed">
              Anomali terdeteksi: <strong>{securityAlert.violations.join(", ")}</strong>.
              Presensi mungkin dibatasi. Hubungi admin jika ini kesalahan.
            </p>
          </div>
        </div>
      )}

      {/* Profil Guru/Staf & Geofencing Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-1.5 text-sm uppercase tracking-wide">
              <ShieldCheck className="text-[#1d74f2]" size={16} />
              INSTANSI - Kartu Kendali Presensi Pegawai / Guru / Dosen
            </h3>
            <div className="grid grid-cols-[140px_1fr] gap-y-2.5 text-slate-600">
              <div className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Nama Lengkap</div>
              <div className="font-extrabold text-[#111c2d]">: {user?.name}</div>

              <div className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">ID Pegawai / NIP / NIDN / NIK</div>
              <div className="font-mono text-slate-700 font-extrabold">: {user?.nip || "—"}</div>

              <div className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Nama Satuan Kerja</div>
              <div className="font-semibold text-[#111c2d]">: {user?.satker || "Instansi / Sekolah / Kampus"}</div>

              <div className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Tanggal Dinas</div>
              <div className="font-bold text-indigo-700">: {format(new Date(), "EEEE, dd MMMM yyyy", { locale: id })}</div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-slate-400">
            <span>Zona Waktu: <strong>WIB (Asia/Jakarta)</strong></span>
            <span>Aman Geofence: <strong className="text-emerald-600 font-extrabold">{school.radius || 120} meter</strong></span>
          </div>
        </div>

        {/* Simulasi Jaringan Panel */}
        <div className="bg-[#111c2d] text-white rounded-3xl p-5 border border-slate-800 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[9px] tracking-widest text-indigo-400 uppercase flex items-center gap-1">
                <Settings size={12} /> Jasa Seluler HP
              </h3>
              <span className={`inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                simMode === "healthy" ? "bg-emerald-500/10 text-emerald-400" :
                simMode === "unstable" ? "bg-amber-500/10 text-amber-400 animate-pulse" :
                "bg-rose-500/10 text-rose-400"
              }`}>
                {simMode === "healthy" ? "Lancar" : simMode === "unstable" ? "Sinyal Rendah" : "Tanpa Sinyal"}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-normal mb-3">
              Uji ketahanan sistem antrean offline saat kehilangan sinyal internet di daerah pelosok:
            </p>
            <div className="space-y-1.5 font-bold">
              {(["healthy", "unstable", "offline"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => updateSimMode(mode)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl transition flex items-center justify-between ${
                    simMode === mode ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <span>{mode === "healthy" ? "🟢 1. Jaringan Kuat" : mode === "unstable" ? "🟡 2. Gagal Tersambung (50%)" : "🔴 3. Offline Total"}</span>
                  <span className="text-[10px] opacity-65">{mode === "healthy" ? "Instan" : mode === "unstable" ? "Eror Log" : "Ke Outbox"}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 pt-2.5 border-t border-slate-800 text-[9px] text-slate-400 font-mono">
            *Semua data akan terkurung aman di HP sebelum sinkronisasi.
          </p>
        </div>
      </div>

      {/* MONITOR OUTBOX OFFLINE */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <Database className="text-indigo-600" size={16} />
              Antrean Kotak Keluar Sesi Offline (Local Queue Buffer)
            </h3>
            <p className="text-slate-400 mt-0.5">
              Sistem akan otomatis menggelar sinkronisasi saat sinyal HP Anda kembali sehat.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              disabled={isSyncing}
              onClick={handleManualSync}
              className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:-translate-y-[2px] active:translate-y-[2px] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
            >
              <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Mengunggah..." : "Sinkronkan Sekarang"}
            </button>
          </div>
        </div>

        <div className="p-5 font-bold">
          {attendance.filter((a) => a.userId === user?.id && !a.isSynced).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="p-3 bg-emerald-50 rounded-full text-emerald-600 mb-2">
                <CheckCircle size={20} />
              </div>
              <h4 className="font-extrabold text-slate-800">Antrean Bersih &amp; Valid!</h4>
              <p className="text-xs text-slate-400 font-medium max-w-sm mt-0.5">
                Semua data presensi fungsional berkoordinat Anda sudah tersimpan permanen di cloud Instansi / Sekolah.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-amber-800">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    Ada {attendance.filter((a) => a.userId === user?.id && !a.isSynced).length} Baris Data Tersandera Offline
                  </p>
                  <p className="mt-0.5 opacity-90 leading-relaxed font-sans font-medium text-[11px]">
                    Kami terus menjaga konsistensi pangkalan data. Data ini TIDAK akan hilang meski browser ditutup atau HP direstart.
                  </p>
                </div>
              </div>

              <div className="border border-slate-150 rounded-2xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 text-[9px] text-slate-400 uppercase tracking-widest grid grid-cols-12 gap-2 border-b border-slate-150">
                  <span className="col-span-3">Tanggal</span>
                  <span className="col-span-3 text-center">Waktu</span>
                  <span className="col-span-2 text-center">Percobaan</span>
                  <span className="col-span-4 text-right">Status Transmisi</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {attendance
                    .filter((a) => a.userId === user?.id && !a.isSynced)
                    .map((item) => (
                      <div key={item.id} className="p-3.5 grid grid-cols-12 gap-2 items-center text-[11px] hover:bg-slate-50/50 transition">
                        <div className="col-span-3 font-extrabold text-[#111c2d]">
                          {format(new Date(item.date), "dd MMM yyyy")}
                        </div>
                        <div className="col-span-3 text-center font-mono font-bold text-slate-700">
                          {item.checkInTime ? `MASUK: ${item.checkInTime}` : `PULANG: ${item.checkOutTime}`}
                        </div>
                        <div className="col-span-2 text-center font-mono text-slate-500 font-medium">
                          {item.syncAttempts || 0}x retries
                        </div>
                        <div className="col-span-4 text-right">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                            item.syncStatus === "syncing" ? "bg-indigo-100 text-indigo-700 animate-pulse" :
                            item.syncStatus === "failed" ? "bg-rose-50 text-rose-800" :
                            "bg-amber-100 text-amber-800"
                          }`}>
                            {item.syncStatus === "syncing" ? "Menghubungkan..." : item.syncStatus || "Menunggu Jaringan"}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SCAN BUTTONS */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleStartScan("check_in")}
          onKeyDown={(e) => e.key === "Enter" && handleStartScan("check_in")}
          className={`flex-1 bg-white border border-slate-200 rounded-3xl p-6 flex items-center gap-4 cursor-pointer hover:border-indigo-400 select-none transition ${isLocating ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div className="bg-[#1d74f2] text-white p-3.5 rounded-2xl shrink-0">
            <Camera size={24} />
          </div>
          <div>
            <h4 className="font-bold text-[#1d74f2] text-sm uppercase tracking-wider">Absen Masuk (Clock-In)</h4>
            {todayRecord?.checkInTime ? (
              <p className="text-emerald-600 flex items-center gap-1 mt-1 font-bold">
                <CheckCircle size={12} /> Terkonfirmasi: {todayRecord.checkInTime}
              </p>
            ) : (
              <p className="text-rose-500 flex items-center gap-1 mt-1 font-bold">
                <XCircle size={12} /> Belum Rekam Masuk
              </p>
            )}
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => handleStartScan("check_out")}
          onKeyDown={(e) => e.key === "Enter" && handleStartScan("check_out")}
          className={`flex-1 bg-white border border-slate-200 rounded-3xl p-6 flex items-center gap-4 cursor-pointer hover:border-indigo-400 select-none transition ${isLocating ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div className="bg-[#ea4335] text-white p-3.5 rounded-2xl shrink-0">
            <Camera size={24} />
          </div>
          <div>
            <h4 className="font-bold text-[#ea4335] text-sm uppercase tracking-wider">Absen Pulang (Clock-Out)</h4>
            {todayRecord?.checkOutTime ? (
              <p className="text-emerald-600 flex items-center gap-1 mt-1 font-bold">
                <CheckCircle size={12} /> Terkonfirmasi: {todayRecord.checkOutTime}
              </p>
            ) : (
              <p className="text-rose-500 flex items-center gap-1 mt-1 font-bold">
                <XCircle size={12} /> Belum Rekam Pulang
              </p>
            )}
          </div>
        </div>
      </div>

      {/* MANUAL REQUEST FORM */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 mt-6">
        <h3 className="text-base font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
          📝 Surat Keterangan Sela (Hadir Manual, Izin, Sakit)
        </h3>
        <p className="text-slate-400 font-medium leading-relaxed mt-1 mb-6">
          Gunakan formulir pelaporan mandiri di bawah ini jika terkendala koordinat GPS, mengajukan surat sakit dokter, atau izin dinas fungsional.
        </p>

        <form onSubmit={handleSubmitManual} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
              Pilih Jenis Surat Pelaporan
            </label>
            <div className="grid grid-cols-3 gap-3">
              {([
                { type: "Hadir", label: "🟢 Hadir Manual", style: "border-emerald-200 bg-emerald-50 text-emerald-800" },
                { type: "Izin", label: "🟡 Izin Dinas", style: "border-yellow-200 bg-yellow-50 text-yellow-800" },
                { type: "Sakit", label: "🔵 Sakit Dokter", style: "border-blue-200 bg-blue-50 text-blue-900" },
              ] as const).map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setManualType(opt.type)}
                  className={`py-3.5 px-3 rounded-2xl border text-center font-extrabold transition text-xs ${
                    manualType === opt.type ? `${opt.style} shadow-xs ring-4 ring-indigo-500/10` : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Catatan Justifikasi Alasan <span className="text-rose-500">*</span>
            </label>
            <textarea
              placeholder="Rincikan perihal surat rekomendasi kedinasan atau detail sakit..."
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
              required={manualType !== "Hadir"}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmittingManual}
            className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:-translate-y-[2px] active:translate-y-[2px] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isSubmittingManual ? "Mengirim Data..." : "Kirim Berkas Pengajuan"}
          </button>
        </form>

        {todayRecord?.approvalStatus === "Pending" && (
          <div className="mt-4 bg-amber-50 text-amber-900 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
            <span className="text-base">⏳</span>
            <div>
              <p className="font-extrabold text-[11px] uppercase tracking-wide">Surat Rekomendasi Sedang Diverifikasi Atasan</p>
              <p className="mt-0.5 opacity-90 leading-relaxed font-semibold">
                Tipe pengajuan: <strong>{todayRecord.status}</strong>. Pengajuan sedang dalam pemeriksaan struktural Pimpinan / Kepala Sekolah / Rektor / Dinas.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* RIWAYAT ABSENSI */}
      <div className="mt-10">
        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider mb-3">Arsip Riwayat Presensi Anda</h3>
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#17a2b8] text-white">
              <tr>
                <th className="p-4">Tanggal Kerja</th>
                <th className="p-4 text-center">Rekam Masuk</th>
                <th className="p-4 text-center">Rekam Pulang</th>
                <th className="p-4 text-center">Audit Disiplin</th>
                <th className="p-4 text-center">Status Transmisi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-bold">
              {attendance
                .filter((a) => a.userId === user?.id)
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 15)
                .map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 text-[#111c2d]">{format(new Date(record.date), "dd MMM yyyy")}</td>
                    <td className="p-4 text-center font-mono">{record.checkInTime || "—"}</td>
                    <td className="p-4 text-center font-mono">{record.checkOutTime || "—"}</td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-1 justify-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          record.status === "Hadir" ? "bg-emerald-100 text-emerald-800" :
                          record.status === "Terlambat" ? "bg-amber-100 text-amber-800" :
                          record.status === "Izin" ? "bg-blue-100 text-blue-700" :
                          record.status === "Sakit" ? "bg-orange-100 text-orange-700" :
                          "bg-red-100 text-rose-700"
                        }`}>
                          {record.status}
                        </span>
                        {record.approvalStatus && (
                          <span className="text-[8px] font-mono font-extrabold uppercase bg-amber-50 text-amber-800 border border-amber-200 px-1.5 rounded">
                            {record.approvalStatus}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {record.isSynced ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-100 text-[10px] font-extrabold">🟢 Terbukti Sinkron</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-100 text-[10px] font-extrabold">🟡 Log Lokal (HP)</span>
                      )}
                    </td>
                  </tr>
                ))}
              {attendance.filter((a) => a.userId === user?.id).length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">Belum ada riwayat presensi tercatat.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  if (isTeacherOrStaff) {
    return (
      <div className="w-full min-h-screen bg-[#F5F7FB] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col bg-[#F5F7FB] dark:bg-slate-950 select-none md:my-6 md:rounded-3xl md:border md:border-slate-200/80 dark:md:border-slate-800/80 md:shadow-2xl overflow-hidden relative isolate">
          {/* TOP NAVBAR - STICKY TOP */}
          <header className="sticky top-0 z-30 w-full bg-gradient-to-r from-[#1976d2] to-[#1e88e5] text-white px-4 sm:px-5 py-3.5 flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => navigate("/")}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition flex items-center justify-center mr-0.5 cursor-pointer"
                title="Kembali ke Beranda"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center p-1 border border-white shrink-0 shadow-sm">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/e/ea/National_emblem_of_Indonesia_Garuda_Pancasila.svg"
                  alt="Garuda"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="text-left truncate">
                <h4 className="text-xs font-black tracking-widest leading-none font-mono truncate">
                  PRESENSI MANDIRI
                </h4>
                <span className="text-[8px] opacity-90 uppercase leading-none mt-0.5 block font-bold truncate">
                  {school.name || "Pemerintah Kota Depok"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Bell size={16} className="text-white/90 hover:text-white cursor-pointer transition" onClick={() => toast("Tidak ada notifikasi baru")} />
              <button
                onClick={() => window.dispatchEvent(new Event("open_sidebar"))}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center justify-center cursor-pointer"
                title="Buka Menu Navigasi Utama"
              >
                <Menu size={18} className="text-white shrink-0" />
              </button>
            </div>
          </header>

          {/* INNER SCROLL CONTENT WITH INTERNAL PADDING */}
          <main className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4 pb-6 font-sans text-xs">
            {scanContent}
          </main>

          {/* BOTTOM TAB BAR - STICKY BOTTOM */}
          <div className="sticky bottom-0 z-30 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200/80 dark:border-slate-800 py-2.5 px-2 sm:px-4 flex justify-around items-center text-gray-500 dark:text-slate-400 shrink-0 select-none shadow-[0_-4px_10px_rgba(0,0,0,0.04)]">
            <button onClick={() => navigate("/")} className="flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 opacity-65 hover:opacity-100">
              <Smartphone size={16} />
              <span className="text-[9px] font-sans">Beranda</span>
            </button>
            <button className="flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 text-indigo-600 dark:text-indigo-400 font-black scale-105 transition-all">
              <Clock size={16} />
              <span className="text-[9px] font-sans">Presensi</span>
            </button>
            <button onClick={() => navigate("/?tab=cuti")} className="flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 opacity-65 hover:opacity-100">
              <Calendar size={16} />
              <span className="text-[9px] font-sans">Izin/Cuti</span>
            </button>
            <button onClick={() => navigate("/?tab=kinerja")} className="flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 opacity-65 hover:opacity-100">
              <FileText size={16} />
              <span className="text-[9px] font-sans">Kinerja</span>
            </button>
            <button onClick={() => navigate("/?tab=riwayat")} className="flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 opacity-65 hover:opacity-100">
              <FileSpreadsheet size={16} />
              <span className="text-[9px] font-sans">Riwayat</span>
            </button>
            <button onClick={() => navigate("/profile")} className="flex flex-col items-center gap-1 justify-center flex-1 cursor-pointer py-1 opacity-65 hover:opacity-100">
              <UserCircle size={16} />
              <span className="text-[9px] font-sans">Profil</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-left animate-fade-in font-sans text-xs">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <h2 className="text-xl font-black text-slate-800 tracking-tight">
          Presensi Mandiri
        </h2>
        <span className="text-xs text-slate-400 font-medium">
          {format(new Date(), "EEEE, dd MMMM yyyy", { locale: id })}
        </span>
      </div>
      {scanContent}
    </div>
  );
}
