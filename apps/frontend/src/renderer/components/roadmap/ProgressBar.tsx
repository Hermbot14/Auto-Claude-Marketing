import { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

/**
 * Roadmap generation phases with their weights for progress calculation
 */
export type RoadmapPhase =
  | 'discovery'
  | 'research'
  | 'analysis'
  | 'generation'
  | 'finalization';

/**
 * Phase configuration with weights and step counts
 */
const PHASE_CONFIG: Record<
  RoadmapPhase,
  { label: string; weight: number; steps: number; color: string }
> = {
  discovery: { label: 'Discovery', weight: 10, steps: 5, color: 'bg-info' },
  research: { label: 'Research', weight: 25, steps: 10, color: 'bg-primary' },
  analysis: { label: 'Analysis', weight: 20, steps: 8, color: 'bg-warning' },
  generation: { label: 'Generation', weight: 35, steps: 15, color: 'bg-purple-500' },
  finalization: { label: 'Finalization', weight: 10, steps: 5, color: 'bg-success' },
};

/**
 * Phase step progress
 */
export interface PhaseProgress {
  phase: RoadmapPhase;
  currentStep: number;
  totalSteps: number;
  stepName?: string;
}

/**
 * Props for ProgressBar component
 */
interface ProgressBarProps {
  currentPhase: RoadmapPhase;
  phaseProgress: PhaseProgress[];
  className?: string;
  showPhaseLabels?: boolean;
}

/**
 * Calculate overall progress percentage based on phase weights and step completion
 *
 * Formula:
 * - For completed phases: full weight of the phase
 * - For current phase: weight * (currentStep / totalSteps)
 * - For future phases: 0
 */
function calculateProgress(
  currentPhase: RoadmapPhase,
  phaseProgress: PhaseProgress[]
): number {
  const phases: RoadmapPhase[] = ['discovery', 'research', 'analysis', 'generation', 'finalization'];
  const currentPhaseIndex = phases.indexOf(currentPhase);

  let totalProgress = 0;

  phases.forEach((phase, index) => {
    const config = PHASE_CONFIG[phase];
    const progress = phaseProgress.find(p => p.phase === phase);

    if (index < currentPhaseIndex) {
      // Completed phases - full weight
      totalProgress += config.weight;
    } else if (index === currentPhaseIndex && progress) {
      // Current phase - partial progress based on steps
      const phaseProgress = progress.currentStep / progress.totalSteps;
      totalProgress += config.weight * phaseProgress;
    }
    // Future phases contribute 0
  });

  // Smooth the progress - avoid 0% at start, show at least 1%
  return Math.max(1, Math.min(100, Math.round(totalProgress)));
}

/**
 * Calculate previous progress for smoothing animation
 */
function useSmoothedProgress(
  targetProgress: number,
  isRunning: boolean
): number {
  const [smoothedProgress, setSmoothedProgress] = useState(targetProgress);

  useEffect(() => {
    if (!isRunning) {
      setSmoothedProgress(targetProgress);
      return;
    }

    // Smooth transition to target progress
    const timer = setTimeout(() => {
      setSmoothedProgress(targetProgress);
    }, 300); // 300ms smooth transition

    return () => clearTimeout(timer);
  }, [targetProgress, isRunning]);

  return smoothedProgress;
}

/**
 * ProgressBar Component
 *
 * Displays a progress bar with phase-based calculation.
 * Progress is computed from:
 * 1. Phase weights (discovery: 10%, research: 25%, analysis: 20%, generation: 35%, finalization: 10%)
 * 2. Current step within the phase
 * 3. Smooth incremental updates (no jumps)
 */
export function ProgressBar({
  currentPhase,
  phaseProgress,
  className,
  showPhaseLabels = true,
}: ProgressBarProps) {
  const isRunning = currentPhase !== 'finalization' || phaseProgress.find(p => p.phase === 'finalization')?.currentStep === 0;

  // Calculate target progress
  const targetProgress = useMemo(
    () => calculateProgress(currentPhase, phaseProgress),
    [currentPhase, phaseProgress]
  );

  // Smooth the progress for visual transitions
  const smoothedProgress = useSmoothedProgress(targetProgress, isRunning);

  // Get phase state for each phase
  const getPhaseState = (phase: RoadmapPhase): 'pending' | 'active' | 'complete' => {
    const phases: RoadmapPhase[] = ['discovery', 'research', 'analysis', 'generation', 'finalization'];
    const currentIndex = phases.indexOf(currentPhase);
    const phaseIndex = phases.indexOf(phase);

    if (phaseIndex < currentIndex) return 'complete';
    if (phaseIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {PHASE_CONFIG[currentPhase].label}
          </span>
          <span className="font-semibold">{smoothedProgress}%</span>
        </div>

        {/* Progress bar container */}
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-border">
          {/* Background segments for all phases */}
          <div className="absolute inset-0 flex">
            {(['discovery', 'research', 'analysis', 'generation', 'finalization'] as RoadmapPhase[]).map(
              (phase) => {
                const config = PHASE_CONFIG[phase];
                const state = getPhaseState(phase);
                return (
                  <div
                    key={phase}
                    className={cn(
                      'h-full transition-colors duration-300',
                      state === 'complete' && config.color,
                      state === 'active' && `${config.color}/80`,
                      state === 'pending' && 'bg-muted'
                    )}
                    style={{ width: `${config.weight}%` }}
                  />
                );
              }
            )}
          </div>

          {/* Animated overlay for current progress */}
          <motion.div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{
              x: ['-100%', '200%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{ width: '50%' }}
          />
        </div>
      </div>

      {/* Phase Indicators */}
      {showPhaseLabels && (
        <div className="flex items-center justify-between gap-1 mt-2">
          {(['discovery', 'research', 'analysis', 'generation', 'finalization'] as RoadmapPhase[]).map(
            (phase) => {
              const config = PHASE_CONFIG[phase];
              const state = getPhaseState(phase);
              const progress = phaseProgress.find(p => p.phase === phase);

              return (
                <div
                  key={phase}
                  className="flex-1 text-center"
                  title={`${config.label}${progress ? ` (${progress.currentStep}/${progress.totalSteps})` : ''}`}
                >
                  <div
                    className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors',
                      state === 'complete' && `${config.color}/20 ${config.color.replace('bg-', 'text-')}`,
                      state === 'active' && `${config.color}/30 ${config.color.replace('bg-', 'text-')} animate-pulse`,
                      state === 'pending' && 'bg-muted/30 text-muted-foreground'
                    )}
                  >
                    <span>{config.label}</span>
                    {state === 'active' && progress && (
                      <span className="opacity-70">
                        {progress.currentStep}/{progress.totalSteps}
                      </span>
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {/* Current Step Description */}
      <AnimatePresence mode="wait">
        {phaseProgress.find(p => p.phase === currentPhase)?.stepName && (
          <motion.div
            key={currentPhase}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="text-xs text-muted-foreground text-center"
          >
            {phaseProgress.find(p => p.phase === currentPhase)?.stepName}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Hook to manage phase progress state
 */
export function usePhaseProgress() {
  const [phaseProgress, setPhaseProgress] = useState<PhaseProgress[]>([
    { phase: 'discovery', currentStep: 0, totalSteps: PHASE_CONFIG.discovery.steps },
    { phase: 'research', currentStep: 0, totalSteps: PHASE_CONFIG.research.steps },
    { phase: 'analysis', currentStep: 0, totalSteps: PHASE_CONFIG.analysis.steps },
    { phase: 'generation', currentStep: 0, totalSteps: PHASE_CONFIG.generation.steps },
    { phase: 'finalization', currentStep: 0, totalSteps: PHASE_CONFIG.finalization.steps },
  ]);

  const [currentPhase, setCurrentPhase] = useState<RoadmapPhase>('discovery');

  const updatePhaseProgress = (
    phase: RoadmapPhase,
    currentStep: number,
    stepName?: string
  ) => {
    setPhaseProgress(prev =>
      prev.map(p =>
        p.phase === phase
          ? { ...p, currentStep, stepName }
          : p
      )
    );
  };

  const resetProgress = () => {
    setPhaseProgress([
      { phase: 'discovery', currentStep: 0, totalSteps: PHASE_CONFIG.discovery.steps },
      { phase: 'research', currentStep: 0, totalSteps: PHASE_CONFIG.research.steps },
      { phase: 'analysis', currentStep: 0, totalSteps: PHASE_CONFIG.analysis.steps },
      { phase: 'generation', currentStep: 0, totalSteps: PHASE_CONFIG.generation.steps },
      { phase: 'finalization', currentStep: 0, totalSteps: PHASE_CONFIG.finalization.steps },
    ]);
    setCurrentPhase('discovery');
  };

  return {
    phaseProgress,
    currentPhase,
    setCurrentPhase,
    updatePhaseProgress,
    resetProgress,
  };
}
