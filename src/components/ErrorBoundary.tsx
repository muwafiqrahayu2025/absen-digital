import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useSystemLogStore } from '../hooks/useSystemLogStore';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  declare props: Props;

  constructor(props: Props) {
    super(props);
  }

  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application component tree:', error, errorInfo);
    useSystemLogStore.getState().addLog({
      level: 'error',
      message: error.message,
      source: 'React ErrorBoundary',
      stackTrace: errorInfo.componentStack || error.stack
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white font-sans">
          <div className="max-w-md w-full bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle size={32} />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-black tracking-tight text-slate-100">
                Sistem Menemui Kendala
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                Maaf, terjadi kesalahan tak terduga pada tampilan antarmuka. Anda dapat memuat ulang halaman untuk memulihkan sesi Anda.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/60 rounded-xl p-3 text-[10px] font-mono text-rose-300/80 text-left overflow-x-auto border border-slate-800">
                <code>{this.state.error.message}</code>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                <Home size={16} /> Ke Halaman Utama
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
              >
                <RefreshCw size={16} /> Muat Ulang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
