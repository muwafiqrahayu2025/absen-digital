import type { CSSProperties } from 'react';

export type ThemeId = 'clean_light';

export interface AppTheme {
  id: ThemeId;
  name: string;
  description: string;
  emoji: string;
  category: string;
  // Warna utama
  primary: string;    // Warna latar utama (hex)
  secondary: string;  // Warna sekunder (hex)
  accent: string;     // Aksen / highlight (hex)
  // Login page
  loginBg: string;
  loginBgStyle?: CSSProperties;
  loginCard: string;
  loginBorderColor: string;
  loginText: string;
  loginSubText: string;
  loginAccent: string; // hex untuk inline style
  loginGlow: string;
  // Sidebar
  sidebarBg: string;
  sidebarText: string;
  sidebarSubText: string;
  sidebarBorderColor: string;
  // Main content
  mainBg: string;
  headerBg: string;
  primaryColor: string; // Tailwind text class for headings
  primaryHex: string;
}

export const THEMES: AppTheme[] = [
  {
    id: 'clean_light',
    name: 'Clean Light',
    description: 'Tampilan bersih, modern, dan minimalis',
    emoji: '✨',
    category: 'Light Theme',
    primary: '#ffffff',
    secondary: '#f3f4f6',
    accent: '#8C43F6',
    loginBg: 'bg-gray-50',
    loginCard: 'bg-white shadow-2xl border border-gray-100',
    loginBorderColor: '#e5e7eb',
    loginText: 'text-gray-800',
    loginSubText: 'text-gray-500',
    loginAccent: '#8C43F6',
    loginGlow: 'none',
    sidebarBg: 'bg-white border-r border-gray-200',
    sidebarText: 'text-gray-700',
    sidebarSubText: 'text-gray-500',
    sidebarBorderColor: '#e5e7eb',
    mainBg: 'bg-gray-50',
    headerBg: 'bg-white/90 backdrop-blur-md border-b border-gray-200',
    primaryColor: 'text-[#8C43F6]',
    primaryHex: '#8C43F6',
  }
];

export function getSavedThemeId(): ThemeId {
  return THEMES[0].id;
}

export function saveThemeId(id: ThemeId) {
  try {
    localStorage.setItem('app_theme_id', id);
  } catch (e) {
    // ignore
  }
}

export function getTheme(id: ThemeId): AppTheme {
  return THEMES[0];
}
