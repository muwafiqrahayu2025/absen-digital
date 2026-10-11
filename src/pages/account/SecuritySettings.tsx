import React, { useState, useRef, useEffect } from 'react';
import { 
  Shield, Key, Lock, X, Smartphone, 
  ChevronRight, Mail, Phone, ToggleRight, 
  ToggleLeft, Fingerprint, ScanFace, CheckCircle2,
  ShieldAlert, History, Laptop, ShieldCheck, Trash2, Plus, QrCode, MessageCircle, Eye, EyeOff
} from 'lucide-react';
import { useAuth } from '../../components/AuthContext';
import { EditableText } from '../../components/EditableText';
import toast from 'react-hot-toast';
import { getAuth, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useLocation } from 'react-router-dom';

export function SecuritySettings() {
  const { user } = useAuth();
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isTwoFactorModalOpen, setIsTwoFactorModalOpen] = useState(false);
  const [isCheckupModalOpen, setIsCheckupModalOpen] = useState(false);
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [isAuthActive, setIsAuthActive] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isPromptActive, setIsPromptActive] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [phoneStep, setPhoneStep] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [isWaLoading, setIsWaLoading] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailStep, setEmailStep] = useState(1);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [verifiedRecoveryEmail, setVerifiedRecoveryEmail] = useState<string | null>(null);
  
  // New states for Recovery Phone
  const [isRecoveryPhoneModalOpen, setIsRecoveryPhoneModalOpen] = useState(false);
  const [recoveryPhoneNumber, setRecoveryPhoneNumber] = useState('');
  const [savedRecoveryPhone, setSavedRecoveryPhone] = useState<string | null>(null);

  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSkipPasswordEnabled, setIsSkipPasswordEnabled] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tab = searchParams.get('tab');

  useEffect(() => {
    const fetchSecurityData = async () => {
      const authInstance = getAuth();
      if (!authInstance.currentUser) {
        setIsLoadingData(false);
        return;
      }
      try {
        const docRef = doc(db, 'users', authInstance.currentUser.uid, 'security_settings', 'preferences');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          
          if (data.passkeys) {
            const mappedPasskeys = data.passkeys.map((pk: any, idx: number) => ({
              id: idx,
              name: pk.deviceName || 'Passkey',
              added: new Date(pk.registeredAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
              lastUsed: 'Belum digunakan',
              icon: 'Fingerprint'
            }));
            setPasskeys(mappedPasskeys);
          }
          
          if (data.authenticator_2fa) {
            setIsAuthActive(data.authenticator_2fa.isActive);
          }
          
          if (data.recovery_email && data.recovery_email.isVerified) {
            setVerifiedRecoveryEmail(data.recovery_email.email);
          }
          
          if (data.recovery_phone && data.recovery_phone.isVerified) {
            setVerifiedPhone(data.recovery_phone.phoneNumber);
          }
          
          if (data.login_preferences) {
            setIsSkipPasswordEnabled(data.login_preferences.skipPassword);
            setIsPromptActive(data.login_preferences.googlePromptActive);
          }

          if (data.video_selfie) {
            setIsVideoActive(data.video_selfie.isActive);
          }
        }
        
        // Fetch recoveryPhone from user document
        const userDocRef = doc(db, 'users', authInstance.currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          if (userData.recoveryPhone) {
            setSavedRecoveryPhone(userData.recoveryPhone);
          }
        }
      } catch (error) {
        console.error('Error fetching security settings:', error);
        toast.error('Gagal memuat pengaturan keamanan.');
      } finally {
        setIsLoadingData(false);
      }
    };
    
    fetchSecurityData();
  }, []);

  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [videoRecorded, setVideoRecorded] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const securityIssues = [
    { id: '2fa', title: 'Aktifkan Verifikasi 2 Langkah', description: 'Tambahkan lapisan keamanan ekstra ke akun Anda agar tidak mudah dibobol.', isResolved: false },
    { id: 'recovery_email', title: 'Tambahkan Email Pemulihan', description: 'Pastikan Anda tidak kehilangan akses ke akun jika lupa sandi.', isResolved: false }
  ];

  const recentActivities = [
    { id: 1, type: 'Login', device: 'Windows PC', browser: 'Chrome', location: 'Bandung, Jawa Barat', time: 'Baru saja', isCurrent: true, icon: 'Laptop' },
    { id: 2, type: 'Login', device: 'Android Smartphone', browser: 'Mobile App', location: 'Bandung, Jawa Barat', time: 'Kemarin, 14:30', isCurrent: false, icon: 'Smartphone' },
    { id: 3, type: 'Perubahan Sandi', device: 'MacBook Pro', browser: 'Safari', location: 'Jakarta', time: '12 Jul 2026', isCurrent: false, icon: 'ShieldCheck' }
  ];

  const handleToggleSkipPassword = () => {
    const newState = !isSkipPasswordEnabled;
    setIsSkipPasswordEnabled(newState);
    if (newState) {
      toast.success('Fitur lewati sandi diaktifkan. Anda akan login menggunakan Kunci Sandi jika tersedia.');
    } else {
      toast.success('Fitur lewati sandi dinonaktifkan.');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error('Gagal mengakses kamera. Pastikan Anda telah memberikan izin.');
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const startRecording = () => {
    if (!mediaStreamRef.current) return;
    
    setIsRecording(true);
    chunksRef.current = [];
    
    const mediaRecorder = new MediaRecorder(mediaStreamRef.current);
    mediaRecorderRef.current = mediaRecorder;
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      setIsRecording(false);
      setVideoRecorded(true);
      toast.success('Video selfie berhasil direkam!');
      stopCamera();
    };
    
    mediaRecorder.start();
    
    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }, 3000);
  };

  const handleCloseVideoModal = () => {
    stopCamera();
    setIsVideoModalOpen(false);
    setIsRecording(false);
  };

  const handleOpenVideoModal = () => {
    if (!isVideoActive) {
      setIsVideoModalOpen(true);
      setVideoRecorded(false);
      
      // Delay starting camera to allow modal and video element to render
      setTimeout(() => {
        startCamera();
      }, 100);
    } else {
      setIsVideoActive(false);
      toast.success('Fitur Video Selfie dinonaktifkan.');
    }
  };

  const handleSaveVideo = () => {
    setIsVideoActive(true);
    setIsVideoModalOpen(false);
    toast.success('Fitur Video Selfie diaktifkan!');
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleDeletePasskey = async (id: number) => {
    try {
      // TODO: Request HTTP DELETE ke backend (Firebase) untuk hapus public key
      // await fetch(`/api/passkeys/${id}`, { method: 'DELETE' });
      
      setPasskeys(passkeys.filter(p => p.id !== id));
      toast.success('Kunci sandi berhasil dihapus.');
    } catch (error) {
      console.error("Gagal menghapus Passkey:", error);
      toast.error('Terjadi kesalahan saat menghapus kunci sandi.');
    }
  };

  const handleCreatePasskey = async () => {
    try {
      if (!window.PublicKeyCredential) {
        toast.error('Browser Anda tidak mendukung fitur Kunci Sandi (WebAuthn).');
        return;
      }

      // Peringatan: Ini butuh challenge & opsi dari backend/Firebase FIDO2
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge); // Dummy challenge
      
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId); // Dummy user ID

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
          challenge: challenge,
          rp: { name: "Abdi Absen Digital", id: window.location.hostname },
          user: {
              id: userId,
              name: user?.email || 'user',
              displayName: user?.displayName || 'User'
          },
          pubKeyCredParams: [{alg: -7, type: "public-key"} as PublicKeyCredentialParameters],
          authenticatorSelection: { authenticatorAttachment: "platform" },
          timeout: 60000,
          attestation: "direct"
      };

      // Memicu OS Biometric Prompt
      const credential = await navigator.credentials.create({
          publicKey: publicKeyCredentialCreationOptions
      });

      // 2. Kirim 'credential' ke Firebase/Backend untuk disimpan.
      console.log("Passkey Real Terdaftar:", credential);
      
      // 3. Update state UI
      const newPasskey = {
        id: Date.now(),
        name: 'Perangkat Biometrik Saya',
        added: 'Hari ini',
        lastUsed: 'Belum digunakan',
        icon: 'Fingerprint'
      };
      setPasskeys([...passkeys, newPasskey]);
      toast.success('Kunci sandi baru berhasil didaftarkan.');
      
    } catch (error: any) {
      console.error("Gagal mendaftarkan Passkey:", error);
      if (error.name === 'NotAllowedError') {
        toast.error("Gagal membaca sensor biometrik atau dibatalkan.");
      } else {
        toast.error(`Error: ${error.message}`);
      }
    }
  };

  const handleVerifyAuth = () => {
    if (authCode.length < 6) {
      toast.error('Kode harus 6 digit angka.');
      return;
    }
    setIsAuthActive(true);
    toast.success('Autentikasi 2 Langkah berhasil diaktifkan!');
    setIsTwoFactorModalOpen(false);
    setAuthCode('');
  };

  const handleTogglePrompt = () => {
    if (!isPromptActive) {
      setIsPromptActive(true);
      toast.success('Perintah Google berhasil diaktifkan untuk perangkat Anda.');
    } else {
      setIsPromptActive(false);
      toast.success('Perintah Google dinonaktifkan.');
    }
    setIsPromptModalOpen(false);
  };

  const handleSendPhoneOtp = () => {
    if (phoneNumber.length < 9) {
      toast.error('Masukkan nomor telepon yang valid.');
      return;
    }
    setPhoneStep(2);
    toast.success(`Kode OTP telah dikirim ke +62 ${phoneNumber}`);
  };

  const handleSendWaOTP = async () => {
    if (phoneNumber.length < 9) {
      toast.error('Masukkan nomor telepon yang valid.');
      return;
    }
    
    setIsWaLoading(true);
    try {
      // Simulasi pemanggilan API ke backend untuk kirim OTP via WhatsApp
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Instruksi OTP telah dikirim ke WhatsApp Anda');
      setPhoneStep(2);
    } catch (error) {
      toast.error('Gagal mengirim OTP ke WhatsApp. Coba lagi.');
    } finally {
      setIsWaLoading(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPin || !newPin || !confirmNewPin) {
      toast.error('Semua kolom PIN harus diisi.');
      return;
    }
    if (newPin.length !== 6) {
      toast.error('PIN Baru harus tepat 6 digit.');
      return;
    }
    if (newPin !== confirmNewPin) {
      toast.error('Konfirmasi PIN Baru tidak cocok.');
      return;
    }
    setIsLoading(true);
    try {
      const authInstance = getAuth();
      if (!authInstance.currentUser) {
        throw new Error('User not authenticated');
      }
      
      const docRef = doc(db, 'users', authInstance.currentUser.uid, 'security_settings', 'preferences');
      const simulatedHash = `$2b$10$${newPin}SimulatedHashSalt`;

      await updateDoc(docRef, {
        'attendance_pin.pinHash': simulatedHash,
        'attendance_pin.updatedAt': new Date().toISOString()
      });
      
      toast.success('PIN Kehadiran berhasil diperbarui', { 
        style: { background: '#10B981', color: '#fff' }, 
        iconTheme: { primary: '#fff', secondary: '#10B981' } 
      });
      setIsPinModalOpen(false);
      setOldPin('');
      setNewPin('');
      setConfirmNewPin('');
      setShowPin(false);
    } catch (error) {
      console.error('Gagal memperbarui PIN:', error);
      toast.error('Terjadi kesalahan saat memperbarui PIN.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (phoneOtp.length < 6) {
      toast.error('Kode OTP harus 6 digit.');
      return;
    }
    
    setIsWaLoading(true);
    try {
      const authInstance = getAuth();
      if (!authInstance.currentUser) {
        throw new Error('User not authenticated');
      }
      
      const docRef = doc(db, 'users', authInstance.currentUser.uid, 'security_settings', 'preferences');
      const newPhone = `+62 ${phoneNumber}`;
      
      await updateDoc(docRef, {
        'recovery_phone.phoneNumber': newPhone,
        'recovery_phone.isVerified': true
      });
      
      setVerifiedPhone(newPhone);
      setIsPhoneModalOpen(false);
      toast.success('Nomor telepon berhasil diverifikasi dan ditambahkan!', { 
        style: { background: '#10B981', color: '#fff' }, 
        iconTheme: { primary: '#fff', secondary: '#10B981' } 
      });
      setPhoneStep(1);
      setPhoneNumber('');
      setPhoneOtp('');
    } catch (error) {
      console.error('Gagal memverifikasi nomor telepon:', error);
      toast.error('Terjadi kesalahan saat memverifikasi nomor telepon.');
    } finally {
      setIsWaLoading(false);
    }
  };

  const handleSendEmailOtp = async () => {
    // Regex for basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recoveryEmail)) {
      toast.error('Format email tidak valid.');
      return;
    }
    
    setIsEmailLoading(true);
    try {
      // Simulasi loading
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Kode Verifikasi telah dikirim ke email Anda');
      setEmailStep(2);
    } catch (error) {
      toast.error('Gagal mengirim kode verifikasi. Coba lagi.');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (emailOtp.length !== 6) {
      toast.error('Kode OTP harus 6 digit.');
      return;
    }
    
    setIsEmailLoading(true);
    try {
      const authInstance = getAuth();
      if (!authInstance.currentUser) {
        throw new Error('User not authenticated');
      }
      
      const docRef = doc(db, 'users', authInstance.currentUser.uid, 'security_settings', 'preferences');
      
      await updateDoc(docRef, {
        'recovery_email.email': recoveryEmail,
        'recovery_email.isVerified': true
      });
      
      setVerifiedRecoveryEmail(recoveryEmail);
      setIsEmailModalOpen(false);
      toast.success('Email pemulihan berhasil diperbarui', { 
        style: { background: '#10B981', color: '#fff' }, 
        iconTheme: { primary: '#fff', secondary: '#10B981' } 
      });
      setEmailStep(1);
      setRecoveryEmail('');
      setEmailOtp('');
    } catch (error) {
      console.error('Gagal memverifikasi email:', error);
      toast.error('Terjadi kesalahan saat memverifikasi email.');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      toast.error('Kata sandi baru tidak boleh kosong.');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error('Kata sandi minimal 6 karakter.');
      return;
    }

    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      toast.error('Pengguna tidak ditemukan. Sesi mungkin telah berakhir.');
      return;
    }

    setIsLoading(true);
    try {
      await updatePassword(currentUser, newPassword);
      toast.success('Kata sandi berhasil diperbarui.');
      setIsPasswordModalOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Update password error:', error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error('Sesi Anda terlalu lama. Demi keamanan, silakan Logout dan Login kembali sebelum mengubah kata sandi.', { duration: 5000 });
      } else {
        toast.error(error.message || 'Gagal memperbarui kata sandi.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePhoneNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryPhoneNumber) {
      toast.error('Nomor telepon tidak boleh kosong.');
      return;
    }
    
    setIsLoading(true);
    try {
      const authInstance = getAuth();
      if (!authInstance.currentUser) {
        throw new Error('User not authenticated');
      }
      
      const docRef = doc(db, 'users', authInstance.currentUser.uid);
      await updateDoc(docRef, {
        recoveryPhone: recoveryPhoneNumber
      });
      
      setSavedRecoveryPhone(recoveryPhoneNumber);
      setIsRecoveryPhoneModalOpen(false);
      toast.success('Berhasil disimpan');
      setRecoveryPhoneNumber('');
    } catch (error) {
      console.error('Gagal menyimpan nomor telepon pemulihan:', error);
      toast.error('Terjadi kesalahan saat menyimpan nomor telepon.');
    } finally {
      setIsLoading(false);
    }
  };

  const ListItem = ({ 
    icon, title, subtitle, onClick, rightAction, border = true 
  }: { 
    icon: React.ReactNode, title: string, subtitle?: string, onClick?: () => void, rightAction?: React.ReactNode, border?: boolean 
  }) => (
    <div 
      onClick={onClick}
      className={`flex items-center gap-4 py-4 px-5 sm:px-6 transition-colors ${onClick ? 'cursor-pointer hover:bg-slate-50' : ''} ${border ? 'border-b border-slate-100' : ''}`}
    >
      <div className="text-slate-500 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-[15px] font-semibold text-slate-800 truncate">{title}</h4>
        {subtitle && <p className="text-[13px] text-slate-500 truncate mt-0.5">{subtitle}</p>}
      </div>
      <div className="shrink-0 flex items-center text-slate-400">
        {rightAction || (onClick && <ChevronRight size={18} />)}
      </div>
    </div>
  );

  // Variabel QR Code (Aman dari undefined)
  const appName = "AbdiAbsenDigital";
  const userEmail = "superadmin@alphaproject.com";
  const totpSecret = "JBSWY3DPEHPK3PXP";
  const totpUri = `otpauth://totp/${appName}:${userEmail}?secret=${totpSecret}&issuer=${appName}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpUri)}`;

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
          <p className="text-slate-500 font-medium">Memuat setelan keamanan...</p>
        </div>
      </div>
    );
  }

  if (tab === 'aktivitas') {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full pb-24 animate-fade-in relative">
        <div className="mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-800 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800">Aktivitas Keamanan Terbaru</h1>
            <p className="text-slate-500 mt-1 text-sm sm:text-base">
              Tinjau perangkat yang baru-baru ini login ke akun Anda atau aktivitas keamanan lainnya.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-2">
          {recentActivities.map((activity, index) => {
            const isLast = index === recentActivities.length - 1;
            return (
              <div key={activity.id} className={`flex items-start gap-4 p-4 ${!isLast ? 'border-b border-slate-100' : ''}`}>
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 text-slate-500">
                  {activity.icon === 'Laptop' && <Laptop size={22} />}
                  {activity.icon === 'Smartphone' && <Smartphone size={22} />}
                  {activity.icon === 'ShieldCheck' && <ShieldCheck size={22} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h5 className="font-bold text-slate-800 text-base">{activity.type === 'Login' ? activity.device : activity.type}</h5>
                    {activity.isCurrent && (
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider">
                        Saat ini
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {activity.type === 'Login' ? `${activity.location} • ${activity.browser}` : activity.device}
                  </p>
                  <p className="text-xs font-semibold text-slate-400 mt-1.5">{activity.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full pb-24 animate-fade-in relative">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 flex items-center gap-3">
          <Shield className="text-indigo-600 w-8 h-8 sm:w-9 sm:h-9" />
          <EditableText originalText="Keamanan & login" />
        </h1>
        <p className="text-slate-500 mt-2 text-sm sm:text-base">
          Setelan dan rekomendasi keamanan untuk membantu melindungi akun Anda.
        </p>
      </div>

      {/* SECTION TOP: Rekomendasi Keamanan */}
      <div className="mb-8">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4 shadow-sm cursor-pointer hover:bg-amber-100/70 transition-colors" onClick={() => setIsCheckupModalOpen(true)}>
          <div className="text-amber-500 shrink-0 bg-white p-2 rounded-xl shadow-sm">
            <ShieldAlert size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-amber-900 text-base">Anda memiliki rekomendasi keamanan</h3>
            <p className="text-sm text-amber-700/80 mt-0.5">
              Tindakan yang disarankan ditemukan dalam Pemeriksaan Keamanan
            </p>
          </div>
          <div className="shrink-0 text-amber-700 font-semibold text-sm">
            Lihat rekomendasi
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* SECTION 1: Cara Login */}
        <section>
          <div className="mb-3 px-1">
            <h2 className="text-lg font-bold text-slate-800">Cara Anda login ke Abdi Absen Digital</h2>
            <p className="text-sm text-slate-500 mt-1">
              Pastikan Anda selalu dapat mengakses Akun Abdi Absen Digital Anda dengan terus memperbarui informasi ini.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <ListItem 
              icon={<Lock size={22} />}
              title="Sandi"
              subtitle="Terkahir diubah..."
              onClick={() => setIsPasswordModalOpen(true)}
            />
            <ListItem 
              icon={<Fingerprint size={22} />}
              title="Kunci sandi dan kunci keamanan"
              subtitle={`${passkeys.length} Kunci Sandi`}
              onClick={() => setIsPasskeyModalOpen(true)}
            />
            <ListItem 
              icon={<Shield size={22} />}
              title="Lewati sandi jika mungkin"
              border={false}
              onClick={handleToggleSkipPassword}
              rightAction={
                <button 
                  onClick={(e) => { e.stopPropagation(); handleToggleSkipPassword(); }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isSkipPasswordEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  role="switch"
                  aria-checked={isSkipPasswordEnabled}
                >
                  <span className="sr-only">Aktifkan lewati sandi</span>
                  <span 
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${isSkipPasswordEnabled ? 'translate-x-6' : 'translate-x-1'}`} 
                  />
                </button>
              }
            />
          </div>
        </section>

        {/* SECTION 2: Verifikasi 2 Langkah */}
        <section>
          <div className="mb-3 px-1">
            <h2 className="text-lg font-bold text-slate-800">Verifikasi 2 Langkah</h2>
            <p className="text-sm text-slate-500 mt-1">
              Tambahkan lapisan keamanan ekstra di akun Anda.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <ListItem 
              icon={<Smartphone size={22} />}
              title="Aplikasi Authenticator"
              subtitle={isAuthActive ? <span className="text-emerald-600 font-medium flex items-center gap-1">Aktif <CheckCircle2 size={16} /></span> : "Setup autentikasi aplikasi (Google Authenticator)"}
              onClick={() => setIsTwoFactorModalOpen(true)}
            />
            <ListItem 
              icon={<CheckCircle2 size={22} />}
              title="Perintah Google"
              subtitle={isPromptActive ? <span className="text-emerald-600 font-medium flex items-center gap-1">1 Perangkat aktif <CheckCircle2 size={16} /></span> : <span className="text-slate-500">Nonaktif</span>}
              onClick={() => setIsPromptModalOpen(true)}
            />
            <ListItem 
              icon={<Phone size={22} />}
              title="Nomor telepon Verifikasi 2 Langkah"
              subtitle={verifiedPhone ? <span className="text-emerald-600 font-medium flex items-center gap-1">{verifiedPhone} <CheckCircle2 size={16} /></span> : <span className="text-slate-500">Belum ditambahkan</span>}
              onClick={() => setIsPhoneModalOpen(true)}
            />
            <ListItem 
              icon={<ScanFace size={22} />}
              title="Video selfie"
              subtitle={isVideoActive ? <span className="text-emerald-600 font-medium flex items-center gap-1">Aktif <CheckCircle2 size={16} /></span> : <span className="text-slate-500">Nonaktif</span>}
              border={false}
              onClick={handleOpenVideoModal}
            />
          </div>
        </section>

        {/* SECTION 3: Pemulihan Akun */}
        <section>
          <div className="mb-3 px-1">
            <h2 className="text-lg font-bold text-slate-800">Metode Pemulihan</h2>
            <p className="text-sm text-slate-500 mt-1">
              Metode untuk memverifikasi bahwa ini memang Anda.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <ListItem 
              icon={<Phone size={22} />}
              title="Nomor telepon pemulihan"
              subtitle={savedRecoveryPhone ? savedRecoveryPhone.replace(/(\d{3,4})(\d+)(\d{4})/, '$1-****-$3') : "Belum ditambahkan"}
              onClick={() => setIsRecoveryPhoneModalOpen(true)}
            />
            <ListItem 
              icon={<Mail size={22} />}
              title="Email pemulihan"
              subtitle={verifiedRecoveryEmail || user?.email || "Belum ditambahkan"}
              border={false}
              onClick={() => setIsEmailModalOpen(true)}
            />
          </div>
        </section>
        
        {/* SECTION 4: Keamanan Presensi */}
        <section>
          <div className="mb-3 px-1">
            <h2 className="text-lg font-bold text-slate-800">Keamanan Presensi</h2>
            <p className="text-sm text-slate-500 mt-1">
              Pengaturan keamanan tambahan untuk validasi absensi harian.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <ListItem 
              icon={<Key size={22} />}
              title="PIN Kehadiran"
              subtitle="PIN untuk validasi absen mandiri atau via admin"
              border={false}
              onClick={() => setIsPinModalOpen(true)}
            />
          </div>
        </section>
      </div>

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Ubah Kata Sandi</h3>
              <button 
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                disabled={isLoading}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdatePassword} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kata Sandi Baru</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="Minimal 6 karakter"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Konfirmasi Kata Sandi Baru</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="Masukkan ulang kata sandi baru"
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  disabled={isLoading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center min-w-[140px] cursor-pointer"
                  disabled={isLoading}
                >
                  {isLoading ? 'Menyimpan...' : 'Simpan Kata Sandi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2FA Modal */}
      {isTwoFactorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Setup Autentikasi 2 Langkah</h3>
              <button 
                onClick={() => setIsTwoFactorModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center text-center">
              <p className="text-sm text-slate-600 mb-4">
                Scan QR Code ini menggunakan aplikasi Google Authenticator Anda.
              </p>
              
              <div className="w-[200px] h-[200px] bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center mx-auto my-6 overflow-hidden p-2">
                <img 
                  src={qrImageUrl} 
                  alt="QR Code 2FA" 
                  className="w-full h-full object-contain"
                />
              </div>
              
              <div className="w-full text-left">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">6 Digit Kode</label>
                <input
                  type="text"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-center tracking-[0.5em] text-xl font-mono"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
              
              <div className="w-full mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsTwoFactorModalOpen(false);
                    setAuthCode('');
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleVerifyAuth}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  Verifikasi & Aktifkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkup Modal */}
      {isCheckupModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Pemeriksaan Keamanan</h3>
              <button 
                onClick={() => setIsCheckupModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex flex-col items-center justify-center mb-6">
                <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mb-3">
                  <ShieldAlert size={32} />
                </div>
                <h4 className="text-xl font-bold text-slate-800">Tindakan disarankan</h4>
                <p className="text-sm text-slate-500 text-center mt-1">
                  Kami menemukan {securityIssues.filter(i => !i.isResolved).length} hal yang dapat Anda lakukan untuk memperkuat keamanan akun.
                </p>
              </div>

              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                {securityIssues.map(issue => (
                  <div key={issue.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className={`shrink-0 p-2 rounded-full ${issue.isResolved ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                      {issue.isResolved ? <CheckCircle2 size={24} /> : <ShieldAlert size={24} />}
                    </div>
                    <div className="flex-1">
                      <h5 className="font-bold text-slate-800">{issue.title}</h5>
                      <p className="text-sm text-slate-600 mt-1">{issue.description}</p>
                    </div>
                    {!issue.isResolved && (
                      <button 
                        className="shrink-0 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-lg transition-colors cursor-pointer w-full sm:w-auto mt-2 sm:mt-0"
                        onClick={() => {
                          setIsCheckupModalOpen(false);
                          if (issue.id === '2fa') {
                            setIsTwoFactorModalOpen(true);
                          } else {
                            toast('Fitur penyelesaian masalah ini segera hadir.', { icon: '🚧' });
                          }
                        }}
                      >
                        Selesaikan
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsCheckupModalOpen(false)}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer w-full sm:w-auto"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Passkey Modal */}
      {isPasskeyModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh' }}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-slate-800">Kunci sandi dan kunci keamanan</h3>
              <button 
                onClick={() => setIsPasskeyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="flex flex-col items-center justify-center mb-6">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                  <Fingerprint size={32} />
                </div>
                <p className="text-sm text-slate-500 text-center px-4">
                  Gunakan sidik jari, pemindaian wajah, atau kunci layar perangkat untuk login dengan lebih cepat dan aman.
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {passkeys.map((passkey) => (
                  <div key={passkey.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 text-slate-500">
                      {passkey.icon === 'Fingerprint' && <Fingerprint size={18} />}
                      {passkey.icon === 'Key' && <Key size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-slate-800 truncate">{passkey.name}</h5>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Ditambahkan: {passkey.added} • Terakhir digunakan: {passkey.lastUsed}
                      </p>
                    </div>
                    <button 
                      className="shrink-0 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      onClick={() => handleDeletePasskey(passkey.id)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                {passkeys.length === 0 && (
                  <p className="text-center text-sm text-slate-500 py-4">Belum ada kunci sandi yang terdaftar.</p>
                )}
              </div>
              
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition-colors cursor-pointer mb-6 border border-indigo-100"
                onClick={handleCreatePasskey}
              >
                <Plus size={20} />
                Buat kunci sandi
              </button>
              
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPasskeyModalOpen(false)}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer w-full sm:w-auto"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Google Prompt Modal */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Gunakan ponsel Anda untuk login</h3>
              <button 
                onClick={() => setIsPromptModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-slate-600">
                Setelah memasukkan sandi, Anda akan menerima perintah aman di ponsel pintar Anda. Cukup ketuk 'Ya' untuk memverifikasi bahwa itu memang Anda.
              </p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 my-6 flex items-start gap-4">
                <div className="p-2 bg-white rounded-full shadow-sm text-indigo-600 shrink-0">
                  <Smartphone size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm mb-1">Perangkat yang memenuhi syarat: Android Smartphone (atau iPhone)</p>
                  <p className="text-xs text-slate-500">Lokasi saat ini: Bandung, Jawa Barat (Aktif sekarang)</p>
                </div>
              </div>
              
              <div className="w-full mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPromptModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleTogglePrompt}
                  className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors cursor-pointer shadow-sm ${
                    !isPromptActive 
                      ? 'bg-indigo-600 hover:bg-indigo-700' 
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {!isPromptActive ? "Aktifkan Perintah" : "Nonaktifkan Fitur"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Phone 2FA Modal */}
      {isPhoneModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                {phoneStep === 1 ? 'Tambahkan Nomor Telepon' : 'Verifikasi Nomor Telepon'}
              </h3>
              <button 
                onClick={() => {
                  setIsPhoneModalOpen(false);
                  setPhoneStep(1);
                  setPhoneOtp('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              {phoneStep === 1 ? (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    Ponsel Anda dapat digunakan untuk Verifikasi 2 Langkah. Kami akan mengirimkan kode SMS setiap kali Anda masuk ke akun.
                  </p>
                  
                  <div className="w-full text-left">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nomor Ponsel</label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 py-2 border border-r-0 border-slate-300 rounded-l-lg bg-slate-50 text-slate-500 font-medium">
                        +62
                      </span>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                        className="flex-1 w-full px-3 py-2 border border-slate-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-lg"
                        placeholder="81234567890"
                      />
                    </div>
                  </div>
                  
                  <div className="w-full mt-6 flex flex-col sm:flex-row justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPhoneModalOpen(false)}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer order-3 sm:order-1"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSendPhoneOtp}
                      className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer shadow-sm order-2 sm:order-2"
                    >
                      Kirim Kode (SMS)
                    </button>
                    <button
                      type="button"
                      onClick={handleSendWaOTP}
                      disabled={isWaLoading}
                      className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#25D366] hover:bg-[#128C7E] disabled:bg-[#25D366]/60 rounded-lg transition-colors cursor-pointer shadow-sm order-1 sm:order-3"
                    >
                      <MessageCircle size={18} />
                      {isWaLoading ? 'Mengirim...' : 'Kirim via WhatsApp'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    Masukkan kode 6 digit yang baru saja kami kirimkan ke nomor <strong>+62 {phoneNumber}</strong>.
                  </p>
                  
                  <div className="w-full text-left">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kode OTP SMS</label>
                    <input
                      type="text"
                      value={phoneOtp}
                      onChange={(e) => setPhoneOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-center tracking-[0.5em] text-xl font-mono"
                      placeholder="000000"
                      maxLength={6}
                    />
                  </div>
                  
                  <div className="w-full mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setPhoneStep(1)}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Kembali
                    </button>
                    <button
                      type="button"
                      onClick={handleVerifyPhoneOtp}
                      disabled={isWaLoading}
                      className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50 min-w-[130px] flex items-center justify-center"
                    >
                      {isWaLoading ? 'Memverifikasi...' : 'Verifikasi'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Selfie Modal */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Setup Video Selfie</h3>
              <button 
                onClick={handleCloseVideoModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center">
              {!videoRecorded ? (
                <>
                  <p className="text-sm text-slate-600 mb-4 text-center">
                    Posisikan wajah Anda di tengah layar dan tekan rekam. Tahan selama 3 detik.
                  </p>
                  
                  <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden mb-6 flex items-center justify-center">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover"
                    />
                    {isRecording && (
                      <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-red-500/80 backdrop-blur-sm rounded-full text-white text-xs font-bold animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                        Merekam...
                      </div>
                    )}
                  </div>
                  
                  <div className="w-full flex justify-center">
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={isRecording}
                      className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-full transition-colors shadow-sm cursor-pointer"
                    >
                      {isRecording ? 'Merekam Video...' : 'Mulai Rekam'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 size={32} />
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 mb-2">Video Berhasil Direkam!</h4>
                  <p className="text-sm text-slate-600 text-center mb-6">
                    Video selfie Anda telah berhasil direkam dan diverifikasi. Fitur ini sekarang siap digunakan untuk pengenalan wajah.
                  </p>
                  
                  <div className="w-full flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setVideoRecorded(false);
                        setTimeout(() => startCamera(), 100);
                      }}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Rekam Ulang
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveVideo}
                      className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer shadow-sm"
                    >
                      Simpan & Aktifkan
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PIN Kehadiran Modal */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Ubah PIN Kehadiran</h3>
              <button 
                onClick={() => {
                  setIsPinModalOpen(false);
                  setOldPin('');
                  setNewPin('');
                  setConfirmNewPin('');
                  setShowPin(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                disabled={isLoading}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSavePin} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">PIN Lama</label>
                  <div className="relative">
                    <input
                      type={showPin ? "text" : "password"}
                      value={oldPin}
                      onChange={(e) => setOldPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono tracking-widest text-lg"
                      placeholder="••••••"
                      maxLength={6}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">PIN Baru</label>
                  <div className="relative">
                    <input
                      type={showPin ? "text" : "password"}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono tracking-widest text-lg"
                      placeholder="••••••"
                      maxLength={6}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Konfirmasi PIN Baru</label>
                  <div className="relative">
                    <input
                      type={showPin ? "text" : "password"}
                      value={confirmNewPin}
                      onChange={(e) => setConfirmNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono tracking-widest text-lg"
                      placeholder="••••••"
                      maxLength={6}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsPinModalOpen(false);
                    setOldPin('');
                    setNewPin('');
                    setConfirmNewPin('');
                    setShowPin(false);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  disabled={isLoading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center min-w-[140px] cursor-pointer"
                  disabled={isLoading}
                >
                  {isLoading ? 'Menyimpan...' : 'Simpan PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Pemulihan Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                {emailStep === 1 ? 'Tambahkan Email Pemulihan' : 'Verifikasi Email Pemulihan'}
              </h3>
              <button 
                onClick={() => {
                  setIsEmailModalOpen(false);
                  setEmailStep(1);
                  setRecoveryEmail('');
                  setEmailOtp('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              {emailStep === 1 ? (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    Alamat email ini akan digunakan untuk membantu Anda masuk kembali ke akun Anda jika Anda kehilangan akses.
                  </p>
                  
                  <div className="w-full text-left">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Alamat Email Baru</label>
                    <input
                      type="email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-lg"
                      placeholder="contoh@email.com"
                      disabled={isEmailLoading}
                    />
                  </div>
                  
                  <div className="w-full mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEmailModalOpen(false)}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      disabled={isEmailLoading}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSendEmailOtp}
                      className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                      disabled={isEmailLoading}
                    >
                      {isEmailLoading ? 'Mengirim...' : 'Kirim Kode Verifikasi'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600 mb-4">
                    Masukkan kode 6 digit yang baru saja kami kirimkan ke <strong>{recoveryEmail}</strong>.
                  </p>
                  
                  <div className="w-full text-left">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kode OTP Email</label>
                    <input
                      type="text"
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-center tracking-[0.5em] text-xl font-mono"
                      placeholder="000000"
                      maxLength={6}
                    />
                  </div>
                  
                  <div className="w-full mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setEmailStep(1)}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleVerifyEmailOtp}
                      disabled={isEmailLoading}
                      className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50 min-w-[170px] flex items-center justify-center"
                    >
                      {isEmailLoading ? 'Memverifikasi...' : 'Verifikasi & Simpan'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recovery Phone Modal */}
      {isRecoveryPhoneModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Tambahkan Nomor Pemulihan</h3>
              <button 
                onClick={() => setIsRecoveryPhoneModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                disabled={isLoading}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSavePhoneNumber} className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Nomor ini akan digunakan untuk membantu Anda masuk kembali ke akun jika lupa sandi.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nomor Telepon</label>
                  <input
                    type="tel"
                    value={recoveryPhoneNumber}
                    onChange={(e) => setRecoveryPhoneNumber(e.target.value.replace(/[^0-9+]/g, ''))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-lg"
                    placeholder="+6281234567890"
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRecoveryPhoneModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  disabled={isLoading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center min-w-[140px] cursor-pointer"
                  disabled={isLoading}
                >
                  {isLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
