import React, { useState, useEffect } from "react";
import { db } from "../../lib/db";
import { NotificationService } from "../../lib/notifications";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { id } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  ArrowLeft,
  Download,
  MapPin,
  Smartphone,
  Image,
  FileText,
  ExternalLink,
  Check,
  X,
  Send
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { CutiRequest, AttendanceRecord } from "../../types";

export function ManageAttendance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "data"; // 'data' or 'approval'
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [pegawaiSearch, setPegawaiSearch] = useState("");

  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>(() =>
    db.getAttendance(),
  );
  const [cutiList, setCutiList] = useState<CutiRequest[]>(() =>
    db.getCutiRequests(),
  );
  const [users, setUsers] = useState(() => db.getUsers());
  const activeAcademicYear = db.getAcademicYears().find((ay) => ay.isActive);

  useEffect(() => {
    const handleSync = () => {
      setAttendanceList(db.getAttendance());
      setCutiList(db.getCutiRequests());
      setUsers(db.getUsers());
    };
    window.addEventListener("attendance_synchronized", handleSync);
    window.addEventListener("cuti_updated", handleSync);
    return () => {
      window.removeEventListener("attendance_synchronized", handleSync);
      window.removeEventListener("cuti_updated", handleSync);
    };
  }, []);

  const latestScans = [...attendanceList]
    .filter((a) => a.checkInTime || a.checkOutTime)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

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
        setAttendanceList(currentAttendance);
      } catch (e) {
        console.error("Failed to create attendance entries for cuti", e);
      }
    }

    toast.success(
      `Pengajuan Cuti berhasil ${action === "Approved" ? "disetujui (Presensi otomatis dicatat)" : "ditolak"}!`,
    );
    window.dispatchEvent(new Event("cuti_updated"));
  };

  const handleTabChange = (tab: "data" | "approval") => {
    setSearchParams({ tab });
    setSelectedMonth(null);
  };

  const months = [
    { value: "2026-06", label: "Juni 2026" },
    { value: "2026-05", label: "Mei 2026" },
    { value: "2026-04", label: "April 2026" },
    { value: "2026-03", label: "Maret 2026" },
    { value: "2026-02", label: "Februari 2026" },
    { value: "2026-01", label: "Januari 2026" },
  ];

  if (selectedMonth) {
    const selectedMonthLabel = months.find(
      (m) => m.value === selectedMonth,
    )?.label;
    const year = parseInt(selectedMonth.split("-")[0]);
    const month = parseInt(selectedMonth.split("-")[1]);
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const filteredUsers = users.filter(
      (usr) =>
        usr.name.toLowerCase().includes(pegawaiSearch.toLowerCase()) ||
        (usr.nip &&
          usr.nip.toLowerCase().includes(pegawaiSearch.toLowerCase())),
    );

    const handleExportExcel = () => {
      const rowData: any[] = [];
      filteredUsers.forEach((usr, index) => {
        const usrRecords = attendanceList.filter(
          (a) => a.userId === usr.id && a.date.startsWith(selectedMonth),
        );
        let totalH = 0,
          totalS = 0,
          totalI = 0,
          totalA = 0;

        const row: any = {
          No: index + 1,
          "Nama Guru/Staf": usr.name,
          "NUPTK / NRG / PegID / NPK Kepegawaian": `/${usr.nip || "-"}`,
          "Lembaga Naungan": usr.opd || "KEMENAG",
          Jabatan: usr.jabatan || "Guru Utama",
        };

        days.forEach((d) => {
          const dateStr = `${selectedMonth}-${d.toString().padStart(2, "0")}`;
          const record = usrRecords.find((r) => r.date === dateStr);
          let statusStr = "";
          let CheckOutMark = "";

          if (record) {
            if (record.status === "Hadir" || record.status === "Terlambat") {
              totalH++;
              statusStr = "H";
            }
            if (record.status === "Sakit") {
              totalS++;
              statusStr = "S";
            }
            if (record.status === "Izin" || record.status === "Cuti Tahunan") {
              totalI++;
              statusStr = "I";
            }
            if (record.status === "Alpha") {
              totalA++;
              statusStr = "A";
            }

            if (record.checkOutTime) {
              CheckOutMark = "H";
            }
          }
          row[`Tgl ${d} (M)`] = statusStr;
          row[`Tgl ${d} (P)`] = CheckOutMark;
        });

        row["Total Hadir"] = totalH;
        row["Total Sakit"] = totalS;
        row["Total Izin/Cuti"] = totalI;
        row["Total Tanpa Keterangan"] = totalA;

        rowData.push(row);
      });

      const ws = XLSX.utils.json_to_sheet(rowData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rekap_Presensi");
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
      });
      saveAs(blob, `Rekap_Presensi_Guru_Staf_${selectedMonthLabel}.xlsx`);
    };

    const handleSendBroadcast = () => {
      if (!selectedMonth) return;
      const selectedMonthLabel = months.find((m) => m.value === selectedMonth)?.label;
      
      const filteredUsers = users.filter((u) => u.role !== "admin");
      let count = 0;

      filteredUsers.forEach((usr) => {
        const usrRecords = attendanceList.filter(
          (a) => a.userId === usr.id && a.date.startsWith(selectedMonth),
        );
        let totalH = 0, totalS = 0, totalI = 0, totalA = 0;
        usrRecords.forEach((record) => {
          if (record.status === "Hadir" || record.status === "Terlambat") totalH++;
          if (record.status === "Sakit") totalS++;
          if (record.status === "Izin" || record.status === "Cuti Tahunan") totalI++;
          if (record.status === "Alpha") totalA++;
        });

        const extraInfo = `- Hadir/Terlambat: ${totalH} Hari\n- Sakit: ${totalS} Hari\n- Izin/Cuti: ${totalI} Hari\n- Tanpa Keterangan (Alpha): ${totalA} Hari`;
        
        NotificationService.send(usr, 'MONTHLY_ATTENDANCE_SUMMARY', {
          time: selectedMonthLabel,
          extraInfo: extraInfo
        });
        count++;
      });
      
      toast.success(`Rekap bulanan berhasil disiarkan ke ${count} Guru/Staf!`);
    };

    return (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 animate-fade-in text-left">
        <div className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center">
            <button
              onClick={() => setSelectedMonth(null)}
              className="flex items-center gap-2 text-[#1d74f2] hover:text-blue-800 font-extrabold text-sm"
            >
              <ArrowLeft size={18} /> Kembali Ke Daftar Bulan
            </button>
            <div className="flex-1"></div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleSendBroadcast}
                className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#3b5bdb] to-[#1d3557] border border-[#748ffc] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_0_6px_15px_rgba(59,91,219,0.4)] hover:from-[#4c6ef5] hover:to-[#1d3557] hover:-translate-y-[2px] transition-all duration-200"
              >
                <Send size={14} className="text-blue-200" /> Siarkan Rekap Bulanan via WA/Email
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:-translate-y-[2px] transition-all duration-200"
              >
                <Download size={14} className="text-emerald-200" /> Unduh Laporan Excel (XLSX)
              </button>
            </div>
          </div>

          <div className="border-l-4 border-l-[#ffc107] pl-4 text-xs text-slate-700 grid grid-cols-[140px_1fr] gap-1 mb-6 font-mono uppercase bg-slate-50 p-4 rounded-xl">
            <div className="font-bold">Portal Induk</div>
            <div>: ABSENSI MADRASAH</div>
            <div className="font-bold">Lembaga Naungan</div>
            <div>: KEMENTERIAN AGAMA KABUPATEN DEPOK</div>
            <div className="font-bold">Periode Laporan</div>
            <div>: {selectedMonthLabel}</div>
          </div>

          {/* Live Search Block */}
          <div className="mb-4 bg-slate-50 p-4 rounded-3xl border border-slate-150 flex flex-col sm:flex-row gap-3 items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest shrink-0 text-[#1d74f2]">
              Pencarian Guru/Staf:
            </span>
            <input
              type="text"
              placeholder="Ketik nama atau NUPTK / NRG / PegID / NPK..."
              value={pegawaiSearch}
              onChange={(e) => setPegawaiSearch(e.target.value)}
              className="w-full px-4 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#17a2b8] text-white font-medium">
                <tr>
                  <th
                    rowSpan={2}
                    className="p-3 border border-slate-250 text-center w-10"
                  >
                    No
                  </th>
                  <th
                    rowSpan={2}
                    className="p-3 border border-slate-250 min-w-[150px]"
                  >
                    Nama Guru / Staf
                  </th>
                  <th
                    rowSpan={2}
                    className="p-3 border border-slate-250 min-w-[150px]"
                  >
                    NUPTK / NRG / PegID / NPK
                  </th>
                  <th
                    rowSpan={2}
                    className="p-3 border border-slate-250 text-center"
                  >
                    Lembaga Naungan
                  </th>
                  {days.map((d) => (
                    <th
                      key={d}
                      colSpan={2}
                      className="p-2 border border-slate-250 text-center bg-[#1e2336] text-[10px]"
                    >
                      {d.toString().padStart(2, "0")}
                    </th>
                  ))}
                  <th
                    colSpan={4}
                    className="p-3 border border-slate-250 text-center"
                  >
                    Jumlah Kumulatif
                  </th>
                </tr>
                <tr>
                  {days.map((d) => (
                    <React.Fragment key={d}>
                      <th className="p-1 border border-slate-200 text-center bg-[#28a745] w-6 font-mono text-[9px] text-white">
                        M
                      </th>
                      <th className="p-1 border border-slate-200 text-center bg-[#ffc107] w-6 font-mono text-[9px] text-slate-900">
                        P
                      </th>
                    </React.Fragment>
                  ))}
                  <th className="p-2 border border-slate-250 text-center bg-[#28a745] text-[10px]">
                    H
                  </th>
                  <th className="p-2 border border-slate-250 text-center bg-[#007bff] text-[10px]">
                    S
                  </th>
                  <th className="p-2 border border-slate-250 text-center bg-[#ffc107] text-slate-800 text-[10px]">
                    I
                  </th>
                  <th className="p-2 border border-slate-250 text-center bg-[#dc3545] text-[10px]">
                    A
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white text-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10 + days.length * 2}
                      className="p-8 text-center text-slate-400 font-medium font-sans bg-white"
                    >
                      Pegawai tidak ditemukan atau belum didata.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((usr, index) => {
                    const usrRecords = attendanceList.filter(
                      (a) =>
                        a.userId === usr.id && a.date.startsWith(selectedMonth),
                    );
                    let totalH = 0,
                      totalS = 0,
                      totalI = 0,
                      totalA = 0;

                    return (
                      <tr key={usr.id} className="hover:bg-slate-50/50">
                        <td className="p-3 border border-slate-200 text-center font-bold text-slate-400">
                          {index + 1}
                        </td>
                        <td className="p-3 border border-slate-200 font-bold text-slate-800">
                          {usr.name}
                        </td>
                        <td className="p-3 border border-slate-200 font-mono text-slate-500">
                          {usr.nip || "—"}
                        </td>
                        <td className="p-3 border border-slate-200 text-center text-indigo-600 font-bold text-[10px]">
                          {usr.opd || "KEMENAG"}
                        </td>

                        {days.map((d) => {
                          const dateStr = `${selectedMonth}-${d.toString().padStart(2, "0")}`;
                          const record = usrRecords.find(
                            (r) => r.date === dateStr,
                          );

                          if (record) {
                            if (
                              record.status === "Hadir" ||
                              record.status === "Terlambat"
                            )
                              totalH++;
                            if (record.status === "Sakit") totalS++;
                            if (
                              record.status === "Izin" ||
                              record.status === "Cuti Tahunan"
                            )
                              totalI++;
                            if (record.status === "Alpha") totalA++;
                          }

                          const dayOfWeek = new Date(year, month - 1, d).getDay();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday

                          return (
                            <React.Fragment key={d}>
                              <td
                                className={`p-1 border border-slate-200 text-center text-white ${isWeekend ? "bg-rose-50" : ""}`}
                              >
                                {record &&
                                  (record.status === "Hadir" ||
                                    record.status === "Terlambat") && (
                                    <div className="bg-[#28a745] w-5 h-5 mx-auto rounded-md flex items-center justify-center text-[9px] font-bold">
                                      H
                                    </div>
                                  )}
                                {record && record.status === "Sakit" && (
                                  <div className="bg-[#007bff] w-5 h-5 mx-auto rounded-md flex items-center justify-center text-[9px] font-bold">
                                    S
                                  </div>
                                )}
                                {record &&
                                  (record.status === "Izin" ||
                                    record.status === "Cuti Tahunan") && (
                                    <div className="bg-[#ffc107] text-slate-800 w-5 h-5 mx-auto rounded-md flex items-center justify-center text-[9px] font-bold">
                                      I
                                    </div>
                                  )}
                                {record && record.status === "Alpha" && (
                                  <div className="bg-[#dc3545] w-5 h-5 mx-auto rounded-md flex items-center justify-center text-[9px] font-bold">
                                    A
                                  </div>
                                )}
                              </td>
                              <td
                                className={`p-1 border border-slate-200 text-center text-white ${isWeekend ? "bg-rose-50" : ""}`}
                              >
                                {record?.checkOutTime && (
                                  <div className="bg-[#28a745] w-5 h-5 mx-auto rounded-md flex items-center justify-center text-[9px] font-bold">
                                    P
                                  </div>
                                )}
                              </td>
                            </React.Fragment>
                          );
                        })}

                        <td className="p-3 border border-slate-200 text-center font-bold text-emerald-600 font-mono">
                          {totalH || 0}
                        </td>
                        <td className="p-3 border border-slate-200 text-center font-bold text-blue-600 font-mono">
                          {totalS || 0}
                        </td>
                        <td className="p-3 border border-slate-200 text-center font-bold text-amber-600 font-mono">
                          {totalI || 0}
                        </td>
                        <td className="p-3 border border-slate-200 text-center font-bold text-rose-600 font-mono">
                          {totalA || 0}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-left">


      <h3 className="text-xl font-black text-slate-800">
        🗂️ Arsip Repositori & Rekap Absensi Bulanan
      </h3>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="font-extrabold text-[#111c2d] text-sm">
            Disiplin Presensi Yayasan / Kemenag & Aturan Pokok Akademik
          </h4>
          <p className="text-xs text-slate-400 font-sans max-w-xl">
            Pilih bulan rekap kepegawaian di bawah ini untuk melihat tabulasi
            absensi mandiri, audit geofencing koordinat, dan ekspor laporan ke
            Excel.
          </p>
        </div>
        <span className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full font-mono text-[10px] text-indigo-700 font-extrabold uppercase shrink-0">
          Siklus: {activeAcademicYear ? `${activeAcademicYear.name} (${activeAcademicYear.semester.toUpperCase()})` : "2026/GANJIL"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
        {months.map((m) => (
          <div
            key={m.value}
            onClick={() => setSelectedMonth(m.value)}
            className="bg-white rounded-3xl border border-slate-200 flex overflow-hidden cursor-pointer hover:shadow-md hover:translate-y-[-1px] transition-all duration-150 group"
          >
            <div className="bg-indigo-600 group-hover:bg-indigo-700 text-white p-5 flex items-center justify-center transition-colors">
              <CalendarIcon
                size={20}
                className="transition-transform group-hover:scale-105"
              />
            </div>
            <div className="p-4 flex items-center font-bold text-slate-700 flex-1 group-hover:text-[#1d74f2] text-xs transition">
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* Geofencing Live GPS Audit Log Section */}
      <div className="bg-white rounded-3xl border border-slate-205 border-slate-200 overflow-hidden shadow-xs mt-8">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
              <MapPin className="text-[#1d74f2]" size={16} />
              Georadar Audit: Koordinat Presensi Terkini
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Memantau jarak sesungguhnya antara pemohon absensi dengan geofence
              lingkungan Madrasah.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#17a2b8]/10 text-slate-700 text-xs font-mono font-bold">
            🎯 Radius Aman: {db.getSchool().radius || 120}m
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#17a2b8] text-white">
              <tr>
                <th className="p-3">Waktu & Tanggal</th>
                <th className="p-3">Guru / Staf Madrasah</th>
                <th className="p-3">Status</th>
                <th className="p-3">Metode Presensi</th>
                <th className="p-3 text-center">Jarak Terhitung</th>
                <th className="p-3">Koordinat GPS Lat/Lng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {latestScans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Belum ada kunjungan scan saat ini.
                  </td>
                </tr>
              ) : (
                latestScans.map((record) => {
                  const teacher = users.find((u) => u.id === record.userId);
                  const recordTime =
                    record.checkInTime || record.checkOutTime || "00:00:00";
                  const isCheckIn = !!record.checkInTime;

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50/50 transition"
                    >
                      <td className="p-3">
                        <div className="font-bold text-slate-800">
                          {format(new Date(record.date), "dd MMM yyyy")}
                        </div>
                        <div className="text-[10px] text-[#1d74f2] mt-0.5 font-bold font-mono">
                          {isCheckIn ? "📥 MASUK" : "📤 PULANG"} @ {recordTime}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-850">
                          {teacher?.name || "Pegawai"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          ID / NUPTK: {teacher?.nip || "—"}
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                            record.status === "Hadir"
                              ? "bg-emerald-100 text-emerald-800"
                              : record.status === "Terlambat"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-indigo-100 text-indigo-805"
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-600">
                        {record.method === "scanner"
                          ? "📸 Scan GPS Kamera"
                          : "🖼️ Unduh Berkas"}
                      </td>
                      <td className="p-3 text-center">
                        {record.distance !== undefined ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              record.distance <= (db.getSchool().radius || 120)
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-rose-50 text-rose-800 border border-rose-200"
                            }`}
                          >
                            🎯 {record.distance}m
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 font-mono text-[10px] text-slate-500">
                        {record.latitude
                          ? `${record.latitude.toFixed(6)}, ${record.longitude?.toFixed(6)}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
