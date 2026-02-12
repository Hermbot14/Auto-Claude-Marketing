/**
 * Onboarding System Type Definitions
 *
 * This file contains all type definitions for the guided onboarding experience
 * including wizard steps, tour configuration, and contextual help system.
 */

/**
 * Onboarding wizard steps in order of progression
 */
export type OnboardingStep =
  | 'welcome'
  | 'authentication'
  | 'memory-setup'
  | 'first-task'
  | 'completion';

/**
 * Onboarding state persistence structure
 */
export interface OnboardingState {
  isFirstTimeUser: boolean;
  onboardingProgress: OnboardingProgress;
  tourState: TourState;
  tooltipState: TooltipStateMap;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * Progress tracking for each onboarding step
 */
export interface OnboardingProgress {
  [step: string]: {
    completed: boolean;
    skipped: boolean;
    timestamp: string;
    timeSpent?: number; // in seconds
  };
}

/**
 * Tour state tracking
 */
export interface TourState {
  completed: boolean;
  lastRunVersion: string;
  currentStep: number;
  totalSteps: number;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * Tooltip dismissal state per tooltip
 */
export interface TooltipStateMap {
  [tooltipId: string]: TooltipState;
}

/**
 * Individual tooltip state
 */
export interface TooltipState {
  dismissed: boolean;
  dismissCount: number;
  lastShown: string | null;
  viewCount: number;
}

/**
 * Tour step configuration
 */
export interface TourStep {
  id: string;
  target: string; // CSS selector for target element
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  disableBeacon?: boolean;
  action?: TourAction;
  image?: string; // Optional screenshot/image for the step
}

/**
 * Action associated with a tour step
 */
export interface TourAction {
  label: string;
  type: 'navigate' | 'click' | 'input' | 'wait';
  target?: string; // For click/input actions
  route?: string; // For navigate actions
  value?: string; // For input actions
  duration?: number; // For wait actions
}

/**
 * Tutorial step for QuickStartGuide
 */
export interface TutorialStep {
  id: string;
  title: string;
  instruction: string;
  action?: TutorialAction;
  validation?: () => Promise<boolean>;
  skip?: boolean; // Allow skipping this step
  image?: string; // Optional demo image
}

/**
 * Action types for tutorial steps
 */
export interface TutorialAction {
  type: 'navigate' | 'click' | 'input' | 'wait' | 'validate';
  target?: string; // CSS selector for click/input
  route?: string; // Route hash for navigation
  value?: string; // Value for input
  duration?: number; // Wait duration in ms
  validator?: () => Promise<boolean>; // Validation function
}

/**
 * Contextual help content
 */
export interface TooltipContent {
  id: string;
  title: string;
  description: string;
  learnMoreUrl?: string;
  category: 'getting-started' | 'features' | 'advanced' | 'workflow';
  priority: 'critical' | 'important' | 'optional';
  dismissed: boolean;
}

/**
 * Onboarding wizard props
 */
export interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  onSkip: () => void;
  initialStep?: OnboardingStep;
}

/**
 * Feature tour props
 */
export interface FeatureTourProps {
  steps: TourStep[];
  run: boolean;
  onComplete: () => void;
  onSkip: () => void;
  currentStep?: number;
}

/**
 * Contextual help props
 */
export interface ContextualHelpProps {
  tooltipId: string;
  title: string;
  description: string;
  learnMoreLink?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
  delay?: number; // Hover delay in ms (default 300)
}

/**
 * Quick start guide props
 */
export interface QuickStartGuideProps {
  taskId?: string;
  steps: TutorialStep[];
  onComplete: () => void;
  onStepChange?: (stepIndex: number) => void;
  currentStep?: number;
  allowSkip?: boolean;
}

/**
 * Onboarding completion data
 */
export interface OnboardingCompletionData {
  completedSteps: OnboardingStep[];
  skippedSteps: OnboardingStep[];
  totalTime: number; // in seconds
  rating?: number; // 1-5 rating from survey
  feedback?: string; // Optional feedback text
  completedAt: string;
}

/**
 * Empty state configuration for guiding users
 */
export interface EmptyStateConfig {
  type: 'first-task' | 'no-workflows' | 'no-templates' | 'no-results';
  title: string;
  description: string;
  illustration?: string;
  primaryAction?: {
    label: string;
    action: () => void;
  };
  secondaryAction?: {
    label: string;
    action: () => void;
  };
}

/**
 * Onboarding analytics events
 */
export type OnboardingEvent =
  | { type: 'wizard_started'; timestamp: string }
  | { type: 'wizard_completed'; data: OnboardingCompletionData }
  | { type: 'step_completed'; step: OnboardingStep; duration: number }
  | { type: 'step_skipped'; step: OnboardingStep }
  | { type: 'tour_started'; timestamp: string }
  | { type: 'tour_completed'; timestamp: string; skipped: boolean }
  | { type: 'tooltip_dismissed'; tooltipId: string }
  | { type: 'tutorial_started'; timestamp: string }
  | { type: 'tutorial_completed'; duration: number };
