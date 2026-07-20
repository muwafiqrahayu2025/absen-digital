import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useAuth } from "../components/AuthContext";
import { db } from "../lib/db";
import { NotificationService } from "../lib/notifications";
import { User } from "../types";
import { User as UserIcon, Lock, MapPin, Eye, EyeOff, LogIn, X, Info, School as SchoolIcon, ShieldCheck } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, dbRealtime, getTenantRef } from "../lib/firebase";
import { ref, get, set, child, remove } from "firebase/database";
import { SwipeButton } from "../components/SwipeButton";
import { EditableText } from "../components/EditableText";
import { DraggableBlock } from "../components/DraggableBlock";
import { useEditMode } from "../components/EditModeContext";
import {
  checkAccountLockout,
  recordFailedLogin,
  resetLoginAttempts,
  verifyPassword,
  hashPassword,
  isHashedPassword,
} from "../lib/localCrypto";
import { recordDeviceSessionLog } from "../lib/deviceDetection";
import { seedDemoUsers } from "../lib/seedDemoUsers";

const hasValidWaNumber = (phone?: string): boolean => {
  if (!phone) return false;
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 10) return false;
  // Ignore common placeholder/dummy strings
  if (clean === '081234567890' || clean === '08123456789' || clean === '1234567890' || /^0+$/.test(clean) || /^1+$/.test(clean) || /^12345/.test(clean)) {
    return false;
  }
  return clean.startsWith('08') || clean.startsWith('62') || clean.startsWith('8');
};

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  // Catatan: loginAttempts dikelola oleh localCrypto (localStorage-persistent),
  // tidak ditracking di React state untuk menghindari duplikasi.
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [swipeKey, setSwipeKey] = useState(0);

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpType, setHelpType] = useState<"forgot" | "help" | null>(null);
  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1);
  const [resetUsername, setResetUsername] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");

  // OTP States
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpType, setOtpType] = useState<"login" | "reset" | null>(null);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [userOtpInput, setUserOtpInput] = useState("");
  const [pendingLoginUser, setPendingLoginUser] = useState<User | null>(null);
  const [otpCountdown, setOtpCountdown] = useState(0);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const interval = setInterval(() => {
      setOtpCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [otpCountdown]);

  const [bgCustomData] = useState<string>(() => {
    return localStorage.getItem("login_bg_custom_data") || "";
  });

  const { login } = useAuth();
  const { customLogo, customLoginBg } = useEditMode();
  const navigate = useNavigate();
  const school = db.getSchool();
  const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);

  const handleResendOtp = () => {
    if (otpCountdown > 0) return;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otp);
    setOtpCountdown(180);
    toast.success("Kode OTP baru telah dikirim!");

    let userToNotify = null;
    if (otpType === "login" && pendingLoginUser) {
      userToNotify = pendingLoginUser;
    } else if (otpType === "reset") {
      get(child(getTenantRef(), "users")).then((snapshot) => {
        if (snapshot.exists()) {
          const usersData = snapshot.val();
          const usersArray = Array.isArray(usersData) ? usersData : Object.values(usersData);
          userToNotify = usersArray.find((u: any) => u && u.username === resetUsername);
          if (userToNotify) {
            NotificationService.send(userToNotify, "OTP_CODE", { extraInfo: otp });
          }
        }
      });
      return; // Early return since it's async
    }

    if (userToNotify) {
      NotificationService.send(userToNotify, "OTP_CODE", { extraInfo: otp });
    }
  };

  const handleVerifyOtp = () => {
    if (otpCountdown === 0) {
      toast.error("Kode OTP telah kedaluwarsa! Silakan kirim ulang.");
      setSwipeKey(prev => prev + 1);
      return;
    }
    if (userOtpInput !== generatedOtp) {
      toast.error("Kode OTP salah!");
      setSwipeKey(prev => prev + 1);
      return;
    }

    setShowOtpModal(false);
    setUserOtpInput("");
    setGeneratedOtp("");

    if (otpType === "login" && pendingLoginUser) {
      login(pendingLoginUser); // Explicitly set user context
      toast.success("Verifikasi OTP berhasil!");
      recordDeviceSessionLog({
        userId: pendingLoginUser.id,
        userName: pendingLoginUser.name,
        userRole: pendingLoginUser.role,
        action: 'LOGIN',
        details: 'Login berhasil diverifikasi dengan OTP (2FA)',
        status: 'SUCCESS'
      });
      NotificationService.send(pendingLoginUser, "LOGIN_SUCCESS", {
        time: new Date().toLocaleString("id-ID"),
        browser: navigator.userAgent.includes("Chrome") ? "Google Chrome" : "Browser Lain",
      });
      const savedSearch = sessionStorage.getItem("login_redirect_search");
      const savedPathname = sessionStorage.getItem("login_redirect_pathname");
      if (savedSearch && savedPathname) {
        sessionStorage.removeItem("login_redirect_search");
        sessionStorage.removeItem("login_redirect_pathname");
        navigate(`${savedPathname}${savedSearch}`);
      } else {
        navigate("/");
      }
    } else if (otpType === "reset") {
      toast.success("Verifikasi OTP berhasil! Silakan buat sandi baru.");
      setResetStep(2);
      setShowHelpModal(true);
    }
  };

  const handleLogin = async () => {
    const currentUsername = username.trim();
    setError("");
    const toastId = toast.loading("Memeriksa kredensial...");

    try {
      // 1. Tentukan email untuk login Firebase Auth
      let loginEmail = currentUsername.includes('@') ? currentUsername : `${currentUsername.replace(/[^a-zA-Z0-9]/g, '')}@sekolah.sch.id`;
      
      // Override manual untuk akun demo agar presisi
      if (currentUsername === 'admin') loginEmail = 'admin@demo.com';
      if (currentUsername === 'guru') loginEmail = 'guru@demo.com';
      if (currentUsername === 'kepala_sekolah') loginEmail = 'kepsek@demo.com';
      if (currentUsername === 'alpha_project') loginEmail = 'alpha@demo.com';

      const fbPassword = password.length < 6 ? password + '123456' : password;
      let userUid = "";
      let isTentativeUser = false;

      // 2. Autentikasi terlebih dahulu (Wajib agar bisa membaca RTDB)
      try {
        const cred = await signInWithEmailAndPassword(auth, loginEmail, fbPassword);
        userUid = cred.user.uid;
      } catch (authErr: any) {
        if (authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/user-not-found' || authErr.code === 'auth/wrong-password') {
          try {
            // Akun mungkin belum di-sync ke Auth, kita buat tentative account
            const cred = await createUserWithEmailAndPassword(auth, loginEmail, fbPassword);
            userUid = cred.user.uid;
            isTentativeUser = true; // Tandai untuk verifikasi password lokal
          } catch (createErr: any) {
            if (createErr.code === 'auth/email-already-in-use') {
              throw new Error("Sandi salah");
            } else {
              throw createErr;
            }
          }
        } else {
          throw authErr;
        }
      }

      // 3. Ambil mapping tenant dari RTDB
      const mappingSnap = await get(child(ref(dbRealtime), `user_tenant_mapping/${userUid}`));
      let tenantId = 'GLOBAL';
      
      // Khusus untuk alpha_project, jika belum ada di mapping, asumsikan GLOBAL.
      if (mappingSnap.exists()) {
        tenantId = mappingSnap.val();
      } else {
         if (currentUsername !== 'alpha_project' && currentUsername !== 'admin') {
            await signOut(auth);
            throw new Error("Akun tidak tertaut dengan instansi manapun.");
         }
      }

      // 4. Fetch profil dari database
      let userProfileSnap;
      if (tenantId === 'GLOBAL') {
         userProfileSnap = await get(child(ref(dbRealtime), `global_users/${userUid}`));
      } else {
         userProfileSnap = await get(child(ref(dbRealtime), `tenants/${tenantId}/users/${userUid}`));
      }

      let existingLocalUser = userProfileSnap.exists() ? userProfileSnap.val() : null;

      // 5. Pastikan profil pengguna ditemukan di database
      if (!existingLocalUser) {
        // Fallback untuk admin/developer jika belum terdaftar (seeder belum jalan)
        if (currentUsername === 'alpha_project' || currentUsername === 'admin') {
          // FIX: Default fallback Admin ke tenant_demo agar tidak terjebak di GLOBAL
          const fallbackTenantId = (tenantId === 'GLOBAL' && currentUsername === 'admin') ? 'tenant_demo' : tenantId;
          
          existingLocalUser = { 
            id: userUid, 
            username: currentUsername, 
            name: currentUsername === 'alpha_project' ? 'System Developer Dev' : 'Admin Yayasan TU', 
            role: currentUsername === 'alpha_project' ? 'developer' : 'admin',
            tenantId: fallbackTenantId
          };
          
          // Sinkronkan ke variabel luar agar AuthContext tahu ini bukan GLOBAL
          tenantId = fallbackTenantId;
        } else {
          await signOut(auth);
          throw new Error("Profil pengguna tidak ditemukan di database.");
        }
      } else {
        existingLocalUser.tenantId = tenantId; // Pastikan tenantId ter-set
      }

      // 5. Login Berhasil - Set state (Bersih tanpa modifikasi/upgrade password lokal)
      setIsLocked(false);
      setLockoutTimer(0);
      setError("");
      toast.dismiss(toastId);

      let currentUserProfile = existingLocalUser;

      if (currentUserProfile) {
        const isMobileOS = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobileOS && (currentUserProfile.role === 'admin' || currentUserProfile.role === 'developer')) {
          toast.dismiss(toastId);
          // SECURITY FIX: Sign out from Firebase immediately so session doesn't persist
          await signOut(auth);
          toast.error("Akses Ditolak: Login Admin & Developer hanya dapat dilakukan melalui PC/Laptop/Desktop.");
          setSwipeKey(prev => prev + 1);
          return;
        }
      }

      if (currentUserProfile && hasValidWaNumber(currentUserProfile.phone)) {
        // SECURITY FIX: Sign out from Firebase immediately.
        // User is NOT considered authenticated until OTP is verified.
        await signOut(auth);

        // Trigger 2FA OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedOtp(otp);
        setOtpType("login");
        setPendingLoginUser(currentUserProfile);
        setUserOtpInput("");
        setOtpCountdown(180);
        setShowOtpModal(true);

        NotificationService.send(currentUserProfile, "OTP_CODE", {
          extraInfo: otp
        });
      } else {
        // Fallback if no phone/email
        if (currentUserProfile) login(currentUserProfile);
        toast.success('Berhasil masuk ke sistem!');
        if (currentUserProfile) {
          recordDeviceSessionLog({
            userId: currentUserProfile.id,
            userName: currentUserProfile.name,
            userRole: currentUserProfile.role,
            action: 'LOGIN',
            details: 'Login langsung berhasil (tanpa OTP 2FA)',
            status: 'SUCCESS'
          });
          NotificationService.send(currentUserProfile, "LOGIN_SUCCESS", {
            time: new Date().toLocaleString("id-ID"),
            browser: navigator.userAgent.includes("Chrome") ? "Google Chrome" : "Browser Lain",
          });
        }

        const savedSearch = sessionStorage.getItem("login_redirect_search");
        const savedPathname = sessionStorage.getItem("login_redirect_pathname");
        if (savedSearch && savedPathname) {
          sessionStorage.removeItem("login_redirect_search");
          sessionStorage.removeItem("login_redirect_pathname");
          navigate(`${savedPathname}${savedSearch}`);
        } else {
          navigate("/");
        }
      }

    } catch (err: any) {
      toast.dismiss(toastId);
      setSwipeKey(prev => prev + 1);

      // Lockout dinonaktifkan sementara sesuai permintaan untuk kemudahan debugging
      console.error("Login failed:", err.message);
      setError("Nama pengguna atau kata sandi salah.");
      toast.error("Gagal masuk. Periksa kembali nama pengguna dan kata sandi Anda.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden font-sans">
      {/* ── Latar Belakang Kustom ── */}
      {bgCustomData && (
        <div
          className="absolute inset-0 z-0 w-full h-full bg-cover bg-center transition-all duration-700 opacity-90"
          style={{ backgroundImage: `url(${bgCustomData})` }}
        />
      )}

      {/* ── Top Floating Back to Home Button ── */}
      {!isStandalone && (
        <button
          onClick={() => navigate('/landing')}
          className="fixed top-6 left-6 z-50 bg-white/90 hover:bg-white text-slate-800 px-5 py-2.5 rounded-full shadow-xl backdrop-blur-md border border-slate-200/80 text-xs font-black flex items-center gap-2 hover:scale-105 transition-all group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">&larr;</span> Beranda
        </button>
      )}

      {/* ── Main Container (Split Screen) ── */}
      <div className="w-full max-w-5xl md:h-[650px] bg-white md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row relative z-10 m-4">

        {/* ── Left Side (Graphic) ── */}
        <div className="md:w-[55%] relative flex flex-col justify-end p-8 sm:p-12 overflow-hidden min-h-[350px]">
          {/* Background Image */}
          <div
            className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-1000 hover:scale-105"
            style={{ backgroundImage: `url('/login-illustration.jpg')` }}
          />

          {/* Elegant Gradient Overlay */}
          {/* Custom Background Image or Default Gradient */}
          {customLoginBg ? (
            <div
              className="absolute inset-0 z-0 bg-cover bg-center opacity-40"
              style={{ backgroundImage: `url(${customLoginBg})` }}
            />
          ) : (
            <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#7a22e8] via-[#c22cae]/80 to-[#ff4081]/10 opacity-95" />
          )}

          {/* Text Content */}
          <div className="relative z-10 w-full max-w-md mt-auto">
            <DraggableBlock id="login-left-icon">
              <div className="relative w-16 h-16 mb-6 mx-auto sm:mx-0 group cursor-pointer">
                {/* 3D Base Layer */}
                <div className="absolute inset-0 theme-gradient rounded-2xl translate-y-1.5 translate-x-1.5 shadow-[0_10px_20px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:translate-y-2 group-hover:translate-x-2" />

                {/* 3D Glass Face */}
                <div className="absolute inset-0 bg-white/20 backdrop-blur-xl border border-white/60 rounded-2xl flex items-center justify-center shadow-[inset_2px_2px_8px_rgba(255,255,255,0.9),inset_-2px_-2px_8px_rgba(0,0,0,0.2)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:-translate-x-1 overflow-hidden">
                  <div className="absolute -top-2 -left-2 w-8 h-8 bg-white/90 rounded-full blur-[8px]" />
                  <MapPin className="w-8 h-8 text-white relative z-10 filter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]" />
                </div>
              </div>
            </DraggableBlock>
            <DraggableBlock id="login-left-title">
              <h3 className="text-xl sm:text-2xl font-black text-white mb-2 drop-shadow-lg tracking-wide">
                <EditableText originalText="Absen Digital" />
              </h3>
            </DraggableBlock>
            <DraggableBlock id="login-left-subtitle">
              <h2 className="text-lg sm:text-xl font-bold text-white/90 mb-2 drop-shadow-md tracking-tight leading-tight">
                <EditableText originalText="Sistem Presensi Pusat & Cabang" />
              </h2>
            </DraggableBlock>
            <DraggableBlock id="login-left-desc">
              <p className="text-sm sm:text-base text-white/90 leading-relaxed font-medium drop-shadow-md">
                <EditableText originalText="Aplikasi absensi terpadu mendukung Online Web, Semi-Offline (Sinkronisasi Offline), dan Android." />
              </p>
            </DraggableBlock>
          </div>
        </div>

        {/* ── Right Side (Form) ── */}
        <div className="md:w-[45%] bg-white p-8 md:p-12 flex flex-col items-center justify-center relative min-h-[500px]">

          {/* Logo Clickable & Branding */}
          <div 
            className="flex flex-col items-center justify-center mb-8 group hover:scale-105 transition-transform" 
          >
            <DraggableBlock id="login-right-logo-img">
              <img
                src={customLogo || "/logo-abdi.png"}
                alt="Logo"
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-sm mb-3 pointer-events-auto"
              />
            </DraggableBlock>
            <DraggableBlock id="login-right-logo-text">
              <span className="text-2xl sm:text-3xl font-black text-slate-800 leading-none tracking-widest drop-shadow-sm"><EditableText originalText="ABDI" /></span>
            </DraggableBlock>
          </div>

          {error && (
            <div className="w-full max-w-[280px] bg-red-50 text-red-500 text-[11px] font-bold py-2 px-4 mb-4 rounded-lg text-center border border-red-100">
              {error}
            </div>
          )}

          <div className="w-full max-w-[280px]">
            <form onSubmit={handleLogin} className="w-full space-y-5">
              <DraggableBlock id="login-right-input-username" className="relative group w-full">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full h-12 rounded-full border border-gray-200 px-6 text-sm outline-none focus:border-[#8C43F6] focus:ring-1 focus:ring-[#8C43F6] transition-all text-gray-700 bg-gray-50/50 hover:bg-gray-50 focus:bg-white"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 pointer-events-none">
                  <div className="absolute right-0 bottom-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#5C7CFF] to-[#3B5BDB] shadow-sm opacity-40 group-focus-within:opacity-100 transition-opacity" />
                  <div className="absolute left-0 top-0 w-7 h-7 rounded-full bg-white/30 backdrop-blur-md shadow-[0_2px_8px_0_rgba(31,38,135,0.1)] flex items-center justify-center overflow-hidden border border-white/60">
                    <div className="absolute -top-1 -left-1 w-4 h-4 bg-white/90 rounded-full blur-[4px]" />
                    <div className="absolute inset-0 rounded-full shadow-[inset_1px_1px_3px_rgba(255,255,255,0.9),inset_-1px_-1px_3px_rgba(0,0,0,0.05)] pointer-events-none" />
                    <UserIcon className="w-3.5 h-3.5 relative z-10 drop-shadow-sm text-gray-600 group-focus-within:text-white transition-colors" />
                  </div>
                </div>
              </DraggableBlock>

              <DraggableBlock id="login-right-input-password" className="relative group w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full h-12 rounded-full border border-gray-200 px-6 pr-12 text-sm outline-none focus:border-[#8C43F6] focus:ring-1 focus:ring-[#8C43F6] transition-all text-gray-700 bg-gray-50/50 hover:bg-gray-50 focus:bg-white tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 focus:outline-none"
                >
                  <div className="absolute right-0 bottom-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#5C7CFF] to-[#3B5BDB] shadow-sm opacity-40 group-focus-within:opacity-100 hover:opacity-100 transition-opacity" />
                  <div className="absolute left-0 top-0 w-7 h-7 rounded-full bg-white/30 backdrop-blur-md shadow-[0_2px_8px_0_rgba(31,38,135,0.1)] flex items-center justify-center overflow-hidden border border-white/60">
                    <div className="absolute -top-1 -left-1 w-4 h-4 bg-white/90 rounded-full blur-[4px]" />
                    <div className="absolute inset-0 rounded-full shadow-[inset_1px_1px_3px_rgba(255,255,255,0.9),inset_-1px_-1px_3px_rgba(0,0,0,0.05)] pointer-events-none" />
                    {showPassword ? (
                      <EyeOff className="w-3.5 h-3.5 relative z-10 drop-shadow-sm text-gray-600 group-focus-within:text-white transition-colors" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 relative z-10 drop-shadow-sm text-gray-600 group-focus-within:text-white transition-colors" />
                    )}
                  </div>
                </button>
              </DraggableBlock>

              <DraggableBlock id="login-right-swipe-btn" className="pt-2 w-full">
                <SwipeButton
                  key={`login-swipe-${swipeKey}`}
                  onSwipeComplete={() => handleLogin()}
                  text="GESER UNTUK MASUK"
                  isLocked={isLocked}
                  lockoutTimer={lockoutTimer}
                  icon={<LogIn className="w-4 h-4 text-white" />}
                />
                {/* Fallback hidden submit button for form submission via Enter key */}
                <button type="submit" className="hidden">Submit</button>
              </DraggableBlock>
            </form>
          </div>

          {/* ── PERBAIKAN FOOTER RESPONSIVE ── */}
          <div className="mt-8 mb-4 flex flex-col items-center justify-center text-center w-full z-10">
            <div className="flex flex-col items-center space-y-1.5 mb-6 text-[11px] text-slate-500 w-full">
              <DraggableBlock id="login-right-link-forgot">
                <p onClick={() => navigate('/forgot-password')} className="hover:text-blue-600 cursor-pointer transition-colors font-medium leading-relaxed">
                  <EditableText originalText="Lupa kata sandi Anda?" />
                </p>
              </DraggableBlock>
              <DraggableBlock id="login-right-link-help">
                <p onClick={() => { setHelpType("help"); setShowHelpModal(true); }} className="hover:text-blue-600 cursor-pointer transition-colors font-medium leading-relaxed">
                  <EditableText originalText="Dapatkan bantuan untuk masuk." />
                </p>
              </DraggableBlock>
              <DraggableBlock id="login-right-link-register">
                <p onClick={() => navigate('/register')} className="hover:text-purple-600 text-purple-500 font-bold cursor-pointer transition-colors leading-relaxed mt-2">
                  <EditableText originalText="Daftarkan Instansi Baru" />
                </p>
              </DraggableBlock>
            </div>

            {/* ── PANEL AKUN DEMO UJI COBA ── */}
            <div className="mt-6 w-full max-w-[280px]">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Uji Coba Demo</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-1.5">
                {[
                  { label: '🏫 Admin', username: 'admin', password: 'admin123', color: 'from-blue-500/10 to-indigo-500/10 border-blue-200 text-blue-700', badge: 'bg-blue-100 text-blue-700' },
                  { label: '👔 Kepala Sekolah', username: 'kepala_sekolah', password: 'kepsek123', color: 'from-emerald-500/10 to-teal-500/10 border-emerald-200 text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
                  { label: '📚 Guru/Staf', username: 'guru', password: 'guru123', color: 'from-purple-500/10 to-violet-500/10 border-purple-200 text-purple-700', badge: 'bg-purple-100 text-purple-700' },
                ].map((acc) => (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => { setUsername(acc.username); setPassword(acc.password); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border bg-gradient-to-r ${acc.color} hover:scale-[1.02] transition-all text-left cursor-pointer shadow-sm`}
                  >
                    <div>
                      <p className="text-[11px] font-black">{acc.label}</p>
                      <p className="text-[9px] font-mono opacity-70">{acc.username} / {acc.password}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${acc.badge}`}>Klik isi otomatis</span>
                  </button>
                ))}
              </div>

              {/* Tombol Inisialisasi Database (Dev) */}
              <div className="mt-3 flex justify-center">
                <button
                  onClick={() => seedDemoUsers()}
                  className="text-[9px] font-bold text-slate-400 hover:text-purple-600 border border-slate-200 hover:border-purple-300 rounded-full px-3 py-1.5 transition-all flex items-center gap-1.5 cursor-pointer"
                  type="button"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                  Inisialisasi Database Demo (Dev)
                </button>
              </div>
            </div>

            <DraggableBlock id="login-right-copyright" className="text-[10px] text-slate-400 font-bold w-full text-center mt-4">
              &copy; {new Date().getFullYear()} <EditableText originalText="Alpha Project. All rights reserved." />
            </DraggableBlock>

            {/* Tombol Inisialisasi Database (Dev) - TETAP tersembunyi, digantikan oleh panel demo di atas */}
          </div>

        </div>
      </div>

      {/* ── OTP Verification Modal ── */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowOtpModal(false)} />
          <div className="relative bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] w-full max-w-sm p-8 animate-in fade-in zoom-in-95 duration-300">
            <button
              onClick={() => setShowOtpModal(false)}
              className="absolute right-5 top-5 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full p-2 transition-colors focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center mt-4">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-xl animate-pulse" />
                <div className="relative w-full h-full bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center shadow-[0_4px_15px_rgba(0,0,0,0.5)] border border-white/20">
                  <Lock className="w-8 h-8 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-white mb-2 tracking-tight drop-shadow-md">Verifikasi OTP</h3>
              <p className="text-sm text-white/70 mb-4 leading-relaxed px-2 font-medium">
                Kode 6 digit telah dikirim ke WhatsApp / Email Anda. Masukkan kode tersebut di bawah ini.
              </p>

              <div className="mb-6 px-4 py-2.5 rounded-2xl bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono text-base font-black tracking-widest shadow-lg animate-pulse flex items-center justify-center gap-2">
                <span>💡 KODE OTP LOGIN:</span>
                <span className="bg-slate-950/80 text-white px-3 py-1 rounded-lg text-lg select-all">{generatedOtp}</span>
              </div>

              <div className="relative flex justify-between gap-2 sm:gap-3 mb-8 w-full">
                <input
                  type="text"
                  value={userOtpInput}
                  onChange={(e) => setUserOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-text"
                  autoFocus
                />
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <div
                    key={index}
                    className={`w-10 h-12 sm:w-12 sm:h-14 flex items-center justify-center text-xl sm:text-2xl font-black rounded-xl transition-all duration-300 border backdrop-blur-md
                      ${userOtpInput.length === index ? 'border-yellow-400/60 shadow-[0_0_15px_rgba(250,204,21,0.4)] bg-white/20 text-white scale-110 z-0' :
                        userOtpInput.length > index ? 'border-white/40 bg-white/20 text-yellow-400' : 'border-white/10 bg-white/5 text-white/30'}`}
                  >
                    {userOtpInput[index] || ""}
                  </div>
                ))}
              </div>

              <div className={`w-full ${userOtpInput.length !== 6 ? "opacity-50 pointer-events-none grayscale" : "relative"}`}>
                <SwipeButton
                  key={`otp-swipe-${swipeKey}`}
                  onSwipeComplete={handleVerifyOtp}
                  text="GESER VERIFIKASI"
                  icon={<ShieldCheck className="w-4 h-4 text-white" />}
                />
              </div>

              <div className="mt-6 text-center w-full">
                {otpCountdown > 0 ? (
                  <p className="text-white/50 text-sm font-medium">
                    Kode hangus dalam <span className="text-yellow-400 font-bold">{otpCountdown}s</span>
                  </p>
                ) : (
                  <button
                    onClick={handleResendOtp}
                    className="text-yellow-400 text-sm font-bold hover:text-yellow-300 transition-colors"
                  >
                    Kirim Ulang OTP
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Help / Forgot Password Modal ── */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowHelpModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-colors focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center mt-2">
              <div className="w-16 h-16 rounded-full bg-[#f3e8ff] flex items-center justify-center mb-4 text-[#8C43F6]">
                {helpType === "forgot" ? <Lock className="w-8 h-8" /> : <Info className="w-8 h-8" />}
              </div>
              <h3 className="text-xl font-black text-gray-800 mb-2">
                {helpType === "forgot" ? "Reset Kata Sandi" : "Bantuan Masuk"}
              </h3>

              {helpType === "forgot" ? (
                <div className="w-full text-left mt-2">
                  {resetStep === 1 && (
                    <div className="animate-in fade-in duration-300">
                      <p className="text-sm text-gray-500 mb-4 text-center">
                        Masukkan Username, E-mail, WhatsApp terdaftar, atau (ID Pegawai / NIP / NIDN / NIK) untuk memverifikasi akun dan mereset kata sandi.
                      </p>
                      <input
                        type="text"
                        placeholder="Username / E-mail / ID Pegawai / NIP"
                        value={resetUsername}
                        onChange={(e) => setResetUsername(e.target.value)}
                        className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8C43F6] focus:ring-1 focus:ring-[#8C43F6] mb-4 bg-gray-50/50"
                      />
                      <button
                        onClick={() => {
                          if (!resetUsername.trim()) {
                            toast.error("Input tidak boleh kosong!");
                            return;
                          }
                          const toastId = toast.loading("Mencari akun...");
                          get(child(getTenantRef(), "users")).then((snap) => {
                            toast.dismiss(toastId);
                            if (snap.exists()) {
                              const usersData = snap.val();
                              const usersArray = Array.isArray(usersData) ? usersData : Object.values(usersData);
                              const foundUser = usersArray.find((u: any) => u && (
                                u.username === resetUsername ||
                                u.email === resetUsername ||
                                u.phone === resetUsername ||
                                (u.phone && u.phone.replace(/\D/g, '') === resetUsername.replace(/\D/g, '')) ||
                                u.nuptk === resetUsername ||
                                u.nrg === resetUsername ||
                                u.pegId === resetUsername ||
                                u.npk === resetUsername
                              ));
                              if (foundUser) {
                                setResetUsername(foundUser.username); // Normalize to username for saving later
    
                                if (hasValidWaNumber(foundUser.phone)) {
                                  const otp = Math.floor(100000 + Math.random() * 900000).toString();
                                  setGeneratedOtp(otp);
                                  setOtpType("reset");
                                  setPendingLoginUser(foundUser);
                                  setUserOtpInput("");
                                  setOtpCountdown(180);
                                  setShowHelpModal(false);
                                  setShowOtpModal(true);
    
                                  NotificationService.send(foundUser, "OTP_CODE", {
                                    extraInfo: otp
                                  });
                                } else {
                                  // If no phone/email, directly allow reset (fallback for legacy users)
                                  setResetStep(2);
                                }
                              } else {
                                toast.error("Data tidak ditemukan di sistem!");
                              }
                            } else {
                              toast.error("Data tidak ditemukan di sistem!");
                            }
                          }).catch(err => {
                             toast.dismiss(toastId);
                             toast.error("Gagal terhubung ke database.");
                          });
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#b829ff] to-[#7928CA] text-white font-bold rounded-2xl transition-all hover:-translate-y-[1px] hover:shadow-lg active:scale-95"
                      >
                        Verifikasi Akun
                      </button>
                    </div>
                  )}

                  {resetStep === 2 && (
                    <div className="animate-in slide-in-from-right-4 duration-300">
                      <p className="text-sm text-gray-500 mb-4 text-center">
                        Akun <strong>{resetUsername}</strong> ditemukan. Silakan buat kata sandi baru Anda.
                      </p>
                      <input
                        type="password"
                        placeholder="Kata Sandi Baru (Min. 3 karakter)"
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8C43F6] focus:ring-1 focus:ring-[#8C43F6] mb-4 bg-gray-50/50"
                      />
                      <button
                        onClick={async () => {
                          if (resetNewPassword.trim().length < 3) {
                            toast.error("Sandi baru harus minimal 3 karakter!");
                            return;
                          }

                          const toastId = toast.loading("Menyimpan dan menyinkronkan sandi baru...");
                          try {
                            const snap = await get(child(getTenantRef(), "users"));
                            if (snap.exists()) {
                              const usersData = snap.val();
                              const usersArray = Array.isArray(usersData) ? usersData : Object.values(usersData);
                              const userToUpdate = usersArray.find((u: any) => u && u.username === resetUsername);
                              if (userToUpdate) {
                                const newEmail = `${resetUsername.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}@sekolah.sch.id`;
                                const fbPassword = resetNewPassword.length < 6 ? resetNewPassword + '123456' : resetNewPassword;
  
                                let newUid = userToUpdate.id;
                                try {
                                  const cred = await createUserWithEmailAndPassword(auth, newEmail, fbPassword);
                                  newUid = cred.user.uid;
                                } catch (fbErr: any) {
                                  console.warn("Firebase Auth create user during reset bypassed:", fbErr.message);
                                }
                                
                                const updatedUser = {
                                    ...userToUpdate,
                                    id: newUid,
                                    email: newEmail,
                                    password: hashPassword(resetNewPassword)
                                };
                                
                                await set(getTenantRef(`users/${newUid}`), updatedUser);
                                if (newUid !== userToUpdate.id && userToUpdate.id) {
                                    await remove(getTenantRef(`users/${userToUpdate.id}`));
                                }
                              } else {
                                throw new Error("User tidak ditemukan.");
                              }
                            } else {
                                throw new Error("Database kosong.");
                            }

                            toast.dismiss(toastId);
                            setResetStep(3);
                            toast.success("Kata sandi berhasil direset dan disinkronkan!");

                            // Send Notification
                            const notifSnap = await get(child(getTenantRef(), "users"));
                            if (notifSnap.exists()) {
                               const notifData = notifSnap.val();
                               const notifArray = Array.isArray(notifData) ? notifData : Object.values(notifData);
                               const updatedUser = notifArray.find((u: any) => u && u.username === resetUsername);
                               if (updatedUser) {
                                 NotificationService.send(updatedUser, 'PASSWORD_RESET');
                               }
                            }
                          } catch (err: any) {
                            toast.dismiss(toastId);
                            console.error("Error during password reset:", err);
                            toast.error("Gagal mereset kata sandi. Silakan coba lagi.");
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#25D366] to-[#20bd5a] text-white font-bold rounded-2xl transition-all hover:-translate-y-[1px] hover:shadow-lg active:scale-95"
                      >
                        Simpan Sandi Baru
                      </button>
                    </div>
                  )}

                  {resetStep === 3 && (
                    <div className="animate-in zoom-in-95 duration-500 text-center">
                      <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 border-[4px] border-white shadow-md">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <h4 className="font-bold text-gray-800 text-lg mb-2">Sukses!</h4>
                      <p className="text-sm text-gray-600 mb-6 font-medium">Kata sandi berhasil diubah! Silakan login kembali dengan kata sandi yang baru.</p>
                      <button
                        onClick={() => setShowHelpModal(false)}
                        className="w-full py-3 px-4 bg-gray-100 text-gray-800 font-bold rounded-2xl hover:bg-gray-200 transition-colors active:scale-95"
                      >
                        Tutup & Login
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 leading-relaxed mb-6 text-center">
                    Gunakan NIK atau Username yang telah terdaftar. Jika Anda belum memiliki akun atau mengalami kendala, hubungi Admin.
                  </p>

                  <a
                    href="https://wa.me/6280000000000"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-2xl transition-colors shadow-lg shadow-green-200 hover:-translate-y-[1px] active:scale-95"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>
                    Hubungi Admin via WhatsApp
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Demo Akun: Dihapus dari production — jangan tampilkan kredensial di layar */}
    </div>
  );
}
