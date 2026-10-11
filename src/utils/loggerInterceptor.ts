import { useSystemLogStore } from '../hooks/useSystemLogStore';
import toast from 'react-hot-toast';
import { dbRealtime } from '../lib/firebase';
import { ref, push, serverTimestamp } from 'firebase/database';

let isInitialized = false;

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Store original toast method
const originalToastError = toast.error;

// Extract meaningful string from various argument types
const parseArguments = (args: any[]): string => {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.message || String(arg);
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    })
    .join(' ');
};

const pushLogToFirebase = async (logData: any) => {
  try {
    if (dbRealtime) {
      const logRef = ref(dbRealtime, 'audit_logs/system_console');
      await push(logRef, {
        ...logData,
        timestamp: new Date().toISOString(),
        serverTime: serverTimestamp()
      });
    }
  } catch (e) {
    // Abaikan secara diam-diam. Jangan gunakan console.error agar tidak infinite loop
  }
};

const handleWindowError = (event: ErrorEvent) => {
  const logData = {
    level: 'error' as const,
    message: event.message || 'Unknown window error',
    source: event.filename ? `${event.filename}:${event.lineno}` : 'window.onerror',
    stackTrace: event.error?.stack,
  };
  useSystemLogStore.getState().addLog(logData);
  pushLogToFirebase(logData);
};

const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  const reason = event.reason;
  let message = 'Unhandled Promise Rejection';
  let stack = undefined;

  if (reason instanceof Error) {
    message = reason.message;
    stack = reason.stack;
  } else if (typeof reason === 'string') {
    message = reason;
  } else {
    try {
      message = JSON.stringify(reason);
    } catch (e) {
      message = String(reason);
    }
  }

  const logData = {
    level: 'unhandled' as const,
    message: message,
    source: 'unhandledrejection',
    stackTrace: stack,
  };
  useSystemLogStore.getState().addLog(logData);
  pushLogToFirebase(logData);
};

export const initLoggerInterceptor = () => {
  if (isInitialized) return;
  isInitialized = true;

  // Override console.log
  console.log = (...args: any[]) => {
    originalConsoleLog.apply(console, args);
    const logData = {
      level: 'info' as const,
      message: parseArguments(args),
      source: 'console.log',
    };
    useSystemLogStore.getState().addLog(logData);
    pushLogToFirebase(logData);
  };

  // Override console.info
  console.info = (...args: any[]) => {
    originalConsoleInfo.apply(console, args);
    const logData = {
      level: 'info' as const,
      message: parseArguments(args),
      source: 'console.info',
    };
    useSystemLogStore.getState().addLog(logData);
    pushLogToFirebase(logData);
  };

  // Override console.warn
  console.warn = (...args: any[]) => {
    originalConsoleWarn.apply(console, args);
    const logData = {
      level: 'warn' as const,
      message: parseArguments(args),
      source: 'console.warn',
    };
    useSystemLogStore.getState().addLog(logData);
    pushLogToFirebase(logData);
  };

  // Override console.error
  console.error = (...args: any[]) => {
    originalConsoleError.apply(console, args);
    
    // Attempt to extract stack trace if an Error object is passed
    let stackTrace = undefined;
    const errorObj = args.find((arg) => arg instanceof Error);
    if (errorObj) {
      stackTrace = errorObj.stack;
    }

    const logData = {
      level: 'error' as const,
      message: parseArguments(args),
      source: 'console.error',
      stackTrace: stackTrace,
    };
    useSystemLogStore.getState().addLog(logData);
    pushLogToFirebase(logData);
  };

  // Override toast.error
  toast.error = ((message: any, options?: any) => {
    const result = originalToastError(message, options);
    
    let msgString = 'Unknown toast error';
    if (typeof message === 'string') {
      msgString = message;
    } else if (message && typeof message.toString === 'function') {
      msgString = message.toString();
    }

    const logData = {
      level: 'error' as const,
      message: msgString,
      source: 'toast.error',
    };
    useSystemLogStore.getState().addLog(logData);
    pushLogToFirebase(logData);
    
    return result;
  }) as typeof toast.error;

  // Add global event listeners
  window.addEventListener('error', handleWindowError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
};

export const cleanupLoggerInterceptor = () => {
  if (!isInitialized) return;

  // Restore original console methods
  console.log = originalConsoleLog;
  console.info = originalConsoleInfo;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;

  // Restore original toast method
  toast.error = originalToastError;

  // Remove global event listeners
  window.removeEventListener('error', handleWindowError);
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);

  isInitialized = false;
};
