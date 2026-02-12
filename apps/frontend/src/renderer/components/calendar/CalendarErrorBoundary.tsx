import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { captureException, trackReactError } from '../../lib/errorTracking';

interface CalendarErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<CalendarErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface CalendarErrorFallbackProps {
  error: Error;
  retry: () => void;
}

interface CalendarErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Default fallback component for calendar errors.
 * Provides a user-friendly error message with retry capability.
 */
function DefaultErrorFallback({ error, retry }: CalendarErrorFallbackProps) {
  const { t } = useTranslation(['calendar', 'common']);

  const handleReportIssue = () => {
    // Open GitHub issues with pre-filled error information
    const issueUrl = new URL('https://github.com/AndyMik90/Auto-Claude/issues/new');
    issueUrl.searchParams.set('title', `Calendar Error: ${error.name}`);
    issueUrl.searchParams.set(
      'body',
      `## Error Description

${error.message}

## Stack Trace

\`\`\`
${error.stack}
\`\`\`

## Context

- Component: CalendarView
- User Action: Please describe what you were doing when the error occurred
`
    );
    window.electronAPI?.openExternal(issueUrl.toString());
  };

  return (
    <div
      className="flex h-full items-center justify-center bg-background"
      role="alert"
      aria-live="assertive"
    >
      <div className="max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        {/* Error icon */}
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
          </div>
        </div>

        {/* Error title */}
        <h2 className="mb-2 text-center text-xl font-semibold text-foreground">
          {t('calendar:errorBoundary.title')}
        </h2>

        {/* Error description */}
        <p className="mb-4 text-center text-sm text-muted-foreground">
          {t('calendar:errorBoundary.description')}
        </p>

        {/* Detailed message */}
        <div className="mb-4 rounded-md bg-muted p-3">
          <p className="text-sm text-foreground">
            {t('calendar:errorBoundary.message')}
          </p>
        </div>

        {/* Error details (collapsible in production) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-4">
            <summary className="mb-2 cursor-pointer text-sm font-medium text-foreground">
              {t('calendar:errorBoundary.errorDetails')}
            </summary>
            <pre className="overflow-auto rounded-md bg-muted p-2 text-xs text-muted-foreground">
              {error.name}: {error.message}
              {'\n'}
              {error.stack}
            </pre>
          </details>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={retry}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={t('calendar:errorBoundary.retry')}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('calendar:errorBoundary.retry')}
          </button>

          <button
            onClick={handleReportIssue}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={t('calendar:errorBoundary.reportIssue')}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {t('calendar:errorBoundary.reportIssue')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Calendar Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing
 * the entire application with a white screen.
 *
 * This is a CLASS component (React limitation - error boundaries cannot
 * be functional components).
 *
 * @example
 * ```tsx
 * <CalendarErrorBoundary>
 *   <CalendarView projectId={projectId} />
 * </CalendarErrorBoundary>
 * ```
 */
export class CalendarErrorBoundary extends Component<
  CalendarErrorBoundaryProps,
  CalendarErrorBoundaryState
> {
  constructor(props: CalendarErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Update state so the next render will show the fallback UI.
   * Called when an error is thrown in a child component.
   */
  static getDerivedStateFromError(error: Error): CalendarErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   * Log the error to an error reporting service.
   * Called after an error has been thrown by a child component.
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console for development
    console.error('[Calendar Error Boundary]', error, errorInfo);

    // Track error with Sentry and unified error tracking
    trackReactError(error, errorInfo, 'Calendar');

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  /**
   * Reset the error state and retry rendering the child components.
   * This allows users to recover from transient errors without reloading.
   */
  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} retry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a component with the CalendarErrorBoundary.
 * Useful for adding error boundaries to existing components.
 *
 * @example
 * ```tsx
 * const SafeCalendarView = withCalendarErrorBoundary(CalendarView);
 * <SafeCalendarView projectId={projectId} />
 * ```
 */
export function withCalendarErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<CalendarErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
  const WithErrorBoundary = (props: P) => (
    <CalendarErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </CalendarErrorBoundary>
  );

  WithErrorBoundary.displayName = `withCalendarErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithErrorBoundary;
}
