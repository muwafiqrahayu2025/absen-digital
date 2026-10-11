import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export function PageLoader() {
  const [show, setShow] = useState(false);

  // Mencegah flicker (kedipan) jika halaman diunduh sangat cepat (di bawah 150ms).
  // Hanya tampilkan loading jika proses memakan waktu lebih dari 150ms.
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 150);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center animate-fade-in">
      <div className="relative flex flex-col items-center">
        {/* Lingkaran luar berputar */}
        <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin absolute" />
        
        {/* Lingkaran dalam berputar lambat berlawanan arah */}
        <div className="w-12 h-12 mt-2 rounded-full border-4 border-rose-100 border-b-rose-500 animate-[spin_1.5s_linear_reverse] absolute" />
        
        {/* Ikon Statis Tengah */}
        <div className="w-16 h-16 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-indigo-700 animate-pulse" />
        </div>
      </div>
      
      <p className="mt-8 text-sm font-semibold text-slate-500 tracking-widest animate-pulse uppercase">
        Memuat
      </p>
    </div>
  );
}
