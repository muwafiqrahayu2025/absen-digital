import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { verifyFaceQuality } from '../lib/faceVerification';

interface BiometricSelfieProps {
  onCaptureSuccess: (photoDataUrl: string) => void;
  onCancel: () => void;
  userName?: string;
}

export const BiometricSelfie: React.FC<BiometricSelfieProps> = ({
  onCaptureSuccess,
  onCancel,
  userName = 'Pegawai',
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

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden relative">
      <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-bold text-gray-800">Verifikasi Wajah</h3>
        <button onClick={onCancel} className="text-gray-500 hover:text-red-500 text-sm font-medium">
          Batal
        </button>
      </div>
      
      <div className="relative bg-black aspect-video flex items-center justify-center">
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
          <div className="w-48 h-64 border-2 border-dashed border-white/50 rounded-full"></div>
        </div>
        
        {cameras.length > 1 && (
          <button 
            onClick={switchCamera}
            className="absolute top-4 right-4 bg-black/50 p-2 rounded-full text-white hover:bg-black/70 transition"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-6 text-center space-y-4">
        <p className="text-sm text-gray-600">
          Hai <strong>{userName}</strong>, posisikan wajah Anda di dalam area lingkaran. 
          Pastikan pencahayaan cukup dan wajah terlihat jelas.
        </p>

        {issues.length > 0 && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-start text-left">
            <AlertTriangle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
            <ul className="list-disc pl-4 space-y-1">
              {issues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={captureAndVerify}
          disabled={isVerifying || !stream}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
        >
          {isVerifying ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Camera className="w-5 h-5" />
          )}
          {isVerifying ? 'Memverifikasi...' : 'Ambil Foto Selfie'}
        </button>
      </div>
    </div>
  );
};
