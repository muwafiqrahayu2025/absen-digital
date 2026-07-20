import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types";
import { auth, dbRealtime } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get, child } from "firebase/database";
import { initializeFirebaseSync } from "../lib/firebaseSync";

// ─── Konstanta Keamanan Sesi ─────────────────────────────────
/** Durasi maksimum sesi aktif: 7 hari dalam milidetik */
const MAX_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_CREATED_AT_KEY = "abdi_session_created_at";

function isSessionExpired(): boolean {
  const createdAt = localStorage.getItem(SESSION_CREATED_AT_KEY);
  if (!createdAt) return false;
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
  activeTenantId: string | null;
  setActiveTenantId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [activeTenantId, setActiveTenantId] = useState<string | null>(() => {
    return localStorage.getItem("abdi_active_tenant_id") || null;
  });

  const [user, setUser] = useState<User | null>(() => {
    if (isSessionExpired()) {
      clearSession();
      return null;
    }
    const activeStored = localStorage.getItem("active_session_user");
    if (activeStored) {
      try {
        const parsed = JSON.parse(activeStored);
        if (parsed && (parsed.id || parsed.username)) return parsed;
      } catch (e) {
        console.error("Error parsing initial session:", e);
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(() => !localStorage.getItem("active_session_user"));

  useEffect(() => {
    if (user?.tenantId && user.tenantId !== 'GLOBAL') {
      setActiveTenantId(user.tenantId);
      localStorage.setItem("abdi_active_tenant_id", user.tenantId);
    } else if (!user) {
      setActiveTenantId(null);
      localStorage.removeItem("abdi_active_tenant_id");
    }
  }, [user]);

  useEffect(() => {
    const restoreFallbackSession = () => {
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
            setUser(parsed);
            return true;
          }
        } catch (e) { }
      }
      clearSession();
      setUser(null);
      return false;
    };

    const safetyTimeout = setTimeout(() => setLoading(false), 2000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const tenantSnapshot = await get(child(ref(dbRealtime), `user_tenant_mapping/${firebaseUser.uid}`));
          
          if (tenantSnapshot.exists()) {
            const tenantId = tenantSnapshot.val();
            let userSnapshot;

            if (tenantId === 'GLOBAL') {
              userSnapshot = await get(child(ref(dbRealtime), `global_users/${firebaseUser.uid}`));
            } else {
              userSnapshot = await get(child(ref(dbRealtime), `tenants/${tenantId}/users/${firebaseUser.uid}`));
            }

            if (userSnapshot && userSnapshot.exists()) {
              const matchedUser = userSnapshot.val();
              const userToSet = { ...matchedUser, id: matchedUser.id, password: "", tenantId };
              localStorage.setItem("active_session_user", JSON.stringify(userToSet));
              stampSession();
              setUser(userToSet);
            } else {
              console.warn("[AuthContext] Profil tidak ditemukan di dalam tenant. Memaksa logout.");
              clearSession();
              setUser(null);
            }
          } else {
            console.warn("[AuthContext] Mapping Tenant tidak ditemukan.");
            clearSession();
            setUser(null);
          }
        } catch (err) {
          console.error("Error fetching user data from Firebase:", err);
          restoreFallbackSession();
        }
      } else {
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
    clearSession();
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
      clearSession();
      setUser(null);
    }
  };

  const setActiveTenantIdHandler = (id: string | null) => {
    setActiveTenantId(id);
    if (id) {
      localStorage.setItem("abdi_active_tenant_id", id);
    } else {
      localStorage.removeItem("abdi_active_tenant_id");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, activeTenantId, setActiveTenantId: setActiveTenantIdHandler }}>
      {loading ? (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex flex-col items-center justify-center p-6 space-y-5 font-sans animate-fade-in">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" />
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
      ) : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
