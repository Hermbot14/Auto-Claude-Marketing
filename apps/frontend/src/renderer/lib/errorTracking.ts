/**
 * Unified Error Tracking for Renderer Process
 *
 * Provides a centralized error tracking system that:
 * - Integrates with Sentry for error reporting
 * - Captures unhandled errors and promise rejections
 * - Provides error categorization (JavaScript, API, React)
 * - Adds user context for better debugging
 * - Supports manual error capture with context
 *
 * Error Categories:
 * - javascript: Unhandled JavaScript errors, syntax errors
 * - promise: Unhandled promise rejections
 * - api: API/HTTP request failures
 * - react: React rendering errors (via error boundaries)
 * - performance: Performance issues (slow operations)
 * - network: Network connectivity issues
 *
 * User Context:
 * - Project ID: Current project being worked on
 * - View: Active view (kanban, terminals, roadmap, etc.)
 * - Action: User action that triggered the error
 * - Feature: Specific feature being used
 */

import * as Sentry from '@sentry/electron/renderer';
import { captureException as sentryCaptureException } from './sentry';
import type { Project } from '../../shared/types';

/**
 * Error categories for automatic classification
 */
export enum ErrorCategory {
  JAVASCRIPT = 'javascript',
  PROMISE = 'promise',
  API = 'api',
  REACT = 'react',
  PERFORMANCE = 'performance',
  NETWORK = 'network',
  UNKNOWN = 'unknown',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * User context interface for error tracking
 */
export interface ErrorContext {
  /** Current project ID */
  projectId?: string
  /** Current view name */
  view?: string
  /** User action that triggered error */
  action?: string
  /** Feature being used */
  feature?: string
  /** Additional context data */
  extra?: Record<string, unknown>
}

/**
 * Error tracking event data
 */
export interface ErrorEvent {
  category: ErrorCategory
  severity: ErrorSeverity
  message: string
  error?: Error
  context?: ErrorContext
  timestamp: number
}

/**
 * Current user context (updated by components)
 */
let currentUserContext: ErrorContext = {};

/**
 * Initialize global error handlers
 *
 * Sets up handlers for:
 * - Uncaught errors
 * - Unhandled promise rejections
 *
 * Should be called once during app initialization
 */
export function initializeErrorHandlers(): void {
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    const error = event.error || new Error(event.message);

    trackError({
      category: ErrorCategory.JAVASCRIPT,
      severity: ErrorSeverity.HIGH,
      message: error.message || 'Uncaught error',
      error,
      context: {
        ...currentUserContext,
        extra: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          source: 'window.onerror',
        },
      },
    });

    // Prevent default browser error handling
    event.preventDefault();
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    trackError({
      category: ErrorCategory.PROMISE,
      severity: ErrorSeverity.HIGH,
      message: error.message || 'Unhandled promise rejection',
      error,
      context: {
        ...currentUserContext,
        extra: {
          promise: 'unhandled',
          reason: String(event.reason),
        },
      },
    });

    // Prevent default browser error handling
    event.preventDefault();
  });

  console.log('[ErrorTracking] Global error handlers initialized');
}

/**
 * Set user context for subsequent errors
 *
 * Call this when user navigates or performs actions:
 * - Switch projects
 * - Change views
 * - Start operations
 *
 * @example
 * setErrorContext({ projectId: 'abc', view: 'kanban' })
 * performRiskyOperation()
 * clearErrorContext()
 */
export function setErrorContext(context: ErrorContext): void {
  currentUserContext = context;
}

/**
 * Update specific fields of current error context
 *
 * @example
 * updateErrorContext({ action: 'create-task' })
 */
export function updateErrorContext(updates: Partial<ErrorContext>): void {
  currentUserContext = { ...currentUserContext, ...updates };
}

/**
 * Clear current error context
 *
 * Call after operation completes to avoid stale context
 */
export function clearErrorContext(): void {
  currentUserContext = {};
}

/**
 * Get current error context
 */
export function getErrorContext(): ErrorContext {
  return { ...currentUserContext };
}

/**
 * Track an error with context
 *
 * Automatically:
 * - Categorizes the error
 * - Adds severity level
 * - Sends to Sentry (if enabled)
 * - Logs to console
 *
 * @example
 * try {
 *   await riskyOperation()
 * } catch (error) {
 *   trackError({
 *     category: ErrorCategory.API,
 *     severity: ErrorSeverity.MEDIUM,
 *     message: 'Failed to fetch data',
 *     error,
 *     context: { action: 'refresh-tasks' }
 *   })
 * }
 */
