import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getTenantRef } from '../lib/firebase';
import { update } from 'firebase/database';
import { Camera, RefreshCw, Save, ScanFace, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { loadFaceModels, detectFace } from '../lib/faceRecognition';

export function BiometricEnrollment() {
  const { user, login } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null);
  const [statusMsg, setStatusMsg] = useState("Memuat model AI...");

  // Cek apakah user sudah punya data wajah
  const hasFaceData = !!user?.faceDescriptor;

  useEffect(() => {
    // Load model saat komponen di-mount
    loadFaceModels().then((success) => {
      if (success) {
        setIsModelsLoaded(true);
        setStatusMsg("Model AI siap. Silakan mulai pendaftaran.");
      } else {
        setStatusMsg("Gagal memuat model AI. Pastikan file model tersedia di /public/models");
      }
    });

    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    if (!isModelsLoaded) {
      toast.error("Model ML belum siap, silakan tunggu.");
      return;
    }
    
    setIsLoading(true);
    setStatusMsg("Mengaktifkan kamera...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setStatusMsg("Arahkan wajah Anda ke kamera dan pastikan cahaya cukup.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Tidak dapat mengakses kamera.");
      setStatusMsg("Akses kamera ditolak atau kamera tidak ditemukan.");
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureFace = async () => {
    if (!videoRef.current) return;
    setIsLoading(true);
    setStatusMsg("Memindai wajah...");

    try {
      const detection = await detectFace(videoRef.current);
      if (detection) {
        setFaceDescriptor(detection.descriptor);
        setStatusMsg("Wajah berhasil dipindai! Silakan simpan data biometrik Anda.");
        toast.success("Wajah terdeteksi!");
        stopCamera();
      } else {
        setStatusMsg("Wajah tidak terdeteksi. Pastikan Anda melihat lurus ke kamera dengan pencahayaan terang.");
        toast.error("Wajah tidak terdeteksi. Coba lagi.");
      }
    } catch (err: any) {
      setStatusMsg("Terjadi kesalahan saat memindai wajah.");
      toast.error(err.message || "Gagal memindai wajah");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBiometric = async () => {
    if (!faceDescriptor || !user || !user.id) return;
    
    setIsLoading(true);
    try {
      const userRef = getTenantRef(`users/${user.id}`);
      
      // Convert Float32Array to standard Array for JSON serialization in Firebase
      const descriptorArray = Array.from(faceDescriptor);
      const faceDescriptorJson = JSON.stringify(descriptorArray);
      
      await update(userRef, { faceDescriptor: faceDescriptorJson });
      
      // Update local state
      login({ ...user, faceDescriptor: faceDescriptorJson });
      
      toast.success("Data biometrik wajah berhasil disimpan!");
      setFaceDescriptor(null);
      setStatusMsg("Pendaftaran wajah selesai.");
      window.dispatchEvent(new Event("users_updated"));
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan data biometrik");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center py-4 space-y-4 px-2">
      <div className="text-center">
        <h4 className="font-extrabold text-slate-800 text-base flex items-center justify-center gap-2 mb-1">
          <ScanFace size={20} className="text-indigo-600" />
          Keamanan Biometrik
        </h4>
        <p className="text-xs text-gray-500 max-w-sm mx-auto">
          Daftarkan wajah Anda untuk absensi yang lebih aman dan cepat (tanpa sentuh). 
          Data biometrik diproses dan dicocokkan secara lokal di perangkat Anda.
        </p>
      </div>

      {hasFaceData && !isCameraActive && !faceDescriptor && (
        <div className="w-full max-w-xs bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col items-center text-center mt-2">
          <CheckCircle size={32} className="text-emerald-500 mb-2" />
          <h5 className="text-emerald-800 font-bold text-sm">Wajah Terdaftar</h5>
          <p className="text-emerald-600 text-xs mt-1 mb-3">Anda sudah dapat melakukan absensi menggunakan pengenalan wajah.</p>
          <button
            onClick={startCamera}
            className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-4 py-2 rounded-xl hover:bg-emerald-200 transition"
          >
            Daftar Ulang Wajah
          </button>
        </div>
      )}

      {(!hasFaceData || isCameraActive || faceDescriptor) && (
        <div className="w-full max-w-sm bg-slate-50 border border-slate-200 rounded-3xl p-4 flex flex-col items-center">
          
          <div className="relative w-48 h-48 sm:w-64 sm:h-64 bg-slate-800 rounded-full overflow-hidden flex items-center justify-center border-4 border-slate-300 shadow-inner mb-4">
            {!isCameraActive && !faceDescriptor ? (
              <ScanFace size={64} className="text-slate-500" strokeWidth={1} />
            ) : null}
            
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${!isCameraActive ? 'hidden' : ''}`}
            />
            
            {faceDescriptor && !isCameraActive && (
              <div className="absolute inset-0 bg-indigo-900/80 flex flex-col items-center justify-center text-white p-4 text-center">
                <CheckCircle size={48} className="text-emerald-400 mb-2" />
                <span className="text-sm font-bold">Wajah Terdeteksi</span>
              </div>
            )}
            
            {isLoading && (
              <div className="absolute inset-0 bg-slate-900/50 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                <RefreshCw size={32} className="animate-spin text-white mb-2" />
                <span className="text-xs font-bold animate-pulse">Memproses...</span>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-xl w-full text-center mb-4 flex flex-col items-center gap-1">
            <span className="font-semibold">{statusMsg}</span>
            {!isModelsLoaded && (
              <span className="text-amber-600 flex items-center gap-1 mt-1">
                <AlertTriangle size={12} /> Tunggu sebentar...
              </span>
            )}
          </div>

          <div className="flex gap-2 w-full">
            {!isCameraActive && !faceDescriptor ? (
              <button
                onClick={startCamera}
                disabled={!isModelsLoaded || isLoading}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 font-bold text-white text-xs rounded-2xl bg-indigo-600 shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
              >
                <Camera size={14} /> Buka Kamera
              </button>
            ) : isCameraActive ? (
              <>
                <button
                  onClick={stopCamera}
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 font-bold text-slate-700 text-xs rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={captureFace}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 font-bold text-white text-xs rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg hover:-translate-y-0.5 disabled:opacity-50 transition-all"
                >
                  <ScanFace size={14} /> Pindai Wajah
                </button>
              </>
            ) : faceDescriptor ? (
              <>
                <button
                  onClick={startCamera}
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 font-bold text-slate-700 text-xs rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-all"
                >
                  Ulangi
                </button>
                <button
                  onClick={handleSaveBiometric}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 font-bold text-white text-xs rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg hover:-translate-y-0.5 disabled:opacity-50 transition-all"
                >
                  <Save size={14} /> Simpan
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
