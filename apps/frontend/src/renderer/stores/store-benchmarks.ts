/**
 * Performance Benchmarks for Unified Store
 *
 * Provides utilities to measure state update performance
 * and compare against baseline metrics.
 */

// ============================================
// Benchmark Types
// ============================================

export interface BenchmarkResult {
  name: string;
  operations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  opsPerSecond: number;
}

export interface StateUpdate {
  name: string;
  timestamp: number;
  duration: number;
  slice: string;
  operation: string;
}

export interface MemorySnapshot {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

// ============================================
// Performance Tracking
// ============================================

const updateHistory: StateUpdate[] = [];
const MAX_HISTORY_SIZE = 1000;

export function trackUpdate(
  slice: string,
  operation: string,
  duration: number
): void {
  updateHistory.push({
    name: `${slice}.${operation}`,
    timestamp: performance.now(),
    duration,
    slice,
    operation,
  });

  if (updateHistory.length > MAX_HISTORY_SIZE) {
    updateHistory.shift();
  }
}

export function getUpdateHistory(): StateUpdate[] {
  return [...updateHistory];
}

export function clearHistory(): void {
  updateHistory.length = 0;
}

// ============================================
// Benchmark Functions
// ============================================

/**
 * Benchmark a series of state updates
 */
export function benchmarkUpdates(
  name: string,
  updates: Array<(state: unknown) => void>,
  iterations: number = 100
): BenchmarkResult {
  const times: number[] = [];

  // Warmup
  updates.forEach((update) => update({}));

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    updates.forEach((update) => {
      const start = performance.now();
      update({});
      const end = performance.now();
      times.push(end - start);
    });
  }

  const totalTime = times.reduce((sum, time) => sum + time, 0);
  const avgTime = totalTime / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const opsPerSecond = 1000 / avgTime;

  return {
    name,
    operations: times.length,
    totalTime,
    avgTime,
    minTime,
    maxTime,
    opsPerSecond,
  };
}

/**
 * Compare two benchmark results
 */
export function compareBenchmarks(
  baseline: BenchmarkResult,
  current: BenchmarkResult
): {
  timeImprovement: number;
  percentImprovement: number;
  opsImprovement: number;
  faster: boolean;
} {
  const timeImprovement = baseline.avgTime - current.avgTime;
  const percentImprovement = (timeImprovement / baseline.avgTime) * 100;
  const opsImprovement = current.opsPerSecond - baseline.opsPerSecond;
  const faster = timeImprovement > 0;

  return {
    timeImprovement,
    percentImprovement,
    opsImprovement,
    faster,
  };
}

// ============================================
// Memory Tracking
// ============================================

const memorySnapshots: MemorySnapshot[] = [];

export function captureMemorySnapshot(): MemorySnapshot {
  if ('memory' in performance) {
    const memory = performance.memory as {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSize?: number;
    };
    const snapshot: MemorySnapshot = {
      timestamp: new Date(),
      heapUsed: memory.usedJSHeapSize,
      heapTotal: memory.totalJSHeapSize,
      external: memory.jsHeapSize ?? 0,
    };

    memorySnapshots.push(snapshot);

    // Keep last 100 snapshots
    if (memorySnapshots.length > 100) {
      memorySnapshots.shift();
    }

    return snapshot;
  }

  // Fallback if memory API not available
  const snapshot: MemorySnapshot = {
    timestamp: new Date(),
    heapUsed: 0,
    heapTotal: 0,
    external: 0,
  };

  memorySnapshots.push(snapshot);
  return snapshot;
}

// Type augmentation for performance.memory
declare global {
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSize?: number;
    };
  }
}

export function getMemorySnapshots(): MemorySnapshot[] {
  return [...memorySnapshots];
}

export function getMemoryTrend(): {
  average: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  percentageChange: number;
} {
  if (memorySnapshots.length < 10) {
    return { average: 0, trend: 'stable', percentageChange: 0 };
  }

  const recent = memorySnapshots.slice(-10);
  const older = memorySnapshots.slice(-20, -10);

  const avgRecent = recent.reduce((sum, s) => sum + s.heapUsed, 0) / recent.length;
  const avgOlder = older.reduce((sum, s) => sum + s.heapUsed, 0) / older.length;

  const percentageChange = ((avgRecent - avgOlder) / avgOlder) * 100;
  const trend = Math.abs(percentageChange) < 5 ? 'stable' : percentageChange > 0 ? 'increasing' : 'decreasing';

  return {
    average: avgRecent,
    trend,
    percentageChange,
  };
}

// ============================================
// Report Generation
// ============================================

export interface PerformanceReport {
  timestamp: Date;
  benchmarks: BenchmarkResult[];
  memory: {
    current: MemorySnapshot;
    trend: ReturnType<typeof getMemoryTrend>;
  };
  updateStats: {
    totalUpdates: number;
    avgUpdateDuration: number;
    bySlice: Record<string, { count: number; avgDuration: number }>;
  };
  recommendations: string[];
}

