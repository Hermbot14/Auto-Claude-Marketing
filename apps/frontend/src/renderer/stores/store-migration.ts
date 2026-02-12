/**
 * Store Migration Module
 *
 * This module provides backward compatibility wrappers for the unified store migration.
 * It allows existing components to continue working while we gradually migrate to the unified store.
 *
 * Migration Strategy:
 * 1. Phase 1: Unified store + backward compatible exports (Current)
 * 2. Phase 2: Update components one slice at a time
 * 3. Phase 3: Remove old stores entirely
 */

import { UnifiedStore } from './UnifiedStore';

// ============================================
// Performance Monitoring
// ============================================

interface StoreMetrics {
  name: string;
  updateCount: number;
  lastUpdate: Date;
  avgUpdateTime: number;
}

const storeMetrics = new Map<string, StoreMetrics>();

export function getStoreMetrics(storeName: string): StoreMetrics | undefined {
  return storeMetrics.get(storeName);
}

export function getAllStoreMetrics(): Map<string, StoreMetrics> {
  return new Map(storeMetrics);
}

export function resetStoreMetrics(): void {
  storeMetrics.clear();
}

function trackUpdate(storeName: string, startTime: number): void {
  const endTime = performance.now();
  const duration = endTime - startTime;

  const existing = storeMetrics.get(storeName);
  if (existing) {
    const newAvg = (existing.avgUpdateTime * existing.updateCount + duration) / (existing.updateCount + 1);
    storeMetrics.set(storeName, {
      name: storeName,
      updateCount: existing.updateCount + 1,
      lastUpdate: new Date(),
      avgUpdateTime: newAvg,
    });
  } else {
    storeMetrics.set(storeName, {
      name: storeName,
      updateCount: 1,
      lastUpdate: new Date(),
      avgUpdateTime: duration,
    });
  }
}

// ============================================
// Migration Status Tracking
// ============================================

export enum MigrationStatus {
  NotStarted = 'not_started',
  InProgress = 'in_progress',
  Completed = 'completed',
  Verified = 'verified',
}

interface SliceMigrationStatus {
  slice: 'calendar' | 'ideation' | 'insights' | 'roadmap';
  status: MigrationStatus;
  componentsMigrated: string[];
  notes: string;
}

const migrationStatus: SliceMigrationStatus[] = [
  {
    slice: 'calendar',
    status: MigrationStatus.InProgress,
    componentsMigrated: [],
    notes: 'Unified store created, backward compatible exports ready',
  },
  {
    slice: 'ideation',
    status: MigrationStatus.InProgress,
    componentsMigrated: [],
    notes: 'Unified store created, backward compatible exports ready',
  },
  {
    slice: 'insights',
    status: MigrationStatus.InProgress,
    componentsMigrated: [],
    notes: 'Unified store created, backward compatible exports ready',
  },
  {
    slice: 'roadmap',
    status: MigrationStatus.InProgress,
    componentsMigrated: [],
    notes: 'Unified store created, backward compatible exports ready',
  },
];

export function getMigrationStatus(): SliceMigrationStatus[] {
  return [...migrationStatus];
}

export function updateMigrationStatus(
  slice: 'calendar' | 'ideation' | 'insights' | 'roadmap',
  status: MigrationStatus,
  component?: string,
  notes?: string
): void {
  const sliceIndex = migrationStatus.findIndex((s) => s.slice === slice);
  if (sliceIndex === -1) return;

  migrationStatus[sliceIndex].status = status;
  if (component) {
    if (!migrationStatus[sliceIndex].componentsMigrated.includes(component)) {
      migrationStatus[sliceIndex].componentsMigrated.push(component);
    }
  }
  if (notes) {
    migrationStatus[sliceIndex].notes = notes;
  }
}

export function getMigrationProgress(): {
  total: number;
  completed: number;
  inProgress: number;
  percentage: number;
} {
  const total = migrationStatus.length;
  const completed = migrationStatus.filter((s) => s.status === MigrationStatus.Completed || s.status === MigrationStatus.Verified).length;
  const inProgress = migrationStatus.filter((s) => s.status === MigrationStatus.InProgress).length;
  const percentage = Math.round((completed / total) * 100);

  return { total, completed, inProgress, percentage };
}

// ============================================
// Store Wrapper with Performance Tracking
// ============================================

