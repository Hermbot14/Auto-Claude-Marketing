/**
 * Worker Performance Comparison Utility
 *
 * Provides tools to measure and compare performance between
 * worker and fallback implementations.
 */

import type { PerformanceMetrics } from '../workers/types';

// ============================================
// Performance Measurement
// ============================================

/**
 * Measure execution time of a function
 */
export function measurePerformance<T>(
  operation: string,
  fn: () => T,
  options?: {
    measureMemory?: boolean;
    logToConsole?: boolean;
  }
): { result: T; metrics: PerformanceMetrics } {
  const startTime = performance.now();
  let memoryUsed: number | undefined;

  if (options?.measureMemory && 'memory' in performance) {
    const memory = (performance as Performance & { memory: { usedJSHeapSize: number } }).memory;
    memoryUsed = memory.usedJSHeapSize;
  }

  const result = fn();
  const endTime = performance.now();
  const duration = endTime - startTime;

  const metrics: PerformanceMetrics = {
    startTime,
    endTime,
    duration,
    memoryUsed,
    operations: 1
  };

  if (options?.logToConsole) {
    console.log(`[Performance] ${operation}:`, {
      duration: `${duration.toFixed(2)}ms`,
      memory: memoryUsed ? `${(memoryUsed / 1024 / 1024).toFixed(2)}MB` : 'N/A'
    });
  }

  return { result, metrics };
}

/**
 * Compare worker vs fallback performance
 */
export interface PerformanceComparison {
  operation: string;
  dataSize: number;
  worker: PerformanceMetrics;
  fallback: PerformanceMetrics;
  speedup: number; // worker time / fallback time
  recommendation: string;
}

/**
 * Compare worker and fallback performance for an operation
 */
export function comparePerformance(
  operation: string,
  dataSize: number,
  workerMetrics: PerformanceMetrics,
  fallbackMetrics: PerformanceMetrics
): PerformanceComparison {
  const speedup = fallbackMetrics.duration / workerMetrics.duration;

  let recommendation = '';
  if (speedup > 2) {
    recommendation = `Worker is ${speedup.toFixed(1)}x faster - significant improvement. Keep using workers for this operation.`;
  } else if (speedup > 1.2) {
    recommendation = `Worker is ${speedup.toFixed(1)}x faster - moderate improvement. Workers provide better UX.`;
  } else if (speedup > 1) {
    recommendation = `Worker is slightly faster (${speedup.toFixed(1)}x). Overhead may exceed benefit for small datasets.`;
  } else {
    recommendation = `Fallback is faster (${(1/speedup).toFixed(1)}x). Worker overhead exceeds benefit for this operation size.`;
  }

  return {
    operation,
    dataSize,
    worker: workerMetrics,
    fallback: fallbackMetrics,
    speedup,
    recommendation
  };
}

/**
 * Store performance history
 */
class PerformanceHistory {
  private history: Map<string, PerformanceComparison[]> = new Map();
  private maxSize = 100; // Keep last 100 comparisons

  /**
   * Add a comparison to history
   */
  public add(comparison: PerformanceComparison): void {
    const key = comparison.operation;
    const existing = this.history.get(key) || [];

    existing.push(comparison);

    // Keep only recent entries
    if (existing.length > this.maxSize) {
      existing.shift();
    }

    this.history.set(key, existing);
  }

  /**
   * Get history for an operation
   */
  public get(operation: string): PerformanceComparison[] {
    return this.history.get(operation) || [];
  }

  /**
   * Get average speedup for an operation
   */
  public getAverageSpeedup(operation: string): number {
    const history = this.get(operation);
    if (history.length === 0) return 1;

    const total = history.reduce((sum, c) => sum + c.speedup, 0);
    return total / history.length;
  }

  /**
   * Get recommendation based on historical data
   */
  public getRecommendation(operation: string): string {
    const avgSpeedup = this.getAverageSpeedup(operation);

    if (avgSpeedup > 1.5) {
      return `Based on history, workers are consistently ${avgSpeedup.toFixed(1)}x faster. Recommended for this operation.`;
    } else if (avgSpeedup < 1.1) {
      return `Based on history, workers add overhead. Fallback is recommended for this operation size.`;
    } else {
      return `Performance is similar. Either approach works well.`;
    }
  }

  /**
   * Clear all history
   */
  public clear(): void {
    this.history.clear();
  }

  /**
   * Export history as JSON
   */
  public exportToJSON(): Record<string, PerformanceComparison[]> {
    const result: Record<string, PerformanceComparison[]> = {};
    for (const [operation, comparisons] of this.history) {
      result[operation] = comparisons;
    }
    return result;
  }
}

// Singleton instance
const performanceHistory = new PerformanceHistory();

// ============================================
// Public API
// ============================================

/**
 * Record a performance comparison
 */
export function recordPerformanceComparison(comparison: PerformanceComparison): void {
  performanceHistory.add(comparison);

  if (window.DEBUG) {
    console.log('[Worker Performance]', comparison);
  }
}

/**
 * Get performance history for an operation
 */
export function getPerformanceHistory(operation: string): PerformanceComparison[] {
  return performanceHistory.get(operation);
}

/**
 * Get average speedup for an operation
 */
export function getAverageSpeedup(operation: string): number {
  return performanceHistory.getAverageSpeedup(operation);
}

/**
 * Get recommendation for using workers
 */
export function getWorkerRecommendation(operation: string): string {
  return performanceHistory.getRecommendation(operation);
}

/**
 * Clear performance history
 */
export function clearPerformanceHistory(): void {
  performanceHistory.clear();
}

/**
 * Export performance history
 */
export function exportPerformanceHistory(): Record<string, PerformanceComparison[]> {
  return performanceHistory.exportToJSON();
}

/**
 * Performance testing utility
 */
export async function benchmarkOperation<T>(
  operation: string,
  dataSize: number,
  workerFn: () => Promise<T>,
  fallbackFn: () => Promise<T>
): Promise<PerformanceComparison> {
  console.log(`[Benchmark] Testing ${operation} with ${dataSize} items`);

  // Measure worker performance
  const { result: workerResult, metrics: workerMetrics } = await measurePerformance(
    `${operation} (worker)`,
    workerFn,
    { logToConsole: window.DEBUG }
  );

  // Measure fallback performance
  const { result: fallbackResult, metrics: fallbackMetrics } = await measurePerformance(
    `${operation} (fallback)`,
    fallbackFn,
    { logToConsole: window.DEBUG }
  );

  // Verify results match
  const resultsMatch = JSON.stringify(workerResult) === JSON.stringify(fallbackResult);

  if (!resultsMatch && window.DEBUG) {
    console.warn('[Benchmark] Results do not match!', {
      worker: workerResult,
      fallback: fallbackResult
    });
  }

  const comparison = comparePerformance(
    operation,
    dataSize,
    workerMetrics,
    fallbackMetrics
  );

  console.log(`[Benchmark] Results:`, {
    worker: `${workerMetrics.duration.toFixed(2)}ms`,
    fallback: `${fallbackMetrics.duration.toFixed(2)}ms`,
    speedup: `${comparison.speedup.toFixed(1)}x`
  });

  return comparison;
}

/**
 * Determine if workers should be used based on data size
 */
export function shouldUseWorkers(dataSize: number, threshold = 1000): boolean {
  return isWorkerSupported() && dataSize >= threshold;
}

/**
 * Check if workers are supported
 */
function isWorkerSupported(): boolean {
  return typeof Worker !== 'undefined';
}
