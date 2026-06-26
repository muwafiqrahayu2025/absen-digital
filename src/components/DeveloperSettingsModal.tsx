import React from 'react';
import { useEditMode } from './EditModeContext';
import { X, Upload, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface DeveloperSettingsModalProps {
  onClose: () => void;
}

const THEME_OPTIONS = [
  { id: 'indigo', name: 'Ungu (Indigo)', class: 'bg-indigo-500' },
  { id: 'emerald', name: 'Hijau (Emerald)', class: 'bg-emerald-500' },
  { id: 'rose', name: 'Merah Muda (Rose)', class: 'bg-rose-500' },
  { id: 'sky', name: 'Biru (Sky)', class: 'bg-sky-500' },
];

export const DeveloperSettingsModal: React.FC<DeveloperSettingsModalProps> = ({ onClose }) => {
  const { colorTheme, setColorTheme, customLogo, setCustomLogo, customLoginBg, setCustomLoginBg } = useEditMode();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      toast.error('Ukuran gambar maksimal 2MB!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setter(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Pengaturan Tema & Logo</h2>
            <p className="text-sm text-slate-500">Sesuaikan tampilan aplikasi (CMS)</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          
          {/* Theme Selection */}
          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Warna Utama (Tema)</h3>
            <div className="grid grid-cols-2 gap-3">
              {THEME_OPTIONS.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => setColorTheme(theme.id)}
                  className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    colorTheme === theme.id 
                      ? 'border-indigo-500 bg-indigo-50/50' 
                      : 'border-slate-100 hover:border-slate-200 bg-white'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full shadow-sm ${theme.class}`} />
                  <span className="font-semibold text-sm text-slate-700">{theme.name}</span>
                  {colorTheme === theme.id && (
                    <CheckCircle2 size={18} className="text-indigo-500 absolute right-3" />
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">Pilih warna utama untuk tombol, garis, dan gradien di seluruh aplikasi.</p>
          </section>

          {/* Logo Upload */}
          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Logo Sekolah/Aplikasi</h3>
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                {customLogo ? (
                  <img src={customLogo} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <ImageIcon className="text-slate-300" size={32} />
                )}
              </div>
              <div className="flex-1">
                <label className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 text-sm font-semibold text-slate-600 transition-colors cursor-pointer">
                  <Upload size={16} />
                  <span>Unggah Logo (Maks 2MB)</span>
                  <input 
                    type="file" 
                    accept="image/png, image/jpeg, image/svg+xml" 
                    className="hidden" 
                    onChange={(e) => handleImageUpload(e, setCustomLogo)}
                  />
                </label>
                {customLogo && (
                  <button onClick={() => setCustomLogo('')} className="text-xs text-red-500 mt-2 hover:underline font-medium">
                    Hapus Logo Kustom (Gunakan Bawaan)
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Login Background Upload */}
          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Latar Belakang Halaman Login</h3>
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                {customLoginBg ? (
                  <img src={customLoginBg} alt="Background" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="text-slate-300" size={32} />
                )}
              </div>
              <div className="flex-1">
                <label className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 text-sm font-semibold text-slate-600 transition-colors cursor-pointer">
                  <Upload size={16} />
                  <span>Unggah Gambar (Maks 2MB)</span>
                  <input 
                    type="file" 
                    accept="image/png, image/jpeg, image/webp" 
                    className="hidden" 
                    onChange={(e) => handleImageUpload(e, setCustomLoginBg)}
                  />
                </label>
                {customLoginBg && (
                  <button onClick={() => setCustomLoginBg('')} className="text-xs text-red-500 mt-2 hover:underline font-medium">
                    Hapus Latar Kustom (Gunakan Bawaan)
                  </button>
                )}
              </div>
            </div>
          </section>

        </div>
        <div className="p-5 border-t border-slate-100 bg-slate-50">
          <p className="text-xs text-center text-slate-500 font-medium">Jangan lupa klik tombol "Simpan" di Header setelah selesai mengubah pengaturan.</p>
        </div>
      </div>
    </div>
  );
};
