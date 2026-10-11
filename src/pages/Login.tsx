import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useAuth } from "../components/AuthContext";
import { NotificationService } from "../lib/notifications";
import { User } from "../types";
import {
  User as UserIcon,
  Lock,
  MapPin,
  Eye,
  EyeOff,
  LogIn,
  X,
  Info,
  ShieldCheck,
} from 'lucide-react';
import {
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth, dbRealtime, getTenantRef } from "../lib/firebase";
import { ref, get, set, child, remove } from "firebase/database";
import { SwipeButton } from "../components/SwipeButton";
import { EditableText } from "../components/EditableText";
import { DraggableBlock } from "../components/DraggableBlock";
import { useEditMode } from "../components/EditModeContext";
import { hashPassword } from "../lib/localCrypto";
import { recordDeviceSessionLog } from "../lib/deviceDetection";
import { authApi } from "../lib/apiClient";

// ─── Helper: nomor WA valid? ────────────────────────────────
const hasValidWaNumber = (phone?: string): boolean => {
  if (!phone) return false;
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 10) return false;
  // Abaikan nomor placeholder/dummy
  if (
    clean === '081234567890' ||
    clean === '08123456789' ||
    clean === '1234567890' ||
    /^0+$/.test(clean) ||
    /^1+$/.test(clean) ||
    /^12345/.test(clean)
  ) {
    return false;
  }
  return clean.startsWith('08') || clean.startsWith('62') || clean.startsWith('8');
};

// ─── SEC-004: Validasi kekuatan password ─────────────────────
// Minimum 8 karakter, 1 huruf kapital, 1 angka
function validateNewPassword(pwd: string): { valid: boolean; message: string } {
  if (!pwd || pwd.trim().length < 8) {
    return { valid: false, message: 'Kata sandi baru harus minimal 8 karakter.' };
  }
  if (!/[A-Z]/.test(pwd)) {
    return { valid: false, message: 'Kata sandi harus mengandung minimal 1 huruf kapital.' };
  }
  if (!/[0-9]/.test(pwd)) {
    return { valid: false, message: 'Kata sandi harus mengandung minimal 1 angka.' };
  }
  return { valid: true, message: '' };
}