export function createTrackedStore<T>(name: string, initialState: T) {
  let state = initialState;
  const listeners = new Set<(state: T) => void>();

  return {
    getState: () => state,
    setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => {
      const startTime = performance.now();
      const newState = typeof partial === 'function'
        ? { ...state, ...(partial as (state: T) => Partial<T>)(state) }
        : { ...state, ...partial };

      state = newState;
      trackUpdate(name, startTime);

      listeners.forEach((listener) => listener(state));
    },
    subscribe: (listener: (state: T) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// ============================================
// Memory Usage Tracking
// ============================================

interface MemorySnapshot {
  timestamp: Date;
  calendarSize: number;
  ideationSize: number;
  insightsSize: number;
  roadmapSize: number;
  totalSize: number;
}

const memorySnapshots: MemorySnapshot[] = [];

function estimateSize(obj: unknown): number {
  const str = JSON.stringify(obj);
  return new Blob([str]).size;
}

export function captureMemorySnapshot(): MemorySnapshot {
  const state = UnifiedStore.getState();

  const calendarSize = estimateSize(state.calendar);
  const ideationSize = estimateSize(state.ideation);
  const insightsSize = estimateSize(state.insights);
  const roadmapSize = estimateSize(state.roadmap);
  const totalSize = calendarSize + ideationSize + insightsSize + roadmapSize;

  const snapshot: MemorySnapshot = {
    timestamp: new Date(),
    calendarSize,
    ideationSize,
    insightsSize,
    roadmapSize,
    totalSize,
  };

  memorySnapshots.push(snapshot);

  // Keep only last 100 snapshots
  if (memorySnapshots.length > 100) {
    memorySnapshots.shift();
  }

  return snapshot;
}

export function getMemorySnapshots(): MemorySnapshot[] {
  return [...memorySnapshots];
}

export function getMemoryTrend(): {
  averageSize: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  percentageChange: number;
} {
  if (memorySnapshots.length < 2) {
    return { averageSize: 0, trend: 'stable', percentageChange: 0 };
  }

  const recent = memorySnapshots.slice(-10);
  const older = memorySnapshots.slice(-20, -10);

  const avgRecent = recent.reduce((sum, s) => sum + s.totalSize, 0) / recent.length;
  const avgOlder = older.reduce((sum, s) => sum + s.totalSize, 0) / older.length;

  const percentageChange = ((avgRecent - avgOlder) / avgOlder) * 100;
  const trend = Math.abs(percentageChange) < 5 ? 'stable' : percentageChange > 0 ? 'increasing' : 'decreasing';

  return {
    averageSize: avgRecent,
    trend,
    percentageChange,
  };
}

export function compareMemoryUsage(): {
  baseline: MemorySnapshot | null;
  current: MemorySnapshot;
  reduction: number;
  percentage: number;
} {
  if (memorySnapshots.length < 2) {
    return {
      baseline: null,
      current: captureMemorySnapshot(),
      reduction: 0,
      percentage: 0,
    };
  }

  const baseline = memorySnapshots[0];
  const current = memorySnapshots[memorySnapshots.length - 1];
  const reduction = baseline.totalSize - current.totalSize;
  const percentage = (reduction / baseline.totalSize) * 100;

  return { baseline, current, reduction, percentage };
}

// ============================================
// Utilities for Migration
// ============================================

/**
 * Check if a component should use unified store based on migration status
 */
export function shouldUseUnifiedStore(sliceName: string): boolean {
  const status = migrationStatus.find((s) => s.slice === sliceName);
  return status?.status === MigrationStatus.Completed || status?.status === MigrationStatus.Verified || false;
}

/**
 * Mark a component as migrated to unified store
 */
export function markComponentMigrated(sliceName: string, componentName: string): void {
  const statusEntry = migrationStatus.find((s) => s.slice === sliceName);
  if (statusEntry && !statusEntry.componentsMigrated.includes(componentName)) {
    statusEntry.componentsMigrated.push(componentName);
  }
}

/**
 * Get list of components that still need migration for a slice
 */
export function getPendingMigrations(sliceName: string): string[] {
  // This would need to be populated with actual component names
  // For now, return empty array
  return [];
}

/**
 * Print migration report to console
 */
export function printMigrationReport(): void {
  const progress = getMigrationProgress();
  const memory = compareMemoryUsage();

  console.group('🔄 Unified Store Migration Report');
  console.log('📊 Migration Progress:', `${progress.completed}/${progress.total} slices (${progress.percentage}%)`);
  console.log('📈 Memory Usage:', `${memory.reduction > 0 ? '-' : '+'}${Math.abs(memory.percentage).toFixed(1)}%`);

  migrationStatus.forEach((status) => {
    console.log(`  ${status.slice}: ${status.status} (${status.componentsMigrated.length} components)`);
    if (status.notes) {
      console.log(`    ℹ️ ${status.notes}`);
    }
  });

  console.groupEnd();
}

// Print report on import in development
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    printMigrationReport();
  }, 1000);
}
