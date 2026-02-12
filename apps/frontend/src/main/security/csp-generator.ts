/**
 * Content Security Policy (CSP) Generator
 *
 * This implements OPD-PERF-001 P1-3: Content Security Policy (CSP)
 * Features:
 * - Nonce generation for inline scripts
 * - Strict CSP policy configuration
 * - Development vs production policies
 * - CSP violation monitoring
 */

import { randomBytes } from 'crypto';

/**
 * CSP Policy Configuration
 *
 * Defines the security policy for different environments.
 */
export interface CSPPolicy {
  'default-src'?: string;
  'script-src'?: string;
  'style-src'?: string;
  'img-src'?: string;
  'font-src'?: string;
  'connect-src'?: string;
  'object-src'?: string;
  'base-uri'?: string;
  'form-action'?: string;
  'frame-ancestors'?: string;
  'plugin-types'?: string;
  'worker-src'?: string;
  'block-all-mixed-content'?: boolean;
  'upgrade-insecure-requests'?: boolean;
}

/**
 * Development CSP Policy
 *
 * More permissive for development to allow debugging tools.
 */
const DEVELOPMENT_CSP: CSPPolicy = {
  'default-src': "'self'",
  'script-src': "'self' 'unsafe-eval' 'unsafe-inline' localhost:*",
  'style-src': "'self' 'unsafe-inline'",
  'img-src': "'self' data: https: http:",
  'font-src': "'self' data:",
  'connect-src': "'self' ws: wss: http://localhost:* https://localhost:* http://127.0.0.1:*",
  'object-src': "'none'",
  'base-uri': "'self'",
  'form-action': "'self'",
  'frame-ancestors': "'self'",
  'plugin-types': "'none'",
};

/**
 * Production CSP Policy
 *
 * Strict security policy with nonce support for inline scripts/styles.
 */
const PRODUCTION_CSP: CSPPolicy = {
  'default-src': "'self'",
  'script-src': "'self' 'nonce-{RANDOM}' 'strict-dynamic'",
  'style-src': "'self' 'nonce-{RANDOM}' 'unsafe-inline'", // Required for Tailwind inline classes
  'img-src': "'self' data: https:",
  'font-src': "'self' data:",
  'connect-src': "'self' wss: https://api.github.com https://api.gitlab.com wss://*.github.com",
  'object-src': "'none'",
  'base-uri': "'self'",
  'form-action': "'self'",
  'frame-ancestors': "'none'",
  'plugin-types': "'none'",
  'block-all-mixed-content': true,
  'upgrade-insecure-requests': true,
};

/**
 * Report-Only CSP Policy
 *
 * Used for testing CSP before enforcing.
 */
const REPORT_ONLY_CSP: CSPPolicy = {
  ...PRODUCTION_CSP,
};

/**
 * Generate a cryptographically random nonce
 *
 * @returns Base64-encoded random string for CSP nonce
 */
export function generateNonce(): string {
  const buffer = randomBytes(16);
  return buffer.toString('base64');
}

/**
 * Build CSP header string from policy object
 *
 * @param policy - CSP policy configuration
 * @param nonce - Optional nonce for inline scripts/styles
 * @returns CSP header value
 */
export function buildCSPString(policy: CSPPolicy, nonce?: string): string {
  const directives = Object.entries(policy)
    .map(([directive, value]) => {
      // Replace {RANDOM} placeholder with actual nonce
      const interpolatedValue = nonce ? value.replace('{RANDOM}', nonce) : value;
      return `${directive} ${interpolatedValue}`;
    })
    .join('; ');

  return directives;
}

/**
 * Get CSP policy for current environment
 *
 * @param isDevelopment - Whether running in development mode
 * @param isReportOnly - Use report-only mode for testing
 * @returns CSP policy configuration
 */
export function getCSPPolicy(isDevelopment: boolean = false, isReportOnly: boolean = false): CSPPolicy {
  if (isReportOnly) {
    return REPORT_ONLY_CSP;
  }

  return isDevelopment ? DEVELOPMENT_CSP : PRODUCTION_CSP;
}

/**
 * CSP violation endpoint interface
 *
 * Captures and logs CSP violations for monitoring.
 */
export interface CSPViolation {
  'csp-report': {
    'document-uri'?: string;
    'referrer'?: string;
    'violated-directive'?: string;
    'effective-directive'?: string;
    'original-policy'?: string;
    'disposition'?: string;
    'blocked-uri'?: string;
    'line-number'?: number;
    'column-number'?: number;
    'source-file'?: string;
    'status-code'?: number;
  };
}

