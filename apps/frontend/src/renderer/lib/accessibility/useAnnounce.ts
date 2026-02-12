/**
 * useAnnounce Hook
 *
 * Provides a centralized announcement system for screen readers.
 * Manages message queueing and debouncing for dynamic content updates.
 *
 * @remarks
 * ARIA live regions are special DOM elements that screen readers monitor
 * for changes. When content changes, the screen reader announces it to the user.
 *
 * This hook provides:
 * - Message queueing for rapid updates
 * - Debouncing to prevent announcement spam
 * - Configurable priority (polite/assertive)
 * - Integration with existing i18n system
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/live-region/}
 *
 * @example
 * ```tsx
 * function TaskCard({ task }) {
 *   const { t } = useTranslation(['accessibility']);
 *   const { announce } = useAnnounce();
 *
 *   const handleComplete = async () => {
 *     await completeTask(task.id);
 *     announce(t('accessibility:tasks.taskCompleted', { taskName: task.name }));
 *   };
 *
 *   return <button onClick={handleComplete}>Complete</button>;
 * }
 * ```
 */

import { useState, useRef, useEffect, useCallback } from 'react';

export interface AnnouncementMessage {
  id: string;
  message: string;
  priority: 'polite' | 'assertive';
  timestamp: number;
}

export interface UseAnnounceOptions {
  /**
   * Minimum time between announcements (ms)
   * @default 1000
   */
  debounceMs?: number;

  /**
   * Maximum queue size before dropping oldest messages
   * @default 5
   */
  queueSize?: number;

  /**
   * Enable/disable announcements globally
   * @default true
   */
  enabled?: boolean;
}

export interface UseAnnounceReturn {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  announceKey: (key: string, ns?: string[], options?: Record<string, unknown>) => void;
  clearQueue: () => void;
  queue: AnnouncementMessage[];
}

/**
 * Hook for screen reader announcements via ARIA live regions
 *
 * @param options - Configuration options
 * @returns Announcement functions and current queue state
 */
