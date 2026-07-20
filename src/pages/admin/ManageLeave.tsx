import React, { useState, useEffect } from "react";
import { NotificationService } from "../../lib/notifications";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { FileText, Clock, CheckCircle, XCircle, List, Trash2, RotateCcw } from "lucide-react";
import { toast } from "react-hot-toast";
import { CutiRequest, User } from "../../types";
import { useFirebaseData } from "../../hooks/useFirebaseData";
import { dbRealtime, getTenantRef } from "../../lib/firebase";
import { ref, set } from "firebase/database";

export function ManageLeave() {
  const { data: cutiData, isOffline: isOfflineCuti } = useFirebaseData('cuti_requests');
  const { data: usersData, isOffline: isOfflineUsers } = useFirebaseData('users');
  const { data: attendanceData, isOffline: isOfflineAtt } = useFirebaseData('attendance');

  const isOffline = isOfflineCuti || isOfflineUsers || isOfflineAtt;

  const [cutiList, setCutiList] = useState<CutiRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<"Pending" | "Approved" | "Rejected" | "All">("Pending");

  useEffect(() => {
    if (cutiData) setCutiList(Object.values(cutiData) as CutiRequest[]);
    else setCutiList([]);
  }, [cutiData]);

  useEffect(() => {
    if (usersData) setUsers(Object.values(usersData) as User[]);
    else setUsers([]);
  }, [usersData]);

  // Approval actions for Izin / Cuti Requests
  const handleCutiApproval = async (
    cutiId: string,
    action: "Approved" | "Rejected" | "Pending",
  ) => {
    if (isOffline) { toast.error("Koneksi terputus. Tidak bisa melakukan aksi saat offline."); return; }
    const targetCuti = cutiList.find((c) => c.id === cutiId);

    const updatedCuti = cutiList.map((c) => {
      if (c.id === cutiId) {
        return { ...c, status: action };
      }
      return c;
    });
    
    const cutiObj = updatedCuti.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
    await set(getTenantRef('cuti_requests'), cutiObj);

    let attendanceInsertSuccess = true;
    if (action === "Approved" && targetCuti) {
      try {
        const start = parseISO(targetCuti.tanggalMulai);
        const end = parseISO(targetCuti.tanggalSelesai);
        const days = eachDayOfInterval({ start, end });

        let currentAttendance = attendanceData ? Object.values(attendanceData) as any[] : [];
        days.forEach((day) => {
          const formattedDate = format(day, "yyyy-MM-dd");

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
        const attObj = currentAttendance.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
        await set(getTenantRef('attendance'), attObj);
      } catch (e) {
        attendanceInsertSuccess = false;
        console.error("Failed to create attendance entries for cuti", e);
        toast.error("Persetujuan berhasil, tapi gagal mencatat presensi otomatis. Harap catat manual.");
      }
    }

    if (attendanceInsertSuccess) {
      if (action === "Approved") {
        toast.success("Pengajuan berhasil disetujui! Presensi otomatis dicatat.");
      } else if (action === "Rejected") {
        toast.success("Pengajuan telah ditolak.");
      } else {
        toast.success("Status pengajuan dikembalikan ke Tertunda (Pending).");
      }

      if (targetCuti && (action === "Approved" || action === "Rejected")) {
        const u = users.find(user => user.id === targetCuti.userId);
        if (u) {
          NotificationService.send(u, "LEAVE_STATUS_UPDATED", {
            time: `${targetCuti.tanggalMulai} s.d ${targetCuti.tanggalSelesai}`,
            extraInfo: action.toLowerCase(),
            location: "Diproses oleh Administrator"
          });
        }
      }
    }
  };

  const handleDeleteCuti = async (cutiId: string) => {
    if (isOffline) { toast.error("Koneksi terputus. Tidak bisa menghapus saat offline."); return; }
    if (confirm("Yakin ingin menghapus riwayat pengajuan ini?")) {
      const updated = cutiList.filter((c) => c.id !== cutiId);
      const cutiObj = updated.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
      await set(getTenantRef('cuti_requests'), cutiObj);
      toast.success("Riwayat pengajuan berhasil dihapus");
    }
  };

  const filteredCuti = cutiList.filter((c) => {
    if (activeTab === "All") return true;
    return c.status === activeTab;
  });

  const pendingCount = cutiList.filter((c) => c.status === "Pending").length;
  const approvedCount = cutiList.filter((c) => c.status === "Approved").length;
  const rejectedCount = cutiList.filter((c) => c.status === "Rejected").length;

  return (
    <div className="space-y-6 animate-fade-in text-left font-sans pb-12">
      {isOffline && (
        <div className="bg-amber-100 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center gap-3">
          <div className="shrink-0">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-sm">Mode Luring (Offline) Aktif</p>
            <p className="text-xs mt-0.5">Koneksi terputus. Pengaturan sistem membutuhkan koneksi internet aktif. Form persetujuan telah dikunci.</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight">
            📋 Persetujuan Izin, Sakit, Cuti Tahunan, & Dinas Luar Operasional
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Dasbor khusus Administrator & Kepala Sekolah untuk menyetujui atau menolak permohonan izin/cuti yang diajukan oleh Guru dan Staf.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60 w-fit">
        <button
          onClick={() => setActiveTab("Pending")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === "Pending"
              ? "bg-white text-amber-600 shadow-sm border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Clock size={14} />
          Tertunda
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px]">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("Approved")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === "Approved"
              ? "bg-white text-emerald-600 shadow-sm border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <CheckCircle size={14} />
          Disetujui
          <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px]">
            {approvedCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("Rejected")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === "Rejected"
              ? "bg-white text-rose-600 shadow-sm border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <XCircle size={14} />
          Ditolak
          <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px]">
            {rejectedCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("All")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === "All"
              ? "bg-white text-indigo-600 shadow-sm border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <List size={14} />
          Semua Riwayat
          <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px]">
            {cutiList.length}
          </span>
        </button>
      </div>

      {/* Grid Content */}
      {filteredCuti.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="text-4xl mb-3">📭</div>
          <h4 className="text-base font-extrabold text-slate-800">
            {activeTab === "Pending" && "Semua Berkas Selesai Ditinjau!"}
            {activeTab === "Approved" && "Belum Ada Pengajuan yang Disetujui."}
            {activeTab === "Rejected" && "Belum Ada Pengajuan yang Ditolak."}
            {activeTab === "All" && "Belum Ada Riwayat Pengajuan Izin / Cuti."}
          </h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {activeTab === "Pending"
              ? "Tidak ada persetujuan izin, sakit, atau cuti operasional sekolah yang tertunda saat ini. Pengajuan baru dilakukan langsung oleh akun Guru dan Staf."
              : "Daftar berkas pada filter ini masih kosong. Pengajuan permohonan dilakukan oleh Guru atau Staf melalui dasbor akun masing-masing."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCuti.map((req) => {
            const associatedUser = users.find((u) => u.id === req.userId);
            const isPending = req.status === "Pending";
            const isApproved = req.status === "Approved";

            return (
              <div
                key={req.id}
                className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-indigo-200 transition relative overflow-hidden group"
              >
                <div
                  className={`absolute top-0 right-0 left-0 h-1.5 ${
                    isPending
                      ? "bg-amber-500"
                      : isApproved
                      ? "bg-emerald-500"
                      : "bg-rose-500"
                  }`}
                />

                <div className="mb-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm leading-tight group-hover:text-indigo-600 transition">
                        {associatedUser?.name || "Pegawai"}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        ID Pegawai / NIP / NIDN / NIK: {associatedUser?.nip || associatedUser?.nuptk || "—"}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                        req.jenis === "Sakit"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : req.jenis === "Izin"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : req.jenis === "Cuti Tahunan"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-purple-50 text-purple-700 border-purple-200"
                      }`}
                    >
                      {req.jenis}
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-xs text-slate-600 font-sans">
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="text-slate-400 font-medium text-[11px]">Tanggal:</span>
                      <span className="font-extrabold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px]">
                        {req.tanggalMulai} s/d {req.tanggalSelesai}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                        Alasan / Keterangan:
                      </span>
                      <p className="font-bold text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 leading-relaxed text-[11px] italic">
                        &quot;{req.alasan}&quot;
                      </p>
                    </div>

                    {req.dokumenUrl && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                          Lampiran Berkas:
                        </span>
                        <a
                          href={req.dokumenUrl}
                          download={`Surat_Izin_${associatedUser?.name || "Guru"}_${req.jenis}.${
                            req.dokumenUrl.startsWith("data:application/pdf") ? "pdf" : "png"
                          }`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold rounded-xl text-xs hover:bg-indigo-100 transition"
                        >
                          <FileText size={14} />
                          Lihat & Unduh Berkas
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {isPending ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleCutiApproval(req.id, "Approved")}
                        className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer"
                      >
                        ✅ Setujui
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCutiApproval(req.id, "Rejected")}
                        className="flex-1 py-2.5 px-3 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer"
                      >
                        ❌ Tolak
                      </button>
                    </>
                  ) : (
                    <div className="w-full flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span
                        className={`text-xs font-black px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                          isApproved
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {isApproved ? "✅ DISETUJUI" : "❌ DITOLAK"}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCutiApproval(req.id, "Pending")}
                          title="Tinjau Ulang / Kembalikan ke Pending"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                        >
                          <RotateCcw size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCuti(req.id)}
                          title="Hapus Riwayat"
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
