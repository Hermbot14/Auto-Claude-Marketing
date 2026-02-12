import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkflowNode, WorkflowEdge as WorkflowEdgeType } from '../../../shared/types/workflow';
import { cn } from '../../../shared/lib/utils';

/**
 * WorkflowEdge - Visual connection between workflow nodes
 *
 * Renders Bezier curve connections between nodes with:
 * - Smooth animations
 * - Selection state
 * - Delete capability
 * - Different styles for edge types
 * - Label display
 */
interface WorkflowEdgeProps {
  edge: WorkflowEdgeType;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (edge: WorkflowEdgeType) => void;
  onDelete: () => void;
  sourceNode: WorkflowNode;
  targetNode: WorkflowNode;
  readOnly?: boolean;
}

export const WorkflowEdge = memo(function WorkflowEdge({
  edge,
  selected,
  onSelect,
  onUpdate,
  onDelete,
  sourceNode,
  targetNode,
  readOnly = false
}: WorkflowEdgeProps) {
  const { t } = useTranslation(['workflow', 'common']);

  /**
   * Handle selection toggle
   */
  const handleClick = useCallback(() => {
    if (!readOnly) {
      onSelect();
    }
  }, [onSelect, readOnly]);

  return (
    <g
      className={cn(
        'workflow-edge',
        selected && 'selected',
        edge.type === 'error' && 'edge-error'
      )}
      onClick={handleClick}
      style={{ cursor: readOnly ? 'default' : 'pointer' }}
    >
      {/* Invisible hit area for easier clicking */}
      <path
        d={getBezierPath(
          sourceNode.position.x + (sourceNode.data?.icon ? 25 : 75),
          sourceNode.position.y + (sourceNode.data?.icon ? 25 : 40),
          targetNode.position.x + (targetNode.data?.icon ? 25 : 75),
          targetNode.position.y + (targetNode.data?.icon ? 25 : 40)
        )}
        stroke={getEdgeColor(edge.type)}
        strokeWidth={getEdgeWidth(edge.type)}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="transition-all duration-200"
      />

      {/* Animated edge for flow indication */}
      {edge.animated && (
        <circle
          r="4"
          cx="50%"
          cy="50%"
          fill="none"
          stroke={getEdgeColor(edge.type)}
          strokeWidth="2"
          className="animate-flow-dot"
        >
          <animate
            attributeName="opacity"
            from="0"
            to="1"
            dur="1s"
            repeatCount="indefinite"
            key={edge.id}
          />
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="1"
            dur="1.5s"
            repeatCount="indefinite"
            key={edge.id}
          />
        </circle>
      )}

      {/* Edge label */}
      {edge.label && (
        <foreignObject
          x={(sourceNode.position.x + targetNode.position.x) / 2}
          y={(sourceNode.position.y + targetNode.position.y + 40) / 2}
          width={Math.abs(targetNode.position.x - sourceNode.position.x)}
          height={1}
          style={{ overflow: 'visible' }}
        >
          <rect
            x={-20}
            y={-10}
            width={Math.abs(targetNode.position.x - sourceNode.position.x) + 40}
            height={20}
            fill="rgba(0,0,0,0.7)"
            rx="4"
            ry="4"
          />
          <text
            x="0"
            y="4"
            textAnchor="middle"
            fontSize="10"
            dy="4"
            fill={getEdgeTextColor()}
            className="pointer-events-none select-none"
          >
            {edge.label}
          </text>
        </foreignObject>
      )}
    </g>
  );
});

/**
 * Get Bezier path for edge connection
 */
function getBezierPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): string {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Control point offset for curvature
  const offset = 50;

  // Calculate control points
  const cp1x = sourceX + (dx / distance) * offset;
  const cp1y = sourceY + (dy / distance) * offset;
  const cp2x = targetX - (dx / distance) * offset;
  const cp2y = targetY - (dy / distance) * offset;

  // Calculate curve
  return `M ${sourceX},${sourceY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${targetX},${targetY}`;
}

/**
 * Get edge color based on type
 */
function getEdgeColor(type: string): string {
  const colorMap: Record<string, string> = {
    'default': 'stroke-border dark:stroke-border',
    'success': 'stroke-green-500 dark:stroke-green-600',
    'error': 'stroke-destructive dark:stroke-destructive',
    'conditional': 'stroke-purple-500 dark:stroke-purple-600'
  };

  return colorMap[type] || colorMap.default;
}

/**
 * Get edge width based on type
 */
function getEdgeWidth(type: string): number {
  const widthMap: Record<string, number> = {
    'default': 2,
    'success': 3,
    'error': 2,
    'conditional': 2
  };

  return widthMap[type] || widthMap.default;
}

/**
 * Get edge text color based on type
 */
function getEdgeTextColor(): string {
  return 'text-muted-foreground dark:text-muted-foreground';
}
