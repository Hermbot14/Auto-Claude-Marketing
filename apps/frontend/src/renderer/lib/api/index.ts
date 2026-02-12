/**
 * API Module
 * Unified HTTP client with retry, caching, and rate limiting
 *
 * Exports all API-related modules for consistent imports
 *
 * @deprecated Use API module instead of direct IPC or fetch calls
 */

// ============================================
// Core HTTP Client
// ============================================

export { HttpClient, httpClient, type RequestConfig, type HttpResponse, type RequestMetrics } from './HttpClient';
export type { HttpClientConfig } from './HttpClient';

// ============================================
// Retry Strategy
// ============================================

export { RetryStrategy, retryStrategy, type RetryOptions } from './RetryStrategy';
export { isPotentiallyRetryable, createRetryError } from './RetryStrategy';

// ============================================
// Error Middleware
// ============================================

export { ApiError, ErrorCodes, normalizeError, logError, getErrorLog, clearErrorLog, getErrorSummary, buildErrorResponse, getUserMessage, isAuthError, isNetworkError, shouldReAuth } from './ApiMiddleware';
export type { ApiErrorDetails } from './ApiMiddleware';

// ============================================
// Cache Middleware
// ============================================

export { ApiCache, apiCache, type CacheEntry, type CacheConfig, type CacheStats } from './ApiCache';
export { generateCacheKey, createCacheEntry, isExpired, getTimeUntilExpiration } from './ApiCache';

// ============================================
// Rate Limit Handler
// ============================================

export { RateLimitHandler, rateLimitHandler, type RateLimitInfo, type RateLimitConfig } from './RateLimitHandler';
export { isRateLimitedResponse, extractRateLimit, formatWaitTime } from './RateLimitHandler';

// ============================================
// Convenience Re-exports
// ============================================

/**
 * Create a pre-configured HTTP client instance
 */
export function createHttpClient(config?: Partial<import('./HttpClient').HttpClientConfig>): InstanceType<typeof HttpClient> {
  const { HttpClient } = require('./HttpClient');
  return new HttpClient(config);
}

/**
 * Create API error from unknown error type
 */
export function createApiError(error: unknown): ApiError {
  const { normalizeError } = require('./ApiMiddleware');
  return normalizeError(error);
}

// ============================================
// Types
// ============================================

export type { HttpClientConfig, RequestConfig, HttpResponse, RequestMetrics };
export type { RetryOptions, RetryContext };
export type { ApiErrorDetails };
export type { CacheEntry, CacheConfig, CacheStats };
export type { RateLimitInfo, RateLimitConfig };
