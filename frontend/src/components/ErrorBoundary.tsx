import { Component, type ErrorInfo, type ReactNode } from 'react';
import { telemetry } from '../telemetry';

interface Props {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}

interface State {
  readonly error: Error | null;
}

/** React error boundary with a user-safe fallback. Logs to console for developer visibility. */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
    telemetry.trackException(error, {
      componentStack: info.componentStack ?? '',
    });
  }

  render(): ReactNode {
    if (this.state.error !== null) {
      return (
        this.props.fallback ?? (
          <main id="main-content" tabIndex={-1} className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="text-muted-foreground">Please refresh the page or try again later.</p>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              onClick={() => { window.location.reload(); }}
              data-test-id="error-boundary-reload-button"
            >
              Reload page
            </button>
          </main>
        )
      );
    }

    return this.props.children;
  }
}
