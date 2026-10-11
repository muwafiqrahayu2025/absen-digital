import { useState, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { dbRealtime } from '../lib/firebase';

export interface GlobalSettings {
  waFallbackEnabled: boolean;
  platformName?: string;
  isMaintenance?: boolean;
  maxTenants?: number;
}

export function useGlobalSettings() {
  const [settings, setSettings] = useState<GlobalSettings>({
    waFallbackEnabled: true,
    platformName: "Absen Digital SaaS",
    isMaintenance: false,
    maxTenants: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const settingsRef = ref(dbRealtime, 'global_settings/config');

    // ── [BUG-006 FIX] Safety timeout sebagai jaring pengaman terakhir ──
    // Jika Firebase tidak merespons sama sekali (extreme offline / token issue),
    // paksa loading=false setelah 5 detik agar ProtectedRoute tidak render
    // null selamanya (White Screen of Death).
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const unsubscribe = onValue(
      settingsRef,
      (snapshot) => {
        clearTimeout(safetyTimeout); // Firebase merespons — batalkan timeout
        if (snapshot.exists()) {
          const data = snapshot.val();
          setSettings({
            waFallbackEnabled: data.waFallbackEnabled !== undefined ? data.waFallbackEnabled : true,
            platformName: data.platformName || "Absen Digital SaaS",
            isMaintenance: data.isMaintenance || false,
            maxTenants: data.maxTenants !== undefined ? data.maxTenants : 0
          });
        } else {
          // Fallback to default
          setSettings({ waFallbackEnabled: true, platformName: "Absen Digital SaaS", isMaintenance: false, maxTenants: 0 });
        }
        setLoading(false);
      },
      // ── [BUG-006 FIX] Error callback — cegah stuck loading ────────────
      // Tanpa ini, PERMISSION_DENIED atau network error menyebabkan 'loading'
      // tidak pernah di-set false, menghasilkan White Screen of Death.
      (error) => {
        clearTimeout(safetyTimeout);
        console.warn('[useGlobalSettings] Firebase error (mungkin offline/token expired), menggunakan default settings:', error.message);
        // Gunakan default settings — aplikasi tetap bisa berjalan
        setSettings({ waFallbackEnabled: true, platformName: "Absen Digital SaaS", isMaintenance: false, maxTenants: 0 });
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(safetyTimeout);
      unsubscribe();
    };
  }, []);

  const updateSettings = async (newSettings: Partial<GlobalSettings>) => {
    try {
      await set(ref(dbRealtime, 'global_settings/config'), {
        ...settings,
        ...newSettings
      });
      return true;
    } catch (error) {
      console.error("Failed to update global settings:", error);
      return false;
    }
  };

  return { settings, loading, updateSettings };
}
