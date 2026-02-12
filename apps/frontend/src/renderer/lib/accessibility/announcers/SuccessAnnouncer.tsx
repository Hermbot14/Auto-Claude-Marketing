/**
 * Success Announcer Component
 *
 * Provides accessible success announcements with proper ARIA attributes
 * and screen reader support. Success messages are announced via polite region.
 *
 * @remarks
 * Success announcements should be:
 * - Brief and specific
 * - Non-urgent (polite priority)
 * - Actionable when appropriate
 * - Timed appropriately (not too long to read)
 *
 * @example
 * ```tsx
 * <SuccessAnnouncer message="Task completed successfully" />
 *
 * // With action
 * <SuccessAnnouncer
 *   message="File uploaded"
 *   actionLabel="View file"
 *   onAction={() => navigate('/files')}
 * />
 *
 * // With duration
 * <SuccessAnnouncer
 *   message="Changes saved"
 *   duration={5000}
 * />
 * ```
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnnounce, type UseAnnounceReturn } from '../useAnnounce';

/**
 * Props for SuccessAnnouncer component
 */
export interface SuccessAnnouncerProps {
  /** Success message to announce and display */
  message: string;
  /** Optional translation key (use instead of message) */
  messageKey?: string;
  /** Translation namespace for messageKey */
  namespace?: string[];
  /** Optional action button label */
  actionLabel?: string;
  /** Action button callback */
  onAction?: () => void;
  /** How long to show the message (ms, 0 for indefinite) */
  duration?: number;
  /** Whether to announce to screen readers (default: true) */
  announce?: boolean;
  /** Custom CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/**
 * SuccessAnnouncer Component
 *
 * Displays success messages with proper ARIA attributes for accessibility.
 * Messages are announced via the polite live region.
 *
 * @param props - Component props
 * @returns JSX element or null (if no message)
 */
export function SuccessAnnouncer({
  message,
  messageKey,
  namespace = ['accessibility'],
  actionLabel,
  onAction,
  duration = 3000,
  announce = true,
  className = '',
  style,
}: SuccessAnnouncerProps): JSX.Element | null {
  const { t } = useTranslation(namespace);
  const { announce: announceFn, clearQueue } = useAnnounce({ enabled: announce });
  const [isVisible, setIsVisible] = useState(true);
  const [hasAnnounced, setHasAnnounced] = useState(false);

  // Get the message text
  const messageText = messageKey ? t(messageKey) : message;

  // Announce to screen readers
  useEffect(() => {
    if (announce && !hasAnnounced) {
      announceFn(messageText, 'polite');
      setHasAnnounced(true);
    }

    // Auto-hide after duration
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, duration);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [announce, messageText, duration, hasAnnounced, announceFn]);

  // Don't render if hidden
  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`success-announcer ${className}`.trim()}
      style={style}
      data-announcement-type="success"
    >
      <div className="success-announcer__content">
        {/* Success icon */}
        <svg
          className="success-announcer__icon"
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
            className="text-green-500"
          />
          <path
            d="M6 10L8.5 12.5L14 7"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Success message */}
        <span className="success-announcer__message">{messageText}</span>

        {/* Optional action button */}
        {actionLabel && onAction && (
          <button
            type="button"
            className="success-announcer__action"
            onClick={onAction}
            aria-label={actionLabel}
          >
            {actionLabel}
          </button>
        )}

        {/* Dismiss button */}
        {duration === 0 && (
          <button
            type="button"
            className="success-announcer__dismiss"
            onClick={() => setIsVisible(false)}
            aria-label={t('accessibility:announcements.dismiss', 'Dismiss')}
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
        )}
      </div>
    </div>
  );
}

/**
 * Success announcement result type
 */
export interface SuccessResult {
  /** Whether the success was announced */
  announced: boolean;
  /** Timestamp of announcement */
  timestamp: number;
}

/**
 * Hook for managing success announcements
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { announceSuccess, announceSuccessByKey } = useSuccessAnnouncer();
 *
 *   const handleSave = async () => {
 *     await saveData();
 *     announceSuccess('Changes saved successfully');
 *     // or
 *     announceSuccessByKey('accessibility:announcements.formSubmitted');
 *   };
 * }
 * ```
 */
export function useSuccessAnnouncer(): {
  announceSuccess: (message: string) => SuccessResult;
  announceSuccessByKey: (key: string, ns?: string[], options?: Record<string, unknown>) => SuccessResult;
  clearSuccesses: () => void;
} {
  const { t } = useTranslation();
  const { announce, clearQueue } = useAnnounce();

  /**
   * Announce a success message
   */
  const announceSuccess = (message: string): SuccessResult => {
    announce(message, 'polite');
    return {
      announced: true,
      timestamp: Date.now(),
    };
  };

  /**
   * Announce a success message by translation key
   */
  const announceSuccessByKey = (
    key: string,
    ns?: string[],
    options?: Record<string, unknown>
  ): SuccessResult => {
    const message = t(key, options);
    return announceSuccess(message);
  };

  /**
   * Clear all pending success announcements
   */
  const clearSuccesses = (): void => {
    clearQueue();
  };

  return { announceSuccess, announceSuccessByKey, clearSuccesses };
}

/**
 * Success announcement options
 */
export interface SuccessAnnouncementOptions {
  /** Message to announce */
  message: string;
  /** Duration to show message (ms) */
  duration?: number;
  /** Optional action label */
  actionLabel?: string;
  /** Action callback */
  onAction?: () => void;
}

/**
 * Higher-order component for success announcements
 *
 * @example
 * ```tsx
 * const MyForm = withSuccessAnnouncer(({ onSuccess, ...props }) => {
 *   const handleSubmit = async (data) => {
 *     await saveData(data);
 *     onSuccess('Form submitted successfully');
 *   };
 *   return <form onSubmit={handleSubmit}>...</form>;
 * });
 * ```
 */
export function withSuccessAnnouncer<P extends { onSuccess?: (message: string) => void }>(
  Component: React.ComponentType<P>
): React.ComponentType<Omit<P, 'onSuccess'>> {
  return function WithSuccessAnnouncer(props: Omit<P, 'onSuccess'>) {
    const { announceSuccess } = useSuccessAnnouncer();

    const handleSuccess = (message: string): void => {
      announceSuccess(message);
    };

    return <Component {...(props as P)} onSuccess={handleSuccess} />;
  };
}

export default SuccessAnnouncer;
