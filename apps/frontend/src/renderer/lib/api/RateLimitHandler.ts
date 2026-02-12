/**
 * Rate Limit Handler
 * Detects and handles rate limiting from APIs
 *
 * Features:
 * - Detect rate limit from response headers
 * - Exponential backoff for rate-limited requests
 * - Per-endpoint rate limit tracking
 * - Automatic retry timing calculation
 */

// ============================================
// Types
// ============================================

export interface RateLimitInfo {
  endpoint: string;
  resetTime: number; // Timestamp when limit resets
  remaining: number; // Remaining requests
  limit: number; // Total limit
  windowMs?: number; // Time window in milliseconds
}

export interface RateLimitConfig {
  enabled: boolean;
  defaultRetryAfter: number; // Default wait time in ms
  maxRetryAfter: number; // Maximum wait time in ms
  jitterFactor: number; // Random jitter to avoid thundering herd
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: RateLimitConfig = {
  enabled: true,
  defaultRetryAfter: 1000, // 1 second
  maxRetryAfter: 60000, // 1 minute
  jitterFactor: 0.1, // 10% jitter
};

// ============================================
// Common Rate Limit Headers
// ============================================

const RATE_LIMIT_HEADERS = {
  // Standard headers
  'RateLimit-Limit': 'x-rate-limit-limit',
  'RateLimit-Remaining': 'x-rate-limit-remaining',
  'RateLimit-Reset': 'x-rate-limit-reset',

  // Cloudflare
  'CFLimit': 'cf-ray',

  // GitHub
  'X-RateLimit-Remaining': 'x-ratelimit-remaining',
  'X-RateLimit-Reset': 'x-ratelimit-reset',
  'X-RateLimit-Used': 'x-ratelimit-used',

  // Twitter/X
  'X-RateLimit-Limit': 'x-rate-limit-limit',
  'X-RateLimit-Remaining': 'x-rate-limit-remaining',
  'X-RateLimit-Reset': 'x-rate-limit-reset',

  // Google
  'X-HTTP-Quota-Reset': 'x-http-quota-reset',

  // AWS
  'X-Amz-Bucket-Region': 'x-amz-bucket-region',
} as const;

// ============================================
// Rate Limit Handler Class
// ============================================

export class RateLimitHandler {
  private config: RateLimitConfig;
  private rateLimits: Map<string, RateLimitInfo> = new Map();
  private waitUntil: number = 0;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check response for rate limit headers
   */
  handleRateLimit(response: Response): void {
    if (!this.config.enabled) {
      return;
    }

    const limitInfo = this.parseRateLimitHeaders(response);
    if (limitInfo) {
      this.recordRateLimit(limitInfo);
    }
  }

  /**
   * Parse rate limit from response headers
   */
  private parseRateLimitHeaders(response: Response): RateLimitInfo | null {
    const headers = response.headers;

    // Try to parse standard headers
    const limit = headers.get('RateLimit-Limit') ||
                      headers.get('X-RateLimit-Limit');
    const remaining = headers.get('RateLimit-Remaining') ||
                         headers.get('X-RateLimit-Remaining');
    const reset = headers.get('RateLimit-Reset') ||
                   headers.get('X-RateLimit-Reset');

    if (limit || remaining || reset) {
      const now = Date.now();
      const resetTime = reset ? parseInt(reset) * 1000 : now + 60000; // Default 1 hour

      return {
        endpoint: response.url,
        resetTime,
        remaining: remaining ? parseInt(remaining) : 0,
        limit: limit ? parseInt(limit) : 0,
      };
    }

    return null;
  }

  /**
   * Record rate limit info
   */
  private recordRateLimit(info: RateLimitInfo): void {
    const key = `${info.endpoint}:${info.resetTime}`;
    this.rateLimits.set(key, info);

    console.warn(`[RateLimitHandler] Rate limit detected for ${info.endpoint}`, {
      remaining: info.remaining,
      limit: info.limit,
      resetTime: new Date(info.resetTime).toISOString(),
    });
  }

  /**
   * Wait until rate limit resets
   */
  async waitForSlot(): Promise<void> {
    const now = Date.now();

    // Check if we need to wait
    if (now < this.waitUntil) {
      const waitTime = this.waitUntil - now;

      console.log(`[RateLimitHandler] Waiting ${waitTime}ms for rate limit reset`);

      await this.delay(waitTime);
      this.waitUntil = 0;
    }
  }

