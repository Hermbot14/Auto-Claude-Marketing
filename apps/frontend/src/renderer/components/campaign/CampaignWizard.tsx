import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, Check, Sparkles, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { cn } from '../../lib/utils';
import {
  useCampaignWizard,
  type CampaignWizardData,
  type WizardStep
} from '../../hooks/useCampaignWizard';

interface CampaignWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (campaignData: CampaignWizardData) => void;
  projectId?: string;
}

/**
 * AI Campaign Wizard Component
 *
 * A guided workflow for creating marketing campaigns with progressive disclosure.
 * Reduces cognitive load by breaking campaign creation into 5 manageable steps.
 *
 * Features:
 * - Visual progress indicators
 * - AI-powered suggestions
 * - Step validation
 * - Progressive disclosure
 * - WCAG AA accessibility
 */
export function CampaignWizard({ isOpen, onClose, onComplete, projectId }: CampaignWizardProps) {
  const { t } = useTranslation(['wizard', 'common']);

  const {
    currentStep,
    currentStepIndex,
    completedSteps,
    wizardData,
    isAiProcessing,
    completionPercentage,
    canGoNext,
    estimatedTimeRemaining,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    skipStep,
    updateField,
    updateDemographics,
    addKeyMessage,
    removeKeyMessage,
    addMilestone,
    removeMilestone,
    validateCurrentStep,
    getValidationError,
    isStepCompleted,
    generateAiSuggestions,
    applyAiSuggestion,
    resetWizard,
    getStepSummary
  } = useCampaignWizard();

  // Step definitions with icons
  const steps = [
    { id: 'overview', icon: Sparkles, label: t('steps.overview.title') },
    { id: 'audience', icon: 'Users', label: t('steps.audience.title') },
    { id: 'channels', icon: 'Radio', label: t('steps.channels.title') },
    { id: 'messaging', icon: 'MessageSquare', label: t('steps.messaging.title') },
    { id: 'timeline', icon: 'Calendar', label: t('steps.timeline.title') },
    { id: 'review', icon: 'CheckCircle2', label: t('steps.review.title') }
  ] as const;

  // Reset wizard when closed
  useEffect(() => {
    if (!isOpen) {
      resetWizard();
    }
  }, [isOpen, resetWizard]);

  /**
   * Handle wizard completion
   */
  const handleComplete = () => {
    onComplete(wizardData);
    onClose();
  };

  /**
   * Handle AI suggestion generation
   */
  const handleGenerateSuggestions = async () => {
    const suggestions = await generateAiSuggestions();
    if (suggestions) {
      applyAiSuggestion(suggestions);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Wizard Dialog */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-labelledby="wizard-title"
              aria-describedby="wizard-description"
            >
              {/* Header with Progress Indicator */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                  <div>
                    <h2 id="wizard-title" className="text-lg font-semibold text-foreground">
                      {t('title')}
                    </h2>
                    <p id="wizard-description" className="text-sm text-muted-foreground">
                      {t('description')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Progress Bar */}
                  <div className="hidden md:flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                      {t('progress.current', {
                        current: currentStepIndex + 1,
                        total: steps.length
                      })}
                    </div>
                    <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: `${completionPercentage}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('progress.completion', { percentage: completionPercentage })}
                    </div>
                  </div>

                  {/* Estimated Time */}
                  <div className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {t('progress.estimatedTime', { minutes: estimatedTimeRemaining })}
                  </div>

                  {/* Close Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-10 w-10"
                    aria-label={t('navigation.cancel')}
                  >
                    <ChevronRight className="h-4 w-4 rotate-45" />
                  </Button>
                </div>
              </div>

              {/* Step Navigation (Mobile/Condensed) */}
              <div className="flex border-b border-border bg-muted/30">
                <div className="flex overflow-x-auto">
                  {steps.map((step, index) => {
                    const isCompleted = isStepCompleted(step.id as WizardStep);
                    const isCurrent = step.id === currentStep;

                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => goToStep(step.id as WizardStep)}
                        disabled={!isCompleted && !isCurrent}
                        className={cn(
                          'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative',
                          isCurrent && 'text-primary border-b-2 border-primary',
                          isCompleted && !isCurrent && 'text-muted-foreground',
                          !isCompleted && !isCurrent && 'text-muted-foreground/50 cursor-not-allowed'
                        )}
                        aria-label={t('accessibility.stepIndicator', {
                          number: index + 1,
                          total: steps.length
                        })}
                        aria-current={isCurrent ? 'step' : undefined}
                      >
                        <step.icon className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">{step.label}</span>
                        {isCompleted && !isCurrent && (
                          <Check className="h-3 w-3 ml-auto text-success absolute right-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                  {currentStep === 'overview' && (
                    <OverviewStep
                      data={wizardData}
                      onUpdate={updateField}
                      validationError={getValidationError()}
                      isAiProcessing={isAiProcessing}
                      onGenerateSuggestions={handleGenerateSuggestions}
                    />
                  )}

                  {currentStep === 'audience' && (
                    <AudienceStep
                      data={wizardData}
                      onUpdate={updateField}
                      onUpdateDemographics={updateDemographics}
                      validationError={getValidationError()}
                      isAiProcessing={isAiProcessing}
                      onGenerateSuggestions={handleGenerateSuggestions}
                    />
                  )}

                  {currentStep === 'channels' && (
                    <ChannelsStep
                      data={wizardData}
                      onUpdate={updateField}
                      validationError={getValidationError()}
                      isAiProcessing={isAiProcessing}
                      onGenerateSuggestions={handleGenerateSuggestions}
                    />
                  )}

                  {currentStep === 'messaging' && (
                    <MessagingStep
                      data={wizardData}
                      onUpdate={updateField}
                      onUpdateDemographics={updateDemographics}
                      onAddMessage={addKeyMessage}
                      onRemoveMessage={removeKeyMessage}
                      validationError={getValidationError()}
                      isAiProcessing={isAiProcessing}
                      onGenerateSuggestions={handleGenerateSuggestions}
                    />
                  )}

                  {currentStep === 'timeline' && (
                    <TimelineStep
                      data={wizardData}
                      onUpdate={updateField}
                      onAddMilestone={addMilestone}
                      onRemoveMilestone={removeMilestone}
                      validationError={getValidationError()}
                      isAiProcessing={isAiProcessing}
                      onGenerateSuggestions={handleGenerateSuggestions}
                    />
                  )}

                  {currentStep === 'review' && (
                    <ReviewStep
                      data={wizardData}
                      stepSummary={getStepSummary()}
                      onComplete={handleComplete}
                      onEditStep={goToStep}
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Footer Navigation */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
                <Button
                  variant="outline"
                  size="default"
                  onClick={goToPreviousStep}
                  disabled={currentStepIndex === 0}
                  className="gap-2"
                  aria-label={t('accessibility.navigatePrevious')}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('navigation.previous')}
                </Button>

                <div className="flex items-center gap-3">
                  {currentStep !== 'review' && (
                    <Button
                      variant="ghost"
                      size="default"
                      onClick={skipStep}
                      className="gap-2"
                      aria-label={t('accessibility.skipStep')}
                    >
                      {t('navigation.skip')}
                    </Button>
                  )}

                  <Button
                    variant="default"
                    size="default"
                    onClick={currentStep === 'review' ? handleComplete : goToNextStep}
                    disabled={!canGoNext}
                    className="gap-2"
                    aria-label={currentStep === 'review' ? t('navigation.finish') : t('accessibility.navigateNext')}
                  >
                    {currentStep === 'review' ? (
                      <>
                        <Check className="h-4 w-4" />
                        {t('navigation.finish')}
                      </>
                    ) : (
                      <>
                        {t('navigation.next')}
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Overview Step Component
 * Campaign name, objective, and type selection
 */
function OverviewStep({
  data,
  onUpdate,
  validationError,
  isAiProcessing,
  onGenerateSuggestions
}: {
  data: CampaignWizardData;
  onUpdate: (field: keyof CampaignWizardData, value: any) => void;
  validationError?: string;
  isAiProcessing: boolean;
  onGenerateSuggestions: () => void;
}) {
  const { t } = useTranslation('wizard');

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-6"
    >
      {/* Campaign Name */}
      <div>
        <label className="block text-sm font-medium mb-2 text-foreground">
          {t('steps.overview.campaignName.label')}
        </label>
        <input
          type="text"
          value={data.campaignName || ''}
          onChange={(e) => onUpdate('campaignName', e.target.value)}
          placeholder={t('steps.overview.campaignName.placeholder')}
          className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          aria-invalid={!!validationError}
          aria-describedby={validationError ? 'name-error' : undefined}
        />
        {validationError === t('errors.required') && (
          <p id="name-error" className="mt-2 text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {validationError}
          </p>
        )}
      </div>

      {/* Campaign Objective */}
      <div>
        <label className="block text-sm font-medium mb-2 text-foreground">
          {t('steps.overview.objective.label')}
        </label>
        <textarea
          value={data.objective || ''}
          onChange={(e) => onUpdate('objective', e.target.value)}
          placeholder={t('steps.overview.objective.placeholder')}
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-all"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t('steps.overview.objective.hint')}
        </p>
      </div>

      {/* Campaign Type */}
      <div>
        <label className="block text-sm font-medium mb-2 text-foreground">
          {t('steps.overview.campaignType.label')}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(Object.keys({
            brand: 'brand',
            product: 'product',
            promotion: 'promotion',
            event: 'event',
            content: 'content',
            retention: 'retention',
            acquisition: 'acquisition'
          }) as Array<keyof CampaignWizardData['campaignType']>).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onUpdate('campaignType', type)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all',
                data.campaignType === type
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:border-primary/50'
              )}
            >
              <span className="text-sm font-medium">
                {t(`steps.overview.campaignType.types.${type}`)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* AI Suggestions Button */}
      <Button
        variant="outline"
        size="default"
        onClick={onGenerateSuggestions}
        disabled={isAiProcessing}
        className="w-full gap-2"
      >
        {isAiProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('ai.generating')}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {t('ai.regenerate')}
          </>
        )}
      </Button>
    </motion.div>
  );
}

/**
 * Audience Step Component
 * Define target audience with demographics and pain points
 */
function AudienceStep({
  data,
  onUpdate,
  onUpdateDemographics,
  validationError,
  isAiProcessing,
  onGenerateSuggestions
}: {
  data: CampaignWizardData;
  onUpdate: (field: keyof CampaignWizardData, value: any) => void;
  onUpdateDemographics: (field: string, value: string) => void;
  validationError?: string;
  isAiProcessing: boolean;
  onGenerateSuggestions: () => void;
}) {
  const { t } = useTranslation('wizard');

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-6"
    >
      {/* Audience Type */}
      <div>
        <label className="block text-sm font-medium mb-3 text-foreground">
          {t('steps.audience.audienceType.label')}
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(['b2c', 'b2b', 'both'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onUpdate('audienceType', type)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all',
                data.audienceType === type
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:border-primary/50'
              )}
            >
              <span className="text-sm font-medium">
                {t(`steps.audience.audienceType.types.${type}`)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Demographics */}
      <Card className="p-4 bg-muted/30">
        <h3 className="text-sm font-medium mb-4 text-foreground">
          {t('steps.audience.demographics.label')}
        </h3>
        <div className="space-y-4">
          {/* Age Range */}
          <div>
            <label className="block text-sm mb-2 text-muted-foreground">
              {t('steps.audience.demographics.ageRange')}
            </label>
            <input
              type="text"
              value={data.demographics?.ageRange || ''}
              onChange={(e) => onUpdateDemographics('ageRange', e.target.value)}
              placeholder={t('steps.audience.demographics.placeholders.ageRange')}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm mb-2 text-muted-foreground">
              {t('steps.audience.demographics.location')}
            </label>
            <input
              type="text"
              value={data.demographics?.location || ''}
              onChange={(e) => onUpdateDemographics('location', e.target.value)}
              placeholder={t('steps.audience.demographics.placeholders.location')}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>

          {/* Interests */}
          <div>
            <label className="block text-sm mb-2 text-muted-foreground">
              {t('steps.audience.demographics.interests')}
            </label>
            <textarea
              value={data.demographics?.interests || ''}
              onChange={(e) => onUpdateDemographics('interests', e.target.value)}
              placeholder={t('steps.audience.demographics.placeholders.interests')}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
            />
          </div>
        </div>
      </Card>

      {/* Pain Points */}
      <div>
        <label className="block text-sm font-medium mb-2 text-foreground">
          {t('steps.audience.painPoints.label')}
        </label>
        <textarea
          value={data.painPoints || ''}
          onChange={(e) => onUpdate('painPoints', e.target.value)}
          placeholder={t('steps.audience.painPoints.placeholder')}
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none transition-all"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t('steps.audience.painPoints.hint')}
        </p>
      </div>

      {/* AI Suggestions */}
      <Button
        variant="outline"
        size="default"
        onClick={onGenerateSuggestions}
        disabled={isAiProcessing}
        className="w-full gap-2"
      >
        {isAiProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('ai.generating')}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {t('ai.regenerate')}
          </>
        )}
      </Button>
    </motion.div>
  );
}

/**
 * Channels Step Component
 * Select marketing channels and platforms
 */
function ChannelsStep({
  data,
  onUpdate,
  validationError,
  isAiProcessing,
  onGenerateSuggestions
}: {
  data: CampaignWizardData;
  onUpdate: (field: keyof CampaignWizardData, value: any) => void;
  validationError?: string;
  isAiProcessing: boolean;
  onGenerateSuggestions: () => void;
}) {
  const { t } = useTranslation('wizard');

  const channelTypes = [
    { id: 'social', icon: 'MessageSquare', label: t('steps.channels.channelTypes.social') },
    { id: 'email', icon: 'Mail', label: t('steps.channels.channelTypes.email') },
    { id: 'paid', icon: 'DollarSign', label: t('steps.channels.channelTypes.paid') },
    { id: 'organic', icon: 'Search', label: t('steps.channels.channelTypes.organic') },
    { id: 'content', icon: 'FileText', label: t('steps.channels.channelTypes.content') },
    { id: 'events', icon: 'Calendar', label: t('steps.channels.channelTypes.events') },
    { id: 'partnership', icon: 'Handshake', label: t('steps.channels.channelTypes.partnership') }
  ] as const;

  const toggleChannel = (channel: string) => {
    const current = data.selectedChannels || [];
    const updated = current.includes(channel)
      ? current.filter((c) => c !== channel)
      : [...current, channel];
    onUpdate('selectedChannels', updated);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-6"
    >
      {/* Channel Types Grid */}
      <div>
        <label className="block text-sm font-medium mb-3 text-foreground">
          {t('steps.channels.title')}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {channelTypes.map((channel) => {
            const Icon = channel.icon;
            const isSelected = data.selectedChannels?.includes(channel.id);
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => toggleChannel(channel.id)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all',
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card hover:border-primary/50'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium text-center">
                  {channel.label}
                </span>
              </button>
            );
          })}
        </div>
        {validationError && (
          <p className="mt-2 text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {validationError}
          </p>
        )}
      </div>

      {/* AI Suggestions Button */}
      <Button
        variant="outline"
        size="default"
        onClick={onGenerateSuggestions}
        disabled={isAiProcessing}
        className="w-full gap-2"
      >
        {isAiProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('ai.generating')}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {t('ai.regenerate')}
          </>
        )}
      </Button>
    </motion.div>
  );
}

/**
 * Messaging Step Component
 * Craft key messages, value proposition, and call to action
 */
function MessagingStep({
  data,
  onUpdate,
  onUpdateDemographics,
  onAddMessage,
  onRemoveMessage,
  validationError,
  isAiProcessing,
  onGenerateSuggestions
}: {
  data: CampaignWizardData;
  onUpdate: (field: keyof CampaignWizardData, value: any) => void;
  onUpdateDemographics: (field: string, value: string) => void;
  onAddMessage: (message: string) => void;
  onRemoveMessage: (index: number) => void;
  validationError?: string;
  isAiProcessing: boolean;
  onGenerateSuggestions: () => void;
}) {
  const { t } = useTranslation('wizard');

  const toneOptions = [
    { value: 'professional', label: t('steps.messaging.tone.options.professional') },
    { value: 'friendly', label: t('steps.messaging.tone.options.friendly') },
    { value: 'urgent', label: t('steps.messaging.tone.options.urgent') },
    { value: 'inspirational', label: t('steps.messaging.tone.options.inspirational') },
    { value: 'humorous', label: t('steps.messaging.tone.options.humorous') },
    { value: 'educational', label: t('steps.messaging.tone.options.educational') }
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-6"
    >
      {/* Value Proposition */}
      <div>
        <label className="block text-sm font-medium mb-2 text-foreground">
          {t('steps.messaging.valueProposition.label')}
        </label>
        <textarea
          value={data.valueProposition || ''}
          onChange={(e) => onUpdate('valueProposition', e.target.value)}
          placeholder={t('steps.messaging.valueProposition.placeholder')}
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none transition-all"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t('steps.messaging.valueProposition.hint')}
        </p>
      </div>

      {/* Key Messages */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-foreground">
            {t('steps.messaging.keyMessages.label')}
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const message = window.prompt(t('steps.messaging.keyMessages.placeholder'));
              if (message) onAddMessage(message);
            }}
            className="gap-1"
          >
            <span>+</span>
            {t('steps.messaging.keyMessages.addMessage')}
          </Button>
        </div>
        <div className="space-y-2">
          {data.keyMessages?.map((message, index) => (
            <Card key={index} className="flex items-center gap-3 p-3 bg-muted/30">
              <span className="flex-1 text-sm">{message}</span>
              <button
                type="button"
                onClick={() => onRemoveMessage(index)}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                aria-label={t('steps.messaging.keyMessages.removeMessage')}
              >
                ×
              </button>
            </Card>
          )) || (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('steps.messaging.keyMessages.placeholder')}
            </p>
          )}
        </div>
      </div>

      {/* Call to Action */}
      <div>
        <label className="block text-sm font-medium mb-2 text-foreground">
          {t('steps.messaging.callToAction.label')}
        </label>
        <input
          type="text"
          value={data.callToAction || ''}
          onChange={(e) => onUpdate('callToAction', e.target.value)}
          placeholder={t('steps.messaging.callToAction.placeholder')}
          className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-all"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {['shopNow', 'learnMore', 'signUp', 'getQuote', 'download', 'contactUs'] as const}.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onUpdate('callToAction', t(`steps.messaging.callToAction.examples.${example}`))}
              className="px-3 py-2 text-xs rounded-lg border border-border bg-card hover:bg-muted transition-colors"
            >
              {t(`steps.messaging.callToAction.examples.${example}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Messaging Tone */}
      <div>
        <label className="block text-sm font-medium mb-3 text-foreground">
          {t('steps.messaging.tone.label')}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {toneOptions.map((tone) => (
            <button
              key={tone.value}
              type="button"
              onClick={() => onUpdate('tone', tone.value)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all',
                data.tone === tone.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:border-primary/50'
              )}
            >
              <span className="text-sm font-medium text-center">
                {tone.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* AI Suggestions */}
      <Button
        variant="outline"
        size="default"
        onClick={onGenerateSuggestions}
        disabled={isAiProcessing}
        className="w-full gap-2"
      >
        {isAiProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('ai.generating')}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {t('ai.regenerate')}
          </>
        )}
      </Button>
    </motion.div>
  );
}

