import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OnboardingStep, OnboardingState, OnboardingProgress, TourState, TooltipStateMap, OnboardingCompletionData } from '../../shared/types/onboarding';

/**
 * LocalStorage key for onboarding state persistence
 */
const ONBOARDING_STORAGE_KEY = 'onboarding-state';
const ONBOARDING_EVENTS_KEY = 'onboarding-events';

/**
 * Onboarding state management store
 *
 * Manages all onboarding-related state including:
 * - Progress through wizard steps
 * - Tour completion status
 * - Tooltip dismissal tracking
 * - First-time user detection
 */
export interface OnboardingStore extends OnboardingState {
  // Actions
  setFirstTimeUser: (firstTime: boolean) => void;
  markStepComplete: (step: OnboardingStep) => void;
  skipStep: (step: OnboardingStep) => void;
  completeTour: () => void;
  startTour: () => void;
  dismissTooltip: (tooltipId: string) => void;
  resetTooltip: (tooltipId: string) => void;
  resetAll: () => void;
  setCompletionData: (data: OnboardingCompletionData) => void;
  getCurrentStep: () => OnboardingStep | null;
  getStepProgress: (step: OnboardingStep) => { completed: boolean; skipped: boolean } | null;
  isTourCompleted: () => boolean;
}

/**
 * Create initial onboarding progress
 */
function createInitialProgress(): OnboardingProgress {
  return {
    welcome: { completed: false, skipped: false, timestamp: '' },
    authentication: { completed: false, skipped: false, timestamp: '' },
    'memory-setup': { completed: false, skipped: false, timestamp: '' },
    'first-task': { completed: false, skipped: false, timestamp: '' },
    completion: { completed: false, skipped: false, timestamp: '' }
  };
}

/**
 * Create initial tour state
 */
function createInitialTourState(): TourState {
  return {
    completed: false,
    lastRunVersion: '',
    currentStep: 0,
    totalSteps: 7,
    startedAt: null,
    completedAt: null
  };
}

/**
 * Create empty tooltip state
 */
function createEmptyTooltipState(): TooltipStateMap {
  return {};
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isFirstTimeUser: true,
      onboardingProgress: createInitialProgress(),
      tourState: createInitialTourState(),
      tooltipState: createEmptyTooltipState(),
      startedAt: null,
      completedAt: null,

      // Actions
      setFirstTimeUser: (firstTime) => set({ isFirstTimeUser: firstTime }),

      markStepComplete: (step) => set((state) => {
        const timestamp = new Date().toISOString();
        const stepProgress = state.onboardingProgress[step];

        // Calculate time spent if startedAt exists
        let timeSpent;
        if (state.startedAt) {
          const started = new Date(state.startedAt).getTime();
          const now = Date.now();
          timeSpent = Math.floor((now - started) / 1000);
        }

        return {
          onboardingProgress: {
            ...state.onboardingProgress,
            [step]: {
              ...stepProgress,
              completed: true,
              timestamp,
              timeSpent
            }
          }
        };
      }),

      skipStep: (step) => set((state) => {
        const timestamp = new Date().toISOString();
        const stepProgress = state.onboardingProgress[step];

        return {
          onboardingProgress: {
            ...state.onboardingProgress,
            [step]: {
              ...stepProgress,
              skipped: true,
              timestamp
            }
          }
        };
      }),

      completeTour: () => set((state) => ({
        tourState: {
          ...state.tourState,
          completed: true,
          currentStep: state.tourState.totalSteps,
          completedAt: new Date().toISOString()
        }
      })),

      startTour: () => set((state) => ({
        tourState: {
          ...state.tourState,
          completed: false,
          currentStep: 0,
          startedAt: new Date().toISOString(),
          completedAt: null
        }
      })),

      dismissTooltip: (tooltipId) => set((state) => {
        const current = state.tooltipState[tooltipId] || { dismissed: false, dismissCount: 0, lastShown: null, viewCount: 0 };

        return {
          tooltipState: {
            ...state.tooltipState,
            [tooltipId]: {
              dismissed: true,
              dismissCount: current.dismissCount + 1,
              lastShown: new Date().toISOString(),
              viewCount: current.viewCount
            }
          }
        };
      }),

      resetTooltip: (tooltipId) => set((state) => {
        const current = state.tooltipState[tooltipId];
        if (!current) return state;

        return {
          tooltipState: {
            ...state.tooltipState,
            [tooltipId]: {
              dismissed: false,
              dismissCount: current.dismissCount,
              lastShown: current.lastShown,
              viewCount: current.viewCount
            }
          }
        };
      }),

      resetAll: () => set({
        isFirstTimeUser: true,
        onboardingProgress: createInitialProgress(),
        tourState: createInitialTourState(),
        tooltipState: createEmptyTooltipState(),
        startedAt: null,
        completedAt: null
      }),

      setCompletionData: (data) => set({
        completedAt: data.completedAt,
        onboardingProgress: {
          welcome: { completed: true, skipped: false, timestamp: data.completedAt },
          authentication: { completed: true, skipped: false, timestamp: data.completedAt },
          'memory-setup': { completed: true, skipped: false, timestamp: data.completedAt },
          'first-task': { completed: true, skipped: false, timestamp: data.completedAt },
          completion: { completed: true, skipped: false, timestamp: data.completedAt }
        }
      }),

      getCurrentStep: () => {
        const state = get();
        const progress = state.onboardingProgress;

        // Find first incomplete step
        const steps: OnboardingStep[] = ['welcome', 'authentication', 'memory-setup', 'first-task', 'completion'];

        for (const step of steps) {
          const stepProgress = progress[step];
          if (!stepProgress.completed && !stepProgress.skipped) {
            return step;
          }
        }

        // If all complete, return completion step
        if (progress.completion.completed) {
          return 'completion';
        }

        return null;
      },

      getStepProgress: (step) => {
        const state = get();
        const stepProgress = state.onboardingProgress[step];
        if (!stepProgress) return null;

        return {
          completed: stepProgress.completed,
          skipped: stepProgress.skipped
        };
      },

      isTourCompleted: () => {
        return get().tourState.completed;
      }
    }),
    {
      name: ONBOARDING_STORAGE_KEY,
      partialize: (state) => ({
        // Only persist these fields to localStorage
        isFirstTimeUser: state.isFirstTimeUser,
        onboardingProgress: state.onboardingProgress,
        tourState: state.tourState,
        tooltipState: state.tooltipState,
        startedAt: state.startedAt,
        completedAt: state.completedAt
      })
    }
  )
);

