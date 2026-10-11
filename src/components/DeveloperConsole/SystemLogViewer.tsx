import React, { useEffect, useState, useRef } from 'react';
import { useSystemLogStore, SystemLog, LogLevel } from '../../hooks/useSystemLogStore';
import { downloadLogsAsJson, downloadLogsAsTxt } from '../../utils/exportLogs';
import { Terminal, Trash2, Download, Filter, Play, Square, ChevronDown, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { dbRealtime } from '../../lib/firebase';
import { ref, get } from 'firebase/database';

export const SystemLogViewer: React.FC = () => {
  const { logs, clearLogs } = useSystemLogStore();
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAutoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isAutoScroll]);

  const [fetchedLogs, setFetchedLogs] = useState<SystemLog[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    const fetchHistoricalLogs = async () => {
      setIsFetching(true);
      try {
        const logRef = ref(dbRealtime, 'audit_logs/system_console');
        const snapshot = await get(logRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          let parsedLogs = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
          })) as SystemLog[];

          const now = new Date();
          if (selectedDate !== '') {
            parsedLogs = parsedLogs.filter(log => {
              if (!log.timestamp) return false;
              const logDate = new Date(log.timestamp);
              // Handle potential timezone differences by formatting manually or relying on local timezone if preferred.
              // We'll assume the user wants logs matching their local timezone's date representation of the timestamp.
              const localDateString = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;
              return localDateString === selectedDate;
            });
          }

          // Urutkan waktu ascending (lama -> baru di bawah)
          parsedLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          setFetchedLogs(parsedLogs);
        } else {
          setFetchedLogs([]);
        }
      } catch (err) {
        console.error("Gagal menarik log historis:", err);
      } finally {
        setIsFetching(false);
      }
    };
    fetchHistoricalLogs();
  }, [selectedDate]);

  const displayLogs = fetchedLogs.filter((log) => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    return true;
  });

  const getLogColor = (level: LogLevel) => {
    switch (level) {
      case 'info': return 'text-green-400';
      case 'warn': return 'text-yellow-400';
      case 'error': return 'text-red-500';
      case 'unhandled': return 'text-purple-400 bg-purple-400/10 px-1 rounded';
      default: return 'text-gray-300';
    }
  };

  const testError = () => {
    console.log("This is a test INFO log.");
    console.warn("This is a test WARNING log.");
    console.error(new Error("This is a test ERROR object."));
  };

  return (
    <div className="flex flex-col h-full min-h-[600px] bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden font-mono text-sm">
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-300">
            <Terminal size={18} className="text-emerald-400" />
            <span className="font-semibold tracking-wider">SYSTEM CONSOLE</span>
            <span className="bg-slate-700 text-xs px-2 py-0.5 rounded-full text-slate-300">
              {logs.length} logs
            </span>
          </div>
          
          <div className="h-4 w-px bg-slate-700 mx-2" />

          {/* Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select 
              className="bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-1 outline-none focus:border-emerald-500 text-xs"
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value as LogLevel | 'all')}
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
              <option value="unhandled">Unhandled</option>
            </select>

            <div className="flex items-center gap-1">
              <input
                type="date"
                className="bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-1 outline-none focus:border-emerald-500 text-xs"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                title="Pilih tanggal log"
              />
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate('')}
                  className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
                  title="Reset Filter Tanggal"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAutoScroll(!isAutoScroll)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors text-xs font-semibold ${
              isAutoScroll ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            {isAutoScroll ? <Play size={14} /> : <Square size={14} />}
            Auto-scroll
          </button>

          <button
            onClick={testError}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors text-xs font-semibold"
          >
            Test Log
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors text-xs font-semibold"
            >
              <Download size={14} />
              Export
              <ChevronDown size={14} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-32 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-10">
                <button 
                  onClick={() => { downloadLogsAsTxt(logs); setShowExportMenu(false); }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Download .TXT
                </button>
                <button 
                  onClick={() => { downloadLogsAsJson(logs); setShowExportMenu(false); }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Download .JSON
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              clearLogs();
              setFetchedLogs([]);
              toast.success("Tampilan console dibersihkan. (Riwayat log tetap aman di database)", { duration: 4000 });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-xs font-semibold"
          >
            <Trash2 size={14} />
            Clear
          </button>
        </div>
      </div>

      {/* Log Output Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {isFetching ? (
          <div className="h-full flex items-center justify-center text-slate-500 italic">
            Mengambil riwayat log...
          </div>
        ) : displayLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 italic">
            Tidak ada riwayat log sistem untuk periode ini.
          </div>
        ) : (
          displayLogs.map((log) => (
            <div key={log.id} className="hover:bg-slate-800/50 p-1 rounded group flex items-start gap-3">
              <div className="shrink-0 text-slate-500 text-xs w-36 pt-0.5">
                {new Date(log.timestamp).toLocaleString('id-ID')}
              </div>
              <div className={`shrink-0 uppercase font-bold text-xs w-16 pt-0.5 ${getLogColor(log.level)}`}>
                [{log.level}]
              </div>
              <div className="flex-1 min-w-0 break-words">
                <span className={getLogColor(log.level)}>{log.message}</span>
                {log.source && (
                  <span className="text-slate-500 text-xs ml-2">({log.source})</span>
                )}
                {log.stackTrace && (
                  <pre className="mt-2 p-2 bg-slate-950/50 text-slate-400 text-xs rounded overflow-x-auto border border-slate-800/50 hidden group-hover:block whitespace-pre-wrap">
                    {log.stackTrace}
                  </pre>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
