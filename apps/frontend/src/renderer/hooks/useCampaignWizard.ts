import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Campaign Wizard Steps
 * Defines the progression of the guided workflow
 */
export type WizardStep =
  | 'overview'        // Campaign name, objective, type
  | 'audience'       // Target audience definition
  | 'channels'        // Marketing channels selection
  | 'messaging'       // Key messages and CTA
  | 'timeline'        // Duration, budget, milestones
  | 'review';         // Final review before launch

/**
 * Campaign data collected through the wizard
 */
export interface CampaignWizardData {
  // Overview step
  campaignName?: string;
  objective?: string;
  campaignType?: 'brand' | 'product' | 'promotion' | 'event' | 'content' | 'retention' | 'acquisition';

  // Audience step
  audienceType?: 'b2c' | 'b2b' | 'both';
  demographics?: {
    ageRange?: string;
    location?: string;
    interests?: string;
  };
  painPoints?: string;

  // Channels step
  selectedChannels?: string[];
  selectedPlatforms?: {
    social?: string[];
    search?: string[];
  };
  budgetAllocation?: Record<string, number>;

  // Messaging step
  valueProposition?: string;
  keyMessages?: string[];
  callToAction?: string;
  tone?: 'professional' | 'friendly' | 'urgent' | 'inspirational' | 'humorous' | 'educational';

  // Timeline step
  duration?: 'flash' | 'short' | 'medium' | 'long' | 'ongoing';
  startDate?: string;
  endDate?: string;
  totalBudget?: number;
  milestones?: Array<{
    date: string;
    title: string;
  }>;
}

/**
 * Wizard state management hook
 * Provides step navigation, validation, and data persistence
 */
