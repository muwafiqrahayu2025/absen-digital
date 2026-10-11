import { create } from 'zustand';

export type LogLevel = 'info' | 'warn' | 'error' | 'unhandled';

export interface SystemLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
  stackTrace?: string;
}

interface SystemLogStore {
  logs: SystemLog[];
  addLog: (log: Omit<SystemLog, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
}

const MAX_LOGS = 1000;

export const useSystemLogStore = create<SystemLogStore>((set) => ({
  logs: [],
  addLog: (log) =>
    set((state) => {
      const newLog: SystemLog = {
        ...log,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      
      const updatedLogs = [...state.logs, newLog];
      
      // Enforce FIFO limit
      if (updatedLogs.length > MAX_LOGS) {
        return { logs: updatedLogs.slice(updatedLogs.length - MAX_LOGS) };
      }
      
      return { logs: updatedLogs };
    }),
  clearLogs: () => set({ logs: [] }),
}));