/**
 * CSP violation report handler type
 */
export type CSPReportHandler = (violation: CSPViolation) => void;

/**
 * Default CSP violation handler
 *
 * Logs violations to console for debugging.
 */
export function defaultCSPReportHandler(violation: CSPViolation): void {
  console.warn('[CSP Violation]', violation['csp-report']);

  const report = violation['csp-report'];
  const directive = report['violated-directive'];
  const blocked = report['blocked-uri'];

  console.warn(`Directive: ${directive}`);
  console.warn(`Blocked URI: ${blocked || 'N/A'}`);
  console.warn(`Document URI: ${report['document-uri'] || 'N/A'}`);
  console.warn('---');
}

/**
 * Setup CSP report endpoint in Electron session
 *
 * @param session - Electron session to configure
 * @param reportHandler - Optional custom handler for violations
 */
export function setupCSPReporting(
  session: Electron.Session,
  reportHandler: CSPReportHandler = defaultCSPReportHandler
): void {
  const reportUrl = 'csp-report-endpoint';

  // Intercept CSP reports sent to this endpoint
  session.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.includes(reportUrl)) {
      const violationData = JSON.parse(details.uploadData ? details.uploadData.toString() : '{}');

      try {
        reportHandler(violationData);
      } catch (error) {
        console.error('[CSP] Failed to handle violation report:', error);
      }

      // Block the report from being sent to network
      callback({ cancel: true });
    } else {
      callback({});
    }
  });
}

/**
 * Apply CSP headers to Electron session
 *
 * @param session - Electron session to configure
 * @param isDevelopment - Whether running in development mode
 * @param isReportOnly - Use report-only mode for testing
 * @returns Applied CSP policy
 */
export function applyCSPToSession(
  session: Electron.Session,
  isDevelopment: boolean = false,
  isReportOnly: boolean = false
): string {
  const nonce = generateNonce();
  const policy = getCSPPolicy(isDevelopment, isReportOnly);
  const cspString = buildCSPString(policy, nonce);

  console.log(`[CSP] Applying ${isReportOnly ? 'report-only' : 'enforcing'} mode`);
  console.log(`[CSP] Nonce: ${nonce.substring(0, 8)}...`);
  console.log(`[CSP] Policy: ${cspString}`);

  // Apply CSP to session
  session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = {
      name: 'Content-Security-Policy',
      value: cspString,
    };

    const reportOnlyHeaders = isReportOnly
      ? [
          {
            name: 'Content-Security-Policy-Report-Only',
            value: cspString,
          },
        ]
      : [];

    callback({
      responseHeaders: [responseHeaders, ...reportOnlyHeaders],
    });
  });

  return nonce;
}

/**
 * Validate CSP policy string
 *
 * Checks if the CSP string is syntactically valid.
 *
 * @param cspString - CSP string to validate
 * @returns Whether the CSP is valid
 */
export function validateCSPString(cspString: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const directives = cspString.split(';');

  for (const directive of directives) {
    const [name, ...values] = directive.trim().split(' ');

    if (!name || !values.length) {
      errors.push(`Invalid directive: ${directive}`);
      continue;
    }

    // Validate known directives
    const knownDirectives = [
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'font-src',
      'connect-src',
      'object-src',
      'base-uri',
      'form-action',
      'frame-ancestors',
      'plugin-types',
      'worker-src',
      'block-all-mixed-content',
      'upgrade-insecure-requests',
    ];

    if (!knownDirectives.includes(name)) {
      errors.push(`Unknown directive: ${name}`);
    }

    // Validate source expressions
    for (const value of values) {
      if (!value || value === '') {
        errors.push(`Empty source for directive: ${name}`);
        continue;
      }

      // Basic validation for source expressions
      if (!/^['"]?['\w\-:\/]+|['\*]|\d+\w+|nonce-.+|sha\d+-['\w+]+['"].*$/.test(value)) {
        errors.push(`Invalid source expression: ${value} for ${name}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get recommended CSP for external domains
 *
 * Helps developers understand which domains to whitelist.
 */
export function getRecommendedDomains(): string[] {
  return [
    'https://api.github.com', // GitHub API
    'https://api.gitlab.com', // GitLab API
    'https://*.github.com', // GitHub assets
    'https://*.gitlab.com', // GitLab assets
    'https://cdn.jsdelivr.net', // CDN for packages
    'https://fonts.gstatic.com', // Google Fonts
  ];
}