export function useCampaignWizard() {
  const { t } = useTranslation('wizard');

  // Current step state
  const [currentStep, setCurrentStep] = useState<WizardStep>('overview');
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());

  // Campaign data state
  const [wizardData, setWizardData] = useState<CampaignWizardData>({});

  // Loading state for AI operations
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Step order for navigation
  const stepOrder: WizardStep[] = useMemo(() => [
    'overview',
    'audience',
    'channels',
    'messaging',
    'timeline',
    'review'
  ], []);

  /**
   * Get the current step index for progress calculation
   */
  const currentStepIndex = useMemo(() => {
    return stepOrder.indexOf(currentStep);
  }, [currentStep, stepOrder]);

  /**
   * Calculate overall completion percentage
   */
  const completionPercentage = useMemo(() => {
    const totalSteps = stepOrder.length;
    const completedCount = completedSteps.size;
    return Math.round((completedCount / totalSteps) * 100);
  }, [completedSteps.size, stepOrder.length]);

  /**
   * Navigate to the next step
   * Validates current step before proceeding
   */
  const goToNextStep = useCallback(() => {
    // Validate current step before proceeding
    if (!validateCurrentStep()) {
      return false;
    }

    // Mark current step as completed
    setCompletedSteps(prev => new Set([...prev, currentStep]));

    // Move to next step
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < stepOrder.length) {
      setCurrentStep(stepOrder[nextIndex]);
    }

    return true;
  }, [currentStep, currentStepIndex, completedSteps, stepOrder]);

  /**
   * Navigate to the previous step
   */
  const goToPreviousStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(stepOrder[prevIndex]);
    }
  }, [currentStepIndex, stepOrder]);

  /**
   * Jump to a specific step
   * Used for editing previous steps or jumping via progress indicator
   */
  const goToStep = useCallback((step: WizardStep) => {
    // Only allow jumping to completed steps or immediate next step
    const stepIndex = stepOrder.indexOf(step);
    const maxAllowedIndex = Array.from(completedSteps).reduce((max, s) => {
      const idx = stepOrder.indexOf(s);
      return idx > max ? idx : max;
    }, -1);

    if (stepIndex <= maxAllowedIndex + 1) {
      setCurrentStep(step);
    }
  }, [completedSteps, stepOrder]);

  /**
   * Skip the current optional step
   */
  const skipStep = useCallback(() => {
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    goToNextStep();
  }, [currentStep, goToNextStep]);

  /**
   * Update a specific field in wizard data
   * Immutable update pattern for state consistency
   */
  const updateField = useCallback(<K extends keyof CampaignWizardData>(
    field: K,
    value: CampaignWizardData[K]
  ) => {
    setWizardData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  /**
   * Update nested fields within demographics
   */
  const updateDemographics = useCallback((field: string, value: string) => {
    setWizardData(prev => ({
      ...prev,
      demographics: {
        ...prev.demographics,
        [field]: value
      }
    }));
  }, []);

  /**
   * Add a key message to the messaging step
   */
  const addKeyMessage = useCallback((message: string) => {
    setWizardData(prev => ({
      ...prev,
      keyMessages: [...(prev.keyMessages || []), message]
    }));
  }, []);

  /**
   * Remove a key message from messaging step
   */
  const removeKeyMessage = useCallback((index: number) => {
    setWizardData(prev => ({
      ...prev,
      keyMessages: prev.keyMessages?.filter((_, i) => i !== index) || []
    }));
  }, []);

  /**
   * Add a milestone to the timeline step
   */
  const addMilestone = useCallback((milestone: { date: string; title: string }) => {
    setWizardData(prev => ({
      ...prev,
      milestones: [...(prev.milestones || []), milestone]
    }));
  }, []);

  /**
   * Remove a milestone from timeline step
   */
  const removeMilestone = useCallback((index: number) => {
    setWizardData(prev => ({
      ...prev,
      milestones: prev.milestones?.filter((_, i) => i !== index) || []
    }));
  }, []);

  /**
   * Validate the current step before proceeding
   * Returns true if valid, false otherwise
   */
  const validateCurrentStep = useCallback((): boolean => {
    switch (currentStep) {
      case 'overview':
        return !!(wizardData.campaignName && wizardData.objective);

      case 'audience':
        // Optional step - can proceed even if empty
        return true;

      case 'channels':
        // At least one channel must be selected
        return !!(wizardData.selectedChannels?.length === 0);

      case 'messaging':
        // Optional step - can proceed even if empty
        return true;

      case 'timeline':
        // Start date and duration are required
        return !!(wizardData.startDate && wizardData.duration);

      case 'review':
        // Review step doesn't require validation
        return true;

      default:
        return true;
    }
  }, [currentStep, wizardData]);

  /**
   * Get validation error message for current step
   */
  const getValidationError = useCallback((): string | undefined => {
    switch (currentStep) {
      case 'overview':
        if (!wizardData.campaignName) return t('errors.required');
        break;
      case 'channels':
        if (wizardData.selectedChannels?.length === 0) {
          return t('errors.required');
        }
        break;
      case 'timeline':
        if (!wizardData.startDate) return t('errors.required');
        break;
    }
    return undefined;
  }, [currentStep, wizardData, t]);

  /**
   * Check if a step is completed
   */
  const isStepCompleted = useCallback((step: WizardStep): boolean => {
    return completedSteps.has(step);
  }, [completedSteps]);

  /**
   * Check if we can proceed to the next step
   */
  const canGoNext = useMemo(() => {
    return validateCurrentStep();
  }, [validateCurrentStep]);

  /**
   * Generate AI suggestions for the current step
   * Simulates AI recommendations based on wizard context
   */
  const generateAiSuggestions = useCallback(async () => {
    setIsAiProcessing(true);

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate contextual suggestions based on wizard data
    const suggestions = generateSuggestionsForStep(currentStep, wizardData);

    setIsAiProcessing(false);
    return suggestions;
  }, [currentStep, wizardData]);

  /**
   * Apply an AI suggestion to the wizard data
   */
  const applyAiSuggestion = useCallback((suggestion: Partial<CampaignWizardData>) => {
    setWizardData(prev => ({
      ...prev,
      ...suggestion
    }));
  }, []);

  /**
   * Reset the wizard to initial state
   */
  const resetWizard = useCallback(() => {
    setCurrentStep('overview');
    setCompletedSteps(new Set());
    setWizardData({});
    setIsAiProcessing(false);
  }, []);

  /**
   * Calculate estimated time remaining based on average 1 minute per step
   */
  const estimatedTimeRemaining = useMemo(() => {
    const remainingSteps = stepOrder.length - currentStepIndex;
    return Math.max(1, remainingSteps); // At least 1 minute
  }, [currentStepIndex, stepOrder.length]);

  /**
   * Get a summary of completed steps for review
   */
  const getStepSummary = useCallback((): Array<{ step: WizardStep; title: string; isComplete: boolean }> => {
    return stepOrder.map(step => ({
      step,
      title: t(`steps.${step}.title`),
      isComplete: completedSteps.has(step)
    }));
  }, [stepOrder, completedSteps, t]);

  return {
    // State
    currentStep,
    currentStepIndex,
    completedSteps,
    wizardData,
    isAiProcessing,
    completionPercentage,
    canGoNext,
    estimatedTimeRemaining,

    // Navigation
    goToNextStep,
    goToPreviousStep,
    goToStep,
    skipStep,

    // Data updates
    updateField,
    updateDemographics,
    addKeyMessage,
    removeKeyMessage,
    addMilestone,
    removeMilestone,

    // Validation
    validateCurrentStep,
    getValidationError,
    isStepCompleted,

    // AI features
    generateAiSuggestions,
    applyAiSuggestion,

    // Utilities
    resetWizard,
    getStepSummary
  };
}

/**
 * Generate contextual AI suggestions for each wizard step
 */
function generateSuggestionsForStep(
  step: WizardStep,
  data: CampaignWizardData
): Partial<CampaignWizardData> {
  switch (step) {
    case 'overview':
      // Suggest campaign type based on objective
      if (data.objective?.includes('Brand')) {
        return { campaignType: 'brand' };
      }
      if (data.objective?.includes('Sales')) {
        return { campaignType: 'promotion' };
      }
      return {};

    case 'audience':
      // Suggest demographics based on campaign type
      if (data.campaignType === 'b2b') {
        return {
          demographics: {
            ageRange: '25-55',
            location: 'Business Districts',
            interests: 'Decision Makers, Procurement'
          }
        };
      }
      return {};

    case 'channels':
      // Suggest channels based on campaign type and audience
      const suggestedChannels: string[] = [];
      if (data.audienceType === 'b2c') {
        suggestedChannels.push('social', 'email', 'paid');
      }
      if (data.audienceType === 'b2b') {
        suggestedChannels.push('email', 'content', 'events');
      }
      return { selectedChannels: suggestedChannels };

    case 'messaging':
      // Suggest tone based on campaign type
      if (data.campaignType === 'brand') {
        return { tone: 'professional' };
      }
      if (data.campaignType === 'product') {
        return { tone: 'friendly' };
      }
      return {};

    case 'timeline':
      // Suggest duration based on campaign type
      if (data.campaignType === 'promotion') {
        return { duration: 'flash' };
      }
      if (data.campaignType === 'brand') {
        return { duration: 'long' };
      }
      return {};

    default:
      return {};
  }
}
