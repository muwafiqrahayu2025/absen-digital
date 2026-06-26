import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "react-hot-toast";
import {
  QrCode,
  Printer,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Upload,
  Trash2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { db } from "../../lib/db";

export function GenerateQR() {
  const [sessionName, setSessionName] = useState("Absensi Harian");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const school = db.getSchool();
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    const saved = localStorage.getItem("qr_embedded_logo_admin");
    return saved || school.logoUrl || "/logo.png";
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL("image/jpeg", 0.8);
          setLogoUrl(base64);
          localStorage.setItem("qr_embedded_logo_admin", base64);
          toast.success("Logo kustom berhasil dipasang pada QR Code!");
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };
  const [qrType, setQrType] = useState<"check_in" | "check_out">("check_in");
  const [token, setToken] = useState(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const existing = localStorage.getItem("current_active_qr");
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        // Reuse token only if it was generated for today
        if (parsed.date === todayStr) {
          return parsed.token;
        }
      } catch (e) {}
    }
    return "TOKEN-" + Math.random().toString(36).substring(2, 10).toUpperCase();
  });

  // Calculate date 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [logStartDate, setLogStartDate] = useState(
    sevenDaysAgo.toISOString().slice(0, 10),
  );
  const [logEndDate, setLogEndDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [logs, setLogs] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [qrTimestamp, setQrTimestamp] = useState<number>(() => {
    const existing = localStorage.getItem("current_active_qr");
    if (existing) {
      try {
        return JSON.parse(existing).timestamp || Date.now();
      } catch (e) {}
    }
    return Date.now();
  });

  const qrValue = `${window.location.origin}/teacher/scan?session=${encodeURIComponent(sessionName)}&date=${date}&type=${qrType}&token=${token}&timestamp=${qrTimestamp}`;

  // Keep localStorage in sync so ScanQR can validate successfully
  useEffect(() => {
    const newTimestamp = Date.now();
    setQrTimestamp(newTimestamp);
    const payload = {
      session: sessionName,
      date: date,
      type: qrType,
      token: token,
      timestamp: newTimestamp,
    };
    localStorage.setItem("current_active_qr", JSON.stringify(payload));
  }, [sessionName, date, qrType, token]);

  // Auto-refresh token at midnight if the page is left open
  useEffect(() => {
    const checkMidnight = setInterval(() => {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (date !== todayStr) {
        setDate(todayStr);
        setToken("TOKEN-" + Math.random().toString(36).substring(2, 10).toUpperCase());
        toast.success("Hari berganti! Token QR otomatis diperbarui untuk hari ini.");
      }
    }, 60000); // Check every 60 seconds
    return () => clearInterval(checkMidnight);
  }, [date]);

  const handleRegenerateToken = () => {
    setToken(
      "TOKEN-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    const headers = ["No", "Tanggal", "Nama Pegawai", "Waktu Scan", "Status"];
    const csvRows = [headers.join(",")];

    logs.forEach((log, index) => {
      csvRows.push(
        `${index + 1},"${log.date}","${log.name}","${log.time}","${log.status}"`,
      );
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const fileNameDate =
      logStartDate === logEndDate
        ? logStartDate
        : `${logStartDate}_to_${logEndDate}`;
    link.setAttribute("download", `Log_Scan_${fileNameDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const fetchLogs = () => {
      const allAttendance = db.getAttendance();
      const users = db.getUsers();

      const sessionRecords = allAttendance.filter(
        (a) => a.date >= logStartDate && a.date <= logEndDate,
      );

      const structuredLogs = sessionRecords
        .map((record) => {
          const user = users.find((u) => u.id === record.userId);
          return {
            id: record.id,
            date: record.date,
            name: user?.name || "Unknown",
            time: record.checkInTime || "",
            status: record.status,
          };
        })
        .filter((log) => log.time !== "")
        .sort((a, b) => {
          if (b.date !== a.date) return b.date.localeCompare(a.date);
          return b.time.localeCompare(a.time);
        });

      setLogs(structuredLogs);

      // Calculate chart data
      const totalTeachers = users.length;
      const newTrendData = [];
      const start = new Date(logStartDate);
      const end = new Date(logEndDate);

      let current = new Date(start);
      let daysCount = 0;
      while (current <= end && daysCount < 60) {
        const dateStr = current.toISOString().slice(0, 10);
        const scansOnDate = structuredLogs.filter(
          (log) => log.date === dateStr,
        ).length;
        // Also format dates nicely if desired
        newTrendData.push({
          date: new Date(dateStr).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
          }),
          pemindaian: scansOnDate,
          totalPegawai: totalTeachers,
        });
        current.setDate(current.getDate() + 1);
        daysCount++;
      }
      setTrendData(newTrendData);
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000); // Poll for new scans
    return () => clearInterval(interval);
  }, [logStartDate, logEndDate]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 tracking-tight pb-4 border-b border-slate-200 print:hidden">
        Buat Kode QR Presensi
      </h2>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col lg:flex-row gap-8 items-start print:hidden">
        <div className="w-full lg:w-1/2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nama Sesi / Kelas
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-250 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium font-sans"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tanggal
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-250 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium font-sans"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tipe Presensi
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setQrType("check_in")}
                className={`flex items-center justify-center gap-2 py-2.5 px-6 font-bold text-white text-xs rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200 ${
                  qrType === "check_in" ? "opacity-100 scale-105" : "opacity-50 hover:opacity-75"
                }`}
              >
                📥 Presensi Masuk
              </button>
              <button
                type="button"
                onClick={() => setQrType("check_out")}
                className={`flex items-center justify-center gap-2 py-2.5 px-6 font-bold text-white text-xs rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200 ${
                  qrType === "check_out" ? "opacity-100 scale-105" : "opacity-50 hover:opacity-75"
                }`}
              >
                📤 Presensi Pulang
              </button>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm font-medium text-slate-700">
                Token Keamanan
              </span>
              <button
                type="button"
                onClick={handleRegenerateToken}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                title="Ganti token baru secara instan"
              >
                🔄 Refresh Token
              </button>
            </div>
            <div className="px-3 py-2 bg-slate-50 text-slate-600 rounded-xl border border-slate-150 text-xs font-mono font-bold select-all tracking-wider text-center">
              {token}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Logo Tengah QR Code (Opsional)
            </label>
            <input
              type="file"
              id="qr-logo-upload"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => document.getElementById('qr-logo-upload')?.click()}
                className="flex items-center justify-center gap-2 w-full sm:w-auto py-2 px-4 font-bold text-white text-xs rounded-xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
              >
                <Upload size={14} /> Pilih File Logo
              </button>
              <span className="text-xs text-slate-400">
                {logoUrl && logoUrl !== (school.logoUrl || "/logo.png") ? "Logo kustom aktif" : "Tidak ada file yang dipilih"}
              </span>
              {logoUrl && logoUrl !== (school.logoUrl || "/logo.png") && (
                <button
                  type="button"
                  onClick={() => {
                    const defaultLogo = school.logoUrl || "/logo.png";
                    setLogoUrl(defaultLogo);
                    localStorage.removeItem("qr_embedded_logo_admin");
                    toast.success("Logo dikembalikan ke default sekolah.");
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-4 font-bold text-white text-xs rounded-xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3)] hover:from-[#c24bff] hover:to-[#8630db] active:translate-y-0.5 transition-all duration-200"
                >
                  <Trash2 size={14} /> Hapus Logo Kustom
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-6 sm:p-8 bg-slate-50 relative min-h-[380px]">
          {/* Row untuk tombol cetak agar tidak menabrak card */}
          <div className="w-full flex justify-end mb-4 print:hidden">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
              title="Cetak QR Code"
            >
              <Printer size={15} className="text-[#0168fa]" />
              <span>Print</span>
            </button>
          </div>
          <div className="bg-white p-6 pt-10 rounded-2xl shadow-md border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden group w-full max-w-[290px]">
            <span
              className={`absolute top-0 right-0 left-0 text-[10px] uppercase font-black text-center py-1.5 tracking-widest text-white shadow-xs ${
                qrType === "check_in" ? "bg-emerald-600" : "bg-amber-600"
              }`}
            >
              {qrType === "check_in" ? "📥 Presensi Masuk" : "📤 Presensi Pulang"}
            </span>
            <div className="mt-2">
              <QRCodeSVG
                value={qrValue}
                size={220}
                style={{ width: "100%", height: "auto", maxWidth: "220px" }}
                className="mb-4 group-hover:scale-105 transition-transform duration-250"
                imageSettings={logoUrl ? {
                  src: logoUrl,
                  x: undefined,
                  y: undefined,
                  height: 44,
                  width: 44,
                  excavate: true,
                } : undefined}
              />
            </div>
            <p className="font-extrabold text-slate-800 text-base mt-2 text-center uppercase tracking-wide">
              {sessionName}
            </p>
            <p className="text-slate-400 font-bold text-[10px] mt-1">{date}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:hidden mb-6">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Tren Partisipasi Presensi</h3>
        </div>
        <div className="p-4 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trendData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "#64748b" }}
                tickMargin={10}
                axisLine={{ stroke: "#cbd5e1" }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "#64748b" }}
                tickMargin={10}
                axisLine={{ stroke: "#cbd5e1" }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "0.5rem",
                  border: "none",
                  boxShadow:
                    "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
              <Line
                type="monotone"
                dataKey="pemindaian"
                name="Kehadiran Guru/Staf"
                stroke="#1d74f2"
                strokeWidth={3}
                activeDot={{ r: 8 }}
              />
              <Line
                type="monotone"
                dataKey="totalPegawai"
                name="Total Guru/Staf"
                stroke="#94a3b8"
                strokeDasharray="5 5"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4">
          <h3 className="font-bold text-slate-800">
            Riwayat Pemindaian ({logs.length})
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={logStartDate}
                onChange={(e) => setLogStartDate(e.target.value)}
                className="text-xs px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
              />
              <span className="text-slate-500 text-xs">s/d</span>
              <input
                type="date"
                value={logEndDate}
                onChange={(e) => setLogEndDate(e.target.value)}
                className="text-xs px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>

            {logStartDate === new Date().toISOString().slice(0, 10) &&
              logEndDate === new Date().toISOString().slice(0, 10) && (
                <span className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Real-time
                </span>
              )}
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-6 font-bold text-white text-sm rounded-2xl bg-gradient-to-b from-[#b829ff] to-[#7928CA] border border-[#d185ff] shadow-[inset_0_2px_1px_rgba(255,255,255,0.5),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_6px_15px_rgba(121,40,202,0.4)] hover:from-[#c24bff] hover:to-[#8630db] hover:shadow-[inset_0_2px_1px_rgba(255,255,255,0.6),_inset_0_-3px_2px_rgba(0,0,0,0.3),_0_8px_20px_rgba(121,40,202,0.5)] hover:-translate-y-[2px] active:from-[#7928CA] active:to-[#5e1e9d] active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.3),_0_2px_4px_rgba(121,40,202,0.3)] active:translate-y-[2px] transition-all duration-200"
              title="Ekspor Log ke CSV"
            >
              <Download size={14} className="text-emerald-600" /> Ekspor CSV
            </button>
          </div>
        </div>
        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 py-12">
              <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>Belum ada yang melakukan pemindaian hari ini.</p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-slate-800">{log.name}</p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Clock size={12} /> {log.date} {log.time}
                  </p>
                </div>
                <div>
                  {log.status === "Hadir" && (
                    <span className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      <CheckCircle size={14} /> Hadir
                    </span>
                  )}
                  {log.status === "Terlambat" && (
                    <span className="flex items-center gap-1 text-sm text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                      <Clock size={14} /> Terlambat
                    </span>
                  )}
                  {(log.status === "Sakit" || log.status === "Izin") && (
                    <span className="flex items-center gap-1 text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                      <CheckCircle size={14} /> {log.status}
                    </span>
                  )}
                  {log.status === "Alpha" && (
                    <span className="flex items-center gap-1 text-sm text-red-600 bg-red-50 px-2 py-1 rounded-full">
                      <XCircle size={14} /> Alpha
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* DEDICATED PRINT TEMPLATE (ONLY VISIBLE WHEN PRINTING) */}
      <div className="hidden print:flex flex-col items-center justify-center min-h-screen py-6 px-8 w-full text-slate-900 bg-white box-border print-color-adjust-exact">
        
        {/* Main Poster Container */}
        <div className="w-full max-w-2xl h-full mx-auto flex flex-col border-2 border-slate-300 rounded-[2.5rem] shadow-sm overflow-hidden bg-white">
          
          {/* Header Area (Kop Surat) */}
          <div className="flex items-center justify-between px-8 py-6 bg-slate-50 border-b-2 border-slate-200 shrink-0">
            <div className="w-24 shrink-0 flex items-center justify-center">
              <img src={logoUrl} alt="Logo" className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-sm" />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <h1 className="text-2xl sm:text-3xl font-black uppercase text-center tracking-tight text-slate-800 leading-tight">
                {school.name}
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1 text-center">
                {school.address || "Sistem Presensi Digital Madrasah"}
              </p>
            </div>
            <div className="w-24 shrink-0 flex items-center justify-center">
                <div className="w-16 h-16 opacity-10">
                   <QrCode className="w-full h-full text-slate-800" />
                </div>
            </div>
          </div>

          {/* Body Area */}
          <div className="flex-1 flex flex-col items-center justify-center px-10 py-6 relative">
            
            {/* Status Badge */}
            <div className={`px-10 py-2 rounded-full border-2 text-lg font-black uppercase tracking-widest mb-6 ${
                qrType === "check_in" 
                  ? "bg-emerald-50 border-emerald-500 text-emerald-700" 
                  : "bg-amber-50 border-amber-500 text-amber-700"
              }`}>
              {qrType === "check_in" ? "📥 PRESENSI MASUK" : "📤 PRESENSI PULANG"}
            </div>

            <div className="mb-4 text-center">
               <h2 className="text-3xl font-extrabold uppercase tracking-widest text-slate-900">
                 {sessionName}
               </h2>
               <p className="text-lg font-bold text-slate-400 tracking-wider mt-1">{date}</p>
            </div>

            {/* QR Code Frame with Corner Accents */}
            <div className="relative mt-6 mb-4 transform scale-95">
              <div className="absolute -top-6 -left-6 w-12 h-12 border-t-4 border-l-4 border-slate-300 rounded-tl-3xl"></div>
              <div className="absolute -top-6 -right-6 w-12 h-12 border-t-4 border-r-4 border-slate-300 rounded-tr-3xl"></div>
              <div className="absolute -bottom-6 -left-6 w-12 h-12 border-b-4 border-l-4 border-slate-300 rounded-bl-3xl"></div>
              <div className="absolute -bottom-6 -right-6 w-12 h-12 border-b-4 border-r-4 border-slate-300 rounded-br-3xl"></div>
              
              <div className="bg-white p-4 rounded-3xl relative z-10 shadow-sm border border-slate-100">
                <QRCodeSVG
                  value={qrValue}
                  size={320}
                  style={{ width: "100%", height: "auto", maxWidth: "320px" }}
                  imageSettings={logoUrl ? {
                    src: logoUrl,
                    x: undefined,
                    y: undefined,
                    height: 64,
                    width: 64,
                    excavate: true,
                  } : undefined}
                />
              </div>
            </div>

            <div className="mt-6 font-bold text-slate-700 text-lg uppercase tracking-widest bg-slate-100 px-6 py-2 rounded-full border border-slate-200">
              Arahkan Kamera ke Kode QR
            </div>
            
          </div>

          {/* Footer Area */}
          <div className="bg-slate-800 text-white py-5 px-10 text-center shrink-0">
             <p className="font-semibold text-xs tracking-wide opacity-90">
               TATA CARA: 1. Buka Aplikasi &nbsp;&bull;&nbsp; 2. Pilih Menu "Scan QR" &nbsp;&bull;&nbsp; 3. Pindai Secara Jelas
             </p>
          </div>

        </div>
      </div>

    </div>
  );
}
