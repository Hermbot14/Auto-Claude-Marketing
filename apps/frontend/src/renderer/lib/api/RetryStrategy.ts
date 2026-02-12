/**
 * Retry Strategy
 * Exponential backoff with jitter for resilient HTTP requests
 *
 * Features:
 * - Configurable retry attempts
 * - Exponential backoff with jitter
 * - Retryable error detection
 * - Per-request retry configuration
 * - AbortSignal support for cancellation
 */

import { ApiError, ErrorCodes } from './ApiMiddleware';

// ============================================
// Types
// ============================================

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterFactor: number;
  retryableStatuses: number[];
  retryableErrorCodes: string[];
  signal?: AbortSignal;
}

export interface RetryContext {
  attempt: number;
  delay: number;
  error?: ApiError;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  jitterFactor: 0.3, // 30% jitter
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrorCodes: [
    ErrorCodes.NETWORK_ERROR,
    ErrorCodes.TIMEOUT,
    ErrorCodes.ECONNABORTED,
    ErrorCodes.ENOTFOUND,
  ],
};

// ============================================
// Retry Strategy Class
// ============================================

export class RetryStrategy {
  private options: RetryOptions;

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = { ...DEFAULT_RETRY_OPTIONS, ...options };
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(fn: () => Promise<T>, options?: Partial<RetryOptions>): Promise<T> {
    const mergedOptions = { ...this.options, ...options };
    let lastError: any;
    let attempt = 0;

    while (attempt <= mergedOptions.maxRetries) {
      // Check for abort signal
      if (mergedOptions.signal?.aborted) {
        throw new ApiError({
          code: ErrorCodes.REQUEST_CANCELLED,
          message: 'Request cancelled during retry',
          retryable: false,
        });
      }

      try {
        // Attempt the operation
        const result = await fn();

        // Success - return result
        if (attempt > 0) {
          console.log(`[RetryStrategy] Success after ${attempt} retries`);
        }

        return result;

      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (!this.isRetryable(error, attempt, mergedOptions)) {
          // Not retryable - throw immediately
          throw error;
        }

        // Calculate delay for next retry
        const delay = this.calculateDelay(attempt, mergedOptions);

        // Log retry attempt
        console.warn(
          `[RetryStrategy] Retry attempt ${attempt + 1}/${mergedOptions.maxRetries} after ${delay}ms`,
          { error: error instanceof Error ? error.message : String(error) }
        );

        // Wait before next retry
        await this.delay(delay, mergedOptions.signal);

        attempt++;
      }
    }

    // Max retries exceeded - throw last error
    throw lastError;
  }

  /**
   * Check if error should trigger a retry
   */
  private isRetryable(error: any, attempt: number, options: RetryOptions): boolean {
    // Don't retry if max attempts reached
    if (attempt >= options.maxRetries) {
      return false;
    }

    // Check for abort signal
    if (options.signal?.aborted) {
      return false;
    }

    // ApiError with retryable flag
    if (error instanceof ApiError) {
      return error.retryable;
    }

    // Check error codes
    if (error.code) {
      if (options.retryableErrorCodes.includes(error.code)) {
        return true;
      }
    }

    // Check HTTP status
    if (error.status) {
      return options.retryableStatuses.includes(error.status);
    }

    // Network errors (fetch throws)
    if (error instanceof TypeError) {
      // Network errors (CORS, DNS, connection refused)
      return true;
    }

    return false;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, options: RetryOptions): number {
    // Exponential backoff: initialDelay * (backoffMultiplier ^ attempt)
    const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt);

    // Add jitter: random value between 0 and (jitterFactor * delay)
    const jitter = Math.random() * options.jitterFactor * exponentialDelay;

    // Final delay with jitter
    const delayWithJitter = exponentialDelay + jitter;

    // Cap at max delay
    return Math.min(delayWithJitter, options.maxDelay);
  }

  /**
   * Delay with abort signal support
   */
  private async delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already aborted
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      const timeout = setTimeout(() => resolve(), ms);

      // Abort listener
      signal?.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
  }

  /**
   * Update retry options
   */
  updateOptions(options: Partial<RetryOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current options
   */
  getOptions(): RetryOptions {
    return { ...this.options };
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Create retry-specific ApiError
 */
export function createRetryError(attempt: number, maxRetries: number, originalError: any): ApiError {
  return new ApiError({
    code: ErrorCodes.RETRY_EXHAUSTED,
    message: `Max retries (${maxRetries}) exceeded`,
    retryable: false,
    originalError,
    technicalDetails: {
      attempt,
      maxRetries,
      originalErrorMessage: originalError instanceof Error ? originalError.message : String(originalError),
    },
  });
}

/**
 * Check if error is potentially retryable (for logging/debugging)
 */
export function isPotentiallyRetryable(error: any): boolean {
  if (error instanceof ApiError) {
    return error.retryable;
  }

  // Network errors
  if (error instanceof TypeError) {
    return true;
  }

  // HTTP status codes that might be retryable
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  if (error.status && retryableStatuses.includes(error.status)) {
    return true;
  }

  return false;
}

// ============================================
// Export singleton
// ============================================

export const retryStrategy = new RetryStrategy();

// ============================================
// Export Types
// ============================================

export type { RetryOptions, RetryContext };
