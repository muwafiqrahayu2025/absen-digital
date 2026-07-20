import { useState, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { dbRealtime } from '../lib/firebase';

export interface GlobalSettings {
  wa_fallback_enabled: boolean;
  demo_video_url?: string;
}

export function useGlobalSettings() {
  const [settings, setSettings] = useState<GlobalSettings>({
    wa_fallback_enabled: true, // Default true
    demo_video_url: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const settingsRef = ref(dbRealtime, 'global_settings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setSettings({
          wa_fallback_enabled: data.wa_fallback_enabled !== undefined ? data.wa_fallback_enabled : true,
          demo_video_url: data.demo_video_url || ''
        });
      } else {
        // If not exists, write the default value
        set(ref(dbRealtime, 'global_settings'), { wa_fallback_enabled: true, demo_video_url: '' }).catch(console.error);
        setSettings({ wa_fallback_enabled: true, demo_video_url: '' });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateSettings = async (newSettings: Partial<GlobalSettings>) => {
    try {
      await set(ref(dbRealtime, 'global_settings'), {
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
