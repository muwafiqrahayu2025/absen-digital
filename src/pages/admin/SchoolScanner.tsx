import React, { useState, useEffect, useRef } from "react";
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

export function SchoolScanner() {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Scanned results states
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

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const modalTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const school = db.getSchool();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Digital Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Available Cameras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          setSelectedCameraId(devices[0].id);
        } else {
          toast.error("Tidak ada perangkat kamera/webcam terdeteksi.");
        }
      })
      .catch((err) => {
        console.error("Error fetching cameras", err);
        toast.error("Gagal mendeteksi kamera. Pastikan izin kamera aktif.");
      });
  }, []);

  // Fetch Attendance Log for Today
  const fetchTodayLogs = () => {
    const allAttendance = db.getAttendance();
    const allUsers = db.getUsers();
    
    const logs = allAttendance
      .filter((a) => a.date === todayStr)
      .map((a) => {
        const user = allUsers.find((u) => u.id === a.userId);
        return {
          ...a,
          user,
        };
      })
      .sort((a, b) => {
        const timeA = a.checkOutTime || a.checkInTime || "";
        const timeB = b.checkOutTime || b.checkInTime || "";
        return timeB.localeCompare(timeA); // newest first
      });
      
    setTodayLogs(logs);
  };

  useEffect(() => {
    fetchTodayLogs();
    
    // Listen to updates from other pages
    const handleSync = () => fetchTodayLogs();
    window.addEventListener("attendance_synchronized", handleSync);
    return () => {
      window.removeEventListener("attendance_synchronized", handleSync);
    };
  }, []);

  // Clear countdowns & timers
  const clearModalTimers = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (modalTimeoutRef.current) clearTimeout(modalTimeoutRef.current);
  };

  // Close Result Modal
  const closeResultModal = () => {
    clearModalTimers();
    setShowResultModal(false);
    setScannedResult(null);
  };

  // Auto-Dismiss Modal countdown
  useEffect(() => {
    if (showResultModal) {
      setCountdown(5);
      clearModalTimers();
      
      countdownIntervalRef.current = setInterval(() => {
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
  }, [showResultModal]);

  // Audio Feedback using Web Audio API
  const playAudioCue = (type: "success" | "error") => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === "success") {
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.2);
      } else {
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
        oscillator.frequency.linearRampToValueAtTime(180, audioCtx.currentTime + 0.35);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn("Play audio feedback failed", e);
    }
  };

  // Start Camera Scanning
  const startScanning = () => {
    if (isCameraActive) return;
    if (!selectedCameraId) {
      toast.error("Pilih kamera terlebih dahulu.");
      return;
    }

    closeResultModal();

    const scanner = new Html5Qrcode("school-reader");
    html5QrCodeRef.current = scanner;

    scanner
      .start(
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
        (error) => {
          // Verbose loggings from camera scan frames, can be ignored safely
        }
      )
      .then(() => {
        setIsCameraActive(true);
        toast.success("Kamera Stasiun Aktif. Siap memindai kartu!");
      })
      .catch((err) => {
        console.error("Error starting camera scanner:", err);
        toast.error("Gagal mengaktifkan kamera. Perangkat mungkin terkunci atau digunakan program lain.");
      });
  };

  // Stop Camera Scanning
  const stopScanning = async () => {
    if (!isCameraActive) return;
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        setIsCameraActive(false);
        toast.success("Kamera Stasiun dimatikan.");
      } catch (err) {
        console.error("Error stopping camera", err);
      }
    }
  };

  // Toggle Camera
  const toggleCamera = () => {
    if (isCameraActive) {
      stopScanning();
    } else {
      startScanning();
    }
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch((e) => console.error("Unmount cleanup failed", e));
      }
    };
  }, []);

  // Process Scanned QR Payloads
  const handleQRScan = (decodedText: string) => {
    // If modal is active, bypass duplicate scanning
    if (showResultModal) return;

    try {
      const payload = JSON.parse(decodedText);
      if (payload.type !== "personal_qr" || !payload.userId) {
        triggerScanFailure("Format Kode QR salah. Pastikan menggunakan Kartu Presensi QR Personal Resmi.");
        return;
      }
      
      processAttendanceLog(payload.userId);
    } catch (e) {
      triggerScanFailure("Gagal membaca QR Code. Pastikan memindai Kartu Presensi QR Personal Resmi.");
    }
  };

  const triggerScanFailure = (msg: string) => {
    playAudioCue("error");
    setScannedResult({
      success: false,
      message: msg,
    });
    setShowResultModal(true);
  };

  const processAttendanceLog = (userId: string) => {
    const allUsers = db.getUsers();
    const teacher = allUsers.find((u) => u.id === userId);

    if (!teacher) {
      triggerScanFailure("Data Kepegawaian tidak ditemukan di database.");
      return;
    }

    if (teacher.role === "admin") {
      triggerScanFailure("Admin tidak memerlukan presensi harian.");
      return;
    }

    const allAttendance = db.getAttendance();
    const timeNowStr = format(new Date(), "HH:mm:ss");
    
    // Check if record exists for today
    const existingIndex = allAttendance.findIndex(
      (a) => a.userId === teacher.id && a.date === todayStr
    );

    let updatedAttendance = [...allAttendance];
    let finalRecord: AttendanceRecord;
    let scanMode: "check_in" | "check_out";

    if (existingIndex === -1) {
      // 1. ABSEN MASUK (Check-In)
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
      db.setAttendance(updatedAttendance);
    } else {
      // 2. ABSEN PULANG (Check-Out) or ALREADY DONE BOTH
      const existingRecord = allAttendance[existingIndex];
      
      if (existingRecord.checkOutTime) {
        triggerScanFailure(`Halo ${teacher.name}, Anda sudah melakukan absen masuk & pulang hari ini.`);
        return;
      }

      scanMode = "check_out";
      finalRecord = {
        ...existingRecord,
        checkOutTime: timeNowStr,
        isSynced: navigator.onLine,
        syncStatus: navigator.onLine ? "synced" : "pending",
      };

      updatedAttendance[existingIndex] = finalRecord;
      db.setAttendance(updatedAttendance);
    }

    // Success Actions
    playAudioCue("success");
    setScannedResult({
      success: true,
      message: scanMode === "check_in" ? "PRESENSI MASUK BERHASIL!" : "PRESENSI PULANG BERHASIL!",
      teacher,
      record: finalRecord,
      mode: scanMode,
    });
    
    // Dispatch event to sync other sidebar elements
    window.dispatchEvent(new Event("attendance_synchronized"));
    fetchTodayLogs();
    setShowResultModal(true);
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-10">
      <style>
        {`
          @keyframes scan {
            0% { top: 0%; }
            50% { top: 100%; }
            100% { top: 0%; }
          }
        `}
      </style>

      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
            <Scan size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Stasiun Scanner Sekolah</h2>
            <p className="text-xs text-slate-400">Verifikasi kartu presensi QR personal guru & staf madrasah secara real-time.</p>
          </div>
        </div>

        {/* Live Clock Dashboard */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-150 px-4 py-2 rounded-2xl shrink-0">
          <Clock className="text-indigo-600 size-4 animate-pulse" />
          <div className="text-right">
            <div className="text-sm font-black text-slate-800 leading-none">
              {format(currentTime, "HH:mm:ss")}
            </div>
            <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wide">
              {format(currentTime, "EEEE, dd MMMM yyyy", { locale: localeID })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Scanner & Setup */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-6">
            
            {/* Viewfinder block */}
            <div className="w-full md:w-1/2 flex flex-col items-center">
              <div className="relative w-full aspect-square max-w-[280px] rounded-2xl overflow-hidden bg-slate-900 border-4 border-slate-850 shadow-2xl flex items-center justify-center shrink-0">
                <div id="school-reader" className="w-full h-full object-cover" />
                
                {/* Camera Inactive Backdrop */}
                {!isCameraActive && (
                  <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-4 text-center">
                    <Camera size={44} className="text-slate-600 mb-3 animate-bounce" />
                    <p className="text-xs font-bold text-slate-400">Kamera Stasiun Nonaktif</p>
                    <p className="text-[10px] text-slate-500 mt-1">Aktifkan kamera menggunakan tombol di samping untuk mulai memindai.</p>
                  </div>
                )}

                {/* Laser scan line overlay */}
                {isCameraActive && (
                  <div className="absolute inset-0 border-2 border-emerald-500/30 rounded-lg pointer-events-none">
                    <div className="w-full h-1 bg-emerald-500/80 shadow-[0_0_10px_#10b981] absolute top-0 animate-[scan_2.5s_linear_infinite]" />
                  </div>
                )}
              </div>
            </div>

            {/* Operator control panel */}
            <div className="w-full md:w-1/2 space-y-4 flex flex-col justify-between py-1">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                  Pengaturan Stasiun
                </h3>

                {/* Camera selection dropdown */}
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

                {/* Operational Settings details */}
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

              {/* Sound feedback settings and play control */}
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 mt-2">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
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
                    <>
                      <Square size={14} fill="white" />
                      Matikan Scanner
                    </>
                  ) : (
                    <>
                      <Play size={14} fill="white" />
                      Aktifkan Scanner
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

          {/* Guidelines info box */}
          <div className="bg-blue-50/70 border border-blue-150 rounded-2xl p-4 flex gap-3 text-left">
            <Calendar className="text-blue-600 shrink-0 mt-0.5" size={18} />
            <div className="space-y-1">
              <h4 className="text-xs font-black text-blue-900 uppercase">Petunjuk Operator Stasiun</h4>
              <p className="text-[11px] text-blue-700 leading-relaxed font-semibold">
                Perangkat ini ditempatkan di lobby sekolah/lobby madrasah. Mintalah Bapak/Ibu Guru untuk menghadapkan <strong>Kartu Presensi QR Personal</strong> (baik fisik yang sudah dicetak maupun versi digital dari HP) ke kamera stasiun lobi ini. Sistem akan otomatis mencatat data absensi dan berbunyi "bip" sukses.
              </p>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Scans Today Log list */}
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
                  <div key={log.id} className="p-3 hover:bg-slate-55 hover:bg-slate-50/50 rounded-xl transition flex gap-3 items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-xs text-slate-800 truncate uppercase">
                        {log.user?.name || "Personel Terhapus"}
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold truncate mt-0.5 uppercase">
                        {log.user?.jabatan || "Guru Madrasah"}
                      </div>
                      
                      {/* Mode Badge indicator */}
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

                        <span className="text-[9px] font-mono text-slate-450 font-semibold flex items-center gap-0.5">
                          <Clock size={10} />
                          {displayTime}
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
                          log.status === "Terlambat"
                            ? "bg-amber-100 text-amber-600"
                            : "bg-emerald-100 text-emerald-600"
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

      {/* FULLSCREEN POPUP RECEIPT MODAL (AUTO-DISMISS) */}
      {showResultModal && scannedResult && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-55 animate-fade-in z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 overflow-hidden relative text-center">
            
            {/* Countdown Badge top-right */}
            <div className="absolute top-4 right-4 text-[10px] font-black text-slate-400 bg-slate-50 border border-slate-150 py-1 px-2.5 rounded-full select-none">
              Menutup otomatis: {countdown}s
            </div>

            {scannedResult.success ? (
              <div className="space-y-5 py-4">
                {/* Large animated status icon */}
                <div className="mx-auto w-16 h-16 bg-emerald-50 border-2 border-emerald-100 text-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                  <CheckCircle size={36} fill="rgba(16, 185, 129, 0.1)" />
                </div>
                
                <div>
                  <h3 className="text-lg font-black text-emerald-700 uppercase tracking-tight">{scannedResult.message}</h3>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">PRESENSI MADRASAH BERHASIL DICATAT</p>
                </div>

                {/* Profile Card visualization */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-4 items-center text-left max-w-sm mx-auto">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-white border border-slate-200 shrink-0 flex items-center justify-center text-slate-350">
                    <span className="font-extrabold text-sm uppercase font-mono bg-indigo-50 text-indigo-600 w-full h-full flex items-center justify-center">
                      {scannedResult.teacher?.name.substring(0, 2)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-slate-800 text-sm truncate uppercase leading-snug">{scannedResult.teacher?.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold truncate mt-0.5 uppercase">{scannedResult.teacher?.jabatan || "Staff Pengajar"}</p>
                    <p className="text-[9px] text-slate-450 font-mono mt-1">NIP: {scannedResult.teacher?.nip || "—"}</p>
                  </div>
                </div>

                {/* Specific scanned record details */}
                {scannedResult.record && (
                  <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto border-t border-b border-slate-100 py-3 mt-4 text-xs font-bold text-slate-550">
                    <div className="text-center bg-slate-50 p-2 rounded-xl border border-slate-150">
                      <p className="text-[9px] text-slate-400 uppercase tracking-wide">Jam Rekam</p>
                      <p className="text-sm font-black text-slate-800 mt-0.5">
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
                    "Selamat {scannedResult.mode === "check_in" ? "bekerja dan bertugas!" : "beristirahat di rumah!"} Tetap semangat!"
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
