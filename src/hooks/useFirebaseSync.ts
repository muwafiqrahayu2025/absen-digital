import { useEffect } from 'react';
import { initializeFirebaseSync } from '../lib/firebaseSync';
import { startQrSecurityCronJob } from '../lib/qrScheduler';

export function useFirebaseSync() {
  useEffect(() => {
    initializeFirebaseSync();
    const stopCron = startQrSecurityCronJob();
    return () => stopCron();
  }, []);
}

