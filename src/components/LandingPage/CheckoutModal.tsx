import React, { useState } from 'react';
import { X, Receipt, Clock, CreditCard, QrCode, ArrowRight, ShieldCheck, CheckCircle2, UploadCloud, MessageCircle, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  landingConfig: any;
}

export function CheckoutModal({ isOpen, onClose, landingConfig }: CheckoutModalProps) {
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1);
  const [checkoutForm, setCheckoutForm] = useState({
    name: '', school: '', email: '', wa: '', amount: '150000', method: 'BCA_VA'
  });
  const [orderId, setOrderId] = useState('');
  const [paymentProof, setPaymentProof] = useState<string | null>(null);

  const generateOrderId = () => {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    const randomStr = Math.floor(1000 + Math.random() * 9000);
    return `INV-${dateStr}-${randomStr}`;
  };

  const handleCheckoutProcess = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!checkoutForm.name || !checkoutForm.school || !checkoutForm.wa || !checkoutForm.amount) {
      toast.error('Mohon lengkapi rincian pesanan terlebih dahulu.');
      return;
    }
    if (parseInt(checkoutForm.amount) < 50000) {
      toast.error('Mohon maaf, nominal infaq minimal adalah Rp 50.000.');
      return;
    }

    const toastId = toast.loading('Membangun koneksi aman ke gerbang pembayaran...');
    const newOrderId = generateOrderId();
    setOrderId(newOrderId);

    try {
      const functionUrl = '/.netlify/functions/createTransaction';

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: newOrderId,
          amount: checkoutForm.amount,
          name: checkoutForm.name,
          email: checkoutForm.email,
          phone: checkoutForm.wa,
          school: checkoutForm.school
        })
      });

      const data = await response.json();
      toast.dismiss(toastId);

      if (data.token) {
        onClose();

        (window as any).snap.pay(data.token, {
          onSuccess: function (result: any) {
            toast.success("Alhamdulillah! Pembayaran Infaq Instansi Bapak/Ibu berhasil diproses.");
          },
          onPending: function (result: any) {
            toast.success("Tagihan dibuat! Silakan selesaikan pembayaran Bapak/Ibu.");
          },
          onError: function (result: any) {
            toast.error("Maaf, pembayaran gagal diproses.");
          },
          onClose: function () {
            toast.error("Bapak/Ibu menutup jendela pembayaran sebelum menyelesaikannya.");
          }
        });
      } else {
        toast.error('Gagal mendapatkan token pembayaran dari server.');
      }
    } catch (error) {
      toast.dismiss(toastId);
      toast.error('Terjadi kesalahan jaringan. Gagal terhubung ke peladen Netlify.');
      console.error(error);
    }
  };

  const handleCopyVa = () => {
    let va = "123456789012";
    if (checkoutForm.method === 'BCA_VA') va = "3901" + checkoutForm.wa.slice(-8);
    if (checkoutForm.method === 'MANDIRI_VA') va = "89508" + checkoutForm.wa.slice(-8);
    if (checkoutForm.method === 'BRI_VA') va = "2201" + checkoutForm.wa.slice(-8);

    navigator.clipboard.writeText(va);
    toast.success('Nomor Virtual Account berhasil disalin!');
  };

  const handleUploadProof = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast.error("Ukuran bukti transfer maksimal 3 MB.");

    const reader = new FileReader();
    reader.onloadend = () => {
      setPaymentProof(reader.result as string);
      toast.success('Bukti pembayaran berhasil diunggah.');
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmPayment = () => {
    setCheckoutStep(3);
    setTimeout(() => {
      const waMessage = `Halo Tim Finance ABDI,%0A%0ASaya telah melakukan pembayaran Infaq untuk sistem absensi. Berikut rinciannya:%0A%0A*Order ID:* ${orderId}%0A*Instansi:* ${checkoutForm.school}%0A*Nama:* ${checkoutForm.name}%0A*Email:* ${checkoutForm.email}%0A*Nominal:* Rp ${parseInt(checkoutForm.amount).toLocaleString('id-ID')}%0A*Metode:* ${checkoutForm.method}%0A%0AMohon bantuan untuk verifikasi dan aktivasi lisensi kami. Terima kasih.`;
      window.open(`https://wa.me/${landingConfig?.waHelpdesk || ''}?text=${waMessage}`, '_blank');
      toast.success('Pembayaran sedang diproses! Menuju WhatsApp Admin untuk verifikasi akhir.');
    }, 1500);
  };

  const formatCurrency = (value: string) => {
    const num = parseInt(value.replace(/\D/g, '')) || 0;
    return num.toLocaleString('id-ID');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      {checkoutStep === 1 && (
        <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300 max-h-[90vh] md:max-h-[85vh]">
          {/* Kiri: Ringkasan Pesanan */}
          <div className="bg-slate-900 text-white p-6 sm:p-8 md:w-5/12 flex flex-col justify-between shrink-0 relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <h3 className="text-xl sm:text-2xl font-black mb-2">Rincian Tagihan</h3>
              <p className="text-slate-400 text-xs sm:text-sm font-medium mb-8">Penyelesaian aktivasi lisensi sistem ABDI.</p>

              <div className="space-y-4">
                <div className="bg-white/10 p-4 rounded-xl border border-white/10">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Paket Pilihan</p>
                  <p className="text-base sm:text-lg font-black text-amber-400">Akses Premium (Infaq)</p>
                  <p className="text-xs text-slate-300 mt-1">Kapasitas Unlimited &bull; 1 Tahun Ajaran</p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-700/80 relative z-10">
              <div className="flex justify-between items-center text-sm font-bold text-slate-300 mb-2">
                <span>Subtotal</span>
                <span>Rp {formatCurrency(checkoutForm.amount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-slate-300 mb-4">
                <span>Pajak Sistem</span>
                <span>Rp 0</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-slate-300">Total Pembayaran</span>
                <span className="text-2xl sm:text-3xl font-black text-white">Rp {formatCurrency(checkoutForm.amount)}</span>
              </div>
            </div>
          </div>

          {/* Kanan: Form Data Diri & Pembayaran */}
          <div className="p-6 sm:p-8 md:w-7/12 bg-white overflow-y-auto custom-scrollbar flex-1">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg sm:text-xl font-black text-slate-900">Informasi Pembeli</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"><X size={16} /></button>
            </div>

            <form onSubmit={handleCheckoutProcess} className="space-y-5 text-xs sm:text-sm font-bold text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className="block mb-1.5 text-slate-600">Nama Pimpinan / PIC <span className="text-red-500">*</span></label>
                  <input type="text" required value={checkoutForm.name} onChange={e => setCheckoutForm({ ...checkoutForm, name: e.target.value })} placeholder="Contoh: Budi Santoso" className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-medium" />
                </div>
                <div>
                  <label className="block mb-1.5 text-slate-600">Nama Instansi <span className="text-red-500">*</span></label>
                  <input type="text" required value={checkoutForm.school} onChange={e => setCheckoutForm({ ...checkoutForm, school: e.target.value })} placeholder="Contoh: SMA Terpadu" className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className="block mb-1.5 text-slate-600">Email Instansi <span className="text-red-500">*</span></label>
                  <input type="email" required value={checkoutForm.email} onChange={e => setCheckoutForm({ ...checkoutForm, email: e.target.value })} placeholder="admin@sekolah.sch.id" className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-medium" />
                </div>
                <div>
                  <label className="block mb-1.5 text-slate-600">No. WhatsApp <span className="text-red-500">*</span></label>
                  <input type="tel" required value={checkoutForm.wa} onChange={e => setCheckoutForm({ ...checkoutForm, wa: e.target.value })} placeholder="08123456789" className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-mono" />
                </div>
              </div>

              <div className="pt-2">
                <label className="block mb-1.5 text-slate-600">Nominal Infaq Sukarela (Rp) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">Rp</span>
                  <input type="text" required value={formatCurrency(checkoutForm.amount)} onChange={e => setCheckoutForm({ ...checkoutForm, amount: e.target.value.replace(/\D/g, '') })} className="w-full p-3 pl-12 rounded-xl border-2 border-amber-300 bg-amber-50 focus:border-amber-500 outline-none font-black text-slate-900 text-lg sm:text-xl tracking-tight" />
                </div>
                <p className="text-[10px] text-slate-400 font-medium mt-1.5">Nominal minimal yang dianjurkan adalah Rp 50.000 untuk kelancaran administrasi server.</p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="block mb-3 text-slate-600">Pilih Metode Pembayaran</label>
                <div className="grid grid-cols-2 gap-3">
                  <div onClick={() => setCheckoutForm({ ...checkoutForm, method: 'BCA_VA' })} className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${checkoutForm.method === 'BCA_VA' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <CreditCard className={checkoutForm.method === 'BCA_VA' ? 'text-blue-600' : 'text-slate-400'} />
                    <span className="text-[10px] sm:text-xs text-center font-bold">BCA Virtual Account</span>
                  </div>
                  <div onClick={() => setCheckoutForm({ ...checkoutForm, method: 'MANDIRI_VA' })} className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${checkoutForm.method === 'MANDIRI_VA' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <CreditCard className={checkoutForm.method === 'MANDIRI_VA' ? 'text-blue-600' : 'text-slate-400'} />
                    <span className="text-[10px] sm:text-xs text-center font-bold">Mandiri Virtual Account</span>
                  </div>
                  <div onClick={() => setCheckoutForm({ ...checkoutForm, method: 'BRI_VA' })} className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${checkoutForm.method === 'BRI_VA' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <CreditCard className={checkoutForm.method === 'BRI_VA' ? 'text-blue-600' : 'text-slate-400'} />
                    <span className="text-[10px] sm:text-xs text-center font-bold">BRI Virtual Account</span>
                  </div>
                  <div onClick={() => setCheckoutForm({ ...checkoutForm, method: 'QRIS' })} className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${checkoutForm.method === 'QRIS' ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <QrCode className={checkoutForm.method === 'QRIS' ? 'text-emerald-500' : 'text-slate-400'} />
                    <span className="text-[10px] sm:text-xs text-center font-bold">QRIS (Semua Bank/E-Wallet)</span>
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full py-4 mt-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-2">
                Buat Tagihan (Invoice) <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {checkoutStep === 2 && (
        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-300 relative text-center">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

          <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <Receipt size={32} />
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Faktur Tersimpan!</h3>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 mb-6">Selesaikan pembayaran sebelum batas waktu berakhir.</p>

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-left space-y-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-400">Order ID</span>
              <span className="text-xs font-black text-slate-800 font-mono bg-slate-200 px-2 py-0.5 rounded">{orderId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-400">Metode</span>
              <span className="text-xs font-black text-blue-600">{checkoutForm.method.replace('_', ' ')}</span>
            </div>

            <div className="pt-4 border-t border-slate-200 text-center">
              <p className="text-[11px] font-bold text-slate-500 mb-2">Total Pembayaran</p>
              <p className="text-3xl font-black text-slate-900 tracking-tight mb-4">Rp {formatCurrency(checkoutForm.amount)}</p>

              {checkoutForm.method.includes('VA') ? (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-1.5">Nomor Virtual Account</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-lg sm:text-xl font-mono font-black text-slate-800 bg-white border border-slate-300 px-4 py-2 rounded-xl">
                      {checkoutForm.method === 'BCA_VA' ? '3901' : checkoutForm.method === 'MANDIRI_VA' ? '89508' : '2201'}
                      {checkoutForm.wa.slice(-8)}
                    </span>
                    <button onClick={handleCopyVa} className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors" title="Salin Nomor VA">
                      <Copy size={18} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-xl border border-slate-200 inline-block mx-auto">
                  <QrCode size={120} className="text-slate-800 mx-auto" />
                  <p className="text-[10px] font-bold text-slate-400 mt-2">Scan QRIS melalui M-Banking/E-Wallet</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 mb-6 flex items-center gap-3">
            <Clock className="text-amber-500 shrink-0" size={24} />
            <div className="text-left">
              <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Batas Pembayaran</p>
              <p className="text-xs sm:text-sm font-black text-amber-600 font-mono">23 : 59 : 59</p>
            </div>
          </div>

          <button onClick={() => setCheckoutStep(3)} className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm shadow-xl transition-all mb-3">
            Saya Sudah Membayar
          </button>
          <button onClick={onClose} className="text-xs font-bold text-slate-400 hover:text-slate-600">Batal / Bayar Nanti</button>
        </div>
      )}

      {checkoutStep === 3 && (
        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-8 animate-in slide-in-from-right-8 duration-300 relative text-center">
          <button onClick={onClose} className="absolute right-4 top-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors"><X size={16} /></button>

          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} />
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Verifikasi Pembayaran</h3>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 mb-6">Unggah tangkapan layar (screenshot) atau foto bukti transfer untuk mempercepat aktivasi lisensi.</p>

          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 mb-6 hover:bg-slate-50 hover:border-blue-400 transition-colors relative cursor-pointer group">
            <input type="file" accept="image/*" onChange={handleUploadProof} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            {paymentProof ? (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto"><CheckCircle2 size={24} /></div>
                <p className="text-xs font-bold text-emerald-600">Bukti Transfer Dilampirkan</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform"><UploadCloud size={24} /></div>
                <div>
                  <p className="text-xs font-bold text-slate-700">Klik untuk mengunggah bukti bayar</p>
                  <p className="text-[10px] text-slate-400 mt-1">Format JPG, PNG (Maks 3MB)</p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleConfirmPayment}
            disabled={!paymentProof}
            className="w-full py-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-50 disabled:grayscale text-white font-black text-sm shadow-xl shadow-green-500/20 transition-all flex items-center justify-center gap-2"
          >
            Kirim via WhatsApp Admin <MessageCircle size={16} />
          </button>
          <p className="text-[10px] text-slate-400 font-medium mt-4">Admin kami akan memvalidasi bukti Anda secara instan dan mengaktifkan akun sekolah/instansi Anda.</p>
        </div>
      )}
    </div>
  );
}
