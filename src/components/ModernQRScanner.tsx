import React, { useEffect, useRef, useState, useCallback } from "react";
import ReactDOM from "react-dom"; // WAJIB DIIMPORT UNTUK FULL SCREEN
import { Html5Qrcode } from "html5-qrcode";
import { RefreshCw, Zap, CheckCircle, ChevronLeft } from "lucide-react";
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
}) => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorchSupport, setHasTorchSupport] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Efek suara sukses
  const playSuccessBeep = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // Abaikan jika browser tidak mendukung
    }
  }, []);

  const startCameraScanner = useCallback(async (cameraId?: string) => {
    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop().catch(() => { });
        }
      } else {
        scannerRef.current = new Html5Qrcode("hud-qr-reader");
      }

      let targetCameraId = cameraId || selectedCameraId;
      if (!targetCameraId) {
        const deviceCameras = await Html5Qrcode.getCameras().catch(() => []);
        if (deviceCameras && deviceCameras.length > 0) {
          setCameras(deviceCameras);
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
          // aspectRatio dihilangkan agar bisa melebar penuh
        },
        (decodedText) => {
          if (!isMountedRef.current || scanStatus === "success") return;
          setScanStatus("success");
          setStatusMessage(`Kode QR Terbaca: ${decodedText.substring(0, 24)}...`);
          playSuccessBeep();

          if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => { });
          }
          setIsScanning(false);

          // Jeda sedikit agar user melihat status centang hijau sebelum ditutup
          setTimeout(() => {
            onScanSuccess(decodedText, "scanner");
          }, 1000);
        },
        () => {
          // Abaikan error frame kosong
        }
      );

      setIsScanning(true);

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
  }, [selectedCameraId, scanStatus, playSuccessBeep, onScanSuccess]);

  const stopCameraScanner = useCallback(async () => {
    if (scannerRef.current) {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop().catch(() => { });
      }
      try {
        await scannerRef.current.clear();
      } catch (e) { }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

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

  useEffect(() => {
    isMountedRef.current = true;
    startCameraScanner();

    return () => {
      isMountedRef.current = false;
      stopCameraScanner();
    };
  }, []);

  // MENGGUNAKAN CREATE PORTAL AGAR MELEWATI BATAS DASHBOARD DAN BENAR-BENAR FULL SCREEN
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[99999] bg-black text-white flex flex-col font-sans animate-fade-in">

      {/* STYLE KHUSUS UNTUK MEMAKSA VIDEO FULL SCREEN TANPA KOTAK PUTIH */}
      <style>{`
        #hud-qr-reader video {
          width: 100vw !important;
          height: 100vh !important;
          object-fit: cover !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          z-index: 0 !important;
        }
        #hud-qr-reader {
          width: 100vw !important;
          height: 100vh !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          border: none !important;
          background: black;
        }
        /* Sembunyikan elemen bawaan html5-qrcode yang mengganggu (kotak putih dll) */
        #hud-qr-reader img, 
        #hud-qr-reader span, 
        #hud-qr-reader div:not(:first-child) {
            display: none !important;
        }
        #qr-shaded-region {
            display: none !important;
        }
      `}</style>

      {/* KONTEN OVERLAY UI KAMERA */}
      <div className="relative w-full h-full flex flex-col z-10">

        {/* HEADER */}
        <div className="flex items-center gap-4 p-5 pt-8 bg-gradient-to-b from-black/80 to-transparent">
          <button
            onClick={() => { stopCameraScanner(); onCancel(); }}
            className="text-white hover:text-gray-300 p-2 -ml-2 transition-transform active:scale-95"
          >
            <ChevronLeft size={28} />
          </button>
          <h2 className="text-lg font-semibold tracking-wide text-white">
            Scan {mode === "check_in" ? "Masuk" : "Pulang"}
          </h2>
        </div>

        {/* AREA TENGAH - BINGKAI ORANYE PERSIS SEPERTI REFERENSI GAMBAR */}
        <div className="flex-1 flex flex-col items-center justify-center relative px-8">
          <div className="w-full max-w-[280px] aspect-square relative flex flex-col justify-between">
            {/* Sudut Atas */}
            <div className="flex justify-between">
              <div className="w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-sm" />
              <div className="w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-sm" />
            </div>

            {/* Animasi Garis Laser Scanner (Opsional) */}
            {isScanning && scanStatus === "idle" && (
              <div className="absolute top-0 left-0 w-full h-[2px] bg-orange-500 shadow-[0_0_15px_#f97316] animate-scan-laser z-20" />
            )}

            {/* Sudut Bawah */}
            <div className="flex justify-between">
              <div className="w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-sm" />
              <div className="w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-sm" />
            </div>
          </div>

          <p className="mt-8 text-sm font-medium text-white/90 drop-shadow-md">
            Arahkan Kamera ke Kode QR
          </p>
        </div>

        {/* FOOTER ACTIONS (Flash & Ganti Kamera) */}
        <div className="pb-10 pt-4 px-10 flex items-center justify-between bg-gradient-to-t from-black/90 via-black/50 to-transparent">
          <button
            onClick={handleToggleTorch}
            disabled={!hasTorchSupport}
            className="flex flex-col items-center gap-2 text-white disabled:opacity-30 active:scale-95 transition-transform"
          >
            <Zap size={24} className={isTorchOn ? "text-amber-400 fill-amber-400" : ""} />
            <span className="text-xs tracking-wide">Flash</span>
          </button>

          <button
            onClick={handleSwitchCamera}
            disabled={!isScanning}
            className="flex flex-col items-center gap-2 text-white disabled:opacity-30 active:scale-95 transition-transform"
          >
            <RefreshCw size={24} />
            <span className="text-xs tracking-wide">Ganti Kamera</span>
          </button>
        </div>

      </div>

      {/* KANVAS VIDEO KAMERA DI BELAKANG (Z-INDEX 0) */}
      <div id="hud-qr-reader" className="absolute inset-0 z-0" />

      {/* OVERLAY STATUS JIKA SUKSES */}
      {scanStatus === "success" && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 text-center">
          <CheckCircle className="w-20 h-20 text-emerald-400 mb-4 animate-bounce" />
          <h4 className="text-xl font-black uppercase text-emerald-400 tracking-wider mb-2">BERHASIL!</h4>
          <p className="text-sm text-slate-300 font-medium">{statusMessage || "Merekam presensi..."}</p>
        </div>
      )}
    </div>,
    document.body // INI ADALAH KUNCI AGAR KAMERA MUNCUL DI LAPISAN PALING DEPAN BROWSER
  );
};
