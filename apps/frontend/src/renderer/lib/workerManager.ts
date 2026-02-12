/**
 * Worker Pool Manager
 *
 * Manages Web Worker lifecycle, task queuing, and resource allocation
 * for heavy computation tasks in Auto Claude Marketing Hub.
 */

import type {
  WorkerTask,
  WorkerPoolConfig,
  WorkerPoolStatus,
  WorkerCapabilities,
  WorkerError,
  WorkerTimeoutError,
  WorkerTerminationError
} from '../workers/types';

// ============================================
// Worker Pool Implementation
// ============================================

interface PooledWorker {
  id: string;
  worker: Worker;
  busy: boolean;
  currentTask?: string;
  createdAt: number;
  lastUsed: number;
}

interface QueuedTask {
  task: WorkerTask;
  createdAt: number;
  attempts: number;
  timeoutId?: ReturnType<typeof setTimeout>;
}

const DEFAULT_CONFIG: Required<WorkerPoolConfig> = {
  maxWorkers: Math.max(4, navigator.hardwareConcurrency || 4),
  maxQueueSize: 100,
  workerTimeout: 30000, // 30 seconds
  idleTimeout: 60000, // 60 seconds
  retryAttempts: 3,
  retryDelay: 1000 // 1 second
};

/**
 * Detect worker capabilities
 */
export function detectWorkerCapabilities(): WorkerCapabilities {
  const supported = typeof Worker !== 'undefined';

  if (!supported) {
    return {
      supported: false,
      type: 'none',
      maxWorkers: 0,
      features: {
        transferables: false,
        blobURLs: false,
        moduleWorkers: false
      }
    };
  }

  // Check for module worker support
  let moduleWorkers = false;
  try {
    const blob = new Blob(
      ['export {};'],
      { type: 'module' }
    );
    const url = URL.createObjectURL(blob);
    // Try to create a module worker
    new Worker(url, { type: 'module' });
    moduleWorkers = true;
    URL.revokeObjectURL(url);
  } catch {
    // Module workers not supported
  }

  return {
    supported: true,
    type: moduleWorkers ? 'native' : 'fallback',
    maxWorkers: navigator.hardwareConcurrency || 4,
    features: {
      transferables: typeof ArrayBuffer !== 'undefined',
      blobURLs: typeof URL !== 'undefined' && typeof Blob !== 'undefined',
      moduleWorkers
    }
  };
}

/**
 * Worker Pool Manager Class
 */
export class WorkerPool {
  private config: Required<WorkerPoolConfig>;
  private workers: Map<string, PooledWorker> = new Map();
  private queue: QueuedTask[] = [];
  private taskResults: Map<string, unknown> = new Map();
  private taskCallbacks: Map<string, (result: unknown) => void> = new Map();
  private taskErrorCallbacks: Map<string, (error: Error) => void> = new Map();
  private taskProgressCallbacks: Map<string, (progress: number, message?: string) => void> = new Map();
  private idleCheckInterval?: ReturnType<typeof setInterval>;
  private messageIdCounter = 0;
  private capabilities: WorkerCapabilities;

  constructor(config: WorkerPoolConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.capabilities = detectWorkerCapabilities();
    this.startIdleCheck();
  }

  /**
   * Initialize the worker pool with workers
   */
  public initialize(workerURL: string | URL): void {
    if (!this.capabilities.supported) {
      console.warn('[WorkerPool] Web Workers not supported, using fallback mode');
      return;
    }

    for (let i = 0; i < this.config.maxWorkers; i++) {
      this.createWorker(workerURL, i);
    }

    console.log(
      `[WorkerPool] Initialized with ${this.config.maxWorkers} workers`
    );
  }

