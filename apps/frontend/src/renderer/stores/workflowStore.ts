import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowTemplate,
  WorkflowStatus,
  NodeStatus,
  ValidationResult,
  CanvasState,
  WorkflowStats,
  BuiltInTemplate
} from '../../shared/types/workflow';

/**
 * LocalStorage key for workflow state
 */
const WORKFLOW_STORAGE_KEY = 'workflow-state';
const WORKFLOW_TEMPLATES_KEY = 'workflow-templates';

/**
 * Workflow state management store
 *
 * Manages all workflow-related state including:
 * - Current workflow being edited
 * - Canvas state (zoom, pan, selection)
 * - Validation results
 * - Template library
 * - Execution state
 */
export interface WorkflowStore {
  // Current workflow state
  currentWorkflow: Workflow | null;
  workflows: Workflow[];

  // Canvas state
  canvasState: CanvasState;

  // Validation
  validationResults: ValidationResult[];
  isValid: boolean;

  // Templates
  templates: WorkflowTemplate[];

  // Execution
  isExecuting: boolean;
  executionNodeId: string | null;
  executionLogs: Array<{ timestamp: string; level: string; message: string }>;

  // Actions
  setCurrentWorkflow: (workflow: Workflow | null) => void;
  updateWorkflow: (workflow: Partial<Workflow>) => void;
  addNode: (node: WorkflowNode) => void;
  updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  deleteNode: (nodeId: string) => void;
  addEdge: (edge: WorkflowEdge) => void;
  updateEdge: (edgeId: string, updates: Partial<WorkflowEdge>) => void;
  deleteEdge: (edgeId: string) => void;
  setSelectedNodes: (nodeIds: string[]) => void;
  setSelectedEdges: (edgeIds: string[]) => void;
  setCanvasState: (state: Partial<CanvasState>) => void;
  validateWorkflow: () => void;
  saveWorkflow: () => boolean;
  loadWorkflow: (workflowId: string) => boolean;
  deleteWorkflow: (workflowId: string) => void;
  duplicateWorkflow: (workflowId: string) => void;
  executeWorkflow: () => void;
  stopExecution: () => void;
  setTemplate: (template: WorkflowTemplate) => void;
  saveAsTemplate: (name: string, description: string) => void;
  deleteTemplate: (templateId: string) => void;
  importWorkflow: (data: string) => boolean;
  exportWorkflow: (format: 'json' | 'yaml') => string | null;
  reset: () => void;
}

/**
 * Create empty workflow
 */
function createEmptyWorkflow(): Workflow {
  return {
    id: `workflow-${Date.now()}`,
    name: 'Untitled Workflow',
    description: '',
    nodes: [],
    edges: [],
    metadata: {
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: '1.0.0',
      tags: []
    },
    status: 'draft'
  };
}

/**
 * Create initial canvas state
 */
function createInitialCanvasState(): CanvasState {
  return {
    zoom: 1,
    pan: { x: 0, y: 0 },
    selectedNodeIds: [],
    selectedEdgeIds: [],
    clipboardNode: undefined
  };
}

/**
 * Built-in templates library
 */
