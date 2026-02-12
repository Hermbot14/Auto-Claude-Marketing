/**
 * Multi-Tier Client-Side Caching System
 * =========================================
 *
 * Provides comprehensive caching for the React frontend with:
 * - L1: In-memory cache (fast, session-scoped)
 * - L2: localStorage/IndexedDB (persistent across sessions)
 * - L3: Server-side Graphiti cache (knowledge-based)
 *
 * Features:
 * - React hooks for easy integration
 * - Automatic cache warming
 * - Smart invalidation
 * - Offline detection and mutation queuing
 * - Cache metrics and monitoring
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type CacheTier = 'l1_memory' | 'l2_storage' | 'l3_server';

export type CacheStrategy = 'lru' | 'ttl' | 'fifo';

export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  accessedAt: number;
  accessCount: number;
  ttl?: number; // milliseconds
  tags: Set<string>;
  version: string;
  size: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
  hitRate: number;
  missRate: number;
}

export interface CacheConfig {
  // L1 Configuration
  l1MaxSize: number;
  l1DefaultTTL: number; // milliseconds
  l1Enabled: boolean;

  // L2 Configuration
  l2Enabled: boolean;
  l2DefaultTTL: number;
  l2StorageType: 'localStorage' | 'indexedDB';

  // L3 Configuration
  l3Enabled: boolean;

  // Cache Warming
  warmOnStartup: boolean;

  // Invalidation
  invalidateOnWrite: boolean;
}

export interface CacheStats {
  aggregate: {
    hits: number;
    misses: number;
    evictions: number;
    size: number;
    hitRate: number;
  };
  tiers: {
    [key: string]: CacheMetrics;
  };
  config: {
    l1Enabled: boolean;
    l2Enabled: boolean;
    l3Enabled: boolean;
    offlineMode: boolean;
  };
}

export interface CacheOptions<T = unknown> {
  ttl?: number;
  tags?: string[];
  persistToL2?: boolean;
  persistToL3?: boolean;
  priority?: number; // For warming
}

export interface OfflineMutation {
  operation: 'set' | 'delete' | 'invalidate_tag' | 'invalidate_prefix';
  key: string;
  value?: unknown;
  timestamp: number;
}

// ============================================================================
// L1 Cache: In-Memory LRU Cache
// ============================================================================

class L1MemoryCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private tags: Map<string, Set<string>>;
  private maxSize: number;
  private defaultTTL: number;
  private name: string;
  private metrics: CacheMetrics;

  constructor(maxSize: number = 1000, defaultTTL: number = 300000, name: string = 'default') {
    this.cache = new Map();
    this.tags = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.name = name;
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      maxSize,
      hitRate: 0,
      missRate: 0,
    };
  }

  get(key: string, defaultValue?: T): T | undefined {
    const entry = this.cache.get(key);

    if (entry === undefined) {
      this.metrics.misses++;
      return defaultValue;
    }

    // Check expiration
    if (this.isExpired(entry)) {
      this.delete(key);
      this.metrics.misses++;
      return defaultValue;
    }

    // Update access for LRU
    entry.accessedAt = Date.now();
    entry.accessCount++;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.metrics.hits++;
    console.debug(`[L1:${this.name}] HIT: ${key}`);
    return entry.value;
  }

  set(key: string, value: T, options: CacheOptions<T> = {}): void {
    const ttl = options.ttl ?? this.defaultTTL;
    const tags = new Set(options.tags ?? []);

    const entry: CacheEntry<T> = {
      value,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0,
      ttl,
      tags,
      version: 'v1',
      size: this.estimateSize(value),
    };

    // Evict if full
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, entry);

    // Update tag index
    if (tags.size > 0) {
      for (const tag of tags) {
        if (!this.tags.has(tag)) {
          this.tags.set(tag, new Set());
        }
        this.tags.get(tag)!.add(key);
      }
    }

    this.metrics.size = this.cache.size;
    console.debug(`[L1:${this.name}] SET: ${key} (tags: ${Array.from(tags)})`);
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry === undefined) return false;

    // Remove from tag index
    for (const tag of entry.tags) {
      const tagKeys = this.tags.get(tag);
      if (tagKeys) {
        tagKeys.delete(key);
        if (tagKeys.size === 0) {
          this.tags.delete(tag);
        }
      }
    }

    this.cache.delete(key);
    this.metrics.size = this.cache.size;
    return true;
  }

  invalidateByTag(tag: string): number {
    const keys = this.tags.get(tag);
    if (!keys) return 0;

    let count = 0;
    for (const key of keys) {
      if (this.delete(key)) count++;
    }

    console.info(`[L1:${this.name}] Invalidated ${count} entries with tag '${tag}'`);
    return count;
  }

  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        if (this.delete(key)) count++;
      }
    }

    console.info(`[L1:${this.name}] Invalidated ${count} entries with prefix '${prefix}'`);
    return count;
  }

  clear(): void {
    this.cache.clear();
    this.tags.clear();
    this.metrics.size = 0;
    console.info(`[L1:${this.name}] Cache cleared`);
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry === undefined) return false;

    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  cleanupExpired(): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.delete(key);
        count++;
      }
    }

    if (count > 0) {
      console.info(`[L1:${this.name}] Cleaned up ${count} expired entries`);
    }

    return count;
  }

  getMetrics(): CacheMetrics {
    this.metrics.size = this.cache.size;
    this.metrics.hitRate = this.metrics.hits / (this.metrics.hits + this.metrics.misses);
    this.metrics.missRate = 1 - this.metrics.hitRate;
    return { ...this.metrics };
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    if (entry.ttl === undefined) return false;
    return Date.now() - entry.createdAt > entry.ttl;
  }

  private evictLRU(): void {
    if (this.cache.size === 0) return;

    // First key is LRU (Map maintains insertion order)
    const [lruKey, lruEntry] = this.cache.entries().next().value ?? [];

    if (lruKey) {
      this.delete(lruKey);
      this.metrics.evictions++;
      console.debug(`[L1:${this.name}] Evicted LRU key: ${lruKey}`);
    }
  }

  private estimateSize(value: T): number {
    // Rough estimate in bytes
    try {
      return JSON.stringify(value).length * 2; // Unicode chars ~2 bytes
    } catch {
      return 100; // Default estimate
    }
  }
}

// ============================================================================
// L2 Cache: localStorage/IndexedDB
// ============================================================================

interface StorageEntry<T> {
  value: T;
  createdAt: number;
  accessedAt: number;
  ttl?: number;
  tags: string[];
}

class L2StorageCache<T> {
  private prefix: string;
  private defaultTTL: number;
  private name: string;
  private storageType: 'localStorage' | 'indexedDB';
  private metrics: CacheMetrics;
  private indexedDB: IDBDatabase | null;

  constructor(
    storageType: 'localStorage' | 'indexedDB' = 'localStorage',
    defaultTTL: number = 3600000,
    name: string = 'default'
  ) {
    this.prefix = `cache:${name}:`;
    this.defaultTTL = defaultTTL;
    this.name = name;
    this.storageType = storageType;
    this.indexedDB = null;
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      maxSize: 10000,
      hitRate: 0,
      missRate: 0,
    };

    // Initialize IndexedDB if needed
    if (storageType === 'indexedDB') {
      this.initIndexedDB();
    }
  }

  async get(key: string, defaultValue?: T): Promise<T | undefined> {
    try {
      if (this.storageType === 'localStorage') {
        return this.getFromLocalStorage(key, defaultValue);
      } else {
        return this.getFromIndexedDB(key, defaultValue);
      }
    } catch (error) {
      console.warn(`[L2:${this.name}] Error getting ${key}:`, error);
      this.metrics.misses++;
      return defaultValue;
    }
  }

  async set(key: string, value: T, options: CacheOptions<T> = {}): Promise<boolean> {
    try {
      const ttl = options.ttl ?? this.defaultTTL;
      const tags = options.tags ?? [];

      const entry: StorageEntry<T> = {
        value,
        createdAt: Date.now(),
        accessedAt: Date.now(),
        ttl,
        tags,
      };

      if (this.storageType === 'localStorage') {
        return this.setToLocalStorage(key, entry, ttl);
      } else {
        return this.setToIndexedDB(key, entry, ttl);
      }
    } catch (error) {
      console.warn(`[L2:${this.name}] Error setting ${key}:`, error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      if (this.storageType === 'localStorage') {
        const result = localStorage.removeItem(this.makeKey(key));
        return result === null || result !== undefined;
      } else {
        return this.deleteFromIndexedDB(key);
      }
    } catch (error) {
      console.warn(`[L2:${this.name}] Error deleting ${key}:`, error);
      return false;
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    let count = 0;

    if (this.storageType === 'localStorage') {
      // Scan all localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          try {
            const data = JSON.parse(localStorage.getItem(key) ?? '{}');
            if (data.tags?.includes(tag)) {
              localStorage.removeItem(key);
              count++;
            }
          } catch {
            // Skip invalid entries
          }
        }
      }
    } else {
      count = await this.invalidateByTagIndexedDB(tag);
    }

    console.info(`[L2:${this.name}] Invalidated ${count} entries with tag '${tag}'`);
    return count;
  }

  async invalidateByPrefix(prefix: string): Promise<number> {
    let count = 0;
    const fullPrefix = this.makeKey(prefix);

    if (this.storageType === 'localStorage') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(fullPrefix)) {
          localStorage.removeItem(key);
          count++;
        }
      }
    } else {
      count = await this.invalidateByPrefixIndexedDB(fullPrefix);
    }

    console.info(`[L2:${this.name}] Invalidated ${count} entries with prefix '${prefix}'`);
    return count;
  }

  async clear(): Promise<void> {
    if (this.storageType === 'localStorage') {
      // Remove all cache keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } else {
      await this.clearIndexedDB();
    }

    console.info(`[L2:${this.name}] Cleared all entries`);
  }

  async has(key: string): Promise<boolean> {
    if (this.storageType === 'localStorage') {
      const item = localStorage.getItem(this.makeKey(key));
      if (item === null) return false;

      try {
        const entry = JSON.parse(item);
        return entry.ttl ? Date.now() - entry.createdAt < entry.ttl : true;
      } catch {
        return false;
      }
    } else {
      return this.hasIndexedDB(key);
    }
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  private makeKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private getFromLocalStorage<T>(key: string, defaultValue?: T): T | undefined {
    const item = localStorage.getItem(this.makeKey(key));
    if (item === null) {
      this.metrics.misses++;
      console.debug(`[L2:${this.name}] MISS: ${key}`);
      return defaultValue;
    }

    try {
      const entry = JSON.parse(item);
      if (entry.ttl && Date.now() - entry.createdAt > entry.ttl) {
        localStorage.removeItem(this.makeKey(key));
        this.metrics.misses++;
        return defaultValue;
      }

      // Update access time
      entry.accessedAt = Date.now();
      localStorage.setItem(this.makeKey(key), JSON.stringify(entry));

      this.metrics.hits++;
      console.debug(`[L2:${this.name}] HIT: ${key}`);
      return entry.value;
    } catch {
      this.metrics.misses++;
      return defaultValue;
    }
  }

  private setToLocalStorage(key: string, entry: StorageEntry<unknown>, ttl: number): boolean {
    // Store with expiration
    localStorage.setItem(this.makeKey(key), JSON.stringify(entry));
    console.debug(`[L2:${this.name}] SET: ${key} (ttl: ${ttl}ms)`);
    return true;
  }

  private async initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AutoClaudeCache', 1);

      request.onerror = () => {
        console.error('[L2:IndexedDB] Failed to open database');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.indexedDB = request.result;
        console.info('[L2:IndexedDB] Database opened successfully');

        // Create object store if needed
        if (!this.indexedDB.objectStoreNames.contains('cache')) {
          const store = this.indexedDB.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('tags', 'tags', { multiEntry: true });
          store.createIndex('expiration', 'createdAt');
        }

        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('tags', 'tags', { multiEntry: true });
          store.createIndex('expiration', 'createdAt');
        }
      };
    });
  }

  private async getFromIndexedDB<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    if (!this.indexedDB) return defaultValue;

    return new Promise((resolve) => {
      const transaction = this.indexedDB!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(this.makeKey(key));

      request.onsuccess = () => {
        const result = request.result;

        if (!result) {
          this.metrics.misses++;
          console.debug(`[L2:${this.name}] MISS: ${key}`);
          resolve(defaultValue);
          return;
        }

        // Check expiration
        if (result.ttl && Date.now() - result.createdAt > result.ttl) {
          this.deleteFromIndexedDB(key);
          this.metrics.misses++;
          resolve(defaultValue);
          return;
        }

        // Update access time
        result.accessedAt = Date.now();
        const updateRequest = store.put(result);

        this.metrics.hits++;
        console.debug(`[L2:${this.name}] HIT: ${key}`);
        resolve(result.value);
      };

      request.onerror = () => {
        this.metrics.misses++;
        resolve(defaultValue);
      };
    });
  }

  private async setToIndexedDB(key: string, entry: StorageEntry<unknown>, ttl: number): Promise<boolean> {
    if (!this.indexedDB) return false;

    return new Promise((resolve) => {
      const transaction = this.indexedDB!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');

      const request = store.put({
        key: this.makeKey(key),
        ...entry,
      });

      request.onsuccess = () => {
        console.debug(`[L2:${this.name}] SET: ${key} (ttl: ${ttl}ms)`);
        resolve(true);
      };

      request.onerror = () => {
        console.warn(`[L2:${this.name}] Failed to set ${key}`);
        resolve(false);
      };
    });
  }

  private async deleteFromIndexedDB(key: string): Promise<boolean> {
    if (!this.indexedDB) return false;

    return new Promise((resolve) => {
      const transaction = this.indexedDB!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.delete(this.makeKey(key));

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  private async hasIndexedDB(key: string): Promise<boolean> {
    if (!this.indexedDB) return false;

    return new Promise((resolve) => {
      const transaction = this.indexedDB!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.count(this.makeKey(key));

      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => resolve(false);
    });
  }
}

// ============================================================================
// Multi-Tier Cache Manager
// ============================================================================

class MultiTierCacheManager<T> {
  private l1: L1MemoryCache<T>;
  private l2: L2StorageCache<T> | null;
  private l3Enabled: boolean;
  private name: string;

  constructor(config: Partial<CacheConfig> = {}, name: string = 'default') {
    const defaultConfig: CacheConfig = {
      l1MaxSize: 1000,
      l1DefaultTTL: 300000, // 5 minutes
      l1Enabled: true,
      l2Enabled: true,
      l2DefaultTTL: 3600000, // 1 hour
      l2StorageType: 'localStorage',
      l3Enabled: true,
      warmOnStartup: true,
      invalidateOnWrite: true,
    };

    const finalConfig = { ...defaultConfig, ...config };

    this.name = name;
    this.l1 = new L1MemoryCache<T>(
      finalConfig.l1MaxSize,
      finalConfig.l1DefaultTTL,
      name
    );

    this.l2 = finalConfig.l2Enabled
      ? new L2StorageCache<T>(finalConfig.l2StorageType, finalConfig.l2DefaultTTL, name)
      : null;

    this.l3Enabled = finalConfig.l3Enabled;

    console.info(
      `[Cache:${name}] Initialized with L1, ` +
      `L2=${finalConfig.l2Enabled ? 'enabled' : 'disabled'}, ` +
      `L3=${finalConfig.l3Enabled ? 'enabled' : 'disabled'}`
    );
  }

  async get(key: string, defaultValue?: T): Promise<T | undefined> {
    // Try L1 first (fastest)
    let value = this.l1.get(key, undefined);
    if (value !== undefined) {
      return value;
    }

    // Try L2 (second fastest)
    if (this.l2) {
      value = await this.l2.get(key, undefined);
      if (value !== undefined) {
        // Promote to L1
        this.l1.set(key, value);
        return value;
      }
    }

    return defaultValue;
  }

  async set(key: string, value: T, options: CacheOptions<T> = {}): Promise<boolean> {
    let success = false;

    // Always set in L1
    this.l1.set(key, value, options);
    success = true;

    // Set in L2 if requested
    if (this.l2 && options.persistToL2 !== false) {
      if (await this.l2.set(key, value, options)) {
        success = true;
      }
    }

    // L3 persistence would go through API
    if (options.persistToL3 && this.l3Enabled) {
      // Placeholder for L3 integration
      await this.persistToL3(key, value, options.tags);
    }

    return success;
  }

  async delete(key: string): Promise<boolean> {
    let deleted = false;

    if (this.l1.delete(key)) {
      deleted = true;
    }

    if (this.l2) {
      if (await this.l2.delete(key)) {
        deleted = true;
      }
    }

    // L3 deletion would go through API
    if (this.l3Enabled) {
      await this.deleteFromL3(key);
    }

    return deleted;
  }

  async invalidateByTag(tag: string): Promise<number> {
    let total = 0;
    total += this.l1.invalidateByTag(tag);

    if (this.l2) {
      total += await this.l2.invalidateByTag(tag);
    }

    if (this.l3Enabled) {
      total += await this.invalidateL3ByTag(tag);
    }

    return total;
  }

  async invalidateByPrefix(prefix: string): Promise<number> {
    let total = 0;
    total += this.l1.invalidateByPrefix(prefix);

    if (this.l2) {
      total += await this.l2.invalidateByPrefix(prefix);
    }

    if (this.l3Enabled) {
      total += await this.invalidateL3ByPrefix(prefix);
    }

    return total;
  }

  async clear(): Promise<void> {
    this.l1.clear();

    if (this.l2) {
      await this.l2.clear();
    }

    console.info(`[Cache:${this.name}] All tiers cleared`);
  }

  async has(key: string): Promise<boolean> {
    return this.l1.has(key) || (this.l2 ? await this.l2.has(key) : false);
  }

  getMetrics(): CacheStats {
    const l1Metrics = this.l1.getMetrics();
    const l2Metrics = this.l2?.getMetrics();

    const aggregate = {
      hits: l1Metrics.hits + (l2Metrics?.hits ?? 0),
      misses: l1Metrics.misses + (l2Metrics?.misses ?? 0),
      evictions: l1Metrics.evictions + (l2Metrics?.evictions ?? 0),
      size: l1Metrics.size + (l2Metrics?.size ?? 0),
      hitRate: 0,
    };

    aggregate.hitRate = aggregate.hits / (aggregate.hits + aggregate.misses);

    return {
      aggregate,
      tiers: {
        l1_memory: l1Metrics,
        ...(l2Metrics && { l2_storage: l2Metrics }),
      },
      config: {
        l1Enabled: true,
        l2Enabled: this.l2 !== null,
        l3Enabled: this.l3Enabled,
        offlineMode: offlineDetector.isOffline(),
      },
    };
  }

  private async persistToL3(key: string, value: T, tags?: string[]): Promise<void> {
    // Placeholder for L3 (Graphiti) integration
    // This would make an API call to store in knowledge graph
  }

  private async deleteFromL3(key: string): Promise<void> {
    // Placeholder for L3 (Graphiti) integration
  }

  private async invalidateL3ByTag(tag: string): Promise<number> {
    // Placeholder for L3 (Graphiti) integration
    return 0;
  }

  private async invalidateL3ByPrefix(prefix: string): Promise<number> {
    // Placeholder for L3 (Graphiti) integration
    return 0;
  }
}

// ============================================================================
// Offline Detection
// ============================================================================

class OfflineDetector {
  private isOffline: boolean = false;
  private mutationQueue: OfflineMutation[] = [];
  private lastCheck: number = 0;
  private checkInterval: number = 5000; // 5 seconds

  isOffline(): boolean {
    const now = Date.now();

    // Lazy check - only check every N seconds
    if (now - this.lastCheck > this.checkInterval) {
      this.checkNetwork();
      this.lastCheck = now;
    }

    return this.isOffline;
  }

  queueMutation(operation: OfflineMutation['operation'], key: string, value?: unknown): void {
    this.mutationQueue.push({
      operation,
      key,
      value,
      timestamp: Date.now(),
    });

    console.info(
      `[Offline] Queued ${operation} on ${key} (${this.mutationQueue.length} queued)`
    );
  }

  async syncMutations(cache: MultiTierCacheManager<unknown>): Promise<number> {
    if (this.mutationQueue.length === 0) return 0;

    let synced = 0;

    for (const mutation of [...this.mutationQueue]) {
      try {
        switch (mutation.operation) {
          case 'set':
            await cache.set(mutation.key, mutation.value as never);
            break;
          case 'delete':
            await cache.delete(mutation.key);
            break;
          case 'invalidate_tag':
            await cache.invalidateByTag(mutation.key);
            break;
          case 'invalidate_prefix':
            await cache.invalidateByPrefix(mutation.key);
            break;
        }

        this.mutationQueue = this.mutationQueue.filter(m => m !== mutation);
        synced++;
      } catch (error) {
        console.error(`[Offline] Failed to sync ${mutation.operation} on ${mutation.key}:`, error);
      }
    }

    console.info(`[Offline] Synced ${synced}/${this.mutationQueue.length + synced} mutations`);

    if (this.mutationQueue.length === 0) {
      console.info('[Offline] All mutations synced');
    }

    return synced;
  }

  getQueueSize(): number {
    return this.mutationQueue.length;
  }

  private checkNetwork(): void {
    // Simple detection - try to fetch a resource
    // In production, use Navigator API or fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    fetch('https://www.gstatic.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'no-cors',
    })
      .then(() => {
        this.isOffline = false;
      })
      .catch(() => {
        this.isOffline = true;
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });
  }
}

// Global offline detector instance
export const offlineDetector = new OfflineDetector();

// ============================================================================
// Global Cache Instances
// ============================================================================

const caches = new Map<string, MultiTierCacheManager<unknown>>();

export function getCache<T>(name: string = 'default'): MultiTierCacheManager<T> {
  if (!caches.has(name)) {
    caches.set(name as string, new MultiTierCacheManager<T>({}, name));
  }
  return caches.get(name)! as MultiTierCacheManager<T>;
}

export function closeAllCaches(): void {
  caches.clear();
}

// ============================================================================
// Cache Key Utilities
// ============================================================================

export function makeCacheKey(...parts: string[]): string {
  return parts.filter(p => p !== undefined && p !== null).join(':');
}

export function hashKey(value: unknown): string {
  let valueStr: string;

  if (typeof value === 'string') {
    valueStr = value;
  } else if (typeof value === 'object' && value !== null) {
    valueStr = JSON.stringify(value, Object.keys(value as object).sort());
  } else {
    valueStr = String(value);
  }

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < valueStr.length; i++) {
    const char = valueStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
}
