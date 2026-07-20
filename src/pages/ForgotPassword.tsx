import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../lib/firebase";
import { toast } from "react-hot-toast";
import { Lock, Mail, ArrowLeft, Send } from "lucide-react";
import { EditableText } from "../components/EditableText";
import { DraggableBlock } from "../components/DraggableBlock";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error("Silakan masukkan email Anda.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Mengirim tautan reset kata sandi...");

    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast.dismiss(toastId);
      toast.success("Tautan reset kata sandi telah dikirim. Silakan cek kotak masuk atau folder spam email Anda.", {
        duration: 6000,
      });
      // Optionally redirect to login after success
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error: any) {
      toast.dismiss(toastId);
      console.error("Password reset error:", error);
      
      let errorMessage = "Gagal mengirim email reset kata sandi.";
      if (error.code === 'auth/user-not-found') {
        errorMessage = "Email tidak ditemukan di sistem kami.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Format email tidak valid.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Terlalu banyak percobaan. Silakan coba lagi nanti.";
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden font-sans">
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#7a22e8] via-[#c22cae]/80 to-[#ff4081]/10 opacity-95" />

      <button
        onClick={() => navigate("/login")}
        className="fixed top-6 left-6 z-50 bg-white/90 hover:bg-white text-slate-800 px-5 py-2.5 rounded-full shadow-xl backdrop-blur-md border border-slate-200/80 text-xs font-black flex items-center gap-2 hover:scale-105 transition-all group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Kembali ke Login
      </button>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10 m-4 p-8 sm:p-10 flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 shadow-inner border border-indigo-100">
          <Lock size={32} strokeWidth={2.5} />
        </div>
        
        <h2 className="text-2xl font-black text-slate-800 mb-2 text-center">
          Reset Kata Sandi
        </h2>
        <p className="text-sm text-slate-500 text-center mb-8 px-2 leading-relaxed">
          Masukkan email yang terdaftar pada akun Anda. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi.
        </p>

        <form onSubmit={handleResetPassword} className="w-full space-y-5">
          <div className="relative group w-full">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Terdaftar"
              disabled={loading}
              className="w-full h-12 rounded-full border border-gray-200 px-6 text-sm outline-none focus:border-[#8C43F6] focus:ring-1 focus:ring-[#8C43F6] transition-all text-gray-700 bg-gray-50/50 hover:bg-gray-50 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 pointer-events-none">
               <div className="absolute left-0 top-0 w-7 h-7 rounded-full bg-white/30 backdrop-blur-md shadow-sm flex items-center justify-center overflow-hidden border border-slate-200">
                 <Mail className="w-3.5 h-3.5 relative z-10 text-gray-400 group-focus-within:text-[#8C43F6] transition-colors" />
               </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-gradient-to-r from-[#b829ff] to-[#7928CA] text-white font-bold rounded-full transition-all shadow-md hover:shadow-lg focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 ${loading ? 'opacity-75 cursor-wait' : 'hover:-translate-y-0.5 active:scale-95'}`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Mengirim...
              </>
            ) : (
              <>
                <Send size={16} /> Kirim Tautan Reset
              </>
            )}
          </button>
        </form>
        
        <div className="mt-8 text-center text-xs text-slate-400">
          Pastikan email Anda dapat menerima pesan masuk.
        </div>
      </div>
    </div>
  );
}
