import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, CheckCircle, AlertTriangle, MapPin, ShieldCheck, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { verifyFaceQuality } from '../lib/faceVerification';

interface BiometricSelfieProps {
  onCaptureSuccess: (photoDataUrl: string) => void;
  onCancel: () => void;
  onBackToQR?: () => void;
  userName?: string;
  mode?: "check_in" | "check_out";
  schoolName?: string;
  maxRadius?: number;
  currentDistance?: number;
  isLocating?: boolean;
}

export const BiometricSelfie: React.FC<BiometricSelfieProps> = ({
  onCaptureSuccess,
  onCancel,
  onBackToQR,
  userName = 'Pegawai',
  mode = "check_in",
  schoolName = "Instansi / Sekolah / Kampus",
  maxRadius = 120,
  currentDistance = 0,
  isLocating = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');

  const initCamera = useCallback(async (deviceId?: string) => {
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === 'videoinput');
      setCameras(videoDevices);

      let targetId = deviceId;
      if (!targetId && videoDevices.length > 0) {
        // Prioritaskan kamera depan untuk selfie
        const frontCam = videoDevices.find((c) => c.label.toLowerCase().includes('front') || c.label.toLowerCase().includes('depan'));
        targetId = frontCam ? frontCam.deviceId : videoDevices[0].deviceId;
      }
      
      setSelectedCamera(targetId || '');

      const constraints = targetId 
        ? { video: { deviceId: { exact: targetId }, width: 640, height: 480 } }
        : { video: { facingMode: 'user', width: 640, height: 480 } };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err: any) {
      toast.error('Gagal mengakses kamera: ' + err.message);
    }
  }, [stream]);

  useEffect(() => {
    initCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.deviceId === selectedCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    initCamera(cameras[nextIndex].deviceId);
  };

  const captureAndVerify = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsVerifying(true);
    setIssues([]);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      try {
        const result = await verifyFaceQuality(photoDataUrl);
        if (result.passed) {
          toast.success('Wajah terverifikasi!');
          // Hentikan stream kamera
          if (stream) stream.getTracks().forEach((t) => t.stop());
          onCaptureSuccess(photoDataUrl);
        } else {
          setIssues(result.issues);
          toast.error('Foto belum memenuhi syarat, silakan ambil ulang.');
        }
      } catch (err: any) {
        toast.error('Gagal memverifikasi wajah.');
      }
    }
    
    setIsVerifying(false);
  };

  const isSafeGeofence = currentDistance <= maxRadius;
  const buttonGradient = mode === "check_in" 
    ? "from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400" 
    : "from-rose-600 to-fuchsia-600 hover:from-rose-500 hover:to-fuchsia-500";

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative animate-fade-in font-sans text-slate-800">
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold text-slate-800">Verifikasi Wajah (GPS/Selfie)</h3>
        <button onClick={onCancel} className="text-slate-500 hover:text-rose-500 text-xs font-medium transition">
          Batal
        </button>
      </div>
      
      <div className="p-4 sm:p-6 space-y-5">
        <div className="text-center">
          <p className="text-xs font-medium text-slate-500">Langkah 2: Ambil Selfie untuk Menyelesaikan Absensi</p>
        </div>

        {/* SATELLITE GEOFENCE HUD BAR */}
        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <MapPin size={15} className={isLocating ? "text-amber-500 animate-spin" : isSafeGeofence ? "text-emerald-500" : "text-rose-500"} />
            <span className="text-slate-600">
              {isLocating ? "Mencari satelit..." : `Jarak ke ${schoolName}: `}
              {!isLocating && <strong className={isSafeGeofence ? "text-emerald-600" : "text-rose-500 font-bold"}>{Math.round(currentDistance)} Meter</strong>}
            </span>
          </div>
          <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${isSafeGeofence ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-rose-50 text-rose-600 border border-rose-200 animate-pulse"}`}>
            {isSafeGeofence ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
            {isSafeGeofence ? `GEOFENCE AMAN (≤ ${maxRadius}m)` : `DI LUAR RADIUS (> ${maxRadius}m)`}
          </div>
        </div>

        <div className="relative bg-slate-100 rounded-2xl overflow-hidden aspect-video flex items-center justify-center border border-slate-200 shadow-inner">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="max-h-full max-w-full object-cover transform -scale-x-100" 
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Face Guide Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-64 border-2 border-dashed border-white/70 rounded-[4rem] shadow-[0_0_15px_rgba(255,255,255,0.2)]"></div>
          </div>
          
          {cameras.length > 1 && (
            <button 
              onClick={switchCamera}
              className="absolute top-4 right-4 bg-white/60 p-2.5 rounded-xl border border-white/50 text-slate-800 hover:bg-white/90 transition backdrop-blur"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="text-center space-y-4 pt-2">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Hai <strong className="text-slate-800">{userName}</strong>, posisikan wajah Anda di dalam area oval. 
            Pastikan pencahayaan cukup dan wajah terlihat jelas.
          </p>

          {issues.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-xl text-[11px] flex items-start text-left">
              <AlertTriangle className="w-5 h-5 mr-2 shrink-0 mt-0.5 text-rose-500" />
              <ul className="list-disc pl-4 space-y-1">
                {issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={captureAndVerify}
              disabled={isVerifying || !stream}
              className={`w-full bg-gradient-to-r ${buttonGradient} text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-lg`}
            >
              {isVerifying ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
              {isVerifying ? 'Memverifikasi Wajah...' : 'Absen Sekarang (Selfie)'}
            </button>

            {onBackToQR && (
              <button
                onClick={onBackToQR}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
              >
                <ArrowLeft size={14} /> Kembali ke Langkah 1
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

