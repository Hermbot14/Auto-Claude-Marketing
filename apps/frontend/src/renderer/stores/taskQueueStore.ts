/**
 * Task Queue Store
 * ================
 *
 * Manages state for the background task queue monitoring system.
 * Provides real-time updates on queued tasks, worker status, and progress tracking.
 */

import { create } from 'zustand';
import { toast } from '../hooks/use-toast';

// ============================================================================
// Type Definitions
// ============================================================================

export type QueueTaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying';

export type QueueTaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export type WorkerStatus = 'idle' | 'busy' | 'stopping' | 'stopped';

export interface QueueTask {
  id: string;
  name: string;
  funcName: string;
  priority: QueueTaskPriority;
  status: QueueTaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  retryCount: number;
  maxRetries: number;
  progress?: TaskProgress;
  result?: TaskResult;
  webhookUrl?: string;
  scheduledAt?: number;
  dependencies: string[];
  tags: string[];
}

export interface TaskProgress {
  taskId: string;
  progress: number; // 0-100
  message: string;
  currentStep?: string;
  totalSteps?: number;
  timestamp: number;
}

export interface TaskResult {
  success: boolean;
  data?: unknown;
  error?: string;
  traceback?: string;
  durationMs: number;
  retries: number;
}

export interface WorkerInfo {
  workerId: string;
  status: WorkerStatus;
  currentTaskId?: string;
  tasksCompleted: number;
  tasksFailed: number;
  totalDurationMs: number;
  startedAt: number;
  utilisation: number;
}

export interface QueueStats {
  totalTasks: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  byPriority: Record<QueueTaskPriority, number>;
  workerStats: {
    totalWorkers: number;
    activeWorkers: number;
    idleWorkers: number;
    totalTasksCompleted: number;
    totalTasksFailed: number;
    averageUtilisation: number;
  };
}

export interface ScheduledTask {
  id: string;
  name: string;
  schedule: string; // Cron expression
  nextRun: string;
  lastRun?: string;
  enabled: boolean;
}

// ============================================================================
// Store State
// ============================================================================

interface TaskQueueState {
  // Task data
  tasks: QueueTask[];
  selectedTaskId: string | null;
  filters: {
    status: QueueTaskStatus | 'all';
    priority: QueueTaskPriority | 'all';
    search: string;
    tags: string[];
  };

  // Worker data
  workers: WorkerInfo[];

  // Queue statistics
  stats: QueueStats | null;
  statsLoading: boolean;

  // Scheduled tasks
  scheduledTasks: ScheduledTask[];

  // Connection status
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // UI state
  viewMode: 'list' | 'grid' | 'timeline';
  autoRefresh: boolean;
  refreshInterval: number; // seconds

  // Actions
  setTasks: (tasks: QueueTask[]) => void;
  addTask: (task: QueueTask) => void;
  updateTask: (taskId: string, updates: Partial<QueueTask>) => void;
  removeTask: (taskId: string) => void;
  setSelectedTask: (taskId: string | null) => void;

  setWorkers: (workers: WorkerInfo[]) => void;
  updateWorker: (workerId: string, updates: Partial<WorkerInfo>) => void;

  setStats: (stats: QueueStats | null) => void;
  setStatsLoading: (loading: boolean) => void;

  setScheduledTasks: (tasks: ScheduledTask[]) => void;

  setConnectionStatus: (isConnected: boolean, error: string | null) => void;

  setViewMode: (mode: 'list' | 'grid' | 'timeline') => void;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;

  // Async actions
  fetchTasks: () => Promise<void>;
  fetchStats: () => Promise<void>;
  enqueueTask: (name: string, args?: unknown[], priority?: QueueTaskPriority) => Promise<string>;
  cancelTask: (taskId: string) => Promise<boolean>;
  retryTask: (taskId: string) => Promise<boolean>;
  clearCompleted: (olderThanHours?: number) => Promise<number>;
  pauseQueue: () => Promise<void>;
  resumeQueue: () => Promise<void>;
  refreshTasks: () => Promise<void>;
}

// ============================================================================
// Store Implementation
// ============================================================================

const AUTO_REFRESH_INTERVAL_KEY = 'task-queue-auto-refresh';
const AUTO_REFRESH_ENABLED_KEY = 'task-queue-auto-refresh-enabled';
const VIEW_MODE_KEY = 'task-queue-view-mode';

