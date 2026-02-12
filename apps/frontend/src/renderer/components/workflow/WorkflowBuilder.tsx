import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Save,
  Play,
  Square,
  Trash2,
  Plus,
  Settings
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { useWorkflowBuilder } from '../../hooks/useWorkflowBuilder';
import { cn } from '../../../shared/lib/utils';
import { WorkflowNode as WorkflowNodeComponent } from './WorkflowNode';
import { WorkflowEdge as WorkflowEdgeComponent } from './WorkflowEdge';

/**
 * WorkflowBuilder - Visual canvas-based workflow editor
 *
 * Provides a drag-and-drop interface for building workflows with:
 * - Infinite pan/zoom canvas
 * - Node palette with draggable items
 * - Connection management
 * - Real-time validation
 * - Keyboard shortcuts
 */
export function WorkflowBuilder({
  workflow,
  onWorkflowChange,
  readOnly = false,
  templates = [],
  onExecute,
  onSave,
  onExport
}: {
  workflow: Workflow;
  onWorkflowChange: (workflow: Workflow) => void;
  readOnly?: boolean;
  templates?: typeof templates;
  onExecute?: (workflowId: string) => void;
  onSave?: (workflow: Workflow) => void;
  onExport?: (workflow: Workflow, format: 'json' | 'yaml') => void;
}) {
  const { t } = useTranslation(['workflow', 'common']);
  const {
    workflow: currentWorkflow,
    isEmpty,
    isValid,
    nodePalette,
    addNodeFromPalette,
    updateNodePosition,
    deleteSelected,
    duplicateSelectedNodes,
    clearSelection,
    createConnection,
    setZoom,
    resetView,
    fitView,
    handleKeyDown,
    exportAsJSON,
    saveWorkflow,
    validate,
    execute,
    stopExecution,
    canvasState
  } = useWorkflowBuilder(workflow.id);

  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNodeType, setDraggedNodeType] = useState<string | null>(null);

  /**
   * Handle drag start from palette
   */
  const handleDragStart = useCallback((e: React.DragEvent, nodeType: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ nodeType }));
    setDraggedNodeType(nodeType);
    setIsDragging(true);
  }, []);

  /**
   * Handle drag over canvas
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  /**
   * Handle drop on canvas
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();

    if (!containerRef) return;

    const rect = containerRef.getBoundingClientRect();
    const x = e.clientX - rect.left - canvasState.pan.x;
    const y = e.clientY - rect.top - canvasState.pan.y;

    // Adjust for zoom
    const adjustedX = x / canvasState.zoom;
    const adjustedY = y / canvasState.zoom;

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const item = nodePalette.find(n => n.type === data.nodeType);

      if (item) {
        addNodeFromPalette(item, {
          x: adjustedX - 75,
          y: adjustedY - 25
        });
      }
    } catch (error) {
      console.error('[WorkflowBuilder] Failed to parse drop data:', error);
    }

    setDraggedNodeType(null);
    setIsDragging(false);
  }, [nodePalette, addNodeFromPalette, canvasState]);

  /**
   * Handle mouse move for panning
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.workflow-node, .node-palette-item, .zoom-control, .toolbar-button')) {
      return;
    }

    const startX = e.clientX - canvasState.pan.x;
    const startY = e.clientY - canvasState.pan.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newX = moveEvent.clientX - startX;
      const newY = moveEvent.clientY - startY;

      setPan({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [canvasState.pan]);

  /**
   * Set pan with memoized update
   */
  const setPan = useCallback(({ x, y }: { x: number; y: number }) => {
    onWorkflowChange({
      ...workflow,
      nodes: workflow.nodes.map(n => ({
        ...n,
        position: {
          x: n.position.x + x,
          y: n.position.y + y
        }
      }))
    });
  }, [workflow, onWorkflowChange]);

  /**
   * Handle keyboard shortcuts
   */
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /**
   * Handle template selection
   */
  const handleSelectTemplate = useCallback((template: typeof templates[0]) => {
    onWorkflowChange(template.workflow);
  }, [onWorkflowChange]);

  /**
   * Handle save with validation
   */
  const handleSave = useCallback(() => {
    validate();
    if (isValid) {
      saveWorkflow();
    }
  }, [validate, isValid, saveWorkflow]);

  /**
   * Handle export with format selection
   */
  const handleExport = useCallback((format: 'json' | 'yaml') => {
    if (onExport) {
      onExport(workflow, format);
    }
  }, [onExport, workflow]);

  /**
   * Background grid pattern
   */
  const gridPattern = useMemo(() => {
    const size = 20;
    return `radial-gradient(circle, ${size} ${size}, transparent 50%)`;
  }, []);

  /**
   * Transform style for canvas content
   */
  const getCanvasTransform = useCallback(() => {
    return {
      transform: `scale(${canvasState.zoom}) translate(${canvasState.pan.x}px, ${canvasState.pan.y}px)`,
      transformOrigin: '0 0'
    };
  }, [canvasState]);

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            {workflow.name}
          </h2>
          {workflow.description && (
            <span className="text-sm text-muted-foreground ml-2">
              {workflow.description}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 border-r border-border pr-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom(canvasState.zoom * 0.9)}
              className="zoom-control"
              disabled={readOnly}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom(canvasState.zoom * 1.1)}
              className="zoom-control"
              disabled={readOnly}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={resetView}
              className="zoom-control"
              disabled={readOnly}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground ml-1">
              {Math.round(canvasState.zoom * 100)}%
            </span>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Actions */}
          {!readOnly && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={isEmpty}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {t('workflow:actions.save')}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={validate}
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                {t('workflow:actions.validate')}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('json')}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {t('workflow:actions.export')}
              </Button>

              <Button
                size="sm"
                onClick={execute}
                disabled={!isValid}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                {t('workflow:actions.execute')}
              </Button>
            </div>
          )}

          {readOnly && (
            <div className="text-sm text-muted-foreground">
              {t('workflow:readOnly')}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Node palette */}
        <div className="w-48 border-r border-border bg-muted/20 flex flex-col">
          <div className="p-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              {t('workflow:palette.title')}
            </h3>
          </div>

          <ScrollArea className="flex-1 p-2">
            <div className="space-y-1">
              {nodePalette.map((item) => (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.type)}
                  onDragEnd={() => {
                    setIsDragging(false);
                    setDraggedNodeType(null);
                  }}
                  className={cn(
                    'node-palette-item flex items-center gap-2 rounded-lg p-2 cursor-grab transition-colors hover:bg-accent/50',
                    isDragging && draggedNodeType === item.type && 'opacity-50'
                  )}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Templates section */}
          {templates.length > 0 && (
            <>
              <div className="p-3 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  {t('workflow:templates.title')}
                </h3>
              </div>

              <ScrollArea className="max-h-48 p-2">
                <div className="space-y-1">
                  {templates.slice(0, 3).map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="w-full text-left p-2 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {template.name}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                    </button>
                  ))}
                  {templates.length > 3 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => onWorkflowChange({
                        ...workflow,
                        id: `workflow-${Date.now()}`,
                        name: 'Untitled Workflow',
                        nodes: [],
                        edges: [],
                        metadata: {
                          created: new Date().toISOString(),
                          modified: new Date().toISOString(),
                          version: '1.0.0'
                        },
                        status: 'draft'
                      })}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t('workflow:templates.create')}
                    </Button>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        {/* Canvas */}
        <div
          ref={setContainerRef}
          onMouseDown={handleMouseDown}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={clearSelection}
          className="flex-1 relative overflow-hidden bg-muted/30 cursor-move"
          style={{
            cursor: readOnly ? 'default' : 'grab'
          }}
        >
          {/* Validation overlay */}
          {!isValid && currentWorkflow.nodes.length > 0 && (
            <div className="absolute top-4 left-4 z-10 bg-destructive/90 text-destructive px-4 py-2 rounded-lg">
              <p className="text-sm font-medium">
                {t('workflow:validation.errorsExist')}
              </p>
            </div>
          )}

          {/* Canvas background with grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: gridPattern,
              backgroundSize: '40px 40px'
            }}
          />

          {/* Workflow nodes */}
          <div
            className="absolute inset-0"
            style={getCanvasTransform()}
          >
            {currentWorkflow.nodes.map((node) => (
              <WorkflowNodeComponent
                key={node.id}
                node={node}
                workflow={workflow}
                onUpdate={(updates) => {
                  onWorkflowChange({
                    ...workflow,
                    nodes: workflow.nodes.map(n =>
                      n.id === node.id ? { ...n, ...updates } : n
                    )
                  });
                }}
                onDelete={() => {
                  onWorkflowChange({
                    ...workflow,
                    nodes: workflow.nodes.filter(n => n.id !== node.id),
                    edges: workflow.edges.filter(e =>
                      e.source !== node.id && e.target !== node.id
                    )
                  });
                }}
                readOnly={readOnly}
              />
            ))}

            {/* Workflow edges - SVG connections */}
            <svg className="absolute inset-0 pointer-events-none" style={getCanvasTransform()}>
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <path
                    d="M0 0L10 3.5L0 7L10 3.5"
                    fill="#6b7280"
                    fillOpacity="0.5"
                  />
                </marker>
              </defs>

              {currentWorkflow.edges.map((edge) => (
                <WorkflowEdgeComponent
                  key={edge.id}
                  edge={edge}
                  workflow={workflow}
                  onDelete={() => {
                    onWorkflowChange({
                      ...workflow,
                      edges: workflow.edges.filter(e => e.id !== edge.id)
                    });
                  }}
                  readOnly={readOnly}
                />
              ))}
            </svg>
          </div>

          {/* Empty state */}
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center max-w-md p-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-4">
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10 5z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  {t('workflow:empty.title')}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {t('workflow:empty.description')}
                </p>
                <Button
                  size="lg"
                  onClick={() => {
                    const firstNode = nodePalette.find(n => n.type === 'trigger');
                    if (firstNode) {
                      addNodeFromPalette(firstNode, { x: 200, y: 100 });
                    }
                  }}
                  className="gap-2"
                >
                  <Plus className="h-5 w-5" />
                  {t('workflow:empty.createFirstNode')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>{t('workflow:status.nodes', { count: currentWorkflow.nodes.length })}</span>
            <span>{t('workflow:status.edges', { count: currentWorkflow.edges.length })}</span>
            <span>
              {t('workflow:status.zoom', { level: Math.round(canvasState.zoom * 100) })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!readOnly && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">{t('workflow:status.dragNodes')}</span>
                <kbd className="ml-2">Drag to add</kbd>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
