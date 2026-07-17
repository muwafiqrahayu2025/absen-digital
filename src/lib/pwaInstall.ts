import React from 'react';
import toast from 'react-hot-toast';

export const promptDesktopInstall = () => {
  toast.custom((t) => (
    React.createElement('div', { className: 'bg-slate-900 text-white p-6 rounded-3xl shadow-2xl max-w-md border border-indigo-500/50 space-y-4 z-50 animate-fade-in' },
      React.createElement('div', { className: 'flex items-center justify-between border-b border-slate-800 pb-3' },
        React.createElement('div', { className: 'flex items-center gap-2.5' },
          React.createElement('div', { className: 'w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-lg' }, '💻'),
          React.createElement('h4', { className: 'font-black text-sm text-white tracking-tight' }, 'Instal Software Desktop Asli')
        ),
        React.createElement('button', { onClick: () => toast.dismiss(t.id), className: 'text-slate-400 hover:text-white font-bold px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer text-xs' }, '✕ Tutup')
      ),
      
      React.createElement('p', { className: 'text-xs text-slate-300 leading-relaxed font-medium' },
        'Aplikasi ABDI kini tersedia sebagai software desktop sungguhan (Native Windows Executable .EXE) dengan tampilan antarmuka mandiri tanpa browser.'
      ),

      React.createElement('div', { className: 'bg-gradient-to-br from-slate-800/90 to-indigo-950/40 p-4 rounded-2xl border border-indigo-500/30 space-y-3 text-xs' },
        React.createElement('div', { className: 'flex items-center justify-between' },
          React.createElement('span', { className: 'text-slate-400 font-semibold' }, 'Paket Installer:'),
          React.createElement('span', { className: 'font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20' }, 'ABDI-Setup.exe')
        ),
        React.createElement('div', { className: 'flex items-center justify-between' },
          React.createElement('span', { className: 'text-slate-400 font-semibold' }, 'Tipe File:'),
          React.createElement('span', { className: 'font-bold text-white' }, 'Windows Executable (.EXE)')
        ),
        React.createElement('div', { className: 'flex items-center justify-between' },
          React.createElement('span', { className: 'text-slate-400 font-semibold' }, 'Sistem Operasi:'),
          React.createElement('span', { className: 'font-bold text-indigo-300' }, 'Windows 10 / 11 (x64)')
        )
      ),

      React.createElement('div', { className: 'space-y-2 pt-1' },
        React.createElement('a', {
          href: '/ABDI-Setup.exe',
          download: 'ABDI-Setup.exe',
          onClick: () => {
            toast.success('File ABDI-Setup.exe sedang diunduh!');
            toast.dismiss(t.id);
          },
          className: 'w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl text-xs font-black text-center text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer block hover:scale-[1.02]'
        }, '📥 Unduh Installer Desktop (.EXE)'),
        React.createElement('p', { className: 'text-[10px] text-center text-slate-400 italic' }, '⚡ Klik dua kali file .EXE yang terunduh untuk langsung menginstal dan membuka aplikasi ABDI di layar komputer Anda.')
      )
    )
  ), { duration: 15000 });
};
