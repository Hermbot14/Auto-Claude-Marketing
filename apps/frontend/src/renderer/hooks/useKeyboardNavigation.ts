import { useEffect, useRef, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  description: string;
  action: (event: KeyboardEvent) => void | boolean;
  enabled?: () => boolean;
  preventDefault?: boolean;
}

export interface KeyboardNavigationOptions {
  enabled?: boolean;
  scope?: 'global' | 'local';
  ignoreInputs?: boolean;
}

const GLOBAL_SHORTCUTS: KeyboardShortcut[] = [];

/**
 * Hook for handling keyboard navigation and shortcuts
 *
 * Provides:
 * - Global keyboard shortcut registration
 * - Local component-specific shortcuts
 * - Automatic cleanup of event listeners
 * - Input field detection to prevent unwanted triggers
 */
export function useKeyboardNavigation(
  shortcuts: KeyboardShortcut[],
  options: KeyboardNavigationOptions = {}
) {
  const {
    enabled = true,
    scope = 'local',
    ignoreInputs = true,
  } = options;

  const shortcutsRef = useRef<KeyboardShortcut[]>(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Check if we should ignore this event (typing in inputs)
    if (ignoreInputs && isInputElement(event.target)) {
      return;
    }

    const isModifierKey = event.ctrlKey || event.metaKey || event.altKey;

    // Build key combination string for matching
    const keyCombo = buildKeyCombo(event);

    // Find matching shortcut (reverse to prioritize later-added shortcuts)
    const matchingShortcut = [...shortcutsRef.current]
      .reverse()
      .find((shortcut) => {
        // Check if shortcut is disabled
        if (shortcut.enabled && !shortcut.enabled()) {
          return false;
        }

        // Build expected key combo
        const expectedCombo = buildShortcutKeyCombo(shortcut);

        return keyCombo === expectedCombo;
      });

    if (matchingShortcut) {
      if (matchingShortcut.preventDefault !== false) {
        event.preventDefault();
      }
      event.stopPropagation();

      const result = matchingShortcut.action(event);

      // If action returns false, don't stop propagation
      if (result === false) {
        event.stopPropagation();
      }
    }
  }, [enabled, ignoreInputs]);

  useEffect(() => {
    if (scope === 'global') {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, scope]);

  return {
    handleKeyDown,
  };
}

/**
 * Check if target is an input element (should ignore shortcuts)
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  const inputTypes = ['input', 'textarea', 'select'];

  if (inputTypes.includes(tagName)) {
    return true;
  }

  // Check contenteditable
  if (target.isContentEditable) {
    return true;
  }

  return false;
}

/**
 * Build key combination string from event
 */
function buildKeyCombo(event: KeyboardEvent): string {
  const parts: string[] = [];

  if (event.ctrlKey) parts.push('ctrl');
  if (event.metaKey) parts.push('meta');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');

  // Normalize key to lowercase for comparison
  parts.push(event.key.toLowerCase());

  return parts.join('+');
}

/**
 * Build key combination string from shortcut definition
 */
function buildShortcutKeyCombo(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) parts.push('ctrl');
  if (shortcut.metaKey) parts.push('meta');
  if (shortcut.altKey) parts.push('alt');
  if (shortcut.shiftKey) parts.push('shift');

  // Normalize key to lowercase for comparison
  parts.push(shortcut.key.toLowerCase());

  return parts.join('+');
}

/**
 * Format shortcut for display (e.g., "Ctrl+N" or "? Cmd+N")
 */
export function formatShortcut(shortcut: KeyboardShortcut, platform?: 'mac' | 'windows' | 'linux'): string {
  const isMac = platform === 'mac' || (platform === undefined && typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0);

  const parts: string[] = [];

  if (shortcut.ctrlKey) {
    parts.push(isMac ? '? Ctrl' : 'Ctrl');
  }
  if (shortcut.metaKey) {
    parts.push(isMac ? '? Cmd' : 'Win');
  }
  if (shortcut.altKey) {
    parts.push('Alt');
  }
  if (shortcut.shiftKey) {
    parts.push('Shift');
  }

  // Capitalize the main key
  const key = shortcut.key.length === 1
    ? shortcut.key.toUpperCase()
    : shortcut.key.charAt(0).toUpperCase() + shortcut.key.slice(1);

  parts.push(key);

  return parts.join(' ');
}

/**
 * Get readable key name for display
 */
export function getKeyName(key: string): string {
  const keyNames: Record<string, string> = {
    ' ': 'Space',
    'arrowup': '? Up',
    'arrowdown': '? Down',
    'arrowleft': '? Left',
    'arrowright': '? Right',
    'escape': 'Esc',
    'enter': 'Enter',
    'tab': 'Tab',
    'backspace': 'Backspace',
    'delete': 'Delete',
    'home': 'Home',
    'end': 'End',
    'pageup': 'Page Up',
    'pagedown': 'Page Down',
  };

  return keyNames[key.toLowerCase()] || key;
}

/**
 * Register a global keyboard shortcut
 */
export function registerGlobalShortcut(shortcut: KeyboardShortcut): () => void {
  GLOBAL_SHORTCUTS.push(shortcut);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (isInputElement(event.target)) return;
    if (shortcut.enabled && !shortcut.enabled()) return;

    const expectedCombo = buildShortcutKeyCombo(shortcut);
    const actualCombo = buildKeyCombo(event);

    if (expectedCombo === actualCombo) {
      if (shortcut.preventDefault !== false) {
        event.preventDefault();
      }
      event.stopPropagation();
      shortcut.action(event);
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    const index = GLOBAL_SHORTCUTS.indexOf(shortcut);
    if (index > -1) {
      GLOBAL_SHORTCUTS.splice(index, 1);
    }
  };
}

/**
 * Get all registered global shortcuts (for help dialog)
 */
export function getGlobalShortcuts(): KeyboardShortcut[] {
  return [...GLOBAL_SHORTCUTS];
}

/**
 * Detect if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Detect if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Trap focus within a container (for modals, dialogs)
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        // Shift+Tab: move to last element if on first
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: move to first element if on last
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);

    // Focus first element when mounted
    if (firstElement) {
      firstElement.focus();
    }

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [containerRef, enabled]);
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  if (typeof document === 'undefined') return;

  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement is made
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Restore focus to previously focused element
 */
export function useRestoreFocus(enabled: boolean = true) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Store current focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    return () => {
      // Restore focus when unmounted
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [enabled]);
}

/**
 * Get platform-specific modifier key name
 */
export function getPlatformModifierKey(): string {
  if (typeof navigator === 'undefined') return 'Ctrl';

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return isMac ? '? Cmd' : 'Ctrl';
}
