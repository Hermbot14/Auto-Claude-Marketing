/**
 * Worker API
 *
 * Main API for interacting with Web Workers in Auto Claude Marketing Hub.
 * Provides a unified interface for analytics and data processing operations.
 */

import { WorkerPool, getWorkerPool, shutdownWorkerPool, getWorkerURL } from './workerManager';
import {
  isWorkerSupported,
  showFallbackNotification,
  calculateAnalyticsFallback,
  generateChartDataFallback,
  filterItemsFallback,
  sortItemsFallback,
  transformItemsFallback,
  processBatchFallback,
  exportDataFallback
} from './workerFallback';

import type {
  AnalyticsRequest,
  AnalyticsMetrics,
  ChartDataRequest,
  ChartDataPoint,
  FilterRequest,
  SortRequest,
  TransformRequest,
  BatchRequest,
  ExportRequest,
  DataProcessResult,
  WorkerCapabilities,
  WorkerPoolStatus
} from '../workers/types';

// ============================================
// Worker Initialization
// ============================================

let poolInitialized = false;

/**
 * Initialize the worker pool
 */
export function initializeWorkers(): void {
  if (poolInitialized) return;

  if (!isWorkerSupported()) {
    console.warn('[WorkerAPI] Web Workers not supported, using fallback mode');
    showFallbackNotification();
    poolInitialized = true;
    return;
  }

  try {
    const pool = getWorkerPool();

    // Initialize with worker URLs
    const analyticsWorkerURL = getWorkerURL('analytics.worker.js');
    const dataWorkerURL = getWorkerURL('data.worker.js');

    // Note: Actual worker initialization happens lazily when first task is executed
    // This prevents unnecessary worker creation on app startup

    console.log('[WorkerAPI] Worker pool initialized');
    poolInitialized = true;
  } catch (error) {
    console.error('[WorkerAPI] Failed to initialize workers:', error);
    showFallbackNotification();
    poolInitialized = true;
  }
}

/**
 * Shutdown all workers
 */
export function shutdownWorkers(): void {
  if (!poolInitialized) return;

  shutdownWorkerPool();
  poolInitialized = false;
  console.log('[WorkerAPI] Workers shut down');
}

// ============================================
// Analytics Operations
// ============================================

/**
 * Calculate analytics metrics
 */
export async function calculateAnalytics(
  request: AnalyticsRequest,
  options: {
    onProgress?: (progress: number, message?: string) => void;
    signal?: AbortSignal;
  } = {}
): Promise<AnalyticsMetrics> {
  const useFallback = !isWorkerSupported();

  if (useFallback) {
    return calculateAnalyticsFallback(request, options.onProgress);
  }

  const pool = getWorkerPool();

  if (!pool.isSupported()) {
    return calculateAnalyticsFallback(request, options.onProgress);
  }

  try {
    return await pool.execute<
      AnalyticsRequest,
      AnalyticsMetrics
    >(
      'analytics',
      'calculate',
      request,
      {
        onProgress: options.onProgress,
        signal: options.signal,
        priority: 'normal'
      }
    );
  } catch (error) {
    console.error('[WorkerAPI] Analytics calculation failed:', error);
    // Fallback to main thread on error
    return calculateAnalyticsFallback(request, options.onProgress);
  }
}

/**
 * Generate chart data
 */
export async function generateChartData(
  request: ChartDataRequest,
  options: {
    onProgress?: (progress: number, message?: string) => void;
    signal?: AbortSignal;
  } = {}
): Promise<ChartDataPoint[]> {
  const useFallback = !isWorkerSupported();

  if (useFallback) {
    return generateChartDataFallback(request, options.onProgress);
  }

  const pool = getWorkerPool();

  if (!pool.isSupported()) {
    return generateChartDataFallback(request, options.onProgress);
  }

  try {
    return await pool.execute<
      ChartDataRequest,
      ChartDataPoint[]
    >(
      'analytics',
      'chart',
      request,
      {
        onProgress: options.onProgress,
        signal: options.signal,
        priority: 'normal'
      }
    );
  } catch (error) {
    console.error('[WorkerAPI] Chart data generation failed:', error);
    return generateChartDataFallback(request, options.onProgress);
  }
}

// ============================================
// Data Processing Operations
// ============================================

/**
 * Filter items
 */
export async function filterItems<T extends Record<string, unknown>>(
  request: FilterRequest<T>,
  options: {
    onProgress?: (progress: number) => void;
    signal?: AbortSignal;
  } = {}
): Promise<DataProcessResult<T>> {
  const useFallback = !isWorkerSupported();

  if (useFallback) {
    return filterItemsFallback(request, options.onProgress);
  }

  const pool = getWorkerPool();

  if (!pool.isSupported()) {
    return filterItemsFallback(request, options.onProgress);
  }

  try {
    return await pool.execute<
      FilterRequest<T>,
      DataProcessResult<T>
    >(
      'data-processing',
      'filter',
      request,
      {
        onProgress: options.onProgress,
        signal: options.signal,
        priority: 'high' // Filtering is typically UI-blocking
      }
    );
  } catch (error) {
    console.error('[WorkerAPI] Filter operation failed:', error);
    return filterItemsFallback(request, options.onProgress);
  }
}

/**
 * Sort items
 */
