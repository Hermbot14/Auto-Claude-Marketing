/**
 * API Middleware
 * Error normalization and request/response transformation
 *
 * Features:
 * - Consistent error types
 * - Error normalization from various sources
 * - User-friendly error messages
 * - Retry detection
 * - Request/response logging
 */

// ============================================
// Error Codes
// ============================================

export const ErrorCodes = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  ECONNABORTED: 'ECONNABORTED',
  ENOTFOUND: 'ENOTFOUND',

  // HTTP errors
  HTTP_ERROR: 'HTTP_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // Retry errors
  RETRY_EXHAUSTED: 'RETRY_EXHAUSTED',
  REQUEST_CANCELLED: 'REQUEST_CANCELLED',

  // Parse errors
  PARSE_ERROR: 'PARSE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // Auth errors
  AUTH_ERROR: 'AUTH_ERROR',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Unknown
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ============================================
// API Error Interface
// ============================================

export interface ApiErrorDetails {
  timestamp: string;
  requestId?: string;
  endpoint?: string;
  attempt?: number;
  maxRetries?: number;
  originalErrorMessage?: string;
  stackTrace?: string;
}

export class ApiError extends Error {
  code: string;
  status?: number;
  retryable: boolean;
  userMessage: string;
  technicalDetails?: any;
  originalError?: Error;

  constructor(config: {
    code: string;
    message: string;
    status?: number;
    retryable?: boolean;
    userMessage?: string;
    technicalDetails?: any;
    originalError?: Error;
  }) {
    super(config.message);
    this.name = 'ApiError';
    this.code = config.code;
    this.status = config.status;
    this.retryable = config.retryable ?? false;
    this.userMessage = config.userMessage || config.message;
    this.technicalDetails = config.technicalDetails;
    this.originalError = config.originalError;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      status: this.status,
      retryable: this.retryable,
      technicalDetails: this.technicalDetails,
      stack: this.stack,
    };
  }
}

// ============================================
// Error Normalization
// ============================================

/**
 * Normalize various error types to ApiError
 */
export function normalizeError(error: any): ApiError {
  // Already an ApiError
  if (error instanceof ApiError) {
    return error;
  }

  // Fetch API error
  if (error instanceof TypeError) {
    // Network error, DNS failure, etc.
    return new ApiError({
      code: ErrorCodes.NETWORK_ERROR,
      message: error.message || 'Network error',
      retryable: true,
      userMessage: 'Network connection failed. Please check your internet connection.',
      originalError: error,
    });
  }

  // DOMException (from abort)
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiError({
      code: ErrorCodes.REQUEST_CANCELLED,
      message: 'Request cancelled',
      retryable: false,
      userMessage: 'Request was cancelled.',
      originalError: error,
    });
  }

  // Error with status (HTTP response-like)
  if (error.status) {
    return normalizeHttpError(error);
  }

  // Error with code
  if (error.code) {
    return normalizeByErrorCode(error);
  }

  // Generic error
  return new ApiError({
    code: ErrorCodes.UNKNOWN_ERROR,
    message: error.message || String(error),
    retryable: false,
    userMessage: 'An unexpected error occurred. Please try again.',
    originalError: error,
  });
}

/**
 * Normalize HTTP errors by status code
 */
function normalizeHttpError(error: any): ApiError {
  const status = error.status;
  const message = error.message || error.statusText || `HTTP ${status}`;

  const errorConfig: {
    code: string;
    retryable: boolean;
    userMessage: string;
  } = {
    429: {
      code: ErrorCodes.TOO_MANY_REQUESTS,
      retryable: true,
      userMessage: 'Too many requests. Please wait a moment and try again.',
    },
    500: {
      code: ErrorCodes.HTTP_ERROR,
      retryable: true,
      userMessage: 'Server error. Please try again later.',
    },
    503: {
      code: ErrorCodes.HTTP_ERROR,
      retryable: true,
      userMessage: 'Service temporarily unavailable. Please try again later.',
    },
    401: {
      code: ErrorCodes.UNAUTHORIZED,
      retryable: false,
      userMessage: 'Authentication required. Please log in again.',
    },
    403: {
      code: ErrorCodes.FORBIDDEN,
      retryable: false,
      userMessage: 'Access denied. You do not have permission to perform this action.',
    },
    404: {
      code: ErrorCodes.NOT_FOUND,
      retryable: false,
      userMessage: 'The requested resource was not found.',
    },
    408: {
      code: ErrorCodes.TIMEOUT,
      retryable: true,
      userMessage: 'Request timeout. Please try again.',
    },
  }[status as keyof typeof errorConfig] || {
    code: ErrorCodes.HTTP_ERROR,
    retryable: status >= 500,
    userMessage: message,
  };

  return new ApiError({
    ...errorConfig,
    message,
    status,
    originalError: error,
  });
}

/**
 * Normalize error by error code
 */
