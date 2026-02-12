import { useCallback, useMemo } from 'react';
import { useOnboardingStore } from '../stores/onboardingStore';
import type {
  OnboardingStep,
  OnboardingState,
  OnboardingActions,
  OnboardingCompletionData,
  TooltipContent
} from '../../shared/types/onboarding';

/**
 * React hook for onboarding functionality
 *
 * Provides a convenient interface to the onboarding store with additional computed values
 * and helper methods for common onboarding operations.
 */
export function useOnboarding(): [OnboardingState, OnboardingActions] {
  const store = useOnboardingStore();

  /**
   * Computed: Get the current incomplete step
   */
  const currentStep = useMemo(() => {
    return store.getCurrentStep();
  }, [store.onboardingProgress, store.tourState]);

  /**
   * Computed: Check if onboarding is complete
   */
  const isComplete = useMemo(() => {
    return store.onboardingProgress.completion.completed ||
           store.onboardingProgress.completion.skipped ||
           store.isTourCompleted();
  }, [store.onboardingProgress, store.tourState]);

  /**
   * Computed: Get all completed steps
   */
  const completedSteps = useMemo(() => {
    return Object.entries(store.onboardingProgress)
      .filter(([_, progress]) => progress.completed || progress.skipped)
      .map(([step]) => step as OnboardingStep);
  }, [store.onboardingProgress]);

  /**
   * Computed: Calculate completion percentage
   */
  const completionPercentage = useMemo(() => {
    const steps = Object.keys(store.onboardingProgress) as OnboardingStep[];
    const completedCount = steps.filter(
      step => store.onboardingProgress[step].completed ||
                store.onboardingProgress[step].skipped
    ).length;
    return Math.round((completedCount / steps.length) * 100);
  }, [store.onboardingProgress]);

  /**
   * Navigate to the next step
   */
  const goToNextStep = useCallback(() => {
    const current = store.getCurrentStep();
    if (!current || current === 'completion') return;

    store.markStepComplete(current);
  }, [store]);

  /**
   * Navigate to the previous step
   */
  const goToPreviousStep = useCallback(() => {
    const current = store.getCurrentStep();
    if (!current || current === 'welcome') return;

    // Find the previous step that was completed
    const steps: OnboardingStep[] = ['welcome', 'authentication', 'memory-setup', 'first-task', 'completion'];
    const currentIndex = steps.indexOf(current);

    for (let i = currentIndex - 1; i >= 0; i--) {
      const step = steps[i];
      const progress = store.onboardingProgress[step];
      if (progress.completed || progress.skipped) {
        return step;
      }
    }

    return 'welcome';
  }, [store]);

  /**
   * Skip current step
   */
  const skipCurrentStep = useCallback(() => {
    const current = store.getCurrentStep();
    if (current && current !== 'completion') {
      store.skipStep(current);
    }
  }, [store]);

  /**
   * Jump to a specific step
   */
  const goToStep = useCallback((step: OnboardingStep) => {
    // Mark all previous steps as complete
    const steps: OnboardingStep[] = ['welcome', 'authentication', 'memory-setup', 'first-task', 'completion'];
    const targetIndex = steps.indexOf(step);

    for (let i = 0; i < targetIndex; i++) {
      const s = steps[i];
      const progress = store.onboardingProgress[s];
      if (!progress.completed && !progress.skipped) {
        store.markStepComplete(s);
      }
    }
  }, [store]);

  /**
   * Check if a specific step is completed
   */
  const isStepCompleted = useCallback((step: OnboardingStep): boolean => {
    const progress = store.onboardingProgress[step];
    return progress?.completed || progress?.skipped || false;
  }, [store.onboardingProgress]);

  /**
   * Get progress for a specific step
   */
  const getStepProgress = useCallback((step: OnboardingStep) => {
    return store.getStepProgress(step);
  }, [store]);

  /**
   * Mark tooltip as viewed
   */
  const viewTooltip = useCallback((tooltipId: string) => {
    const current = store.tooltipState[tooltipId];
    if (!current || !current.dismissed) {
      // Increment view count
      console.log(`[Onboarding] Tooltip viewed: ${tooltipId}`);
    }
  }, [store.tooltipState]);

  /**
   * Mark tooltip as dismissed
   */
  const dismissTooltip = useCallback((tooltipId: string) => {
    store.dismissTooltip(tooltipId);
  }, [store]);

  /**
   * Check if a tooltip is dismissed
   */
  const isTooltipDismissed = useCallback((tooltipId: string): boolean => {
    return store.tooltipState[tooltipId]?.dismissed || false;
  }, [store.tooltipState]);

  /**
   * Start the feature tour
   */
  const startTour = useCallback(() => {
    store.startTour();
  }, [store]);

  /**
   * Restart the tour from the beginning
   */
  const restartTour = useCallback(() => {
    store.resetAll();
    store.startTour();
  }, [store]);

  /**
   * Check if tour should be shown
   */
  const shouldShowTour = useCallback((appVersion: string): boolean => {
    const tour = store.tourState;
    // Show tour if:
    // - Never completed
    // - Or completed on a different version
    return !tour.completed || tour.lastRunVersion !== appVersion;
  }, [store.tourState]);

  /**
   * Complete the entire onboarding flow
   */
  const completeOnboarding = useCallback((data?: Partial<OnboardingCompletionData>) => {
    const completionData: OnboardingCompletionData = {
      completedSteps,
      skippedSteps: Object.entries(store.onboardingProgress)
        .filter(([_, p]) => p.skipped)
        .map(([step]) => step as OnboardingStep),
      totalTime: store.startedAt && store.completedAt
        ? Math.floor((new Date(store.completedAt).getTime() - new Date(store.startedAt).getTime()) / 1000)
        : 0,
      completedAt: new Date().toISOString(),
      ...data
    };

    store.setCompletionData(completionData);
  }, [completedSteps, store.onboardingProgress, store.startedAt, store.completedAt]);

  /**
   * Reset onboarding to start over
   */
  const resetOnboarding = useCallback(() => {
    store.resetAll();
  }, [store]);

  /**
   * Get contextual help content for a tooltip
   */
  const getTooltipContent = useCallback((tooltipId: string): TooltipContent | null => {
    // This would typically come from a registry of tooltip content
    // For now, return null - actual content would be loaded from i18n or a config file
    return null;
  }, []);

  const state: OnboardingState = {
    isFirstTimeUser: store.isFirstTimeUser,
    completedSteps,
    currentStep,
    isComplete,
    completionPercentage,
    tourCompleted: store.tourState.completed,
    tourCurrentStep: store.tourState.currentStep,
    tourTotalSteps: store.tourState.totalSteps,
    dismissedTooltips: new Set(
      Object.entries(store.tooltipState)
        .filter(([_, state]) => state.dismissed)
        .map(([id]) => id)
    ),
    startedAt: store.startedAt,
    completedAt: store.completedAt
  };

  const actions: OnboardingActions = {
    markStepComplete: store.markStepComplete,
    setCurrentStep: goToStep,
    skipStep: store.skipCurrentStep,
    completeTour: store.completeTour,
    dismissTooltip: store.dismissTooltip,
    resetTooltip: store.resetTooltip,
    resetOnboarding: store.resetAll,
    startTour: store.startTour,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    isStepCompleted,
    getStepProgress,
    isTooltipDismissed,
    viewTooltip,
    shouldShowTour,
    restartTour,
    completeOnboarding
  };

  return [state, actions];
}

