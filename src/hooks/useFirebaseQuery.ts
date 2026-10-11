import { useState, useEffect } from "react";
import { ref, onValue, off, query, orderByChild, equalTo, limitToLast, limitToFirst, startAt, endAt, QueryConstraint } from "firebase/database";
import { dbRealtime } from "../lib/firebase";
import { useAuth } from "../components/AuthContext";

export interface QueryParam {
  orderByChild?: string;
  equalTo?: string | number | boolean | null;
  limitToLast?: number;
  limitToFirst?: number;
  startAt?: string | number | boolean | null;
  endAt?: string | number | boolean | null;
}

export function useFirebaseQuery<T>(path: string, queryParams?: QueryParam, defaultValue: T | null = null) {
  const [data, setData] = useState<T | null>(defaultValue);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const { activeTenantId } = useAuth();

  // Convert to string to avoid infinite re-renders if passed as a new object literal each time
  const queryParamsString = JSON.stringify(queryParams || {});

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

    const dataRef = ref(dbRealtime, actualPath);
    
    // Construct query constraints
    const constraints: QueryConstraint[] = [];
    const parsedParams: QueryParam = JSON.parse(queryParamsString);
    
    if (parsedParams.orderByChild) {
      constraints.push(orderByChild(parsedParams.orderByChild));
      
      if (parsedParams.equalTo !== undefined) {
        constraints.push(equalTo(parsedParams.equalTo));
      }
      if (parsedParams.startAt !== undefined) {
        constraints.push(startAt(parsedParams.startAt));
      }
      if (parsedParams.endAt !== undefined) {
        constraints.push(endAt(parsedParams.endAt));
      }
    }
    
    if (parsedParams.limitToLast !== undefined) {
      constraints.push(limitToLast(parsedParams.limitToLast));
    }
    if (parsedParams.limitToFirst !== undefined) {
      constraints.push(limitToFirst(parsedParams.limitToFirst));
    }

    const finalQuery = constraints.length > 0 ? query(dataRef, ...constraints) : dataRef;

    const unsubscribe = onValue(finalQuery, (snapshot) => {
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
      console.error(`Firebase query failed for path ${actualPath}:`, error);
      setLoading(false);
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      off(finalQuery, "value", unsubscribe);
    };
  }, [path, activeTenantId, queryParamsString]);

  return { data, loading, isOffline };
}
