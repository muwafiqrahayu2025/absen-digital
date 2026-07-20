import React, { useState, useEffect } from "react";
import { ClassSchedule, User } from "../../types";
import { Calendar, Plus, Edit2, Trash2, X, Clock, MapPin, BookOpen, Users } from "lucide-react";
import { toast } from "react-hot-toast";
import { useFirebaseData } from "../../hooks/useFirebaseData";
import { dbRealtime, getTenantRef } from "../../lib/firebase";
import { ref, set } from "firebase/database";

const DAYS_OF_WEEK = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function ManageSchedule() {
  const { data: scheduleData, isOffline: isOfflineSch } = useFirebaseData('schedules');
  const { data: usersData, isOffline: isOfflineUsers } = useFirebaseData('users');
  const isOffline = isOfflineSch || isOfflineUsers;

  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);

  useEffect(() => {
    if (scheduleData) setSchedules(Object.values(scheduleData) as ClassSchedule[]);
    else setSchedules([]);
  }, [scheduleData]);

  useEffect(() => {
    if (usersData) {
      const allUsers = Object.values(usersData) as User[];
      setTeachers(allUsers.filter(u => u.role === 'guru' || u.role === 'dosen' || u.role === 'kepala_sekolah'));
    } else setTeachers([]);
  }, [usersData]);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<ClassSchedule>>({
    dayOfWeek: "Senin",
    startTime: "07:00",
    endTime: "08:30"
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOffline) { toast.error("Koneksi terputus. Tidak bisa menyimpan saat offline."); return; }
    if (!formData.teacherId || !formData.subject || !formData.className || !formData.dayOfWeek || !formData.startTime || !formData.endTime) {
      toast.error("Mohon lengkapi semua field jadwal!");
      return;
    }

    const newSchedule: ClassSchedule = {
      id: editingId || `sch-${Math.random().toString(36).substr(2, 9)}`,
      teacherId: formData.teacherId,
      dayOfWeek: formData.dayOfWeek,
      subject: formData.subject,
      className: formData.className,
      startTime: formData.startTime,
      endTime: formData.endTime
    };

    const updated = editingId 
      ? schedules.map(s => s.id === editingId ? newSchedule : s)
      : [...schedules, newSchedule];
    
    const obj = updated.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
    await set(getTenantRef('schedules'), obj);

    toast.success(`Jadwal berhasil ${editingId ? 'diperbarui' : 'ditambahkan'}!`);
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (isOffline) { toast.error("Koneksi terputus. Tidak bisa menghapus saat offline."); return; }
    if (confirm("Apakah Anda yakin ingin menghapus jadwal ini?")) {
      const updated = schedules.filter(s => s.id !== id);
      const obj = updated.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
      await set(getTenantRef('schedules'), obj);
      toast.success("Jadwal berhasil dihapus!");
    }
  };

  const openEditModal = (sch: ClassSchedule) => {
    setEditingId(sch.id);
    setFormData({ ...sch });
    setShowModal(true);
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ dayOfWeek: "Senin", startTime: "07:00", endTime: "08:30" });
    setShowModal(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-left">
      {isOffline && (
        <div className="bg-amber-100 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center gap-3">
          <div className="shrink-0">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-sm">Mode Luring (Offline) Aktif</p>
            <p className="text-xs mt-0.5">Koneksi terputus. Pengaturan sistem membutuhkan koneksi internet aktif. Form CRUD telah dikunci.</p>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="text-indigo-600" />
            Manajemen Jadwal
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Kelola jadwal pelajaran dan kegiatan instansi / sekolah / kampus per hari.
          </p>
        </div>
        <button 
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
        >
          <Plus size={18} /> Tambah Jadwal
        </button>
      </div>

      {/* Grid of Days */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {DAYS_OF_WEEK.map(day => {
          const daySchedules = schedules.filter(s => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
          
          return (
            <div key={day} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
              <div className="bg-slate-50 border-b border-gray-100 px-5 py-3 font-bold text-gray-800 flex justify-between items-center">
                <span>{day}</span>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">{daySchedules.length} Kelas</span>
              </div>
              
              <div className="p-4 flex-1">
                {daySchedules.length === 0 ? (
                  <div className="text-center text-sm text-gray-400 py-8 italic">
                    Belum ada jadwal untuk hari ini.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {daySchedules.map(sch => {
                      const teacher = teachers.find(t => t.id === sch.teacherId);
                      return (
                        <div key={sch.id} className="group relative border border-gray-100 rounded-xl p-3 hover:border-indigo-200 hover:shadow-sm transition-all bg-white">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                              <BookOpen size={14} className="text-indigo-500" />
                              {sch.subject}
                            </h4>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-3 top-3 bg-white pl-2">
                              <button onClick={() => openEditModal(sch)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                              <button onClick={() => handleDelete(sch.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                            <div className="flex items-center gap-1.5">
                              <Clock size={12} className="text-gray-400" />
                              <span className="font-mono bg-gray-50 px-1 rounded">{sch.startTime} - {sch.endTime}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Users size={12} className="text-gray-400" />
                              <span className="font-medium text-indigo-600 bg-indigo-50 px-1.5 rounded">Kelas {sch.className}</span>
                            </div>
                            <div className="flex items-center gap-1.5 col-span-2 mt-1">
                              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center font-bold" style={{fontSize: '8px'}}>
                                {teacher?.name.charAt(0) || '?'}
                              </div>
                              <span className="truncate">{teacher?.name || 'Guru Tidak Ditemukan'}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="text-indigo-600" size={18} />
                {editingId ? "Edit Jadwal Pelajaran" : "Tambah Jadwal Baru"}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Guru Pengajar</label>
                <select 
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  value={formData.teacherId || ""}
                  onChange={e => setFormData({...formData, teacherId: e.target.value})}
                  required
                >
                  <option value="">-- Pilih Guru --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Hari</label>
                  <select 
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    value={formData.dayOfWeek || "Senin"}
                    onChange={e => setFormData({...formData, dayOfWeek: e.target.value})}
                    required
                  >
                    {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Kelas</label>
                  <input 
                    type="text" 
                    placeholder="cth: VII-A"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    value={formData.className || ""}
                    onChange={e => setFormData({...formData, className: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Mata Pelajaran</label>
                <input 
                  type="text" 
                  placeholder="cth: Matematika"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  value={formData.subject || ""}
                  onChange={e => setFormData({...formData, subject: e.target.value})}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Jam Mulai</label>
                  <input 
                    type="time" 
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                    value={formData.startTime || ""}
                    onChange={e => setFormData({...formData, startTime: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">Jam Selesai</label>
                  <input 
                    type="time" 
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                    value={formData.endTime || ""}
                    onChange={e => setFormData({...formData, endTime: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md hover:shadow-lg transition-all"
                >
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
