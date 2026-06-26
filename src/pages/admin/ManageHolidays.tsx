import React, { useState } from "react";
import { db } from "../../lib/db";
import { Holiday } from "../../types";
import { Plus, Trash2, ArrowLeft, Info, Calendar } from "lucide-react";
import toast from "react-hot-toast";

export function ManageHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>(() => db.getHolidays());
  const [isAdding, setIsAdding] = useState(false);

  const [formData, setFormData] = useState({
    date: "",
    description: "",
  });

  const handleDelete = (id: string) => {
    if (confirm("Yakin ingin menghapus jadwal libur dinas daerah ini?")) {
      const updated = holidays.filter((h) => h.id !== id);
      db.setHolidays(updated);
      setHolidays(updated);
      toast.success("Hari Libur Sekolah berhasil dihapus");
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.description) return;

    const newHoliday: Holiday = {
      id: "libur-" + Math.random().toString(36).substring(2, 9),
      date: formData.date,
      description: formData.description,
    };

    const updated = [newHoliday, ...holidays];
    db.setHolidays(updated);
    setHolidays(updated);

    setFormData({ date: "", description: "" });
    setIsAdding(false);
    toast.success("Hari libur dinas baru berhasil didaftarkan!");
  };

  const handleReset = () => {
    setFormData({ date: "", description: "" });
  };

  if (isAdding) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-fade-in text-left">
        <button
          onClick={() => setIsAdding(false)}
          className="flex items-center gap-2 text-[#1d74f2] hover:text-blue-800 font-extrabold text-sm mb-2"
        >
          <ArrowLeft size={16} /> Daftar Hari Libur Sekolah
        </button>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-[#111c2d] text-white p-5 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-white text-base">
                Tambah Hari Libur / Cuti Bersama Madrasah
              </h3>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Daftarkan penanggalan libur resmi atau hari libur lingkungan
                Madrasah.
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0">
              <Info size={16} />
            </div>
          </div>

          <form
            onSubmit={handleSave}
            className="p-6 space-y-5 text-xs font-sans"
          >
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Pilih Tanggal Libur <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Deskripsi / Perihal Libur Resmi{" "}
                <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Contoh: Libur Nasional Tahun Baru Imlek 2577 Kongzili"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div className="flex gap-3 pt-4 justify-end">
              <button
                type="submit"
                className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
              >
                Daftarkan Hari Libur
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
              >
                Reset Form
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-left animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Calendar size={22} className="text-[#ea4335]" />
            Daftar Hari Libur & Cuti Bersama Sekolah
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Kelola kalender libur operasional akademik fungsional Madrasah.
          </p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
        >
          <Plus size={16} />
          Tambah Hari Libur
        </button>
      </div>

      {/* Desktop view (Tables) */}
      <div className="hidden md:block bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#17a2b8] text-white">
              <tr>
                <th className="p-4 w-16">#</th>
                <th className="p-4">Tanggal Libur Resmi</th>
                <th className="p-4">Deskripsi Acara / Cuti Bersama</th>
                <th className="p-4 text-right w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {holidays.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    Belum ada hari libur terjadwal.
                  </td>
                </tr>
              ) : (
                holidays.map((h, i) => (
                  <tr key={h.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 text-slate-400 font-bold font-mono">
                      {i + 1}
                    </td>
                    <td className="p-4 font-extrabold text-slate-800">
                      {new Date(h.date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-4 text-slate-500">{h.description}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(h.id)}
                        className="p-1.5 text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-600 rounded-xl transition-all duration-200"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile view (List Cards) */}
      <div className="block md:hidden space-y-4">
        {holidays.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-150 p-8 text-center text-slate-400 text-sm">
            Belum ada hari libur terjadwal.
          </div>
        ) : (
          holidays.map((h, i) => (
            <div
              key={h.id}
              className="bg-white rounded-3xl border border-slate-150 p-5 shadow-xs space-y-3 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold text-rose-550 text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full">
                    Sekolah Libur
                  </span>
                  <h4 className="font-extrabold text-[#111c2d] text-sm pt-1">
                    {new Date(h.date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </h4>
                </div>
                <button
                  onClick={() => handleDelete(h.id)}
                  className="p-2 text-rose-650 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-600 rounded-xl transition-all duration-200"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="pt-2 border-t border-slate-100 text-xs text-slate-500 font-medium">
                {h.description}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
