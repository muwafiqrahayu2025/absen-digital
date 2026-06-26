import React, { useState, useEffect } from "react";
import { db } from "../../lib/db";
import { NotificationService } from "../../lib/notifications";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { FileText, Check, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { CutiRequest, AttendanceRecord } from "../../types";

export function ManageLeave() {
  const [cutiList, setCutiList] = useState<CutiRequest[]>(() =>
    db.getCutiRequests(),
  );
  const [users, setUsers] = useState(() => db.getUsers());

  useEffect(() => {
    const handleSync = () => {
      setCutiList(db.getCutiRequests());
      setUsers(db.getUsers());
    };
    window.addEventListener("cuti_updated", handleSync);
    return () => {
      window.removeEventListener("cuti_updated", handleSync);
    };
  }, []);

  // Approval actions for Izin / Cuti Requests
  const handleCutiApproval = (
    cutiId: string,
    action: "Approved" | "Rejected",
  ) => {
    const updatedCuti = cutiList.map((c) => {
      if (c.id === cutiId) {
        return { ...c, status: action };
      }
      return c;
    });
    db.setCutiRequests(updatedCuti);
    setCutiList(updatedCuti);

    // If approved, dynamically insert attendance records across the range
    const targetCuti = cutiList.find((c) => c.id === cutiId);
    if (action === "Approved" && targetCuti) {
      try {
        const start = parseISO(targetCuti.tanggalMulai);
        const end = parseISO(targetCuti.tanggalSelesai);
        const days = eachDayOfInterval({ start, end });

        let currentAttendance = db.getAttendance();
        days.forEach((day) => {
          const formattedDate = format(day, "yyyy-MM-dd");

          // Check if record exists
          const existingIdx = currentAttendance.findIndex(
            (a) => a.date === formattedDate && a.userId === targetCuti.userId,
          );
          if (existingIdx !== -1) {
            currentAttendance[existingIdx] = {
              ...currentAttendance[existingIdx],
              status: targetCuti.jenis as any,
              notes: targetCuti.alasan,
            };
          } else {
            currentAttendance.push({
              id: "att-cuti-" + Math.random().toString(36).substring(2, 7),
              userId: targetCuti.userId,
              date: formattedDate,
              status: targetCuti.jenis as any,
              isSynced: true,
              syncStatus: "synced",
              notes: targetCuti.alasan,
            });
          }
        });
        db.setAttendance(currentAttendance);
      } catch (e) {
        console.error("Failed to create attendance entries for cuti", e);
      }
    }

    toast.success(
      `Pengajuan Cuti berhasil ${action === "Approved" ? "disetujui (Presensi otomatis dicatat)" : "ditolak"}!`,
    );
    
    if (targetCuti) {
      const u = db.getUsers().find(user => user.id === targetCuti.userId);
      if (u) {
        NotificationService.send(u, 'LEAVE_STATUS_UPDATED', {
          time: `${targetCuti.tanggalMulai} s.d ${targetCuti.tanggalSelesai}`,
          extraInfo: action === "Approved" ? "approved" : "rejected",
          location: "Diproses oleh Administrator"
        });
      }
    }
  };

  const pendingCuti = cutiList.filter((c) => c.status === "Pending");

  return (
    <div className="space-y-6 animate-fade-in text-left">
      <h3 className="text-xl font-black text-slate-800">
        📋 Peninjauan Berkas Pengajuan Izin / Cuti Guru & Staf
      </h3>

      {pendingCuti.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="text-3xl mb-3">🎉</div>
          <h4 className="text-sm font-bold text-slate-800">
            Semua Berkas Selesai Ditinjau!
          </h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Tidak ada persetujuan izin, sakit, atau cuti operasional sekolah
            yang tertunda hari ini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingCuti.map((req) => {
            const associatedUser = users.find((u) => u.id === req.userId);
            return (
              <div
                key={req.id}
                className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-indigo-200 transition relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 left-0 h-1.5 bg-amber-500" />

                <div className="mb-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm leading-tight">
                        {associatedUser?.name || "Guru/Staf"}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        ID / NUPTK: {associatedUser?.nip || "—"}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                      {req.jenis}
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-1 text-[11px] text-slate-600 font-sans">
                    <div className="flex justify-between">
                      <span>Siklus Libur:</span>
                      <span className="font-bold text-slate-800">
                        {req.tanggalMulai} s/d {req.tanggalSelesai}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 mt-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Alasan Pengajuan:
                      </span>
                      <p className="font-bold text-slate-700 bg-white p-2.5 rounded-lg border border-slate-100 leading-relaxed italic">
                        &quot;{req.alasan}&quot;
                      </p>
                    </div>

                    {req.dokumenUrl && (
                      <div className="pt-2 border-t border-slate-100 mt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Lampiran Dokumen:
                        </span>
                        <a
                          href={req.dokumenUrl}
                          download={`Surat_Izin_${associatedUser?.name || "Guru"}_${req.jenis}.${
                            req.dokumenUrl.startsWith("data:application/pdf") ? "pdf" : "png"
                          }`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-150 text-indigo-700 font-bold rounded-xl text-[10px] hover:bg-indigo-100 transition mt-1"
                        >
                          <FileText size={12} />
                          Lihat & Unduh Dokumen
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleCutiApproval(req.id, "Approved")}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1 transition"
                  >
                    ✅ Setujui
                  </button>
                  <button
                    onClick={() => handleCutiApproval(req.id, "Rejected")}
                    className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1 transition"
                  >
                    ❌ Tolak
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
