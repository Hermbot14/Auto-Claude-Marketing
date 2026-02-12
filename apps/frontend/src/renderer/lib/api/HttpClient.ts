/**
 * Unified HTTP Client
 * Centralized HTTP communication with interceptors, retry, and caching
 *
 * Replaces scattered IPC calls and direct fetch with:
 * - Consistent error handling
 * - Automatic retry with exponential backoff
 * - Request/response caching
 * - Request cancellation support
 * - Type-safe endpoint definitions
 *
 * @deprecated Use HttpClient instead of direct IPC or fetch calls
 */

import { retryStrategy } from './RetryStrategy';
import { apiCache } from './ApiCache';
import { rateLimitHandler } from './RateLimitHandler';
import { ApiError, normalizeError, ErrorCodes } from './ApiMiddleware';

// ============================================
// Types
// ============================================

export interface HttpClientConfig {
  baseURL?: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  maxRetryDelay: number;
  enableCache: boolean;
  cacheTimeout: number;
  enableRequestCancel: boolean;
  enableRetry: boolean;
  enableRateLimiting: boolean;
  maxConcurrentRequests: number;
}

export interface RequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string | number>;
  signal?: AbortSignal;
  cache?: boolean;
  retry?: boolean;
  timeout?: number;
  skipAuth?: boolean;
  skipRateLimit?: boolean;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  cached: boolean;
  duration: number;
}

export interface RequestMetrics {
  url: string;
  method: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  cached: boolean;
  retried: boolean;
  retryCount: number;
  error?: string;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: HttpClientConfig = {
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second initial delay
  maxRetryDelay: 10000, // 10 seconds max delay
  enableCache: true,
  cacheTimeout: 300000, // 5 minutes
  enableRequestCancel: true,
  enableRetry: true,
  enableRateLimiting: true,
  maxConcurrentRequests: 10,
};

// ============================================
// Request Interceptor Types
// ============================================

export type RequestInterceptor = (
  config: RequestConfig
) => RequestConfig | Promise<RequestConfig>;

export type ResponseInterceptor = (
  response: HttpResponse
) => HttpResponse | Promise<HttpResponse>;

export type ErrorInterceptor = (
  error: ApiError
) => ApiError | Promise<ApiError> | void;

// ============================================
// HTTP Client Class
// ============================================

export class HttpClient {
  private config: HttpClientConfig;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];
  private activeRequests: Map<string, AbortController> = new Map();
  private requestMetrics: RequestMetrics[] = [];
  private activeRequestCount = 0;

  constructor(config: Partial<HttpClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================
  // Interceptor Management
  // ============================================

  useRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  useResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  useErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }

  clearInterceptors(): void {
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.errorInterceptors = [];
  }

  // ============================================
  // Request Execution
  // ============================================

