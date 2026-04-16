import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card rounded-lg border border-border p-8 shadow-whisper">
          <div className="flex items-start gap-4">
            <div className="shrink-0 size-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="size-5 text-destructive" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-2xl text-foreground mb-2">Có gì đó không ổn</h2>
              <p className="text-sm text-warm-olive leading-relaxed mb-4">
                Ứng dụng gặp lỗi không mong muốn. Hãy thử tải lại — nếu vẫn lỗi, liên hệ hỗ trợ.
              </p>
              {import.meta.env.DEV && (
                <pre className="text-xs text-warm-stone bg-muted rounded p-3 mb-4 overflow-x-auto font-mono">
                  {error.message}
                </pre>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={this.reset}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary text-card px-4 py-2 text-sm font-medium shadow-ring-primary hover:bg-terracotta-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Thử lại
                </button>
                <button
                  type="button"
                  onClick={() => window.location.assign('/')}
                  className="inline-flex items-center gap-2 rounded-lg bg-warm-sand text-warm-charcoal px-4 py-2 text-sm font-medium shadow-ring hover:bg-warm-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
                >
                  Về trang chủ
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
