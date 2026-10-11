import { useState, useEffect } from 'react';
import { getLicense, getDaysRemaining, isLicenseExpired, PLAN_CONFIG } from '../lib/license';
import { SchoolLicense } from '../types';
import { dbRealtime } from '../lib/firebase';
import { ref, onValue } from 'firebase/database';
import { useAuth } from '../components/AuthContext';

export function useLicense() {
  const [license, setLicenseState] = useState<SchoolLicense>(getLicense);

  // ── [BUG-007 FIX] Baca tenantId dari useAuth() bukan localStorage ────
  // Membaca dari context membuat tenantId reaktif: ketika developer berpindah
  // tenant, nilai ini berubah dan memicu re-run effect, sehingga listener
  // lama di-unsubscribe dan listener baru terpasang ke tenant yang benar.
  const { activeTenantId } = useAuth();

  useEffect(() => {
    // 1. Dengarkan perubahan dari event lokal (aktivasi lisensi via UI)
    const handleStorageChange = () => {
      setLicenseState(getLicense());
    };
    window.addEventListener('license_updated', handleStorageChange);

    // 2. Sinkronisasi dari Firebase RTDB secara realtime
    // ── [BUG-007 FIX] Gunakan activeTenantId dari context (reaktif) ────
    if (activeTenantId && activeTenantId !== 'GLOBAL') {
      const licenseRef = ref(dbRealtime, `tenants/${activeTenantId}/license`);
      const unsubscribe = onValue(licenseRef, (snapshot) => {
        if (snapshot.exists()) {
          const fbLicense = snapshot.val() as SchoolLicense;
          // Merge dengan lokal: Firebase lebih dipercaya
          const merged: SchoolLicense = {
            ...getLicense(),
            ...fbLicense,
          };
          // Simpan ke localStorage untuk akses offline
          try {
            localStorage.setItem('abdi_school_license', JSON.stringify(merged));
          } catch (_e) { }
          setLicenseState(merged);
        }
      }, (_error) => {
        // Jika gagal (offline / rule denied), tetap gunakan versi lokal
      });

      // ── [BUG-007 FIX] Cleanup SELALU dijalankan ────────────────────
      // Karena activeTenantId ada di dependency array, cleanup ini akan
      // dipanggil setiap kali tenantId berubah, mencegah listener ganda.
      return () => {
        window.removeEventListener('license_updated', handleStorageChange);
        unsubscribe();
      };
    }

    return () => window.removeEventListener('license_updated', handleStorageChange);
  // [BUG-007 FIX] activeTenantId masuk dependency array ─────────────────
  }, [activeTenantId]);


  const config = PLAN_CONFIG[license.plan] || PLAN_CONFIG.trial;
  const isExpired = isLicenseExpired(license);
  const daysRemaining = getDaysRemaining(license);

  // licenseConfig is an alias for config (used in Layout.tsx)
  const licenseConfig = config;

  return {
    license,
    config,
    licenseConfig,
    isExpired,
    daysRemaining,
  };
}