export function generatePerformanceReport(
  benchmarks?: BenchmarkResult[]
): PerformanceReport {
  // Calculate update statistics
  const bySlice: Record<string, { count: number; totalDuration: number }> = {};

  updateHistory.forEach((update) => {
    if (!bySlice[update.slice]) {
      bySlice[update.slice] = { count: 0, totalDuration: 0 };
    }
    bySlice[update.slice].count++;
    bySlice[update.slice].totalDuration += update.duration;
  });

  const bySliceStats: Record<string, { count: number; avgDuration: number }> = {};
  Object.entries(bySlice).forEach(([slice, stats]) => {
    bySliceStats[slice] = {
      count: stats.count,
      avgDuration: stats.totalDuration / stats.count,
    };
  });

  const totalUpdates = updateHistory.length;
  const avgUpdateDuration =
    totalUpdates > 0
      ? updateHistory.reduce((sum, u) => sum + u.duration, 0) / totalUpdates
      : 0;

  const currentMemory = captureMemorySnapshot();
  const memoryTrend = getMemoryTrend();

  // Generate recommendations
  const recommendations: string[] = [];

  if (avgUpdateDuration > 5) {
    recommendations.push(
      '⚠️ Average state update duration is high. ' +
      'Consider using batch updates for multiple state changes.'
    );
  }

  if (memoryTrend.trend === 'increasing' && Math.abs(memoryTrend.percentageChange) > 10) {
    recommendations.push(
      '⚠️ Memory usage is trending upward. ' +
      'Check for memory leaks or consider state normalization.'
    );
  }

  if (totalUpdates > MAX_HISTORY_SIZE * 0.9) {
    recommendations.push(
      'ℹ️ Update history is approaching capacity. ' +
      'Consider implementing state persistence or compression.'
    );
  }

  return {
    timestamp: new Date(),
    benchmarks: benchmarks || [],
    memory: {
      current: currentMemory,
      trend: memoryTrend,
    },
    updateStats: {
      totalUpdates,
      avgUpdateDuration,
      bySlice: bySliceStats,
    },
    recommendations,
  };
}

/**
 * Print performance report to console
 */
export function printPerformanceReport(benchmarks?: BenchmarkResult[]): void {
  const report = generatePerformanceReport(benchmarks);

  console.group('📊 Unified Store Performance Report');
  console.log('📅 Generated:', report.timestamp.toLocaleString());

  console.log('⚡ Update Statistics:');
  console.log('  Total Updates:', report.updateStats.totalUpdates);
  console.log('  Avg Duration:', `${report.updateStats.avgUpdateDuration.toFixed(3)}ms`);

  console.log('  By Slice:');
  Object.entries(report.updateStats.bySlice).forEach(([slice, stats]) => {
    console.log(
      `    ${slice}: ${stats.count} updates, avg ${stats.avgDuration.toFixed(3)}ms`
    );
  });

  console.log('💾 Memory:');
  console.log('  Heap Used:', `${(report.memory.current.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(
    '  Trend:',
    `${report.memory.trend.trend} (${report.memory.trend.percentageChange.toFixed(1)}%)`
  );

  if (report.recommendations.length > 0) {
    console.log('💡 Recommendations:');
    report.recommendations.forEach((rec) => console.log(`  ${rec}`));
  }

  console.groupEnd();
}

// ============================================
// Baseline Management
// ============================================

const BASELINE_KEY = 'unified-store-baseline';

export interface BaselineData {
  timestamp: Date;
  benchmarks: BenchmarkResult[];
  memory: MemorySnapshot;
}

export function saveBaseline(benchmarks: BenchmarkResult[]): void {
  const baseline: BaselineData = {
    timestamp: new Date(),
    benchmarks,
    memory: captureMemorySnapshot(),
  };

  try {
    localStorage.setItem(BASELINE_KEY, JSON.stringify(baseline));
  } catch (error) {
    console.warn('Failed to save baseline:', error);
  }
}

export function loadBaseline(): BaselineData | null {
  try {
    const data = localStorage.getItem(BASELINE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('Failed to load baseline:', error);
  }
  return null;
}

export function clearBaseline(): void {
  try {
    localStorage.removeItem(BASELINE_KEY);
  } catch (error) {
    console.warn('Failed to clear baseline:', error);
  }
}

export function compareWithBaseline(current: BenchmarkResult[]): {
  baseline: BaselineData | null;
  comparisons: ReturnType<typeof compareBenchmarks>[];
} {
  const baseline = loadBaseline();
  if (!baseline) {
    return { baseline: null, comparisons: [] };
  }

  const comparisons = current.map((bench, index) => {
    if (baseline.benchmarks[index]) {
      return compareBenchmarks(baseline.benchmarks[index], bench);
    }
    return {
      timeImprovement: 0,
      percentImprovement: 0,
      opsImprovement: 0,
      faster: false,
    };
  });

  return { baseline, comparisons };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Measure execution time of a function
 */
export function measureTime<T>(name: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  const duration = end - start;

  trackUpdate('benchmark', name, duration);

  return result;
}

/**
 * Create a performance measurement decorator
 */
export function withPerformanceTracking<T extends (...args: unknown[]) => unknown>(
  name: string,
  fn: T
): T {
  return ((...args) => {
    const start = performance.now();
    const result = fn(...args);
    const end = performance.now();
    const duration = end - start;

    trackUpdate('function', name, duration);

    return result;
  }) as T;
}
