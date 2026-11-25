import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected interface error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[OpesFuel ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center p-6">
          <div className="max-w-md w-full glass-surface rounded-2xl p-8 space-y-5 text-center">
            <div className="w-12 h-12 rounded-xl icon-glass mx-auto flex items-center justify-center font-mono font-bold text-slate-800">
              !
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-xl font-bold text-slate-950">
                Station workspace paused safely
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Your saved fuel shifts and accounting data are safe. Reload the screen below to continue working.
              </p>
              <div className="p-3 rounded-lg bg-slate-100 text-xs font-mono text-slate-700 break-words">
                {this.state.errorMessage}
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
              >
                Reload Station Workspace
              </button>
              <button
                type="button"
                onClick={() => {
                  window.history.replaceState(null, '', '/');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                  this.setState({ hasError: false, errorMessage: '' });
                }}
                className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-semibold"
              >
                Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