export async function sortItems<T extends Record<string, unknown>>(
  request: SortRequest<T>,
  options: {
    onProgress?: (progress: number) => void;
    signal?: AbortSignal;
  } = {}
): Promise<DataProcessResult<T>> {
  const useFallback = !isWorkerSupported();

  if (useFallback) {
    return sortItemsFallback(request, options.onProgress);
  }

  const pool = getWorkerPool();

  if (!pool.isSupported()) {
    return sortItemsFallback(request, options.onProgress);
  }

  try {
    return await pool.execute<
      SortRequest<T>,
      DataProcessResult<T>
    >(
      'data-processing',
      'sort',
      request,
      {
        onProgress: options.onProgress,
        signal: options.signal,
        priority: 'high' // Sorting is typically UI-blocking
      }
    );
  } catch (error) {
    console.error('[WorkerAPI] Sort operation failed:', error);
    return sortItemsFallback(request, options.onProgress);
  }
}

/**
 * Transform items
 */
export async function transformItems<T, R>(
  request: TransformRequest<T, R>,
  options: {
    onProgress?: (progress: number) => void;
    signal?: AbortSignal;
  } = {}
): Promise<DataProcessResult<R>> {
  const useFallback = !isWorkerSupported();

  if (useFallback) {
    return transformItemsFallback(request, options.onProgress);
  }

  const pool = getWorkerPool();

  if (!pool.isSupported()) {
    return transformItemsFallback(request, options.onProgress);
  }

  try {
    return await pool.execute<
      TransformRequest<T, R>,
      DataProcessResult<R>
    >(
      'data-processing',
      'transform',
      request,
      {
        onProgress: options.onProgress,
        signal: options.signal,
        priority: 'normal'
      }
    );
  } catch (error) {
    console.error('[WorkerAPI] Transform operation failed:', error);
    return transformItemsFallback(request, options.onProgress);
  }
}

/**
 * Process batch operation
 */
export async function processBatch<T, R>(
  request: BatchRequest<T, R>,
  options: {
    onProgress?: (progress: number) => void;
    signal?: AbortSignal;
  } = {}
): Promise<DataProcessResult<R>> {
  const useFallback = !isWorkerSupported();

  if (useFallback) {
    return processBatchFallback(request, options.onProgress);
  }

  const pool = getWorkerPool();

  if (!pool.isSupported()) {
    return processBatchFallback(request, options.onProgress);
  }

  try {
    return await pool.execute<
      BatchRequest<T, R>,
      DataProcessResult<R>
    >(
      'data-processing',
      'batch',
      request,
      {
        onProgress: options.onProgress,
        signal: options.signal,
        priority: 'normal'
      }
    );
  } catch (error) {
    console.error('[WorkerAPI] Batch operation failed:', error);
    return processBatchFallback(request, options.onProgress);
  }
}

/**
 * Export data
 */
export async function exportData<T extends Record<string, unknown>>(
  request: ExportRequest<T>,
  options: {
    onProgress?: (progress: number, message?: string) => void;
    signal?: AbortSignal;
  } = {}
): Promise<string> {
  const useFallback = !isWorkerSupported();

  if (useFallback) {
    return exportDataFallback(request, options.onProgress);
  }

  const pool = getWorkerPool();

  if (!pool.isSupported()) {
    return exportDataFallback(request, options.onProgress);
  }

  try {
    const result = await pool.execute<
      ExportRequest<T>,
      string
    >(
      'data-processing',
      'export',
      request,
      {
        onProgress: options.onProgress,
        signal: options.signal,
        priority: 'low', // Export is less time-critical
        timeout: 60000 // 60 second timeout for exports
      }
    );
    return result as string;
  } catch (error) {
    console.error('[WorkerAPI] Export operation failed:', error);
    return exportDataFallback(request, options.onProgress);
  }
}

// ============================================
// Utilities
// ============================================

/**
 * Get worker capabilities
 */
export function getWorkerCapabilities(): WorkerCapabilities {
  const pool = getWorkerPool();
  return pool.getCapabilities();
}

/**
 * Get worker pool status
 */
export function getWorkerPoolStatus(): WorkerPoolStatus {
  const pool = getWorkerPool();
  return pool.getStatus();
}

/**
 * Check if workers are being used
 */
export function isUsingWorkers(): boolean {
  return isWorkerSupported() && getWorkerPool().isSupported();
}

/**
 * Get fallback status message
 */
export function getFallbackStatusMessage(): string | null {
  if (isWorkerSupported()) {
    return null;
  }
  return 'Heavy operations will run on the main thread. UI may be less responsive.';
}

// ============================================
// React Hook
// ============================================

/**
 * React hook for worker operations
 */
export function useWorker() {
  return {
    // Operations
    calculateAnalytics,
    generateChartData,
    filterItems,
    sortItems,
    transformItems,
    processBatch,
    exportData,

    // Utilities
    isSupported: isWorkerSupported(),
    isUsingWorkers: isUsingWorkers(),
    getCapabilities: getWorkerCapabilities(),
    getPoolStatus: getWorkerPoolStatus(),
    getFallbackMessage: getFallbackStatusMessage(),

    // Lifecycle
    initialize: initializeWorkers,
    shutdown: shutdownWorkers
  };
}
