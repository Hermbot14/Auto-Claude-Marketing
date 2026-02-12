/**
 * CSRF Protection Module
 *
 * This implements OPD-PERF-001 P1-4: CSRF Protection
 * Features:
 * - Double-submit cookie pattern
 * - Token generation and validation
 * - Automatic token refresh
 * - Secure cookie attributes
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto';

/**
 * CSRF Token Configuration
 */
export interface CSRFConfig {
  /** Token length in bytes (default: 32) */
  tokenLength?: number;
  /** Token validity in milliseconds (default: 30 minutes) */
  tokenValidity?: number;
  /** Enable token rotation (default: true) */
  enableRotation?: boolean;
  /** Rotation interval in milliseconds (default: 30 minutes) */
  rotationInterval?: number;
}

const DEFAULT_CONFIG: Required<CSRFConfig> = {
  tokenLength: 32,
  tokenValidity: 30 * 60 * 1000, // 30 minutes
  enableRotation: true,
  rotationInterval: 30 * 60 * 1000, // 30 minutes
};

/**
 * Stored CSRF token data
 */
export interface StoredCSRFToken {
  /** The CSRF token value */
  token: string;
  /** Token creation timestamp */
  createdAt: number;
  /** Token expiration timestamp */
  expiresAt: number;
}

/**
 * CSRF validation result
 */
export interface CSRFValidationResult {
  /** Whether the token is valid */
  valid: boolean;
  /** Reason for validation failure */
  reason?: 'missing' | 'invalid' | 'expired' | 'mismatch';
}

/**
 * Generate a cryptographically random CSRF token
 *
 * @param config - CSRF configuration
 * @returns Random token string
 */
export function generateToken(config: CSRFConfig = {}): string {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const token = randomBytes(finalConfig.tokenLength);
  return token.toString('hex');
}

/**
 * Create a hash of the token for storage
 *
 * Uses SHA-256 for secure token comparison.
 *
 * @param token - Token to hash
 * @returns Hex-encoded hash
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate CSRF token with metadata
 *
 * @param config - CSRF configuration
 * @returns Stored token data with expiration
 */
export function generateStoredToken(config: CSRFConfig = {}): StoredCSRFToken {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const token = generateToken(finalConfig);
  const now = Date.now();

  return {
    token,
    createdAt: now,
    expiresAt: now + finalConfig.tokenValidity,
  };
}

/**
 * Validate a CSRF token
 *
 * Implements double-submit pattern by comparing:
 * 1. Token from request headers
 * 2. Token from secure cookie
 *
 * @param headerToken - Token from request header (X-CSRF-Token)
 * @param cookieToken - Token from secure cookie
 * @param storedToken - Stored token data for expiration check
 * @returns Validation result
 */
export function validateToken(
  headerToken: string | undefined | null,
  cookieToken: string | undefined | null,
  storedToken: StoredCSRFToken | undefined | null
): CSRFValidationResult {
  // Check for missing tokens
  if (!headerToken || headerToken.trim() === '') {
    return { valid: false, reason: 'missing' };
  }

  if (!cookieToken || cookieToken.trim() === '') {
    return { valid: false, reason: 'missing' };
  }

  if (!storedToken) {
    return { valid: false, reason: 'missing' };
  }

  // Check token expiration
  const now = Date.now();
  if (now > storedToken.expiresAt) {
    return { valid: false, reason: 'expired' };
  }

  // Verify header token matches stored token
  if (!timingSafeEqual(headerToken, storedToken.token)) {
    return { valid: false, reason: 'invalid' };
  }

  // Verify double-submit pattern: header token must match cookie token
  if (!timingSafeEqual(headerToken, cookieToken)) {
    return { valid: false, reason: 'mismatch' };
  }

  return { valid: true };
}

/**
 * Check if a token needs rotation
 *
 * @param storedToken - Stored token data
 * @param config - CSRF configuration
 * @returns Whether token should be rotated
 */
