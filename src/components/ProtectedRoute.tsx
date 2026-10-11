import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useLicense } from "../hooks/useLicense";
import type { Role } from "../types";

import { useGlobalSettings } from "../hooks/useGlobalSettings";
import { Monitor } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

// [C2] Defensive Rendering: Error Boundary untuk menangani Crash pada Komponen (akibat PERMISSION_DENIED dsb)
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, errorType: 'chunk' | 'default' | null}> {
  public state: {hasError: boolean, errorType: 'chunk' | 'default' | null} = { hasError: false, errorType: null };
  constructor(props: {children: React.ReactNode}) {
    super(props);
  }
  static getDerivedStateFromError(error: any) {
    if (error && error.name === 'ChunkLoadError' || (error.message && error.message.includes('Loading chunk'))) {
      return { hasError: true, errorType: 'chunk' };
    }
    return { hasError: true, errorType: 'default' };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("[ErrorBoundary] Tertangkap render error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      if (this.state.errorType === 'chunk') {
        return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
            <div className="w-16 h-16 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center shadow-inner mb-4">
              <Monitor size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 mb-2">Koneksi Terputus</h1>
            <p className="text-slate-600 max-w-md mb-6">
              Gagal mengunduh halaman karena gangguan jaringan. Pastikan koneksi internet Anda stabil dan coba muat ulang halaman.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-full hover:bg-indigo-700 transition-colors shadow-lg"
            >
              Muat Ulang Halaman
            </button>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-rose-50 p-6 text-center">
          <div className="w-16 h-16 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg mb-4 text-3xl font-bold">!</div>
          <h1 className="text-2xl font-black text-slate-800 mb-2">Terjadi Kesalahan pada Komponen</h1>
          <p className="text-slate-600 max-w-md mb-6">
            Beberapa data mungkin tidak dapat dimuat karena penolakan izin atau masalah jaringan. Silakan periksa konsol untuk detail log.
          </p>
          <div className="flex gap-4">
            <button onClick={() => (this as any).setState({ hasError: false, errorType: null })} className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-full hover:bg-indigo-700 transition-colors shadow-lg">
              Coba Muat Ulang Komponen
            </button>
            <a href="/" className="px-6 py-2.5 bg-slate-800 text-white font-bold rounded-full hover:bg-slate-700 transition-colors shadow-lg">
              Kembali ke Beranda
            </a>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}


/**
 * ProtectedRoute: Rute KHUSUS untuk Akun Riil / Trial.
 * Memanggil useLicense(), mengevaluasi masa uji coba (trial expired),
 * dan memicu fetch data dari Firebase.
 * Sesi Demo DILARANG masuk rute ini.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthLoading } = useAuth();
  const location = useLocation();

  // Evaluasi lisensi & masa uji coba (trial expired) khusus akun riil
  const { isExpired } = useLicense();
  
  // Ambil pengaturan global untuk maintenance mode
  const { settings, loading: isSettingsLoading } = useGlobalSettings();

  if (isAuthLoading || isSettingsLoading) return null;

  try {
    // 1. Cek Maintenance Mode
    if (settings.isMaintenance && user?.role !== "developer") {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
          <Monitor size={48} className="text-amber-500 mb-4" />
          <h1 className="text-2xl font-black text-slate-800 mb-2">Situs Dalam Perbaikan</h1>
          <p className="text-slate-600 max-w-md">
            Platform sedang dalam pemeliharaan rutin. Silakan coba beberapa saat lagi.
          </p>
        </div>
      );
    }

    // 2. Cek autentikasi untuk akun riil / trial
    if (!user) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 3. Evaluasi lisensi / masa uji coba (bypass untuk developer dan halaman lisensi)
    if (isExpired && user?.role !== "developer" && !location.pathname.startsWith("/admin/licenses")) {
      // [FIX Component 1] Cegah Infinite Loop: Cek apakah user punya hak akses ke halaman /admin/licenses
      const canAccessLicenses = ['admin', 'kepala_sekolah', 'developer'].includes(user?.role || '');
      if (canAccessLicenses) {
        return <Navigate to="/admin/licenses" replace />;
      } else {
        // Untuk Guru / Staf, berikan halaman peringatan, JANGAN redirect.
        return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-rose-50 p-6 text-center">
            <div className="w-16 h-16 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg mb-4 text-3xl font-bold">!</div>
            <h1 className="text-2xl font-black text-slate-800 mb-2">Lisensi Berakhir</h1>
            <p className="text-slate-600 max-w-md mb-6">
              Masa aktif aplikasi untuk instansi Anda telah berakhir. Silakan hubungi Administrator atau Kepala Sekolah untuk memulihkan akses.
            </p>
            <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-slate-800 text-white font-bold rounded-full hover:bg-slate-700 transition-colors shadow-lg">
              Muat Ulang Halaman
            </button>
          </div>
        );
      }
    }

    // 4. Cek hak akses role (RBAC akun riil)
    if (allowedRoles && !allowedRoles.includes(user?.role || '')) {
      return <Navigate to="/" replace />;
    }

    return <ErrorBoundary>{children}</ErrorBoundary>;
  } catch (error) {
    console.error("[ProtectedRoute] Error caught in try-catch block:", error);
    // Render children anyway to avoid fatal error screen, as requested by user
    return <>{children}</>;
  }
}
