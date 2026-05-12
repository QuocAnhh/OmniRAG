import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen ops-root flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center">
            <div className="mb-6">
              <div className="size-16 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center">
                <svg className="size-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-[var(--color-ops-text)] mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-[var(--color-ops-muted)] mb-6">
              An unexpected error occurred. Please try reloading the page or return to the dashboard.
            </p>
            {this.state.error && (
              <pre className="mb-6 p-3 rounded-lg bg-[var(--color-ops-panel)] border border-[var(--color-ops-border)] text-xs text-left text-red-400 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-[var(--color-ops-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  window.location.href = '/dashboard';
                }}
                className="px-4 py-2 rounded-lg border border-[var(--color-ops-border)] text-[var(--color-ops-text)] text-sm font-medium hover:bg-[var(--color-ops-panel)] transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
