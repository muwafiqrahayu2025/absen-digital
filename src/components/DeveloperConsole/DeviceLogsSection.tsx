import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { id as localeID } from "date-fns/locale";
import { ShieldCheck, RefreshCw, Smartphone, Tablet, Monitor } from "lucide-react";
import toast from "react-hot-toast";
import { db } from "../../lib/db";
import { DeviceSessionLog } from "../../types";
import { SystemLogViewer } from "./SystemLogViewer";

export function DeviceLogsSection() {
  const [deviceLogs, setDeviceLogs] = useState<DeviceSessionLog[]>([]);

  useEffect(() => {
    const loadLogs = () => {
      const logs = db.getDeviceSessionLogs();
      setDeviceLogs(logs);
    };
    loadLogs();
    window.addEventListener("device_session_logs_updated", loadLogs);
    return () => window.removeEventListener("device_session_logs_updated", loadLogs);
  }, []);

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black uppercase tracking-wider mb-2">
            <ShieldCheck size={14} /> Telemetry &amp; Anti-Cheat Audit
          </div>
          <h3 className="text-xl font-extrabold text-slate-800">
            Log Perangkat &amp; Jejak Sesi Pengguna
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
            Rekam jejak otomatis menggunakan <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-emerald-600">navigator.userAgent</code> / <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-emerald-600">userAgentData</code> untuk mendeteksi sistem operasi, tipe peramban, dan kategori perangkat demi investigasi indikasi kecurangan (seperti login admin di HP atau emulasi palsu).
          </p>
        </div>
        <button
          onClick={() => {
            setDeviceLogs(db.getDeviceSessionLogs());
            toast.success("Log perangkat diperbarui!");
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer shrink-0 self-start sm:self-center"
        >
          <RefreshCw size={14} /> Muat Ulang Log
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-inner">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900 text-white border-b border-slate-800 uppercase tracking-wider text-[11px] font-black">
              <th className="py-3.5 px-4">Waktu &amp; Aksi</th>
              <th className="py-3.5 px-4">Pengguna</th>
              <th className="py-3.5 px-4 text-center">Kategori</th>
              <th className="py-3.5 px-4">Sistem Operasi &amp; Browser</th>
              <th className="py-3.5 px-4">Detail Telemetri</th>
              <th className="py-3.5 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {deviceLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 font-normal">
                  Belum ada log aktivitas atau sesi perangkat tercatat.
                </td>
              </tr>
            ) : (
              deviceLogs.map((log) => {
                const dev = log.device || { os: "Unknown OS", browser: "Unknown Browser", category: "Desktop" };
                return (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900">
                        {format(new Date(log.timestamp || Date.now()), "dd MMM yyyy, HH:mm:ss", { locale: localeID })}
                      </div>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${
                        log.action === 'LOGIN' ? 'bg-blue-100 text-blue-700' :
                        log.action === 'PRESENSI_IN' ? 'bg-emerald-100 text-emerald-700' :
                        log.action === 'PRESENSI_OUT' ? 'bg-amber-100 text-amber-700' :
                        log.action === 'SECURITY_FLAG' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{log.userName || "Unknown User"}</div>
                      <div className="text-[11px] text-slate-400 capitalize">{log.userRole || "klien"} ({log.userId || "N/A"})</div>
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                        dev.category === 'Mobile' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                        dev.category === 'Tablet' ? 'bg-cyan-100 text-cyan-700 border border-cyan-200' :
                        'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {dev.category === 'Mobile' && <Smartphone size={14} />}
                        {dev.category === 'Tablet' && <Tablet size={14} />}
                        {dev.category === 'Desktop' && <Monitor size={14} />}
                        {dev.category || 'Desktop'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{dev.os}</div>
                      <div className="text-slate-500">{dev.browser}</div>
                      {dev.screenResolution && dev.screenResolution !== 'Unknown' && (
                        <div className="text-[10px] text-slate-400 mt-0.5">Layar: {dev.screenResolution}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="text-slate-700 line-clamp-2" title={log.details || ""}>
                        {log.details || "Aktivitas standar terverifikasi"}
                      </div>
                      {dev.rawUserAgent && (
                        <div className="text-[10px] text-slate-400 truncate mt-0.5 font-mono max-w-[200px]" title={dev.rawUserAgent}>
                          UA: {dev.rawUserAgent}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        log.status === 'SUSPICIOUS' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        log.status === 'BLOCKED' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {log.status || 'SUCCESS'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center text-[11px] text-slate-400 italic pt-2 pb-6 border-b border-slate-100">
        <span>🛡️ Data log ini disimpan di memori dan Firebase (hanya dapat dilihat oleh System Developer Dev).</span>
        <span>Total Log Tersimpan: <b>{deviceLogs.length}</b> sesi</span>
      </div>

      <div className="pt-6">
        <h3 className="text-xl font-extrabold text-slate-800 mb-4">Live System Error & Warnings (RAM)</h3>
        <SystemLogViewer />
      </div>
    </div>
  );
}
