import React, { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, RefreshCw, Zap, Upload, CheckCircle, XCircle, ShieldCheck, MapPin, Volume2, VolumeX, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "react-hot-toast";

export interface ModernQRScannerProps {
  mode: "check_in" | "check_out";
  onScanSuccess: (decodedText: string, method: "scanner" | "file") => void;
  onCancel: () => void;
  userName?: string;
  schoolName?: string;
  maxRadius?: number;
  currentDistance?: number;
  isLocating?: boolean;
}

export const ModernQRScanner: React.FC<ModernQRScannerProps> = ({
  mode,
  onScanSuccess,
  onCancel,
  userName = "Pegawai",
  schoolName = "Instansi / Sekolah / Kampus",
  maxRadius = 120,
  currentDistance = 0,
  isLocating = false,
}) => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorchSupport, setHasTorchSupport] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Play Futuristic Audio Beep using Web Audio API
  const playSuccessBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      // Futuristic 2-tone chime: 880Hz -> 1320Hz
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // Ignore audio synthesis errors
    }
  }, [soundEnabled]);

  // Speak AI Voice Readout
  const speakGreeting = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const timeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      const text =
        mode === "check_in"
          ? `Selamat datang ${userName}. Absen masuk berhasil diverifikasi pada pukul ${timeStr}.`
          : `Terima kasih ${userName}. Absen pulang berhasil dicatat pada pukul ${timeStr}. Hati-hati di jalan.`;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "id-ID";
      utterance.rate = 1.05;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      // Ignore voice synth errors
    }
  }, [soundEnabled, mode, userName]);

  // Initialize Camera & Html5Qrcode
  const startCameraScanner = useCallback(async (cameraId?: string) => {
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop().catch(() => {});
        }
      } else {
        scannerRef.current = new Html5Qrcode("hud-qr-reader");
      }

      // Get list of available cameras if not yet fetched
      let targetCameraId = cameraId || selectedCameraId;
      if (!targetCameraId) {
        const deviceCameras = await Html5Qrcode.getCameras().catch(() => []);
        if (deviceCameras && deviceCameras.length > 0) {
          setCameras(deviceCameras);
          // Prefer back camera if available, otherwise first camera
          const backCam = deviceCameras.find((c) =>
            c.label.toLowerCase().includes("back") || c.label.toLowerCase().includes("belakang") || c.label.toLowerCase().includes("rear")
          );
          targetCameraId = backCam ? backCam.id : deviceCameras[0].id;
          setSelectedCameraId(targetCameraId);
        }
      }

      const cameraConfig = targetCameraId ? { deviceId: { exact: targetCameraId } } : { facingMode: "environment" };

      await scannerRef.current.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (!isMountedRef.current || scanStatus === "success") return;
          setScanStatus("success");
          setStatusMessage(`Kode QR Terbaca: ${decodedText.substring(0, 24)}...`);
          playSuccessBeep();
          speakGreeting();

          // Stop camera quickly after success
          if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
          setIsScanning(false);
          onScanSuccess(decodedText, "scanner");
        },
        () => {
          // Ignore frame errors
        }
      );

      setIsScanning(true);

      // Check if Torch is supported by current active track
      setTimeout(() => {
        try {
          const videoElement = document.querySelector("#hud-qr-reader video") as HTMLVideoElement;
          if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject as MediaStream;
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            setHasTorchSupport(!!(capabilities as any).torch);
          }
        } catch (e) {
          setHasTorchSupport(false);
        }
      }, 1000);

    } catch (err: any) {
      console.warn("Camera start error:", err);
      toast.error(err.message || "Gagal mengaktifkan kamera. Pastikan izin kamera telah diberikan.");
      setIsScanning(false);
    }
  }, [selectedCameraId, scanStatus, playSuccessBeep, speakGreeting, onScanSuccess]);

  // Stop scanner safely
  const stopCameraScanner = useCallback(async () => {
    if (scannerRef.current) {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop().catch(() => {});
      }
      try {
        await scannerRef.current.clear();
      } catch (e) {
        // Abaikan jika sudah dibersihkan
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Toggle Camera Front / Back
  const handleSwitchCamera = useCallback(async () => {
    if (cameras.length <= 1) {
      toast("Hanya 1 kamera yang terdeteksi di perangkat ini.", { icon: "ℹ️" });
      return;
    }
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCameraId = cameras[nextIndex].id;
    setSelectedCameraId(nextCameraId);
    await startCameraScanner(nextCameraId);
  }, [cameras, selectedCameraId, startCameraScanner]);

  // Toggle Torch / Flashlight
  const handleToggleTorch = useCallback(() => {
    try {
      const videoElement = document.querySelector("#hud-qr-reader video") as HTMLVideoElement;
      if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        const nextState = !isTorchOn;
        track.applyConstraints({ advanced: [{ torch: nextState } as any] }).then(() => {
          setIsTorchOn(nextState);
        }).catch(() => {
          toast.error("Fitur senter tidak didukung pada kamera ini.");
        });
      }
    } catch (e) {
      toast.error("Gagal mengaktifkan senter LED.");
    }
  }, [isTorchOn]);

  // Handle File Upload QR Scan
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading("Menganalisis Kode QR dari foto/screenshot...");
    try {
      const fileScanner = new Html5Qrcode("hud-file-reader");
      const decodedText = await fileScanner.scanFile(file, true);
      if (fileScanner.isScanning) {
        await fileScanner.stop().catch(() => {});
      }
      try {
        await fileScanner.clear();
      } catch (e) {}

      toast.success("Kode QR berhasil dibaca dari foto!", { id: toastId });
      setScanStatus("success");
      setStatusMessage(`Dokumen QR Terbaca: ${decodedText.substring(0, 24)}...`);
      playSuccessBeep();
      speakGreeting();
      onScanSuccess(decodedText, "file");
    } catch (err: any) {
      toast.error("Tidak ditemukan Kode QR yang valid di dalam foto tersebut.", { id: toastId });
    } finally {
      if (e.target) e.target.value = "";
    }
  }, [playSuccessBeep, speakGreeting, onScanSuccess]);

  // Lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    startCameraScanner();

    return () => {
      isMountedRef.current = false;
      stopCameraScanner();
    };
  }, []);

  const isSafeGeofence = currentDistance <= maxRadius;

  return (
    <div className="w-full max-w-xl mx-auto rounded-3xl bg-slate-950 text-white p-5 sm:p-7 border-2 border-indigo-500/40 shadow-[0_0_50px_rgba(79,70,229,0.35)] select-none relative overflow-hidden isolate animate-fade-in font-sans">
      {/* Background Cyber Glowing Orbs */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* HEADER BAR */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${mode === "check_in" ? "bg-blue-600/20 text-blue-400 border border-blue-500/40" : "bg-rose-600/20 text-rose-400 border border-rose-500/40"}`}>
            <Camera size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest uppercase text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60 flex items-center gap-1">
                <Sparkles size={10} /> AI SCANNER KEKINIAN
              </span>
              <span className="text-[10px] font-bold text-slate-400 font-mono">v3.0 HUD</span>
            </div>
            <h3 className="text-base font-black tracking-tight text-white mt-0.5">
              {mode === "check_in" ? "🎯 SCAN ABSEN MASUK (CLOCK-IN)" : "🎯 SCAN ABSEN PULANG (CLOCK-OUT)"}
            </h3>
          </div>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition"
          title={soundEnabled ? "Nonaktifkan Suara Sapaan" : "Aktifkan Suara Sapaan"}
        >
          {soundEnabled ? <Volume2 size={18} className="text-emerald-400" /> : <VolumeX size={18} className="text-slate-500" />}
        </button>
      </div>

      {/* SATELLITE GEOFENCE HUD BAR */}
      <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-800/80 mb-5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <MapPin size={15} className={isLocating ? "text-amber-400 animate-spin" : isSafeGeofence ? "text-emerald-400" : "text-rose-400"} />
          <span className="text-slate-300">
            {isLocating ? "Mencari satelit..." : `Jarak ke ${schoolName}: `}
            {!isLocating && <strong className={isSafeGeofence ? "text-emerald-400" : "text-rose-400 font-bold"}>{Math.round(currentDistance)} Meter</strong>}
          </span>
        </div>
        <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${isSafeGeofence ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse"}`}>
          {isSafeGeofence ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
          {isSafeGeofence ? `GEOFENCE AMAN (≤ ${maxRadius}m)` : `DI LUAR RADIUS (> ${maxRadius}m)`}
        </div>
      </div>

      {/* VIEWFINDER CONTAINER */}
      <div className="relative w-full aspect-square max-w-[320px] mx-auto rounded-3xl overflow-hidden border-2 border-slate-800 bg-black/80 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] flex items-center justify-center">
        {/* HTML5-QRCode Reader DOM Element */}
        <div id="hud-qr-reader" className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover" />
        <div id="hud-file-reader" className="hidden" />

        {/* HUD OVERLAY BRACKETS */}
        <div className="absolute inset-5 pointer-events-none flex flex-col justify-between">
          <div className="flex justify-between">
            <div className="w-8 h-8 border-t-4 border-l-4 border-cyan-400 rounded-tl-xl shadow-[0_0_10px_#22d3ee]" />
            <div className="w-8 h-8 border-t-4 border-r-4 border-cyan-400 rounded-tr-xl shadow-[0_0_10px_#22d3ee]" />
          </div>
          
          {/* CENTER RETICLE */}
          <div className="flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border border-cyan-500/30 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-ping" />
            </div>
          </div>

          <div className="flex justify-between">
            <div className="w-8 h-8 border-b-4 border-l-4 border-cyan-400 rounded-bl-xl shadow-[0_0_10px_#22d3ee]" />
            <div className="w-8 h-8 border-b-4 border-r-4 border-cyan-400 rounded-br-xl shadow-[0_0_10px_#22d3ee]" />
          </div>
        </div>

        {/* ANIMATED SCANNING LASER BEAM */}
        {isScanning && scanStatus === "idle" && (
          <div className="absolute left-4 right-4 h-1.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_18px_#22d3ee] pointer-events-none animate-scan-laser z-20 rounded-full opacity-90" />
        )}

        {/* SCAN STATUS OVERLAY IF SUCCESS */}
        {scanStatus === "success" && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in z-30">
            <CheckCircle className="w-16 h-16 text-emerald-400 mb-3 animate-bounce shadow-[0_0_20px_rgba(52,211,153,0.5)]" />
            <h4 className="text-base font-black uppercase text-emerald-400 tracking-wider mb-1">
              🎉 BERHASIL SCAN QR CODE!
            </h4>
            <p className="text-xs text-slate-300 font-medium max-w-[220px] mb-4">
              {statusMessage || "Memproses sinkronisasi data presensi Anda ke Cloud..."}
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[11px] font-bold text-emerald-300">
              ⚡ Terhubung ke Waktu SAKTI Server / Instansi
            </div>
          </div>
        )}
      </div>

      {/* QUICK CAMERA ACTIONS BUTTON BAR */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <button
          type="button"
          onClick={handleSwitchCamera}
          disabled={!isScanning}
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 transition disabled:opacity-50"
        >
          <RefreshCw size={15} className="text-indigo-400" />
          <span>🔄 Ganti Kamera ({cameras.length})</span>
        </button>

        <button
          type="button"
          onClick={handleToggleTorch}
          disabled={!isScanning || !hasTorchSupport}
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl border text-xs font-bold transition disabled:opacity-40 ${
            isTorchOn
              ? "bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
              : "bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-200"
          }`}
        >
          <Zap size={15} className={isTorchOn ? "text-amber-400 fill-amber-400" : "text-slate-400"} />
          <span>{isTorchOn ? "💡 Senter ON" : "💡 Senter OFF"}</span>
        </button>
      </div>

      {/* SECONDARY UPLOAD FROM GALLERY & CANCEL BUTTONS */}
      <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
        <label className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-900/60 to-purple-900/60 border border-indigo-500/40 hover:border-indigo-400 text-xs font-bold text-indigo-200 cursor-pointer transition">
          <Upload size={15} className="text-cyan-400" />
          <span>📁 Pindai Foto QR / Screenshot</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </label>

        <button
          type="button"
          onClick={() => {
            stopCameraScanner();
            onCancel();
          }}
          className="w-full sm:w-auto py-2.5 px-6 rounded-2xl bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600/30 text-xs font-bold text-rose-300 transition shrink-0"
        >
          ❌ Tutup Scanner
        </button>
      </div>

      {/* FOOTER INFO BAR */}
      <div className="mt-4 text-center">
        <p className="text-[10px] text-slate-500">
          *Arahkan lensa kamera ke <strong>QR Code Harian Gerbang Instansi / Sekolah / Kampus</strong> atau unggah foto QR dari galeri ponsel Anda.
        </p>
      </div>
    </div>
  );
};
