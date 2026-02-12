import { useState } from 'react';
import {
  Cloud,
  CloudOff,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOptimisticStore } from '../stores/optimistic';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

/**
 * PendingIndicator Component
 *
 * A floating indicator that shows pending sync operations and their status.
 * Displays count of pending operations, allows viewing details and retrying failed operations.
 * Integrates with the optimistic update system for immediate UI feedback.
 */
export function PendingIndicator() {
  const { t } = useTranslation('common');
  const {
    mutations,
    syncStatus,
    retryMutation,
    clearMutations,
    clearFailedMutations
  } = useOptimisticStore();

  const [isExpanded, setIsExpanded] = useState(false);

  // Categorize mutations
  const pendingMutations = mutations.filter(
    m => m.status === 'pending' || m.status === 'processing'
  );
  const failedMutations = mutations.filter(m => m.status === 'failed');

  // Don't render if no mutations
  if (mutations.length === 0) {
    return null;
  }

  const hasPending = pendingMutations.length > 0;
  const hasFailed = failedMutations.length > 0;
  const isOnline = syncStatus.isOnline;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full max-w-[320px]">
      <div className="rounded-lg border bg-card shadow-lg overflow-hidden">
        {/* Header */}
        <button
          type="button"
          className={cn(
            'flex items-center justify-between px-3 py-2 cursor-pointer w-full text-left transition-colors',
            hasFailed ? 'bg-destructive/10 border-destructive/20' : 'bg-muted/50'
          )}
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={t('optimistic.toggleExpand')}
        >
          <div className="flex items-center gap-2">
            {/* Status icon based on state */}
            {!isOnline ? (
              <CloudOff className="h-4 w-4 text-muted-foreground" />
            ) : hasFailed ? (
              <XCircle className="h-4 w-4 text-destructive" />
            ) : hasPending ? (
              <RefreshCw className="h-4 w-4 text-primary animate-spin-slow" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-success" />
            )}

            {/* Status text */}
            <span className="text-sm font-medium">
              {!isOnline
                ? t('optimistic.offline')
                : hasFailed
                  ? t('optimistic.syncFailed', { count: failedMutations.length })
                  : hasPending
                    ? t('optimistic.syncing', { count: pendingMutations.length })
                    : t('optimistic.synced')}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Clear button when no pending operations */}
            {!hasPending && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearMutations();
                }}
                className="p-1 hover:bg-muted rounded"
                aria-label={t('optimistic.clearAll')}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Mutation list (expanded) */}
        {isExpanded && (
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {/* Offline warning */}
            {!isOnline && (
              <div className="px-3 py-2 bg-warning/10 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-warning">
                    {t('optimistic.offlineMessage')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('optimistic.offlineMessageDescription')}
                  </p>
                </div>
              </div>
            )}

            {/* Pending mutations */}
            {pendingMutations.map((mutation) => (
              <div
                key={mutation.id}
                className="px-3 py-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin-slow shrink-0" />
                    <span className="text-xs font-medium truncate">
                      {getMutationLabel(mutation.type, t)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t('optimistic.processing')}
                  </span>
                </div>
                {mutation.targetId && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {t('optimistic.targetId', { id: mutation.targetId })}
                  </div>
                )}
              </div>
            ))}

            {/* Failed mutations */}
            {failedMutations.map((mutation) => (
              <div
                key={mutation.id}
                className="px-3 py-2 hover:bg-destructive/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    <span className="text-xs font-medium truncate">
                      {getMutationLabel(mutation.type, t)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => retryMutation(mutation.id)}
                    disabled={mutation.retryCount >= 3}
                  >
                    {t('optimistic.retry')}
                  </Button>
                </div>
                {mutation.error && (
                  <div className="mt-1 text-[10px] text-destructive truncate" title={mutation.error}>
                    {mutation.error}
                  </div>
                )}
                {mutation.retryCount > 0 && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {t('optimistic.retryAttempt', {
                      attempt: mutation.retryCount + 1,
                      max: 3
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Actions for failed mutations */}
            {hasFailed && (
              <div className="px-3 py-2 bg-muted/50 border-t">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => {
                      // Retry all failed mutations
                      failedMutations.forEach(m => {
                        if (m.retryCount < 3) {
                          retryMutation(m.id);
                        }
                      });
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {t('optimistic.retryAll')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={clearFailedMutations}
                  >
                    <X className="h-3 w-3 mr-1" />
                    {t('optimistic.clearFailed')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Get human-readable label for mutation type
 */
function getMutationLabel(
  type: string,
  t: (key: string, params?: Record<string, unknown>) => string
): string {
  const labels: Record<string, string> = {
    update_task_status: t('optimistic.mutationTypes.updateTaskStatus'),
    update_task_title: t('optimistic.mutationTypes.updateTaskTitle'),
    update_task_description: t('optimistic.mutationTypes.updateTaskDescription'),
    create_task: t('optimistic.mutationTypes.createTask'),
    delete_task: t('optimistic.mutationTypes.deleteTask'),
    update_feature_status: t('optimistic.mutationTypes.updateFeatureStatus'),
    update_feature_title: t('optimistic.mutationTypes.updateFeatureTitle'),
    update_feature_description: t('optimistic.mutationTypes.updateFeatureDescription'),
    add_feature: t('optimistic.mutationTypes.addFeature'),
    delete_feature: t('optimistic.mutationTypes.deleteFeature'),
    reorder_features: t('optimistic.mutationTypes.reorderFeatures'),
    reorder_phases: t('optimistic.mutationTypes.reorderPhases'),
    update_roadmap_metadata: t('optimistic.mutationTypes.updateRoadmapMetadata')
  };

  return labels[type] || t('optimistic.mutationTypes.unknown');
}
