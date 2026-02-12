import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, X } from 'lucide-react';
import { useOnboarding } from '../../hooks/useOnboarding';
import type { ContextualHelpProps } from '../../../shared/types/onboarding';
import { cn } from '../../shared/lib/utils';

/**
 * ContextualHelp - Smart tooltip system for contextual guidance
 *
 * Provides intelligent help tooltips with:
 * - Hover-based activation with configurable delay
 * - Smart positioning to avoid viewport overflow
 * - "Don't show again" option
 * - Dismissal tracking per user
 */
export function ContextualHelp({
  tooltipId,
  title,
  description,
  learnMoreLink,
  placement = 'top',
  children,
  delay = 300
}: ContextualHelpProps) {
  const { t } = useTranslation(['onboarding', 'common']);
  const [, actions] = useOnboarding();

  // Local state
  const [isOpen, setIsOpen] = useState(false);
  const [isPermanentlyDismissed, setIsPermanentlyDismissed] = useState(false);
  const position, setPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const calculatedPlacement, setCalculatedPlacement] = useState(placement);

  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if this tooltip has been dismissed
  useEffect(() => {
    const dismissed = actions.isTooltipDismissed(tooltipId);
    setIsPermanentlyDismissed(dismissed);
  }, [tooltipId, actions]);

  /**
   * Calculate optimal tooltip position
   */
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 8;

    let x = 0;
    let y = 0;
    let newPlacement = placement;

    // Calculate horizontal position
    switch (placement) {
      case 'top':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.top - tooltipRect.height - padding;
        break;

      case 'bottom':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.bottom + padding;
        break;

      case 'left':
        x = triggerRect.left - tooltipRect.width - padding;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;

      case 'right':
        x = triggerRect.right + padding;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
    }

    // Adjust for horizontal overflow
    if (x < padding) {
      x = padding;
    } else if (x + tooltipRect.width > viewportWidth - padding) {
      x = viewportWidth - tooltipRect.width - padding;
    }

    // Adjust for vertical overflow
    if (y < padding) {
      y = padding;
      newPlacement = 'bottom';
    } else if (y + tooltipRect.height > viewportHeight - padding) {
      y = viewportHeight - tooltipRect.height - padding;
      newPlacement = 'top';
    }

    setPosition({ x, y, width: tooltipRect.width, height: tooltipRect.height });
    setCalculatedPlacement(newPlacement);
  }, [placement]);

  // Recalculate on open
  useEffect(() => {
    if (isOpen) {
      calculatePosition();
    }
  }, [isOpen, calculatePosition]);

  /**
   * Handle mouse enter - start delay timer
   */
  const handleMouseEnter = useCallback(() => {
    if (isPermanentlyDismissed) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, delay);
  }, [delay, isPermanentlyDismissed]);

  /**
   * Handle mouse leave - hide tooltip immediately
   */
  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsOpen(false);
  }, []);

  /**
   * Handle tooltip dismissal
   */
  const handleDismiss = useCallback(() => {
    actions.dismissTooltip(tooltipId);
    setIsPermanentlyDismissed(true);
    setIsOpen(false);
  }, [tooltipId, actions]);

  // Focus trapping when tooltip is open
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleMouseLeave();
      }
    };

    window.addEventListener('keydown', handleFocusTrap);
    return () => window.removeEventListener('keydown', handleFocusTrap);
  }, [isOpen, handleDismiss, handleMouseLeave]);

  // Position tooltip in portal
  const content = (
    <AnimatePresence>
      {(isOpen || isPermanentlyDismissed) && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
            onClick={handleMouseLeave}
          />

          {/* Tooltip */}
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'fixed z-50 shadow-lg rounded-lg border border-border bg-popover text-popover-foreground p-4 max-w-sm',
              'pointer-events-auto'
            )}
            style={{
              left: position.x,
              top: position.y,
              transformOrigin: getTransformOrigin(calculatedPlacement)
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                <Info className="h-3 w-3" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {title && (
                  <h4 className="font-semibold text-foreground text-sm mb-1">
                    {title}
                  </h4>
                )}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {description}
                </p>

                {learnMoreLink && (
                  <a
                    href={learnMoreLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                  >
                    {t('onboarding:help.learnMore')}
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6 6M9 6v6h3v-6h3" />
                    </svg>
                  </a>
                )}
              </div>

              {/* Dismiss button */}
              <button
                onClick={handleDismiss}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5 -mt-0.5"
                aria-label="Dismiss tooltip"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Arrow indicator */}
            <div
              className={cn(
                'absolute w-2 h-2 bg-popover',
                getArrowClasses(calculatedPlacement)
              )}
              style={getArrowPosition(calculatedPlacement, position.width, position.height)}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        className="inline-flex"
      >
        {children}
      </div>

      {/* Portal tooltip */}
      {typeof document !== 'undefined' && (
        <>
          {document.createPortal(
            content,
            document.body
          )}
        </>
      )}
    </>
  );
}

