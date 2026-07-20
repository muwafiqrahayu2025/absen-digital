import { useState, useEffect } from "react";
import { ref, onValue, off } from "firebase/database";
import { dbRealtime } from "../lib/firebase";
import { useAuth } from "../components/AuthContext";

export function useFirebaseData<T>(path: string, defaultValue: T | null = null) {
  const [data, setData] = useState<T | null>(defaultValue);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const { activeTenantId } = useAuth();

  useEffect(() => {
    // Handle offline status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Jangan coba fetch jika tidak ada activeTenantId tapi diperlukan
    if (!activeTenantId && path !== 'global_users' && path !== 'global_admins' && !path.startsWith('user_tenant_mapping')) {
       setLoading(false);
       return;
    }

    let actualPath = path;
    if (activeTenantId && activeTenantId !== 'GLOBAL' && !path.startsWith('user_tenant_mapping') && !path.startsWith('global_')) {
      actualPath = `tenants/${activeTenantId}/${path}`;
    }

    // Fetch data from Firebase
    const dataRef = ref(dbRealtime, actualPath);
    const unsubscribe = onValue(dataRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        
        // Normalize Firebase objects to arrays for collections
        if (typeof val === 'object' && val !== null && path !== 'school' && !Array.isArray(val)) {
             setData(Object.values(val) as any);
        } else {
             setData(val);
        }
      } else {
        setData(defaultValue);
      }
      setLoading(false);
    }, (error) => {
      console.error(`Firebase read failed for path ${actualPath}:`, error);
      setLoading(false);
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      off(dataRef, "value", unsubscribe);
    };
  }, [path, activeTenantId]);

  return { data, loading, isOffline };
}