export const useTaskQueueStore = create<TaskQueueState>((set, get) => ({
  // Initial state
  tasks: [],
  selectedTaskId: null,
  filters: {
    status: 'all',
    priority: 'all',
    search: '',
    tags: [],
  },
  workers: [],
  stats: null,
  statsLoading: false,
  scheduledTasks: [],
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  viewMode: (localStorage.getItem(VIEW_MODE_KEY) as 'list' | 'grid' | 'timeline') || 'list',
  autoRefresh: localStorage.getItem(AUTO_REFRESH_ENABLED_KEY) === 'true',
  refreshInterval: parseInt(localStorage.getItem(AUTO_REFRESH_INTERVAL_KEY) || '30', 10),

  // Task actions
  setTasks: (tasks) => set({ tasks }),

  addTask: (task) => set((state) => ({
    tasks: [...state.tasks, task]
  })),

  updateTask: (taskId, updates) => set((state) => ({
    tasks: state.tasks.map(t =>
      t.id === taskId ? { ...t, ...updates } : t
    )
  })),

  removeTask: (taskId) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== taskId)
  })),

  setSelectedTask: (taskId) => set({ selectedTaskId: taskId }),

  // Worker actions
  setWorkers: (workers) => set({ workers }),

  updateWorker: (workerId, updates) => set((state) => ({
    workers: state.workers.map(w =>
      w.workerId === workerId ? { ...w, ...updates } : w
    )
  })),

  // Statistics actions
  setStats: (stats) => set({ stats }),

  setStatsLoading: (loading) => set({ statsLoading: loading }),

  // Scheduled tasks actions
  setScheduledTasks: (scheduledTasks) => set({ scheduledTasks }),

  // Connection status actions
  setConnectionStatus: (isConnected, error) => set({
    isConnected,
    connectionError: error,
    isConnecting: false
  }),

  // UI state actions
  setViewMode: (mode) => {
    localStorage.setItem(VIEW_MODE_KEY, mode);
    set({ viewMode: mode });
  },

  setAutoRefresh: (enabled) => {
    localStorage.setItem(AUTO_REFRESH_ENABLED_KEY, String(enabled));
    set({ autoRefresh: enabled });
  },

  setRefreshInterval: (interval) => {
    localStorage.setItem(AUTO_REFRESH_INTERVAL_KEY, String(interval));
    set({ refreshInterval: interval });
  },

  // ========================================================================
  // Async Actions (API calls via IPC)
  // ========================================================================

  fetchTasks: async () => {
    set({ isConnecting: true, connectionError: null });
    try {
      const result = await window.electronAPI.getQueueTasks?.();
      if (result?.success && result.data) {
        set({ tasks: result.data.tasks, workers: result.data.workers });
      } else {
        set({ connectionError: result?.error || 'Failed to fetch tasks' });
      }
    } catch (error) {
      set({ connectionError: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      set({ isConnecting: false });
    }
  },

  fetchStats: async () => {
    set({ statsLoading: true });
    try {
      const result = await window.electronAPI.getQueueStats?.();
      if (result?.success && result.data) {
        set({ stats: result.data });
      }
    } catch (error) {
      console.error('Failed to fetch queue stats:', error);
    } finally {
      set({ statsLoading: false });
    }
  },

  enqueueTask: async (name, args = [], priority = 'medium') => {
    try {
      const result = await window.electronAPI.enqueueTask?.(name, args, priority);
      if (result?.success && result.data) {
        const newTask: QueueTask = {
          id: result.data.taskId,
          name,
          funcName: name,
          priority,
          status: 'pending',
          createdAt: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          tags: [],
          dependencies: [],
        };
        set((state) => ({ tasks: [...state.tasks, newTask] }));
        toast({
          title: 'Task enqueued',
          description: `Task "${name}" has been added to the queue`,
        });
        return result.data.taskId;
      }
      toast({
        title: 'Enqueue failed',
        description: result?.error || 'Failed to enqueue task',
        variant: 'destructive',
      });
      return '';
    } catch (error) {
      toast({
        title: 'Enqueue failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return '';
    }
  },

  cancelTask: async (taskId) => {
    try {
      const result = await window.electronAPI.cancelQueueTask?.(taskId);
      if (result?.success) {
        set((state) => ({
          tasks: state.tasks.filter(t => t.id !== taskId)
        }));
        toast({
          title: 'Task cancelled',
          description: 'Task has been removed from the queue',
        });
        return true;
      }
      toast({
        title: 'Cancel failed',
        description: result?.error || 'Failed to cancel task',
        variant: 'destructive',
      });
      return false;
    } catch (error) {
      toast({
        title: 'Cancel failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    }
  },

  retryTask: async (taskId) => {
    const state = get();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return false;

    try {
      const result = await window.electronAPI.retryQueueTask?.(taskId);
      if (result?.success) {
        set((state) => ({
          tasks: state.tasks.map(t =>
            t.id === taskId
              ? { ...t, status: 'pending', retryCount: t.retryCount + 1 }
              : t
          )
        }));
        toast({
          title: 'Task retrying',
          description: 'Task has been re-queued for execution',
        });
        return true;
      }
      toast({
        title: 'Retry failed',
        description: result?.error || 'Failed to retry task',
        variant: 'destructive',
      });
      return false;
    } catch (error) {
      toast({
        title: 'Retry failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    }
  },

  clearCompleted: async (olderThanHours = 24) => {
    try {
      const result = await window.electronAPI.clearCompletedTasks?.(olderThanHours);
      if (result?.success && result.data) {
        const state = get();
        const clearedCount = result.data.clearedCount || 0;
        set((state) => ({
          tasks: state.tasks.filter(t => t.status !== 'completed' && t.status !== 'failed')
        }));
        toast({
          title: 'Tasks cleared',
          description: `${clearedCount} completed tasks have been removed`,
        });
        return clearedCount;
      }
      return 0;
    } catch (error) {
      toast({
        title: 'Clear failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return 0;
    }
  },

  pauseQueue: async () => {
    try {
      const result = await window.electronAPI.pauseQueue?.();
      if (result?.success) {
        toast({
          title: 'Queue paused',
          description: 'Task queue has been paused',
        });
      }
    } catch (error) {
      toast({
        title: 'Pause failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  },

  resumeQueue: async () => {
    try {
      const result = await window.electronAPI.resumeQueue?.();
      if (result?.success) {
        toast({
          title: 'Queue resumed',
          description: 'Task queue has been resumed',
        });
      }
    } catch (error) {
      toast({
        title: 'Resume failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  },

  refreshTasks: async () => {
    await get().fetchTasks();
    await get().fetchStats();
  },
}));

// ============================================================================
// Selectors
// ============================================================================

export const getFilteredTasks = (state: TaskQueueState): QueueTask[] => {
  let filtered = [...state.tasks];

  // Filter by status
  if (state.filters.status !== 'all') {
    filtered = filtered.filter(t => t.status === state.filters.status);
  }

  // Filter by priority
  if (state.filters.priority !== 'all') {
    filtered = filtered.filter(t => t.priority === state.filters.priority);
  }

  // Filter by search
  if (state.filters.search) {
    const searchLower = state.filters.search.toLowerCase();
    filtered = filtered.filter(t =>
      t.name.toLowerCase().includes(searchLower) ||
      t.id.toLowerCase().includes(searchLower) ||
      t.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }

  // Filter by tags
  if (state.filters.tags.length > 0) {
    filtered = filtered.filter(t =>
      state.filters.tags.some(tag => t.tags.includes(tag))
    );
  }

  return filtered;
};

export const getSelectedTask = (state: TaskQueueState): QueueTask | undefined => {
  return state.tasks.find(t => t.id === state.selectedTaskId);
};

export const getTasksByStatus = (state: TaskQueueState, status: QueueTaskStatus): QueueTask[] => {
  return state.tasks.filter(t => t.status === status);
};

export const getTasksByPriority = (state: TaskQueueState, priority: QueueTaskPriority): QueueTask[] => {
  return state.tasks.filter(t => t.priority === priority);
};

export const getActiveWorkers = (state: TaskQueueState): WorkerInfo[] => {
  return state.workers.filter(w => w.status === 'busy');
};

export const getIdleWorkers = (state: TaskQueueState): WorkerInfo[] => {
  return state.workers.filter(w => w.status === 'idle');
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: QueueTaskStatus): string {
  const colors = {
    pending: 'text-gray-500',
    queued: 'text-blue-500',
    running: 'text-green-500',
    completed: 'text-emerald-600',
    failed: 'text-red-500',
    cancelled: 'text-gray-400',
    retrying: 'text-yellow-500',
  };
  return colors[status] || 'text-gray-500';
}

/**
 * Get priority color for UI
 */
export function getPriorityColor(priority: QueueTaskPriority): string {
  const colors = {
    urgent: 'text-red-600 bg-red-50',
    high: 'text-orange-600 bg-orange-50',
    medium: 'text-blue-600 bg-blue-50',
    low: 'text-gray-600 bg-gray-50',
  };
  return colors[priority] || 'text-gray-600 bg-gray-50';
}
