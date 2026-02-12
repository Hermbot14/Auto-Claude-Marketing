/**
 * Error Announcer Component
 *
 * Provides accessible error announcements with proper ARIA attributes
 * and screen reader support. Error messages are announced via assertive region.
 *
 * @remarks
 * Error announcements should be:
 * - Clear and specific about what went wrong
 * - Urgent (assertive priority)
 * - Actionable when possible (how to fix)
 * - Include guidance for resolution
 *
 * @example
 * ```tsx
 * <ErrorAnnouncer
 *   message="Failed to save changes"
 *   details="Network connection lost. Please check your internet connection."
 *   onRetry={() => retryAction()}
 * />
 *
 * // With error code
 * <ErrorAnnouncer
 *   message="Upload failed"
 *   errorCode="ERR_UPLOAD_FAILED"
 *   details="File size exceeds maximum allowed size of 10MB."
 * />
 * ```
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnnounce, type UseAnnounceReturn } from '../useAnnounce';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error category for better user guidance
 */
export type ErrorCategory =
  | 'network'
  | 'validation'
  | 'permission'
  | 'system'
  | 'unknown';

/**
 * Props for ErrorAnnouncer component
 */
export interface ErrorAnnouncerProps {
  /** Error message to announce and display */
  message: string;
  /** Optional translation key (use instead of message) */
  messageKey?: string;
  /** Translation namespace for messageKey */
  namespace?: string[];
  /** Additional error details */
  details?: string;
  /** Error severity level */
  severity?: ErrorSeverity;
  /** Error category for better handling */
  category?: ErrorCategory;
  /** Error code for debugging/support */
  errorCode?: string;
  /** Retry action label */
  retryLabel?: string;
  /** Retry action callback */
  onRetry?: () => void;
  /** Dismiss action label */
  dismissLabel?: string;
  /** Dismiss action callback */
  onDismiss?: () => void;
  /** Additional action buttons */
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
  /** Whether to announce to screen readers (default: true) */
  announce?: boolean;
  /** Custom CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/**
 * Get severity-based styling
 */
function getSeverityClass(severity: ErrorSeverity): string {
  const classes = {
    low: 'error-announcer--low',
    medium: 'error-announcer--medium',
    high: 'error-announcer--high',
    critical: 'error-announcer--critical',
  };
  return classes[severity] || classes.medium;
}

/**
 * Get severity icon color
 */
function getSeverityColor(severity: ErrorSeverity): string {
  const colors = {
    low: 'text-yellow-500',
    medium: 'text-orange-500',
    high: 'text-red-500',
    critical: 'text-red-600',
  };
  return colors[severity] || colors.medium;
}

/**
 * ErrorAnnouncer Component
 *
 * Displays error messages with proper ARIA attributes for accessibility.
 * Error messages are announced via the assertive live region.
 *
 * @param props - Component props
 * @returns JSX element or null (if dismissed)
 */
export function ErrorAnnouncer({
  message,
  messageKey,
  namespace = ['accessibility', 'errors'],
  details,
  severity = 'medium',
  category,
  errorCode,
  retryLabel,
  onRetry,
  dismissLabel,
  onDismiss,
  actions = [],
  announce = true,
  className = '',
  style,
}: ErrorAnnouncerProps): JSX.Element | null {
  const { t } = useTranslation(namespace);
  const { announce: announceFn, clearQueue } = useAnnounce({ enabled: announce });
  const [isVisible, setIsVisible] = useState(true);
  const [hasAnnounced, setHasAnnounced] = useState(false);

  // Get the message text
  const messageText = messageKey ? t(messageKey) : message;

  // Build full announcement message
  const fullMessage = details ? `${messageText}. ${details}` : messageText;

  // Announce to screen readers immediately (assertive priority)
  useEffect(() => {
    if (announce && isVisible && !hasAnnounced) {
      announceFn(fullMessage, 'assertive');
      setHasAnnounced(true);
    }
  }, [announce, fullMessage, isVisible, hasAnnounced, announceFn]);

  // Don't render if hidden
  if (!isVisible) {
    return null;
  }

  const handleDismiss = (): void => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`error-announcer ${getSeverityClass(severity)} ${className}`.trim()}
      style={style}
      data-announcement-type="error"
      data-severity={severity}
      data-category={category}
      data-error-code={errorCode}
    >
      <div className="error-announcer__content">
        {/* Error icon */}
        <svg
          className={`error-announcer__icon ${getSeverityColor(severity)}`}
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            cx="10"
            cy="10"
            r="9"
            fill="currentColor"
            opacity="0.2"
          />
          <path
            d="M10 7V10M10 13V13.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>

        {/* Error message container */}
        <div className="error-announcer__messages">
          <span className="error-announcer__message">{messageText}</span>

