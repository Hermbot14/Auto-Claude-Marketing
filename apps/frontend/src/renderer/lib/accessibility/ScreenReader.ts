/**
 * Screen Reader Detection Module
 *
 * Provides utilities to detect and manage screen reader usage.
 * Screen readers announce content to users with visual impairments.
 *
 * @remarks
 * There is no standard JavaScript API for screen reader detection.
 * This module uses heuristics based on user behavior patterns
 * and browser capabilities to infer screen reader usage.
 *
 * Detection methods:
 * 1. Touch + focus behavior (mobile screen readers)
 * 2. Tab navigation patterns (desktop screen readers)
 * 3. Reduced motion preference (often correlated)
 * 4. VoiceOver-specific detection on Apple devices
 *
 * @see {@link https://www.smashingmagazine.com/2018/05/15/screen-readers-can-be-useful-for-everyone/}
 *
 * @example
 * ```ts
 * import { detectScreenReader, useScreenReaderDetection } from './ScreenReader';
 *
 * // Static detection
 * const isScreenReaderActive = detectScreenReader();
 *
 * // Hook-based detection
 * function MyComponent() {
 *   const { isScreenReaderActive, screenReaderType } = useScreenReaderDetection();
 *   return <div aria-live={isScreenReaderActive ? 'polite' : 'off'}>{...}</div>;
 * }
 * ```
 */

/**
 * Detected screen reader types
 */
export type ScreenReaderType = 'nvda' | 'jaws' | 'voiceover' | 'talkback' | 'other' | 'none';

/**
 * Screen reader detection result
 */
export interface ScreenReaderInfo {
  /** Whether a screen reader is likely active */
  isActive: boolean;
  /** Detected screen reader type */
  type: ScreenReaderType;
  /** Confidence level (0-1) */
  confidence: number;
}

/**
 * Detection metrics for heuristic analysis
 */
interface DetectionMetrics {
  /** Number of rapid tab switches (screen reader navigation pattern) */
  tabSwitches: number;
  /** Number of times focus moved without click */
  focusOnlyInteractions: number;
  /** Whether user prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Whether device has touch capability */
  hasTouch: boolean;
  /** User agent string */
  userAgent: string;
}

// Singleton state for detection
const detectionState = {
  tabSwitches: 0,
  focusOnlyInteractions: 0,
  lastTabTime: 0,
  isInitialized: false,
};

/**
 * Detect if screen reader is active using heuristics
 *
 * @returns Screen reader detection info
 */
export function detectScreenReader(): ScreenReaderInfo {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { isActive: false, type: 'none', confidence: 0 };
  }

  let type: ScreenReaderType = 'none';
  let confidence = 0;

  // Check for VoiceOver (macOS/iOS)
  if (isVoiceOverActive()) {
    type = 'voiceover';
    confidence = Math.max(confidence, 0.8);
  }

  // Check for TalkBack (Android)
  if (isTalkBackActive()) {
    type = 'talkback';
    confidence = Math.max(confidence, 0.8);
  }

  // Check for NVDA/JAWS (Windows)
  if (isWindowsScreenReaderActive()) {
    type = 'nvda';
    confidence = Math.max(confidence, 0.6);
  }

  // Check user agent for screen reader signatures
  const uaDetection = detectFromUserAgent();
  if (uaDetection.type !== 'none') {
    type = uaDetection.type;
    confidence = Math.max(confidence, 0.7);
  }

  // Check for reduced motion preference (correlated with screen reader use)
  if (prefersReducedMotion()) {
    confidence = Math.max(confidence, 0.3);
  }

  return {
    isActive: confidence > 0.5,
    type,
    confidence,
  };
}

/**
 * Detect VoiceOver on Apple devices
 */
function isVoiceOverActive(): boolean {
  // VoiceOver sets a special class on body element
  const hasVoiceOverClass = document.body.classList.contains('voiceover-active');

  // VoiceOver on iOS often has touch but also requires focus-based navigation
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const hasTouch = 'ontouchstart' in window;
  const unusualTouchFocus = isIOS && hasTouch && detectionState.focusOnlyInteractions > 3;

  return hasVoiceOverClass || unusualTouchFocus;
}

/**
 * Detect TalkBack on Android
 */
function isTalkBackActive(): boolean {
  const isAndroid = /Android/.test(navigator.userAgent);

  // TalkBack often requires focus-based navigation with touch
  const hasTouch = 'ontouchstart' in window;
  const unusualTouchFocus = isAndroid && hasTouch && detectionState.focusOnlyInteractions > 3;

  return unusualTouchFocus;
}

/**
 * Detect Windows screen readers (NVDA/JAWS)
 */
function isWindowsScreenReaderActive(): boolean {
  const isWindows = /Win/.test(navigator.platform);

  // Windows screen readers users navigate primarily with keyboard
  // Rapid tab switching is a strong indicator
  const rapidTabNavigation = detectionState.tabSwitches > 5;
  const highFocusInteractions = detectionState.focusOnlyInteractions > 5;

  return isWindows && (rapidTabNavigation || highFocusInteractions);
}

/**
 * Detect screen reader from user agent string
 */