function normalizeByErrorCode(error: any): ApiError {
  const code = error.code;

  const errorConfig: {
    code: string;
    retryable: boolean;
    userMessage: string;
  } = {
    ECONNABORTED: {
      code: ErrorCodes.REQUEST_CANCELLED,
      retryable: false,
      userMessage: 'Request was cancelled.',
    },
    ENOTFOUND: {
      code: ErrorCodes.NETWORK_ERROR,
      retryable: true,
      userMessage: 'Unable to reach the server. Please check your connection.',
    },
    ETIMEDOUT: {
      code: ErrorCodes.TIMEOUT,
      retryable: true,
      userMessage: 'Request timed out. Please try again.',
    },
  }[code as keyof typeof errorConfig] || {
    code: ErrorCodes.UNKNOWN_ERROR,
    retryable: false,
    userMessage: error.message || 'An unexpected error occurred.',
  };

  return new ApiError({
    ...errorConfig,
    message: error.message || String(error),
    originalError: error,
  });
}

// ============================================
// Error Logging
// ============================================

interface ErrorLogEntry {
  timestamp: string;
  error: ApiError;
  context?: {
    url?: string;
    method?: string;
    attempt?: number;
  };
}

const errorLog: ErrorLogEntry[] = [];
const MAX_ERROR_LOG_SIZE = 1000;

/**
 * Log error for debugging
 */
export function logError(error: ApiError, context?: { url?: string; method?: string; attempt?: number }): void {
  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    error,
    context,
  };

  errorLog.push(entry);

  // Keep log size bounded
  if (errorLog.length > MAX_ERROR_LOG_SIZE) {
    errorLog.shift();
  }

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[ApiMiddleware]', entry);
  }
}

/**
 * Get error log
 */
export function getErrorLog(): ErrorLogEntry[] {
  return [...errorLog];
}

/**
 * Clear error log
 */
export function clearErrorLog(): void {
  errorLog.length = 0;
}

/**
 * Get error summary statistics
 */
export function getErrorSummary(): {
  total: number;
  byCode: Record<string, number>;
  byType: Record<'retryable' | 'non-retryable', number>;
  last24Hours: number;
} {
  const now = Date.now();
  const dayAgo = now - (24 * 60 * 60 * 1000);

  const last24Hours = errorLog.filter((e) => new Date(e.timestamp).getTime() > dayAgo).length;

  const byCode: Record<string, number> = {};
  const byType = { retryable: 0, 'non-retryable': 0 };

  for (const entry of errorLog) {
    // By code
    byCode[entry.error.code] = (byCode[entry.error.code] || 0) + 1;

    // By retryable
    if (entry.error.retryable) {
      byType.retryable++;
    } else {
      byType['non-retryable']++;
    }
  }

  return {
    total: errorLog.length,
    byCode,
    byType,
    last24Hours,
  };
}

// ============================================
// User Message Helpers
// ============================================

/**
 * Get user-friendly error message with context
 */
export function getUserMessage(error: ApiError, context?: { operation?: string; resource?: string }): string {
  const baseMessage = error.userMessage;

  if (!context) {
    return baseMessage;
  }

  let message = baseMessage;

  if (context.operation) {
    message = `${context.operation}: ${baseMessage}`;
  }

  if (context.resource) {
    message = `${baseMessage} (resource: ${context.resource})`;
  }

  return message;
}

/**
 * Check if error is auth-related
 */
export function isAuthError(error: ApiError): boolean {
  return [
    ErrorCodes.UNAUTHORIZED,
    ErrorCodes.AUTH_ERROR,
    ErrorCodes.TOKEN_EXPIRED,
    ErrorCodes.INSUFFICIENT_PERMISSIONS,
  ].includes(error.code as ErrorCode);
}

/**
 * Check if error is network-related
 */
export function isNetworkError(error: ApiError): boolean {
  return [
    ErrorCodes.NETWORK_ERROR,
    ErrorCodes.TIMEOUT,
    ErrorCodes.ECONNABORTED,
    ErrorCodes.ENOTFOUND,
  ].includes(error.code as ErrorCode);
}

/**
 * Check if error should trigger re-authentication
 */
export function shouldReAuth(error: ApiError): boolean {
  return isAuthError(error) && error.code !== ErrorCodes.INSUFFICIENT_PERMISSIONS;
}

// ============================================
// Error Response Builder
// ============================================

/**
 * Build error response for API responses
 */
export function buildErrorResponse(error: ApiError, requestId?: string): {
  success: false;
  error: {
    code: string;
    message: string;
    userMessage: string;
    details?: ApiErrorDetails;
    requestId?: string;
  };
} {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      userMessage: error.userMessage,
      details: {
        timestamp: new Date().toISOString(),
        requestId,
        ...error.technicalDetails,
      },
      requestId,
    },
  };
}

// ============================================
// Export Types
// ============================================

export type { ApiErrorDetails };
