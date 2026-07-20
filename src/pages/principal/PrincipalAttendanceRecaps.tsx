import React, { useState } from "react";
import {
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  ChevronRight,
  Briefcase,
} from "lucide-react";
import { format, subMonths } from "date-fns";
import { id } from "date-fns/locale";
import { db } from "../../lib/db";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import toast from "react-hot-toast";

export function PrincipalAttendanceRecaps() {
  const [jenisRekap, setJenisRekap] = useState("");
  const [bulan, setBulan] = useState("");
  const activeAcademicYear = db.getAcademicYears().find((ay) => ay && ay.isActive);
  const school = db.getSchool();

  // Generate last 6 months for options
  const monthOptions = [
    { value: "2026-06", label: "Juni 2026" },
    { value: "2026-05", label: "Mei 2026" },
    { value: "2026-04", label: "April 2026" },
    { value: "2026-03", label: "Maret 2026" },
    { value: "2026-02", label: "Februari 2026" },
    { value: "2026-01", label: "Januari 2026" },
  ];

  const handleDownload = () => {
    if (!jenisRekap) {
      toast.error("Pilih jenis rekapitulasi terlebih dahulu.");
      return;
    }
    if (jenisRekap === "perbulan" && !bulan) {
      toast.error("Silakan tentukan bulan laporan.");
      return;
    }

    const url = `/print/recap?jenis=${jenisRekap}${jenisRekap === "perbulan" ? `&yearmonth=${bulan}` : ""}`;
    window.open(url, "_blank");
  };

  const handleExportPDF = () => {
    if (!jenisRekap) {
      toast.error("Pilih jenis rekapitulasi fungsional terlebih dahulu.");
      return;
    }
    if (jenisRekap === "perbulan" && !bulan) {
      toast.error("Silakan tentukan bulan laporan.");
      return;
    }

    import("jspdf").then(({ jsPDF }) => {
      import("jspdf-autotable").then(({ default: autoTable }) => {
        const doc = new jsPDF("landscape");
        const school = db.getSchool();
        const kop = school?.kopSurat || {};
        const logoBase64 = kop.logo_url || school?.logo_url || school?.logoUrl;

        let startY = 15;
        // Jika ada logo berupa data base64, pasang di pojok kiri atas
        if (logoBase64 && logoBase64.startsWith("data:image/")) {
          try {
            doc.addImage(logoBase64, "JPEG", 14, startY - 3, 22, 22);
          } catch (err) {
            console.warn("Gagal merender logo ke PDF:", err);
          }
        }

        const textStartX = logoBase64 && logoBase64.startsWith("data:image/") ? 40 : 14;

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text((kop.nama_dinas || school?.nama_dinas || "Nama Yayasan/Dinas Belum Diatur").toUpperCase(), textStartX, startY);
        
        doc.setFontSize(14);
        doc.text((kop.nama_instansi || school?.nama_instansi || school?.name || "INSTANSI PENDIDIKAN UNGGULAN").toUpperCase(), textStartX, startY + 6);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(kop.alamat || school?.alamat || school?.address || "Alamat lengkap instansi/sekolah", textStartX, startY + 11);

        const kontakStr = `Telp: ${kop.telepon || school?.phone || "—"} | Email: ${kop.email || school?.adminEmail || "—"} | Web: ${kop.website || "—"} | Pos: ${kop.kode_pos || "—"}`;
        doc.text(kontakStr, textStartX, startY + 16);

        // Garis pembatas kop surat
        doc.setLineWidth(0.8);
        doc.line(14, startY + 20, 280, startY + 20);
        doc.setLineWidth(0.3);
        doc.line(14, startY + 21.5, 280, startY + 21.5);

        // Sub judul dokumen
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("REKAPITULASI DAFTAR HADIR BULANAN PEGAWAI / GURU / DOSEN", 14, startY + 29);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Tahun Ajaran   : ${activeAcademicYear?.name || "2026/2027"} (${activeAcademicYear?.semester || "Ganjil"})`, 14, startY + 36);
        doc.text(`Sifat Dokumen  : Laporan Umum Internal (Terverifikasi Sistem)`, 14, startY + 41);

        if (jenisRekap === "perbulan" && bulan) {
          const monthObj = monthOptions.find((m) => m.value === bulan);
          doc.text(`Periode Bulan   : ${monthObj?.label || bulan}`, 14, startY + 46);
        }

        const users = db.getUsers();
        const allAttendance = db.getAttendance();

        const tableBody = users.map((usr, index) => {
          let usrRecords = allAttendance.filter((a) => a.userId === usr.id);
          if (jenisRekap === "perbulan" && bulan) {
            usrRecords = usrRecords.filter((a) => a.date.startsWith(bulan));
          }

          const masukH = usrRecords.filter(
            (a) => a.status === "Hadir" || a.status === "Terlambat",
          ).length;
          const masukS = usrRecords.filter((a) => a.status === "Sakit").length;
          const masukI = usrRecords.filter((a) => a.status === "Izin").length;
          const masukA = usrRecords.filter((a) => a.status === "Alpha").length;

          const pulangH = usrRecords.filter((a) => a.checkOutTime).length;
          const pulangS = masukS;
          const pulangI = masukI;
          const pulangA = masukA + (masukH - pulangH);

          return [
            index + 1,
            `${usr.nip || "-"}`,
            usr.name,
            usr.opd || "-",
            usr.jabatan || "Guru Utama",
            masukH || "0",
            masukS || "0",
            masukI || "0",
            masukA || "0",
            pulangH || "0",
            pulangS || "0",
            pulangI || "0",
            pulangA || "0",
          ];
        });

        autoTable(doc, {
          startY: 68,
          head: [
            [
              {
                content: "No",
                rowSpan: 2,
                styles: { halign: "center", valign: "middle" },
              },
              {
                content: "ID Pegawai / NIP / NIDN / NIK",
                rowSpan: 2,
                styles: { halign: "center", valign: "middle" },
              },
              {
                content: "Nama Pegawai / Guru / Dosen",
                rowSpan: 2,
                styles: { halign: "center", valign: "middle" },
              },
              {
                content: "OPD",
                rowSpan: 2,
                styles: { halign: "center", valign: "middle" },
              },
              {
                content: "Jabatan Struktural",
                rowSpan: 2,
                styles: { halign: "center", valign: "middle" },
              },
              {
                content: "Kunjungan Masuk (Clock-In)",
                colSpan: 4,
                styles: { halign: "center" },
              },
              {
                content: "Kunjungan Pulang (Clock-Out)",
                colSpan: 4,
                styles: { halign: "center" },
              },
            ],
            [
              { content: "Hadir", styles: { halign: "center" } },
              { content: "Sakit", styles: { halign: "center" } },
              { content: "Izin", styles: { halign: "center" } },
              { content: "Tanpa Ket.", styles: { halign: "center" } },
              { content: "Hadir", styles: { halign: "center" } },
              { content: "Sakit", styles: { halign: "center" } },
              { content: "Izin", styles: { halign: "center" } },
              { content: "Tanpa Ket.", styles: { halign: "center" } },
            ],
          ],
          body: tableBody,
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [23, 162, 184] },
        });

        let filename = "Rekapitulasi_Presensi_Guru_Staf";
        if (jenisRekap === "perbulan") filename += `_${bulan}`;

        doc.save(`${filename}.pdf`);
        toast.success("Laporan PDF berhasil diunduh!");
      });
    });
  };

  const handleExportExcel = () => {
    if (!jenisRekap) {
      toast.error("Pilih jenis rekapitulasi fungsional terlebih dahulu.");
      return;
    }
    if (jenisRekap === "perbulan" && !bulan) {
      toast.error("Silakan tentukan bulan laporan.");
      return;
    }

    const users = db.getUsers();
    const allAttendance = db.getAttendance();

    const rowData: any[] = [];
    users.forEach((usr, index) => {
      let usrRecords = allAttendance.filter((a) => a.userId === usr.id);
      if (jenisRekap === "perbulan" && bulan) {
        usrRecords = usrRecords.filter((a) => a.date.startsWith(bulan));
      }

      const masukH = usrRecords.filter(
        (a) => a.status === "Hadir" || a.status === "Terlambat",
      ).length;
      const masukS = usrRecords.filter((a) => a.status === "Sakit").length;
      const masukI = usrRecords.filter((a) => a.status === "Izin").length;
      const masukA = usrRecords.filter((a) => a.status === "Alpha").length;

      const pulangH = usrRecords.filter((a) => a.checkOutTime).length;
      const pulangS = masukS;
      const pulangI = masukI;
      const pulangA = masukA + (masukH - pulangH);

      rowData.push({
        No: index + 1,
        "ID Pegawai / NIP / NIDN / NIK": usr.nip || "-",
        "Nama Pegawai / Guru / Dosen": usr.name,
        Lembaga: usr.opd || "-",
        Jabatan: usr.jabatan || "Pegawai / Guru / Dosen",
        "Masuk (Hadir)": masukH,
        "Masuk (Sakit)": masukS,
        "Masuk (Izin/Cuti)": masukI,
        "Masuk (Tanpa Ket.)": masukA,
        "Pulang (Hadir)": pulangH,
        "Pulang (Sakit)": pulangS,
        "Pulang (Izin/Cuti)": pulangI,
        "Pulang (Tanpa Ket.)": pulangA,
      });
    });

    const ws = XLSX.utils.json_to_sheet(rowData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap_Presensi");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    let filename = "Rekapitulasi_Presensi_Guru_Staf";
    if (jenisRekap === "perbulan") filename += `_${bulan}`;

    saveAs(blob, `${filename}.xlsx`);
    toast.success("Berkas Excel (XLSX) berhasil diunduh!");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left animate-fade-in font-sans">
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Briefcase className="text-[#17a2b8]" size={24} />
            Rekapitulasi Hasil Presensi Guru & Staf
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Ekspor instan laporan digital presensi, sakit, izin, dan cuti
            tahunan terverifikasi Pembina.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6">
        <div className="grid grid-cols-[165px_1fr] gap-y-3 gap-x-2 text-xs text-slate-650 font-mono uppercase">
          <div className="font-bold">Lembaga / Instansi Induk</div>
          <div>: {school?.kopSurat?.nama_dinas || school?.nama_dinas || "Nama Yayasan/Dinas Belum Diatur"}</div>

          <div className="font-bold">Tahun Ajaran</div>
          <div>
            : T.A. {activeAcademicYear?.name || "2026/2027"}{" "}
            {activeAcademicYear?.semester
              ? `(${activeAcademicYear.semester.toUpperCase()})`
              : "(GANJIL)"}
          </div>

          <div className="font-bold">Periode Tanggal</div>
          <div>: 1 Januari 2026 - 31 Desember 2026</div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
              Jenis Rekapitulasi Presensi <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-4 py-2 border border-slate-250 rounded-xl focus:outline-none focus:border-[#1d74f2] text-xs font-semibold"
              value={jenisRekap}
              onChange={(e) => setJenisRekap(e.target.value)}
            >
              <option value="">-- Pilih Format Laporan --</option>
              <option value="perbulan">Bulanan (Per-Bulan Kerja)</option>
              <option value="persemester">
                Semesteran (Kumulatif 6 Bulan)
              </option>
            </select>
          </div>

          {jenisRekap === "perbulan" && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Pilih Periode Bulan <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full px-4 py-2 border border-slate-250 rounded-xl focus:outline-none focus:border-[#1d74f2] text-xs font-semibold"
                value={bulan}
                onChange={(e) => setBulan(e.target.value)}
              >
                <option value="">-- Pilih Bulan --</option>
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-100">
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
          >
            <Printer size={14} className="text-cyan-600" /> Cetak Slip Rekapitulasi (Print)
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
          >
            <FileText size={14} className="text-red-500" /> Unduh Laporan PDF
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" /> Ekspor Dokumen Excel (XLSX)
          </button>
        </div>
      </div>
    </div>
  );
}
