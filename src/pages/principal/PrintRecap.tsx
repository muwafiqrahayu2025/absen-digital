import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { db } from "../../lib/db";

export function PrintRecap() {
  const [searchParams] = useSearchParams();
  const jenis = searchParams.get("jenis");
  const yearmonth = searchParams.get("yearmonth"); // e.g., "2026-06"

  const users = db.getUsers();
  const allAttendance = db.getAttendance();
  const school: any = ({ name: (JSON.parse(localStorage.getItem("active_session_user") || "{}")).satuanKerja || (JSON.parse(localStorage.getItem("active_session_user") || "{}")).opd || "Instansi", radius: 120, address: "", kopSurat: null, latitude: 0, longitude: 0 } as any);
  const activeAcademicYear = db.getAcademicYears().find((ay) => ay && ay.isActive);

  useEffect(() => {
    // Automatically open print dialog when component is mounted
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="p-8 max-w-6xl mx-auto bg-white min-h-screen text-black font-serif"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {/* HEADER KOP SURAT RESMI */}
      <div className="flex items-center justify-between gap-6 pb-4 mb-6 border-b-4 border-double border-black">
        {/* Logo Kiri */}
        <div className="w-24 shrink-0 flex items-center justify-center">
          <img
            src={school?.kopSurat?.logo_url || school?.logo_url || school?.logoUrl || "/logo.png"}
            alt="Logo Instansi"
            className="max-h-24 max-w-full object-contain"
          />
        </div>

        {/* Teks Kop Tengah */}
        <div className="flex-1 text-center space-y-0.5">
          <p className="text-sm font-bold tracking-wide uppercase">
            {school?.kopSurat?.nama_dinas || school?.nama_dinas || "Nama Yayasan/Dinas Belum Diatur"}
          </p>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-tight">
            {school?.kopSurat?.nama_instansi || school?.nama_instansi || school?.name || "SMA / SMP / KAMPUS UNGGULAN NUSANTARA"}
          </h1>
          <p className="text-xs font-medium max-w-3xl mx-auto leading-snug pt-0.5">
            {school?.kopSurat?.alamat || school?.alamat || school?.address || "Alamat Lengkap Instansi / Sekolah / Kampus"}
          </p>
          <div className="text-[11px] font-medium pt-0.5 flex flex-wrap items-center justify-center gap-x-4">
            {school?.kopSurat?.telepon || school?.phone ? (
              <span><b>Telp/Fax:</b> {school?.kopSurat?.telepon || school?.phone}</span>
            ) : null}
            {school?.kopSurat?.email || school?.adminEmail ? (
              <span><b>Email:</b> {school?.kopSurat?.email || school?.adminEmail}</span>
            ) : null}
            {school?.kopSurat?.website || school?.website ? (
              <span><b>Website:</b> {school?.kopSurat?.website || school?.website}</span>
            ) : null}
            {school?.kopSurat?.kode_pos || school?.kode_pos ? (
              <span><b>Kode Pos:</b> {school?.kopSurat?.kode_pos || school?.kode_pos}</span>
            ) : null}
          </div>
        </div>

        {/* Spacer Kanan agar persis seimbang dan simetris */}
        <div className="w-24 shrink-0 hidden md:block" />
      </div>

      <div className="text-center mb-6">
        <h3 className="text-base font-bold uppercase underline">
          REKAPITULASI DAFTAR HADIR BULANAN PEGAWAI / GURU / DOSEN
        </h3>
      </div>

      <div className="mb-6 grid grid-cols-[180px_1fr] gap-1 text-xs">
        <div className="font-bold">Dokumen Kerja</div>
        <div>: {school?.kopSurat?.nama_dinas || school?.nama_dinas || "Nama Yayasan/Dinas Belum Diatur"}</div>

        <div className="font-bold">Tahun Ajaran / Akademik</div>
        <div>: T.A. {activeAcademicYear?.name || "2026/2027"}</div>

        <div className="font-bold">Jenis Laporan Rekap</div>
        <div className="capitalize">
          :{" "}
          {jenis === "perbulan" ? "Laporan Bulanan" : `Kumulatif Semester ${activeAcademicYear?.semester || "Ganjil"}`}
        </div>

        {jenis === "perbulan" && yearmonth && (
          <>
            <div className="font-bold">Periode Bulan</div>
            <div className="capitalize">
              :{" "}
              {new Date(yearmonth + "-01").toLocaleDateString("id-ID", {
                month: "long",
                year: "numeric",
              })}
            </div>
          </>
        )}

        <div className="font-bold">Tanggal Cetak</div>
        <div>
          :{" "}
          {new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>

      <table className="w-full text-xs border-collapse border border-black text-center">
        <thead>
          <tr className="bg-slate-50">
            <th className="border border-black p-2" rowSpan={3}>
              No
            </th>
            <th className="border border-black p-2" rowSpan={3}>
              ID Pegawai / NIP / NIDN / NIK
            </th>
            <th className="border border-black p-2" rowSpan={3}>
              Nama Lengkap Pegawai / Guru / Dosen
            </th>
            <th className="border border-black p-2" rowSpan={3}>
              Lembaga
            </th>
            <th className="border border-black p-2" rowSpan={3}>
              L/P
            </th>
            <th className="border border-black p-2" colSpan={8}>
              Sifat Kehadiran Kumulatif (Hari)
            </th>
          </tr>
          <tr className="bg-slate-50">
            <th className="border border-black p-2" colSpan={4}>
              Sesi Masuk (Clock-In)
            </th>
            <th className="border border-black p-2" colSpan={4}>
              Sesi Pulang (Clock-Out)
            </th>
          </tr>
          <tr className="bg-slate-50">
            <th className="border border-black p-1 w-8">H</th>
            <th className="border border-black p-1 w-8">S</th>
            <th className="border border-black p-1 w-8">I</th>
            <th className="border border-black p-1 w-8">A</th>
            <th className="border border-black p-1 w-8">H</th>
            <th className="border border-black p-1 w-8">S</th>
            <th className="border border-black p-1 w-8">I</th>
            <th className="border border-black p-1 w-8">A</th>
          </tr>
        </thead>
        <tbody>
          {users.map((usr, index) => {
            let usrRecords = allAttendance.filter((a) => a.userId === usr.id);
            if (jenis === "perbulan" && yearmonth) {
              usrRecords = usrRecords.filter((a) =>
                a.date.startsWith(yearmonth),
              );
            }

            const masukH = usrRecords.filter(
              (a) => a.status === "Hadir" || a.status === "Terlambat",
            ).length;
            const masukS = usrRecords.filter(
              (a) => a.status === "Sakit",
            ).length;
            const masukI = usrRecords.filter((a) => a.status === "Izin").length;
            const masukA = usrRecords.filter(
              (a) => a.status === "Alpha",
            ).length;

            const pulangH = usrRecords.filter((a) => a.checkOutTime).length;
            const pulangS = masukS;
            const pulangI = masukI;
            const pulangA = masukA + (masukH - pulangH);

            return (
              <tr key={usr.id} className="hover:bg-slate-100 transition">
                <td className="border border-black p-2">{index + 1}</td>
                <td className="border border-black p-2 font-mono text-left">
                  {usr.nip || "—"}
                </td>
                <td className="border border-black p-2 text-left font-bold">
                  {usr.name}
                </td>
                <td className="border border-black p-2">
                  {usr.opd || "-"}
                </td>
                <td className="border border-black p-2">
                  {usr.gender === "Perempuan" ? "P" : "L"}
                </td>
                <td className="border border-black p-2">{masukH || "0"}</td>
                <td className="border border-black p-2">{masukS || "0"}</td>
                <td className="border border-black p-2">{masukI || "0"}</td>
                <td className="border border-black p-2">{masukA || "0"}</td>
                <td className="border border-black p-2">{pulangH || "0"}</td>
                <td className="border border-black p-2">{pulangS || "0"}</td>
                <td className="border border-black p-2">{pulangI || "0"}</td>
                <td className="border border-black p-2">{pulangA || "0"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Signature and Approval Line block */}
      <div className="mt-12 grid grid-cols-2 gap-8 text-xs text-center border-t border-slate-100 pt-6">
        <div>
          <p className="font-bold">Mengetahui,</p>
          <p className="font-bold underline uppercase mt-16">
            Ketua Yayasan / Kepala Dinas / Rektor
          </p>
          <p className="font-mono text-[10px]">ID Instansi / NIP: —</p>
        </div>
        <div>
          <p className="font-bold">
            Kepala Sekolah / Rektor / Direktur,
          </p>
          <p className="font-bold underline uppercase mt-16">
            {school?.principalName || "Drs. Supian Suri, M.M."}
          </p>
          <p className="font-mono text-[10px]">
            NIP / NIDN / NIK: {school?.principalNip || "197302271999031002"}
          </p>
        </div>
      </div>

      <style>
        {`
          @media print {
            body { -webkit-print-color-adjust: exact; background-color: #fff !important; }
            @page { size: landscape; margin: 1.5cm; }
            .no-print { display: none !important; }
          }
        `}
      </style>
    </div>
  );
}