/**
 * Get transform origin based on placement
 */
function getTransformOrigin(placement: string): string {
  const origins: Record<string, string> = {
    top: 'bottom center',
    bottom: 'top center',
    left: 'right center',
    right: 'left center'
  };
  return origins[placement] || 'bottom center';
}

/**
 * Get arrow CSS classes based on placement
 */
function getArrowClasses(placement: string): string {
  switch (placement) {
    case 'top':
      return 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full';
    case 'bottom':
      return 'top-0 left-1/2 -translate-x-1/2 translate-y-full';
    case 'left':
      return 'right-0 top-1/2 -translate-y-1/2 translate-x-full';
    case 'right':
      return 'left-0 top-1/2 -translate-y-1/2 translate-x-full';
    default:
      return '';
  }
}

/**
 * Get arrow position style
 */
function getArrowPosition(placement: string, tooltipWidth: number, tooltipHeight: number): React.CSSProperties {
  const arrowSize = 8;
  const offset = 4;

  switch (placement) {
    case 'top':
      return {
        bottom: -offset,
        left: tooltipWidth / 2 - arrowSize / 2
      };
    case 'bottom':
      return {
        top: -offset,
        left: tooltipWidth / 2 - arrowSize / 2
      };
    case 'left':
      return {
        right: -offset,
        top: tooltipHeight / 2 - arrowSize / 2
      };
    case 'right':
      return {
        left: -offset,
        top: tooltipHeight / 2 - arrowSize / 2
      };
    default:
      return {};
  }
}

/**
 * Contextual help content registry
 *
 * Maps tooltip IDs to their content and configuration
 */
export const TOOLTIP_CONTENT_REGISTRY: Record<string, {
  title: string;
  description: string;
  learnMoreUrl?: string;
  category: 'getting-started' | 'features' | 'advanced' | 'workflow';
}> = {
  'create-task': {
    title: 'Create Task',
    description: 'Define a new task for Auto Claude to implement. Tasks can range from simple bug fixes to complex feature development.',
    category: 'features',
    learnMoreUrl: '#tasks'
  },
  'projects-list': {
    title: 'Projects',
    description: 'View and manage all your projects. Each project contains its own tasks, settings, and workflow history.',
    category: 'features'
  },
  'task-status': {
    title: 'Task Status',
    description: 'Tasks move through different statuses: Backlog, Queue, In Progress, AI Review, Human Review, Done, and Error.',
    category: 'features'
  },
  'subtasks': {
    title: 'Subtasks',
    description: 'Each task is broken down into subtasks across planning, coding, and QA phases.',
    category: 'advanced'
  },
  'workflow-builder': {
    title: 'Workflow Builder',
    description: 'Create visual workflows with drag-and-drop nodes. Define automation rules and connect different steps.',
    category: 'features'
  },
  'memory': {
    title: 'Memory System',
    description: 'Auto Claude uses Graphiti for persistent cross-session memory with semantic search capabilities.',
    category: 'advanced'
  },
  'context-panel': {
    title: 'Context Panel',
    description: 'Access project index, memories, and service information for enhanced AI context.',
    category: 'features'
  },
  'changelog': {
    title: 'Changelog',
    description: 'Track all changes made to your codebase with automatic version tracking.',
    category: 'features'
  },
  'roadmap': {
    title: 'Product Roadmap',
    description: 'Plan and visualize your product development with the kanban-style roadmap view.',
    category: 'features'
  },
  'calendar': {
    title: 'Content Calendar',
    description: 'Schedule and manage marketing content with drag-and-drop calendar interface.',
    category: 'features'
  }
};
