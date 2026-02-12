/**
 * Security Headers Module
 *
 * This implements OPD-PERF-001 P1-3: Content Security Policy (CSP)
 * Provides comprehensive security headers for the Electron application.
 */

import { session } from 'electron';
import {
  generateNonce,
  buildCSPString,
  getCSPPolicy,
  applyCSPToSession,
  setupCSPReporting,
  getRecommendedDomains,
} from './csp-generator';

/**
 * Security header configuration
 */
export interface SecurityConfig {
  /** Enable Content Security Policy */
  enableCSP?: boolean;
  /** CSP report-only mode (testing) */
  cspReportOnly?: boolean;
  /** Enable X-Frame-Options */
  enableXFrameOptions?: boolean;
  /** Enable X-Content-Type-Options */
  enableXContentTypeOptions?: boolean;
  /** Enable Strict-Transport-Security */
  enableHSTS?: boolean;
  /** Enable X-XSS-Protection */
  enableXXSSProtection?: boolean;
  /** Enable Referrer-Policy */
  enableReferrerPolicy?: boolean;
  /** Enable Permissions-Policy */
  enablePermissionsPolicy?: boolean;
  /** Custom CSP policy (overrides default) */
  customCSPPolicy?: Record<string, string>;
}

/**
 * Default security configuration
 */
const DEFAULT_SECURITY_CONFIG: Required<SecurityConfig> = {
  enableCSP: true,
  cspReportOnly: false,
  enableXFrameOptions: true,
  enableXContentTypeOptions: true,
  enableHSTS: false, // Only for HTTPS
  enableXXSSProtection: true,
  enableReferrerPolicy: true,
  enablePermissionsPolicy: false, // May break functionality if misconfigured
};

/**
 * Apply comprehensive security headers to Electron session
 *
 * @param session - Electron session to configure
 * @param config - Security configuration
 * @param isDevelopment - Whether running in development mode
 */
export function applySecurityHeaders(
  session: Electron.Session,
  config: SecurityConfig = {},
  isDevelopment: boolean = false
): void {
  const finalConfig = { ...DEFAULT_SECURITY_CONFIG, ...config };

  // Apply CSP if enabled
  if (finalConfig.enableCSP) {
    applyCSPToSession(session, isDevelopment, finalConfig.cspReportOnly);
  }

  // Apply additional security headers via webRequest.onHeadersReceived
  session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders: Record<string, string>[] = [];

    // X-Frame-Options: Prevent clickjacking
    if (finalConfig.enableXFrameOptions) {
      responseHeaders.push({
        name: 'X-Frame-Options',
        value: 'DENY',
      });
    }

    // X-Content-Type-Options: Prevent MIME sniffing
    if (finalConfig.enableXContentTypeOptions) {
      responseHeaders.push({
        name: 'X-Content-Type-Options',
        value: 'nosniff',
      });
    }

    // X-XSS-Protection: Enable browser XSS filter
    if (finalConfig.enableXXSSProtection) {
      responseHeaders.push({
        name: 'X-XSS-Protection',
        value: '1; mode=block',
      });
    }

    // Referrer-Policy: Control referrer information leakage
    if (finalConfig.enableReferrerPolicy) {
      responseHeaders.push({
        name: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      });
    }

    // Strict-Transport-Security: Force HTTPS (only if served over HTTPS)
    if (finalConfig.enableHSTS && details.url.startsWith('https://')) {
      responseHeaders.push({
        name: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      });
    }

    // Permissions-Policy: Control browser features (experimental, may break functionality)
    if (finalConfig.enablePermissionsPolicy) {
      responseHeaders.push({
        name: 'Permissions-Policy',
        value: 'geolocation=(), camera=(), microphone=()',
      });
    }

    // Add existing response headers
    callback({ responseHeaders });
  });
}

/**
 * Setup security middleware for IPC handlers
 *
 * This wraps IPC handlers to add security validation.
 *
 * @param ipcMain - Electron ipcMain object
 * @param config - Security configuration
 */
