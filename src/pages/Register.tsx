import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import { School, User, Lock, Building, Mail, LogIn } from "lucide-react";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, dbRealtime } from "../lib/firebase";
import { ref, set } from "firebase/database";
import { hashPassword } from "../lib/localCrypto";

export function Register() {
  const [instansiName, setInstansiName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instansiName || !adminName || !adminUsername || !adminEmail || !password) {
      toast.error("Semua field wajib diisi");
      return;
    }

    if (password.length < 6) {
      toast.error("Kata sandi minimal 6 karakter");
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading("Mendaftarkan instansi Anda...");

    try {
      // 1. Generate unique Tenant ID
      const tenantId = "tenant_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

      // 2. Create Firebase Auth User
      // Note: We use email for Firebase Auth, but they can still login using their username.
      const cred = await createUserWithEmailAndPassword(auth, adminEmail, password);
      const userUid = cred.user.uid;

      // 3. Set global mapping
      await set(ref(dbRealtime, `user_tenant_mapping/${userUid}`), tenantId);

      // 4. Set School Data for this tenant
      const defaultSchool = {
        name: instansiName,
        address: "Alamat Instansi",
        phone: "-",
        email: adminEmail,
        website: "-",
        latitude: -6.200000,
        longitude: 106.816666,
        radius: 100,
        logoUrl: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=200",
        timezone: "WIB",
      };
      await set(ref(dbRealtime, `tenants/${tenantId}/school`), defaultSchool);

      // 5. Create Default OPD and Satuan Kerja
      const defaultOpdId = "opd_" + Date.now();
      const defaultOpd = {
        id: defaultOpdId,
        singkatan: instansiName.substring(0, 10).toUpperCase(),
        nama: instansiName,
      };
      await set(ref(dbRealtime, `tenants/${tenantId}/opds/${defaultOpdId}`), defaultOpd);

      const defaultSatkerId = "satker_" + Date.now();
      const defaultSatker = {
        id: defaultSatkerId,
        singkatan: instansiName.substring(0, 10).toUpperCase(),
        nama: instansiName,
        opdId: defaultOpdId,
      };
      await set(ref(dbRealtime, `tenants/${tenantId}/satuanKerjas/${defaultSatkerId}`), defaultSatker);

      // 6. Create Admin Profile in tenant node
      const adminProfile = {
        id: userUid,
        username: adminUsername,
        name: adminName,
        role: "admin",
        password: hashPassword(password), // Legacy support if needed
        email: adminEmail,
        opd: defaultOpd.nama,
        satuanKerja: defaultSatker.nama,
      };
      await set(ref(dbRealtime, `tenants/${tenantId}/users/${userUid}`), adminProfile);

      // 7. Sign out immediately so they have to login properly
      await signOut(auth);

      toast.success("Pendaftaran berhasil! Silakan login.", { id: toastId });
      navigate("/login");
    } catch (err: any) {
      console.error("Registration error:", err);
      let errorMsg = "Gagal mendaftar. Silakan coba lagi.";
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = "Email tersebut sudah digunakan untuk pendaftaran.";
      }
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 font-sans p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-400/20 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] p-8 sm:p-10 relative z-10 border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 mb-4 transform -rotate-6">
            <Building className="w-8 h-8 text-white transform rotate-6" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Daftar Instansi</h2>
          <p className="text-slate-500 text-sm mt-2 text-center font-medium">
            Buat ruang khusus untuk sekolah/perusahaan Anda.
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="relative group">
            <input
              type="text"
              required
              value={instansiName}
              onChange={(e) => setInstansiName(e.target.value)}
              placeholder="Nama Instansi / Sekolah"
              className="w-full h-12 rounded-xl border border-slate-200 px-11 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-700 bg-slate-50/50"
            />
            <School className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>

          <div className="relative group">
            <input
              type="text"
              required
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="Nama Lengkap Admin"
              className="w-full h-12 rounded-xl border border-slate-200 px-11 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-700 bg-slate-50/50"
            />
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>

          <div className="relative group">
            <input
              type="text"
              required
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
              placeholder="Nama Pengguna Admin"
              className="w-full h-12 rounded-xl border border-slate-200 px-11 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-700 bg-slate-50/50"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold group-focus-within:text-indigo-500 transition-colors">@</span>
          </div>

          <div className="relative group">
            <input
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="Email Aktif"
              className="w-full h-12 rounded-xl border border-slate-200 px-11 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-700 bg-slate-50/50"
            />
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>

          <div className="relative group">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Kata Sandi (Min 6 karakter)"
              className="w-full h-12 rounded-xl border border-slate-200 px-11 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-700 bg-slate-50/50 tracking-wider"
            />
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 mt-6 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl transition-all hover:shadow-[0_8px_20px_-8px_rgba(99,102,241,0.6)] active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Buat Instansi</span>
                <LogIn className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm font-medium">
            Sudah mendaftarkan instansi?{" "}
            <Link to="/login" className="text-indigo-600 font-bold hover:text-indigo-700 hover:underline transition-all">
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