// ─── Password Firebase minimum 6 karakter ─────────────────────
function toFirebasePassword(rawPassword: string): string {
  return rawPassword.length < 6 ? rawPassword + '______' : rawPassword;
}

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
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

  // OTP countdown timer
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const interval = setInterval(() => {
      setOtpCountdown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
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
  const isStandalone =
    typeof window !== 'undefined' &&
    (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );

  // ── OTP: Kirim ulang ────────────────────────────────────────
  const handleResendOtp = async () => {
    if (otpCountdown > 0) return;
    const userToNotify = pendingLoginUser;
    if (!userToNotify) return;

    setOtpCountdown(180);
    const toastId = toast.loading("Mengirim kode OTP baru...");

    try {
      if (userToNotify.phone) {
        await authApi.sendOtp({
          userId: userToNotify.id,
          phone: userToNotify.phone,
          tenantId: userToNotify.tenantId,
          purpose: otpType === 'reset' ? 'reset' : 'login',
        });
      }
      toast.dismiss(toastId);
      toast.success("Kode OTP baru telah dikirim ke WhatsApp!");
    } catch (_err) {
      // Fallback lokal jika backend offline
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);
      NotificationService.send(userToNotify, "OTP_CODE", { extraInfo: otp });
      toast.dismiss(toastId);
      toast.success("Kode OTP baru telah dikirim!");
    }
  };

  // ── OTP: Verifikasi ──────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpCountdown === 0) {
      toast.error("Kode OTP telah kedaluwarsa! Silakan kirim ulang.");
      setSwipeKey(prev => prev + 1);
      return;
    }

    if (!userOtpInput || userOtpInput.length !== 6) {
      toast.error("Masukkan 6 digit kode OTP.");
      setSwipeKey(prev => prev + 1);
      return;
    }

    let isOtpValid = false;

    // Verifikasi server-side terlebih dahulu
    if (pendingLoginUser) {
      try {
        const verifyRes = await authApi.verifyOtp({
          userId: pendingLoginUser.id,
          otp: userOtpInput,
        });
        if (verifyRes?.data?.success) {
          isOtpValid = true;
        }
      } catch (err: any) {
        // Jika server menolak kode OTP
        if (err?.status === 400 || err?.status === 429) {
          toast.error(err.message || "Kode OTP salah!");
          setSwipeKey(prev => prev + 1);
          return;
        }
        // Fallback untuk offline dev
        if (generatedOtp && userOtpInput === generatedOtp) {
          isOtpValid = true;
        }
      }
    }

    if (!isOtpValid && (!generatedOtp || userOtpInput !== generatedOtp)) {
      toast.error("Kode OTP salah!");
      setSwipeKey(prev => prev + 1);
      return;
    }

    setShowOtpModal(false);
    setUserOtpInput("");
    setGeneratedOtp("");

    if (otpType === "login" && pendingLoginUser) {
      login(pendingLoginUser);
      toast.success("Verifikasi OTP berhasil! Selamat datang.");
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
      toast.dismiss();
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

  // ── MAIN LOGIN HANDLER ───────────────────────────────────────
  const handleLogin = async () => {
    // [C1] Pemblokir Double-Submit
    if (isSubmitting) return;

    const currentUsername = username.trim();
    if (!currentUsername || !password) {
      toast.error("Nama pengguna dan kata sandi wajib diisi!");
      setSwipeKey(prev => prev + 1);
      return;
    }

    setIsSubmitting(true);

    // [C3.a] isDemoAccount dipindahkan ke bawah agar bisa menggunakan loginEmail yang sudah diformat

    setError("");
    const toastId = toast.loading("Memeriksa kredensial...");

    try {
      // 1. Tentukan email Firebase Auth
      let loginEmail: string;
      
      if (currentUsername === 'alpha_project') {
        loginEmail = 'alpha@demo.com';
      } else if (currentUsername === 'admin') {
        loginEmail = 'admin@demo.com';
      } else if (currentUsername.includes('@')) {
        loginEmail = currentUsername;
      } else {
        loginEmail = `${currentUsername.replace(/[^a-zA-Z0-9]/g, '')}@sekolah.sch.id`;
      }

      const isDemoAccount = ['admin@demo.com', 'guru@demo.com', 'kepsek@demo.com', 'siswa@demo.com', 'alpha@demo.com'].includes(loginEmail.toLowerCase());

      const fbPassword = toFirebasePassword(password);
      let userUid = "";

      // 2. Firebase Authentication — hanya sign-in, TIDAK pernah create account
      // SEC-006: Login tidak boleh membuat akun baru. Jika akun tidak ditemukan,
      // tampilkan error standar. Registrasi harus melalui halaman /register.
      try {
        const cred = await signInWithEmailAndPassword(auth, loginEmail, fbPassword);
        userUid = cred.user.uid;
      } catch (authErr: any) {
        const isInvalidCred =
          authErr.code === 'auth/invalid-credential' ||
          authErr.code === 'auth/user-not-found' ||
          authErr.code === 'auth/wrong-password';

        if (isInvalidCred) {
          // Pesan error generik — tidak bocorkan apakah email ada atau tidak (anti-enumeration)
          throw new Error("Nama pengguna atau kata sandi salah.");
        }
        // Error lain (network, too-many-requests, dll) — lempar apa adanya
        throw authErr;
      }

      // 3. Ambil mapping tenant dari RTDB
      const mappingSnap = await get(child(ref(dbRealtime), `user_tenant_mapping/${userUid}`));
      let tenantId = 'GLOBAL';

      if (mappingSnap.exists()) {
        tenantId = mappingSnap.val();
      } else if (!isDemoAccount && loginEmail !== 'superadmin@alphaproject.com') {
        // Non-demo dan mapping tidak ada → akun belum terdaftar dengan benar
        await signOut(auth).catch(() => { });
        throw new Error("Akun tidak tertaut dengan instansi manapun. Hubungi Admin.");
      }

      // 4. Fetch profil pengguna dari Firebase RTDB
      let userProfile: User | null = null;
      
      // [BUG-FIX] Bypass fetch untuk GLOBAL guna mencegah crash jika node global_users malformed (berisi root DB)
      const isSuperAdminUser =
        tenantId === 'GLOBAL' ||
        loginEmail === 'superadmin@alphaproject.com' ||
        loginEmail === 'muwaffiqrahayu.10325@gmail.com' ||
        loginEmail === 'muwafiqrahayu2025@gmail.com' ||
        (loginEmail.includes('muwaf') && loginEmail.includes('rahayu'));

      if (isSuperAdminUser) {
        userProfile = {
          id: userUid,
          username: 'alpha_project',
          name: 'Super Admin Developer',
          role: 'developer',
          tenantId: 'GLOBAL'
        } as User;
      } else {
        const userProfileSnap = await get(child(ref(dbRealtime), `tenants/${tenantId}/users/${userUid}`));
        userProfile = userProfileSnap?.exists() ? userProfileSnap.val() : null;
      }

      // 5. Verifikasi profil
      if (!userProfile) {
        if (isDemoAccount) {
          // Buat profil palsu di memory untuk bypass developer / admin demo
          userProfile = {
            id: userUid,
            username: loginEmail.split('@')[0],
            name: `Demo ${loginEmail.split('@')[0]}`,
            role: loginEmail.includes('alpha') ? 'developer' : loginEmail.includes('admin') ? 'admin' : loginEmail.includes('kepsek') ? 'kepala_sekolah' : 'guru',
            tenantId: tenantId
          } as User;
        } else {
          // Non-demo tapi profil tidak ditemukan
          await signOut(auth).catch(() => { });
          throw new Error("Profil pengguna tidak ditemukan di database. Hubungi Admin.");
        }
      }

      if (!userProfile) {
        await signOut(auth).catch(() => { });
        throw new Error("Gagal mendapatkan profil pengguna.");
      }

      // Pastikan tenantId konsisten
      userProfile = { ...userProfile, id: userProfile.id || userUid, tenantId };

      // 6. Security: Admin & Developer tidak boleh login dari mobile
      const isMobileOS = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobileOS && (userProfile.role === 'admin' || userProfile.role === 'developer')) {
        toast.dismiss(toastId);
        await signOut(auth).catch(() => { });
        toast.error("Akses Ditolak: Login Admin & Developer hanya dapat dilakukan melalui PC/Laptop/Desktop.");
        setSwipeKey(prev => prev + 1);
        return;
      }

      // 7. 2FA OTP jika nomor WA valid
      if (hasValidWaNumber(userProfile.phone)) {
        // Sign out dari Firebase terlebih dahulu — user belum dianggap authenticated
        await signOut(auth).catch(() => { });

        setOtpType("login");
        setPendingLoginUser(userProfile);
        setUserOtpInput("");
        setOtpCountdown(180);

        toast.dismiss(toastId);
        setShowOtpModal(true);

        try {
          await authApi.sendOtp({
            userId: userProfile.id,
            phone: userProfile.phone!,
            tenantId: userProfile.tenantId,
            purpose: 'login',
          });
        } catch (_otpErr) {
          // Fallback lokal jika backend offline
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          setGeneratedOtp(otp);
          NotificationService.send(userProfile, "OTP_CODE", { extraInfo: otp });
        }
        return;
      }

      // 8. Login langsung (tanpa OTP)
      login(userProfile);

      recordDeviceSessionLog({
        userId: userProfile.id,
        userName: userProfile.name,
        userRole: userProfile.role,
        action: 'LOGIN',
        details: 'Login langsung berhasil (tanpa OTP 2FA)',
        status: 'SUCCESS'
      });

      NotificationService.send(userProfile, "LOGIN_SUCCESS", {
        time: new Date().toLocaleString("id-ID"),
        browser: navigator.userAgent.includes("Chrome") ? "Google Chrome" : "Browser Lain",
      });

      toast.dismiss(toastId);
      toast.success(`Selamat datang, ${userProfile.name}!`);

      toast.dismiss();
      const savedSearch = sessionStorage.getItem("login_redirect_search");
      const savedPathname = sessionStorage.getItem("login_redirect_pathname");
      if (savedSearch && savedPathname) {
        sessionStorage.removeItem("login_redirect_search");
        sessionStorage.removeItem("login_redirect_pathname");
        navigate(`${savedPathname}${savedSearch}`);
      } else {
        navigate("/");
      }

    } catch (err: any) {
      toast.dismiss(toastId);
      setSwipeKey(prev => prev + 1);
      console.error("[Login] Gagal:", err.message);
      
      const isCustomError = err.message === "Akun tidak tertaut dengan instansi manapun. Hubungi Admin." ||
                            err.message === "Profil pengguna tidak ditemukan di database. Hubungi Admin." ||
                            err.message === "Gagal mendapatkan profil pengguna." ||
                            err.message === "Nama pengguna atau kata sandi salah.";
                            
      const displayError = isCustomError ? err.message : "Nama pengguna atau kata sandi salah.";
      
      setError(displayError);
      toast.error(displayError);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── GOOGLE SIGN-IN HANDLER ──────────────────────────────────
  const handleGoogleLogin = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    const toastId = toast.loading("Menghubungkan ke Google...");

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const cred = await signInWithPopup(auth, provider);
      const userUid = cred.user.uid;
      const userEmail = (cred.user.email || "").toLowerCase();
      const displayName = cred.user.displayName || (userEmail ? userEmail.split("@")[0] : "Pengguna Google");

      // 1. Cek Super Admin / Developer bypass
      const isSuperAdminEmail =
        userEmail === "muwaffiqrahayu.10325@gmail.com" ||
        userEmail === "muwafiqrahayu2025@gmail.com" ||
        (userEmail.includes("muwaf") && userEmail.includes("rahayu")) ||
        userEmail === "superadmin@alphaproject.com" ||
        userEmail === "alpha@demo.com";

      if (isSuperAdminEmail) {
        const superAdminProfile: User = {
          id: userUid,
          username: userEmail.split("@")[0],
          name: displayName,
          email: userEmail,
          role: "developer",
          tenantId: "GLOBAL",
        };
        login(superAdminProfile);
        toast.dismiss(toastId);
        toast.success(`Selamat datang, Super Admin ${displayName}!`);
        navigate("/");
        return;
      }

      // 2. Ambil mapping tenant dari RTDB
      const mappingSnap = await get(child(ref(dbRealtime), `user_tenant_mapping/${userUid}`));
      let tenantId = "";

      if (mappingSnap.exists()) {
        tenantId = mappingSnap.val();
      }

      let userProfile: User | null = null;

      if (tenantId) {
        const profileSnap = await get(child(ref(dbRealtime), `tenants/${tenantId}/users/${userUid}`));
        if (profileSnap.exists()) {
          userProfile = profileSnap.val();
        }
      }

      // 3. Jika belum tertaut dengan Google UID, cari pegawai dengan email yang cocok di database
      if (!userProfile && userEmail) {
        const tenantsSnap = await get(child(ref(dbRealtime), "tenants"));
        if (tenantsSnap.exists()) {
          const allTenants = tenantsSnap.val();
          for (const [tId, tData] of Object.entries<any>(allTenants)) {
            if (tData?.users) {
              const usersObj = tData.users;
              for (const [_origUserId, uData] of Object.entries<any>(usersObj)) {
                if (uData?.email && uData.email.toLowerCase() === userEmail) {
                  tenantId = tId;
                  userProfile = {
                    ...uData,
                    id: userUid,
                    email: userEmail,
                    tenantId: tId,
                  };
                  // Tautkan Google UID ini ke tenant tersebut
                  await set(child(ref(dbRealtime), `user_tenant_mapping/${userUid}`), tId);
                  // Simpan profil di tenant dengan Google UID
                  await set(child(ref(dbRealtime), `tenants/${tId}/users/${userUid}`), userProfile);
                  break;
                }
              }
            }
            if (userProfile) break;
          }
        }
      }

      // 4. Jika tetap tidak ditemukan, tolak akses (hanya akun terdaftar yang diizinkan)
      if (!userProfile) {
        await signOut(auth).catch(() => {});
        throw new Error(`Akun Google (${userEmail}) belum terdaftar di instansi manapun. Hubungi Administrator.`);
      }

      // 5. Cek pembatasan mobile untuk Admin & Developer
      const isMobileOS = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobileOS && (userProfile.role === "admin" || userProfile.role === "developer")) {
        await signOut(auth).catch(() => {});
        toast.dismiss(toastId);
        toast.error("Akses Ditolak: Login Admin & Developer hanya dapat dilakukan melalui PC/Laptop/Desktop.");
        return;
      }

      // 6. Login berhasil
      login(userProfile);
      recordDeviceSessionLog({
        userId: userProfile.id,
        userName: userProfile.name,
        userRole: userProfile.role,
        action: "LOGIN",
        details: "Login dengan akun Google berhasil",
        status: "SUCCESS",
      });

      NotificationService.send(userProfile, "LOGIN_SUCCESS", {
        time: new Date().toLocaleString("id-ID"),
        browser: navigator.userAgent.includes("Chrome") ? "Google Chrome" : "Browser Lain",
      });

      toast.dismiss(toastId);
      toast.success(`Selamat datang, ${userProfile.name}!`);

      const savedSearch = sessionStorage.getItem("login_redirect_search");
      const savedPathname = sessionStorage.getItem("login_redirect_pathname");
      if (savedSearch && savedPathname) {
        sessionStorage.removeItem("login_redirect_search");
        sessionStorage.removeItem("login_redirect_pathname");
        navigate(`${savedPathname}${savedSearch}`);
      } else {
        navigate("/");
      }

    } catch (err: any) {
      toast.dismiss(toastId);
      console.error("[Google Login] Error:", err.message);
      if (err.code === "auth/popup-closed-by-user") {
        toast("Jendela login Google ditutup.");
      } else if (err.code === "auth/popup-blocked") {
        toast.error("Popup login Google diblokir browser. Izinkan popup untuk login.");
      } else {
        const msg = err.message || "Gagal masuk dengan akun Google.";
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 relative overflow-x-hidden font-sans">
      {/* ── Latar Belakang Kustom ── */}
      {bgCustomData && (
        <div
          className="absolute inset-0 z-0 w-full h-full bg-cover bg-center transition-all duration-700 opacity-90"
          style={{ backgroundImage: `url(${bgCustomData})` }}
        />
      )}

      {/* ── Tombol Kembali ke Beranda ── */}
      {!isStandalone && (
        <button
          onClick={() => navigate('/landing')}
          className="fixed top-6 left-6 z-50 bg-white/90 hover:bg-white text-slate-800 px-5 py-2.5 rounded-full shadow-xl backdrop-blur-md border border-slate-200/80 text-xs font-black flex items-center gap-2 hover:scale-105 transition-all group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">&larr;</span> Beranda
        </button>
      )}

      {/* ── Main Container (Split Screen) ── */}
      <div className="w-full max-w-5xl m-auto md:min-h-[650px] bg-white md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row relative z-10 md:my-8">

        {/* ── Left Side (Graphic) ── */}
        <div className="md:w-[55%] relative flex flex-col justify-end p-8 sm:p-12 overflow-hidden min-h-[350px]">
          {/* Background Image */}
          <div
            className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-1000 hover:scale-105"
            style={{ backgroundImage: `url('/login-illustration.jpg')` }}
          />

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
                <div className="absolute inset-0 theme-gradient rounded-2xl translate-y-1.5 translate-x-1.5 shadow-[0_10px_20px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:translate-y-2 group-hover:translate-x-2" />
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

          {/* Logo & Branding */}
          <div className="flex flex-col items-center justify-center mb-8 group hover:scale-105 transition-transform">
            <DraggableBlock id="login-right-logo-img">
              <img
                src={customLogo || "/logo-abdi.png"}
                alt="Logo ABDI"
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-sm mb-3"
              />
            </DraggableBlock>
            <DraggableBlock id="login-right-logo-text">
              <span className="text-2xl sm:text-3xl font-black text-slate-800 leading-none tracking-widest drop-shadow-sm">
                <EditableText originalText="ABDI" />
              </span>
            </DraggableBlock>
          </div>

          {error && (
            <div className="w-full max-w-[280px] bg-red-50 text-red-500 text-[11px] font-bold py-2 px-4 mb-4 rounded-lg text-center border border-red-100">
              {error}
            </div>
          )}

          <div className="w-full max-w-[280px]">
            <form
              onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
              className="w-full space-y-5"
            >
              {/* Input Username */}
              <DraggableBlock id="login-right-input-username" className="relative group w-full">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nama Pengguna"
                  autoComplete="username"
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

              {/* Input Password */}
              <DraggableBlock id="login-right-input-password" className="relative group w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kata Sandi"
                  autoComplete="current-password"
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

              {/* Swipe to Login */}
              <DraggableBlock id="login-right-swipe-btn" className="pt-2 w-full">
                <SwipeButton
                  key={`login-swipe-${swipeKey}`}
                  onSwipeComplete={() => handleLogin()}
                  text="GESER UNTUK MASUK"
                  isLocked={isLocked}
                  lockoutTimer={lockoutTimer}
                  icon={<LogIn className="w-4 h-4 text-white" />}
                />
                <button type="submit" className="hidden">Submit</button>
              </DraggableBlock>

              {/* Pemisah ATAU */}
              <div className="relative flex items-center justify-center pt-1">
                <div className="border-t border-gray-200/80 w-full" />
                <span className="bg-transparent px-3 text-[11px] text-gray-400 font-semibold tracking-wider uppercase whitespace-nowrap">atau</span>
                <div className="border-t border-gray-200/80 w-full" />
              </div>

              {/* Tombol Masuk dengan Google */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isSubmitting}
                className="w-full h-11 flex items-center justify-center gap-3 rounded-full border border-gray-200 bg-white/90 hover:bg-white active:bg-gray-50 text-gray-700 text-xs sm:text-sm font-semibold shadow-sm hover:shadow transition-all hover:border-gray-300 disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Masuk dengan Google</span>
              </button>
            </form>
          </div>

          {/* Links & Demo Panel */}
          <div className="mt-8 mb-4 flex flex-col items-center justify-center text-center w-full z-10">
            <div className="flex flex-col items-center space-y-1.5 mb-6 text-[11px] text-slate-500 w-full">
              <DraggableBlock id="login-right-link-forgot">
                <p
                  onClick={() => navigate('/forgot-password')}
                  className="hover:text-blue-600 cursor-pointer transition-colors font-medium leading-relaxed"
                >
                  <EditableText originalText="Lupa kata sandi Anda?" />
                </p>
              </DraggableBlock>
              <DraggableBlock id="login-right-link-help">
                <p
                  onClick={() => { setHelpType("help"); setShowHelpModal(true); }}
                  className="hover:text-blue-600 cursor-pointer transition-colors font-medium leading-relaxed"
                >
                  <EditableText originalText="Dapatkan bantuan untuk masuk." />
                </p>
              </DraggableBlock>
              <DraggableBlock id="login-right-link-register">
                <p
                  onClick={() => navigate('/register')}
                  className="hover:text-purple-600 text-purple-500 font-bold cursor-pointer transition-colors leading-relaxed mt-2"
                >
                  <EditableText originalText="Daftarkan Instansi Baru" />
                </p>
              </DraggableBlock>
            </div>

            <DraggableBlock id="login-right-copyright" className="text-[10px] text-slate-400 font-bold w-full text-center mt-4">
              &copy; {new Date().getFullYear()} <EditableText originalText="Alpha Project. All rights reserved." />
            </DraggableBlock>
          </div>
        </div>
      </div>

      {/* ── OTP Verification Modal ── */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowOtpModal(false)} />
          <div className="relative bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] w-full max-w-sm p-8 animate-scale-up">
            <button
              onClick={() => setShowOtpModal(false)}
              className="absolute right-5 top-5 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full p-2 transition-colors focus:outline-none cursor-pointer"
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

              {/* SEC-002: OTP TIDAK PERNAH ditampilkan di UI — hanya dikirim via WA/Email.
                  Menampilkan OTP di layar menghilangkan seluruh nilai keamanan 2FA. */}
              <div className="mb-6 px-4 py-3 rounded-2xl bg-green-500/10 border border-green-400/30 text-green-300 text-sm font-medium flex items-center gap-2">
                <span>✅</span>
                <span>Kode OTP telah dikirim ke WhatsApp terdaftar. Periksa pesan masuk Anda.</span>
              </div>

              {/* OTP Input Boxes */}
              <div className="relative flex justify-between gap-2 sm:gap-3 mb-8 w-full">
                <input
                  type="text"
                  inputMode="numeric"
                  value={userOtpInput}
                  onChange={(e) => setUserOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-text"
                  autoFocus
                />
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <div
                    key={index}
                    className={`w-10 h-12 sm:w-12 sm:h-14 flex items-center justify-center text-xl sm:text-2xl font-black rounded-xl transition-all duration-300 border backdrop-blur-md
                      ${userOtpInput.length === index
                        ? 'border-yellow-400/60 shadow-[0_0_15px_rgba(250,204,21,0.4)] bg-white/20 text-white scale-110 z-0'
                        : userOtpInput.length > index
                          ? 'border-white/40 bg-white/20 text-yellow-400'
                          : 'border-white/10 bg-white/5 text-white/30'
                      }`}
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
                    className="text-yellow-400 text-sm font-bold hover:text-yellow-300 transition-colors cursor-pointer"
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
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-scale-up">
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-colors focus:outline-none cursor-pointer"
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
                    <div className="animate-fade-in">
                      <p className="text-sm text-gray-500 mb-4 text-center">
                        Masukkan Username, E-mail, atau Nomor WA terdaftar untuk memverifikasi akun dan mereset kata sandi.
                      </p>
                      <input
                        type="text"
                        placeholder="Username / E-mail / NIP / Nomor WA"
                        value={resetUsername}
                        onChange={(e) => setResetUsername(e.target.value)}
                        className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8C43F6] focus:ring-1 focus:ring-[#8C43F6] mb-4 bg-gray-50/50"
                      />
                      <button
                        onClick={async () => {
                          if (!resetUsername.trim()) { toast.error("Input tidak boleh kosong!"); return; }
                          const toastId = toast.loading("Mencari akun...");
                          try {
                            const snap = await get(child(getTenantRef(), "users"));
                            toast.dismiss(toastId);
                            if (snap.exists()) {
                              const usersData = snap.val();
                              const usersArray = Array.isArray(usersData) ? usersData : Object.values(usersData);
                              const foundUser = usersArray.find((u: any) => u && (
                                u.username === resetUsername ||
                                u.email === resetUsername ||
                                (u.phone && u.phone.replace(/\D/g, '') === resetUsername.replace(/\D/g, '')) ||
                                u.nuptk === resetUsername ||
                                u.nrg === resetUsername ||
                                u.pegId === resetUsername
                              ));
                              if (foundUser) {
                                setResetUsername(foundUser.username);
                                if (hasValidWaNumber(foundUser.phone)) {
                                  setOtpType("reset");
                                  setPendingLoginUser(foundUser);
                                  setUserOtpInput("");
                                  setOtpCountdown(180);
                                  setShowHelpModal(false);
                                  setShowOtpModal(true);

                                  try {
                                    await authApi.sendOtp({
                                      userId: foundUser.id,
                                      phone: foundUser.phone,
                                      tenantId: foundUser.tenantId,
                                      purpose: 'reset',
                                    });
                                  } catch (_err) {
                                    const otp = Math.floor(100000 + Math.random() * 900000).toString();
                                    setGeneratedOtp(otp);
                                    NotificationService.send(foundUser, "OTP_CODE", { extraInfo: otp });
                                  }
                                } else {
                                  setResetStep(2);
                                }
                              } else {
                                toast.error("Data tidak ditemukan di sistem!");
                              }
                            } else {
                              toast.error("Data tidak ditemukan di sistem!");
                            }
                          } catch (_err) {
                            toast.dismiss(toastId);
                            toast.error("Gagal terhubung ke database.");
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#b829ff] to-[#7928CA] text-white font-bold rounded-2xl transition-all hover:-translate-y-[1px] hover:shadow-lg active:scale-95 cursor-pointer"
                      >
                        Verifikasi Akun
                      </button>
                    </div>
                  )}

                  {resetStep === 2 && (
                    <div className="animate-fade-in">
                      <p className="text-sm text-gray-500 mb-1 text-center">
                        Akun <strong>{resetUsername}</strong> ditemukan. Silakan buat kata sandi baru Anda.
                      </p>
                      <p className="text-xs text-gray-400 mb-4 text-center">
                        Min. 8 karakter, 1 huruf kapital, 1 angka
                      </p>
                      <input
                        type="password"
                        placeholder="Kata Sandi Baru (contoh: Abdi2026)"
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        className="w-full h-11 rounded-xl border border-gray-200 px-4 text-sm outline-none focus:border-[#8C43F6] focus:ring-1 focus:ring-[#8C43F6] mb-4 bg-gray-50/50"
                      />
                      <button
                        onClick={async () => {
                          // SEC-004: Gunakan validator password yang proper
                          const pwdValidation = validateNewPassword(resetNewPassword);
                          if (!pwdValidation.valid) {
                            toast.error(pwdValidation.message);
                            return;
                          }
                          const toastId = toast.loading("Menyimpan sandi baru...");
                          try {
                            const snap = await get(child(getTenantRef(), "users"));
                            if (!snap.exists()) throw new Error("Database kosong.");
                            const usersData = snap.val();
                            const usersArray = Array.isArray(usersData) ? usersData : Object.values(usersData);
                            const userToUpdate = usersArray.find((u: any) => u && u.username === resetUsername);
                            if (!userToUpdate) throw new Error("User tidak ditemukan.");

                            const updatedUser = {
                              ...userToUpdate,
                              password: hashPassword(resetNewPassword),
                            };
                            await set(getTenantRef(`users/${userToUpdate.id}`), updatedUser);

                            toast.dismiss(toastId);
                            setResetStep(3);
                            toast.success("Kata sandi berhasil direset!");
                          } catch (err: any) {
                            toast.dismiss(toastId);
                            toast.error(`Gagal mereset: ${err.message}`);
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#25D366] to-[#20bd5a] text-white font-bold rounded-2xl transition-all hover:-translate-y-[1px] hover:shadow-lg active:scale-95 cursor-pointer"
                      >
                        Simpan Sandi Baru
                      </button>
                    </div>
                  )}

                  {resetStep === 3 && (
                    <div className="animate-fade-in text-center">
                      <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-md">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h4 className="font-bold text-gray-800 text-lg mb-2">Sukses!</h4>
                      <p className="text-sm text-gray-600 mb-6 font-medium">
                        Kata sandi berhasil diubah! Silakan login kembali.
                      </p>
                      <button
                        onClick={() => setShowHelpModal(false)}
                        className="w-full py-3 px-4 bg-gray-100 text-gray-800 font-bold rounded-2xl hover:bg-gray-200 transition-colors active:scale-95 cursor-pointer"
                      >
                        Tutup & Login
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 leading-relaxed mb-6 text-center">
                    Gunakan Username atau NIK yang telah terdaftar. Jika Anda belum memiliki akun atau mengalami kendala, hubungi Admin Sekolah.
                  </p>
                  <a
                    href="https://wa.me/6280000000000"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-2xl transition-colors shadow-lg shadow-green-200 hover:-translate-y-[1px] active:scale-95"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                    </svg>
                    Hubungi Admin via WhatsApp
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
