/**
 * Announcement Queue Module
 *
 * Manages queued announcements for screen readers with deduplication,
 * priority handling, and timing control to prevent announcement spam.
 *
 * @remarks
 * Screen readers can become overwhelmed by too many rapid announcements.
 * This module queues announcements and releases them at appropriate intervals.
 *
 * Features:
 * - Message deduplication (same message won't repeat)
 * - Priority handling (assertive jumps queue)
 * - Maximum queue size enforcement
 * - Automatic queue processing
 * - Message expiration
 *
 * @example
 * ```ts
 * import { queueAnnouncement, startQueueProcessor } from './announcementQueue';
 *
 * // Queue a message
 * queueAnnouncement('Task completed', 'polite');
 * queueAnnouncement('Error occurred', 'assertive'); // Jumps queue
 *
 * // Start automatic processing (usually done once at app init)
 * startQueueProcessor();
 * ```
 */

import type { AnnouncementMessage } from './useAnnounce';

/**
 * Queue configuration options
 */
export interface QueueConfig {
  /** Minimum delay between announcements (ms) */
  minDelay: number;
  /** Maximum messages to keep in queue */
  maxSize: number;
  /** How long before queued messages expire (ms) */
  messageExpiry: number;
  /** Whether to deduplicate messages */
  deduplicate: boolean;
  /** Deduplication window (ms) - same message within window is duplicate */
  deduplicationWindow: number;
}

/**
 * Default queue configuration
 */
const DEFAULT_CONFIG: QueueConfig = {
  minDelay: 1000, // 1 second between announcements
  maxSize: 10, // Keep at most 10 messages
  messageExpiry: 30000, // Messages expire after 30 seconds
  deduplicate: true, // Enable deduplication
  deduplicationWindow: 5000, // Same message within 5 seconds is duplicate
};

/**
 * Announcement queue state
 */
interface QueueState {
  /** Pending messages */
  queue: AnnouncementMessage[];
  /** Message history for deduplication */
  history: Map<string, number>; // message -> timestamp
  /** Last announcement timestamp */
  lastAnnounceTime: number;
  /** Current configuration */
  config: QueueConfig;
  /** Processing timer ID */
  timerId: number | null;
  /** Whether processor is running */
  isProcessing: boolean;
}

/**
 * Global queue state (singleton)
 */
let queueState: QueueState = {
  queue: [],
  history: new Map(),
  lastAnnounceTime: 0,
  config: { ...DEFAULT_CONFIG },
  timerId: null,
  isProcessing: false,
};

/**
 * Callback for announcing messages
 */
let announceCallback: ((message: string, priority: 'polite' | 'assertive') => void) | null = null;

/**
 * Configure the announcement queue
 *
 * @param config - Partial config to override defaults
 */
export function configureQueue(config: Partial<QueueConfig>): void {
  queueState.config = { ...queueState.config, ...config };
}

/**
 * Reset queue to initial state
 */
export function resetQueue(): void {
  queueState.queue = [];
  queueState.history.clear();
  queueState.lastAnnounceTime = 0;
  if (queueState.timerId !== null) {
    window.clearTimeout(queueState.timerId);
    queueState.timerId = null;
  }
}

/**
 * Get current queue size
 */
export function getQueueSize(): number {
  return queueState.queue.length;
}

/**
 * Get all pending messages
 */
export function getPendingMessages(): AnnouncementMessage[] {
  return [...queueState.queue];
}

/**
 * Check if a message is a duplicate
 *
 * @param message - Message to check
 * @returns True if message was announced recently
 */
function isDuplicate(message: string): boolean {
  if (!queueState.config.deduplicate) {
    return false;
  }

  const timestamp = queueState.history.get(message);
  if (timestamp === undefined) {
    return false;
  }

  const now = Date.now();
  return now - timestamp < queueState.config.deduplicationWindow;
}

/**
 * Add message to history
 *
 * @param message - Message to add to history
 */
function addToHistory(message: string): void {
  queueState.history.set(message, Date.now());

  // Clean up old history entries periodically
  if (queueState.history.size > 100) {
    const cutoff = Date.now() - queueState.config.deduplicationWindow * 2;
    for (const [msg, timestamp] of queueState.history.entries()) {
      if (timestamp < cutoff) {
        queueState.history.delete(msg);
      }
    }
  }
}

/**
 * Queue an announcement
 *
 * @param message - Message to announce
 * @param priority - Announcement priority
 * @returns True if message was queued, false if duplicate/expired
 */
export function queueAnnouncement(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): boolean {
  // Check for duplicates
  if (isDuplicate(message)) {
    return false;
  }

  const now = Date.now();

  // Create announcement message
  const announcement: AnnouncementMessage = {
    id: `announcement-${now}-${Math.random().toString(36).substr(2, 9)}`,
    message,
    priority,
    timestamp: now,
  };

  // Handle assertive messages (immediate)
  if (priority === 'assertive') {
    // Clear existing queue and announce immediately
    queueState.queue = [announcement];
    addToHistory(message);
    processQueue();
    return true;
  }

  // Add to queue for polite messages
  queueState.queue.push(announcement);

  // Trim queue if too long
  if (queueState.queue.length > queueState.config.maxSize) {
    // Remove oldest polite message (keep newest)
    const politeIndex = queueState.queue.findIndex(m => m.priority === 'polite');
    if (politeIndex >= 0) {
      queueState.queue.splice(politeIndex, 1);
    }
  }

  addToHistory(message);

  // Start processing if not already running
  if (!queueState.isProcessing) {
    startQueueProcessor();
  }

  return true;
}

