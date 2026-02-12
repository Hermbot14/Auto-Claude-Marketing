import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { useOnboarding } from '../../hooks/useOnboarding';
import type { TourStep } from '../../../shared/types/onboarding';

/**
 * FeatureTour - Interactive guided tour of the application
 *
 * Provides a spotlight-based tour experience with:
 * - Step-by-step feature highlights
 * - Keyboard navigation
 * - Skip/resume capability
 * - Progress tracking
 */
interface FeatureTourProps {
  steps: TourStep[];
  run: boolean;
  onComplete: () => void;
  onSkip: () => void;
  currentStep?: number;
}

export function FeatureTour({
  steps,
  run,
  onComplete,
  onSkip,
  currentStep: initialStep
}: FeatureTourProps) {
  const { t } = useTranslation(['onboarding', 'common']);
  const [, actions] = useOnboarding();

  // Local state
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStep ?? 0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [spotlightPosition, setSpotlightPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Current step
  const currentStep = useMemo(() => {
    return steps[currentStepIndex];
  }, [currentStepIndex, steps]);

  // Progress
  const progress = useMemo(() => {
    return {
      current: currentStepIndex + 1,
      total: steps.length,
      percentage: ((currentStepIndex + 1) / steps.length) * 100
    };
  }, [currentStepIndex, steps.length]);

  /**
   * Calculate spotlight position for target element
   */
  const updateSpotlight = useCallback(() => {
    if (!currentStep || !run) {
      setSpotlightPosition({ x: 0, y: 0, width: 0, height: 0 });
      return;
    }

    const target = document.querySelector(currentStep.target);
    if (!target) {
      console.warn(`[FeatureTour] Target not found: ${currentStep.target}`);
      return;
    }

    const rect = target.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    setSpotlightPosition({
      x: rect.left + scrollLeft,
      y: rect.top + scrollTop,
      width: rect.width,
      height: rect.height
    });

    // Scroll target into view if needed
    const isInView = (
      rect.top >= 0 &&
      rect.top <= window.innerHeight &&
      rect.left >= 0 &&
      rect.left <= window.innerWidth
    );

    if (!isInView) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStep, run]);

  // Update spotlight when step changes
  useEffect(() => {
    if (run && !isAnimating) {
      // Small delay to allow transitions to complete
      const timeout = setTimeout(() => {
        updateSpotlight();
      }, 100);

      return () => clearTimeout(timeout);
    }
  }, [currentStepIndex, run, isAnimating, updateSpotlight]);

  /**
   * Update spotlight on window resize
   */
  useEffect(() => {
    if (!run) return;

    const handleResize = () => {
      updateSpotlight();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [run, updateSpotlight]);

  /**
   * Handle keyboard navigation
   */
  useEffect(() => {
    if (!run) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onSkip();
          break;
        case 'ArrowRight':
        case ' ': // Space
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevious();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [run, onSkip]);

  /**
   * Navigate to next step
   */
  const handleNext = useCallback(() => {
    if (isAnimating || currentStepIndex >= steps.length - 1) return;

    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStepIndex(prev => prev + 1);
      setIsAnimating(false);
    }, 300);
  }, [isAnimating, currentStepIndex, steps.length]);

  /**
   * Navigate to previous step
   */
  const handlePrevious = useCallback(() => {
    if (isAnimating || currentStepIndex <= 0) return;

    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStepIndex(prev => prev - 1);
      setIsAnimating(false);
    }, 300);
  }, [isAnimating, currentStepIndex]);

  /**
   * Skip the tour
   */
  const handleSkip = useCallback(() => {
    actions.completeTour();
    onSkip();
  }, [actions, onSkip]);

  /**
   * Complete the tour
   */
  const handleComplete = useCallback(() => {
    actions.completeTour();
    onComplete();
  }, [actions, onComplete]);

  if (!run) return null;

  return (
    <>
      {/* Spotlight overlay */}
      <AnimatePresence>
        {run && spotlightPosition.width > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 pointer-events-none"
          >
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/50" />

            {/* Highlight border */}
            <motion.div
              key={currentStepIndex}
              initial={{
                x: spotlightPosition.x,
                y: spotlightPosition.y,
                scale: 0.9
              }}
              animate={{
                x: spotlightPosition.x,
                y: spotlightPosition.y,
                scale: 1
              }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 25
              }}
              className="absolute border-4 border-primary rounded-lg bg-primary/5"
              style={{
                left: spotlightPosition.x - 4,
                top: spotlightPosition.y - 4,
                width: spotlightPosition.width + 8,
                height: spotlightPosition.height + 8
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tour card */}
      <AnimatePresence>
        {run && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-6 left-1/2 z-50 w-full max-w-md -translate-x-1/2"
          >
            <Card className="border-border shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Info className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {currentStep?.title || `Step ${currentStepIndex + 1}`}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t('onboarding:tour.stepIndicator', {
                        current: progress.current,
                        total: progress.total
                      })}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSkip}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Progress bar */}
              <div className="px-4 pt-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress.percentage}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {progress.percentage}%
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="px-4 py-4 max-h-[300px] overflow-y-auto">
                {currentStep?.image && (
                  <div className="mb-4 rounded-lg overflow-hidden border border-border">
                    <img
                      src={currentStep.image}
                      alt={currentStep.title}
                      className="w-full h-auto"
                    />
                  </div>
                )}

                <p className="text-sm text-foreground">
                  {currentStep?.content}
                </p>

                {currentStep?.action && (
                  <div className="mt-4 pt-4 border-t border-border">
                    {renderActionLink(currentStep.action)}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-muted/20">
                <div className="text-xs text-muted-foreground">
                  {t('onboarding:tour.pressEscToSkip')}
                </div>

                <div className="flex items-center gap-2">
                  {currentStepIndex > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevious}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {t('common:actions.back')}
                    </Button>
                  )}

                  {currentStepIndex < steps.length - 1 ? (
                    <Button
                      size="sm"
                      onClick={handleNext}
                    >
                      {t('common:actions.continue')}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleComplete}
                    >
                      {t('onboarding:tour.completeTour')}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Render action link based on action type
 */
function renderActionLink(action: TourStep['action']) {
  if (!action) return null;

  const { t } = useTranslation(['onboarding', 'common']);

  switch (action.type) {
    case 'navigate':
      return (
        <a
          href={`#${action.route}`}
          className="flex items-center gap-2 text-sm text-primary hover:underline font-medium"
        >
          <span>
            {t('onboarding:tour.actions.navigateTo', { route: action.route })}
          </span>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6 6M9 6v6h3v-6h3" />
          </svg>
        </a>
      );

    case 'click':
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {t('onboarding:tour.actions.clickElement')}
          </span>
          <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border">
            {action.selector}
          </kbd>
        </div>
      );

    case 'input':
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {t('onboarding:tour.actions.enterValue')}
          </span>
          <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border">
            {action.value}
          </kbd>
        </div>
      );

    default:
      return null;
  }
}

