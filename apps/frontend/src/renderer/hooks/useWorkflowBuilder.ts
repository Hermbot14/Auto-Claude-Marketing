import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkflowStore } from '../stores/workflowStore';
import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  ValidationResult,
  CanvasState,
  NodePaletteItem
} from '../../shared/types/workflow';

/**
 * React hook for workflow builder functionality
 *
 * Provides state management and helper methods for building visual workflows
 */
export function useWorkflowBuilder(workflowId?: string) {
  const store = useWorkflowStore();

  /**
   * Local state for drag operations
   */
  const [draggedNode, setDraggedNode] = useState<NodePaletteItem | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<string | null>(null);

  /**
   * Load workflow on mount
   */
  useEffect(() => {
    if (workflowId) {
      store.loadWorkflow(workflowId);
    }
  }, [workflowId]);

  /**
   * Computed: Get selected nodes
   */
  const selectedNodes = useMemo(() => {
    if (!store.currentWorkflow) return [];
    return store.currentWorkflow.nodes.filter(n =>
      store.canvasState.selectedNodeIds.includes(n.id)
    );
  }, [store.currentWorkflow, store.canvasState.selectedNodeIds]);

  /**
   * Computed: Get selected edges
   */
  const selectedEdges = useMemo(() => {
    if (!store.currentWorkflow) return [];
    return store.currentWorkflow.edges.filter(e =>
      store.canvasState.selectedEdgeIds.includes(e.id)
    );
  }, [store.currentWorkflow, store.canvasState.selectedEdgeIds]);

  /**
   * Computed: Check if workflow is empty
   */
  const isEmpty = useMemo(() => {
    return !store.currentWorkflow ||
           store.currentWorkflow.nodes.length === 0;
  }, [store.currentWorkflow]);

  /**
   * Computed: Get node palette items
   */
  const nodePalette = useMemo((): NodePaletteItem[] => {
    return [
      {
        type: 'trigger',
        label: 'Manual Trigger',
        description: 'Start workflow manually',
        icon: 'Play',
        category: 'trigger',
        defaultConfig: {
          id: `trigger-${Date.now()}`,
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: {
            label: 'Manual Trigger',
            icon: 'Play',
            parameters: {},
            triggerData: { triggerType: 'manual' }
          }
        }
      },
      {
        type: 'trigger',
        label: 'Schedule Trigger',
        description: 'Start on a schedule',
        icon: 'Clock',
        category: 'trigger',
        defaultConfig: {
          id: `trigger-${Date.now()}`,
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: {
            label: 'Schedule Trigger',
            icon: 'Clock',
            parameters: {},
            triggerData: { triggerType: 'schedule', schedule: '0 9 * * *' }
          }
        }
      },
      {
        type: 'trigger',
        label: 'Webhook Trigger',
        description: 'Start on HTTP request',
        icon: 'Webhook',
        category: 'trigger',
        defaultConfig: {
          id: `trigger-${Date.now()}`,
          type: 'trigger',
          position: { x: 100, y: 100 },
          data: {
            label: 'Webhook',
            icon: 'Webhook',
            parameters: {},
            triggerData: { triggerType: 'webhook', webhookPath: '/webhook' }
          }
        }
      },
      {
        type: 'action',
        label: 'Create Task',
        description: 'Create a new task',
        icon: 'Plus',
        category: 'action',
        defaultConfig: {
          id: `action-${Date.now()}`,
          type: 'action',
          position: { x: 100, y: 100 },
          data: {
            label: 'Create Task',
            icon: 'Plus',
            parameters: {},
            actionData: { actionType: 'create-task' }
          }
        }
      },
      {
        type: 'action',
        label: 'Run Agent',
        description: 'Execute an AI agent',
        icon: 'Bot',
        category: 'action',
        defaultConfig: {
          id: `action-${Date.now()}`,
          type: 'action',
          position: { x: 100, y: 100 },
          data: {
            label: 'Run Agent',
            icon: 'Bot',
            parameters: {},
            actionData: { actionType: 'run-agent', agentType: 'coder' }
          }
        }
      },
      {
        type: 'action',
        label: 'Send Notification',
        description: 'Send a notification',
        icon: 'Bell',
        category: 'action',
        defaultConfig: {
          id: `action-${Date.now()}`,
          type: 'action',
          position: { x: 100, y: 100 },
          data: {
            label: 'Send Notification',
            icon: 'Bell',
            parameters: {},
            actionData: { actionType: 'send-notification' }
          }
        }
      },
      {
        type: 'condition',
        label: 'Condition',
        description: 'Branch based on criteria',
        icon: 'GitBranch',
        category: 'flow-control',
        defaultConfig: {
          id: `condition-${Date.now()}`,
          type: 'condition',
          position: { x: 100, y: 100 },
          data: {
            label: 'Condition',
            icon: 'GitBranch',
            parameters: {},
            conditionData: {
              operator: 'equals',
              field: 'status',
              value: 'success'
            }
          }
        }
      },
      {
        type: 'loop',
        label: 'Loop',
        description: 'Repeat actions',
        icon: 'Repeat',
        category: 'flow-control',
        defaultConfig: {
          id: `loop-${Date.now()}`,
          type: 'loop',
          position: { x: 100, y: 100 },
          data: {
            label: 'Loop',
            icon: 'Repeat',
            parameters: {},
            loopData: { loopType: 'for-each', maxIterations: 10 }
          }
        }
      },
      {
        type: 'delay',
        label: 'Delay',
        description: 'Wait before continuing',
        icon: 'Clock',
        category: 'flow-control',
        defaultConfig: {
          id: `delay-${Date.now()}`,
          type: 'delay',
          position: { x: 100, y: 100 },
          data: {
            label: 'Delay',
            icon: 'Clock',
            parameters: {},
            delayData: { duration: 5, unit: 'minutes' }
          }
        }
      },
      {
        type: 'output',
        label: 'Output',
        description: 'End workflow',
        icon: 'CheckCircle',
        category: 'action',
        defaultConfig: {
          id: `output-${Date.now()}`,
          type: 'output',
          position: { x: 100, y: 100 },
          data: {
            label: 'Output',
            icon: 'CheckCircle',
            parameters: {}
          }
        }
      }
    ];
  }, []);

  /**
   * Add a node from the palette
   */
  const addNodeFromPalette = useCallback((item: NodePaletteItem, position: { x: number; y: number }) => {
    if (!item.defaultConfig) return;

    const node: WorkflowNode = {
      ...item.defaultConfig,
      id: `${item.type}-${Date.now()}`,
      position
    };

    store.addNode(node);
  }, [store]);

  /**
   * Update node position
   */
  const updateNodePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    store.updateNode(nodeId, { position });
  }, [store]);

  /**
   * Delete selected nodes
   */
  const deleteSelectedNodes = useCallback(() => {
    for (const nodeId of store.canvasState.selectedNodeIds) {
      store.deleteNode(nodeId);
    }
  }, [store]);

  /**
   * Delete selected edges
   */
  const deleteSelectedEdges = useCallback(() => {
    for (const edgeId of store.canvasState.selectedEdgeIds) {
      store.deleteEdge(edgeId);
    }
  }, [store]);

  /**
   * Delete all selected items
   */
  const deleteSelected = useCallback(() => {
    deleteSelectedNodes();
    deleteSelectedEdges();
  }, [deleteSelectedNodes, deleteSelectedEdges]);

  /**
   * Duplicate selected nodes
   */
  const duplicateSelectedNodes = useCallback(() => {
    const offsetX = 50;
    const offsetY = 50;

    for (const nodeId of store.canvasState.selectedNodeIds) {
      const node = store.currentWorkflow?.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      const duplicated: WorkflowNode = {
        ...node,
        id: `${node.type}-${Date.now()}`,
        position: {
          x: node.position.x + offsetX,
          y: node.position.y + offsetY
        }
      };

      store.addNode(duplicated);
    }
  }, [store.currentWorkflow, store.canvasState.selectedNodeIds, store]);

  /**
   * Select all nodes
   */
  const selectAllNodes = useCallback(() => {
    if (!store.currentWorkflow) return;
    const allNodeIds = store.currentWorkflow.nodes.map(n => n.id);
    store.setSelectedNodes(allNodeIds);
  }, [store.currentWorkflow]);

  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    store.setSelectedNodes([]);
    store.setSelectedEdges([]);
  }, [store]);

  /**
   * Create connection between nodes
   */
  const createConnection = useCallback((sourceId: string, targetId: string) => {
    // Prevent duplicate connections
    const exists = store.currentWorkflow?.edges.some(
      e => e.source === sourceId && e.target === targetId
    );
    if (exists) return;

    const edge: WorkflowEdge = {
      id: `edge-${Date.now()}`,
      source: sourceId,
      target: targetId,
      type: 'default',
      animated: false
    };

    store.addEdge(edge);
  }, [store.currentWorkflow, store]);

  /**
   * Update canvas zoom
   */
  const setZoom = useCallback((zoom: number) => {
    store.setCanvasState({ zoom: Math.max(0.1, Math.min(3, zoom)) });
  }, [store]);

  /**
   * Update canvas pan
   */
  const setPan = useCallback((pan: { x: number; y: number }) => {
    store.setCanvasState({ pan });
  }, [store]);

  /**
   * Reset canvas view
   */
  const resetView = useCallback(() => {
    store.setCanvasState({
      zoom: 1,
      pan: { x: 0, y: 0 }
    });
  }, [store]);

  /**
   * Fit all nodes in view
   */
  const fitView = useCallback(() => {
    if (!store.currentWorkflow || store.currentWorkflow.nodes.length === 0) {
      resetView();
      return;
    }

    // Calculate bounding box of all nodes
    const nodes = store.currentWorkflow.nodes;
    const minX = Math.min(...nodes.map(n => n.position.x));
    const minY = Math.min(...nodes.map(n => n.position.y));
    const maxX = Math.max(...nodes.map(n => n.position.x + 200)); // Approximate width
    const maxY = Math.max(...nodes.map(n => n.position.y + 100)); // Approximate height

    const width = maxX - minX + 200;
    const height = maxY - minY + 100;

    // Calculate zoom to fit with padding
    const containerWidth = window.innerWidth - 300; // Subtract sidebar width
    const containerHeight = window.innerHeight - 100;

    const zoomX = containerWidth / width;
    const zoomY = containerHeight / height;
    const zoom = Math.min(zoomX, zoomY, 1.5);

    // Calculate pan to center
    const pan = {
      x: -(minX * zoom - (containerWidth - width * zoom) / 2),
      y: -(minY * zoom - (containerHeight - height * zoom) / 2)
    };

    store.setCanvasState({ zoom, pan });
  }, [store.currentWorkflow, resetView]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Check if we're in an input field
    const target = event.target as HTMLElement;
    if (target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.contentEditable === 'true') {
      return;
    }

    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        deleteSelected();
        break;

      case 'z':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          // Undo would be implemented with a history manager
          console.log('[WorkflowBuilder] Undo triggered');
        }
        break;

      case 'y':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          // Redo would be implemented with a history manager
          console.log('[WorkflowBuilder] Redo triggered');
        }
        break;

      case 's':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          store.saveWorkflow();
        }
        break;

      case 'a':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          selectAllNodes();
        }
        break;

      case 'd':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          duplicateSelectedNodes();
        }
        break;

      case '=':
      case '+':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          setZoom(store.canvasState.zoom * 1.1);
        }
        break;

      case '-':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          setZoom(store.canvasState.zoom * 0.9);
        }
        break;

      case '0':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          resetView();
        }
        break;

      case 'Escape':
        event.preventDefault();
        clearSelection();
        break;
    }
  }, [
    store.canvasState,
    deleteSelected,
    duplicateSelectedNodes,
    selectAllNodes,
    clearSelection,
    resetView,
    setZoom
  ]);

  /**
   * Export workflow as JSON
   */
  const exportAsJSON = useCallback((): string | null => {
    return store.exportWorkflow('json');
  }, [store]);

  /**
   * Export workflow as YAML
   */
  const exportAsYAML = useCallback((): string | null => {
    return store.exportWorkflow('yaml');
  }, [store]);

  /**
   * Import workflow from data
   */
  const importWorkflow = useCallback((data: string): boolean => {
    return store.importWorkflow(data);
  }, [store]);

  /**
   * Save current workflow
   */
  const saveWorkflow = useCallback((): boolean => {
    store.validateWorkflow();
    if (store.isValid) {
      return store.saveWorkflow();
    }
    return false;
  }, [store]);

  return {
    // State
    workflow: store.currentWorkflow,
    selectedNodes,
    selectedEdges,
    isEmpty,
    isValid: store.isValid,
    isExecuting: store.isExecuting,
    canvasState: store.canvasState,
    nodePalette,
    draggedNode,
    isConnecting,
    connectionStart,

    // Actions
    addNode: store.addNode,
    addNodeFromPalette,
    updateNode: store.updateNode,
    updateNodePosition,
    deleteNode: store.deleteNode,
    deleteSelectedNodes,
    deleteSelectedEdges,
    deleteSelected,
    duplicateSelectedNodes,
    selectAllNodes,
    clearSelection,
    addEdge: store.addEdge,
    deleteEdge: store.deleteEdge,
    deleteSelectedEdges,
    createConnection,
    setZoom,
    setPan,
    resetView,
    fitView,
    setDraggedNode,
    setIsConnecting,
    setConnectionStart,
    handleKeyDown,
    exportAsJSON,
    exportAsYAML,
    importWorkflow,
    saveWorkflow,
    validate: store.validateWorkflow,
    execute: store.executeWorkflow,
    stopExecution: store.stopExecution
  };
}

