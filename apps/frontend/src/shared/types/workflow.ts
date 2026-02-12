/**
 * Workflow Visualization System Type Definitions
 *
 * This file contains all type definitions for the visual workflow builder
 * including nodes, edges, templates, and validation.
 */

/**
 * Node types available in the workflow builder
 */
export type NodeType =
  | 'trigger'
  | 'action'
  | 'condition'
  | 'loop'
  | 'parallel'
  | 'merge'
  | 'output'
  | 'delay'
  | 'transform'
  | 'filter';

/**
 * Edge/connection types
 */
export type EdgeType = 'default' | 'success' | 'error' | 'conditional';

/**
 * Workflow execution status
 */
export type WorkflowStatus = 'draft' | 'valid' | 'invalid' | 'running' | 'completed' | 'failed' | 'paused';

/**
 * Node execution status
 */
export type NodeStatus = 'idle' | 'running' | 'success' | 'error' | 'warning';

/**
 * Workflow node structure
 */
export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: NodePosition;
  data: NodeData;
  config?: NodeConfig;
  status?: NodeStatus;
  selected?: boolean;
}

/**
 * Node position on canvas
 */
export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Common data for all node types
 */
export interface NodeData {
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  parameters: NodeParameters;
  // Type-specific data stored in typed fields
  triggerData?: TriggerNodeData;
  actionData?: ActionNodeData;
  conditionData?: ConditionNodeData;
  loopData?: LoopNodeData;
  delayData?: DelayNodeData;
  transformData?: TransformNodeData;
}

/**
 * Node configuration parameters
 */
export interface NodeParameters {
  [key: string]: unknown;
}

/**
 * Trigger node specific data
 */
export interface TriggerNodeData {
  triggerType: 'manual' | 'schedule' | 'webhook' | 'event';
  schedule?: string; // Cron expression for schedule triggers
  webhookPath?: string; // Path for webhook triggers
  eventType?: string; // Event type for event triggers
}

/**
 * Action node specific data
 */
export interface ActionNodeData {
  actionType: 'create-task' | 'run-agent' | 'send-notification' | 'execute-command' | 'call-api';
  taskTitle?: string;
  taskDescription?: string;
  agentType?: string;
  notificationMessage?: string;
  command?: string;
  apiEndpoint?: string;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  apiHeaders?: Record<string, string>;
  apiBody?: unknown;
}

/**
 * Condition node specific data
 */
export interface ConditionNodeData {
  operator: 'equals' | 'not-equals' | 'contains' | 'not-contains' | 'greater-than' | 'less-than' | 'exists';
  field: string;
  value: string;
  trueLabel?: string;
  falseLabel?: string;
}

/**
 * Loop node specific data
 */
export interface LoopNodeData {
  loopType: 'for-each' | 'while' | 'do-until';
  arrayField?: string; // Field to iterate over
  condition?: string; // Condition for while/until loops
  maxIterations?: number; // Safety limit for loops
}

/**
 * Delay node specific data
 */
export interface DelayNodeData {
  duration: number;
  unit: 'seconds' | 'minutes' | 'hours' | 'days';
}

/**
 * Transform node specific data
 */
export interface TransformNodeData {
  transformType: 'map' | 'filter' | 'format' | 'extract' | 'aggregate';
  expression?: string; // Transform expression
  format?: string; // Format string
}

/**
 * Node configuration for UI rendering
 */
export interface NodeConfig {
  color?: string;
  icon?: string;
  inputs?: NodePort[];
  outputs?: NodePort[];
  allowCustomInputs?: boolean;
  allowCustomOutputs?: boolean;
}

/**
 * Node port configuration
 */
export interface NodePort {
  id: string;
  label: string;
  type: 'data' | 'flow' | 'error';
  required?: boolean;
}

/**
 * Workflow edge/connection
 */
export interface WorkflowEdge {
  id: string;
  source: string; // Source node ID
  target: string; // Target node ID
  sourceHandle?: string; // Source port ID
  targetHandle?: string; // Target port ID
  type?: EdgeType;
  label?: string;
  animated?: boolean;
  style?: EdgeStyle;
  condition?: string; // For conditional edges
}

/**
 * Edge styling options
 */
export interface EdgeStyle {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
}

/**
 * Complete workflow definition
 */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata: WorkflowMetadata;
  status: WorkflowStatus;
  validationResults?: ValidationResult[];
}

/**
 * Workflow metadata
 */
export interface WorkflowMetadata {
  created: string;
  modified: string;
  version: string;
  author?: string;
  tags?: string[];
}