  /**
   * Create a new worker
   */
  private createWorker(workerURL: string | URL, index: number): PooledWorker {
    const workerId = `worker-${index}-${Date.now()}`;

    let worker: Worker;
    try {
      worker = new Worker(workerURL);
    } catch (error) {
      console.error(`[WorkerPool] Failed to create worker ${workerId}:`, error);
      throw new WorkerError(
        `Failed to create worker: ${error}`,
        'WORKER_CREATION_FAILED',
        'pool',
        error
      );
    }

    const pooledWorker: PooledWorker = {
      id: workerId,
      worker,
      busy: false,
      createdAt: Date.now(),
      lastUsed: Date.now()
    };

    // Setup message handler
    worker.addEventListener('message', (event) => {
      this.handleWorkerMessage(workerId, event.data);
    });

    // Setup error handler
    worker.addEventListener('error', (error) => {
      console.error(`[WorkerPool] Worker ${workerId} error:`, error);
      this.handleWorkerError(workerId, error);
    });

    this.workers.set(workerId, pooledWorker);
    return pooledWorker;
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(workerId: string, message: MessageEvent['data']): void {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    // Check if this is a progress update
    if (message && typeof message === 'object' && 'type' in message) {
      const msg = message as { id: string; type: string; progress?: number; message?: string; data?: unknown; error?: string };

      if (msg.type === 'progress') {
        const callback = this.taskProgressCallbacks.get(msg.id);
        if (callback && msg.progress !== undefined) {
          callback(msg.progress, msg.message);
        }
        return;
      }

      // Handle result or error response
      if (msg.id) {
        if (msg.error) {
          const error = new Error(msg.error);
          const errorCallback = this.taskErrorCallbacks.get(msg.id);
          if (errorCallback) {
            errorCallback(error);
          }
          this.taskResults.set(msg.id, error);
        } else {
          this.taskResults.set(msg.id, msg.data);
          const callback = this.taskCallbacks.get(msg.id);
          if (callback) {
            callback(msg.data);
          }
        }

        // Mark worker as free
        worker.busy = false;
        worker.currentTask = undefined;
        worker.lastUsed = Date.now();

        // Process next task in queue
        this.processQueue();
      }
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(workerId: string, error: ErrorEvent): void {
    const worker = this.workers.get(workerId);
    if (!worker || !worker.currentTask) return;

    const taskError = new WorkerError(
      error.message || 'Unknown worker error',
      'WORKER_RUNTIME_ERROR',
      worker.currentTask,
      error
    );

    const errorCallback = this.taskErrorCallbacks.get(worker.currentTask);
    if (errorCallback) {
      errorCallback(taskError);
    }

    this.taskResults.set(worker.currentTask, taskError);
    worker.busy = false;
    worker.currentTask = undefined;
    this.processQueue();
  }

  /**
   * Execute a task using an available worker
   */
  public execute<T = unknown, R = unknown>(
    workerType: 'analytics' | 'data-processing',
    operation: string,
    data: T,
    options: {
      timeout?: number;
      priority?: WorkerTask['priority'];
      onProgress?: (progress: number, message?: string) => void;
      signal?: AbortSignal;
    } = {}
  ): Promise<R> {
    const taskId = `task-${++this.messageIdCounter}-${Date.now()}`;

    return new Promise<R>((resolve, reject) => {
      // Check for abort signal
      if (options.signal?.aborted) {
        reject(new Error('Task was aborted'));
        return;
      }

      // Setup abort handler
      const abortHandler = () => {
        this.taskCallbacks.delete(taskId);
        this.taskErrorCallbacks.delete(taskId);
        this.taskProgressCallbacks.delete(taskId);
        reject(new Error('Task was aborted'));
      };

      options.signal?.addEventListener('abort', abortHandler, { once: true });

      // Setup callbacks
      this.taskCallbacks.set(taskId, (result: R) => {
        options.signal?.removeEventListener('abort', abortHandler);
        resolve(result);
      });

      this.taskErrorCallbacks.set(taskId, (error: Error) => {
        options.signal?.removeEventListener('abort', abortHandler);
        reject(error);
      });

      if (options.onProgress) {
        this.taskProgressCallbacks.set(taskId, options.onProgress);
      }

      // Create task
      const task: WorkerTask<T, R> = {
        id: taskId,
        workerType,
        operation,
        data,
        priority: options.priority || 'normal',
        timeout: options.timeout || this.config.workerTimeout,
        onProgress: options.onProgress,
        onComplete: (result: R) => {
          options.signal?.removeEventListener('abort', abortHandler);
          resolve(result);
        },
        onError: (error: Error) => {
          options.signal?.removeEventListener('abort', abortHandler);
          reject(error);
        }
      };

      // Add to queue
      this.addToQueue(task);

      // Process queue immediately
      this.processQueue();
    });
  }

  /**
   * Add task to queue with priority handling
   */
  private addToQueue(task: WorkerTask): void {
    // Check queue size limit
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new WorkerError(
        'Worker queue is full',
        'QUEUE_FULL',
        'pool'
      );
    }

    const queuedTask: QueuedTask = {
      task,
      createdAt: Date.now(),
      attempts: 0
    };

    // Insert based on priority
    let insertIndex = this.queue.length;

    if (task.priority === 'high') {
      // High priority: insert before first normal/low priority task
      insertIndex = this.queue.findIndex(
        (qt) => qt.task.priority !== 'high'
      );
      if (insertIndex === -1) insertIndex = 0;
    } else if (task.priority === 'low') {
      // Low priority: add to end
      insertIndex = this.queue.length;
    } else {
      // Normal priority: add before low priority tasks
      insertIndex = this.queue.findIndex(
        (qt) => qt.task.priority === 'low'
      );
      if (insertIndex === -1) insertIndex = this.queue.length;
    }

    this.queue.splice(insertIndex, 0, queuedTask);
  }

  /**
   * Process next task in queue
   */
  private processQueue(): void {
    if (this.queue.length === 0) return;

    // Find available worker
    const availableWorker = Array.from(this.workers.values()).find((w) => !w.busy);

    if (!availableWorker) {
      // No workers available, wait for one to finish
      return;
    }

    // Get next task
    const nextTask = this.queue.shift();
    if (!nextTask) return;

    const { task } = nextTask;

    // Assign task to worker
    availableWorker.busy = true;
    availableWorker.currentTask = task.id;

    // Set task timeout
    const timeoutId = setTimeout(() => {
      if (!availableWorker.busy) return;

      const error = new WorkerTimeoutError(task.timeout, task.workerType);
      const errorCallback = this.taskErrorCallbacks.get(task.id);
      if (errorCallback) {
        errorCallback(error);
      }

      // Terminate and recreate worker
      availableWorker.worker.terminate();
      this.workers.delete(availableWorker.id);
      this.createWorker(availableWorker.worker.constructor.url, parseInt(availableWorker.id.split('-')[1]));

      // Process next task
      this.processQueue();
    }, task.timeout);

    nextTask.timeoutId = timeoutId;

    // Send message to worker
    try {
      availableWorker.worker.postMessage({
        id: task.id,
        type: task.operation,
        data: task.data
      });
    } catch (error) {
      // Clear timeout on error
      if (timeoutId) clearTimeout(timeoutId);

      const taskError = new WorkerError(
        `Failed to send message to worker: ${error}`,
        'MESSAGE_SEND_FAILED',
        task.workerType,
        error
      );

      const errorCallback = this.taskErrorCallbacks.get(task.id);
      if (errorCallback) {
        errorCallback(taskError);
      }

      // Mark worker as free
      availableWorker.busy = false;
      availableWorker.currentTask = undefined;
      this.processQueue();
    }
  }

  /**
   * Get current pool status
   */
  public getStatus(): WorkerPoolStatus {
    const activeWorkers = Array.from(this.workers.values()).filter((w) => w.busy).length;

    return {
      totalWorkers: this.workers.size,
      activeWorkers,
      queuedTasks: this.queue.length,
      completedTasks: this.taskResults.size,
      failedTasks: Array.from(this.taskResults.values()).filter(
        (r) => r instanceof Error
      ).length,
      averageProcessingTime: this.calculateAverageProcessingTime()
    };
  }

  /**
   * Calculate average processing time (simplified)
   */
  private calculateAverageProcessingTime(): number {
    // This is a placeholder - real implementation would track timing
    return 0;
  }

  /**
   * Start idle worker cleanup
   */
  private startIdleCheck(): void {
    this.idleCheckInterval = setInterval(() => {
      const now = Date.now();
      const idleThreshold = this.config.idleTimeout;

      // Find idle workers
      for (const [id, worker] of this.workers) {
        if (!worker.busy && now - worker.lastUsed > idleThreshold) {
          // Recreate worker to free memory
          worker.worker.terminate();
          this.workers.delete(id);
          // Note: We don't recreate here to avoid disrupting ongoing operations
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Shutdown the worker pool
   */
  public shutdown(): void {
    // Clear interval
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }

    // Clear timeouts
    for (const queuedTask of this.queue) {
      if (queuedTask.timeoutId) {
        clearTimeout(queuedTask.timeoutId);
      }
    }

    // Terminate all workers
    for (const worker of this.workers.values()) {
      worker.worker.terminate();
    }

    // Clear collections
    this.workers.clear();
    this.queue = [];
    this.taskResults.clear();
    this.taskCallbacks.clear();
    this.taskErrorCallbacks.clear();
    this.taskProgressCallbacks.clear();

    console.log('[WorkerPool] Shutdown complete');
  }

  /**
   * Check if workers are supported
   */
  public isSupported(): boolean {
    return this.capabilities.supported;
  }

  /**
   * Get capabilities
   */
  public getCapabilities(): WorkerCapabilities {
    return this.capabilities;
  }
}

// ============================================
// Worker URL Generation
// ============================================

/**
 * Get worker URL from source file
 */
export function getWorkerURL(workerPath: string): string {
  // For Vite dev server
  if (import.meta.env?.DEV) {
    return `/src/renderer/workers/${workerPath}`;
  }

  // For production builds, use import.meta.url based resolution
  return new URL(workerPath, import.meta.url).href;
}

// ============================================
// Singleton Worker Pool
// ============================================

let globalWorkerPool: WorkerPool | null = null;

/**
 * Get or create the global worker pool
 */
export function getWorkerPool(config?: WorkerPoolConfig): WorkerPool {
  if (!globalWorkerPool) {
    globalWorkerPool = new WorkerPool(config);
  }
  return globalWorkerPool;
}

/**
 * Initialize worker pool with analytics and data workers
 */
export function initializeWorkerPool(): void {
  const pool = getWorkerPool();

  const analyticsWorkerURL = getWorkerURL('analytics.worker.js');
  const dataWorkerURL = getWorkerURL('data.worker.js');

  // Note: Workers will be initialized with proper URLs in actual usage
  // The .js extension is required for Web Workers (not .ts)
}

/**
 * Shutdown worker pool
 */
export function shutdownWorkerPool(): void {
  if (globalWorkerPool) {
    globalWorkerPool.shutdown();
    globalWorkerPool = null;
  }
}
