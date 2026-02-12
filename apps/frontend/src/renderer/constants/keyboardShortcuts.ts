/**
 * Keyboard Shortcuts Configuration
 *
 * Central registry of all keyboard shortcuts used throughout the application.
 * This file serves as the single source of truth for shortcut definitions.
 *
 * Shortcuts are platform-aware and will display correctly for both Mac (?) Cmd)
 * and Windows/Linux (Ctrl) users.
 */

import type { KeyboardShortcut } from '../hooks/useKeyboardNavigation';

// ============================================
// GLOBAL SHORTCUTS - Available anywhere in the app
// ============================================

export const GLOBAL_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: '?',
    shiftKey: true,
    description: 'accessibility:shortcuts.title',
    action: () => {
      // This is handled by the KeyboardShortcutsHelp component
      // The actual toggle is managed by component state
    },
    preventDefault: true
  },
  {
    key: 'Escape',
    description: 'accessibility:shortcuts.ui.closeDialog',
    action: () => {
      // Close active modal/dialog
      const closeButton = document.querySelector('[data-dialog-close]') as HTMLButtonElement;
      closeButton?.click();
    },
    preventDefault: true
  }
];

// ============================================
// NAVIGATION SHORTCUTS - View switching
// ============================================

export const NAVIGATION_SHORTCUTS: Record<string, KeyboardShortcut> = {
  kanban: {
    key: 'K',
    description: 'accessibility:shortcuts.nav.kanban',
    action: () => navigateToView('kanban')
  },
  terminals: {
    key: 'A',
    description: 'accessibility:shortcuts.nav.terminals',
    action: () => navigateToView('terminals')
  },
  insights: {
    key: 'N',
    description: 'accessibility:shortcuts.nav.insights',
    action: () => navigateToView('insights')
  },
  roadmap: {
    key: 'D',
    description: 'accessibility:shortcuts.nav.roadmap',
    action: () => navigateToView('roadmap')
  },
  calendar: {
    key: 'E',
    description: 'accessibility:shortcuts.nav.calendar',
    action: () => navigateToView('calendar'),
    requiresProject: false // Calendar can be accessed without project (shows demo)
  },
  ideation: {
    key: 'I',
    description: 'accessibility:shortcuts.nav.ideation',
    action: () => navigateToView('ideation')
  },
  changelog: {
    key: 'L',
    description: 'accessibility:shortcuts.nav.changelog',
    action: () => navigateToView('changelog')
  },
  context: {
    key: 'C',
    description: 'accessibility:shortcuts.nav.context',
    action: () => navigateToView('context')
  },
  'agent-tools': {
    key: 'M',
    description: 'accessibility:shortcuts.nav.agentTools',
    action: () => navigateToView('agent-tools')
  },
  worktrees: {
    key: 'W',
    description: 'accessibility:shortcuts.nav.worktrees',
    action: () => navigateToView('worktrees')
  },
  'github-issues': {
    key: 'G',
    description: 'accessibility:shortcuts.nav.githubIssues',
    action: () => navigateToView('github-issues'),
    enabled: () => isGitHubEnabled()
  },
  'github-prs': {
    key: 'P',
    description: 'accessibility:shortcuts.nav.githubPRs',
    action: () => navigateToView('github-prs'),
    enabled: () => isGitHubEnabled()
  },
  'gitlab-issues': {
    key: 'B',
    description: 'accessibility:shortcuts.nav.gitlabIssues',
    action: () => navigateToView('gitlab-issues'),
    enabled: () => isGitLabEnabled()
  },
  'gitlab-mrs': {
    key: 'R',
    description: 'accessibility:shortcuts.nav.gitlabMRs',
    action: () => navigateToView('gitlab-merge-requests'),
    enabled: () => isGitLabEnabled()
  }
};

// ============================================
// ACTION SHORTCUTS - Common actions
// ============================================

export const ACTION_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 'T',
    ctrlKey: true,
    metaKey: true,
    description: 'accessibility:shortcuts.actions.newTask',
    action: () => openNewTaskDialog(),
    preventDefault: true
  },
  {
    key: 'O',
    ctrlKey: true,
    metaKey: true,
    description: 'accessibility:shortcuts.actions.openProject',
    action: () => openProjectDialog(),
    preventDefault: true
  },
  {
    key: ',',
    description: 'accessibility:shortcuts.actions.settings',
    action: () => openSettingsDialog(),
    preventDefault: true
  },
  {
    key: '/',
    description: 'accessibility:shortcuts.actions.search',
    action: () => focusSearch(),
    preventDefault: true
  }
];

// ============================================
// TASK MANAGEMENT SHORTCUTS
// ============================================

export const TASK_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 'Enter',
    description: 'accessibility:shortcuts.tasks.openTask',
    action: (e: KeyboardEvent) => {
      const selectedTask = document.querySelector('[data-selected-task="true"]') as HTMLElement;
      if (selectedTask) {
        selectedTask.click();
      }
    },
    preventDefault: true
  },
  {
    key: 'Delete',
    description: 'common:accessibility.deleteAriaLabel',
    action: (e: KeyboardEvent) => {
      const deleteButton = document.querySelector('[data-task-delete]') as HTMLButtonElement;
      if (deleteButton && isVisible(deleteButton)) {
        deleteButton.click();
      }
    },
    preventDefault: true
  },
  {
    key: 's',
    ctrlKey: true,
    description: 'accessibility:shortcuts.tasks.saveTask',
    action: (e: KeyboardEvent) => {
      const saveButton = document.querySelector('[data-task-save]') as HTMLButtonElement;
      if (saveButton) {
        saveButton.click();
      }
    },
    preventDefault: true
  },
  {
    key: 'r',
    ctrlKey: true,
    description: 'accessibility:shortcuts.tasks.refreshTasks',
    action: () => {
      const refreshButton = document.querySelector('[data-refresh-tasks]') as HTMLButtonElement;
      if (refreshButton) {
        refreshButton.click();
      }
    }
  }
];

