import React, { useState } from "react";
import {  db  } from "../../lib/db";
import { AcademicYear } from "../../types";
import { Plus, Edit2, Trash2, Clock, Briefcase, Calendar, Save, X } from 'lucide-react';
import toast from "react-hot-toast";

interface ShiftSchedule {
  id: string;
  name: string;
  days: string;
  checkInStart: string;
  checkInEnd: string;
  checkOutStart: string;
  checkOutEnd: string;
  isActive: boolean;
}

export function ManageAcademic() {
  const [schedules, setSchedules] = useState<ShiftSchedule[]>(() => {
    const cached = localStorage.getItem("madrasah_shift_schedules");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    return [];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ShiftSchedule | null>(
    null,
  );

  const [formData, setFormData] = useState({
    name: "",
    days: "",
    checkInStart: "07:30",
    checkInEnd: "08:00",
    checkOutStart: "16:00",
    checkOutEnd: "17:30",
    isActive: false,
  });

  const saveToStorage = (updated: ShiftSchedule[]) => {
    localStorage.setItem("madrasah_shift_schedules", JSON.stringify(updated));
    setSchedules(updated);
  };

  const handleDelete = (id: string) => {
    if (confirm("Yakin ingin menghapus skema jadwal kerja Madrasah ini?")) {
      const updated = schedules.filter((s) => s.id !== id);
      saveToStorage(updated);
      toast.success("Jadwal kerja berhasil dihapus!");
    }
  };

  const handleEdit = (sch: ShiftSchedule) => {
    setEditingSchedule(sch);
    setFormData({
      name: sch.name,
      days: sch.days,
      checkInStart: sch.checkInStart,
      checkInEnd: sch.checkInEnd,
      checkOutStart: sch.checkOutStart,
      checkOutEnd: sch.checkOutEnd,
      isActive: sch.isActive,
    });
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingSchedule(null);
    setFormData({
      name: "",
      days: "Senin s/d Jum'at",
      checkInStart: "07:30",
      checkInEnd: "08:00",
      checkOutStart: "16:00",
      checkOutEnd: "18:00",
      isActive: false,
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    let updated: ShiftSchedule[] = [];
    if (editingSchedule) {
      updated = schedules.map((s) =>
        s.id === editingSchedule.id ? { ...s, ...formData } : s,
      );
      toast.success("Skema shift berhasil dimodifikasi!");
    } else {
      const newItem: ShiftSchedule = {
        id: "sch-" + Math.random().toString(36).substring(2, 9),
        ...formData,
      };
      updated = [...schedules, newItem];
      toast.success("Skema shift kerja baru berhasil ditambahkan!");
    }
    saveToStorage(updated);
    setIsModalOpen(false);
  };

  const toggleActive = (id: string, currentVal: boolean) => {
    const updated = schedules.map((s) =>
      s.id === id ? { ...s, isActive: !currentVal } : s,
    );
    saveToStorage(updated);
    toast.success("Perubahan status penugasan shift di-update!");
  };

  // --- Academic Year & Semester States & Logic ---
  const [activeTab, setActiveTab] = useState<'academic' | 'schedule'>('academic');
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>(() => db.getAcademicYears());
  const [isAcademicModalOpen, setIsAcademicModalOpen] = useState(false);
  const [editingAcademic, setEditingAcademic] = useState<AcademicYear | null>(null);
  const [academicFormData, setAcademicFormData] = useState({
    name: "",
    semester: "Ganjil" as "Ganjil" | "Genap",
    isActive: false,
  });

  const saveAcademicToStorage = (updated: AcademicYear[]) => {
    db.setAcademicYears(updated);
    setAcademicYears(updated);
  };

  const handleAddNewAcademic = () => {
    setEditingAcademic(null);
    setAcademicFormData({
      name: "",
      semester: "Ganjil",
      isActive: false,
    });
    setIsAcademicModalOpen(true);
  };

  const handleEditAcademic = (ay: AcademicYear) => {
    setEditingAcademic(ay);
    setAcademicFormData({
      name: ay.name,
      semester: ay.semester,
      isActive: ay.isActive,
    });
    setIsAcademicModalOpen(true);
  };

  const handleDeleteAcademic = (id: string) => {
    const target = academicYears.find((ay) => ay.id === id);
    if (target?.isActive) {
      toast.error("Tahun Pelajaran aktif tidak boleh dihapus!");
      return;
    }
    if (confirm("Yakin ingin menghapus Tahun Pelajaran ini?")) {
      const updated = academicYears.filter((ay) => ay.id !== id);
      saveAcademicToStorage(updated);
      toast.success("Tahun Pelajaran berhasil dihapus!");
    }
  };

  const handleSaveAcademic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicFormData.name.trim()) {
      toast.error("Nama Tahun Pelajaran wajib diisi!");
      return;
    }

    let updated: AcademicYear[] = [];
    if (editingAcademic) {
      updated = academicYears.map((ay) =>
        ay.id === editingAcademic.id
          ? {
              ...ay,
              name: academicFormData.name,
              semester: academicFormData.semester,
              isActive: academicFormData.isActive ? true : ay.isActive,
            }
          : ay,
      );

      if (academicFormData.isActive) {
        updated = updated.map((ay) =>
          ay.id === editingAcademic.id ? ay : { ...ay, isActive: false },
        );
      }
      toast.success("Tahun Pelajaran berhasil diperbarui!");
    } else {
      const shouldBeActive = academicYears.length === 0 || academicFormData.isActive;

      const newItem: AcademicYear = {
        id: "ay-" + Math.random().toString(36).substring(2, 9),
        name: academicFormData.name,
        semester: academicFormData.semester,
        isActive: shouldBeActive,
      };

      updated = [...academicYears, newItem];
      if (shouldBeActive) {
        updated = updated.map((ay) =>
          ay.id === newItem.id ? ay : { ...ay, isActive: false },
        );
      }
      toast.success("Tahun Pelajaran baru berhasil ditambahkan!");
    }
    saveAcademicToStorage(updated);
    setIsAcademicModalOpen(false);
  };

  const toggleAcademicActive = (id: string) => {
    const updated = academicYears.map((ay) => ({
      ...ay,
      isActive: ay.id === id,
    }));
    saveAcademicToStorage(updated);
    toast.success("Tahun Pelajaran & Semester aktif berhasil diubah!");
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Clock size={22} className="text-indigo-600" />
            {activeTab === "academic"
              ? "Pengaturan Tahun Pelajaran & Semester"
              : "Pengaturan Jadwal Kerja & Shift Madrasah"}
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {activeTab === "academic"
              ? "Kelola Tahun Pelajaran aktif dan semester berjalan untuk administrasi rekap absensi madrasah."
              : "Definisikan jam operasional tapal batas aman clock-in, jam pulang wajib, dan ketentuan hari kerja guru/staf."}
          </p>
        </div>
        <button
          onClick={activeTab === "academic" ? handleAddNewAcademic : handleAddNew}
          className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
        >
          <Plus size={16} />
          {activeTab === "academic" ? "Tambah Tahun Pelajaran" : "Tambah Skema Jadwal"}
        </button>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("academic")}
          className={`px-5 py-2 my-2 mx-1 font-bold text-xs uppercase tracking-wider transition-all duration-200 rounded-2xl border ${activeTab === "academic" ? "bg-white/60 border-white/80 text-slate-800 shadow-[0_4px_10px_rgba(0,0,0,0.02)] backdrop-blur-md" : "bg-transparent border-transparent text-slate-400 hover:bg-white/40 hover:text-slate-600"}`}
        >
          🎓 Tahun Pelajaran & Semester
        </button>
        <button
          onClick={() => setActiveTab("schedule")}
          className={`px-5 py-2 my-2 mx-1 font-bold text-xs uppercase tracking-wider transition-all duration-200 rounded-2xl border ${activeTab === "schedule" ? "bg-white/60 border-white/80 text-slate-800 shadow-[0_4px_10px_rgba(0,0,0,0.02)] backdrop-blur-md" : "bg-transparent border-transparent text-slate-400 hover:bg-white/40 hover:text-slate-600"}`}
        >
          ⏰ Jadwal Kerja & Shift
        </button>
      </div>

      {/* Tab: Academic Year */}
      {activeTab === "academic" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {academicYears.map((ay) => (
            <div
              key={ay.id}
              className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between relative group hover:border-indigo-300 transition duration-200 animate-fade-in"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="bg-indigo-50 text-indigo-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                    🎓 Kalender Akademik
                  </span>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                      ay.isActive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {ay.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>

                <h4 className="font-extrabold text-slate-800 text-sm mt-1">
                  Tahun Pelajaran {ay.name}
                </h4>
                <p className="text-slate-500 text-[11px] mt-1.5 font-medium">
                  Semester: <strong className="text-indigo-600 font-bold">{ay.semester}</strong>
                </p>
              </div>

              <div className="flex justify-between items-center gap-3 pt-4 mt-4 border-t border-slate-100">
                {!ay.isActive ? (
                  <button
                    onClick={() => toggleAcademicActive(ay.id)}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    Aktifkan Semester Ini
                  </button>
                ) : (
                  <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1">
                    🟢 Sedang Digunakan
                  </span>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditAcademic(ay)}
                    className="p-1.5 text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-indigo-600 rounded-xl transition-all duration-200"
                  >
                    <Edit2 size={13} />
                  </button>
                  {!ay.isActive && (
                    <button
                      onClick={() => handleDeleteAcademic(ay.id)}
                      className="p-1.5 text-rose-650 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-600 rounded-xl transition-all duration-200"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {academicYears.length === 0 && (
            <div className="md:col-span-2 text-center py-12 bg-white border border-slate-150 rounded-3xl text-slate-400">
              Belum ada data Tahun Pelajaran. Klik tombol tambah di atas.
            </div>
          )}
        </div>
      )}

      {/* Tab: Shift Schedules */}
      {activeTab === "schedule" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schedules.map((sch) => (
            <div
              key={sch.id}
              className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between relative group hover:border-indigo-300 transition duration-200 animate-fade-in"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="bg-[#17a2b8]/10 text-[#17a2b8] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                    🏢 Dinamis Shift
                  </span>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                      sch.isActive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {sch.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>

                <h4 className="font-extrabold text-slate-800 text-sm mt-1">
                  {sch.name}
                </h4>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mt-1 flex items-center gap-1 font-mono">
                  <Calendar size={12} className="text-indigo-500" /> {sch.days}
                </p>

                <div className="grid grid-cols-2 gap-3 mt-4 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-600">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                      📥 Batas Masuk
                    </p>
                    <p className="font-mono text-slate-800 mt-1.5 text-xs font-bold">
                      {sch.checkInStart} s/d {sch.checkInEnd}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                      📤 Jam Pulang
                    </p>
                    <p className="font-mono text-slate-800 mt-1.5 text-xs font-bold">
                      {sch.checkOutStart} s/d {sch.checkOutEnd}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center gap-3 pt-4 mt-4 border-t border-slate-50">
                <button
                  onClick={() => toggleActive(sch.id, sch.isActive)}
                  className={`text-[10px] font-bold ${sch.isActive ? "text-slate-400 hover:text-slate-600" : "text-indigo-600 hover:text-indigo-800"}`}
                >
                  {sch.isActive ? "Tangguhkan Shift" : "Aktifkan Skema"}
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(sch)}
                    className="p-1.5 text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-indigo-600 rounded-xl transition-all duration-200"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(sch.id)}
                    className="p-1.5 text-rose-650 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-600 rounded-xl transition-all duration-200"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Shift Schedules */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 text-xs font-sans">
            <h3 className="text-lg font-black text-slate-800 mb-4">
              {editingSchedule ? "Ubah Skema Shift" : "Tambah Skema Baru"}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Nama Skema / Shift
                </label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                  placeholder="Contoh: Shift Lapangan SATPOL PP"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Hari Kerja Terkait
                </label>
                <input
                  required
                  value={formData.days}
                  onChange={(e) =>
                    setFormData({ ...formData, days: e.target.value })
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                  placeholder="Contoh: Senin s/d Jum'at"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Masuk Mulai
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.checkInStart}
                    onChange={(e) =>
                      setFormData({ ...formData, checkInStart: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Batas Telat
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.checkInEnd}
                    onChange={(e) =>
                      setFormData({ ...formData, checkInEnd: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Pulang Mulai
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.checkOutStart}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        checkOutStart: e.target.value,
                      })
                    }
                    className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Batas Akhir Sesi
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.checkOutEnd}
                    onChange={(e) =>
                      setFormData({ ...formData, checkOutEnd: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 ml-1"
                />
                <label htmlFor="isActive" className="text-slate-600 font-bold">
                  Aktifkan Profil Shift Ini
                </label>
              </div>

              <div className="flex gap-3 pt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                ><X size={16} /> Batal</button>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                >
                  <Save className="w-4 h-4" /> Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Academic Year & Semester */}
      {isAcademicModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 text-xs font-sans">
            <h3 className="text-lg font-black text-slate-800 mb-4">
              {editingAcademic ? "Ubah Tahun Pelajaran" : "Tambah Tahun Pelajaran Baru"}
            </h3>
            <form onSubmit={handleSaveAcademic} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Tahun Pelajaran / Ajaran
                </label>
                <input
                  required
                  value={academicFormData.name}
                  onChange={(e) =>
                    setAcademicFormData({ ...academicFormData, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl"
                  placeholder="Contoh: 2026/2027"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Semester Berjalan
                </label>
                <select
                  value={academicFormData.semester}
                  onChange={(e) =>
                    setAcademicFormData({
                      ...academicFormData,
                      semester: e.target.value as "Ganjil" | "Genap",
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl font-bold"
                >
                  <option value="Ganjil">Semester Ganjil</option>
                  <option value="Genap">Semester Genap</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActiveAcademic"
                  checked={academicFormData.isActive}
                  onChange={(e) =>
                    setAcademicFormData({ ...academicFormData, isActive: e.target.checked })
                  }
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 ml-1"
                />
                <label htmlFor="isActiveAcademic" className="text-slate-600 font-bold">
                  Aktifkan Tahun Pelajaran & Semester Ini
                </label>
              </div>

              <div className="flex gap-3 pt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAcademicModalOpen(false)}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                ><X size={16} /> Batal</button>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
                >
                  <Save className="w-4 h-4" /> Simpan Kalender
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