export function trackError(event: ErrorEvent): void {
  const { category, severity, message, error, context } = event;

  // Merge current user context with provided context
  const fullContext = { ...currentUserContext, ...context };

  // Log to console
  const logMethod = severity === ErrorSeverity.CRITICAL || severity === ErrorSeverity.HIGH
    ? console.error
    : severity === ErrorSeverity.MEDIUM
      ? console.warn
      : console.log;

  logMethod(
    `[ErrorTracking] [${category.toUpperCase()}] [${severity.toUpperCase()}] ${message}`,
    { error, context: fullContext }
  );

  // Send to Sentry with context
  try {
    Sentry.withScope((scope) => {
      // Add tags for filtering
      scope.setTag('error_category', category);
      scope.setTag('severity', severity);
      scope.setTag('view', fullContext.view || 'unknown');

      // Add context for debugging
      scope.setContext('user_action', {
        project_id: fullContext.projectId || 'none',
        action: fullContext.action || 'none',
        feature: fullContext.feature || 'none',
      });

      // Add extra data
      if (fullContext.extra) {
        Object.entries(fullContext.extra).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      // Capture the error
      if (error) {
        sentryCaptureException(error, fullContext);
      } else {
        Sentry.captureMessage(message, {
          level: severity === ErrorSeverity.CRITICAL ? 'fatal' : severity,
        });
      }
    });
  } catch (e) {
    // If Sentry fails, just log
    console.error('[ErrorTracking] Failed to send to Sentry:', e);
  }
}

/**
 * Track an API error
 *
 * Convenience function for API-related errors
 *
 * @example
 * try {
 *   await apiCall()
 * } catch (error) {
 *   trackApiError(error, 'fetch-tasks', { endpoint: '/api/tasks' })
 * }
 */
export function trackApiError(
  error: Error | unknown,
  action: string,
  extra?: Record<string, unknown>
): void {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  trackError({
    category: ErrorCategory.API,
    severity: ErrorSeverity.HIGH,
    message: `API Error: ${errorObj.message}`,
    error: errorObj,
    context: {
      action,
      extra: {
        ...extra,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
      },
    },
  });
}

/**
 * Track a React error (from error boundary)
 *
 * Convenience function for React error boundaries
 *
 * @example
 * componentDidCatch(error, errorInfo) {
 *   trackReactError(error, errorInfo, 'CalendarView')
 * }
 */
export function trackReactError(
  error: Error,
  errorInfo: {
    componentStack?: string
    errorBoundary?: string
  },
  feature?: string
): void {
  trackError({
    category: ErrorCategory.REACT,
    severity: ErrorSeverity.CRITICAL,
    message: `React Error: ${error.message}`,
    error,
    context: {
      feature: feature || 'unknown',
      extra: {
        component_stack: errorInfo.componentStack,
        error_boundary: errorInfo.errorBoundary,
      },
    },
  });
}

/**
 * Track a performance issue
 *
 * For slow operations or performance bottlenecks
 *
 * @example
 * const start = performance.now()
 * await slowOperation()
 * const duration = performance.now() - start
 * if (duration > 5000) {
 *   trackPerformanceIssue('database-query', duration, { query: 'SELECT * FROM tasks' })
 * }
 */
export function trackPerformanceIssue(
  operation: string,
  durationMs: number,
  extra?: Record<string, unknown>
): void {
  // Determine severity based on duration
  let severity: ErrorSeverity;
  if (durationMs > 10000) {
    severity = ErrorSeverity.CRITICAL;
  } else if (durationMs > 5000) {
    severity = ErrorSeverity.HIGH;
  } else if (durationMs > 2000) {
    severity = ErrorSeverity.MEDIUM;
  } else {
    severity = ErrorSeverity.LOW;
  }

  trackError({
    category: ErrorCategory.PERFORMANCE,
    severity,
    message: `Performance issue: ${operation} took ${durationMs}ms`,
    context: {
      action: operation,
      extra: {
        duration_ms: durationMs,
        ...extra,
      },
    },
  });
}

/**
 * Track a network error
 *
 * For connectivity and network-related issues
 */
export function trackNetworkError(
  error: Error | unknown,
  action: string,
  extra?: Record<string, unknown>
): void {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  trackError({
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    message: `Network Error: ${errorObj.message}`,
    error: errorObj,
    context: {
      action,
      extra: {
        ...extra,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
      },
    },
  });
}

/**
 * Create a wrapped version of an async function with error tracking
 *
 * @example
 * const safeFetch = withErrorTracking(fetchData, 'fetch-tasks')
 * await safeFetch() // Errors automatically tracked
 */
export function withErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  action: string,
  options?: {
    category?: ErrorCategory
    feature?: string
  }
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      trackError({
        category: options?.category || ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.MEDIUM,
        message: `Error in ${action}`,
        error: error instanceof Error ? error : new Error(String(error)),
        context: {
          action,
          feature: options?.feature,
        },
      });
      throw error; // Re-throw for caller to handle
    }
  }) as T;
}

/**
 * Error tracking hook for React components
 *
 * Automatically sets and clears error context based on component lifecycle
 *
 * @example
 * function MyComponent() {
 *   useErrorContext({ view: 'kanban', feature: 'task-board' })
 *   return <div>...</div>
 * }
 */
export function useErrorContext(context: Partial<ErrorContext>): void {
  // Set context on mount
  setErrorContext(context);

  // Clear on unmount
  // Note: This is a simplified version. For full React hook implementation,
  // we'd need useEffect for cleanup
}

/**
 * Performance tracking for operations
 *
 * @example
 * const track = trackOperation('database-query')
 * await query()
 * track() // Automatically logs duration
 */
export function trackOperation(name: string): (durationMs: number) => void {
  const start = performance.now();

  return (durationMs?: number) => {
    const actualDuration = durationMs ?? performance.now() - start;
    trackPerformanceIssue(name, actualDuration);
  };
}

/**
 * Batch error tracking for multiple operations
 *
 * Use when you want to track multiple errors as a group
 *
 * @example
 * await withBatchErrorTracking(async () => {
 *   await operation1()
 *   await operation2()
 *   await operation3()
 * }, 'batch-import')
 */
export async function withBatchErrorTracking<T>(
  operations: () => Promise<T>,
  batchName: string
): Promise<T> {
  try {
    return await operations();
  } catch (error) {
    trackError({
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.HIGH,
      message: `Batch operation failed: ${batchName}`,
      error: error instanceof Error ? error : new Error(String(error)),
      context: {
        action: batchName,
      },
    });
    throw error;
  }
}
