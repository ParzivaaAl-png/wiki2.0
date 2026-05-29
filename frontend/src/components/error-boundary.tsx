import * as React from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-950 text-white">
          <div className="max-w-md w-full p-8 rounded-2xl border border-red-500/20 bg-neutral-900/50 backdrop-blur-xl shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mx-auto animate-pulse">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold font-outfit tracking-tight">Что-то пошло не так</h2>
            <p className="text-sm text-neutral-400">
              Произошла непредвиденная ошибка в интерфейсе приложения.
            </p>
            <div className="p-4 rounded-lg bg-black/40 text-left text-xs font-mono text-red-400 border border-neutral-800 overflow-x-auto max-h-40">
              {this.state.error?.toString()}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/10 hover:shadow-red-600/20 transition-all duration-300"
            >
              <RefreshCw className="w-4 h-4 animate-spin-slow" />
              <span>Перезагрузить страницу</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
