import React from 'react';

export function FooterSection() {
  return (
    <footer className="py-10 sm:py-12 px-6 border-t border-slate-200 text-center text-xs text-slate-500 space-y-6 bg-white">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
        <img src="/logo-abdi.png" alt="Logo" className="w-5 h-5 sm:w-6 sm:h-6 object-contain grayscale opacity-60" />
        <span className="font-black text-slate-700 tracking-wider text-[10px] sm:text-xs">Sistem Presensi Resmi ABDI Terpadu</span>
      </div>
      <p className="font-medium text-[9px] sm:text-[10px]">&copy; 2026 Hak Cipta Dilindungi Undang-Undang.</p>
    </footer>
  );
}
