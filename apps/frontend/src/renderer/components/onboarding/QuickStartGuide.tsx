import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Play, Skip } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Progress } from '../ui/progress';
import { useOnboarding } from '../../hooks/useOnboarding';
import type { QuickStartGuideProps, TutorialStep } from '../../../shared/types/onboarding';
import { cn } from '../../shared/lib/utils';

/**
 * QuickStartGuide - Interactive hands-on tutorial for first-time users
 *
 * Provides guided step-by-step tutorial with:
 * - Visual progress indicator
 * - Automatic validation
 * - Skip/resume capability
 * - Real-time feedback
 */
export function QuickStartGuide({
  taskId,
  steps,
  onComplete,
  onStepChange,
  currentStep: initialStep,
  allowSkip = true
}: QuickStartGuideProps) {
  const { t } = useTranslation(['onboarding', 'common']);
  const [, actions] = useOnboarding();

  // Local state
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStep ?? 0);
  const [isValidating, setIsValidating] = useState(false);
  const [completedValidations, setCompletedValidations] = useState<Set<number>>(new Set());
  const [isAnimating, setIsAnimating] = useState(false);

  // Current step
  const currentStep = useMemo(() => {
    return steps[currentStepIndex];
  }, [currentStepIndex, steps]);

  // Progress calculation
  const progress = useMemo(() => {
    return {
      current: currentStepIndex + 1,
      total: steps.length,
      percentage: ((currentStepIndex + 1) / steps.length) * 100
    };
  }, [currentStepIndex, steps.length]);

  // Notify parent of step changes
  useEffect(() => {
    onStepChange?.(currentStepIndex);
  }, [currentStepIndex, onStepChange]);

  /**
   * Validate current step
   */
  const validateCurrentStep = useCallback(async () => {
    if (!currentStep?.validation) return true;

    setIsValidating(true);

    try {
      const isValid = await currentStep.validation();
      if (isValid) {
        setCompletedValidations(prev => new Set(prev).add(currentStepIndex));
      }
      setIsValidating(false);
      return isValid;
    } catch (error) {
      console.error('[QuickStartGuide] Validation failed:', error);
      setIsValidating(false);
      return false;
    }
  }, [currentStep]);

  /**
   * Navigate to next step
   */
  const goToNextStep = useCallback(async () => {
    if (isAnimating) return;

    // Validate current step first if it has validation
    if (currentStep?.validation) {
      const isValid = await validateCurrentStep();
      if (!isValid) return;
    }

    setDirection(1);
  }, [currentStep, isAnimating, validateCurrentStep]);

  /**
   * Navigate to specific step
   */
  const goToStep = useCallback(async (stepIndex: number) => {
    if (isAnimating) return;

    // Validate steps before jumping
    for (let i = currentStepIndex; i < stepIndex; i++) {
      const step = steps[i];
      if (step?.validation && !completedValidations.has(i)) {
        const isValid = await step.validation();
        if (!isValid) return;
      }
    }

    setDirection(stepIndex - currentStepIndex);
  }, [currentStepIndex, steps, completedValidations, isAnimating]);

  /**
   * Skip the tutorial
   */
  const handleSkip = useCallback(() => {
    actions.skipStep('first-task' as any);
    onComplete();
  }, [actions, onComplete]);

  /**
   * Complete the tutorial
   */
  const handleComplete = useCallback(() => {
    actions.completeOnboarding({
      rating: undefined,
      feedback: undefined
    });
    onComplete();
  }, [actions, onComplete]);

  /**
   * Set animation direction
   */
  const [direction, setDirection] = useState<1 | -1>(0);

  useEffect(() => {
    setDirection(0);
    const timeout = setTimeout(() => setDirection(0), 300);
    return () => clearTimeout(timeout);
  }, [currentStepIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if in input
      if ((e.target as HTMLElement).tagName === 'INPUT' ||
          (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          if (allowSkip) {
            handleSkip();
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (completedValidations.has(currentStepIndex)) {
            goToNextStep();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNextStep();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (currentStepIndex > 0) {
            setDirection(-1);
            setCurrentStepIndex(prev => prev - 1);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStepIndex, completedValidations, goToNextStep, allowSkip, handleSkip]);

  if (steps.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-3xl mx-auto p-4"
      >
        <Card className="border-border shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {t('onboarding:quickStart.title')}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t('onboarding:quickStart.description')}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {allowSkip && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Skip className="h-4 w-4 mr-1" />
                  {t('common:actions.skip')}
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  actions.completeOnboarding({ rating: undefined, feedback: undefined });
                  onComplete();
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-6 pt-4">
            <div className="flex items-center gap-4">
              <Progress value={progress.percentage} className="flex-1" />
              <div className="text-sm text-muted-foreground">
                {t('onboarding:quickStart.stepProgress', {
                  current: progress.current,
                  total: progress.total
                })}
              </div>
            </div>
          </div>

          {/* Sidebar with steps */}
          <div className="flex">
            {/* Steps sidebar */}
            <div className="w-48 border-r border-border bg-muted/20 p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {t('onboarding:quickStart.steps')}
              </h3>

              <div className="space-y-1">
                {steps.map((step, index) => {
                  const isCompleted = completedValidations.has(index);
                  const isCurrent = index === currentStepIndex;

                  return (
                    <motion.button
                      key={step.id}
                      onClick={() => goToStep(index)}
                      disabled={isCurrent}
                      className={cn(
                        'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
                        isCurrent && 'bg-accent text-accent-foreground',
                        !isCurrent && 'hover:bg-muted/50'
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border">
                        {isCompleted ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : isCurrent ? (
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        ) : (
                          <div className="h-3 w-3 rounded-full bg-muted-foreground/20" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-foreground">
                          {step.title}
                        </p>
                        {step.instruction && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {step.instruction}
                          </p>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Content area */}
            <div className="flex-1 p-6">
              <AnimatePresence mode="wait" custom={direction}>
                {steps.map((step, index) => {
                  if (index !== currentStepIndex) return null;

                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.3 }}
                      className="h-full flex flex-col"
                    >
                      {step.image && (
                        <div className="mb-6 rounded-lg overflow-hidden border border-border">
                          <img
                            src={step.image}
                            alt={step.title}
                            className="w-full h-auto max-h-[300px] object-cover"
                          />
                        </div>
                      )}

                      <div className="mb-6">
                        <h3 className="text-xl font-semibold text-foreground mb-2">
                          {step.title}
                        </h3>
                        <p className="text-muted-foreground">
                          {step.instruction}
                        </p>
                      </div>

                      {step.action && (
                        <div className="mb-6 p-4 rounded-lg bg-accent/20 border border-accent">
                          <div className="flex items-center gap-2 mb-2">
                            <Play className="h-4 w-4 text-accent" />
                            <span className="font-medium text-foreground">
                              {t('onboarding:quickStart.actionRequired')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {getActionDescription(step.action)}
                          </p>
                        </div>
                      )}

                      {step.validation && isValidating && (
                        <div className="mb-6 flex items-center gap-3 text-muted-foreground">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          <span>{t('onboarding:quickStart.validating')}</span>
                        </div>
                      )}

                      <div className="mt-auto flex items-center justify-between">
                        {index > 0 && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setDirection(-1);
                              setCurrentStepIndex(index - 1);
                            }}
                            disabled={isAnimating}
                          >
                            <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
                            {t('common:actions.back')}
                          </Button>
                        )}

                        {index < steps.length - 1 ? (
                          <Button
                            onClick={goToNextStep}
                            disabled={isValidating || !completedValidations.has(currentStepIndex)}
                            className="gap-2"
                          >
                            <span>
                              {completedValidations.has(currentStepIndex)
                                ? t('onboarding:quickStart.nextStep')
                                : t('onboarding:quickStart.completeAction')}
                            </span>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            onClick={handleComplete}
                            className="gap-2"
                          >
                            <Check className="h-4 w-4" />
                            {t('onboarding:quickStart.finish')}
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

/**
 * Get action description for display
 */
function getActionDescription(action: TutorialStep['action']): string {
  if (!action) return '';

  switch (action.type) {
    case 'navigate':
      return `Navigate to ${action.route}`;
    case 'click':
      return `Click on the element: ${action.target}`;
    case 'input':
      return `Enter the value: ${action.value}`;
    case 'wait':
      return `Wait for ${action.duration}ms`;
    default:
      return '';
  }
}

/**
 * Default quick start tutorial steps for creating first task
 */
export const DEFAULT_QUICK_START_STEPS: TutorialStep[] = [
  {
    id: 'step-1',
    title: 'Create Your First Task',
    instruction: 'Open the task creator and define your first task. Give it a clear title and description.',
    action: {
      type: 'navigate',
      route: '#create-task'
    },
    validation: async () => {
      // Check if task creation button is available
      const taskButton = document.querySelector('[data-action="create-task"]');
      return taskButton !== null;
    }
  },
  {
    id: 'step-2',
    title: 'Set Task Priority',
    instruction: 'Choose a priority level for your task. Higher priorities will be addressed first.',
    action: {
      type: 'click',
      target: '[data-priority-select]'
    }
  },
  {
    id: 'step-3',
    title: 'Submit Your Task',
    instruction: 'Click the submit button to create your task. Auto Claude will begin processing it.',
    action: {
      type: 'click',
      target: '[data-action="submit-task"]'
    }
  },
  {
    id: 'step-4',
    title: 'Wait for Planning',
    instruction: 'Auto Claude will create an implementation plan. This usually takes 1-2 minutes.',
    action: {
      type: 'wait',
      duration: 5000
    },
    validation: async () => {
      // Check if task has moved to planning phase
      const taskCard = document.querySelector('[data-task-status="planning"]');
      return taskCard !== null;
    }
  },
  {
    id: 'step-5',
    title: 'Review the Implementation Plan',
    instruction: 'Review the generated implementation plan with phases and subtasks.',
    action: {
      type: 'navigate',
      route: '#tasks'
    }
  },
  {
    id: 'step-6',
    title: 'Start Implementation',
    instruction: 'Click the "Start Task" button to begin the AI implementation.',
    action: {
      type: 'click',
      target: '[data-action="start-task"]'
    }
  }
];