// ============================================
// FORM SHORTCUTS
// ============================================

export const FORM_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 'Enter',
    description: 'accessibility:shortcuts.ui.submitForm',
    action: (e: KeyboardEvent) => {
      const form = (e.target as HTMLElement).closest('form');
      if (form) {
        const submitButton = form.querySelector('[type="submit"]') as HTMLButtonElement;
        submitButton?.click();
      }
    }
  },
  {
    key: 'Escape',
    description: 'accessibility:shortcuts.ui.closeDialog',
    action: (e: KeyboardEvent) => {
      const form = (e.target as HTMLElement).closest('form');
      if (form) {
        // Find cancel button and click it
        const cancelButton = form.querySelector('[data-cancel]') as HTMLButtonElement;
        cancelButton?.click();
      }
    }
  }
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Navigate to a specific sidebar view
 */
function navigateToView(viewId: string): void {
  const viewButton = document.querySelector(`[data-view-id="${viewId}"]`) as HTMLButtonElement;
  if (viewButton) {
    viewButton.click();
  }
}

/**
 * Check if GitHub integration is enabled
 */
function isGitHubEnabled(): boolean {
  // This should check the actual project state
  // For now, return true if GitHub nav items exist
  return !!document.querySelector('[data-view-id="github-issues"]');
}

/**
 * Check if GitLab integration is enabled
 */
function isGitLabEnabled(): boolean {
  return !!document.querySelector('[data-view-id="gitlab-issues"]');
}

/**
 * Open new task dialog
 */
function openNewTaskDialog(): void {
  const newTaskButton = document.querySelector('[data-new-task]') as HTMLButtonElement;
  if (newTaskButton) {
    newTaskButton.click();
  }
}

/**
 * Open project dialog
 */
function openProjectDialog(): void {
  const addProjectButton = document.querySelector('[data-add-project]') as HTMLButtonElement;
  if (addProjectButton) {
    addProjectButton.click();
  }
}

/**
 * Open settings dialog
 */
function openSettingsDialog(): void {
  const settingsButton = document.querySelector('[data-settings]') as HTMLButtonElement;
  if (settingsButton) {
    settingsButton.click();
  }
}

/**
 * Focus search input
 */
function focusSearch(): void {
  const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
  if (searchInput) {
    searchInput.focus();
    searchInput.select();
  }
}

/**
 * Check if element is visible in viewport
 */
function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

// ============================================
// ALL SHORTCUTS - Combined list
// ============================================

/**
 * Get all shortcuts combined (for help dialog)
 */
export function getAllShortcuts(): KeyboardShortcut[] {
  return [
    ...Object.values(NAVIGATION_SHORTCUTS),
    ...ACTION_SHORTCUTS,
    ...TASK_SHORTCUTS,
    ...FORM_SHORTCUTS
  ];
}

/**
 * Get shortcuts by category
 */
export function getShortcutsByCategory(category: 'navigation' | 'actions' | 'tasks' | 'forms'): KeyboardShortcut[] {
  switch (category) {
    case 'navigation':
      return Object.values(NAVIGATION_SHORTCUTS);
    case 'actions':
      return ACTION_SHORTCUTS;
    case 'tasks':
      return TASK_SHORTCUTS;
    case 'forms':
      return FORM_SHORTCUTS;
    default:
      return [];
  }
}

// ============================================
// PLATFORM DETECTION
// ============================================

/**
 * Get platform-specific modifier key symbol
 */
export function getPlatformModifierSymbol(): string {
  const isMac = typeof navigator !== 'undefined' &&
    navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return isMac ? '? Cmd' : 'Ctrl';
}

/**
 * Get platform type
 */
export function getPlatform(): 'mac' | 'windows' | 'linux' {
  if (typeof navigator === 'undefined') return 'windows';

  const platform = navigator.platform.toLowerCase();

  if (platform.includes('mac')) return 'mac';
  if (platform.includes('win')) return 'windows';
  if (platform.includes('linux')) return 'linux';

  return 'windows';
}

// ============================================
// CONFLICT RESOLUTION
// ============================================

/**
 * Shortcuts that should be disabled in specific contexts
 */
export const SHORTCUT_CONFLICTS = {
  inInput: ['/', 'F', 'Command', 'Meta'],
  inTextarea: ['/', 'Escape'],
  inSelect: ['Space', 'ArrowUp', 'ArrowDown']
};

/**
 * Check if a shortcut should be disabled in current context
 */
export function isShortcutDisabled(key: string, target?: EventTarget): boolean {
  if (!target) return false;

  const tagName = (target as HTMLElement).tagName.toLowerCase();

  if (tagName === 'input' || tagName === 'textarea') {
    return SHORTCUT_CONFLICTS.inInput.includes(key);
  }

  if (tagName === 'select') {
    return SHORTCUT_CONFLICTS.inSelect.includes(key);
  }

  return false;
}