  /**
   * Calculate wait time based on rate limit info
   */
  private calculateWaitTime(info: RateLimitInfo): number {
    const now = Date.now();
    const timeUntilReset = Math.max(0, info.resetTime - now);

    // Add jitter to avoid thundering herd
    const jitter = Math.random() * this.config.jitterFactor * timeUntilReset;

    return Math.min(
      timeUntilReset + jitter,
      this.config.maxRetryAfter
    );
  }

  /**
   * Delay with jitter
   */
  private async delay(ms: number): Promise<void> {
    const actualDelay = ms + (Math.random() * this.config.jitterFactor * ms);
    return new Promise((resolve) => setTimeout(resolve, actualDelay));
  }

  /**
   * Check if endpoint is currently rate limited
   */
  isRateLimited(endpoint?: string): boolean {
    const now = Date.now();

    for (const [key, info] of this.rateLimits.entries()) {
      if (endpoint && info.endpoint !== endpoint) {
        continue;
      }

      if (now < info.resetTime && info.remaining <= 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get wait time until rate limit resets
   */
  getWaitTime(endpoint?: string): number {
    const now = Date.now();

    for (const [key, info] of this.rateLimits.entries()) {
      if (endpoint && info.endpoint !== endpoint) {
        continue;
      }

      if (now < info.resetTime) {
        return info.resetTime - now;
      }
    }

    return 0;
  }

  /**
   * Clear expired rate limits
   */
  cleanExpired(): void {
    const now = Date.now();

    for (const [key, info] of this.rateLimits.entries()) {
      if (now >= info.resetTime) {
        this.rateLimits.delete(key);
      }
    }
  }

  /**
   * Clear all rate limits
   */
  clear(): void {
    this.rateLimits.clear();
    this.waitUntil = 0;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get rate limit info for an endpoint
   */
  getRateLimit(endpoint: string): RateLimitInfo | null {
    const now = Date.now();

    for (const [key, info] of this.rateLimits.entries()) {
      if (info.endpoint === endpoint && now < info.resetTime) {
        return info;
      }
    }

    return null;
  }

  /**
   * Get all rate limit info
   */
  getAllRateLimits(): Map<string, RateLimitInfo> {
    return new Map(this.rateLimits);
  }

  /**
   * Get rate limit statistics
   */
  getStats(): {
    total: number;
    active: number;
    byEndpoint: Record<string, RateLimitInfo>;
  } {
    const now = Date.now();
    const active = new Map<string, RateLimitInfo>();
    let total = 0;

    for (const [key, info] of this.rateLimits.entries()) {
      total++;
      if (now < info.resetTime && info.remaining <= 0) {
        active.set(key, info);
      }
    }

    const byEndpoint: Record<string, RateLimitInfo> = {};
    for (const [key, info] of this.rateLimits) {
      byEndpoint[info.endpoint] = info;
    }

    return {
      total,
      active: active.size,
      byEndpoint,
    };
  }
}

// ============================================
// Singleton Instance
// ============================================

export const rateLimitHandler = new RateLimitHandler();

// ============================================
// Helper Functions
// ============================================

/**
 * Check if response indicates rate limiting
 */
export function isRateLimitedResponse(response: Response): boolean {
  return response.status === 429 ||
         response.headers.has('X-RateLimit-Remaining') ||
         response.headers.has('X-RateLimit-Limit');
}

/**
 * Extract rate limit from response
 */
export function extractRateLimit(response: Response): RateLimitInfo | null {
  return rateLimitHandler['parseRateLimitHeaders'](response);
}

/**
 * Format wait time as human readable string
 */
export function formatWaitTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  const minutes = Math.ceil(seconds / 60);
  const hours = Math.ceil(minutes / 60);

  if (hours > 1) {
    return `approximately ${hours} hours`;
  } else if (minutes > 1) {
    return `approximately ${minutes} minutes`;
  } else {
    return `approximately ${seconds} seconds`;
  }
}

// ============================================
// Export Types
// ============================================

export type { RateLimitInfo, RateLimitConfig };