/**
 * Hook for workflow validation
 */
export function useWorkflowValidation(workflow: Workflow | null) {
  const [results, setResults] = useState<ValidationResult[]>([]);

  const validate = useCallback(() => {
    if (!workflow) {
      setResults([]);
      return;
    }

    const errors: ValidationResult[] = [];

    // Check for nodes
    if (workflow.nodes.length === 0) {
      errors.push({
        id: 'no-nodes',
        type: 'error',
        message: 'Workflow must have at least one node',
        fix: 'Add a trigger or action node'
      });
    }

    // Check for trigger nodes
    const hasTrigger = workflow.nodes.some(n => n.type === 'trigger');
    if (!hasTrigger) {
      errors.push({
        id: 'no-trigger',
        type: 'error',
        message: 'Workflow must have at least one trigger node',
        fix: 'Add a trigger node (manual, schedule, webhook, or event)'
      });
    }

    // Check for disconnected nodes
    const connectedNodeIds = new Set<string>();
    workflow.edges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    workflow.nodes.forEach(node => {
      if (!connectedNodeIds.has(node.id)) {
        errors.push({
          id: `disconnected-${node.id}`,
          type: 'warning',
          nodeId: node.id,
          message: `Node "${node.data.label}" is not connected`,
          fix: 'Connect this node to the workflow or remove it'
        });
      }
    });

    // Check for circular references
    const checkForCircular = (nodeId: string, visited = new Set<string>()): boolean => {
      if (visited.has(nodeId)) return true;
      visited.add(nodeId);

      const outgoingEdges = workflow.edges.filter(e => e.source === nodeId);
      for (const edge of outgoingEdges) {
        if (checkForCircular(edge.target, new Set(visited))) {
          return true;
        }
      }
      return false;
    };

    const triggerNodes = workflow.nodes.filter(n => n.type === 'trigger');
    for (const trigger of triggerNodes) {
      if (checkForCircular(trigger.id)) {
        errors.push({
          id: `circular-${trigger.id}`,
          type: 'error',
          nodeId: trigger.id,
          message: 'Circular reference detected',
          fix: 'Remove the circular connection in the workflow'
        });
      }
    }

    // Validate node configurations
    workflow.nodes.forEach(node => {
      if (!node.data.label) {
        errors.push({
          id: `no-label-${node.id}`,
          type: 'error',
          nodeId: node.id,
          message: 'Node must have a label',
          fix: 'Add a label to this node'
        });
      }

      // Type-specific validation
      if (node.type === 'condition' && !node.data.conditionData?.operator) {
        errors.push({
          id: `invalid-condition-${node.id}`,
          type: 'error',
          nodeId: node.id,
          message: 'Condition node must have an operator',
          fix: 'Configure the condition operator'
        });
      }

      if (node.type === 'action' && !node.data.actionData?.actionType) {
        errors.push({
          id: `invalid-action-${node.id}`,
          type: 'error',
          nodeId: node.id,
          message: 'Action node must have an action type',
          fix: 'Select an action type for this node'
        });
      }

      if (node.type === 'delay' && !node.data.delayData?.duration) {
        errors.push({
          id: `invalid-delay-${node.id}`,
          type: 'error',
          nodeId: node.id,
          message: 'Delay node must have a duration',
          fix: 'Set the duration for the delay'
        });
      }
    });

    setResults(errors);
  }, [workflow]);

  // Auto-validate on workflow change
  useEffect(() => {
    validate();
  }, [workflow, validate]);

  return {
    results,
    isValid: results.every(r => r.type !== 'error'),
    hasErrors: results.some(r => r.type === 'error'),
    hasWarnings: results.some(r => r.type === 'warning'),
    errorCount: results.filter(r => r.type === 'error').length,
    warningCount: results.filter(r => r.type === 'warning').length,
    validate,
    clearResults: () => setResults([])
  };
}