/**
 * Hook for managing onboarding progress persistence
 * Automatically saves/loads from localStorage
 */
export function useOnboardingPersistence() {
  const [, actions] = useOnboarding();

  /**
   * Save current onboarding state to localStorage
   */
  const saveProgress = useCallback(() => {
    // This is handled automatically by the zustand persist middleware
    console.log('[Onboarding] Progress saved');
  }, []);

  /**
   * Load onboarding state from localStorage
   */
  const loadProgress = useCallback(() => {
    // This is handled automatically by the zustand persist middleware
    console.log('[Onboarding] Progress loaded');
  }, []);

  /**
   * Clear all onboarding data
   */
  const clearProgress = useCallback(() => {
    actions.resetOnboarding();
    localStorage.removeItem('onboarding-state');
    localStorage.removeItem('onboarding-events');
  }, [actions]);

  return {
    saveProgress,
    loadProgress,
    clearProgress
  };
}

/**
 * Hook for keyboard shortcuts in onboarding
 */
export function useOnboardingKeyboard(onComplete?: () => void, onSkip?: () => void) {
  // This hook would set up keyboard event listeners
  // for navigation during onboarding (Enter, Escape, Arrow keys)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        onComplete?.();
        break;
      case 'Escape':
        event.preventDefault();
        onSkip?.();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        // Navigate to next step
        event.preventDefault();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        // Navigate to previous step
        event.preventDefault();
        break;
    }
  }, [onComplete, onSkip]);

  return { handleKeyDown };
}

/**
 * Hook for time tracking during onboarding
 */
export function useOnboardingTimer() {
  const [startTime] = React.useState<Date | null>(null);
  const [elapsed, setElapsed] = React.useState(0);

  const start = useCallback(() => {
    setStartTime(new Date());
    setElapsed(0);
  }, []);

  const stop = useCallback(() => {
    if (startTime) {
      const total = Math.floor((Date.now() - startTime.getTime()) / 1000);
      setElapsed(total);
      setStartTime(null);
      return total;
    }
    return 0;
  }, [startTime]);

  React.useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (startTime?.getTime() || 0)) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return {
    startTime,
    elapsed,
    start,
    stop,
    isRunning: startTime !== null
  };
}

// Add React import since we use useState and useEffect
import React from 'react';
