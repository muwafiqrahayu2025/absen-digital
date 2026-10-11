import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { AuthProvider, useAuth } from "./components/AuthContext";
import { ThemeProvider } from "./components/ThemeContext";
import { EditModeProvider } from "./components/EditModeContext";
import { Layout } from "./components/Layout";
import { Suspense } from "react";
import { PageLoader } from "./components/PageLoader";
import { Login } from "./pages/Login";
import { ForgotPassword } from "./pages/ForgotPassword";
import { Register } from "./pages/Register";
import { LandingPage } from "./pages/LandingPage";

// ── LAZY LOADED COMPONENTS (Code Splitting) ────────────────
const Dashboard = React.lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Profile = React.lazy(() => import("./pages/Profile").then(m => ({ default: m.Profile })));
const SecuritySettings = React.lazy(() => import("./pages/account/SecuritySettings").then(m => ({ default: m.SecuritySettings })));
const ManageUsers = React.lazy(() => import("./pages/admin/ManageUsers").then(m => ({ default: m.ManageUsers })));
const ManageSchool = React.lazy(() => import("./pages/admin/ManageSchool").then(m => ({ default: m.ManageSchool })));
const ManageAcademic = React.lazy(() => import("./pages/admin/ManageAcademic").then(m => ({ default: m.ManageAcademic })));
const ManageHolidays = React.lazy(() => import("./pages/admin/ManageHolidays").then(m => ({ default: m.ManageHolidays })));
const ManageAttendance = React.lazy(() => import("./pages/admin/ManageAttendance").then(m => ({ default: m.ManageAttendance })));
const ManageLeave = React.lazy(() => import("./pages/admin/ManageLeave").then(m => ({ default: m.ManageLeave })));
const ManageSchedule = React.lazy(() => import("./pages/admin/ManageSchedule").then(m => ({ default: m.ManageSchedule })));
const GenerateQR = React.lazy(() => import("./pages/admin/GenerateQR").then(m => ({ default: m.GenerateQR })));
const ScanQR = React.lazy(() => import("./pages/teacher/ScanQR").then(m => ({ default: m.ScanQR })));
const PrincipalAttendanceRecaps = React.lazy(() => import("./pages/principal/PrincipalAttendanceRecaps").then(m => ({ default: m.PrincipalAttendanceRecaps })));
const PrintRecap = React.lazy(() => import("./pages/principal/PrintRecap").then(m => ({ default: m.PrintRecap })));
const SchoolScanner = React.lazy(() => import("./pages/admin/SchoolScanner").then(m => ({ default: m.SchoolScanner })));
const ManageTenants = React.lazy(() => import("./pages/admin/ManageTenants").then(m => ({ default: m.ManageTenants })));
const SystemConfiguration = React.lazy(() => import("./pages/admin/SystemConfiguration").then(m => ({ default: m.SystemConfiguration })));
const LocalValidationCenter = React.lazy(() => import("./pages/admin/LocalValidationCenter").then(m => ({ default: m.LocalValidationCenter })));
const ManageLicenses = React.lazy(() => import("./pages/admin/ManageLicenses").then(m => ({ default: m.ManageLicenses })));
const AuditLogs = React.lazy(() => import("./pages/admin/AuditLogs").then(m => ({ default: m.AuditLogs })));
const KioskSettings = React.lazy(() => import("./pages/admin/KioskSettings").then(m => ({ default: m.KioskSettings })));
const DangerZone = React.lazy(() => import("./pages/admin/DangerZone").then(m => ({ default: m.DangerZone })));
const AiAnalytics = React.lazy(() => import("./pages/admin/AiAnalytics").then(m => ({ default: m.AiAnalytics })));
const LiveQRView = React.lazy(() => import("./pages/LiveQRView").then(m => ({ default: m.LiveQRView })));
const LandingPageSettings = React.lazy(() => import("./pages/admin/LandingPageSettings").then(m => ({ default: m.LandingPageSettings })));
import { FloatingEditTools } from "./components/FloatingEditTools";
import { DeviceRegistrationModal } from "./components/DeviceRegistrationModal";
import { initNotificationQueueProcessor } from "./lib/notificationQueue";
import { initializeFirebaseSync } from "./lib/firebaseSync";
import type { Role } from "./types";
import { ProtectedRoute } from "./components/ProtectedRoute";