function detectFromUserAgent(): ScreenReaderInfo {
  const ua = navigator.userAgent.toLowerCase();

  // NVDA signatures
  if (ua.includes('nvda')) {
    return { isActive: true, type: 'nvda', confidence: 0.9 };
  }

  // JAWS signatures
  if (ua.includes('jaws')) {
    return { isActive: true, type: 'jaws', confidence: 0.9 };
  }

  // VoiceOver signatures (iOS/macOS)
  if (ua.includes('voiceover') || /iphone|ipad|ipod|mac/.test(ua)) {
    return { isActive: false, type: 'voiceover', confidence: 0.5 };
  }

  // TalkBack signatures (Android)
  if (ua.includes('talkback')) {
    return { isActive: true, type: 'talkback', confidence: 0.9 };
  }

  return { isActive: false, type: 'none', confidence: 0 };
}

/**
 * Check if user prefers reduced motion
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Initialize screen reader detection tracking
 *
 * Sets up event listeners to track user interaction patterns
 */
export function initializeScreenReaderDetection(): void {
  if (detectionState.isInitialized) {
    return;
  }

  detectionState.isInitialized = true;

  // Track tab key usage (screen reader users tab frequently)
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      const now = Date.now();
      const timeSinceLastTab = now - detectionState.lastTabTime;

      // Count rapid tab switches (within 500ms)
      if (timeSinceLastTab < 500 && timeSinceLastTab > 0) {
        detectionState.tabSwitches++;
      }

      detectionState.lastTabTime = now;
    }
  });

  // Track focus events without click events
  let lastFocusedElement: HTMLElement | null = null;

  document.addEventListener('focusin', (event) => {
    const target = event.target as HTMLElement;

    // If focus moved without a click/keydown, track it
    // Screen readers often move focus programmatically
    if (lastFocusedElement && lastFocusedElement !== target) {
      detectionState.focusOnlyInteractions++;
    }

    lastFocusedElement = target;
  }, true);

  // Reset counters periodically (they're only useful for recent behavior)
  setInterval(() => {
    detectionState.tabSwitches = Math.max(0, detectionState.tabSwitches - 1);
    detectionState.focusOnlyInteractions = Math.max(0, detectionState.focusOnlyInteractions - 1);
  }, 30000); // Every 30 seconds
}

/**
 * React hook for screen reader detection
 *
 * @returns Screen reader detection info that updates on changes
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isScreenReaderActive, screenReaderType } = useScreenReaderDetection();
 *
 *   return (
 *     <div aria-live={isScreenReaderActive ? 'polite' : 'off'}>
 *       {isScreenReaderActive ? 'Screen reader optimized content' : 'Standard content'}
 *     </div>
 *   );
 * }
 * ```
 */
export function useScreenReaderDetection(): {
  isScreenReaderActive: boolean;
  screenReaderType: ScreenReaderType;
  confidence: number;
  recheck: () => void;
} {
  const [info, setInfo] = React.useState(() => detectScreenReader());

  // Initialize detection on first use
  React.useEffect(() => {
    initializeScreenReaderDetection();
  }, []);

  // Periodically recheck for screen reader status
  const recheck = React.useCallback(() => {
    setInfo(detectScreenReader());
  }, []);

  // Recheck periodically
  React.useEffect(() => {
    const interval = setInterval(() => {
      recheck();
    }, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [recheck]);

  return {
    isScreenReaderActive: info.isActive,
    screenReaderType: info.type,
    confidence: info.confidence,
    recheck,
  };
}

/**
 * Check if announcements should be verbose for screen readers
 *
 * @returns True if announcements should be more descriptive
 */
export function shouldUseVerboseAnnouncements(): boolean {
  const info = detectScreenReader();
  return info.isActive && info.confidence > 0.6;
}

/**
 * Get appropriate announcement delay for screen reader
 *
 * Screen readers need time to finish current announcement
 * before processing the next one.
 *
 * @returns Delay in milliseconds
 */
export function getAnnouncementDelay(): number {
  const info = detectScreenReader();

  if (!info.isActive) {
    return 100; // Minimal delay for non-screen-reader users
  }

  // Different screen readers have different speeds
  switch (info.type) {
    case 'nvda':
      return 500; // NVDA is relatively fast
    case 'jaws':
      return 750; // JAWS needs more time
    case 'voiceover':
      return 600; // VoiceOver is moderate
    case 'talkback':
      return 500; // TalkBack is relatively fast
    default:
      return 500; // Default for unknown screen readers
  }
}

/**
 * Manually set screen reader active state for testing
 *
 * @param active - Whether screen reader should be considered active
 *
 * @example
 * ```ts
 * // For testing screen reader announcements
 * setScreenReaderTestMode(true);
 * announce('Test message');
 * setScreenReaderTestMode(false);
 * ```
 */
export function setScreenReaderTestMode(active: boolean): void {
  if (typeof window === 'undefined') return;

  if (active) {
    document.body.setAttribute('data-screen-reader-test', 'true');
  } else {
    document.body.removeAttribute('data-screen-reader-test');
  }
}

/**
 * Check if screen reader test mode is active
 */
export function isScreenReaderTestMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.body.hasAttribute('data-screen-reader-test');
}

// Import React for hooks
import * as React from 'react';

export default {
  detectScreenReader,
  useScreenReaderDetection,
  initializeScreenReaderDetection,
  shouldUseVerboseAnnouncements,
  getAnnouncementDelay,
  setScreenReaderTestMode,
  isScreenReaderTestMode,
};
