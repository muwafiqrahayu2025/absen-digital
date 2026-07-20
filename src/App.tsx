import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { AuthProvider, useAuth } from "./components/AuthContext";
import { ThemeProvider } from "./components/ThemeContext";
import { EditModeProvider } from "./components/EditModeContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { ForgotPassword } from "./pages/ForgotPassword";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { Profile } from "./pages/Profile";
import { ManageUsers } from "./pages/admin/ManageUsers";
import { ManageSchool } from "./pages/admin/ManageSchool";
import { ManageAcademic } from "./pages/admin/ManageAcademic";
import { ManageHolidays } from "./pages/admin/ManageHolidays";
import { ManageAttendance } from "./pages/admin/ManageAttendance";
import { ManageLeave } from "./pages/admin/ManageLeave";
import { ManageSchedule } from "./pages/admin/ManageSchedule";
import { GenerateQR } from "./pages/admin/GenerateQR";
import { ScanQR } from "./pages/teacher/ScanQR";
import { PrincipalAttendanceRecaps } from "./pages/principal/PrincipalAttendanceRecaps";
import { PrintRecap } from "./pages/principal/PrintRecap";
import { SchoolScanner } from "./pages/admin/SchoolScanner";
import { DeveloperConsole } from "./pages/admin/DeveloperConsole";
import { ManageTenants } from "./pages/admin/ManageTenants";
import { FloatingEditTools } from "./components/FloatingEditTools";
import { LandingPage } from "./pages/LandingPage";
import { DeviceRegistrationModal } from "./components/DeviceRegistrationModal";
import { LocalValidationCenter } from "./pages/admin/LocalValidationCenter";
import { ManageLicenses } from "./pages/admin/ManageLicenses";
import { AiAnalytics } from "./pages/admin/AiAnalytics";
import { LiveQRView } from "./pages/LiveQRView";
import { initNotificationQueueProcessor } from "./lib/notificationQueue";
import { initializeFirebaseSync } from "./lib/firebaseSync";


// Inisialisasi Notification Queue Processor (background job sekali saat app dimuat)
initNotificationQueueProcessor();

function RootRouteHandler() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    if (location.pathname === "/" || location.pathname === "") {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true || window.location.protocol === 'file:' || Boolean((window as any).__TAURI__) || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isRegisteredDevice = Boolean(localStorage.getItem('abdi_registration_token'));
      if (isStandalone || isRegisteredDevice) {
        return <Navigate to="/login" replace />;
      }
      return <LandingPage />;
    }
    const search = window.location.search;
    if (search) {
      sessionStorage.setItem("login_redirect_search", search);
      sessionStorage.setItem("login_redirect_pathname", window.location.pathname);
    }
    return <Navigate to="/login" replace />;
  }
  return <Layout />;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) {
    // Preserve search params for direct phone scans
    const search = window.location.search;
    if (search) {
      sessionStorage.setItem("login_redirect_search", search);
      sessionStorage.setItem("login_redirect_pathname", window.location.pathname);
    }
    return <Navigate to="/login" />;
  }
  if (allowedRoles && !allowedRoles.includes(user.role))
    return <Navigate to="/" />;
  return children;
}