/**
 * Default tour steps for Auto Claude
 */
export const DEFAULT_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: '#create-task',
    title: 'Create Your First Task',
    content: 'Start by creating a task. Auto Claude will guide you through defining requirements, planning, implementation, and QA.',
    placement: 'bottom',
    disableBeacon: false
  },
  {
    id: 'projects',
    target: '#projects',
    title: 'Projects Manager',
    content: 'Manage your projects here. Each project has its own tasks, settings, and workflow history.',
    placement: 'right',
    disableBeacon: false
  },
  {
    id: 'tasks',
    target: '#tasks',
    title: 'Task Board',
    content: 'View and manage all your tasks in the kanban-style board. Track progress from planning to completion.',
    placement: 'left',
    disableBeacon: false
  },
  {
    id: 'context',
    target: '#context',
    title: 'Context Panel',
    content: 'Access your project index, memories, and service cards for rich context during AI operations.',
    placement: 'left',
    disableBeacon: false
  },
  {
    id: 'settings',
    target: '#settings',
    title: 'Settings',
    content: 'Configure your Auto Claude environment, API profiles, and developer tools.',
    placement: 'center',
    disableBeacon: false
  },
  {
    id: 'changelog',
    target: '#changelog',
    title: 'Changelog',
    content: 'Track changes to your codebase with automatic changelog generation and version tracking.',
    placement: 'center',
    disableBeacon: false
  },
  {
    id: 'roadmap',
    target: '#roadmap',
    title: 'Product Roadmap',
    content: 'Plan and visualize your product development roadmap with the kanban-style roadmap view.',
    placement: 'right',
    disableBeacon: false
  },
  {
    id: 'calendar',
    target: '#calendar',
    title: 'Content Calendar',
    content: 'Schedule and manage your marketing content with the visual content calendar.',
    placement: 'bottom',
    disableBeacon: false
  }
];
