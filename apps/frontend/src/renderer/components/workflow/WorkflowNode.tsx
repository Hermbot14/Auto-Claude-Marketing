import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Play,
  Plus,
  Settings,
  Clock,
  GitBranch,
  Trash2,
  ChevronDown,
  GripVertical,
  Filter,
  Square
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../../shared/lib/utils';
import type { WorkflowNode as WorkflowNodeType, NodeStatus } from '../../../shared/types/workflow';

/**
 * WorkflowNode - Visual node component for workflow canvas
 *
 * Renders individual workflow nodes with:
 * - Type-specific styling and icons
 * - Input/output port indicators
 * - Selection state
 * - Status indicators (valid/invalid/running)
 * - Configuration panel
 */
interface WorkflowNodeProps {
  node: WorkflowNodeType;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (node: WorkflowNodeType) => void;
  onDelete: () => void;
  readOnly?: boolean;
}

export function WorkflowNode({
  node,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  readOnly = false
}: WorkflowNodeProps) {
  const { t } = useTranslation(['workflow', 'common']);

  // Local state
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  /**
   * Get node color based on type and status
   */
  const getNodeColor = useCallback(() => {
    const colorMap: Record<string, string> = {
      trigger: 'bg-green-500/10 border-green-500 text-green-700 dark:border-green-500/50',
      action: 'bg-blue-500/10 border-blue-500 text-blue-700 dark:border-blue-500/50',
      condition: 'bg-purple-500/10 border-purple-500 text-purple-700 dark:border-purple-500/50',
      loop: 'bg-orange-500/10 border-orange-500 text-orange-700 dark:border-orange-500/50',
      parallel: 'bg-cyan-500/10 border-cyan-500 text-cyan-700 dark:border-cyan-500/50',
      merge: 'bg-pink-500/10 border-pink-500 text-pink-700 dark:border-pink-500/50',
      delay: 'bg-yellow-500/10 border-yellow-500 text-yellow-700 dark:border-yellow-500/50',
      transform: 'bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:border-indigo-500/50',
      filter: 'bg-teal-500/10 border-teal-500 text-teal-700 dark:border-teal-500/50',
      output: 'bg-gray-500/10 border-gray-500 text-gray-700 dark:border-gray-500/50'
    };

    const baseColor = colorMap[node.type] || colorMap.action;

    if (node.status === 'error') {
      return 'bg-destructive/10 border-destructive text-destructive-foreground dark:border-destructive/50';
    }

    return baseColor;
  }, [node.type, node.status]);

  /**
   * Get node icon
   */
  const nodeIcon = useMemo(() => {
    const icons: Record<string, React.ReactNode> = {
      'trigger': <Play className="h-4 w-4" />,
      'action': <Plus className="h-4 w-4" />,
      'condition': <GitBranch className="h-4 w-4" />,
      'loop': <Clock className="h-4 w-4" />,
      'parallel': <GitBranch className="h-4 w-4" />,
      'merge': <Settings className="h-4 w-4" />,
      'delay': <Clock className="h-4 w-4" />,
      'transform': <Settings className="h-4 w-4" />,
      'filter': <Filter className="h-4 w-4" />,
      'output': <Square className="h-4 w-4" />
    };

    return icons[node.type] || <Plus className="h-4 w-4" />;
  }, [node.type]);

  /**
   * Handle mouse down for dragging
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;

    e.stopPropagation();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - node.position.x,
      y: e.clientY - node.position.y
    });
  }, [node.position, readOnly]);

  /**
   * Handle mouse move for dragging
   */
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      onUpdate({
        ...node,
        position: {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        }
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, node, onUpdate, readOnly]);

  /**
   * Get status indicator
   */
  const getStatusIndicator = useCallback(() => {
    if (node.status === 'running') {
      return (
        <div className="h-2 w-2 animate-pulse">
          <div className="h-2 w-2 rounded-full bg-primary"></div>
        </div>
      );
    }

    if (node.status === 'success') {
      return (
        <div className="h-2 w-2">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
        </div>
      );
    }

    if (node.status === 'error') {
      return (
        <div className="h-2 w-2">
          <div className="h-2 w-2 rounded-full bg-destructive"></div>
        </div>
      );
    }

    return null;
  }, [node.status]);

  return (
    <div
      className={cn(
        'workflow-node absolute cursor-pointer',
        getNodeColor(),
        selected && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
        isDragging && 'cursor-grabbing shadow-xl'
      )}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: 200,
        height: 80
      }}
      onMouseDown={(e) => {
        if (!readOnly) {
          handleMouseDown(e);
        }
      }}
      onClick={onSelect}
    >
      {/* Node header with drag handle */}
      <div className={cn(
        'flex items-center gap-2 p-3 border-b border-border/50 cursor-grab',
        selected && 'bg-accent/50'
      )}>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-foreground">
            {nodeIcon}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground truncate">
              {node.data.label}
            </h4>

            {node.data.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {node.data.description}
              </p>
            )}
          </div>

          {/* Actions */}
          {!readOnly && (
            <div className="flex items-center gap-1">
              {getStatusIndicator()}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsConfigOpen(!isConfigOpen)}
                className="h-6 w-6 p-1 hover:bg-accent"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="h-6 w-6 p-1 hover:bg-destructive/10 text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Drag handle indicator */}
        <div className="absolute top-1/2 -right-1.5 flex items-center justify-center h-4 w-4 cursor-grab opacity-0 hover:opacity-100">
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>

      {/* Input ports */}
      <div className="absolute top-1/2 -left-2">
        {node.type === 'action' || node.type === 'condition' || node.type === 'transform' || node.type === 'filter' ? (
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-muted border border-border">
            <div className="h-2 w-2 rounded-full bg-background"></div>
          </div>
        ) : null}
      </div>

      {/* Output ports */}
      <div className="absolute top-1/2 -right-2">
        {node.type === 'action' || node.type === 'condition' || node.type === 'merge' || node.type === 'output' ? (
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <div className="h-2 w-2 rounded-full bg-background"></div>
          </div>
        ) : null}
      </div>

      {/* Configuration panel */}
      {isConfigOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="absolute top-full left-0 right-0 z-10 w-64 bg-card border border-border rounded-lg shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="font-semibold text-foreground">
              {t('workflow:node.config.title')}
            </h3>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsConfigOpen(false)}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </Button>
          </div>

          <div className="p-4 space-y-4">
            {/* Type-specific configuration */}
            {node.type === 'trigger' && (
              <TriggerNodeConfig node={node} onUpdate={onUpdate} />
            )}

            {node.type === 'action' && (
              <ActionNodeConfig node={node} onUpdate={onUpdate} />
            )}

            {node.type === 'condition' && (
              <ConditionNodeConfig node={node} onUpdate={onUpdate} />
            )}

            {node.type === 'delay' && (
              <DelayNodeConfig node={node} onUpdate={onUpdate} />
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Trigger node configuration component
 */
function TriggerNodeConfig({ node, onUpdate }: { node: WorkflowNodeType; onUpdate: (node: WorkflowNodeType) => void }) {
  const { t } = useTranslation('workflow');

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1">
          {t('workflow:node.triggerType')}
        </label>
        <select
          value={node.data.triggerData?.triggerType}
          onChange={(e) => {
            onUpdate({
              ...node,
              data: {
                ...node.data,
                triggerData: {
                  ...node.data.triggerData,
                  triggerType: e.target.value as any
                }
              }
            });
          }}
          className="w-full p-2 rounded border border-border bg-background text-sm"
        >
          <option value="manual">{t('workflow:node.triggers.manual')}</option>
          <option value="schedule">{t('workflow:node.triggers.schedule')}</option>
          <option value="webhook">{t('workflow:node.triggers.webhook')}</option>
          <option value="event">{t('workflow:node.triggers.event')}</option>
        </select>
      </div>

      {node.data.triggerData?.triggerType === 'schedule' && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1">
            {t('workflow:node.schedule')}
          </label>
          <input
            type="text"
            value={node.data.triggerData?.schedule || ''}
            onChange={(e) => {
              onUpdate({
                ...node,
                data: {
                  ...node.data,
                  triggerData: {
                    ...node.data.triggerData,
                    schedule: e.target.value
                  }
                }
              });
            }}
            className="w-full p-2 rounded border border-border bg-background text-sm"
            placeholder="0 9 * * *"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Action node configuration component
 */
function ActionNodeConfig({ node, onUpdate }: { node: WorkflowNodeType; onUpdate: (node: WorkflowNodeType) => void }) {
  const { t } = useTranslation('workflow');

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1">
          {t('workflow:node.actionType')}
        </label>
        <select
          value={node.data.actionData?.actionType}
          onChange={(e) => {
            onUpdate({
              ...node,
              data: {
                ...node.data,
                actionData: {
                  ...node.data.actionData,
                  actionType: e.target.value as any
                }
              }
            });
          }}
          className="w-full p-2 rounded border border-border bg-background text-sm"
        >
          <option value="create-task">{t('workflow:node.actions.createTask')}</option>
          <option value="run-agent">{t('workflow:node.actions.runAgent')}</option>
          <option value="send-notification">{t('workflow:node.actions.sendNotification')}</option>
          <option value="execute-command">{t('workflow:node.actions.executeCommand')}</option>
          <option value="call-api">{t('workflow:node.actions.callApi')}</option>
        </select>
      </div>

      {node.data.actionData?.actionType === 'create-task' && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1">
            {t('workflow:node.taskTitle')}
          </label>
          <input
            type="text"
            value={node.data.actionData?.taskTitle || ''}
            onChange={(e) => {
              onUpdate({
                ...node,
                data: {
                  ...node.data,
                  actionData: {
                    ...node.data.actionData,
                    taskTitle: e.target.value
                  }
                }
              });
            }}
            className="w-full p-2 rounded border border-border bg-background text-sm"
            />
        </div>
      )}

      {node.data.actionData?.actionType === 'send-notification' && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1">
            {t('workflow:node.notificationMessage')}
          </label>
          <textarea
            value={node.data.actionData?.notificationMessage || ''}
            onChange={(e) => {
              onUpdate({
                ...node,
                data: {
                  ...node.data,
                  actionData: {
                    ...node.data.actionData,
                    notificationMessage: e.target.value
                  }
                }
              });
            }}
            className="w-full p-2 rounded border border-border bg-background text-sm min-h-[60px]"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Condition node configuration component
 */
function ConditionNodeConfig({ node, onUpdate }: { node: WorkflowNodeType; onUpdate: (node: WorkflowNodeType) => void }) {
  const { t } = useTranslation('workflow');

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1">
          {t('workflow:node.operator')}
        </label>
        <select
          value={node.data.conditionData?.operator}
          onChange={(e) => {
            onUpdate({
              ...node,
              data: {
                ...node.data,
                conditionData: {
                  ...node.data.conditionData,
                  operator: e.target.value as any
                }
              }
            });
          }}
          className="w-full p-2 rounded border border-border bg-background text-sm"
        >
          <option value="equals">{t('workflow:node.operators.equals')}</option>
          <option value="not-equals">{t('workflow:node.operators.notEquals')}</option>
          <option value="contains">{t('workflow:node.operators.contains')}</option>
          <option value="not-contains">{t('workflow:node.operators.notContains')}</option>
          <option value="greater-than">{t('workflow:node.operators.greaterThan')}</option>
          <option value="less-than">{t('workflow:node.operators.lessThan')}</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1">
          {t('workflow:node.field')}
        </label>
        <input
          type="text"
          value={node.data.conditionData?.field || ''}
          onChange={(e) => {
            onUpdate({
              ...node,
              data: {
                ...node.data,
                conditionData: {
                  ...node.data.conditionData,
                  field: e.target.value
                }
              }
            });
          }}
          className="w-full p-2 rounded border border-border bg-background text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1">
          {t('workflow:node.value')}
        </label>
        <input
          type="text"
          value={node.data.conditionData?.value || ''}
          onChange={(e) => {
            onUpdate({
              ...node,
              data: {
                ...node.data,
                conditionData: {
                  ...node.data.conditionData,
                  value: e.target.value
                }
              }
            });
          }}
          className="w-full p-2 rounded border border-border bg-background text-sm"
        />
      </div>
    </div>
  );
}

/**
 * Delay node configuration component
 */
function DelayNodeConfig({ node, onUpdate }: { node: WorkflowNodeType; onUpdate: (node: WorkflowNodeType) => void }) {
  const { t } = useTranslation('workflow');

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1">
          {t('workflow:node.duration')}
        </label>
        <input
          type="number"
          value={node.data.delayData?.duration || 5}
          onChange={(e) => {
            onUpdate({
              ...node,
              data: {
                ...node.data,
                delayData: {
                  ...node.data.delayData,
                  duration: parseInt(e.target.value) || 5
                }
              }
            });
          }}
          className="w-full p-2 rounded border border-border bg-background text-sm"
          min="0"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1">
          {t('workflow:node.unit')}
        </label>
        <select
          value={node.data.delayData?.unit || 'seconds'}
          onChange={(e) => {
            onUpdate({
              ...node,
              data: {
                ...node.data,
                delayData: {
                  ...node.data.delayData,
                  unit: e.target.value
                }
              }
            });
          }}
          className="w-full p-2 rounded border border-border bg-background text-sm"
        >
          <option value="seconds">{t('workflow:node.units.seconds')}</option>
          <option value="minutes">{t('workflow:node.units.minutes')}</option>
          <option value="hours">{t('workflow:node.units.hours')}</option>
          <option value="days">{t('workflow:node.units.days')}</option>
        </select>
      </div>
    </div>
  );
}
