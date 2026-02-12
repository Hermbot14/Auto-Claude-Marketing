/**
 * React Hooks for Multi-Tier Caching
 * ===================================
 *
 * Provides easy-to-use React hooks for:
 * - Caching async data with automatic stale-while-revalidate
 * - Cache invalidation
 * - Offline detection
 * - Cache metrics
 * - Cache warming
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type CacheEntry,
  type CacheOptions,
  type CacheStats,
  getCache,
  makeCacheKey,
  offlineDetector,
} from './cache';

// ============================================================================
// Type Definitions
// ============================================================================

export interface UseCacheResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isStale: boolean;
  error: Error | undefined;
  isInvalidate: () => void;
  isRefresh: () => Promise<void>;
  hitRate: number;
}

export interface UseCachedAsyncOptions<T> extends CacheOptions<T> {
  enabled?: boolean;
  staleWhileRevalidate?: boolean;
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
  deduplicationInterval?: number; // ms
}

export interface UseCacheMutationOptions<T> extends CacheOptions<T> {
  optimisticUpdate?: boolean;
  rollbackOnError?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Pending Request Tracking (Deduplication)
// ============================================================================

type PendingRequest<T> = {
  promise: Promise<T>;
  timestamp: number;
};

const pendingRequests = new Map<string, PendingRequest<unknown>>();

function getPendingRequest<T>(key: string): PendingRequest<T> | undefined {
  return pendingRequests.get(key) as PendingRequest<T> | undefined;
}

function setPendingRequest<T>(key: string, promise: Promise<T>): void {
  pendingRequests.set(key, { promise, timestamp: Date.now() });

  // Cleanup after promise completes
  promise.finally(() => {
    setTimeout(() => pendingRequests.delete(key), 100);
  });
}

// ============================================================================
// useCachedAsync Hook
// ============================================================================

export function useCachedAsync<T>(
  key: string | string[],
  fetcher: () => Promise<T>,
  options: UseCachedAsyncOptions<T> = {}
): UseCacheResult<T> {
  const {
    ttl,
    tags,
    enabled = true,
    staleWhileRevalidate = true,
    revalidateOnFocus = false,
    revalidateOnReconnect = true,
    deduplicationInterval = 2000,
  } = options;

  const cacheKey = Array.isArray(key) ? makeCacheKey(...key) : key;
  const cache = getCache<T>();
  const isMounted = useRef(true);

  const [data, setData] = useState<T | undefined>(() => cache.get(cacheKey));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [isStale, setIsStale] = useState(false);

  // Fetch function with deduplication
  const fetchData = useCallback(async (): Promise<T | undefined> => {
    // Check for pending request
    const pending = getPendingRequest<T>(cacheKey);

    if (pending && Date.now() - pending.timestamp < deduplicationInterval) {
      console.debug(`[useCache] Using pending request for ${cacheKey}`);
      return pending.promise;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      // Create fetch promise
      const promise = fetcher();

      // Track for deduplication
      setPendingRequest(cacheKey, promise);

      const result = await promise;

      // Only update if component is still mounted
      if (isMounted.current) {
        setData(result);
        setIsStale(false);
        // Store in cache
        cache.set(cacheKey, result, { ttl, tags, persistToL2: true });
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (isMounted.current) {
        setError(error);
        setIsStale(false);
      }

      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, fetcher, ttl, tags, deduplicationInterval]);

  // Invalidate function
  const invalidate = useCallback(() => {
    cache.delete(cacheKey);
    setData(undefined);
    setIsStale(true);
  }, [cacheKey]);

  // Refresh function
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchData();
      setData(result);
      return result;
    } catch (err) {
      // Error already set in fetchData
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    if (!enabled) return;

    // Check cache first
    const cached = cache.get(cacheKey);

    if (cached !== undefined) {
      setData(cached);
      console.debug(`[useCache] Cache hit for ${cacheKey}`);

      // Optional: background refresh for stale data
      if (staleWhileRevalidate) {
        fetchData().catch(() => {
          // Silent background refresh failed - keep stale data
        });
      }
    } else {
      console.debug(`[useCache] Cache miss for ${cacheKey}`);
      // Cache miss - fetch fresh data
      fetchData();
    }

    return () => {
      isMounted.current = false;
    };
  }, [cacheKey, enabled, staleWhileRevalidate]);

  // Revalidate on window focus
  useEffect(() => {
    if (!revalidateOnFocus) return;

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchData().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleFocus);
    return () => document.removeEventListener('visibilitychange', handleFocus);
  }, [revalidateOnFocus, fetchData]);

  // Revalidate on reconnect
  useEffect(() => {
    if (!revalidateOnReconnect) return;

    const handleReconnect = () => {
      if (!offlineDetector.isOffline()) {
        console.debug(`[useCache] Reconnected, refreshing ${cacheKey}`);
        fetchData().catch(() => {});
      }
    };

    window.addEventListener('online', handleReconnect);
    return () => window.removeEventListener('online', handleReconnect);
  }, [revalidateOnReconnect, fetchData]);

  // Calculate hit rate from cache metrics
  const hitRate = (() => {
    const metrics = cache.getMetrics();
    return metrics.aggregate.hitRate;
  })();

  return {
    data,
    isLoading,
    isStale,
    error,
    invalidate,
    refresh,
    hitRate,
  };
}

// ============================================================================
// useCacheMutation Hook
// ============================================================================

export function useCacheMutation<T>(
  key: string | string[],
  mutator: (data: T | undefined) => Promise<T>,
  options: UseCacheMutationOptions<T> = {}
): {
  mutate: () => Promise<void>;
  reset: () => void;
  isMutating: boolean;
} {
  const { ttl, tags, optimisticUpdate, rollbackOnError, onSuccess, onError } = options;

  const cacheKey = Array.isArray(key) ? makeCacheKey(...key) : key;
  const cache = getCache<T>();

  const [isMutating, setIsMutating] = useState(false);
  const [optimisticData, setOptimisticData] = useState<T | undefined>();
  const [originalData, setOriginalData] = useState<T | undefined>();

  const mutate = useCallback(async () => {
    // Get current data
    const currentData = cache.get(cacheKey) ?? optimisticData;

    // Store original for rollback
    if (rollbackOnError && originalData === undefined) {
      setOriginalData(currentData);
    }

    setIsMutating(true);

    try {
      if (optimisticUpdate) {
        // For optimistic updates, we'll call the mutator
        // but show loading state immediately
      }

      // Call mutation function
      const result = await mutator(currentData);

      // Cache result
      cache.set(cacheKey, result, { ttl, tags, persistToL2: true });

      // Update state
      setOptimisticData(undefined);
      setOriginalData(undefined);

      // Success callback
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      // Rollback on error
      if (rollbackOnError && originalData !== undefined) {
        cache.set(cacheKey, originalData, { ttl, tags });
        setOptimisticData(undefined);
      }

      // Error callback
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }

      throw error;
    } finally {
      setIsMutating(false);
    }
  }, [cacheKey, mutator, ttl, tags, optimisticUpdate, rollbackOnError, onSuccess, onError, originalData]);

  const reset = useCallback(() => {
    cache.delete(cacheKey);
    setOptimisticData(undefined);
    setOriginalData(undefined);
  }, [cacheKey]);

  return {
    mutate,
    reset,
    isMutating: isMutating || optimisticData !== undefined,
  };
}

// ============================================================================
// useCacheInvalidate Hook
// ============================================================================

export function useCacheInvalidate(): {
  invalidateByKey: (key: string | string[]) => void;
  invalidateByTag: (tag: string) => Promise<void>;
  invalidateByPrefix: (prefix: string) => Promise<void>;
  invalidateAll: () => Promise<void>;
  isOffline: boolean;
  queuedMutations: number;
} {
  const cache = getCache();

  const invalidateByKey = useCallback((key: string | string[]) => {
    const cacheKey = Array.isArray(key) ? makeCacheKey(...key) : key;
    cache.delete(cacheKey);
  }, [cache]);

  const invalidateByTag = useCallback(async (tag: string) => {
    await cache.invalidateByTag(tag);
  }, [cache]);

  const invalidateByPrefix = useCallback(async (prefix: string) => {
    await cache.invalidateByPrefix(prefix);
  }, [cache]);

  const invalidateAll = useCallback(async () => {
    await cache.clear();
  }, [cache]);

  return {
    invalidateByKey,
    invalidateByTag,
    invalidateByPrefix,
    invalidateAll,
    isOffline: offlineDetector.isOffline(),
    queuedMutations: offlineDetector.getQueueSize(),
  };
}

// ============================================================================
// useCacheMetrics Hook
// ============================================================================

export function useCacheMetrics(): {
  metrics: CacheStats | undefined;
  hitRate: number;
  missRate: number;
  totalSize: number;
  refreshMetrics: () => void;
  isOffline: boolean;
} {
  const cache = getCache();

  const [metrics, setMetrics] = useState<CacheStats | undefined>(() => cache.getMetrics());

  const refreshMetrics = useCallback(() => {
    setMetrics(cache.getMetrics());
  }, [cache]);

  // Auto-refresh metrics every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(cache.getMetrics());
    }, 5000);

    return () => clearInterval(interval);
  }, [cache]);

  const hitRate = metrics?.aggregate.hitRate ?? 0;
  const missRate = metrics?.aggregate.missRate ?? 0;
  const totalSize = metrics?.aggregate.size ?? 0;

  return {
    metrics,
    hitRate,
    missRate,
    totalSize,
    refreshMetrics,
    isOffline: offlineDetector.isOffline(),
  };
}

// ============================================================================
// useOfflineMutation Hook
// ============================================================================

export function useOfflineMutation<T>(
  key: string | string[],
  mutator: (data: T | undefined) => Promise<T>,
  options: UseCacheMutationOptions<T> = {}
): {
  mutate: () => Promise<void>;
  sync: () => Promise<number>;
  isPending: boolean;
} {
  const cacheKey = Array.isArray(key) ? makeCacheKey(...key) : key;

  const mutate = useCallback(async () => {
    if (offlineDetector.isOffline()) {
      // Queue mutation for when online
      offlineDetector.queueMutation('set', cacheKey);
      return;
    }

    // Execute mutation immediately if online
    try {
      const result = await mutator(undefined);
      cache.set(cacheKey, result, options);
    } catch (error) {
      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }, [cacheKey, mutator, options]);

  const sync = useCallback(async () => {
    return offlineDetector.syncMutations(cache as any);
  }, [cache]);

  const isPending = offlineDetector.getQueueSize() > 0;

  return {
    mutate,
    sync,
    isPending,
  };
}

// ============================================================================
// usePrefetch Hook
// ============================================================================

export function usePrefetch(): {
  prefetch: (key: string | string[], fetcher: () => Promise<unknown>, options?: CacheOptions<unknown>) => Promise<void>;
  prefetchMultiple: (entries: Array<{ key: string | string[]; fetcher: () => Promise<unknown>; options?: CacheOptions<unknown> }>) => Promise<void>;
} {
  const cache = getCache();

  const prefetch = useCallback(async (
    key: string | string[],
    fetcher: () => Promise<unknown>,
    options: CacheOptions<unknown> = {}
  ) => {
    const cacheKey = Array.isArray(key) ? makeCacheKey(...key) : key;

    // Skip if already cached
    if (await cache.has(cacheKey)) {
      console.debug(`[usePrefetch] Already cached: ${cacheKey}`);
      return;
    }

    try {
      console.debug(`[usePrefetch] Prefetching: ${cacheKey}`);
      const data = await fetcher();
      cache.set(cacheKey, data, options);
    } catch (error) {
      console.warn(`[usePrefetch] Failed to prefetch ${cacheKey}:`, error);
    }
  }, [cache]);

  const prefetchMultiple = useCallback(async (entries) => {
    // Prefetch in parallel with priority sorting
    const sorted = [...entries].sort((a, b) => (b.options?.priority ?? 0) - (a.options?.priority ?? 0));

    await Promise.all(
      sorted.map(entry => prefetch(entry.key, entry.fetcher, entry.options))
    );
  }, [cache, prefetch]);

  return { prefetch, prefetchMultiple };
}

// ============================================================================
// Cache Entry Hook Component
// ============================================================================

export interface UseCacheEntryOptions<T> {
  staleTime?: number; // ms before data is considered stale
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useCacheEntry<T>(
  key: string | string[],
  options: UseCacheEntryOptions<T> = {}
): CacheEntry<T> | undefined {
  const cacheKey = Array.isArray(key) ? makeCacheKey(...key) : key;
  const cache = getCache<T>();

  const entryRef = useRef<CacheEntry<T> | undefined>();

  // Get entry from cache
  useEffect(() => {
    const data = cache.get(cacheKey);

    if (data !== undefined) {
      const now = Date.now();
      entryRef.current = {
        value: data,
        createdAt: now,
        accessedAt: now,
        accessCount: (entryRef.current?.accessCount ?? 0) + 1,
        size: JSON.stringify(data).length * 2,
      };

      // Success callback
      if (options.onSuccess) {
        options.onSuccess(data);
      }
    } else {
      // Error callback for cache miss
      if (options.onError) {
        options.onError(new Error(`Cache miss for ${cacheKey}`));
      }
    }
  }, [cacheKey]);

  return entryRef.current;
}

// ============================================================================
// Cache Stats Hook for Analytics
// ============================================================================

export interface CachePerformanceData {
  key: string;
  hitCount: number;
  missCount: number;
  lastAccess: number;
  avgLoadTime: number;
}

export function useCachePerformance(): {
  recordHit: (key: string, loadTime?: number) => void;
  recordMiss: (key: string, loadTime?: number) => void;
  getTopKeys: (limit?: number) => string[];
  getPerformance: () => Map<string, CachePerformanceData>;
  clearPerformance: () => void;
} {
  const performanceRef = useRef(new Map<string, CachePerformanceData>());

  const recordHit = useCallback((key: string, loadTime = 0) => {
    const existing = performanceRef.current.get(key);

    performanceRef.current.set(key, {
      key,
      hitCount: (existing?.hitCount ?? 0) + 1,
      missCount: existing?.missCount ?? 0,
      lastAccess: Date.now(),
      avgLoadTime: existing
        ? (existing.avgLoadTime * existing.hitCount + loadTime) / (existing.hitCount + 1)
        : loadTime,
    });
  }, []);

  const recordMiss = useCallback((key: string, loadTime = 0) => {
    const existing = performanceRef.current.get(key);

    performanceRef.current.set(key, {
      key,
      hitCount: existing?.hitCount ?? 0,
      missCount: (existing?.missCount ?? 0) + 1,
      lastAccess: Date.now(),
      avgLoadTime: existing
        ? (existing.avgLoadTime * (existing.hitCount + existing.missCount) + loadTime) / (existing.hitCount + existing.missCount + 1)
        : loadTime,
    });
  }, []);

  const getTopKeys = useCallback((limit = 10) => {
    return Array.from(performanceRef.current.values())
      .sort((a, b) => (b.hitCount + b.missCount) - (a.hitCount + a.missCount))
      .slice(0, limit)
      .map(d => d.key);
  }, []);

  const getPerformance = useCallback(() => {
    return performanceRef.current;
  }, []);

  const clearPerformance = useCallback(() => {
    performanceRef.current.clear();
  }, []);

  return {
    recordHit,
    recordMiss,
    getTopKeys,
    getPerformance,
    clearPerformance,
  };
}
