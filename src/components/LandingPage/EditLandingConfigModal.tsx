import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface EditLandingConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  landingConfig: any;
  setLandingConfig: (config: any) => void;
}

export function EditLandingConfigModal({ isOpen, onClose, landingConfig, setLandingConfig }: EditLandingConfigModalProps) {
  const [editLandingForm, setEditLandingForm] = useState(landingConfig);

  useEffect(() => {
    setEditLandingForm(landingConfig);
  }, [landingConfig]);

  const handleSaveLandingConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setLandingConfig(editLandingForm);
    localStorage.setItem('abdi_landing_config', JSON.stringify(editLandingForm));
    onClose();
    toast.success("✨ Konfigurasi Landing Page berhasil disimpan!");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-8 shadow-2xl border border-slate-200 space-y-4 sm:space-y-6 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 sm:pb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 font-black text-base sm:text-lg shadow-md">🛠️</div>
            <div>
              <h3 className="font-black text-sm sm:text-lg text-slate-900 leading-tight">Pengaturan Laman Promosi</h3>
              <p className="text-[9px] sm:text-xs text-slate-500 font-medium">Batas Ruang Khusus Pengembang</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
            <X size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
        </div>

        <form onSubmit={handleSaveLandingConfig} className="space-y-3 sm:space-y-4 max-h-[65vh] overflow-y-auto pr-2 text-left text-[11px] sm:text-xs font-bold custom-scrollbar">
          <div>
            <label className="block mb-1 sm:mb-1.5 text-slate-700">Teks Pita Promosi Atas (Promo Bar)</label>
            <input type="text" value={editLandingForm.promoBar || ''} onChange={e => setEditLandingForm({ ...editLandingForm, promoBar: e.target.value })} className="w-full px-3 sm:px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none font-medium text-slate-800" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 sm:mb-1.5 text-slate-700">Gagasan Slogan Netral (Hitam)</label>
              <input type="text" value={editLandingForm.heroTitleText || ''} onChange={e => setEditLandingForm({ ...editLandingForm, heroTitleText: e.target.value })} className="w-full px-3 sm:px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none font-medium text-slate-800" />
            </div>
            <div>
              <label className="block mb-1 sm:mb-1.5 text-slate-700">Penegasan Kata Kunci (Gradasi Bersinar)</label>
              <input type="text" value={editLandingForm.heroTitleHighlight || ''} onChange={e => setEditLandingForm({ ...editLandingForm, heroTitleHighlight: e.target.value })} className="w-full px-3 sm:px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none font-medium text-slate-800" />
            </div>
          </div>

          <div>
            <label className="block mb-1 sm:mb-1.5 text-slate-700">Ringkasan Deskripsi Teks Bawah Judul</label>
            <textarea rows={3} value={editLandingForm.heroSubtitle || ''} onChange={e => setEditLandingForm({ ...editLandingForm, heroSubtitle: e.target.value })} className="w-full px-3 sm:px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none font-medium text-slate-800 custom-scrollbar" />
          </div>

          <div className="border-t border-slate-200 pt-3">
            <h4 className="text-slate-800 font-black text-sm mb-2">Penyesuaian Konfigurasi Kontak</h4>
          </div>

          <div>
            <label className="block mb-1 sm:mb-1.5 text-slate-700">Nomor WhatsApp Pusat Bantuan (Format Tanpa '+' Awal)</label>
            <input type="text" value={editLandingForm.waHelpdesk || ''} onChange={e => setEditLandingForm({ ...editLandingForm, waHelpdesk: e.target.value })} placeholder="Contoh: 6282297585638" className="w-full px-3 sm:px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 outline-none font-medium text-slate-800" />
          </div>

          <div className="pt-2 sm:pt-3 flex gap-2 sm:gap-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 sm:py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black transition-all">Batal</button>
            <button type="submit" className="flex-1 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-black shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-1.5">💾 Simpan Perubahan</button>
          </div>
        </form>
      </div>
    </div>
  );
}
