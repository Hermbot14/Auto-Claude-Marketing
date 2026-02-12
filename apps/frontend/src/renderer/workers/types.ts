/**
 * Web Worker Types
 *
 * Type definitions for Web Workers used in Auto Claude Marketing Hub.
 * Workers handle heavy computation off the main thread to keep UI responsive.
 */

/**
 * Base worker message interface
 */
export interface WorkerMessage<T = unknown, R = unknown> {
  id: string;
  type: string;
  data: T;
}

/**
 * Base worker response interface
 */
export interface WorkerResponse<T = unknown> {
  id: string;
  type: string;
  data: T;
  error?: string;
}

/**
 * Progress report for long-running tasks
 */
export interface WorkerProgress {
  id: string;
  type: string;
  progress: number; // 0-100
  message?: string;
}

// ============================================
// Analytics Worker Types
// ============================================

/**
 * Analytics calculation request
 */
export interface AnalyticsRequest {
  campaigns?: Array<{
    id: string;
    title: string;
    contentType: string;
    status: string;
    scheduledDate?: Date;
    createdAt: Date;
    views?: number;
    clicks?: number;
    conversions?: number;
  }>;
  ideas?: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: Date;
  }>;
  tasks?: Array<{
    id: string;
    status: string;
    createdAt: Date;
    completedAt?: Date;
    subtasks?: Array<{ status: string }>;
  }>;
  timeframe?: 'week' | 'month' | 'quarter' | 'year' | 'all';
  startDate?: Date;
  endDate?: Date;
}

/**
 * Analytics metrics result
 */
export interface AnalyticsMetrics {
  // Campaign metrics
  totalCampaigns: number;
  campaignsByStatus: Record<string, number>;
  campaignsByType: Record<string, number>;
  campaignCompletionRate: number;

  // Idea metrics
  totalIdeas: number;
  ideasByType: Record<string, number>;
  ideasByStatus: Record<string, number>;
  ideaConversionRate: number;

  // Task metrics
  totalTasks: number;
  tasksByStatus: Record<string, number>;
  taskCompletionRate: number;
  averageTaskDuration: number; // in hours

  // Engagement metrics
  totalViews: number;
  totalClicks: number;
  totalConversions: number;
  averageEngagementRate: number;

  // Timeline data for charts
  timeline: Array<{
    date: string;
    campaigns: number;
    ideas: number;
    tasks: number;
  }>;
}

/**
 * Chart data generation request
 */
export interface ChartDataRequest {
  type: 'line' | 'bar' | 'pie' | 'area';
  dataType: 'campaigns' | 'ideas' | 'tasks' | 'engagement';
  groupBy: 'day' | 'week' | 'month' | 'type' | 'status';
  data: AnalyticsRequest;
}

/**
 * Chart data point
 */
export interface ChartDataPoint {
  label: string;
  value: number;
  date?: string;
  category?: string;
}

// ============================================
// Data Processing Worker Types
// ============================================

/**
 * Filter operation request
 */
export interface FilterRequest<T = unknown> {
  items: T[];
  filters: Array<{
    field: keyof T | string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith';
    value: unknown;
  }>;
  searchQuery?: string;
  searchFields?: Array<keyof T | string>;
}

/**
 * Sort operation request
 */
export interface SortRequest<T = unknown> {
  items: T[];
  sortBy: keyof T | string;
  order: 'asc' | 'desc';
  customComparator?: (a: T, b: T) => number;
}

/**
 * Transform operation request
 */
export interface TransformRequest<T = unknown, R = unknown> {
  items: T[];
  transform: (item: T) => R;
  batchSize?: number;
}

/**
 * Batch operation request
 */
export interface BatchRequest<T = unknown, R = unknown> {
  items: T[];
  operation: (item: T) => R;
  operationName: string;
}

/**
 * Export/import request
 */
export interface ExportRequest<T = unknown> {
  items: T[];
  format: 'json' | 'csv' | 'markdown';
  filename?: string;
  fields?: Array<keyof T | string>;
}

/**
 * Data processing result
 */
export interface DataProcessResult<T = unknown> {
  items: T[];
  totalProcessed: number;
  filtered?: number;
  transformed?: number;
  duration: number;
}

// ============================================
// Worker Pool Types
// ============================================

/**
 * Worker task configuration
 */
export interface WorkerTask<T = unknown, R = unknown> {
  id: string;
  workerType: 'analytics' | 'data-processing';
  operation: string;
  data: T;
  priority?: 'high' | 'normal' | 'low';
  timeout?: number; // milliseconds
  onProgress?: (progress: number) => void;
  onComplete?: (result: R) => void;
  onError?: (error: Error) => void;
}

/**
 * Worker pool configuration
 */
export interface WorkerPoolConfig {
  maxWorkers?: number; // Default: navigator.hardwareConcurrency || 4
  maxQueueSize?: number; // Default: 100
  workerTimeout?: number; // Default: 30000 (30s)
  idleTimeout?: number; // Default: 60000 (60s)
  retryAttempts?: number; // Default: 3
  retryDelay?: number; // Default: 1000 (1s)
}

/**
 * Worker pool status
 */
export interface WorkerPoolStatus {
  totalWorkers: number;
  activeWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageProcessingTime: number;
}

// ============================================
// Error Types
// ============================================

/**
 * Worker error types
 */
export class WorkerError extends Error {
  constructor(
    message: string,
    public code: string,
    public workerType?: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'WorkerError';
  }
}

/**
 * Worker timeout error
 */
export class WorkerTimeoutError extends WorkerError {
  constructor(timeout: number, workerType?: string) {
    super(
      `Worker operation timed out after ${timeout}ms`,
      'TIMEOUT',
      workerType
    );
    this.name = 'WorkerTimeoutError';
  }
}

/**
 * Worker termination error
 */
export class WorkerTerminationError extends WorkerError {
  constructor(workerType?: string) {
    super(
      'Worker was terminated unexpectedly',
      'TERMINATED',
      workerType
    );
    this.name = 'WorkerTerminationError';
  }
}

// ============================================
// Utility Types
// ============================================

/**
 * Worker capability detection result
 */
export interface WorkerCapabilities {
  supported: boolean;
  type: 'native' | 'fallback' | 'none';
  maxWorkers: number;
  features: {
    transferables: boolean;
    blobURLs: boolean;
    moduleWorkers: boolean;
  };
}

/**
 * Performance measurement
 */
export interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsed?: number;
  operations: number;
}
