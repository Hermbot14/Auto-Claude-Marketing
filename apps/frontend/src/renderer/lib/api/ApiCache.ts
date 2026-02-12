/**
 * API Cache Middleware
 * In-memory caching for GET requests with TTL support
 *
 * Features:
 * - LRU (Least Recently Used) eviction
 * - Time-based expiration (TTL)
 * - Cache key generation
 * - Pattern-based invalidation
 * - Cache statistics
 */

// ============================================
// Types
// ============================================

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
  key: string;
  hits: number;
  size: number;
}

export interface CacheConfig {
  enabled: boolean;
  defaultTimeout: number;
  maxSize: number; // Maximum number of entries
  maxSizeBytes: number; // Maximum size in bytes (approximate)
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
  evicted: number;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: CacheConfig = {
  enabled: true,
  defaultTimeout: 300000, // 5 minutes
  maxSize: 1000,
  maxSizeBytes: 50 * 1024 * 1024, // 50 MB
};

// ============================================
// Cache Class
// ============================================

export class ApiCache {
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evicted: 0,
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
  }

  /**
   * Generate cache key from request config
   */
  private generateKey(url: string, params?: Record<string, any>, body?: any): string {
    const parts = [url];

    if (params) {
      const sortedParams = Object.keys(params).sort().map((key) => `${key}=${JSON.stringify(params[key])}`);
      parts.push(sortedParams.join('&'));
    }

    if (body) {
      parts.push(JSON.stringify(body));
    }

    return parts.join('|');
  }

  /**
   * Calculate approximate size of an entry
   */
  private calculateSize(data: any): number {
    return JSON.stringify(data).length * 2; // Approximate (2 bytes per char)
  }

  /**
   * Get cached data
   */
  get<T = any>(url: string, params?: Record<string, any>, body?: any): T | null {
    if (!this.config.enabled) {
      this.stats.misses++;
      return null;
    }

    const key = this.generateKey(url, params, body);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update hits and move to end (LRU)
    entry.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.stats.hits++;

    return entry.data as T;
  }

  /**
   * Set cached data
   */
  set<T = any>(
    url: string,
    data: T,
    timeout?: number,
    params?: Record<string, any>,
    body?: any
  ): void {
    if (!this.config.enabled) {
      return;
    }

    const key = this.generateKey(url, params, body);
    const now = Date.now();
    const ttl = timeout ?? this.config.defaultTimeout;

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      key,
      hits: 0,
      size: this.calculateSize(data),
    };

    // Check size limits
    this.evictIfNeeded(entry.size);

    this.cache.set(key, entry);
  }

  /**
   * Check if cache has key
   */
  has(url: string, params?: Record<string, any>, body?: any): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const key = this.generateKey(url, params, body);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check expiration
    return Date.now() <= entry.expiresAt;
  }

  /**
   * Clear cache by pattern
   */
  clear(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Evict entries if cache is too large
   */
  private evictIfNeeded(newEntrySize: number): void {
    // Check count limit
    while (this.cache.size >= this.config.maxSize) {
      // Remove first (oldest) entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evicted++;
      }
    }

    // Check size limit (approximate)
    let totalSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);

    while (totalSize + newEntrySize > this.config.maxSizeBytes && this.cache.size > 1) {
      // Remove least recently used entries
      const keysToRemove = this.getLRUEntries(Math.ceil((totalSize + newEntrySize - this.config.maxSizeBytes) / 1000));

      for (const key of keysToRemove) {
        const entry = this.cache.get(key);
        if (entry) {
          totalSize -= entry.size;
        }
        this.cache.delete(key);
        this.stats.evicted++;
      }
    }
  }

  /**
   * Get least recently used entries
   */
  private getLRUEntries(count: number): string[] {
    // Map preserves insertion order in JS, so first entries are oldest
    const keys = Array.from(this.cache.keys()).slice(0, count);
    return keys;
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      totalSize,
      evicted: this.stats.evicted,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evicted: 0,
    };
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// ============================================
// Singleton Instance
// ============================================

export const apiCache = new ApiCache();

// ============================================
// Helper Functions
// ============================================

/**
 * Generate cache key from URL and params
 */
export function generateCacheKey(url: string, params?: Record<string, any>, body?: any): string {
  return apiCache['generateKey'](url, params, body);
}

/**
 * Create cache entry with expiration
 */
export function createCacheEntry<T>(data: T, ttl: number): CacheEntry<T> {
  const now = Date.now();
  return {
    data,
    timestamp: now,
    expiresAt: now + ttl,
    key: '',
    hits: 0,
    size: JSON.stringify(data).length * 2,
  };
}

/**
 * Check if cache entry is expired
 */
export function isExpired(entry: CacheEntry): boolean {
  return Date.now() > entry.expiresAt;
}

/**
 * Get time until expiration in milliseconds
 */
export function getTimeUntilExpiration(entry: CacheEntry): number {
  return Math.max(0, entry.expiresAt - Date.now());
}

// ============================================
// Export Types
// ============================================

export type { CacheEntry, CacheConfig, CacheStats };