/**
 * Helper: Calculate overall onboarding completion percentage
 */
export function getOnboardingProgressPercentage(): number {
  const state = useOnboardingStore.getState();
  const progress = state.onboardingProgress;

  const steps = Object.keys(progress) as OnboardingStep[];
  const completedCount = steps.filter(step => progress[step].completed || progress[step].skipped).length;

  return Math.round((completedCount / steps.length) * 100);
}

/**
 * Helper: Get next onboarding step
 */
export function getNextOnboardingStep(currentStep: OnboardingStep | null): OnboardingStep | null {
  if (!currentStep) return 'welcome';

  const stepOrder: OnboardingStep[] = ['welcome', 'authentication', 'memory-setup', 'first-task', 'completion'];
  const currentIndex = stepOrder.indexOf(currentStep);

  if (currentIndex === -1 || currentIndex === stepOrder.length - 1) {
    return null;
  }

  return stepOrder[currentIndex + 1];
}

/**
 * Helper: Check if onboarding is complete
 */
export function isOnboardingComplete(): boolean {
  const state = useOnboardingStore.getState();
  return state.onboardingProgress.completion.completed ||
         state.onboardingProgress.completion.skipped;
}

/**
 * Helper: Log onboarding event for analytics
 */
export function logOnboardingEvent(event: {
  type: string;
  [key: string]: unknown;
}): void {
  try {
    const events = JSON.parse(localStorage.getItem(ONBOARDING_EVENTS_KEY) || '[]');
    events.push({
      ...event,
      timestamp: event.timestamp || new Date().toISOString()
    });
    localStorage.setItem(ONBOARDING_EVENTS_KEY, JSON.stringify(events));
  } catch (error) {
    console.error('Failed to log onboarding event:', error);
  }
}

/**
 * Helper: Get onboarding completion time in seconds
 */
export function getOnboardingCompletionTime(): number | null {
  const state = useOnboardingStore.getState();
  if (!state.startedAt || !state.completedAt) return null;

  const started = new Date(state.startedAt).getTime();
  const completed = new Date(state.completedAt).getTime();
  return Math.floor((completed - started) / 1000);
}
