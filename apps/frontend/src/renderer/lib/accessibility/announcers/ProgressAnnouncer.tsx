/**
 * Progress Announcer Component
 *
 * Provides accessible progress announcements for long-running operations.
 * Keeps screen readers informed about loading states, file uploads, downloads, etc.
 *
 * @remarks
 * Progress announcements should be:
 * - Non-intrusive (polite priority)
 * - Regular but not excessive (throttled updates)
 * - Specific about current state
 * - Include estimated completion when available
 *
 * WCAG guidelines for progress updates:
 * - Use role="progressbar" with aria-valuenow, aria-valuemin, aria-valuemax
 * - Announce significant milestones (25%, 50%, 75%, 100%)
 * - Don't announce every percentage change (too noisy)
 *
 * @example
 * ```tsx
 * <ProgressAnnouncer
 *   value={50}
 *   max={100}
 *   message="Uploading file"
 *   indeterminate={false}
 * />
 *
 * // Indeterminate progress
 * <ProgressAnnouncer
 *   indeterminate={true}
 *   message="Loading data..."
 * />
 *
 * // With time estimate
 * <ProgressAnnouncer
 *   value={75}
 *   max={100}
 *   message="Downloading"
 *   estimatedTimeRemaining={30}
 * />
 * ```
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnnounce, type UseAnnounceReturn } from '../useAnnounce';

/**
 * Props for ProgressAnnouncer component
 */
export interface ProgressAnnouncerProps {
  /** Current progress value */
  value?: number;
  /** Maximum progress value */
  max?: number;
  /** Minimum progress value */
  min?: number;
  /** Progress message to display */
  message?: string;
  /** Optional translation key (use instead of message) */
  messageKey?: string;
  /** Translation namespace for messageKey */
  namespace?: string[];
  /** Whether progress is indeterminate (unknown duration) */
  indeterminate?: boolean;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
  /** Whether to show percentage */
  showPercentage?: boolean;
  /** Whether to announce to screen readers (default: true) */
  announce?: boolean;
  /** Minimum announcement interval (ms) */
  announceInterval?: number;
  /** Custom CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Callback on completion */
  onComplete?: () => void;
  /** Callback on cancellation */
  onCancel?: () => void;
  /** Callback on error */
  onError?: () => void;
}

/**
 * Milestone percentages for announcements
 * Announce at these points to avoid spam
 */
const MILESTONES = [0, 25, 50, 75, 90, 100];

/**
 * Get milestone to announce based on current progress
 */
function getMilestone(value: number, max: number): number | null {
  const percentage = (value / max) * 100;

  // Find the next milestone we've reached
  for (const milestone of MILESTONES) {
    if (percentage >= milestone) {
      return milestone;
    }
  }

  return null;
}

/**
 * Format time remaining as human-readable string
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} seconds`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}${remainingSeconds > 0 ? ` ${remainingSeconds} seconds` : ''}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} hour${hours !== 1 ? 's' : ''}${remainingMinutes > 0 ? ` ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}` : ''}`;
}

/**
 * ProgressAnnouncer Component
 *
 * Displays progress with proper ARIA attributes and announcements.
 * Progress is announced at key milestones to avoid spam.
 *
 * @param props - Component props
 * @returns JSX element
 */