export function setupSecurityMiddleware(ipcMain: Electron.IpcMain, config: SecurityConfig = {}): void {
  const finalConfig = { ...DEFAULT_SECURITY_CONFIG, ...config };

  // Log security configuration
  console.log('[Security] Applying security headers with config:', finalConfig);

  // Store configuration globally for IPC handler access
  (global as any).__securityConfig = {
    config: finalConfig,
    nonce: generateNonce(),
    recommendedDomains: getRecommendedDomains(),
  };

  // Monitor security-sensitive IPC calls
  const sensitiveChannels = [
    'update-project-env',
    'update-project-settings',
    'run-spec',
    'execute-shell-command',
  ];

  sensitiveChannels.forEach((channel) => {
    const existingHandlers = ipcMain.listeners(channel);

    // Wrap existing handlers with security checks
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, async (event, ...args) => {
      // Validate sender
      const senderUrl = event.sender?.getURL();
      if (senderUrl && !senderUrl.startsWith('app://')) {
        console.error(`[Security] Blocked IPC call from ${senderUrl} to ${channel}`);
        throw new Error('Unauthorized sender');
      }

      // Call original handler if stored
      const originalHandler = (global as any).__originalIpcHandlers?.[channel];
      if (originalHandler) {
        return originalHandler(event, ...args);
      }

      throw new Error(`No handler for ${channel}`);
    });

    // Store original handlers
    if (existingHandlers.length > 0 && !(global as any).__originalIpcHandlers) {
      (global as any).__originalIpcHandlers = {};
      existingHandlers.forEach((handler) => {
        if (!(global as any).__originalIpcHandlers[channel]) {
          (global as any).__originalIpcHandlers[channel] = handler;
        }
      });
    }
  });
}

/**
 * Validate URL for external navigation
 *
 * Checks if a URL is in the allowed list for navigation.
 *
 * @param url - URL to validate
 * @param allowedDomains - List of allowed domains
 * @returns Whether URL is allowed
 */
export function isAllowedURL(url: string, allowedDomains: string[] = getRecommendedDomains()): boolean {
  try {
    const parsedUrl = new URL(url);

    // Allow app:// protocol (internal)
    if (parsedUrl.protocol === 'app:') {
      return true;
    }

    // Check against allowed domains
    for (const domain of allowedDomains) {
      const allowedDomain = new URL(domain);
      if (parsedUrl.origin === allowedDomain.origin) {
        return true;
      }

      // Allow subdomains
      if (parsedUrl.hostname?.endsWith(allowedDomain.hostname?.replace(/^\*\./, ''))) {
        return true;
      }
    }

    return false;
  } catch {
    console.error(`[Security] Failed to parse URL: ${url}`);
    return false;
  }
}

/**
 * Get current security configuration
 *
 * @returns Applied security configuration
 */
export function getSecurityConfig(): SecurityConfig {
  return (global as any).__securityConfig?.config || DEFAULT_SECURITY_CONFIG;
}

/**
 * Get current CSP nonce
 *
 * @returns Current CSP nonce for inline scripts/styles
 */
export function getCurrentNonce(): string {
  return (global as any).__securityConfig?.nonce || generateNonce();
}

/**
 * Rotate security tokens (nonce)
 *
 * Should be called periodically to refresh security tokens.
 */
export function rotateSecurityTokens(): void {
  const newNonce = generateNonce();

  if ((global as any).__securityConfig) {
    (global as any).__securityConfig.nonce = newNonce;
    console.log('[Security] Rotated security tokens');
  }

  return newNonce;
}

/**
 * Get security header report for debugging
 *
 * @returns Current security configuration report
 */
export function getSecurityReport(): {
  config: SecurityConfig;
  nonce: string;
  recommendedDomains: string[];
} {
  const globalConfig = (global as any).__securityConfig || {};

  return {
    config: globalConfig.config || DEFAULT_SECURITY_CONFIG,
    nonce: globalConfig.nonce || 'N/A',
    recommendedDomains: globalConfig.recommendedDomains || getRecommendedDomains(),
  };
}