const BUILTIN_TEMPLATES: BuiltInTemplate[] = [
  {
    id: 'template-auto-task',
    name: 'Auto Task Creation',
    category: 'task-creation',
    description: 'Create and execute a new automated task',
    nodes: [
      {
        id: 'trigger-manual',
        type: 'trigger',
        position: { x: 100, y: 100 },
        data: {
          label: 'Manual Trigger',
          icon: 'Play',
          parameters: {},
          triggerData: { triggerType: 'manual' }
        }
      },
      {
        id: 'action-create-task',
        type: 'action',
        position: { x: 350, y: 100 },
        data: {
          label: 'Create Task',
          icon: 'Plus',
          parameters: {},
          actionData: { actionType: 'create-task', taskTitle: 'New Task' }
        }
      },
      {
        id: 'output-success',
        type: 'output',
        position: { x: 600, y: 100 },
        data: {
          label: 'Success',
          icon: 'CheckCircle',
          parameters: {}
        }
      }
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'trigger-manual',
        target: 'action-create-task'
      },
      {
        id: 'edge-2',
        source: 'action-create-task',
        target: 'output-success'
      }
    ]
  },
  {
    id: 'template-agent-workflow',
    name: 'Multi-Agent Processing',
    category: 'agent-workflow',
    description: 'Run multiple agents in parallel for complex tasks',
    nodes: [
      {
        id: 'trigger-schedule',
        type: 'trigger',
        position: { x: 100, y: 150 },
        data: {
          label: 'Schedule Trigger',
          icon: 'Clock',
          parameters: {},
          triggerData: { triggerType: 'schedule', schedule: '0 9 * * *' }
        }
      },
      {
        id: 'parallel-agents',
        type: 'parallel',
        position: { x: 350, y: 150 },
        data: {
          label: 'Parallel Agents',
          icon: 'GitBranch',
          parameters: {}
        }
      },
      {
        id: 'agent-1',
        type: 'action',
        position: { x: 250, y: 300 },
        data: {
          label: 'Planner Agent',
          icon: 'Bot',
          parameters: {},
          actionData: { actionType: 'run-agent', agentType: 'planner' }
        }
      },
      {
        id: 'agent-2',
        type: 'action',
        position: { x: 450, y: 300 },
        data: {
          label: 'Coder Agent',
          icon: 'Bot',
          parameters: {},
          actionData: { actionType: 'run-agent', agentType: 'coder' }
        }
      },
      {
        id: 'merge-results',
        type: 'merge',
        position: { x: 350, y: 450 },
        data: {
          label: 'Merge Results',
          icon: 'GitMerge',
          parameters: {}
        }
      }
    ],
    edges: [
      { id: 'edge-1', source: 'trigger-schedule', target: 'parallel-agents' },
      { id: 'edge-2', source: 'parallel-agents', target: 'agent-1' },
      { id: 'edge-3', source: 'parallel-agents', target: 'agent-2' },
      { id: 'edge-4', source: 'agent-1', target: 'merge-results' },
      { id: 'edge-5', source: 'agent-2', target: 'merge-results' }
    ]
  },
  {
    id: 'template-notification',
    name: 'Task Completion Notification',
    category: 'notification',
    description: 'Send notification when a task completes',
    nodes: [
      {
        id: 'trigger-event',
        type: 'trigger',
        position: { x: 100, y: 100 },
        data: {
          label: 'Task Complete Event',
          icon: 'Event',
          parameters: {},
          triggerData: { triggerType: 'event', eventType: 'task.completed' }
        }
      },
      {
        id: 'condition-check',
        type: 'condition',
        position: { x: 350, y: 100 },
        data: {
          label: 'Success Check',
          icon: 'GitBranch',
          parameters: {},
          conditionData: {
            operator: 'equals',
            field: 'status',
            value: 'done',
            trueLabel: 'Success',
            falseLabel: 'Failed'
          }
        }
      },
      {
        id: 'action-notify',
        type: 'action',
        position: { x: 600, y: 100 },
        data: {
          label: 'Send Notification',
          icon: 'Bell',
          parameters: {},
          actionData: {
            actionType: 'send-notification',
            notificationMessage: 'Task completed successfully!'
          }
        }
      }
    ],
    edges: [
      { id: 'edge-1', source: 'trigger-event', target: 'condition-check' },
      { id: 'edge-2', source: 'condition-check', target: 'action-notify', condition: 'true' }
    ]
  }
];

