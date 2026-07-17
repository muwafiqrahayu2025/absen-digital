import { useState, useEffect } from 'react';
import { getLicense, getDaysRemaining, isLicenseExpired, PLAN_CONFIG } from '../lib/license';
import { SchoolLicense } from '../types';

export function useLicense() {
  const [license, setLicenseState] = useState<SchoolLicense>(getLicense);

  useEffect(() => {
    const handleStorageChange = () => {
      setLicenseState(getLicense());
    };

    window.addEventListener('license_updated', handleStorageChange);
    return () => window.removeEventListener('license_updated', handleStorageChange);
  }, []);

  const config = PLAN_CONFIG[license.plan] || PLAN_CONFIG.trial;
  const isExpired = isLicenseExpired(license);
  const daysRemaining = getDaysRemaining(license);

  return {
    license,
    config,
    isExpired,
    daysRemaining,
  };
}
