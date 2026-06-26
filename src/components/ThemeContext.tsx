import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { type AppTheme, type ThemeId, getTheme, getSavedThemeId, saveThemeId } from '../lib/themes';

interface ThemeContextValue {
  theme: AppTheme;
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(() => getSavedThemeId());

  const setTheme = useCallback((id: ThemeId) => {
    setThemeId(id);
    saveThemeId(id);
  }, []);

  // Listen to cross-tab changes
  useEffect(() => {
    const handler = () => {
      setThemeId(getSavedThemeId());
    };
    window.addEventListener('theme_changed', handler);
    return () => window.removeEventListener('theme_changed', handler);
  }, []);

  const theme = getTheme(themeId);

  return (
    <ThemeContext.Provider value={{ theme, themeId, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
