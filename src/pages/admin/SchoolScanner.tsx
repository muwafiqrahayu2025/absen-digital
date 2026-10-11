import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { format } from "date-fns";
import { id as localeID } from "date-fns/locale";
import { db } from "../../lib/db";
import { User, AttendanceRecord, School } from "../../types";
import {
  Scan,
  Camera,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Volume2,
  VolumeX,
  Users,
  AlertTriangle,
  Play,
  Square,
  Building,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "react-hot-toast";

// ─────────────────────────────────────────────────────────────
// AUDIO – shared lazy AudioContext to avoid per-scan leak
// ─────────────────────────────────────────────────────────────
const playAudioCue = (type: "success" | "error", soundEnabled: boolean) => {
  if (!soundEnabled) return;
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return;

    const audioCtx = new AudioCtxClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const duration = type === "success" ? 0.2 : 0.35;

    if (type === "success") {
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
    } else {
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
      oscillator.frequency.linearRampToValueAtTime(180, audioCtx.currentTime + duration);
    }

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);

    // FIX: Close AudioContext after playback to free OS audio handles.
    // Failing to do this on Android causes the scanner to gradually slow
    // down and eventually freeze when the audio subsystem runs out of handles.
    oscillator.onended = () => audioCtx.close().catch(() => {});
  } catch (e) {
    console.warn("Play audio feedback failed", e);
  }
};