export default function App() {
  const [isRooted, setIsRooted] = React.useState(false);

  React.useEffect(() => {
    // Simulasi deteksi Root/Jailbreak terenkripsi
    const checkRoot = async () => {
      const isDeviceRooted = false;
      if (isDeviceRooted) setIsRooted(true);
    };
    checkRoot();

    // ── PWA Install Prompt (beforeinstallprompt) ──────────────────────
    // Simpan event di window agar bisa dipanggil dari komponen manapun
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      (window as any).__pwaInstallPrompt = e;

      // Hanya tampilkan banner di perangkat mobile
      const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (isMobile && !dismissed) {
        setTimeout(() => {
          toast(
            (t) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>📲</span>
                <div>
                  <p style={{ fontWeight: 800, fontSize: '12px', margin: 0 }}>Install Aplikasi ABDI</p>
                  <p style={{ fontSize: '10px', color: '#666', margin: 0 }}>Tambahkan ke layar utama untuk akses cepat</p>
                </div>
                <button
                  onClick={() => {
                    const prompt = (window as any).__pwaInstallPrompt;
                    if (prompt) { prompt.prompt(); }
                    toast.dismiss(t.id);
                    sessionStorage.setItem('pwa_banner_dismissed', '1');
                  }}
                  style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Install
                </button>
              </div>
            ),
            { duration: 12000, id: 'pwa-install-banner' }
          );
        }, 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const cleanupSync = initializeFirebaseSync();
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      if (typeof cleanupSync === 'function') cleanupSync();
    };
  }, []);

  if (isRooted) {
    return (
      <div className="min-h-screen bg-black text-red-500 flex flex-col items-center justify-center p-8 text-center font-sans">
        <div className="w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(220,38,38,0.4)]">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-3xl font-black mb-4 tracking-tight drop-shadow-md">Akses Keamanan Ditolak!</h1>
        <p className="text-base font-medium mb-2 opacity-90">Perangkat ini terdeteksi telah dimodifikasi (Root/Jailbreak).</p>
        <p className="text-sm mt-4 text-white/50 max-w-sm">Demi keamanan dan integritas data sekolah, aplikasi tidak dapat dijalankan di lingkungan perangkat yang tidak aman.</p>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <EditModeProvider>
        <BrowserRouter>
          <AuthProvider>
            <DeviceRegistrationModal />
            <FloatingEditTools />
            <Toaster position="top-right" />
            <Routes>
              <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
              <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
              <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
              <Route path="/landing" element={<PublicOnlyRoute><LandingPage /></PublicOnlyRoute>} />
              <Route path="/home" element={<PublicOnlyRoute><LandingPage /></PublicOnlyRoute>} />
              <Route path="/live-qr" element={<LiveQRView />} />
              <Route path="/live-qr/:id" element={<LiveQRView />} />

              <Route
                path="/print/recap"
                element={
                  <ProtectedRoute allowedRoles={["admin", "kepala_sekolah", "developer"]}>
                    <PrintRecap />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/"
                element={<RootRouteHandler />}
              >
                <Route index element={<Dashboard />} />
                <Route path="profile" element={<Profile />} />

                <Route
                  path="admin/users"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "developer"]}>
                      <ManageUsers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/school"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "kepala_sekolah", "developer"]}>
                      <ManageSchool />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/academic"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "developer"]}>
                      <ManageAcademic />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/holidays"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "developer"]}>
                      <ManageHolidays />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/recaps"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "kepala_sekolah", "developer"]}>
                      <PrincipalAttendanceRecaps />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/attendance"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "kepala_sekolah", "developer"]}>
                      <ManageAttendance />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/validation"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "kepala_sekolah", "developer"]}>
                      <LocalValidationCenter />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/leave"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "kepala_sekolah", "developer"]}>
                      <ManageLeave />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/schedule"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "kepala_sekolah", "developer"]}>
                      <ManageSchedule />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/generate-qr"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "developer"]}>
                      <GenerateQR />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/school-scanner"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "kepala_sekolah", "developer"]}>
                      <SchoolScanner />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/developer"
                  element={
                    <ProtectedRoute allowedRoles={["developer"]}>
                      <DeveloperConsole />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/tenants"
                  element={
                    <ProtectedRoute allowedRoles={["developer"]}>
                      <ManageTenants />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/licenses"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "kepala_sekolah", "developer"]}>
                      <ManageLicenses />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/ai-analytics"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "kepala_sekolah", "developer"]}>
                      <AiAnalytics />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="teacher/scan"
                  element={
                    <ProtectedRoute allowedRoles={["guru", "staf_sekolah", "dosen", "staf_kampus", "kepala_sekolah", "admin", "developer"]}>
                      <ScanQR />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="principal/recaps"
                  element={
                    <ProtectedRoute allowedRoles={["kepala_sekolah", "admin", "developer"]}>
                      <PrincipalAttendanceRecaps />
                    </ProtectedRoute>
                  }
                />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </EditModeProvider>
    </ThemeProvider>
  );
}
