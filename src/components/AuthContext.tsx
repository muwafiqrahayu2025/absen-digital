import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../types";
import { auth, dbRealtime } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get, child } from "firebase/database";
import { db } from "../lib/db";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (u: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user data from Realtime Database
        try {
          const dbRef = ref(dbRealtime);
          const snapshot = await get(child(dbRef, `users`));
          if (snapshot.exists()) {
            const usersData = snapshot.val();
            const usersArray = Array.isArray(usersData) ? usersData : Object.values(usersData);
            
            // Firebase user email is e.g. admin@madrasah.sch.id
            const username = firebaseUser.email?.split('@')[0] || '';
            const matchedUser = usersArray.find((u: any) => u && (u.username === username || u.id === firebaseUser.uid));
            
            if (matchedUser) {
              setUser({
                ...matchedUser,
                id: matchedUser.id, // Keep the original system ID for relations
                password: '', // We don't store passwords in context anymore
              });
            } else {
              // Fallback to local storage (handles race condition during password reset sync)
              const localUsers = db.getUsers();
              const localMatched = localUsers.find(u => u.id === firebaseUser.uid || u.username === username);
              if (localMatched) {
                setUser({
                  ...localMatched,
                  id: localMatched.id,
                  password: '',
                });
              } else {
                console.error("User document not found in Realtime DB array or local storage");
                setUser(null);
              }
            }
          } else {
            // Fallback to local storage if Realtime DB is empty
            const localUsers = db.getUsers();
            const username = firebaseUser.email?.split('@')[0] || '';
            const localMatched = localUsers.find(u => u.id === firebaseUser.uid || u.username === username);
            if (localMatched) {
              setUser({ ...localMatched, id: localMatched.id, password: '' });
            } else {
              console.error("No users found in Realtime DB or local storage");
              setUser(null);
            }
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = (u: User) => {
    // We keep this method for backward compatibility in components, 
    // but the real auth state is driven by onAuthStateChanged.
    setUser(u);
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