  async request<T = any>(config: RequestConfig): Promise<HttpResponse<T>> {
    const startTime = performance.now();
    let retryCount = 0;
    let lastError: ApiError | null = null;

    // Check concurrent request limit
    if (this.activeRequestCount >= this.config.maxConcurrentRequests) {
      throw new ApiError({
        code: ErrorCodes.CONCURRENCY_LIMIT,
        message: 'Maximum concurrent requests reached',
        status: 429,
        retryable: false,
        userMessage: 'Too many requests, please wait',
        technicalDetails: { maxConcurrent: this.config.maxConcurrentRequests },
      });
    }

    // Create abort controller for this request
    const abortController = new AbortController();
    const requestId = `${config.method}:${config.url}:${Date.now()}`;
    this.activeRequests.set(requestId, abortController);
    this.activeRequestCount++;

    try {
      // Apply request interceptors
      let processedConfig = { ...config };
      for (const interceptor of this.requestInterceptors) {
        processedConfig = await interceptor(processedConfig);
      }

      // Check cache for GET requests
      if (this.config.enableCache && processedConfig.cache !== false && processedConfig.method === 'GET') {
        const cachedResponse = apiCache.get(processedConfig.url);
        if (cachedResponse) {
          this.recordMetric({
            url: processedConfig.url,
            method: processedConfig.method,
            startTime,
            endTime: performance.now(),
            duration: performance.now() - startTime,
            success: true,
            cached: true,
            retried: false,
            retryCount: 0,
          });

          return {
            ...cachedResponse,
            cached: true,
            duration: performance.now() - startTime,
          };
        }
      }

      // Rate limit check
      if (this.config.enableRateLimiting && !processedConfig.skipRateLimit) {
        await rateLimitHandler.waitForSlot();
      }

      // Execute with retry logic
      const response = await this.executeWithRetry<T>(processedConfig, abortController.signal);
      const data = await this.parseResponse<T>(response);

      // Cache GET responses
      if (this.config.enableCache && processedConfig.method === 'GET') {
        apiCache.set(processedConfig.url, data, this.config.cacheTimeout);
      }

      const httpResponse: HttpResponse<T> = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        cached: false,
        duration: performance.now() - startTime,
      };

      // Apply response interceptors
      let processedResponse = httpResponse;
      for (const interceptor of this.responseInterceptors) {
        processedResponse = await interceptor(processedResponse);
      }

      this.recordMetric({
        url: processedConfig.url,
        method: processedConfig.method,
        startTime,
        endTime: performance.now(),
        duration: performance.now() - startTime,
        success: true,
        cached: false,
        retried: retryCount > 0,
        retryCount,
      });

      return processedResponse;

    } catch (error) {
      const apiError = error instanceof ApiError ? error : normalizeError(error);
      lastError = apiError;

      // Apply error interceptors
      for (const interceptor of this.errorInterceptors) {
        const result = interceptor(apiError);
        if (result) {
          // If interceptor returns a value, use it (could be a recovered error)
          lastError = result instanceof ApiError ? result : apiError;
        }
      }

      this.recordMetric({
        url: config.url,
        method: config.method,
        startTime,
        endTime: performance.now(),
        duration: performance.now() - startTime,
        success: false,
        cached: false,
        retried: retryCount > 0,
        retryCount,
        error: lastError.message,
      });

      throw lastError;
    } finally {
      // Cleanup abort controller
      this.activeRequests.delete(requestId);
      this.activeRequestCount--;
    }
  }

  // ============================================
  // Execute with Retry
  // ============================================

  private async executeWithRetry<T>(
    config: RequestConfig,
    signal: AbortSignal
  ): Promise<Response> {
    if (!this.config.enableRetry || config.retry === false) {
      return this.fetchInternal<T>(config, signal);
    }

    return retryStrategy.execute(
      async () => this.fetchInternal<T>(config, signal),
      {
        maxRetries: config.retry !== undefined ? (config.retry ? this.config.maxRetries : 0) : this.config.maxRetries,
        signal,
      }
    );
  }

  // ============================================
  // Internal Fetch
  // ============================================

  private async fetchInternal<T>(
    config: RequestConfig,
    signal: AbortSignal
  ): Promise<Response> {
    const { url, method, headers, body, params, timeout } = config;

    // Build URL with params
    let finalUrl = url;
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      finalUrl += `?${searchParams.toString()}`;
    }

    // Add timeout to abort signal
    const timeoutSignal = this.createTimeoutSignal(timeout || this.config.timeout, signal);

    // Build headers
    const finalHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers || {}),
    };

    try {
      const response = await fetch(finalUrl, {
        method,
        headers: finalHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: timeoutSignal,
      });

      // Handle rate limiting from server
      if (response.status === 429) {
        await rateLimitHandler.handleRateLimit(response);
      }

      return response;

    } catch (error) {
      // Clean up timeout
      timeoutSignal.controller.abort();

      // Check if aborted
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError({
          code: ErrorCodes.REQUEST_CANCELLED,
          message: 'Request cancelled',
          status: 0,
          retryable: false,
          originalError: error,
        });
      }

      throw error;
    }
  }

  // ============================================
  // Response Parsing
  // ============================================

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    if (response.status === 204) {
      return undefined as T;
    }

    if (!response.ok) {
      // Attempt to parse error response
      let errorData: any;
      try {
        errorData = isJson ? await response.json() : await response.text();
      } catch {
        // Ignore parse errors for error responses
      }

      throw new ApiError({
        code: ErrorCodes.HTTP_ERROR,
        message: response.statusText || 'Request failed',
        status: response.status,
        retryable: response.status >= 500 || response.status === 408 || response.status === 429,
        userMessage: this.getUserMessageForStatus(response.status),
        technicalDetails: errorData,
      });
    }

    if (isJson) {
      return response.json();
    }

    return response.text() as T;
  }

  // ============================================
  // Convenience Methods
  // ============================================

  get<T = any>(url: string, config?: Partial<RequestConfig>): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'GET', ...config });
  }

  post<T = any>(url: string, body?: any, config?: Partial<RequestConfig>): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'POST', body, ...config });
  }

  put<T = any>(url: string, body?: any, config?: Partial<RequestConfig>): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'PUT', body, ...config });
  }

  patch<T = any>(url: string, body?: any, config?: Partial<RequestConfig>): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'PATCH', body, ...config });
  }

  delete<T = any>(url: string, config?: Partial<RequestConfig>): Promise<HttpResponse<T>> {
    return this.request<T>({ url, method: 'DELETE', ...config });
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Create timeout signal that aborts after specified time
   */
  private createTimeoutSignal(timeout: number, originalSignal?: AbortSignal): AbortSignal & { controller: AbortController } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Abort on original signal
    originalSignal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      controller.abort();
    }, { once: true });

    // Cleanup timeout when signal aborts
    controller.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
    }, { once: true });

    return controller.signal as AbortSignal & { controller: AbortController };
  }

  /**
   * Get user-friendly message for HTTP status code
   */
  private getUserMessageForStatus(status: number): string {
    const messages: Record<number, string> = {
      400: 'Invalid request. Please check your input.',
      401: 'Authentication required. Please log in.',
      403: 'Access denied. You do not have permission.',
      404: 'The requested resource was not found.',
      408: 'Request timeout. Please try again.',
      429: 'Too many requests. Please wait and try again.',
      500: 'Server error. Please try again later.',
      502: 'Service temporarily unavailable. Please try again later.',
      503: 'Service unavailable. Please try again later.',
      504: 'Gateway timeout. Please try again later.',
    };

    return messages[status] || 'An error occurred. Please try again.';
  }

  /**
   * Record request metric
   */
  private recordMetric(metric: RequestMetrics): void {
    this.requestMetrics.push(metric);

    // Keep only last 1000 metrics
    if (this.requestMetrics.length > 1000) {
      this.requestMetrics.shift();
    }
  }

  // ============================================
  // Cache Management
  // ============================================

  clearCache(pattern?: string): void {
    apiCache.clear(pattern);
  }

  getCacheStats() {
    return apiCache.getStats();
  }

  // ============================================
  // Request Cancellation
  // ============================================

  cancelRequests(pattern?: string): void {
    for (const [key, controller] of this.activeRequests.entries()) {
      if (!pattern || key.includes(pattern)) {
        controller.abort();
      }
    }
  }

  // ============================================
  // Metrics
  // ============================================

  getMetrics(): RequestMetrics[] {
    return [...this.requestMetrics];
  }

  clearMetrics(): void {
    this.requestMetrics = [];
  }

  getMetricsSummary() {
    const total = this.requestMetrics.length;
    const successful = this.requestMetrics.filter((m) => m.success).length;
    const failed = total - successful;
    const cached = this.requestMetrics.filter((m) => m.cached).length;
    const retried = this.requestMetrics.filter((m) => m.retried).length;

    const avgDuration = total > 0
      ? this.requestMetrics.reduce((sum, m) => sum + m.duration, 0) / total
      : 0;

    return {
      total,
      successful,
      failed,
      cached,
      retried,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      avgDuration,
    };
  }
}

// ============================================
// Singleton Instance
// ============================================

export const httpClient = new HttpClient();

// ============================================
// Export Types
// ============================================

export type {
  HttpClientConfig,
  RequestConfig,
  HttpResponse,
  RequestMetrics,
};