export const useWorkflowStore = create<WorkflowStore>()(
  immer((set, get) => ({
    // Initial state
    currentWorkflow: createEmptyWorkflow(),
    workflows: [],
    canvasState: createInitialCanvasState(),
    validationResults: [],
    isValid: false,
    templates: BUILTIN_TEMPLATES.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      workflow: {
        id: t.id,
        name: t.name,
        description: t.description,
        nodes: t.nodes as WorkflowNode[],
        edges: t.edges as WorkflowEdge[],
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          version: '1.0.0'
        },
        status: 'draft'
      },
      tags: [t.category],
      featured: t.id === 'template-auto-task',
      difficulty: 'beginner'
    })),
    isExecuting: false,
    executionNodeId: null,
    executionLogs: [],

    // Actions
    setCurrentWorkflow: (workflow) => set({ currentWorkflow: workflow }),

    updateWorkflow: (updates) => set((state) => {
      if (!state.currentWorkflow) return;

      Object.assign(state.currentWorkflow, updates);
      state.currentWorkflow.metadata.modified = new Date().toISOString();
    }),

    addNode: (node) => set((state) => {
      if (!state.currentWorkflow) return;

      state.currentWorkflow.nodes.push(node);
      state.currentWorkflow.metadata.modified = new Date().toISOString();
      state.canvasState.selectedNodeIds = [node.id];
    }),

    updateNode: (nodeId, updates) => set((state) => {
      if (!state.currentWorkflow) return;

      const nodeIndex = state.currentWorkflow.nodes.findIndex(n => n.id === nodeId);
      if (nodeIndex === -1) return;

      Object.assign(state.currentWorkflow.nodes[nodeIndex], updates);
      state.currentWorkflow.metadata.modified = new Date().toISOString();
    }),

    deleteNode: (nodeId) => set((state) => {
      if (!state.currentWorkflow) return;

      state.currentWorkflow.nodes = state.currentWorkflow.nodes.filter(n => n.id !== nodeId);
      state.currentWorkflow.edges = state.currentWorkflow.edges.filter(
        e => e.source !== nodeId && e.target !== nodeId
      );
      state.currentWorkflow.metadata.modified = new Date().toISOString();
      state.canvasState.selectedNodeIds = state.canvasState.selectedNodeIds.filter(id => id !== nodeId);
    }),

    addEdge: (edge) => set((state) => {
      if (!state.currentWorkflow) return;

      // Check for duplicate edges
      const exists = state.currentWorkflow.edges.some(
        e => e.source === edge.source && e.target === edge.target
      );
      if (exists) return;

      state.currentWorkflow.edges.push(edge);
      state.currentWorkflow.metadata.modified = new Date().toISOString();
    }),

    updateEdge: (edgeId, updates) => set((state) => {
      if (!state.currentWorkflow) return;

      const edgeIndex = state.currentWorkflow.edges.findIndex(e => e.id === edgeId);
      if (edgeIndex === -1) return;

      Object.assign(state.currentWorkflow.edges[edgeIndex], updates);
      state.currentWorkflow.metadata.modified = new Date().toISOString();
    }),

    deleteEdge: (edgeId) => set((state) => {
      if (!state.currentWorkflow) return;

      state.currentWorkflow.edges = state.currentWorkflow.edges.filter(e => e.id !== edgeId);
      state.currentWorkflow.metadata.modified = new Date().toISOString();
      state.canvasState.selectedEdgeIds = state.canvasState.selectedEdgeIds.filter(id => id !== edgeId);
    }),

    setSelectedNodes: (nodeIds) => set((state) => {
      state.canvasState.selectedNodeIds = nodeIds;
    }),

    setSelectedEdges: (edgeIds) => set((state) => {
      state.canvasState.selectedEdgeIds = edgeIds;
    }),

    setCanvasState: (newState) => set((state) => {
      Object.assign(state.canvasState, newState);
    }),

    validateWorkflow: () => set((state) => {
      const results: ValidationResult[] = [];
      const workflow = state.currentWorkflow;

      if (!workflow) {
        state.validationResults = [];
        state.isValid = false;
        return;
      }

      // Validate nodes
      for (const node of workflow.nodes) {
        // Check for required parameters
        if (!node.data.label) {
          results.push({
            id: `node-${node.id}-label`,
            type: 'error',
            nodeId: node.id,
            message: 'Node must have a label',
            fix: 'Add a label to the node'
          });
        }

        // Validate trigger nodes
        if (node.type === 'trigger' && !node.data.triggerData?.triggerType) {
          results.push({
            id: `node-${node.id}-trigger`,
            type: 'error',
            nodeId: node.id,
            message: 'Trigger node must specify a trigger type',
            fix: 'Configure the trigger type (manual, schedule, webhook, or event)'
          });
        }

        // Validate action nodes
        if (node.type === 'action' && !node.data.actionData?.actionType) {
          results.push({
            id: `node-${node.id}-action`,
            type: 'error',
            nodeId: node.id,
            message: 'Action node must specify an action type',
            fix: 'Select an action type for this node'
          });
        }

        // Validate condition nodes
        if (node.type === 'condition' && !node.data.conditionData?.operator) {
          results.push({
            id: `node-${node.id}-condition`,
            type: 'error',
            nodeId: node.id,
            message: 'Condition node must specify an operator',
            fix: 'Configure the condition operator'
          });
        }
      }

      // Validate edges
      const nodeIds = new Set(workflow.nodes.map(n => n.id));
      for (const edge of workflow.edges) {
        // Check if source and target nodes exist
        if (!nodeIds.has(edge.source)) {
          results.push({
            id: `edge-${edge.id}-source`,
            type: 'error',
            edgeId: edge.id,
            message: `Edge source node "${edge.source}" does not exist`,
            fix: 'Remove this edge or create the source node'
          });
        }

        if (!nodeIds.has(edge.target)) {
          results.push({
            id: `edge-${edge.id}-target`,
            type: 'error',
            edgeId: edge.id,
            message: `Edge target node "${edge.target}" does not exist`,
            fix: 'Remove this edge or create the target node'
          });
        }

        // Validate conditional edges
        if (edge.type === 'conditional' && !edge.condition) {
          results.push({
            id: `edge-${edge.id}-condition`,
            type: 'warning',
            edgeId: edge.id,
            message: 'Conditional edge should specify a condition',
            fix: 'Add a condition label to this edge'
          });
        }
      }

      // Check for disconnected nodes (orphans)
      const connectedNodeIds = new Set<string>();
      for (const edge of workflow.edges) {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      }

      for (const node of workflow.nodes) {
        if (!connectedNodeIds.has(node.id) && workflow.nodes.length > 1) {
          results.push({
            id: `node-${node.id}-disconnected`,
            type: 'warning',
            nodeId: node.id,
            message: `Node "${node.data.label}" is not connected to any other node`,
            fix: 'Connect this node to the workflow or remove it'
          });
        }
      }

      // Check for trigger nodes (at least one required)
      const hasTrigger = workflow.nodes.some(n => n.type === 'trigger');
      if (!hasTrigger && workflow.nodes.length > 0) {
        results.push({
          id: 'workflow-no-trigger',
          type: 'error',
          message: 'Workflow must have at least one trigger node',
          fix: 'Add a trigger node (manual, schedule, webhook, or event)'
        });
      }

      state.validationResults = results;
      state.isValid = !results.some(r => r.type === 'error');
    }),

    saveWorkflow: () => {
      const state = get();
      if (!state.currentWorkflow) return false;

      try {
        // Save to workflows list
        const existingIndex = state.workflows.findIndex(w => w.id === state.currentWorkflow!.id);
        if (existingIndex >= 0) {
          state.workflows[existingIndex] = state.currentWorkflow;
        } else {
          state.workflows.push(state.currentWorkflow);
        }

        // Persist to localStorage
        localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(state.workflows));
        return true;
      } catch (error) {
        console.error('Failed to save workflow:', error);
        return false;
      }
    },

    loadWorkflow: (workflowId) => {
      try {
        const stored = localStorage.getItem(WORKFLOW_STORAGE_KEY);
        if (!stored) return false;

        const workflows: Workflow[] = JSON.parse(stored);
        const workflow = workflows.find(w => w.id === workflowId);

        if (workflow) {
          set({ currentWorkflow: workflow });
          return true;
        }

        return false;
      } catch (error) {
        console.error('Failed to load workflow:', error);
        return false;
      }
    },

    deleteWorkflow: (workflowId) => set((state) => {
      state.workflows = state.workflows.filter(w => w.id !== workflowId);
      localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(state.workflows));

      if (state.currentWorkflow?.id === workflowId) {
        state.currentWorkflow = createEmptyWorkflow();
      }
    }),

    duplicateWorkflow: (workflowId) => {
      const state = get();
      const workflow = state.workflows.find(w => w.id === workflowId);

      if (!workflow) return;

      const duplicated: Workflow = {
        ...workflow,
        id: `workflow-${Date.now()}`,
        name: `${workflow.name} (Copy)`,
        metadata: {
          ...workflow.metadata,
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        },
        nodes: workflow.nodes.map(n => ({
          ...n,
          id: `${n.id}-copy-${Date.now()}`
        })),
        edges: workflow.edges.map(e => ({
          ...e,
          id: `${e.id}-copy-${Date.now()}`
        }))
      };

      state.workflows.push(duplicated);
      localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(state.workflows));
    },

    executeWorkflow: () => set((state) => {
      if (!state.currentWorkflow || !state.isValid) return;

      state.isExecuting = true;
      state.executionLogs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Workflow execution started'
      });

      // Find trigger node and start execution
      const triggerNode = state.currentWorkflow!.nodes.find(n => n.type === 'trigger');
      if (triggerNode) {
        state.executionNodeId = triggerNode.id;
      }
    }),

    stopExecution: () => set((state) => {
      state.isExecuting = false;
      state.executionNodeId = null;
      state.executionLogs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Workflow execution stopped'
      });
    }),

    setTemplate: (template) => set((state) => {
      state.currentWorkflow = JSON.parse(JSON.stringify(template.workflow));
    }),

    saveAsTemplate: (name, description) => set((state) => {
      if (!state.currentWorkflow) return;

      const template: WorkflowTemplate = {
        id: `template-${Date.now()}`,
        name,
        description: description || state.currentWorkflow.description,
        category: 'custom',
        workflow: state.currentWorkflow,
        tags: state.currentWorkflow.metadata.tags || [],
        featured: false,
        difficulty: 'beginner'
      };

      state.templates.push(template);
      localStorage.setItem(WORKFLOW_TEMPLATES_KEY, JSON.stringify(state.templates));
    }),

    deleteTemplate: (templateId) => set((state) => {
      state.templates = state.templates.filter(t => t.id !== templateId);
      localStorage.setItem(WORKFLOW_TEMPLATES_KEY, JSON.stringify(state.templates));
    }),

    importWorkflow: (data) => {
      try {
        const workflow: Workflow = JSON.parse(data);
        set({ currentWorkflow: workflow });
        return true;
      } catch {
        return false;
      }
    },

    exportWorkflow: (format) => {
      const state = get();
      if (!state.currentWorkflow) return null;

      try {
        if (format === 'json') {
          return JSON.stringify(state.currentWorkflow, null, 2);
        } else if (format === 'yaml') {
          // Basic YAML export (for full YAML support, consider adding js-yaml)
          const lines = [
            `id: ${state.currentWorkflow.id}`,
            `name: "${state.currentWorkflow.name}"`,
            `description: "${state.currentWorkflow.description || ''}"`,
            `status: ${state.currentWorkflow.status}`,
            `nodes: ${state.currentWorkflow.nodes.length}`,
            `edges: ${state.currentWorkflow.edges.length}`
          ];
          return lines.join('\n');
        }
        return null;
      } catch {
        return null;
      }
    },

    reset: () => set({
      currentWorkflow: createEmptyWorkflow(),
      canvasState: createInitialCanvasState(),
      validationResults: [],
      isValid: false,
      isExecuting: false,
      executionNodeId: null,
      executionLogs: []
    })
  }))
);

/**
 * Helper: Calculate workflow statistics
 */
export function getWorkflowStats(workflow: Workflow | null): WorkflowStats | null {
  if (!workflow) return null;

  const nodeCount = workflow.nodes.length;
  const edgeCount = workflow.edges.length;

  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (nodeCount > 15) complexity = 'complex';
  else if (nodeCount > 7) complexity = 'moderate';

  const store = useWorkflowStore.getState();
  const errorCount = store.validationResults.filter(r => r.type === 'error').length;
  const warningCount = store.validationResults.filter(r => r.type === 'warning').length;

  return {
    nodeCount,
    edgeCount,
    complexity,
    errorCount,
    warningCount
  };
}

/**
 * Helper: Load all saved workflows from localStorage
 */
export function loadSavedWorkflows(): Workflow[] {
  try {
    const stored = localStorage.getItem(WORKFLOW_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Helper: Get available templates by category
 */
export function getTemplatesByCategory(category: string): WorkflowTemplate[] {
  return useWorkflowStore.getState().templates.filter(t => t.category === category);
}
