import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types";
import { auth, dbRealtime } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get, child } from "firebase/database";
import { db } from "../lib/db";
import { initializeFirebaseSync } from "../lib/firebaseSync";

// ─── Konstanta Keamanan Sesi ─────────────────────────────────
/** Durasi maksimum sesi aktif: 7 hari dalam milidetik */
const MAX_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** Key localStorage untuk menyimpan timestamp pembuatan sesi */
const SESSION_CREATED_AT_KEY = "abdi_session_created_at";

// ─── Helpers Validasi Sesi ───────────────────────────────────
function isSessionExpired(): boolean {
  const createdAt = localStorage.getItem(SESSION_CREATED_AT_KEY);
  if (!createdAt) return false; // Sesi lama tanpa timestamp — biarkan Firebase menentukan
  const elapsed = Date.now() - parseInt(createdAt, 10);
  return elapsed > MAX_SESSION_DURATION_MS;
}

function stampSession() {
  if (!localStorage.getItem(SESSION_CREATED_AT_KEY)) {
    localStorage.setItem(SESSION_CREATED_AT_KEY, String(Date.now()));
  }
}

function clearSession() {
  localStorage.removeItem("active_session_user");
  localStorage.removeItem(SESSION_CREATED_AT_KEY);
}

// ─── Context Type ────────────────────────────────────────────
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (u: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // Cek kedaluwarsa sesi sebelum memuat dari localStorage
    if (isSessionExpired()) {
      clearSession();
      return null;
    }
    const activeStored = localStorage.getItem("active_session_user");
    if (activeStored) {
      try {
        const parsed = JSON.parse(activeStored);
        if (parsed && (parsed.id || parsed.username)) {
          return parsed;
        }
      } catch (e) {
        console.error("Error parsing initial session:", e);
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(() => {
    // Jika sudah ada sesi valid di localStorage, skip loading state awal
    return !localStorage.getItem("active_session_user");
  });

  useEffect(() => {
    // ── Validasi Sesi Lokal ──────────────────────────────────
    const restoreFallbackSession = () => {
      // Cek kembali expiry saat effect berjalan (bisa saja baru kedaluwarsa)
      if (isSessionExpired()) {
        clearSession();
        setUser(null);
        return false;
      }

      const activeStored = localStorage.getItem("active_session_user");
      if (activeStored) {
        try {
          const parsed = JSON.parse(activeStored);
          if (parsed && (parsed.id || parsed.username)) {
            const allUsers = db.getUsers(true);
            const matched = allUsers.find(
              (u) => u.id === parsed.id || u.username === parsed.username
            );
            const userToSet = matched
              ? { ...matched, id: matched.id, password: "" }
              : parsed;
            setUser(userToSet);
            localStorage.setItem("active_session_user", JSON.stringify(userToSet));
            return true;
          }
        } catch (e) {
          console.error("Error parsing stored session:", e);
        }
      }
      clearSession();
      setUser(null);
      return false;
    };

    // Safety timeout: maksimal 2 detik loading
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 2000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // ── User Firebase aktif: fetch data dari Realtime DB ─
        try {
          const dbRef = ref(dbRealtime);
          const snapshot = await get(child(dbRef, `users`));
          const username = firebaseUser.email?.split("@")[0] || "";

          if (snapshot.exists()) {
            const usersData = snapshot.val();
            const usersArray = Array.isArray(usersData)
              ? usersData
              : Object.values(usersData);

            const matchedUser = usersArray.find(
              (u: any) =>
                u && (u.username === username || u.id === firebaseUser.uid)
            );

            if (matchedUser) {
              // ── User ditemukan di Firebase ────────────────
              const userToSet = {
                ...matchedUser,
                id: matchedUser.id,
                password: "",
              };
              localStorage.setItem(
                "active_session_user",
                JSON.stringify(userToSet)
              );
              stampSession();
              setUser(userToSet);
            } else {
              // ── User tidak ditemukan di Firebase DB ───────
              // Ini berarti akun mungkin sudah dihapus admin.
              // Fallback ke localStorage lokal sebagai transisi,
              // tapi catat bahwa user tidak terverifikasi Firebase.
              const localUsers = db.getUsers(true);
              const localMatched = localUsers.find(
                (u) => u.id === firebaseUser.uid || u.username === username
              );

              if (localMatched) {
                // Ada di lokal, mungkin belum ter-sync Firebase. Izinkan sementara.
                const userToSet = {
                  ...localMatched,
                  id: localMatched.id,
                  password: "",
                };
                localStorage.setItem(
                  "active_session_user",
                  JSON.stringify(userToSet)
                );
                stampSession();
                setUser(userToSet);
              } else {
                // Tidak ada di mana pun — paksa logout demi keamanan
                console.warn(
                  "[AuthContext] User tidak ditemukan di Firebase maupun local DB. Memaksa logout."
                );
                clearSession();
                setUser(null);
              }
            }
          } else {
            // Firebase DB kosong — fallback ke localStorage lokal
            const localUsers = db.getUsers(true);
            const localMatched = localUsers.find(
              (u) => u.id === firebaseUser.uid || u.username === username
            );
            if (localMatched) {
              const userToSet = {
                ...localMatched,
                id: localMatched.id,
                password: "",
              };
              localStorage.setItem(
                "active_session_user",
                JSON.stringify(userToSet)
              );
              stampSession();
              setUser(userToSet);
            } else {
              restoreFallbackSession();
            }
          }
        } catch (err) {
          console.error("Error fetching user data from Firebase:", err);
          // Koneksi gagal — gunakan sesi lokal yang valid
          restoreFallbackSession();
        }
      } else {
        // ── Tidak ada Firebase user aktif ───────────────────
        // Coba restore dari localStorage (offline / mode lokal)
        restoreFallbackSession();
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimeout);
      unsubscribe();
    };
  }, []);

  const login = (u: User) => {
    // Simpan sesi + timestamp pembuatan
    clearSession(); // Reset timestamp lama
    localStorage.setItem("active_session_user", JSON.stringify(u));
    localStorage.setItem(SESSION_CREATED_AT_KEY, String(Date.now()));
    setUser(u);
    initializeFirebaseSync();
  };

  const logout = async () => {
    try {
      clearSession();
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Error signing out:", error);
      // Pastikan sesi lokal tetap terhapus meski Firebase gagal
      clearSession();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {loading ? (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex flex-col items-center justify-center p-6 space-y-5 font-sans animate-fade-in">
          <div className="relative w-16 h-16">
            {/* Outer ring spinner */}
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" />
            {/* Inner icon */}
            <div className="absolute inset-2 bg-white rounded-full shadow-lg flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 animate-pulse" />
            </div>
          </div>
          <div className="space-y-2 text-center max-w-xs w-full">
            <p className="text-sm font-bold text-slate-600">Memverifikasi sesi...</p>
            <div className="h-1.5 bg-indigo-100 rounded-full w-48 mx-auto overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
