import React from 'react';
import { useEditMode } from './EditModeContext';
import { Save, XCircle, RefreshCw } from 'lucide-react';

export const FloatingEditTools = () => {
  const { isEditMode, toggleEditMode, saveEdits, resetToFactory } = useEditMode();

  if (!isEditMode) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-slate-700/50 animate-bounce-short">
      <div className="flex items-center gap-2 px-3 border-r border-slate-700">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm font-bold text-white tracking-wide">EDIT MODE</span>
      </div>
      
      <button
        onClick={saveEdits}
        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
      >
        <Save size={16} />
        <span>Simpan Konten</span>
      </button>

      <button
        onClick={resetToFactory}
        className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
        title="Kembalikan semua teks, posisi, tema, dan logo ke pengaturan awal pabrik"
      >
        <RefreshCw size={16} />
        <span>Reset Pabrik</span>
      </button>

      <button
        onClick={toggleEditMode}
        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
      >
        <XCircle size={16} />
        <span>Tutup</span>
      </button>
    </div>
  );
};
