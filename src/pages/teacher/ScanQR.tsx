import React, { useEffect, useState } from "react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { useAuth } from "../../components/AuthContext";
import { db, syncOfflineAttendance } from "../../lib/db";
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
} from "lucide-react";
import { toast } from "react-hot-toast";

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const parseQRData = (qrStr: string) => {
  try {
    const trimmed = qrStr.trim();
    if (trimmed.startsWith("{")) {
      return JSON.parse(trimmed);
    }
    
    // Check if it is a URL or has query parameters
    const queryIndex = trimmed.indexOf("?");
    const queryString = queryIndex !== -1 ? trimmed.substring(queryIndex) : trimmed;
    const params = new URLSearchParams(queryString);
    
    if (!params.get("token")) {
      throw new Error("Token tidak ditemukan");
    }
    
    return {
      session: params.get("session") || "Absensi Harian",
      date: params.get("date") || "",
      type: params.get("type") || "check_in",
      token: params.get("token") || "",
      timestamp: Number(params.get("timestamp")) || Date.now(),
    };
  } catch (e) {
    throw new Error("Format QR Code tidak dikenali atau tidak valid.");
  }
};

export function ScanQR() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [activeScanner, setActiveScanner] = useState<
    "check_in" | "check_out" | null
  >(null);
  const [isLocating, setIsLocating] = useState(false);
  const { user } = useAuth();
  const scannerRef = React.useRef<any>(null);

  const [attendance, setAttendanceList] = useState(() => db.getAttendance());
  const [manualType, setManualType] = useState<"Hadir" | "Izin" | "Sakit">(
    "Hadir",
  );
  const [manualNotes, setManualNotes] = useState("");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastVerifiedLocation, setLastVerifiedLocation] = useState<{
    latitude: number;
    longitude: number;
    distance: number;
  } | null>(null);
  const [simMode, setSimModeState] = useState<
    "healthy" | "unstable" | "offline"
  >(() => (localStorage.getItem("sync_sim_mode") as any) || "healthy");

  const updateSimMode = (mode: "healthy" | "unstable" | "offline") => {
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
  };

  useEffect(() => {
    const handleSyncEvent = () => {
      setAttendanceList(db.getAttendance());
    };
    window.dispatchEvent(new Event("attendance_synchronized"));
    window.addEventListener("attendance_synchronized", handleSyncEvent);
    return () => {
      window.removeEventListener("attendance_synchronized", handleSyncEvent);
    };
  }, []);

  // Background Auto-Sync loop checker
  useEffect(() => {
    const checkAndAutoSync = async () => {
      const pendingCount = db
        .getAttendance()
        .filter((a) => a.userId === user?.id && !a.isSynced).length;
      if (
        pendingCount > 0 &&
        navigator.onLine &&
        simMode !== "offline" &&
        !isSyncing
      ) {
        console.log(
          "Background auto-sync starting for",
          pendingCount,
          "records",
        );
        try {
          await syncOfflineAttendance();
        } catch (err) {
          console.warn(
            "Background auto-sync had failures, will retry on next cycle",
          );
        }
      }
    };

    const interval = setInterval(checkAndAutoSync, 15005);
    return () => clearInterval(interval);
  }, [simMode, isSyncing, user?.id]);

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const toastId = toast.loading(
      "Memulai sinkronisasi antrean data lokal ke server Madrasah...",
    );
    try {
      const count = await syncOfflineAttendance();
      if (count > 0) {
        toast.success(
          `Berhasil menyinkronkan ${count} data absensi dari penyimpanan lokal ke server Madrasah!`,
          { id: toastId, duration: 4000 },
        );
      } else {
        toast.success("Semua data Anda sudah sinkron dengan server induk.", {
          id: toastId,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menyinkronkan antrean data lokal.", {
        id: toastId,
        duration: 4000,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading("Mengambil koordinat satelit GPS Madrasah...");

    const checkLocationAndReturn = (): Promise<{
      latitude: number;
      longitude: number;
      distance: number;
    } | null> => {
      return new Promise((resolve, reject) => {
        if (!school.latitude || !school.longitude || !school.radius) {
          resolve(null);
          return;
        }

        if (!navigator.geolocation) {
          reject(
            new Error(
              "Perangkat Anda tidak mendukung geolokasi GPS untuk absensi Madrasah.",
            ),
          );
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
                  `Gagal: Anda di luar geofence wilayah Madrasah (Jarak: ${Math.round(distance)}m, Maksimal: ${school.radius}m).`,
                ),
              );
            }
          },
          (error) => {
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
    };

    try {
      const loc = await checkLocationAndReturn();

      toast.loading("Membaca QR Code dari berkas...", { id: toastId });

      const html5QrCode = new Html5Qrcode("file-reader");
      const decodedText = await html5QrCode.scanFile(file, true);

      toast.success("Lokasi GPS & Dokumen QR berhasil diverifikasi!", {
        id: toastId,
      });
      setScanResult(decodedText);
      processAttendance(decodedText, activeScanner!, loc || undefined, "file");
    } catch (err: any) {
      console.error("QR decode/location error:", err);
      toast.error(err.message || "Gagal mendecode QR Code.", {
        id: toastId,
        duration: 6000,
      });
    } finally {
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const todayRecord = attendance.find(
    (a) => a.userId === user?.id && a.date === today,
  );
  const school = db.getSchool();

  const saveAttendance = (newRecords: any[]) => {
    db.setAttendance(newRecords);
    setAttendanceList(newRecords);
    window.dispatchEvent(new Event("attendance_synchronized"));
  };

  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();

    const existing = attendance.find(
      (a) => a.userId === user?.id && a.date === today,
    );

    if (existing) {
      // Block if already checked in via QR
      if (existing.checkInTime) {
        toast.error("Anda sudah terekam hadir hari ini.");
        return;
      }
      // Block if a manual request is already pending review
      if ((existing as any).approvalStatus === "Pending") {
        toast.error(
          "Anda memiliki pengajuan berjalan yang sedang diaudit atasan.",
        );
        return;
      }
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
      toast.success(
        `Surat Pengajuan absensi ${manualType} berhasil dikirim ke atasan!`,
      );
      setManualNotes("");
    } catch (err) {
      toast.error("Gagal mengajukan surat.");
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleStartScan = (mode: "check_in" | "check_out") => {
    if (!school.latitude || !school.longitude || !school.radius) {
      setActiveScanner(mode);
      return;
    }

    if (!navigator.geolocation) {
      toast.error("Perangkat keras tidak didukung GPS satelit.");
      return;
    }

    setIsLocating(true);
    toast.loading("Melacak posisi aman geofence Madrasah...", {
      id: "location-check",
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
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
          toast.success("Radius aman terkonfirmasi.", { id: "location-check" });
          setActiveScanner(mode);
        } else {
          toast.error(
            `Anda berada di luar radius kerja instansi (Jarak: ${Math.round(distance)}m, Geofence: ${school.radius}m).`,
            { id: "location-check", duration: 5000 },
          );
        }
      },
      (error) => {
        setIsLocating(false);
        let errorMsg = "Akses satelit GPS terganggu.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg =
            "Akses lokasi ditolak. Harap beri izin browser pada setelan privasi.";
        }
        toast.error(errorMsg, { id: "location-check", duration: 5000 });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    if (!activeScanner) return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false,
    );
    scannerRef.current = scanner;

    const onScanSuccess = (decodedText: string) => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
      setScanResult(decodedText);
      processAttendance(
        decodedText,
        activeScanner,
        lastVerifiedLocation || undefined,
        "scanner",
      );
    };

    scanner.render(onScanSuccess, (err) => {});

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear().catch((e: any) => console.warn("Scanner cleanup failed async", e));
        } catch (e) {
          console.warn("Scanner cleanup failed sync", e);
        }
        scannerRef.current = null;
      }
    };
  }, [activeScanner]);

  const playAudioFeedback = (type: "success" | "error") => {
    try {
      const audioCtx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === "success") {
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          1200,
          audioCtx.currentTime + 0.1,
        );
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          audioCtx.currentTime + 0.2,
        );
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.2);
      } else {
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
        oscillator.frequency.linearRampToValueAtTime(
          200,
          audioCtx.currentTime + 0.3,
        );
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn("Audio feedback failed", e);
    }
  };

  const processAttendance = (
    qrDataStr: string,
    mode: "check_in" | "check_out",
    locationData?: { latitude: number; longitude: number; distance: number },
    methodType: "scanner" | "file" | "external_scanner" = "scanner",
  ) => {
    try {
      const qrData = parseQRData(qrDataStr);
      const activeQRStr = localStorage.getItem("current_active_qr");

      if (!activeQRStr) {
        playAudioFeedback("error");
        setStatusMessage({
          type: "error",
          text: "Token QR dinamis tidak ditemukan atau sudah ditangguhkan.",
        });
        return;
      }

      const activeQR = JSON.parse(activeQRStr);

      if (qrData.token !== activeQR.token) {
         playAudioFeedback("error");
         setStatusMessage({
           type: "error",
           text: "Hash QR Code tidak cocok dengan tanda tangan digital Madrasah.",
         });
         return;
      }

      const timeNow = format(new Date(), "HH:mm:ss");

      if (qrData.date !== today) {
        playAudioFeedback("error");
        setStatusMessage({
          type: "error",
          text: "Token QR expired (mismatched date).",
        });
        return;
      }

      if (qrData.type !== mode) {
        playAudioFeedback("error");
        setStatusMessage({ type: "error", text: `Mode QR salah.` });
        return;
      }

      const currentAttendance = [...attendance];
      const existingRecordIndex = currentAttendance.findIndex(
        (a) => a.userId === user?.id && a.date === today,
      );

      if (mode === "check_in") {
        if (existingRecordIndex >= 0) {
          playAudioFeedback("error");
          setStatusMessage({
            type: "error",
            text: "Anda sudah login masuk hari ini.",
          });
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
          syncStatus:
            navigator.onLine && simMode === "healthy" ? "synced" : "pending",
          latitude: locationData?.latitude,
          longitude: locationData?.longitude,
          distance: locationData?.distance,
          method: methodType,
        } as any;

        saveAttendance([...currentAttendance, newRecord]);
        playAudioFeedback("success");
        setStatusMessage({
          type: "success",
          text: `Presensi masuk berhasil tercatat pada pukul ${timeNow}`,
        });
      } else if (mode === "check_out") {
        if (existingRecordIndex < 0) {
          playAudioFeedback("error");
          setStatusMessage({
            type: "error",
            text: "Anda belum mencatat presensi masuk.",
          });
          return;
        }

        const existingRecord = currentAttendance[existingRecordIndex];
        if (existingRecord.checkOutTime) {
          playAudioFeedback("error");
          setStatusMessage({
            type: "error",
            text: "Presensi pulang sudah direkam sebelumnya.",
          });
          return;
        }

        existingRecord.checkOutTime = timeNow;
        existingRecord.isSynced = navigator.onLine && simMode === "healthy";
        existingRecord.syncStatus =
          navigator.onLine && simMode === "healthy" ? "synced" : "pending";
        existingRecord.latitude = locationData?.latitude;
        existingRecord.longitude = locationData?.longitude;
        existingRecord.distance = locationData?.distance;
        existingRecord.method = methodType;
        currentAttendance[existingRecordIndex] = existingRecord;
        saveAttendance([...currentAttendance]);

        playAudioFeedback("success");
        setStatusMessage({
          type: "success",
          text: `Presensi pulang berhasil tercatat pada pukul ${timeNow}!`,
        });
      }
    } catch (e: any) {
      playAudioFeedback("error");
      setStatusMessage({
        type: "error",
        text: e.message || "Tanda tangan digital QR Code tidak valid.",
      });
    }
  };

  // Check for external camera scan redirect (URL query params) on page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    const dateParam = params.get("date");
    const typeParam = params.get("type");

    if (tokenParam && dateParam && typeParam) {
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

      const processUrlScan = (loc?: any) => {
        try {
          processAttendance(
            JSON.stringify(qrData),
            typeParam as any,
            loc,
            "external_scanner"
          );
        } catch (e) {
          toast.error("Gagal memproses absensi otomatis.");
        }
      };

      const toastId = toast.loading("Mendeteksi QR dari kamera HP, memverifikasi GPS Madrasah...");

      if (!currentSchool.latitude || !currentSchool.longitude || !currentSchool.radius) {
        toast.success("Presensi diproses!", { id: toastId });
        processUrlScan();
      } else {
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
              currentSchool.longitude!
            );

            if (distance <= currentSchool.radius!) {
              toast.success("Verifikasi koordinat aman berhasil!", { id: toastId });
              processUrlScan({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                distance: Math.round(distance),
              });
            } else {
              toast.error(
                `Gagal: Anda di luar radius wilayah Madrasah (Jarak: ${Math.round(distance)}m, Maksimal: ${currentSchool.radius}m).`,
                { id: toastId, duration: 6000 }
              );
            }
          },
          (err) => {
            let errorMsg = "Akses satelit GPS terganggu.";
            if (err.code === err.PERMISSION_DENIED) {
              errorMsg = "Izin lokasi ditolak. Harap izinkan GPS pada setelan browser.";
            }
            toast.error(errorMsg, { id: toastId, duration: 6000 });
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }

      // Clean up parameters from browser URL bar to prevent duplicate scanning on page refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [attendance]);

  if (activeScanner) {
    return (
      <div className="max-w-md mx-auto space-y-6 animate-fade-in text-left text-xs font-sans">
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={async () => {
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
              }}
              className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"
            >
              <ArrowLeft size={16} className="text-slate-600" />
            </button>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Verifikasi Scan Absensi{" "}
              {activeScanner === "check_in" ? "Masuk" : "Pulang"}
            </h2>
          </div>

          {!scanResult ? (
            <div className="space-y-6">
              <div className="overflow-hidden rounded-2xl border-2 border-dashed border-indigo-200">
                <div id="reader" className="w-full"></div>
              </div>

              <div id="file-reader" className="hidden"></div>

              <div className="relative flex items-center justify-center py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100"></div>
                </div>
                <span className="relative px-3 bg-white text-[10px] font-bold text-slate-450">
                  ATAU
                </span>
              </div>

              <div>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-250 rounded-2xl p-5 hover:border-indigo-400 hover:bg-slate-50/50 cursor-pointer transition">
                  <div className="text-indigo-600 mb-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-upload-cloud"
                    >
                      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                      <path d="M12 12v9" />
                      <path d="m16 16-4-4-4 4" />
                    </svg>
                  </div>
                  <span className="font-extrabold text-slate-700">
                    Pilih Berkas Dari Galeri HP
                  </span>
                  <span className="text-[9px] text-slate-400 mt-1 uppercase">
                    Instant QR Decoding
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileScan}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6">
              {statusMessage?.type === "success" ? (
                <CheckCircle className="w-12 h-12 text-emerald-500 mb-3 animate-bounce" />
              ) : (
                <XCircle className="w-12 h-12 text-rose-500 mb-3" />
              )}

              <h3
                className={`text-sm font-black uppercase tracking-wider mb-1 ${statusMessage?.type === "success" ? "text-emerald-600" : "text-rose-600"}`}
              >
                {statusMessage?.type === "success"
                  ? "Verifikasi Sukses"
                  : "Gagal Masuk"}
              </h3>
              <p className="text-center text-slate-500 leading-relaxed mb-6 font-medium">
                {statusMessage?.text}
              </p>

              <button
                onClick={() => {
                  setScanResult(null);
                  setStatusMessage(null);
                }}
                className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
              >
                Ulangi Prosedur
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-left animate-fade-in font-sans text-xs">
      <h2 className="text-2xl font-black text-slate-800 tracking-tight border-b border-slide-205 border-slate-205 pb-3">
        Absensi Mandiri Guru & Staf Madrasah
      </h2>

      {/* Profil Guru/Staf & Geofencing Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-1.5 text-sm uppercase tracking-wide">
              <ShieldCheck className="text-[#1d74f2]" size={16} />
              MADRASAH - Kartu Kendali Presensi Guru & Staf
            </h3>
            <div className="grid grid-cols-[140px_1fr] gap-y-2.5 text-slate-600">
              <div className="font-bold text-slate-450 uppercase tracking-widest text-[9px]">
                Pegawai Negeri
              </div>
              <div className="font-extrabold text-[#111c2d]">
                : {user?.name}
              </div>

              <div className="font-bold text-slate-450 uppercase tracking-widest text-[9px]">
                NUPTK / NRG / PegID / NPK
              </div>
              <div className="font-mono text-slate-700 font-extrabold">
                : {user?.nip || "198912232015031002"}
              </div>

              <div className="font-bold text-slate-450 uppercase tracking-widest text-[9px]">
                Nama Satuan Kerja
              </div>
              <div className="font-semibold text-[#111c2d]">
                : {user?.satker || "Badan Kepegawaian & Pengembangan SDM"}
              </div>

              <div className="font-bold text-slate-450 uppercase tracking-widest text-[9px]">
                Tanggal Dinas
              </div>
              <div className="font-bold text-indigo-700">
                : {format(new Date(), "EEEE, dd MMMM yyyy", { locale: id })}
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-slate-400">
            <span>
              Zona Waktu: <strong>WIB (Asia/Jakarta)</strong>
            </span>
            <span>
              Aman Geofence:{" "}
              <strong className="text-emerald-600 font-extrabold">
                {school.radius || 120} meter
              </strong>
            </span>
          </div>
        </div>

        {/* Simulasi Jaringan Panel */}
        <div className="bg-[#111c2d] text-white rounded-3xl p-5 border border-slate-800 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[9px] tracking-widest text-indigo-400 uppercase flex items-center gap-1">
                <Settings size={12} /> Jasa Seluler HP
              </h3>
              <span
                className={`inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                  simMode === "healthy"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : simMode === "unstable"
                      ? "bg-amber-500/10 text-amber-400 animate-pulse"
                      : "bg-rose-500/10 text-rose-400"
                }`}
              >
                {simMode === "healthy"
                  ? "Lancar"
                  : simMode === "unstable"
                    ? "Sinyal Rendah"
                    : "Tanpa Sinyal"}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-normal mb-3">
              Uji ketahanan sistem antrean offline saat kehilangan sinyal
              internet di daerah pelosok:
            </p>

            <div className="space-y-1.5 font-bold">
              <button
                onClick={() => updateSimMode("healthy")}
                className={`w-full text-left px-2.5 py-1.5 rounded-xl transition flex items-center justify-between ${
                  simMode === "healthy"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-800 text-slate-350 hover:bg-slate-700"
                }`}
              >
                <span>🟢 1. Jaringan Kuat</span>
                <span className="text-[10px] opacity-65">Instan</span>
              </button>

              <button
                onClick={() => updateSimMode("unstable")}
                className={`w-full text-left px-2.5 py-1.5 rounded-xl transition flex items-center justify-between ${
                  simMode === "unstable"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-800 text-slate-350 hover:bg-slate-700"
                }`}
              >
                <span>🟡 2. Gagal Tersambung (50%)</span>
                <span className="text-[10px] opacity-65">Eror Log</span>
              </button>

              <button
                onClick={() => updateSimMode("offline")}
                className={`w-full text-left px-2.5 py-1.5 rounded-xl transition flex items-center justify-between ${
                  simMode === "offline"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-800 text-slate-350 hover:bg-slate-700"
                }`}
              >
                <span>🔴 3. Offline Total</span>
                <span className="text-[10px] opacity-65">Ke Outbox</span>
              </button>
            </div>
          </div>

          <p className="mt-3 pt-2.5 border-t border-slate-800 text-[9px] text-slate-400 font-mono">
            *Semua data akan terkurung aman di HP sebelum sinkronisasi.
          </p>
        </div>
      </div>

      {/* MONITOR OUTBOX OFFLINE */}
      <div className="bg-white rounded-3xl border border-slate-205 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <Database className="text-indigo-600" size={16} />
              Antrean Kotak Keluar Sesi Offline (Local Queue Buffer)
            </h3>
            <p className="text-slate-400 mt-0.5">
              Sistem akan otomatis menggelar sinkronisasi saat sinyal HP Anda
              kembali sehat.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              disabled={isSyncing}
              onClick={handleManualSync}
              className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
            >
              <RefreshCw
                size={12}
                className={isSyncing ? "animate-spin" : ""}
              />
              {isSyncing ? "Mengunggah..." : "Sinkronkan Sekarang"}
            </button>
          </div>
        </div>

        <div className="p-5 font-bold">
          {attendance.filter((a) => a.userId === user?.id && !a.isSynced)
            .length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="p-3 bg-emerald-50 rounded-full text-emerald-600 mb-2">
                <CheckCircle size={20} />
              </div>
              <h4 className="font-extrabold text-slate-800">
                Antrean Bersih & Valid!
              </h4>
              <p className="text-xs text-slate-400 font-medium max-w-sm mt-0.5">
                Semua data presensi fungsional berkoordinat Anda sudah tersimpan
                permanen di cloud Madrasah.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-amber-800">
                <AlertTriangle
                  size={16}
                  className="text-amber-600 shrink-0 mt-0.5"
                />
                <div>
                  <p className="font-bold">
                    Ada{" "}
                    {
                      attendance.filter(
                        (a) => a.userId === user?.id && !a.isSynced,
                      ).length
                    }{" "}
                    Baris Data Tersandera Offline
                  </p>
                  <p className="mt-0.5 opacity-90 leading-relaxed font-sans font-medium text-[11px]">
                    Kami terus menjaga konsistensi pangkalan data. Data ini
                    TIDAK akan hilang meski browser ditutup atau HP direstart.
                  </p>
                </div>
              </div>

              <div className="border border-slate-150 rounded-2xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 text-[9px] text-slate-400 uppercase tracking-widest grid grid-cols-12 gap-2 border-b border-slate-150">
                  <span className="col-span-3">Tanggal</span>
                  <span className="col-span-3 text-center">Waktu</span>
                  <span className="col-span-2 text-center">Percobaan</span>
                  <span className="col-span-4 text-right">
                    Status Transmisi
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {attendance
                    .filter((a) => a.userId === user?.id && !a.isSynced)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 grid grid-cols-12 gap-2 items-center text-[11px] hover:bg-slate-50/50 transition"
                      >
                        <div className="col-span-3 font-extrabold text-[#111c2d]">
                          {format(new Date(item.date), "dd MMM yyyy")}
                        </div>
                        <div className="col-span-3 text-center font-mono font-bold text-slate-700">
                          {item.checkInTime
                            ? `MASUK: ${item.checkInTime}`
                            : `PULANG: ${item.checkOutTime}`}
                        </div>
                        <div className="col-span-2 text-center font-mono text-slate-500 font-medium">
                          {item.syncAttempts || 0}x retries
                        </div>
                        <div className="col-span-4 text-right">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                              item.syncStatus === "syncing"
                                ? "bg-indigo-100 text-indigo-805 animate-pulse"
                                : item.syncStatus === "failed"
                                  ? "bg-rose-50 text-rose-800"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {item.syncStatus === "syncing"
                              ? "Menghubungkan..."
                              : item.syncStatus || "Menunggu Jaringan"}
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

      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <div
          onClick={() => handleStartScan("check_in")}
          className={`flex-1 bg-white border border-slate-200 rounded-3xl p-6 flex items-center gap-4 cursor-pointer hover:border-indigo-400 select-none transition ${isLocating ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div className="bg-[#1d74f2] text-white p-3.5 rounded-2xl shrink-0">
            <Camera size={24} />
          </div>
          <div>
            <h4 className="font-bold text-[#1d74f2] text-sm uppercase tracking-wider">
              Absen Masuk (Clock-In)
            </h4>
            {todayRecord?.checkInTime ? (
              <p className="text-emerald-600 flex items-center gap-1 mt-1 font-bold">
                <CheckCircle size={12} /> Terkonfirmasi:{" "}
                {todayRecord.checkInTime}
              </p>
            ) : (
              <p className="text-rose-500 flex items-center gap-1 mt-1 font-bold">
                <XCircle size={12} /> Belum Rekam Masuk
              </p>
            )}
          </div>
        </div>

        <div
          onClick={() => handleStartScan("check_out")}
          className={`flex-1 bg-white border border-slate-200 rounded-3xl p-6 flex items-center gap-4 cursor-pointer hover:border-indigo-400 select-none transition ${isLocating ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div className="bg-[#ea4335] text-white p-3.5 rounded-2xl shrink-0">
            <Camera size={24} />
          </div>
          <div>
            <h4 className="font-bold text-[#ea4335] text-sm uppercase tracking-wider">
              Absen Pulang (Clock-Out)
            </h4>
            {todayRecord?.checkOutTime ? (
              <p className="text-emerald-600 flex items-center gap-1 mt-1 font-bold">
                <CheckCircle size={12} /> Terkonfirmasi:{" "}
                {todayRecord.checkOutTime}
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
          Gunakan formulir pelaporan mandiri di bawah ini jika terkendala
          koordinat GPS, mengajukan surat sakit dokter, atau izin dinas
          fungsional.
        </p>

        <form onSubmit={handleSubmitManual} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-450 uppercase mb-2">
              Pilih Jenis Surat Pelaporan
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  type: "Hadir",
                  label: "🟢 Hadir Manual",
                  style: "border-emerald-250 bg-emerald-50 text-emerald-800",
                },
                {
                  type: "Izin",
                  label: "🟡 Izin Dinas",
                  style: "border-yellow-250 bg-yellow-50 text-yellow-800",
                },
                {
                  type: "Sakit",
                  label: "🔵 Sakit Dokter",
                  style: "border-blue-250 bg-blue-50 text-blue-900",
                },
              ].map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setManualType(opt.type as any)}
                  className={`py-3.5 px-3 rounded-2xl border text-center font-extrabold transition text-xs ${
                    manualType === opt.type
                      ? `${opt.style} shadow-xs ring-4 ring-indigo-500/10`
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">
              Catatan Justifikasi Alasan{" "}
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              placeholder="Rincikan perihal surat rekomendasi kedinasan atau detail sakit..."
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm"
              required={manualType !== "Hadir"}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmittingManual}
            className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
          >
            {isSubmittingManual ? "Mengirim Data..." : "Kirim Berkas Pengajuan"}
          </button>
        </form>

        {todayRecord?.approvalStatus === "Pending" && (
          <div className="mt-4 bg-amber-50 text-amber-900 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
            <span className="text-base">⏳</span>
            <div>
              <p className="font-extrabold text-[11px] uppercase tracking-wide">
                Surat Rekomendasi Sedang Diverifikasi Atasan
              </p>
              <p className="mt-0.5 opacity-90 leading-relaxed font-semibold">
                Tipe pengajuan: <strong>{todayRecord.status}</strong>. Pengajuan
                sedang dalam pemeriksaan struktural Yayasan / Kepala Madrasah.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* RIWAYAT ABSENSI */}
      <div className="mt-10">
        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider mb-3">
          Arsip Riwayat Presensi Anda
        </h3>
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
                  <tr
                    key={record.id}
                    className="hover:bg-slate-50/50 transition"
                  >
                    <td className="p-4 text-[#111c2d]">
                      {format(new Date(record.date), "dd MMM yyyy")}
                    </td>
                    <td className="p-4 text-center font-mono">
                      {record.checkInTime || "—"}
                    </td>
                    <td className="p-4 text-center font-mono">
                      {record.checkOutTime || "—"}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-1 justify-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            record.status === "Hadir"
                              ? "bg-emerald-100 text-emerald-800"
                              : record.status === "Terlambat"
                                ? "bg-amber-100 text-amber-800"
                                : record.status === "Izin"
                                  ? "bg-blue-105 bg-blue-100 text-blue-700"
                                  : record.status === "Sakit"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-red-100 text-rose-700"
                          }`}
                        >
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-100 text-[10px] font-extrabold">
                          🟢 Terbukti Sinkron
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-100 text-[10px] font-extrabold">
                          🟡 Log Lokal (HP)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              {attendance.filter((a) => a.userId === user?.id).length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    Belum ada riwayat presensi tercatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
