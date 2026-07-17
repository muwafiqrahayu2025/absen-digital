import React from 'react';
import { Home, Scan, FileText, Award, Clock, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';

export function MobileBottomNav() {
  const location = useLocation();

  // Parse tab from search params or use path
  const params = new URLSearchParams(location.search);
  const currentTab = params.get('tab') || 'home';
  const isProfile = location.pathname.includes('/profile');
  const isScan = location.pathname.includes('/teacher/scan');
  
  const activeTab = isProfile ? 'profil' : isScan ? 'scan' : currentTab;

  const navItems = [
    { id: 'home', label: 'Beranda', icon: <Home size={20} />, to: '/?tab=home' },
    { id: 'scan', label: 'Presensi', icon: <Scan size={20} />, to: '/teacher/scan' },
    { id: 'cuti', label: 'Izin/Cuti', icon: <FileText size={20} />, to: '/?tab=cuti' },
    { id: 'kinerja', label: 'Kinerja', icon: <Award size={20} />, to: '/?tab=kinerja' },
    { id: 'riwayat', label: 'Riwayat', icon: <Clock size={20} />, to: '/?tab=riwayat' },
    { id: 'profil', label: 'Profil', icon: <User size={20} />, to: '/profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 flex items-center justify-between z-50 md:hidden pb-safe">
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <Link
            key={item.id}
            to={item.to}
            className={cn(
              "flex flex-col items-center justify-center w-full py-1 rounded-xl transition-all",
              isActive ? "text-indigo-600 font-bold" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <div className={cn(
              "p-1 rounded-full mb-1 transition-all",
              isActive ? "bg-indigo-100/50" : ""
            )}>
              {item.icon}
            </div>
            <span className="text-[10px] truncate leading-none">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
