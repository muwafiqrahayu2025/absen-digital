import React, { useState, useEffect } from 'react';
import { Minus, Maximize, Minimize, X } from 'lucide-react';
import toast from 'react-hot-toast';

export function WindowControls() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!document.fullscreenElement ||
        !!(document as any).webkitFullscreenElement
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleMaximize = () => {
    const elem = document.documentElement as any;
    if (!isFullscreen) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch((err: any) => console.error(err));
      } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
      } else {
        toast.error("Browser tidak mendukung mode Fullscreen");
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err: any) => console.error(err));
      } else if ((document as any).webkitExitFullscreen) { /* Safari */
        (document as any).webkitExitFullscreen();
      }
    }
  };

  const handleMinimize = () => {
    if (isFullscreen) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    } else {
      toast('Aplikasi disembunyikan. (Gunakan tombol home/recent apps perangkat Anda)', { icon: '⬇️', duration: 4000 });
    }
  };

  const handleClose = () => {
    if (isFullscreen) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
    const confirmExit = window.confirm("Apakah Anda yakin ingin keluar dari aplikasi portal?");
    if (confirmExit) {
      toast.success("Silakan tutup tab browser atau aplikasi Anda.");
      try {
        window.close();
      } catch (e) {
        console.warn("window.close() is prevented by the browser");
      }
    }
  };

  return (
    <div className="fixed top-0 left-0 w-full h-8 bg-[#0b3b87] text-blue-100 px-3 flex items-center justify-between shrink-0 z-[100] border-b border-blue-900/50 shadow-sm">
      {/* Fake window buttons (macOS style decoration) */}
      <div className="flex items-center gap-1.5 opacity-60">
        <div className="w-2.5 h-2.5 rounded-full bg-rose-400 border border-rose-500/50"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-500/50"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-emerald-500/50"></div>
      </div>
      
      {/* Title */}
      <div className="absolute left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-wider text-blue-200/80 uppercase pointer-events-none">
        Portal Guru / Staf
      </div>

      {/* Actual Controls (Windows/Desktop style) */}
      <div className="flex items-center gap-1">
        <button 
          onClick={handleMinimize} 
          className="hover:text-white hover:bg-white/10 p-1.5 rounded transition-colors flex items-center justify-center cursor-pointer" 
          title="Minimize"
        >
          <Minus size={14} strokeWidth={2.5} />
        </button>
        <button 
          onClick={handleMaximize} 
          className="hover:text-white hover:bg-white/10 p-1.5 rounded transition-colors flex items-center justify-center cursor-pointer" 
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize size={13} strokeWidth={2.5} /> : <Maximize size={13} strokeWidth={2.5} />}
        </button>
        <button 
          onClick={handleClose} 
          className="hover:text-white hover:bg-rose-500 p-1.5 rounded transition-colors flex items-center justify-center cursor-pointer" 
          title="Close"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