export function ProgressAnnouncer({
  value = 0,
  max = 100,
  min = 0,
  message,
  messageKey,
  namespace = ['accessibility'],
  indeterminate = false,
  estimatedTimeRemaining,
  showPercentage = true,
  announce = true,
  announceInterval = 2000,
  className = '',
  style,
  onComplete,
  onCancel,
  onError,
}: ProgressAnnouncerProps): JSX.Element {
  const { t } = useTranslation(namespace);
  const { announce: announceFn } = useAnnounce({ enabled: announce });
  const [lastAnnouncedMilestone, setLastAnnouncedMilestone] = useState<number>(-1);
  const [isComplete, setIsComplete] = useState(false);
  const announceTimerRef = useRef<number | null>(null);

  // Get the message text
  const messageText = messageKey ? t(messageKey) : message;

  // Calculate progress percentage
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  // Check if we should announce a milestone
  const currentMilestone = getMilestone(value, max);
  const shouldAnnounceMilestone =
    currentMilestone !== null && currentMilestone !== lastAnnouncedMilestone;

  // Build announcement message
  const buildAnnouncementMessage = useCallback((): string => {
    const parts: string[] = [];

    if (messageText) {
      parts.push(messageText);
    }

    if (!indeterminate) {
      parts.push(`${Math.round(percentage)}% complete`);

      if (estimatedTimeRemaining) {
        parts.push(`${formatTimeRemaining(estimatedTimeRemaining)} remaining`);
      }
    } else {
      parts.push('in progress');
    }

    return parts.join('. ');
  }, [messageText, indeterminate, percentage, estimatedTimeRemaining]);

  // Announce milestones
  useEffect(() => {
    if (!announce || isComplete) return;

    if (shouldAnnounceMilestone && currentMilestone !== null) {
      setLastAnnouncedMilestone(currentMilestone);
      announceFn(buildAnnouncementMessage(), 'polite');
    }

    // Handle completion
    if (percentage >= 100 && !isComplete) {
      setIsComplete(true);
      const completeMessage = messageText
        ? `${messageText} complete`
        : 'Operation complete';
      announceFn(completeMessage, 'polite');
      onComplete?.();
    }

    return undefined;
  }, [
    announce,
    shouldAnnounceMilestone,
    currentMilestone,
    isComplete,
    percentage,
    messageText,
    buildAnnouncementMessage,
    announceFn,
    onComplete,
  ]);

  // Periodic announcements for long operations
  useEffect(() => {
    if (!announce || isComplete || indeterminate) return;

    // Set up periodic announcements
    announceTimerRef.current = window.setTimeout(() => {
      announceFn(buildAnnouncementMessage(), 'polite');
    }, announceInterval);

    return () => {
      if (announceTimerRef.current !== null) {
        clearTimeout(announceTimerRef.current);
      }
    };
  }, [value, announce, isComplete, indeterminate, announceInterval, buildAnnouncementMessage, announceFn]);

  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={indeterminate ? messageText : undefined}
      aria-busy={!isComplete}
      className={`progress-announcer ${className}`.trim()}
      style={style}
      data-announcement-type="progress"
      data-indeterminate={indeterminate}
      data-complete={isComplete}
    >
      <div className="progress-announcer__content">
        {/* Progress bar visual */}
        <div className="progress-announcer__bar-container">
          <div
            className={`progress-announcer__bar ${indeterminate ? 'progress-announcer__bar--indeterminate' : ''}`}
            style={{ width: `${percentage}%` }}
            aria-hidden="true"
          />
        </div>

        {/* Message and percentage */}
        <div className="progress-announcer__info">
          {messageText && (
            <span className="progress-announcer__message">{messageText}</span>
          )}

          {!indeterminate && showPercentage && (
            <span className="progress-announcer__percentage">
              {Math.round(percentage)}%
            </span>
          )}

          {estimatedTimeRemaining !== undefined && !isComplete && (
            <span className="progress-announcer__time">
              {formatTimeRemaining(estimatedTimeRemaining)} remaining
            </span>
          )}

          {isComplete && (
            <span className="progress-announcer__status progress-announcer__status--complete">
              Complete
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="progress-announcer__actions">
          {onCancel && !isComplete && (
            <button
              type="button"
              className="progress-announcer__cancel"
              onClick={onCancel}
              aria-label={t('accessibility:progress.cancel', 'Cancel')}
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

      {/* Screen reader only text for indeterminate progress */}
      {indeterminate && (
        <span className="sr-only">{messageText || 'Loading...'}</span>
      )}
    </div>
  );
}

/**
 * Progress state management hook
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { startProgress, updateProgress, completeProgress, cancelProgress } = useProgressAnnouncer();
 *
 *   const handleUpload = async (file: File) => {
 *     startProgress('Uploading file', file.size);
 *
 *     const xhr = new XMLHttpRequest();
 *     xhr.upload.onprogress = (e) => {
 *       updateProgress(e.loaded, e.total);
 *     };
 *     xhr.onload = () => completeProgress();
 *     xhr.send(file);
 *   };
 * }
 * ```
 */
export function useProgressAnnouncer(): {
  startProgress: (message: string, total?: number) => void;
  updateProgress: (current: number, total?: number) => void;
  completeProgress: (message?: string) => void;
  cancelProgress: (message?: string) => void;
  errorProgress: (message: string) => void;
  isRunning: boolean;
  value: number;
} {
  const { announce } = useAnnounce();
  const [isRunning, setIsRunning] = useState(false);
  const [value, setValue] = useState(0);
  const [total, setTotal] = useState(100);
  const [message, setMessage] = useState<string>('');

  const startProgress = useCallback((msg: string, tot?: number): void => {
    setIsRunning(true);
    setValue(0);
    setTotal(tot || 100);
    setMessage(msg);
    announce(msg || 'Operation started', 'polite');
  }, [announce]);

  const updateProgress = useCallback((current: number, tot?: number): void => {
    setValue(current);
    if (tot !== undefined) {
      setTotal(tot);
    }
  }, []);

  const completeProgress = useCallback((msg?: string): void => {
    setIsRunning(false);
    setValue(total);
    const completeMsg = msg || message;
    announce(completeMsg ? `${completeMsg} complete` : 'Operation complete', 'polite');
  }, [announce, total, message]);

  const cancelProgress = useCallback((msg?: string): void => {
    setIsRunning(false);
    const cancelMsg = msg || message;
    announce(cancelMsg ? `${cancelMsg} cancelled` : 'Operation cancelled', 'polite');
  }, [announce, message]);

  const errorProgress = useCallback((msg: string): void => {
    setIsRunning(false);
    announce(`Error: ${msg}`, 'assertive');
  }, [announce]);

  return {
    startProgress,
    updateProgress,
    completeProgress,
    cancelProgress,
    errorProgress,
    isRunning,
    value,
  };
}

/**
 * Higher-order component for progress announcements
 *
 * @example
 * ```tsx
 * const UploadButton = withProgressAnnouncer(({ startProgress, ...props }) => {
 *   const handleUpload = async (file) => {
 *     startProgress('Uploading file', file.size);
 *     await uploadFile(file, (loaded, total) => {
 *       updateProgress(loaded, total);
 *     });
 *   };
 *   return <button onClick={handleUpload}>Upload</button>;
 * });
 * ```
 */
export function withProgressAnnouncer<
  P extends {
    startProgress?: (message: string, total?: number) => void;
    updateProgress?: (current: number, total?: number) => void;
    completeProgress?: (message?: string) => void;
  }
>(Component: React.ComponentType<P>): React.ComponentType<Omit<P, 'startProgress' | 'updateProgress' | 'completeProgress'>> {
  return function WithProgressAnnouncer(props: Omit<P, 'startProgress' | 'updateProgress' | 'completeProgress'>) {
    const { startProgress, updateProgress, completeProgress } = useProgressAnnouncer();

    return (
      <Component
        {...(props as P)}
        startProgress={startProgress}
        updateProgress={updateProgress}
        completeProgress={completeProgress}
      />
    );
  };
}

export default ProgressAnnouncer;