// ── Inisialisasi background job ──────────────────────────────
initNotificationQueueProcessor();

// ── Semua role attendance (scan QR mandiri) ──────────────────
const ATTENDANCE_CAPABLE_ROLES: Role[] = [
  'guru', 'dosen', 'staf_sekolah', 'staf_kampus', 'kepala_sekolah', 'admin', 'developer'
];

// ── Role yang bisa akses manajemen absensi ───────────────────
const ATTENDANCE_MANAGEMENT_ROLES: Role[] = ['admin', 'kepala_sekolah', 'developer'];

// ── Role eksklusif admin dan developer ──────────────────────
const ADMIN_ONLY_ROLES: Role[] = ['admin', 'developer'];

// ─────────────────────────────────────────────────────────────
// TOP-LEVEL ROUTE BRANCHING
// Percabangan tingkat tertinggi: menggunakan ProtectedRoute dan ErrorBoundary.
// ─────────────────────────────────────────────────────────────
import { ErrorBoundary } from "./components/ErrorBoundary";

function AppRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: Role[]; }) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </ProtectedRoute>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT ROUTE HANDLER
// Menentukan apakah user melihat LandingPage, Login, atau App Layout
// ─────────────────────────────────────────────────────────────
function RootRouteHandler() {
  const { user, isAuthLoading } = useAuth();
  const location = useLocation();

  if (isAuthLoading) return null;

  if (!user) {
    if (location.pathname === "/" || location.pathname === "") {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        window.location.protocol === 'file:' ||
        Boolean((window as any).__TAURI__) ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      const isRegisteredDevice = Boolean(localStorage.getItem('abdi_registration_token'));

      if (isStandalone || isRegisteredDevice) {
        return <Navigate to="/login" replace />;
      }
      return <LandingPage />;
    }

    // Simpan redirect target
    const search = window.location.search;
    if (search) {
      sessionStorage.setItem("login_redirect_search", search);
      sessionStorage.setItem("login_redirect_pathname", window.location.pathname);
    }
    return <Navigate to="/login" replace />;
  }

  // Bungkus Layout dengan AppRoute sebagai percabangan level tertinggi
  return (
    <AppRoute>
      <Layout />
    </AppRoute>
  );
}