export function useAnnounce(options: UseAnnounceOptions = {}): UseAnnounceReturn {
  const {
    debounceMs = 1000,
    queueSize = 5,
    enabled = true,
  } = options;

  const [queue, setQueue] = useState<AnnouncementMessage[]>([]);
  const lastAnnounceTime = useRef<number>(0);
  const announcementId = useRef(0);
  const i18nRef = useRef<ReturnType<typeof import('react-i18next').useTranslation>['t'] | null>(null);

  /**
   * Announce a message to screen readers
   *
   * @param message - The message to announce
   * @param priority - 'assertive' announces immediately, 'polite' waits for idle
   */
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!enabled) return;

    // Check debounce for polite announcements
    const now = Date.now();
    const timeSinceLastAnnounce = now - lastAnnounceTime.current;

    if (timeSinceLastAnnounce < debounceMs && priority === 'polite') {
      // Queue for later announcement
      const id = `announcement-${announcementId.current++}`;
      setQueue(prev => {
        const newQueue = [...prev, { id, message, priority, timestamp: now }];
        // Keep only the most recent messages
        return newQueue.slice(-queueSize);
      });
      return;
    }

    // Announce immediately
    lastAnnounceTime.current = now;

    // Find the appropriate live region
    const regionSelector = priority === 'assertive'
      ? '[data-aria-live-region="assertive"]'
      : '[data-aria-live-region="polite"]';

    const region = document.querySelector(regionSelector);
    if (region) {
      // Set text content to trigger announcement
      region.textContent = message;

      // Clear after announcement to allow re-announcing same message
      setTimeout(() => {
        if (region.textContent === message) {
          region.textContent = '';
        }
      }, 1000);
    } else {
      console.warn(
        `[useAnnounce] Live region not found for priority "${priority}". ` +
        `Ensure AriaLiveRegion component is mounted at app root.`
      );
    }
  }, [enabled, debounceMs, queueSize]);

  /**
   * Announce an i18n translation key
   *
   * @param key - The translation key
   * @param ns - Translation namespace
   * @param options - Interpolation options
   */
  const announceKey = useCallback((
    key: string,
    ns?: string[],
    options?: Record<string, unknown>
  ) => {
    if (i18nRef.current) {
      const message = i18nRef.current!(key, options);
      announce(message);
    } else {
      console.warn(
        `[useAnnounce] i18n not available. Use announce() with a plain message or ` +
        `wrap component with useTranslation()`
      );
    }
  }, [announce]);

  /**
   * Process queued announcements when debounce period passes
   */
  useEffect(() => {
    if (queue.length === 0) return;

    const timer = setTimeout(() => {
      const [next] = queue;
      if (next) {
        announce(next.message, next.priority);
        // Remove the announced message from queue
        setQueue(prev => prev.slice(1));
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [queue, debounceMs, announce]);

  /**
   * Clear all queued announcements
   */
  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  return { announce, announceKey, clearQueue, queue };
}

/**
 * Props for AriaLiveRegion component
 */
export interface AriaLiveRegionProps {
  children: React.ReactNode;
  /**
   * Maximum number of messages to keep in queue
   * @default 5
   */
  queueSize?: number;
}

/**
 * AriaLiveRegion Component
 *
 * Provides ARIA live regions for screen reader announcements.
 * This component should be mounted once at the app root level.
 *
 * @remarks
 * Live regions monitor content changes and announce them to screen readers.
 * We provide two regions:
 * - "polite" for non-urgent announcements (waits for user to be idle)
 * - "assertive" for urgent announcements (immediately interrupts)
 *
 * @example
 * ```tsx
 * import { AriaLiveRegion } from './lib/accessibility/useAnnounce';
 *
 * function App() {
 *   return (
 *     <AriaLiveRegion>
 *       <SkipLinks />
 *       <MainContent />
 *     </AriaLiveRegion>
 *   );
 * }
 * ```
 */
export function AriaLiveRegion({
  children,
  queueSize = 5,
}: AriaLiveRegionProps) {
  return (
    <>
      {/* Polite region - announces when user is idle */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-aria-live-region="polite"
        data-max-queue={queueSize}
        aria-label="Screen reader announcements for non-urgent updates"
      />

      {/* Assertive region - announces immediately */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        data-aria-live-region="assertive"
        data-max-queue={queueSize}
        aria-label="Screen reader announcements for urgent updates"
      />

      {/* Main app content */}
      {children}
    </>
  );
}

/**
 * Higher-order component to provide i18n integration to useAnnounce
 *
 * @example
 * ```tsx
 * const TaskCard = withAnnounce<TaskCardProps>(({ task, announce }) => {
 *   const handleComplete = () => {
 *     completeTask(task.id);
 *     announce('Task completed');
 *   };
 *   return <button onClick={handleComplete}>Complete</button>;
 * });
 * ```
 */
export function withAnnounce<P extends { announce?: ReturnType<typeof useAnnounce>['announce'] }>(
  Component: React.ComponentType<P>
) {
  return function WithAnnounce(props: Omit<P, 'announce'>) {
    const { announce } = useAnnounce();
    return <Component {...(props as P)} announce={announce} />;
  };
}

/**
 * Announcement priority levels
 */
export enum AnnouncementPriority {
  /** Non-urgent, announced when user is idle */
  Polite = 'polite',
  /** Urgent, announced immediately */
  Assertive = 'assertive',
}

/**
 * Predefined announcement types for common scenarios
 */
export const AnnouncementTypes = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  LOADING: 'loading',
  NAVIGATION: 'navigation',
  FORM_ERROR: 'form-error',
  FORM_SUCCESS: 'form-success',
  TASK_UPDATE: 'task-update',
  TASK_COMPLETE: 'task-complete',
  TASK_FAILED: 'task-failed',
} as const;

export type AnnouncementType = (typeof AnnouncementTypes)[keyof typeof AnnouncementTypes];

/**
 * Get default priority for announcement type
 */
export function getPriorityForType(type: AnnouncementType): 'polite' | 'assertive' {
  switch (type) {
    case AnnouncementTypes.ERROR:
    case AnnouncementTypes.FORM_ERROR:
    case AnnouncementTypes.TASK_FAILED:
      return 'assertive';
    default:
      return 'polite';
  }
}

export default useAnnounce;