/**
 * Workflow template
 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  thumbnail?: string;
  workflow: Workflow;
  tags: string[];
  featured?: boolean;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime?: number; // in minutes
}

/**
 * Template categories
 */
export type TemplateCategory =
  | 'getting-started'
  | 'automation'
  | 'integration'
  | 'custom'
  | 'task-creation'
  | 'agent-workflow'
  | 'notification';

/**
 * Validation result for workflow/node
 */
export interface ValidationResult {
  id: string;
  type: 'error' | 'warning' | 'info';
  nodeId?: string; // Node ID if node-specific
  edgeId?: string; // Edge ID if edge-specific
  message: string;
  fix?: string; // Suggested fix
}

/**
 * Workflow execution state
 */
export interface WorkflowExecution {
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  currentNodeId?: string; // Currently executing node
  nodeStates: NodeExecutionState[];
  logs: ExecutionLog[];
  error?: ExecutionError;
}

/**
 * Node execution state
 */
export interface NodeExecutionState {
  nodeId: string;
  status: NodeStatus;
  startedAt?: string;
  completedAt?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
}

/**
 * Execution log entry
 */
export interface ExecutionLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  nodeId?: string;
  message: string;
  data?: unknown;
}

/**
 * Execution error details
 */
export interface ExecutionError {
  nodeId: string;
  message: string;
  stackTrace?: string;
  timestamp: string;
}

/**
 * Workflow builder props
 */
export interface WorkflowBuilderProps {
  workflow: Workflow;
  onWorkflowChange: (workflow: Workflow) => void;
  readOnly?: boolean;
  templates?: WorkflowTemplate[];
  onExecute?: (workflowId: string) => void;
  onSave?: (workflow: Workflow) => void;
  onExport?: (workflow: Workflow, format: 'json' | 'png') => void;
}

/**
 * Workflow node component props
 */
export interface WorkflowNodeProps {
  node: WorkflowNode;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (node: WorkflowNode) => void;
  onDelete: () => void;
  onValidate?: (node: WorkflowNode) => ValidationResult[];
  readOnly?: boolean;
}

/**
 * Workflow edge component props
 */
export interface WorkflowEdgeProps {
  edge: WorkflowEdge;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (edge: WorkflowEdge) => void;
  onDelete: () => void;
  sourceNode: WorkflowNode;
  targetNode: WorkflowNode;
}

/**
 * Workflow templates browser props
 */
export interface WorkflowTemplatesProps {
  templates: WorkflowTemplate[];
  onSelect: (template: WorkflowTemplate) => void;
  onCreateTemplate?: (workflow: Workflow) => void;
  onDeleteTemplate?: (templateId: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  selectedCategory?: TemplateCategory;
  onCategoryChange?: (category: TemplateCategory) => void;
}

/**
 * Node palette item
 */
export interface NodePaletteItem {
  type: NodeType;
  label: string;
  description: string;
  icon: string;
  category: 'trigger' | 'action' | 'flow-control' | 'data';
  defaultConfig?: Partial<WorkflowNode>;
}

/**
 * Canvas state
 */
export interface CanvasState {
  zoom: number;
  pan: { x: number; y: number };
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  clipboardNode?: WorkflowNode;
}

/**
 * Workflow export format
 */
export interface WorkflowExport {
  format: 'json' | 'yaml' | 'png';
  includeMetadata?: boolean;
  minify?: boolean;
}

/**
 * Keyboard shortcuts for workflow builder
 */
export interface WorkflowShortcuts {
  delete: string; // Delete selected nodes/edges
  duplicate: string; // Duplicate selected nodes
  undo: string; // Undo last action
  redo: string; // Redo undone action
  save: string; // Save workflow
  execute: string; // Run workflow
  zoomIn: string; // Zoom in canvas
  zoomOut: string; // Zoom out canvas
  fitView: string; // Fit all nodes in view
}

/**
 * Empty state for workflow builder
 */
export interface WorkflowEmptyState {
  hasTemplates: boolean;
  onCreateNew: () => void;
  onLoadTemplate: () => void;
  onImportWorkflow: () => void;
}

/**
 * Workflow statistics
 */
export interface WorkflowStats {
  nodeCount: number;
  edgeCount: number;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedExecutionTime?: number; // in seconds
  errorCount: number;
  warningCount: number;
}

/**
 * Default workflow templates
 */
export interface BuiltInTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  nodes: Partial<WorkflowNode>[];
  edges: Partial<WorkflowEdge>[];
  description: string;
}
