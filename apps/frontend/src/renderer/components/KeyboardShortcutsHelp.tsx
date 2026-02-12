import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Search,
  FolderOpen,
  Plus,
  Settings,
  Calendar,
  Lightbulb,
  FileText,
  BookOpen,
  Wrench,
  Map,
  Sparkles,
  Github,
  GitPullRequest,
  Terminal,
  Save,
  Download,
  RotateCcw,
  Trash2,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  CornerDownRight,
  Minus,
  Plus as PlusIcon
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from './ui/dialog';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Input } from './ui/input';
import {
  KeyboardShortcut,
  formatShortcut,
  getPlatformModifierKey,
  getKeyName
} from '../hooks/useKeyboardNavigation';

interface ShortcutCategory {
  title: string;
  shortcuts: ShortcutItem[];
}

interface ShortcutItem {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  description: string;
  icon?: React.ElementType;
  category?: string;
}

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  const { t } = useTranslation(['accessibility', 'common']);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Get platform modifier key
  const modifierKey = getPlatformModifierKey();

  // Define all keyboard shortcuts
  const shortcutCategories: ShortcutCategory[] = [
    {
      title: t('accessibility:shortcuts.categories.navigation'),
      shortcuts: [
        { key: 'K', description: t('accessibility:shortcuts.nav.kanban'), icon: LayoutGrid },
        { key: 'A', description: t('accessibility:shortcuts.nav.terminals'), icon: Terminal },
        { key: 'N', description: t('accessibility:shortcuts.nav.insights'), icon: Sparkles },
        { key: 'D', description: t('accessibility:shortcuts.nav.roadmap'), icon: Map },
        { key: 'E', description: t('accessibility:shortcuts.nav.calendar'), icon: Calendar },
        { key: 'I', description: t('accessibility:shortcuts.nav.ideation'), icon: Lightbulb },
        { key: 'L', description: t('accessibility:shortcuts.nav.changelog'), icon: FileText },
        { key: 'C', description: t('accessibility:shortcuts.nav.context'), icon: BookOpen },
        { key: 'M', description: t('accessibility:shortcuts.nav.agentTools'), icon: Wrench },
        { key: 'W', description: t('accessibility:shortcuts.nav.worktrees'), icon: FolderOpen },
        {
          key: 'G',
          ctrlKey: true,
          description: t('accessibility:shortcuts.nav.githubIssues'),
          icon: Github
        },
        {
          key: 'P',
          ctrlKey: true,
          description: t('accessibility:shortcuts.nav.githubPRs'),
          icon: GitPullRequest
        }
      ]
    },
    {
      title: t('accessibility:shortcuts.categories.actions'),
      shortcuts: [
        {
          key: 'T',
          ctrlKey: true,
          metaKey: true,
          description: t('accessibility:shortcuts.actions.newTask'),
          icon: Plus
        },
        {
          key: 'O',
          ctrlKey: true,
          metaKey: true,
          description: t('accessibility:shortcuts.actions.openProject'),
          icon: FolderOpen
        },
        {
          key: ',',
          description: t('accessibility:shortcuts.actions.settings'),
          icon: Settings
        },
        {
          key: '/',
          description: t('accessibility:shortcuts.actions.search'),
          icon: Search
        }
      ]
    },
    {
      title: t('accessibility:shortcuts.categories.taskManagement'),
      shortcuts: [
        {
          key: 'Enter',
          description: t('accessibility:shortcuts.tasks.openTask'),
          icon: CornerDownRight
        },
        {
          key: 'Escape',
          description: t('accessibility:shortcuts.tasks.closeModal'),
          icon: X
        },
        {
          key: 's',
          ctrlKey: true,
          description: t('accessibility:shortcuts.tasks.saveTask'),
          icon: Save
        },
        {
          key: 'r',
          ctrlKey: true,
          description: t('accessibility:shortcuts.tasks.refreshTasks'),
          icon: RotateCcw
        }
      ]
    },
    {
      title: t('accessibility:shortcuts.categories.navigation'),
      shortcuts: [
        {
          key: 'Tab',
          description: t('accessibility:shortcuts.keyboard.nextFocus'),
          icon: ArrowRight
        },
        {
          key: 'Tab',
          shiftKey: true,
          description: t('accessibility:shortcuts.keyboard.previousFocus'),
          icon: ArrowLeft
        },
        {
          key: 'ArrowDown',
          description: t('accessibility:shortcuts.keyboard.moveDown'),
          icon: ArrowDown
        },
        {
          key: 'ArrowUp',
          description: t('accessibility:shortcuts.keyboard.moveUp'),
          icon: ArrowUp
        },
        {
          key: 'Home',
          description: t('accessibility:shortcuts.keyboard.firstItem')
        },
        {
          key: 'End',
          description: t('accessibility:shortcuts.keyboard.lastItem')
        }
      ]
    },
    {
      title: t('accessibility:shortcuts.categories.uiControls'),
      shortcuts: [
        {
          key: '?',
          shiftKey: true,
          description: t('accessibility:shortcuts.ui.showShortcuts')
        },
        {
          key: 'Escape',
          description: t('accessibility:shortcuts.ui.closeDialog')
        },
        {
          key: 'Tab',
          description: t('accessibility:shortcuts.ui.nextField')
        },
        {
          key: 'Tab',
          shiftKey: true,
          description: t('accessibility:shortcuts.ui.previousField')
        }
      ]
    },
    {
      title: t('accessibility:shortcuts.categories.modifierKeys'),
      shortcuts: [
        { key: modifierKey, description: t('accessibility:shortcuts.modifier.platformModifier') },
        { key: 'Shift', description: t('accessibility:shortcuts.modifier.shift') },
        { key: 'Alt', description: t('accessibility:shortcuts.modifier.alt') },
        { key: 'Ctrl', description: t('accessibility:shortcuts.modifier.control') },
        { key: 'Tab', description: t('accessibility:shortcuts.modifier.tab') },
        { key: 'Enter', description: t('accessibility:shortcuts.modifier.enter') },
        { key: 'Escape', description: t('accessibility:shortcuts.modifier.esc') },
        { key: 'Space', description: t('accessibility:shortcuts.modifier.space') }
      ]
    }
  ];

  // Filter shortcuts based on search query
  const filteredCategories = shortcutCategories
    .map(category => ({
      ...category,
      shortcuts: category.shortcuts.filter(shortcut =>
        shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shortcut.key.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }))
    .filter(category => category.shortcuts.length > 0);

  // Flatten for keyboard navigation
  const allShortcuts = filteredCategories.flatMap(cat => cat.shortcuts);

  // Handle keyboard navigation within dialog
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Don't interfere with search input
    if (e.target instanceof HTMLInputElement) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % allShortcuts.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + allShortcuts.length) % allShortcuts.length);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        // Find the category containing selected shortcut and highlight it
        const selectedShortcut = allShortcuts[selectedIndex];
        if (selectedShortcut) {
          console.log('Navigate to shortcut:', selectedShortcut.description);
        }
        break;
    }
  }, [allShortcuts, selectedIndex]);

  useEffect(() => {
    if (open) {
      setSelectedIndex(0);
      setSearchQuery('');
    }
  }, [open]);

  const renderShortcut = (shortcut: ShortcutItem, index: number) => {
    const Icon = shortcut.icon;
    const isSelected = index === selectedIndex;

    return (
      <div
        key={`${shortcut.key}-${shortcut.description}`}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-150',
          'hover:bg-accent',
          isSelected && 'bg-accent ring-2 ring-ring'
        )}
        tabIndex={-1}
        aria-selected={isSelected}
      >
        {/* Icon */}
        {Icon && (
          <div className="flex-shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        {/* Key combination */}
        <kbd
          className={cn(
            'pointer-events-none shrink-0 select-none',
            'flex items-center gap-1 rounded-md border border-border',
            'bg-secondary px-2 py-1',
            'font-mono text-xs font-medium text-muted-foreground',
            'min-w-[80px] justify-center'
          )}
          aria-label={`Keyboard shortcut: ${shortcut.key}`}
        >
          {shortcut.ctrlKey && <span>Ctrl</span>}
          {shortcut.metaKey && <span>? Cmd</span>}
          {shortcut.altKey && <span>Alt</span>}
          {shortcut.shiftKey && <span>Shift</span>}
          {shortcut.ctrlKey || shortcut.metaKey || shortcut.altKey || shortcut.shiftKey ? (
            <span className="mx-1">+</span>
          ) : null}
          <span className="text-foreground">{getKeyName(shortcut.key)}</span>
        </kbd>

        {/* Description */}
        <span className="flex-1 text-sm text-foreground">
          {shortcut.description}
        </span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[80vh]"
        onKeyDown={handleKeyDown}
        aria-labelledby="keyboard-shortcuts-title"
        aria-describedby="keyboard-shortcuts-description"
      >
        <DialogHeader>
          <DialogTitle id="keyboard-shortcuts-title" className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t('accessibility:shortcuts.title')}
          </DialogTitle>
          <DialogDescription id="keyboard-shortcuts-description">
            {t('accessibility:shortcuts.description', { modifierKey })}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="mb-4">
          <Input
            type="search"
            placeholder={t('accessibility:shortcuts.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t('accessibility:shortcuts.searchLabel')}
            autoFocus
          />
        </div>

        <Separator />

        {/* Shortcuts list */}
        <ScrollArea className="max-h-[calc(80vh-200px)] px-1">
          <div
            className="space-y-6 py-4"
            role="listbox"
            aria-label="Keyboard shortcuts list"
          >
            {filteredCategories.map((category, catIndex) => {
              const startIndex = filteredCategories
                .slice(0, catIndex)
                .reduce((sum, cat) => sum + cat.shortcuts.length, 0);

              return (
                <div key={category.title} className="space-y-2">
                  {/* Category header */}
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-3">
                    {category.title}
                  </h3>

                  {/* Shortcuts in category */}
                  <div
                    className="space-y-1"
                    role="group"
                    aria-label={`${category.title} shortcuts`}
                  >
                    {category.shortcuts.map((shortcut, shortcutIndex) =>
                      renderShortcut(shortcut, startIndex + shortcutIndex)
                    )}
                  </div>
                </div>
              );
            })}

            {/* No results message */}
            {filteredCategories.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {t('accessibility:shortcuts.noResults')}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:buttons.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper function for className merging (if cn utility is not available)
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Import types for reference
interface ShortcutItem {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  description: string;
  icon?: React.ElementType;
}