          {details && (
            <p className="error-announcer__details">{details}</p>
          )}

          {errorCode && (
            <code className="error-announcer__code">{errorCode}</code>
          )}
        </div>

        {/* Action buttons */}
        <div className="error-announcer__actions">
          {/* Retry button */}
          {retryLabel && onRetry && (
            <button
              type="button"
              className="error-announcer__retry"
              onClick={onRetry}
              aria-label={retryLabel}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8 2C4.686 2 2 4.686 2 8C2 11.314 4.686 14 8 14C11.314 14 14 11.314 14 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d="M10 6L8 8L10 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {retryLabel}
            </button>
          )}

          {/* Additional actions */}
          {actions.map((action, index) => (
            <button
              key={index}
              type="button"
              className={`error-announcer__action error-announcer__action--${action.variant || 'secondary'}`}
              onClick={action.onClick}
              aria-label={action.label}
            >
              {action.label}
            </button>
          ))}

          {/* Dismiss button */}
          <button
            type="button"
            className="error-announcer__dismiss"
            onClick={handleDismiss}
            aria-label={dismissLabel || t('accessibility:announcements.dismiss', 'Dismiss')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Error announcement result type
 */
export interface ErrorResult {
  /** Whether the error was announced */
  announced: boolean;
  /** Timestamp of announcement */
  timestamp: number;
  /** Error severity level */
  severity: ErrorSeverity;
}

/**
 * Hook for managing error announcements
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { announceError, announceErrorByKey, announceValidationErrors } = useErrorAnnouncer();
 *
 *   const handleSave = async () => {
 *     try {
 *       await saveData();
 *     } catch (error) {
 *       announceError('Failed to save changes', {
 *         details: error.message,
 *         severity: 'high',
 *         category: 'network',
 *       });
 *     }
 *   };
 * }
 * ```
 */
export function useErrorAnnouncer(): {
  announceError: (
    message: string,
    options?: Partial<ErrorAnnouncerProps>
  ) => ErrorResult;
  announceErrorByKey: (
    key: string,
    ns?: string[],
    options?: Record<string, unknown>
  ) => ErrorResult;
  announceValidationErrors: (
    errors: Record<string, string[]>,
    options?: Partial<ErrorAnnouncerProps>
  ) => ErrorResult;
  clearErrors: () => void;
} {
  const { t } = useTranslation();
  const { announce, clearQueue } = useAnnounce();

  /**
   * Announce an error message
   */
  const announceError = (
    message: string,
    options: Partial<ErrorAnnouncerProps> = {}
  ): ErrorResult => {
    const { details, severity = 'medium' } = options;

    const fullMessage = details ? `${message}. ${details}` : message;
    announce(fullMessage, 'assertive');

    return {
      announced: true,
      timestamp: Date.now(),
      severity: severity as ErrorSeverity,
    };
  };

  /**
   * Announce an error message by translation key
   */
  const announceErrorByKey = (
    key: string,
    ns?: string[],
    options?: Record<string, unknown>
  ): ErrorResult => {
    const message = t(key, options);
    return announceError(message);
  };

  /**
   * Announce validation errors
   */
  const announceValidationErrors = (
    errors: Record<string, string[]>,
    options: Partial<ErrorAnnouncerProps> = {}
  ): ErrorResult => {
    const errorMessages = Object.entries(errors)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('. ');

    return announceError('Form validation errors. Please check your input.', {
      ...options,
      details: errorMessages,
      category: 'validation',
      severity: 'medium',
    });
  };

  /**
   * Clear all pending error announcements
   */
  const clearErrors = (): void => {
    clearQueue();
  };

  return { announceError, announceErrorByKey, announceValidationErrors, clearErrors };
}

/**
 * Higher-order component for error announcements
 *
 * @example
 * ```tsx
 * const MyForm = withErrorAnnouncer(({ onError, ...props }) => {
 *   const handleSubmit = async (data) => {
 *     try {
 *       await saveData(data);
 *     } catch (error) {
 *       onError('Failed to submit form', {
 *         details: error.message,
 *         onRetry: () => handleSubmit(data),
 *       });
 *     }
 *   };
 *   return <form onSubmit={handleSubmit}>...</form>;
 * });
 * ```
 */
export function withErrorAnnouncer<P extends { onError?: (message: string, options?: Partial<ErrorAnnouncerProps>) => void }>(
  Component: React.ComponentType<P>
): React.ComponentType<Omit<P, 'onError'>> {
  return function WithErrorAnnouncer(props: Omit<P, 'onError'>) {
    const { announceError } = useErrorAnnouncer();

    const handleError = (
      message: string,
      options?: Partial<ErrorAnnouncerProps>
    ): void => {
      announceError(message, options);
    };

    return <Component {...(props as P)} onError={handleError} />;
  };
}

export default ErrorAnnouncer;
