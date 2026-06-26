import { CSSProperties } from 'react';

export type DashboardTemplateId = 'clean_light';

export interface DashboardTemplate {
  id: DashboardTemplateId;
  name: string;
  description: string;
  // Card Container Styles
  cardWrapper: string;      // Tailwind classes for the main stat cards
  cardIconWrapper: string;  // Tailwind classes for the icon background
  cardTitle: string;        // Tailwind classes for the title text
  cardValue: string;        // Tailwind classes for the main value text
  cardFooter: string;       // Tailwind classes for footer text
  // Grid layout
  gridClass: string;        // Tailwind classes for the main grid container
  // Main layout ordering
  chartsFirst: boolean;     // If true, render charts above stat cards
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id: 'clean_light',
    name: 'Clean Minimalist',
    description: 'Tampilan putih bersih, modern, dengan bayangan lembut',
    cardWrapper: 'bg-white rounded-[1.5rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col justify-between h-36 hover:-translate-y-1 transition-all relative group',
    cardIconWrapper: 'absolute top-4 right-4 p-3 bg-purple-50 text-purple-600 rounded-2xl group-hover:scale-110 group-hover:bg-purple-100 transition-all',
    cardTitle: 'text-[11px] font-bold text-gray-400 uppercase tracking-widest',
    cardValue: 'text-3xl font-black text-gray-800 leading-none mt-2',
    cardFooter: 'text-[10px] text-gray-400 mt-auto pt-2',
    gridClass: 'grid grid-cols-2 md:grid-cols-4 gap-5',
    chartsFirst: false,
  }
];


export function getSavedDashboardTemplateId(): DashboardTemplateId {
  return DASHBOARD_TEMPLATES[0].id;
}

export function saveDashboardTemplateId(id: DashboardTemplateId) {
  try {
    localStorage.setItem('dashboard_template_id', id);
    window.dispatchEvent(new Event('dashboard_template_changed'));
  } catch (e) {
    // ignore
  }
}

export function getDashboardTemplate(id: DashboardTemplateId): DashboardTemplate {
  return DASHBOARD_TEMPLATES[0];
}