// ─────────────────────────────────────────────────────────────
// PUBLIC ONLY ROUTE — redirect ke dashboard jika sudah login
// ─────────────────────────────────────────────────────────────
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthLoading } = useAuth();
  if (isAuthLoading) return null;
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [isRooted, setIsRooted] = React.useState(false);

  React.useEffect(() => {
    // ── Root/Jailbreak Detection ────────────────────────────
    const checkRoot = async () => {
      const isDeviceRooted = false; // Production: implement proper detection
      if (isDeviceRooted) setIsRooted(true);
    };
    checkRoot();

    // ── PWA Install Prompt (beforeinstallprompt) ────────────
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      (window as any).__pwaInstallPrompt = e;

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
                  style={{
                    background: '#4f46e5', color: 'white', border: 'none',
                    borderRadius: '8px', padding: '6px 12px', fontSize: '11px',
                    fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap'
                  }}
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

    // Cegah sinkronisasi Firebase berjalan di sesi demo
    let cleanupSync: any = null;
    cleanupSync = initializeFirebaseSync();

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
            <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
            <Suspense fallback={<PageLoader />}>
              <Routes>
              {/* ── PUBLIC ROUTES ─────────────────────────────── */}
              <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
              <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
              <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
              <Route path="/landing" element={<PublicOnlyRoute><LandingPage /></PublicOnlyRoute>} />
              <Route path="/home" element={<PublicOnlyRoute><LandingPage /></PublicOnlyRoute>} />

              {/* ── LIVE QR (Public — untuk kiosk/proyektor tanpa auth) ── */}
              <Route path="/live-qr" element={<LiveQRView />} />
              <Route path="/live-qr/:id" element={<LiveQRView />} />

              {/* ── PRINT (Protected — butuh auth) ─────────────── */}
              <Route
                path="/print/recap"
                element={
                  <AppRoute allowedRoles={['admin', 'kepala_sekolah', 'developer']}>
                    <PrintRecap />
                  </AppRoute>
                }
              />

              {/* ── MAIN APP (Layout wrapper) ───────────────────── */}
              <Route path="/" element={<RootRouteHandler />}>
                {/* Dashboard — semua role yang sudah login */}
                <Route index element={<AppRoute><Dashboard /></AppRoute>} />

                {/* Profil — semua role yang sudah login */}
                <Route path="profile" element={<AppRoute><Profile /></AppRoute>} />
                <Route path="account/security" element={<AppRoute><SecuritySettings /></AppRoute>} />

                {/* ── ADMIN ROUTES ─────────────────────────── */}
                <Route
                  path="admin/users"
                  element={
                    <AppRoute allowedRoles={ADMIN_ONLY_ROLES}>
                      <ManageUsers />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/school"
                  element={
                    <AppRoute allowedRoles={['admin', 'kepala_sekolah', 'developer']}>
                      <ManageSchool />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/academic"
                  element={
                    <AppRoute allowedRoles={ADMIN_ONLY_ROLES}>
                      <ManageAcademic />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/holidays"
                  element={
                    <AppRoute allowedRoles={ADMIN_ONLY_ROLES}>
                      <ManageHolidays />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/recaps"
                  element={
                    <AppRoute allowedRoles={ATTENDANCE_MANAGEMENT_ROLES}>
                      <PrincipalAttendanceRecaps />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/attendance"
                  element={
                    <AppRoute allowedRoles={ATTENDANCE_MANAGEMENT_ROLES}>
                      <ManageAttendance />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/validation"
                  element={
                    <AppRoute allowedRoles={ATTENDANCE_MANAGEMENT_ROLES}>
                      <LocalValidationCenter />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/leave"
                  element={
                    <AppRoute allowedRoles={ATTENDANCE_MANAGEMENT_ROLES}>
                      <ManageLeave />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/schedule"
                  element={
                    <AppRoute allowedRoles={ATTENDANCE_MANAGEMENT_ROLES}>
                      <ManageSchedule />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/generate-qr"
                  element={
                    <AppRoute allowedRoles={ADMIN_ONLY_ROLES}>
                      <GenerateQR />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/school-scanner"
                  element={
                    <AppRoute allowedRoles={ATTENDANCE_MANAGEMENT_ROLES}>
                      <SchoolScanner />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/tenants"
                  element={
                    <AppRoute allowedRoles={['developer']}>
                      <ManageTenants />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/system-config"
                  element={
                    <AppRoute allowedRoles={['developer']}>
                      <SystemConfiguration />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/landing-page"
                  element={
                    <AppRoute allowedRoles={['developer']}>
                      <LandingPageSettings />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/audit-logs"
                  element={
                    <AppRoute allowedRoles={['developer']}>
                      <AuditLogs />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/kiosk"
                  element={
                    <AppRoute allowedRoles={['developer']}>
                      <KioskSettings />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/danger-zone"
                  element={
                    <AppRoute allowedRoles={['developer']}>
                      <DangerZone />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/licenses"
                  element={
                    <AppRoute allowedRoles={['admin', 'kepala_sekolah', 'developer']}>
                      <ManageLicenses />
                    </AppRoute>
                  }
                />
                <Route
                  path="admin/ai-analytics"
                  element={
                    <AppRoute allowedRoles={['admin', 'kepala_sekolah', 'developer']}>
                      <AiAnalytics />
                    </AppRoute>
                  }
                />

                {/* ── TEACHER / STAFF ROUTES ───────────────── */}
                <Route
                  path="teacher/scan"
                  element={
                    <AppRoute allowedRoles={ATTENDANCE_CAPABLE_ROLES}>
                      <ScanQR />
                    </AppRoute>
                  }
                />

                {/* ── PRINCIPAL ROUTES ─────────────────────── */}
                <Route
                  path="principal/recaps"
                  element={
                    <AppRoute allowedRoles={['kepala_sekolah', 'admin', 'developer']}>
                      <PrincipalAttendanceRecaps />
                    </AppRoute>
                  }
                />

                {/* ── CATCH ALL — redirect ke dashboard ───── */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </EditModeProvider>
    </ThemeProvider>
  );
}