export function shouldRotateToken(
  storedToken: StoredCSRFToken | undefined | null,
  config: CSRFConfig = {}
): boolean {
  if (!storedToken || !config.enableRotation) {
    return false;
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();

  // Rotate if token is older than rotation interval
  return (now - storedToken.createdAt) > finalConfig.rotationInterval;
}

/**
 * Get secure cookie attributes for CSRF token
 *
 * @param isProduction - Whether in production environment
 * @returns Cookie attribute string
 */
export function getCookieAttributes(isProduction: boolean = true): string {
  const attributes = [
    'Path=/',
    'SameSite=Strict',
    isProduction ? 'Secure' : '',
    'HttpOnly',
  ];

  return attributes.filter(Boolean).join('; ');
}

/**
 * Format CSRF token for use in HTTP headers
 *
 * @param token - The CSRF token
 * @returns Formatted header value
 */
export function formatTokenForHeader(token: string): string {
  return token;
}

/**
 * Extract token from various sources
 *
 * Handles different ways the token might be provided:
 * - Header: X-CSRF-Token
 * - Form field: csrf_token
 * - Query param: csrf_token
 */
export interface ExtractedToken {
  headerToken: string | null;
  bodyToken: string | null;
  queryToken: string | null;
}

export function extractTokenFromRequest(request: {
  getHeader(name: string): string | undefined;
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  url?: string;
}): ExtractedToken {
  const result: ExtractedToken = {
    headerToken: null,
    bodyToken: null,
    queryToken: null,
  };

  // Extract from header
  result.headerToken = request.getHeader('X-CSRF-Token') || request.getHeader('x-csrf-token') || null;

  // Extract from body (if JSON or form-encoded)
  if (request.body) {
    if (typeof request.body === 'string') {
      // Try parsing as URL-encoded form data
      const params = new URLSearchParams(request.body);
      result.bodyToken = params.get('csrf_token') || params.get('csrfToken') || null;
    } else if (typeof request.body === 'object') {
      // JSON body
      result.bodyToken = (request.body as Record<string, unknown>)['csrf_token'] ||
                          (request.body as Record<string, unknown>)['csrfToken'] || null;
    }
  }

  // Extract from URL query parameter
  if (request.url) {
    try {
      const url = new URL(request.url);
      result.queryToken = url.searchParams.get('csrf_token') || url.searchParams.get('csrfToken') || null;
    } catch {
      // Invalid URL
    }
  }

  return result;
}

/**
 * CSRF-safe state-changing methods
 *
 * Lists HTTP methods that require CSRF protection.
 */
export const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Check if an HTTP method requires CSRF protection
 *
 * @param method - HTTP method (uppercase)
 * @returns Whether the method requires CSRF protection
 */
export function requiresCSRFProtection(method: string): boolean {
  return STATE_CHANGING_METHODS.has(method.toUpperCase());
}

/**
 * Safe methods that don't require CSRF protection
 */
export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Check if an HTTP method is safe (read-only)
 *
 * @param method - HTTP method (uppercase)
 * @returns Whether the method is safe
 */
export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

/**
 * Generate CSRF token rotation response
 *
 * @param newToken - The new token
 * @param config - CSRF configuration
 * @returns Response object with new token
 */
export function createTokenRotationResponse(
  newToken: string,
  config: CSRFConfig = {}
): {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
} {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': newToken,
    },
    body: JSON.stringify({
      csrfToken: newToken,
      expiresAt: Date.now() + (config.tokenValidity || DEFAULT_CONFIG.tokenValidity),
    }),
  };
}

/**
 * Log CSRF violation for security monitoring
 *
 * @param violation - Details of the CSRF violation
 */
export function logCSRFViolation(violation: {
  reason: string;
  ip?: string;
  userAgent?: string;
  path?: string;
}): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'CSRF_VIOLATION',
    ...violation,
  };

  console.warn('[CSRF Violation]', JSON.stringify(logEntry, null, 2));

  // In production, send to security monitoring service
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    // Example: Send to Sentry or other monitoring service
    if (window.Sentry) {
      window.Sentry.captureMessage('CSRF Violation', {
        level: 'warning',
        extra: logEntry,
      });
    }
  }
}

/**
 * Validate that token storage is working correctly
 *
 * Used to ensure the secure cookie is being set and read properly.
 */
export function validateTokenStorage(): {
  working: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if we can write to document.cookie (renderer process)
  if (typeof document !== 'undefined') {
    const testToken = generateToken({ tokenLength: 16 });
    document.cookie = `csrf_test=${testToken}; ${getCookieAttributes(false)}`;

    const cookieValue = document.cookie
      .split('; ')
      .map((c) => c.trim())
      .find((c) => c.startsWith('csrf_test='));

    if (!cookieValue || !cookieValue.includes(testToken)) {
      errors.push('Cookie storage not working - cookies may be disabled');
    }

    // Clean up test cookie
    document.cookie = 'csrf_test=; max-age=0';
  }

  return {
    working: errors.length === 0,
    errors,
  };
}