export function SchoolScanner() {
  // ── State ──────────────────────────────────────────────────
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [scannedResult, setScannedResult] = useState<{
    success: boolean;
    message: string;
    teacher?: User;
    record?: AttendanceRecord;
    mode?: "check_in" | "check_out";
  } | null>(null);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(5);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);

  // ── Refs ───────────────────────────────────────────────────
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard against state updates after unmount
  const isMountedRef = useRef(true);
  // Guard against duplicate QR scans while modal is showing
  const isModalActiveRef = useRef(false);

  // ── Stable derived values ──────────────────────────────────
  const school: School = useMemo(() => ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any), []);
  // BUG-11 FIX: todayStr must refresh at midnight; use state + interval instead of frozen useMemo
  const [todayStr, setTodayStr] = React.useState(() => format(new Date(), "yyyy-MM-dd"));
  React.useEffect(() => {
    const refreshAtMidnight = () => {
      const now = new Date();
      setTodayStr(format(now, "yyyy-MM-dd"));
      // Schedule next refresh at exactly next midnight
      const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
      return setTimeout(() => {
        setTodayStr(format(new Date(), "yyyy-MM-dd"));
        refreshAtMidnight();
      }, msUntilMidnight);
    };
    const timer = refreshAtMidnight();
    return () => clearTimeout(timer);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // LIFECYCLE – track mount state
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // DIGITAL CLOCK – ticks every second
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      if (isMountedRef.current) setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // CAMERA ENUMERATION
  // FIX: Previously no error UI was shown if getCameras() failed.
  // We now handle the case gracefully and inform the operator.
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMountedRef.current) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back/environment camera on mobile devices
          const backCamera = devices.find(
            (d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("environment"),
          );
          setSelectedCameraId(backCamera ? backCamera.id : devices[0].id);
        } else {
          toast.error("Tidak ada perangkat kamera/webcam terdeteksi.");
        }
      })
      .catch((err) => {
        console.error("Error fetching cameras:", err);
        toast.error("Gagal mendeteksi kamera. Pastikan izin kamera aktif di browser/OS.");
      });
  }, []);

  // ─────────────────────────────────────────────────────────────
  // ATTENDANCE LOG FETCH
  // ─────────────────────────────────────────────────────────────
  const fetchTodayLogs = useCallback(() => {
    const allAttendance = db.getAttendance();
    const allUsers = db.getUsers();

    const logs = allAttendance
      .filter((a) => a.date === todayStr)
      .map((a) => ({ ...a, user: allUsers.find((u) => u.id === a.userId) }))
      .sort((a, b) => {
        const timeA = a.checkOutTime || a.checkInTime || "";
        const timeB = b.checkOutTime || b.checkInTime || "";
        return timeB.localeCompare(timeA); // newest first
      });

    if (isMountedRef.current) setTodayLogs(logs);
  }, [todayStr]);

  useEffect(() => {
    fetchTodayLogs();
    const handleSync = () => fetchTodayLogs();
    window.addEventListener("attendance_synchronized", handleSync);
    return () => window.removeEventListener("attendance_synchronized", handleSync);
  }, [fetchTodayLogs]);

  // ─────────────────────────────────────────────────────────────
  // MODAL TIMERS
  // ─────────────────────────────────────────────────────────────
  const clearModalTimers = useCallback(() => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (modalTimeoutRef.current) clearTimeout(modalTimeoutRef.current);
  }, []);

  const closeResultModal = useCallback(() => {
    clearModalTimers();
    isModalActiveRef.current = false;
    if (isMountedRef.current) {
      setShowResultModal(false);
      setScannedResult(null);
    }
  }, [clearModalTimers]);

  // Auto-dismiss with countdown
  useEffect(() => {
    if (showResultModal) {
      isModalActiveRef.current = true;
      setCountdown(5);
      clearModalTimers();

      countdownIntervalRef.current = setInterval(() => {
        if (!isMountedRef.current) return;
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      modalTimeoutRef.current = setTimeout(() => {
        closeResultModal();
      }, 5000);
    }
    return () => clearModalTimers();
  }, [showResultModal, clearModalTimers, closeResultModal]);

  // ─────────────────────────────────────────────────────────────
  // CAMERA CONTROL
  // FIX: Added explicit check for `html5QrCodeRef.current.isScanning`
  // before calling `.stop()` to prevent "Scanner is not running" errors
  // that crash the page on some Android WebViews.
  // ─────────────────────────────────────────────────────────────
  const startScanning = useCallback(async () => {
    if (isCameraActive) return;
    if (!selectedCameraId) {
      toast.error("Pilih kamera terlebih dahulu.");
      return;
    }

    closeResultModal();

    // FIX: Create scanner INSIDE startScanning, not at component mount,
    // so that the DOM element #school-reader is guaranteed to exist.
    const scanner = new Html5Qrcode("school-reader");
    html5QrCodeRef.current = scanner;

    try {
      await scanner.start(
        selectedCameraId,
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.65;
            return { width: size, height: size };
          },
        },
        (decodedText) => {
          handleQRScan(decodedText);
        },
        () => {
          // Per-frame errors are expected during normal scanning – suppress
        },
      );

      if (isMountedRef.current) {
        setIsCameraActive(true);
        toast.success("Kamera Stasiun Aktif. Siap memindai kartu!");
      }
    } catch (err) {
      console.error("Error starting camera scanner:", err);
      html5QrCodeRef.current = null;
      toast.error(
        "Gagal mengaktifkan kamera. Perangkat mungkin terkunci atau digunakan program lain.",
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraActive, selectedCameraId, closeResultModal]);

  const stopScanning = useCallback(async () => {
    if (!isCameraActive || !html5QrCodeRef.current) return;
    try {
      // Guard: only stop if actually scanning (avoids "not running" error)
      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
      // Always clear the ref so we don't attempt to stop again in cleanup
      html5QrCodeRef.current = null;
      if (isMountedRef.current) {
        setIsCameraActive(false);
        toast.success("Kamera Stasiun dimatikan.");
      }
    } catch (err) {
      console.error("Error stopping camera:", err);
      html5QrCodeRef.current = null;
    }
  }, [isCameraActive]);

  const toggleCamera = useCallback(() => {
    if (isCameraActive) stopScanning();
    else startScanning();
  }, [isCameraActive, stopScanning, startScanning]);

  // ─────────────────────────────────────────────────────────────
  // COMPONENT UNMOUNT – guaranteed camera cleanup
  // This is the most critical fix: without this, navigating away
  // leaves the camera stream open, draining battery and keeping
  // the green camera indicator LED ON on the device.
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch((e) =>
              console.warn("Unmount camera cleanup failed:", e),
            );
          }
        } catch (e) {
          console.warn("Unmount camera cleanup error:", e);
        }
        html5QrCodeRef.current = null;
      }
      clearModalTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────
  // QR SCAN LOGIC
  // FIX: We now use `isModalActiveRef` (a ref) instead of `showResultModal`
  // (state) to gate duplicate scans. State reads inside callbacks have
  // stale-closure issues; refs are always current.
  // ─────────────────────────────────────────────────────────────
  const handleQRScan = useCallback(
    (decodedText: string) => {
      // Prevent duplicate processing while the result modal is open
      if (isModalActiveRef.current) return;

      try {
        const payload = JSON.parse(decodedText);
        if (payload.type !== "personal_qr" || !payload.userId) {
          triggerScanFailure(
            "Format Kode QR salah. Pastikan menggunakan Kartu Presensi QR Personal Resmi.",
          );
          return;
        }
        processAttendanceLog(payload.userId);
      } catch {
        triggerScanFailure(
          "Gagal membaca QR Code. Pastikan memindai Kartu Presensi QR Personal Resmi.",
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const triggerScanFailure = useCallback(
    (msg: string) => {
      playAudioCue("error", soundEnabled);
      if (isMountedRef.current) {
        setScannedResult({ success: false, message: msg });
        setShowResultModal(true);
      }
    },
    [soundEnabled],
  );

  const processAttendanceLog = useCallback(
    (userId: string) => {
      const allUsers = db.getUsers();
      const teacher = allUsers.find((u) => u.id === userId);

      if (!teacher) {
        triggerScanFailure("Data Kepegawaian tidak ditemukan di database.");
        return;
      }
      if (teacher.role === "admin" || teacher.role === "developer") {
        triggerScanFailure("Akun Administrator / Developer tidak memerlukan presensi harian.");
        return;
      }

      const allAttendance = db.getAttendance();
      const timeNowStr = format(new Date(), "HH:mm:ss");
      const existingIndex = allAttendance.findIndex(
        (a) => a.userId === teacher.id && a.date === todayStr,
      );

      let updatedAttendance = [...allAttendance];
      let finalRecord: AttendanceRecord;
      let scanMode: "check_in" | "check_out";

      try {
        if (existingIndex === -1) {
          // ── ABSEN MASUK ──
          scanMode = "check_in";
          const limit = school.operationalCheckInLimit || "08:00";
          const checkInStatus = timeNowStr.slice(0, 5) > limit ? "Terlambat" : "Hadir";

          finalRecord = {
            id: "STN-" + Math.random().toString(36).substring(2, 9).toUpperCase(),
            userId: teacher.id,
            date: todayStr,
            checkInTime: timeNowStr,
            status: checkInStatus,
            isSynced: navigator.onLine,
            method: "scanner",
            syncStatus: navigator.onLine ? "synced" : "pending",
          };
          updatedAttendance.push(finalRecord);
        } else {
          const existingRecord = allAttendance[existingIndex];
          if (existingRecord.checkOutTime) {
            triggerScanFailure(
              `Halo ${teacher.name}, Anda sudah melakukan absen masuk & pulang hari ini.`,
            );
            return;
          }

          // ── ABSEN PULANG ──
          scanMode = "check_out";
          finalRecord = {
            ...existingRecord,
            checkOutTime: timeNowStr,
            isSynced: navigator.onLine,
            syncStatus: navigator.onLine ? "synced" : "pending",
          };
          updatedAttendance[existingIndex] = finalRecord;
        }

        // Persist with error handling
        db.setAttendance(updatedAttendance);
      } catch (err: any) {
        // FIX: Catch storage errors (e.g. localStorage quota exceeded) and
        // surface them as scan failures instead of a silent white screen.
        triggerScanFailure(
          `Gagal menyimpan data absensi: ${err?.message || "Kesalahan tidak diketahui."}`,
        );
        return;
      }

      // ── Success ──
      playAudioCue("success", soundEnabled);

      if (isMountedRef.current) {
        setScannedResult({
          success: true,
          message: scanMode === "check_in" ? "PRESENSI MASUK BERHASIL!" : "PRESENSI PULANG BERHASIL!",
          teacher,
          record: finalRecord,
          mode: scanMode,
        });
        setShowResultModal(true);
      }

      window.dispatchEvent(new Event("attendance_synchronized"));
      fetchTodayLogs();
    },
    [school, todayStr, soundEnabled, triggerScanFailure, fetchTodayLogs],
  );

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in font-sans pb-10">
      <style>{`
        @keyframes scan {
          0%   { top: 0%; }
          50%  { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
            <Scan size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Stasiun Scanner Sekolah</h2>
            <p className="text-xs text-slate-400">
              Verifikasi kartu presensi QR personal pegawai / guru / dosen secara real-time.
            </p>
          </div>
        </div>

        {/* Live Clock */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-2xl shrink-0">
          <Clock className="text-indigo-600 size-4 animate-pulse" />
          <div className="text-right">
            <div className="text-sm font-black text-slate-800 leading-none tabular-nums">
              {format(currentTime, "HH:mm:ss")}
            </div>
            <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wide">
              {format(currentTime, "EEEE, dd MMMM yyyy", { locale: localeID })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Scanner & Setup (left 2 cols) ── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-6">
            {/* Viewfinder */}
            <div className="w-full md:w-1/2 flex flex-col items-center">
              <div className="relative w-full aspect-square max-w-[280px] rounded-2xl overflow-hidden bg-slate-900 border-4 border-slate-800 shadow-2xl flex items-center justify-center shrink-0">
                {/* html5-qrcode mounts its video here */}
                <div id="school-reader" className="w-full h-full" />

                {/* Inactive overlay */}
                {!isCameraActive && (
                  <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-4 text-center">
                    <Camera size={44} className="text-slate-600 mb-3 animate-bounce" />
                    <p className="text-xs font-bold text-slate-400">Kamera Stasiun Nonaktif</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Aktifkan kamera menggunakan tombol di samping untuk mulai memindai.
                    </p>
                  </div>
                )}

                {/* Laser scan line */}
                {isCameraActive && (
                  <div className="absolute inset-0 border-2 border-emerald-500/30 rounded-lg pointer-events-none">
                    <div className="w-full h-1 bg-emerald-500/80 shadow-[0_0_10px_#10b981] absolute top-0 animate-[scan_2.5s_linear_infinite]" />
                  </div>
                )}
              </div>
            </div>

            {/* Control panel */}
            <div className="w-full md:w-1/2 space-y-4 flex flex-col justify-between py-1">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                  Pengaturan Stasiun
                </h3>

                {/* Camera select */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1">
                    Pilih Perangkat Input
                  </label>
                  <select
                    disabled={isCameraActive}
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 disabled:opacity-60"
                  >
                    {cameras.length === 0 ? (
                      <option value="">Mencari kamera...</option>
                    ) : (
                      cameras.map((c, i) => (
                        <option key={c.deviceId} value={c.deviceId}>
                          📷 {c.label || `Kamera ${i + 1}`}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Operational info */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-150 text-[11px] font-bold text-slate-500 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Lembaga:</span>
                    <span className="text-slate-800 font-extrabold">{school.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Batas Jam Masuk:</span>
                    <span className="text-[#ea4335] font-black">{school.operationalCheckInLimit || "08:00"} WIB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Radius Pagar Geografis:</span>
                    <span className="text-indigo-600 font-extrabold">Diabaikan di Stasiun Pemindai</span>
                  </div>
                </div>
              </div>

              {/* Sound & Camera Toggle */}
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 mt-2">
                <button
                  onClick={() => setSoundEnabled((s) => !s)}
                  className={`p-2 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-bold ${
                    soundEnabled
                      ? "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      : "bg-rose-50 border-rose-200 text-rose-600"
                  }`}
                  title={soundEnabled ? "Matikan suara bip" : "Nyalakan suara bip"}
                >
                  {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                  <span>{soundEnabled ? "Audio On" : "Mute"}</span>
                </button>

                <button
                  onClick={toggleCamera}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-extrabold shadow-md transition-all active:scale-95 ${
                    isCameraActive
                      ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-100"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100"
                  }`}
                >
                  {isCameraActive ? (
                    <><Square size={14} fill="white" /> Matikan Scanner</>
                  ) : (
                    <><Play size={14} fill="white" /> Aktifkan Scanner</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Guidelines */}
          <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 flex gap-3 text-left">
            <Calendar className="text-blue-600 shrink-0 mt-0.5" size={18} />
            <div className="space-y-1">
              <h4 className="text-xs font-black text-blue-900 uppercase">Petunjuk Operator Stasiun</h4>
              <p className="text-[11px] text-blue-700 leading-relaxed font-semibold">
                Perangkat ini ditempatkan di lobby instansi / sekolah / kampus. Mintalah Pegawai / Guru / Dosen
                untuk menghadapkan <strong>Kartu Presensi QR Personal</strong> (baik fisik yang
                sudah dicetak maupun versi digital dari HP) ke kamera stasiun lobi ini. Sistem akan
                otomatis mencatat data presensi dan berbunyi "bip" sukses.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right: Today's Log ── */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden h-[460px] flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={15} className="text-indigo-600" />
              Kehadiran Hari Ini
            </h3>
            <span className="text-[10px] font-black text-white bg-indigo-600 px-2 py-0.5 rounded-full">
              {todayLogs.length} Scans
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 text-left">
            {todayLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10 text-center">
                <Scan size={32} className="opacity-30 mb-2 animate-pulse" />
                <p className="text-xs font-bold">Belum ada scan terekam</p>
                <p className="text-[10px] text-slate-500 mt-1">Antrean logs kosong untuk hari ini.</p>
              </div>
            ) : (
              todayLogs.map((log) => {
                const displayTime = log.checkOutTime || log.checkInTime || "--:--";
                const isCheckOut = !!log.checkOutTime;
                return (
                  <div
                    key={log.id}
                    className="p-3 hover:bg-slate-50/50 rounded-xl transition flex gap-3 items-center justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-xs text-slate-800 truncate uppercase">
                        {log.user?.name || "Personel Terhapus"}
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold truncate mt-0.5 uppercase">
                        {log.user?.jabatan || "Pegawai / Guru / Dosen"}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded border uppercase ${
                          isCheckOut
                            ? "bg-slate-100 border-slate-200 text-slate-600"
                            : log.status === "Terlambat"
                              ? "bg-amber-50 border-amber-100 text-amber-700"
                              : "bg-emerald-50 border-emerald-100 text-emerald-700"
                        }`}>
                          {isCheckOut ? "Pulang" : "Masuk"}
                        </span>
                        <span className="text-[9px] font-mono text-slate-500 font-semibold flex items-center gap-0.5">
                          <Clock size={10} />{displayTime}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isCheckOut ? (
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                          <UserX size={14} />
                        </div>
                      ) : (
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                          log.status === "Terlambat" ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                        }`}>
                          <UserCheck size={14} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── RESULT MODAL (AUTO-DISMISS) ── */}
      {showResultModal && scannedResult && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 overflow-hidden relative text-center">
            {/* Countdown badge */}
            <div className="absolute top-4 right-4 text-[10px] font-black text-slate-400 bg-slate-50 border border-slate-200 py-1 px-2.5 rounded-full select-none tabular-nums">
              Menutup otomatis: {countdown}s
            </div>

            {scannedResult.success ? (
              <div className="space-y-5 py-4">
                <div className="mx-auto w-16 h-16 bg-emerald-50 border-2 border-emerald-100 text-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                  <CheckCircle size={36} fill="rgba(16, 185, 129, 0.1)" />
                </div>

                <div>
                  <h3 className="text-lg font-black text-emerald-700 uppercase tracking-tight">{scannedResult.message}</h3>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">PRESENSI BERHASIL DICATAT</p>
                </div>

                {/* Teacher profile card */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-4 items-center text-left max-w-sm mx-auto">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-white border border-slate-200 shrink-0 flex items-center justify-center">
                    <span className="font-extrabold text-sm uppercase font-mono bg-indigo-50 text-indigo-600 w-full h-full flex items-center justify-center">
                      {scannedResult.teacher?.name.substring(0, 2)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-slate-800 text-sm truncate uppercase leading-snug">
                      {scannedResult.teacher?.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold truncate mt-0.5 uppercase">
                      {scannedResult.teacher?.jabatan || "Staff Pengajar"}
                    </p>
                    <p className="text-[9px] text-slate-500 font-mono mt-1">
                      NIP: {scannedResult.teacher?.nip || "—"}
                    </p>
                  </div>
                </div>

                {/* Record details */}
                {scannedResult.record && (
                  <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto border-t border-b border-slate-100 py-3 mt-4 text-xs font-bold text-slate-500">
                    <div className="text-center bg-slate-50 p-2 rounded-xl border border-slate-150">
                      <p className="text-[9px] text-slate-400 uppercase tracking-wide">Jam Rekam</p>
                      <p className="text-sm font-black text-slate-800 mt-0.5 tabular-nums">
                        {scannedResult.mode === "check_in"
                          ? scannedResult.record.checkInTime
                          : scannedResult.record.checkOutTime}
                      </p>
                    </div>
                    <div className="text-center bg-slate-50 p-2 rounded-xl border border-slate-150">
                      <p className="text-[9px] text-slate-400 uppercase tracking-wide">Status Presensi</p>
                      <p className={`text-sm font-black mt-0.5 uppercase ${
                        scannedResult.mode === "check_out"
                          ? "text-slate-600"
                          : scannedResult.record.status === "Terlambat"
                            ? "text-amber-600"
                            : "text-emerald-600"
                      }`}>
                        {scannedResult.mode === "check_out" ? "PULANG" : scannedResult.record.status}
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <p className="text-[11px] font-black text-slate-700 italic">
                    &quot;Selamat {scannedResult.mode === "check_in" ? "bekerja dan bertugas!" : "beristirahat di rumah!"} Tetap semangat!&quot;
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-6">
                <div className="mx-auto w-16 h-16 bg-rose-50 border-2 border-rose-100 text-rose-500 rounded-full flex items-center justify-center shadow-lg">
                  <XCircle size={36} fill="rgba(239, 68, 68, 0.1)" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-rose-600 uppercase">PRESENSI GAGAL</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-2 leading-relaxed px-4">
                    {scannedResult.message}
                  </p>
                </div>
                <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-3 max-w-xs mx-auto flex items-center gap-2 mt-4 text-[10px] text-rose-700 text-left font-bold">
                  <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                  <span>Harap pastikan kode QR menghadap kamera dengan pencahayaan cukup.</span>
                </div>
              </div>
            )}

            <button
              onClick={closeResultModal}
              className="mt-6 w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl text-xs transition"
            >
              Tutup Pratinjau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
