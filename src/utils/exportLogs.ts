import { SystemLog } from '../hooks/useSystemLogStore';

export const downloadLogsAsJson = (logs: SystemLog[]) => {
  const data = JSON.stringify(logs, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  triggerDownload(blob, `system-logs-${getFormattedDate()}.json`);
};

export const downloadLogsAsTxt = (logs: SystemLog[]) => {
  const lines = logs.map((log) => {
    const time = new Date(log.timestamp).toLocaleString();
    let line = `[${time}] [${log.level.toUpperCase()}] ${log.message}`;
    if (log.source) {
      line += ` (Source: ${log.source})`;
    }
    if (log.stackTrace) {
      line += `\nStackTrace:\n${log.stackTrace}`;
    }
    return line;
  });

  const data = lines.join('\n\n');
  const blob = new Blob([data], { type: 'text/plain' });
  triggerDownload(blob, `system-logs-${getFormattedDate()}.txt`);
};

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const getFormattedDate = () => {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
};