/**
 * Process the next message in queue
 */
function processQueue(): void {
  if (queueState.queue.length === 0) {
    queueState.isProcessing = false;
    return;
  }

  const now = Date.now();
  const timeSinceLastAnnounce = now - queueState.lastAnnounceTime;

  // Check if we need to wait before announcing
  if (timeSinceLastAnnounce < queueState.config.minDelay) {
    const delay = queueState.config.minDelay - timeSinceLastAnnounce;
    queueState.timerId = window.setTimeout(processQueue, delay);
    return;
  }

  // Get next message
  const message = queueState.queue.shift();

  if (!message) {
    queueState.isProcessing = false;
    return;
  }

  // Check if message expired
  const messageAge = now - message.timestamp;
  if (messageAge > queueState.config.messageExpiry) {
    // Message expired, skip to next
    processQueue();
    return;
  }

  // Announce the message
  if (announceCallback) {
    announceCallback(message.message, message.priority);
  }

  queueState.lastAnnounceTime = now;

  // Process next message
  if (queueState.queue.length > 0) {
    queueState.timerId = window.setTimeout(processQueue, queueState.config.minDelay);
  } else {
    queueState.isProcessing = false;
  }
}

/**
 * Start the queue processor
 *
 * Call this once at app initialization to enable automatic queue processing.
 */
export function startQueueProcessor(): void {
  if (queueState.isProcessing) {
    return;
  }

  queueState.isProcessing = true;
  processQueue();
}

/**
 * Stop the queue processor
 *
 * Stops automatic processing but preserves queue contents.
 */
export function stopQueueProcessor(): void {
  queueState.isProcessing = false;
  if (queueState.timerId !== null) {
    window.clearTimeout(queueState.timerId);
    queueState.timerId = null;
  }
}

/**
 * Set the announcement callback
 *
 * @param callback - Function to call when announcing
 *
 * @example
 * ```ts
 * setAnnounceCallback((message, priority) => {
 *   const region = document.querySelector(`[data-aria-live-region="${priority}"]`);
 *   if (region) region.textContent = message;
 * });
 * ```
 */
export function setAnnounceCallback(
  callback: (message: string, priority: 'polite' | 'assertive') => void
): void {
  announceCallback = callback;
}

/**
 * Clear all pending messages
 */
export function clearPendingMessages(): void {
  queueState.queue = [];
}

/**
 * Get queue statistics
 */
export function getQueueStats(): {
  queueSize: number;
  historySize: number;
  isProcessing: boolean;
  lastAnnounceTime: number;
} {
  return {
    queueSize: queueState.queue.length,
    historySize: queueState.history.size,
    isProcessing: queueState.isProcessing,
    lastAnnounceTime: queueState.lastAnnounceTime,
  };
}

/**
 * Flush the queue (announce all messages immediately)
 *
 * Useful for critical updates when users need to know everything.
 */
export function flushQueue(): void {
  stopQueueProcessor();

  const messages = [...queueState.queue];
  queueState.queue = [];

  for (const message of messages) {
    if (announceCallback) {
      announceCallback(message.message, message.priority);
    }
  }

  queueState.lastAnnounceTime = Date.now();
}

/**
 * Prioritize a message in the queue
 *
 * Moves a message matching the given content to the front.
 *
 * @param messageContent - Message to prioritize
 */
export function prioritizeMessage(messageContent: string): void {
  const index = queueState.queue.findIndex(m => m.message === messageContent);

  if (index >= 0) {
    const [message] = queueState.queue.splice(index, 1);
    message.priority = 'assertive'; // Upgrade priority
    queueState.queue.unshift(message);
  }
}

/**
 * Remove a specific message from queue
 *
 * @param messageContent - Message to remove
 */
export function removeMessage(messageContent: string): void {
  queueState.queue = queueState.queue.filter(m => m.message !== messageContent);
}

/**
 * Get messages by priority
 */
export function getMessagesByPriority(): {
  assertive: AnnouncementMessage[];
  polite: AnnouncementMessage[];
} {
  return {
    assertive: queueState.queue.filter(m => m.priority === 'assertive'),
    polite: queueState.queue.filter(m => m.priority === 'polite'),
  };
}

export default {
  configureQueue,
  resetQueue,
  getQueueSize,
  getPendingMessages,
  queueAnnouncement,
  startQueueProcessor,
  stopQueueProcessor,
  setAnnounceCallback,
  clearPendingMessages,
  getQueueStats,
  flushQueue,
  prioritizeMessage,
  removeMessage,
  getMessagesByPriority,
};
