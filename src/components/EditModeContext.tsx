import React, { createContext, useContext, useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Preferences } from '@capacitor/preferences';

interface EditModeContextType {
  isEditMode: boolean;
  toggleEditMode: () => void;
  saveEdits: () => void;
  getContent: (key: string, defaultValue: string) => string;
  setContent: (key: string, value: string) => void;
  
  // Theme & Images
  colorTheme: string;
  setColorTheme: (theme: string) => void;
  customLogo: string;
  setCustomLogo: (base64: string) => void;
  customLoginBg: string;
  setCustomLoginBg: (base64: string) => void;

  // Drag & Drop Layout
  layoutStore: Record<string, { x: number, y: number }>;
  setLayout: (id: string, position: { x: number, y: number }) => void;

  resetToFactory: () => Promise<void>;
}

const EditModeContext = createContext<EditModeContextType>({
  isEditMode: false,
  toggleEditMode: () => {},
  saveEdits: () => {},
  getContent: (k, d) => d,
  setContent: () => {},
  resetToFactory: async () => {},
  colorTheme: 'indigo',
  setColorTheme: () => {},
  customLogo: '',
  setCustomLogo: () => {},
  customLoginBg: '',
  setCustomLoginBg: () => {},
  layoutStore: {},
  setLayout: () => {},
});

export const useEditMode = () => useContext(EditModeContext);

export const EditModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isEditMode, setIsEditMode] = useState(() => {
    return sessionStorage.getItem('dev_edit_mode') === 'true';
  });
  const [contentStore, setContentStore] = useState<Record<string, string>>({});
  const [colorTheme, setColorThemeState] = useState('indigo');
  const [customLogo, setCustomLogoState] = useState('');
  const [customLoginBg, setCustomLoginBgState] = useState('');
  const [layoutStore, setLayoutStore] = useState<Record<string, { x: number, y: number }>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const { value: contentVal } = await Preferences.get({ key: "custom_app_content" });
        const { value: configVal } = await Preferences.get({ key: "custom_app_config" });
        const { value: layoutVal } = await Preferences.get({ key: "custom_app_layout" });
        
        if (contentVal) {
          setContentStore(JSON.parse(contentVal));
        } else {
          // Fallback migrate from localStorage
          const oldMenuTitles = JSON.parse(localStorage.getItem("customMenuTitles") || "{}");
          const storedContent = JSON.parse(localStorage.getItem("custom_app_content") || "{}");
          const mergedContent = { ...oldMenuTitles, ...storedContent };
          setContentStore(mergedContent);
          await Preferences.set({ key: "custom_app_content", value: JSON.stringify(mergedContent) });
        }
        
        if (configVal) {
          const config = JSON.parse(configVal);
          if (config.colorTheme) setColorThemeState(config.colorTheme);
          if (config.customLogo) setCustomLogoState(config.customLogo);
          if (config.customLoginBg) setCustomLoginBgState(config.customLoginBg);
        } else {
          // Fallback migrate
          const config = JSON.parse(localStorage.getItem("custom_app_config") || "{}");
          if (config.colorTheme) setColorThemeState(config.colorTheme);
          if (config.customLogo) setCustomLogoState(config.customLogo);
          if (config.customLoginBg) setCustomLoginBgState(config.customLoginBg);
          await Preferences.set({ key: "custom_app_config", value: JSON.stringify(config) });
        }
        if (layoutVal) {
          setLayoutStore(JSON.parse(layoutVal));
        }

      } catch (e) {}
    };
    loadData();
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorTheme);
  }, [colorTheme]);

  const toggleEditMode = () => {
    setIsEditMode((prev) => {
      const newVal = !prev;
      sessionStorage.setItem('dev_edit_mode', newVal.toString());
      return newVal;
    });
  };

  const saveEdits = async () => {
    try {
      await Preferences.set({ key: "custom_app_content", value: JSON.stringify(contentStore) });
      await Preferences.set({ key: "custom_app_config", value: JSON.stringify({
        colorTheme, customLogo, customLoginBg
      })});
      await Preferences.set({ key: "custom_app_layout", value: JSON.stringify(layoutStore) });
      toast.success("Semua perubahan konten, posisi & pengaturan berhasil disimpan!");
      setIsEditMode(false);
    } catch (e) {
      toast.error("Gagal menyimpan ke memori aman.");
    }
  };

  const resetToFactory = async () => {
    if (!window.confirm("Apakah Anda yakin ingin mengatur ulang semua tampilan, teks, posisi elemen, gambar, dan tema ke pengaturan bawaan pabrik?")) return;
    
    try {
      // Clear preferences
      await Preferences.remove({ key: "custom_app_content" });
      await Preferences.remove({ key: "custom_app_config" });
      await Preferences.remove({ key: "custom_app_layout" });
      
      // Reset States
      setContentStore({});
      setColorThemeState('indigo');
      setCustomLogoState('');
      setCustomLoginBgState('');
      setLayoutStore({});
      
      toast.success("Tampilan berhasil direset ke pengaturan pabrik!");
      setIsEditMode(false);
      
      // Delay slightly then reload to clear all cached UI states
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e) {
      toast.error("Gagal melakukan reset pabrik.");
    }
  };

  const getContent = (key: string, defaultValue: string) => {
    return contentStore[key] || defaultValue;
  };

  const setContent = (key: string, value: string) => {
    setContentStore((prev) => ({ ...prev, [key]: value }));
  };

  const setColorTheme = (theme: string) => setColorThemeState(theme);
  const setCustomLogo = (base64: string) => setCustomLogoState(base64);
  const setCustomLoginBg = (base64: string) => setCustomLoginBgState(base64);

  const setLayout = (id: string, position: { x: number, y: number }) => {
    setLayoutStore(prev => ({ ...prev, [id]: position }));
  };

  return (
    <EditModeContext.Provider value={{ 
      isEditMode, toggleEditMode, saveEdits, resetToFactory,
      getContent, setContent,
      colorTheme, setColorTheme,
      customLogo, setCustomLogo,
      customLoginBg, setCustomLoginBg,
      layoutStore, setLayout
    }}>
      {children}
    </EditModeContext.Provider>
  );
};