/**
 * Timeline Step Component
 * Set campaign duration, budget, and milestones
 */
function TimelineStep({
  data,
  onUpdate,
  onAddMilestone,
  onRemoveMilestone,
  validationError,
  isAiProcessing,
  onGenerateSuggestions
}: {
  data: CampaignWizardData;
  onUpdate: (field: keyof CampaignWizardData, value: any) => void;
  onAddMilestone: (milestone: { date: string; title: string }) => void;
  onRemoveMilestone: (index: number) => void;
  validationError?: string;
  isAiProcessing: boolean;
  onGenerateSuggestions: () => void;
}) {
  const { t } = useTranslation('wizard');

  const durationOptions = [
    { value: 'flash', label: t('steps.timeline.duration.options.flash') },
    { value: 'short', label: t('steps.timeline.duration.options.short') },
    { value: 'medium', label: t('steps.timeline.duration.options.medium') },
    { value: 'long', label: t('steps.timeline.duration.options.long') },
    { value: 'ongoing', label: t('steps.timeline.duration.options.ongoing') }
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-6"
    >
      {/* Duration Selection */}
      <div>
        <label className="block text-sm font-medium mb-3 text-foreground">
          {t('steps.timeline.duration.label')}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {durationOptions.map((duration) => (
            <button
              key={duration.value}
              type="button"
              onClick={() => onUpdate('duration', duration.value)}
              className={cn(
                'p-4 rounded-lg border transition-all text-sm font-medium',
                data.duration === duration.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:border-primary/50'
              )}
            >
              {duration.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Start Date */}
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">
            {t('steps.timeline.startDate.label')}
          </label>
          <input
            type="date"
            value={data.startDate || ''}
            onChange={(e) => onUpdate('startDate', e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            aria-invalid={!data.startDate && !!validationError}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t('steps.timeline.startDate.placeholder')}
          </p>
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">
            {t('steps.timeline.endDate.label')}
          </label>
          <input
            type="date"
            value={data.endDate || ''}
            onChange={(e) => onUpdate('endDate', e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-all"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t('steps.timeline.endDate.placeholder')}
          </p>
        </div>
      </div>

      {/* Budget */}
      <div>
        <label className="block text-sm font-medium mb-2 text-foreground">
          {t('steps.timeline.budget.label')}
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground">
            {t('steps.timeline.budget.amount')}
          </span>
          <input
            type="number"
            value={data.totalBudget || ''}
            onChange={(e) => onUpdate('totalBudget', parseFloat(e.target.value) || undefined)}
            placeholder={t('steps.timeline.budget.placeholder')}
            className="w-full pl-16 pr-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            aria-invalid={!data.totalBudget && !!validationError}
          />
        </div>
      </div>

      {/* Milestones */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-foreground">
            {t('steps.timeline.milestones.label')}
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const date = window.prompt('Enter milestone date (YYYY-MM-DD):');
              const title = window.prompt('Enter milestone title:');
              if (date && title) onAddMilestone({ date, title });
            }}
            className="gap-1"
          >
            <span>+</span>
            {t('steps.timeline.milestones.addMilestone')}
          </Button>
        </div>
        <div className="space-y-2">
          {data.milestones?.map((milestone, index) => (
            <Card key={index} className="flex items-center gap-3 p-3 bg-muted/30">
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{milestone.title}</div>
                <div className="text-xs text-muted-foreground">{milestone.date}</div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveMilestone(index)}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                aria-label={t('steps.timeline.milestones.removeMilestone')}
              >
                ×
              </button>
            </Card>
          )) || (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('steps.timeline.milestones.placeholder')}
            </p>
          )}
        </div>
      </div>

      {validationError && (
        <p className="mt-2 text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-4 w-4" />
          {validationError}
        </p>
      )}

      {/* AI Suggestions */}
      <Button
        variant="outline"
        size="default"
        onClick={onGenerateSuggestions}
        disabled={isAiProcessing}
        className="w-full gap-2"
      >
        {isAiProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('ai.generating')}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {t('ai.regenerate')}
          </>
        )}
      </Button>
    </motion.div>
  );
}

/**
 * Review Step Component
 * Summary and pre-launch checklist
 */
function ReviewStep({
  data,
  stepSummary,
  onComplete,
  onEditStep
}: {
  data: CampaignWizardData;
  stepSummary: Array<{ step: WizardStep; title: string; isComplete: boolean }>;
  onComplete: () => void;
  onEditStep: (step: WizardStep) => void;
}) {
  const { t } = useTranslation(['wizard', 'common']);

  const checklistItems = [
    { key: 'objectives', label: t('steps.review.checklist.objectives'), icon: Check },
    { key: 'audience', label: t('steps.review.checklist.audience'), icon: 'Users' },
    { key: 'channels', label: t('steps.review.checklist.channels'), icon: 'Radio' },
    { key: 'budget', label: t('steps.review.checklist.budget'), icon: 'DollarSign' },
    { key: 'messaging', label: t('steps.review.checklist.messaging'), icon: 'MessageSquare' },
    { key: 'timeline', label: t('steps.review.checklist.timeline'), icon: 'Calendar' },
    { key: 'assets', label: t('steps.review.checklist.assets'), icon: 'Image' }
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="p-6 space-y-6"
    >
      {/* Campaign Summary */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/30">
        <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {t('steps.review.summary.title')}
        </h3>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t('steps.overview.campaignName.label')}:</span>
              <span className="font-medium text-foreground ml-2">{data.campaignName || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('steps.overview.objective.label')}:</span>
              <span className="font-medium text-foreground ml-2">{data.objective || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('steps.overview.campaignType.label')}:</span>
              <span className="font-medium text-foreground ml-2">
                {data.campaignType ? t(`steps.overview.campaignType.types.${data.campaignType}`) : '-'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('steps.timeline.budget.label')}:</span>
              <span className="font-medium text-foreground ml-2">
                {data.totalBudget ? `$${data.totalBudget.toLocaleString()}` : '-'}
              </span>
            </div>
          </div>

          {data.selectedChannels && data.selectedChannels.length > 0 && (
            <div>
              <span className="text-muted-foreground">{t('steps.channels.title')}:</span>
              <div className="flex flex-wrap gap-1 mt-2">
                {data.selectedChannels.map((channel) => (
                  <span
                    key={channel}
                    className="inline-flex items-center px-2 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium"
                  >
                    {t(`steps.channels.channelTypes.${channel}`)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.valueProposition && (
            <div>
              <span className="text-muted-foreground">{t('steps.messaging.valueProposition.label')}:</span>
              <p className="font-medium text-foreground mt-2">{data.valueProposition}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Step Progress */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">
          {t('steps.review.checklist.title')}
        </h3>
        <div className="space-y-2">
          {stepSummary.map((step) => (
            <button
              key={step.step}
              type="button"
              onClick={() => onEditStep(step.step)}
              className={cn(
                'flex items-center justify-between w-full p-3 rounded-lg border transition-all text-left',
                step.isComplete
                  ? 'border-success/30 bg-success/5 text-success'
                  : 'border-border bg-card'
              )}
              >
              <span className="text-sm font-medium">{step.title}</span>
              {step.isComplete ? (
                <Check className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Pre-Launch Checklist */}
      <Card className="p-4 bg-muted/30">
        <h3 className="text-sm font-semibold mb-3 text-foreground">
          {t('steps.review.checklist.title')}
        </h3>
        <div className="space-y-2">
          {checklistItems.map((item) => {
            const Icon = item.icon;
            const isComplete = item.key === 'objectives' && !!data.campaignName;
            return (
              <div
                key={item.key}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-lg text-sm transition-all',
                  isComplete
                    ? 'bg-success/10 text-success'
                    : 'bg-muted/50'
                )}
              >
                <Icon className={cn(
                  'h-4 w-4 shrink-0',
                  isComplete ? 'text-success' : 'text-muted-foreground'
                )} />
                <span className="flex-1">{item.label}</span>
                {isComplete && <Check className="h-4 w-4 text-success ml-auto" />}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button
          variant="outline"
          size="default"
          onClick={() => onEditStep('overview')}
          className="gap-2"
        >
          {t('steps.review.actions.goBack')}
        </Button>

        <Button
          variant="default"
          size="default"
          onClick={onComplete}
          className="gap-2"
        >
          <Check className="h-4 w-4" />
          {t('steps.review.actions.createCampaign')}
        </Button>
      </div>
    </motion.div>
  );
}
