import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw, UploadCloud, Edit3, Save, X, Database, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { db, syncOfflineAttendance } from '../../lib/db';
import { idbStorage } from '../../lib/idbStorage';
import { AttendanceRecord, User } from '../../types';

interface ValidationError {
  id: string;
  type: 'user' | 'attendance';
  title: string;
  description: string;
  record: any;
}

export function LocalValidationCenter() {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingError, setEditingError] = useState<ValidationError | null>(null);
  
  // Edit Form state
  const [editName, setEditName] = useState('');
  const [editNip, setEditNip] = useState('');
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');

  const runValidation = () => {
    const users = db.getUsers();
    const attendance = db.getAttendance();
    const foundErrors: ValidationError[] = [];

    // 1. Validasi Master User (Aturan: Nama tidak boleh kosong, NIK/NIP jika diisi harus valid 16 digit atau sesuai)
    users.forEach((u) => {
      if (!u.name || !u.name.trim()) {
        foundErrors.push({
          id: `user-name-${u.id}`,
          type: 'user',
          title: `Pegawai Tanpa Nama (ID: ${u.username || u.id})`,
          description: 'Nama pegawai tidak boleh kosong.',
          record: u
        });
      }
      if (u.nip && u.nip.replace(/\D/g, '').length !== 16 && u.nip.replace(/\D/g, '').length !== 18) {
        // Contoh validasi 16 digit NIK atau 18 digit NIP
        if (u.role !== 'admin' && u.role !== 'developer') {
          foundErrors.push({
            id: `user-nip-${u.id}`,
            type: 'user',
            title: `Format NIK/NIP Tidak Sesuai (${u.name})`,
            description: `NIK/NIP "${u.nip}" tidak memenuhi syarat panjang standar (16 atau 18 digit angka).`,
            record: u
          });
        }
      }
    });

    // 2. Validasi Log Absensi (Aturan: Jam pulang tidak boleh mendahului jam masuk)
    let unsynced = 0;
    attendance.forEach((att) => {
      const isUnsynced = !att.isSynced || (att as any).is_synced === false || att.syncStatus === 'failed' || att.syncStatus === 'pending';
      if (isUnsynced) unsynced++;

      if (att.checkInTime && att.checkOutTime) {
        if (att.checkOutTime < att.checkInTime) {
          const user = users.find(u => u.id === att.userId);
          foundErrors.push({
            id: `att-time-${att.id}`,
            type: 'attendance',
            title: `Konflik Waktu Absensi (${user ? user.name : att.userId})`,
            description: `Tanggal ${att.date}: Jam Pulang (${att.checkOutTime}) tercatat lebih awal dibanding Jam Masuk (${att.checkInTime}).`,
            record: att
          });
        }
      }
    });

    setErrors(foundErrors);
    setUnsyncedCount(unsynced);
  };

  useEffect(() => {
    runValidation();
    window.addEventListener('attendance_synchronized', runValidation);
    return () => window.removeEventListener('attendance_synchronized', runValidation);
  }, []);

  const handleStartEdit = (err: ValidationError) => {
    setEditingError(err);
    if (err.type === 'user') {
      setEditName(err.record.name || '');
      setEditNip(err.record.nip || '');
    } else {
      setEditCheckIn(err.record.checkInTime || '');
      setEditCheckOut(err.record.checkOutTime || '');
    }
  };

  const handleSaveRepair = () => {
    if (!editingError) return;

    if (editingError.type === 'user') {
      db.updateUser(editingError.record.id, {
        name: editName,
        nip: editNip
      });
      toast.success('Data pegawai berhasil diperbaiki!');
    } else {
      const allAtt = db.getAttendance();
      const idx = allAtt.findIndex(a => a.id === editingError.record.id);
      if (idx !== -1) {
        allAtt[idx].checkInTime = editCheckIn || undefined;
        allAtt[idx].checkOutTime = editCheckOut || undefined;
        (allAtt[idx] as any).updated_at = new Date().toISOString();
        db.setAttendance(allAtt);
        toast.success('Log absensi berhasil diperbaiki!');
      }
    }

    setEditingError(null);
    runValidation();
  };

  const handleDeltaSync = async () => {
    if (errors.length > 0) {
      toast.error('Perbaiki seluruh data Invalid (0 kesalahan) sebelum sinkronisasi!');
      return;
    }

    if (!navigator.onLine) {
      toast.error('Koneksi internet tidak tersedia. Sinkronisasi Delta wajib online.');
      return;
    }

    setIsSyncing(true);
    const toastId = toast.loading('Mengirim Delta Sync (UPSERT berdasarkan updated_at) ke Cloud...');

    try {
      const syncedCount = await syncOfflineAttendance();
      toast.success(`Sinkronisasi Sukses! ${syncedCount} baris data berhasil diunggah dengan status is_synced: true.`, { id: toastId });
      runValidation();
    } catch (err: any) {
      toast.error('Gagal Sinkronisasi: ' + (err.message || 'Koneksi terputus'), { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Database className="w-3.5 h-3.5" /> Arsitektur Hybrid Offline-First
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Pusat Validasi Lokal Mandiri</h1>
            <p className="text-slate-300 text-sm max-w-2xl">
              Sistem mengeksekusi pengecekan aturan bisnis ke IndexedDB secara lokal tanpa internet. Pastikan data bernilai Invalid = 0 sebelum melakukan Sinkronisasi Delta ke Server Pusat.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={runValidation}
              className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 border border-white/10 shadow-sm"
            >
              <RefreshCw className="w-4 h-4" /> Validasi Ulang
            </button>
            <button
              onClick={handleDeltaSync}
              disabled={errors.length > 0 || isSyncing || unsyncedCount === 0}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
            >
              {isSyncing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Mengirim Delta...</span>
                </>
              ) : errors.length > 0 ? (
                <>
                  <Lock className="w-4 h-4 text-rose-400" />
                  <span>Sync Terkunci (Invalid &gt; 0)</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Delta Sync ({unsyncedCount})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${errors.length > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {errors.length > 0 ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">Status Validasi</span>
            <span className={`text-lg font-black ${errors.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {errors.length > 0 ? `${errors.length} Data Invalid` : 'Semua Data Valid (0 Error)'}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">Antrean Delta Sync</span>
            <span className="text-lg font-black text-slate-800">
              {unsyncedCount} Baris (is_synced: false)
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase block">Proteksi Sandbox</span>
            <span className="text-lg font-black text-purple-700">AES-256 Terenkripsi</span>
          </div>
        </div>
      </div>

      {/* Tabel Data Invalid */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800">Daftar Data Error &amp; Konflik Aturan Bisnis</h2>
            <p className="text-xs text-slate-500">Perbaiki seluruh kesalahan di bawah ini agar tombol Sinkronisasi Delta terbuka.</p>
          </div>
          {errors.length > 0 && (
            <span className="px-3 py-1 bg-rose-100 text-rose-700 font-bold text-xs rounded-full animate-pulse">
              Wajib Perbaikan Manual
            </span>
          )}
        </div>

        {errors.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto opacity-80" />
            <p className="text-base font-bold text-slate-700">Pemeriksaan Sempurna!</p>
            <p className="text-xs max-w-md mx-auto">Tidak ada pelanggaran aturan bisnis di dalam IndexedDB. Anda siap melakukan sinkronisasi delta ke cloud.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {errors.map((err) => (
              <div key={err.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-100 text-rose-700">
                      {err.type === 'user' ? 'Pegawai' : 'Absensi'}
                    </span>
                    <h3 className="font-bold text-sm text-slate-800">{err.title}</h3>
                  </div>
                  <p className="text-xs text-rose-600 font-medium">{err.description}</p>
                </div>

                <button
                  onClick={() => handleStartEdit(err)}
                  className="self-start md:self-center px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold text-xs transition-all flex items-center gap-1.5 border border-indigo-200/50"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Perbaiki Data
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Perbaikan */}
      {editingError && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-fade-in border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-800">Koreksi Manual Data Lokal</h3>
              <button onClick={() => setEditingError(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-rose-600 font-medium bg-rose-50 p-3 rounded-xl border border-rose-100">
              {editingError.description}
            </p>

            {editingError.type === 'user' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap Pegawai</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">NIK / NIP (Wajib 16/18 Digit)</label>
                  <input
                    type="text"
                    value={editNip}
                    onChange={(e) => setEditNip(e.target.value)}
                    placeholder="16 digit angka NIK..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jam Masuk (HH:mm:ss)</label>
                  <input
                    type="time"
                    step="1"
                    value={editCheckIn}
                    onChange={(e) => setEditCheckIn(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jam Pulang (HH:mm:ss)</label>
                  <input
                    type="time"
                    step="1"
                    value={editCheckOut}
                    onChange={(e) => setEditCheckOut(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingError(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleSaveRepair}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-500/20"
              >
                <Save className="w-3.5 h-3.5" /> Simpan Perbaikan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
