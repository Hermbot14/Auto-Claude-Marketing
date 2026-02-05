/**
 * Path Traversal Protection
 *
 * SECURITY CRITICAL: This module provides validation to prevent path traversal attacks.
 *
 * Path traversal (directory traversal) attacks allow attackers to access files and
 * directories outside the intended scope by using sequences like "../" or absolute paths.
 *
 * OWASP Top 10 - A01: Broken Access Control
 * CWE-22: Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')
 *
 * @see https://owasp.org/www-community/attacks/Path_Traversal
 * @see https://cwe.mitre.org/data/definitions/22.html
 */

import { debugError } from '../../shared/utils/debug-logger';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  sanitized?: string;
  error?: string;
}

/**
 * Path traversal attack patterns to detect
 *
 * These patterns indicate attempts to escape the intended directory:
 * - "../" and "..\" - Parent directory traversal
 * - "./" and ".\" - Current directory (could be part of traversal chain)
 * - Absolute paths: "/" on Unix, "C:" on Windows
 * - Null bytes: "\0" (can bypass string checks in some systems)
 * - URL-encoded variants: "%2e%2e%2f" (../)
 * - Unicode variants: "\u002e\u002e\u002f" (../)
 */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,  // ../ (Unix parent dir)
  /\.\.\\/g,  // ..\ (Windows parent dir)
  /\.\.\\\\/g, // ..\\ (Windows parent dir, escaped)
  /\.%2e/gi,  // URL-encoded parent dir
  /\.\.%5c/gi, // URL-encoded Windows parent dir
  /%2e%2e%2f/gi, // Full URL-encoded ../
  /%2e%2e%5c/gi, // Full URL-encoded ..\
  /\.\.\./g, // Triple dot (could be evasion)
  /\0/g,     // Null byte injection
];

/**
 * Absolute path patterns
 */
const ABSOLUTE_PATH_PATTERNS = [
  /^\//,           // Unix absolute path: /etc/passwd
  /^[a-zA-Z]:\\/,  // Windows absolute path: C:\Windows
  /^[a-zA-Z]:/,    // Windows drive letter: C:
  /^\\\\/,         // UNC path: \\server\share
];

/**
 * Allowlist of safe characters for project IDs
 *
 * Using an allowlist approach (whitelist) is more secure than blocklisting.
 * Only these characters are permitted:
 * - Alphanumeric: a-z, A-Z, 0-9
 * - Hyphen: - (common in IDs)
 * - Underscore: _ (common in IDs)
 * - Dot: . (for UUIDs like "550e8400-e29b-41d4-a716-446655440000")
 */
const SAFE_PROJECT_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * Special project IDs that are allowed but don't match the standard pattern
 *
 * These are reserved IDs used by the application for special purposes.
 */
const RESERVED_PROJECT_IDS = new Set([
  'demo',  // Demo project with mock data
]);

/**
 * Maximum length for project IDs
 *
 * UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (36 chars)
 * Setting a reasonable limit to prevent DoS via extremely long IDs
 */
const MAX_PROJECT_ID_LENGTH = 100;

/**
 * Minimum length for project IDs (excluding empty string)
 */
const MIN_PROJECT_ID_LENGTH = 1;

/**
 * Security-reject a potentially malicious value
 *
 * Logs security events without revealing sensitive information in error messages.
 * Generic error messages prevent information leakage that could aid attackers.
 *
 * @param value - The rejected value (not logged to prevent injection)
 * @param reason - Security reason for rejection
 * @returns Validation result indicating failure
 */
function rejectValue(reason: string): ValidationResult {
  // Log security event without including the potentially malicious value
  debugError('[Path Traversal Validator] Rejected value:', reason);

  // Return generic error message (don't leak system info)
  return {
    valid: false,
    error: 'Invalid project ID',
  };
}

/**
 * Validate a project ID to prevent path traversal attacks
 *
 * This function implements defense-in-depth with multiple validation layers:
 * 1. Length validation (bounds checking)
 * 2. Path traversal pattern detection
 * 3. Absolute path detection
 * 4. Allowlist character validation
 * 5. Reserved ID checking
 *
 * @param projectId - The project ID to validate
 * @returns Validation result with sanitized ID or error
 *
 * @example
 * ```typescript
 * const result = validateProjectId('my-project-123');
 * if (result.valid) {
 *   console.log(result.sanitized); // 'my-project-123'
 * } else {
 *   console.error(result.error); // 'Invalid project ID'
 * }
 * ```
 *
 * @example Path traversal attempt blocked
 * ```typescript
 * const result = validateProjectId('../../etc/passwd');
 * if (!result.valid) {
 *   console.error('Attack blocked:', result.error);
 * }
 * ```
 */
export function validateProjectId(projectId: string): ValidationResult {
  // ============================================
  // Layer 1: Type and Length Validation
  // ============================================

  // Type check - must be a non-empty string
  if (typeof projectId !== 'string') {
    return rejectValue('Type error: projectId must be a string');
  }

  // Trim whitespace (attackers might use spaces to bypass checks)
  const sanitized = projectId.trim();

  // Length validation - prevent DoS via extremely long values
  if (sanitized.length < MIN_PROJECT_ID_LENGTH || sanitized.length > MAX_PROJECT_ID_LENGTH) {
    return rejectValue('Length validation failed');
  }

  // ============================================
  // Layer 2: Reserved ID Check
  // ============================================

  // Check against reserved IDs first (these bypass pattern validation)
  if (RESERVED_PROJECT_IDS.has(sanitized)) {
    return { valid: true, sanitized };
  }

  // ============================================
  // Layer 3: Path Traversal Pattern Detection
  // ============================================

  // Check for path traversal sequences (e.g., "../", "..\")
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(sanitized)) {
      return rejectValue('Path traversal pattern detected');
    }
  }

  // ============================================
  // Layer 4: Absolute Path Detection
  // ============================================

  // Check for absolute paths (e.g., "/etc/passwd", "C:\Windows")
  for (const pattern of ABSOLUTE_PATH_PATTERNS) {
    if (pattern.test(sanitized)) {
      return rejectValue('Absolute path detected');
    }
  }

  // ============================================
  // Layer 5: Allowlist Character Validation
  // ============================================

  // Only allow safe characters (deny by default)
  if (!SAFE_PROJECT_ID_PATTERN.test(sanitized)) {
    return rejectValue('Invalid characters detected');
  }

  // ============================================
  // Additional Security: Prevent Reserved Names
  // ============================================

  // Block Windows reserved device names (CON, PRN, AUX, NUL, COM*, LPT*)
  // These can cause issues on Windows systems
  const windowsReservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (windowsReservedNames.test(sanitized)) {
    return rejectValue('Reserved system name detected');
  }

  // All checks passed - return sanitized value
  return { valid: true, sanitized };
}

/**
 * Validate multiple project IDs (batch validation)
 *
 * Useful for validating arrays of project IDs from IPC calls.
 *
 * @param projectIds - Array of project IDs to validate
 * @returns Object with all valid, any invalid, and errors
 */
export function validateProjectIds(projectIds: string[]): {
  valid: string[];
  invalid: string[];
  errors: Map<string, string>;
} {
  const valid: string[] = [];
  const invalid: string[] = [];
  const errors = new Map<string, string>();

  for (const id of projectIds) {
    const result = validateProjectId(id);
    if (result.valid && result.sanitized) {
      valid.push(result.sanitized);
    } else {
      invalid.push(id);
      errors.set(id, result.error || 'Invalid project ID');
    }
  }

  return { valid, invalid, errors };
}

/**
 * Validate that a path stays within a base directory
 *
 * This is an additional defense-in-depth check that can be used
 * after resolving a full path from a project ID.
 *
 * @param resolvedPath - The fully resolved path to check
 * @param basePath - The base directory that should contain the resolved path
 * @returns true if the resolved path is within the base directory
 *
 * @example
 * ```typescript
 * const projectPath = path.join(baseDir, projectId);
 * const resolvedPath = path.resolve(projectPath);
 *
 * if (!isPathContained(resolvedPath, baseDir)) {
 *   throw new Error('Path traversal detected');
 * }
 * ```
 */
export function isPathContained(resolvedPath: string, basePath: string): boolean {
  const path = require('path');

  // Normalize both paths
  const normalizedResolved = path.resolve(resolvedPath);
  const normalizedBase = path.resolve(basePath);

  // Check if resolved path starts with base path
  // Important: Add path separator to prevent partial matches
  // e.g., /home/user/project should match /home/user/project
  // but /home/user/project-malicious should NOT match /home/user/project
  return (
    normalizedResolved === normalizedBase ||
    normalizedResolved.startsWith(normalizedBase + path.sep)
  );
}

/**
 * Sanitize a project ID for safe use in file paths
 *
 * This function removes potentially dangerous characters while preserving
 * the original ID's usability. Use this when you need to create directory
 * names or file paths from user input.
 *
 * @param projectId - The project ID to sanitize
 * @returns Sanitized ID safe for use in file paths
 *
 * @example
 * ```typescript
 * const safeId = sanitizeProjectIdForPath(userInput);
 * const dirPath = path.join(baseDir, safeId);
 * ```
 */
export function sanitizeProjectIdForPath(projectId: string): string {
  // First validate the ID
  const validation = validateProjectId(projectId);

  if (!validation.valid || !validation.sanitized) {
    throw new Error(validation.error || 'Invalid project ID');
  }

  // Additional sanitization for file system safety
  // Replace any remaining potentially problematic characters
  return validation.sanitized
    .split('')
    .map((char) => {
      // Replace characters that might cause issues on some file systems
      const code = char.charCodeAt(0);

      // Control characters (0-31, 127) - replace with underscore
      if (code < 32 || code === 127) {
        return '_';
      }

      // Characters problematic on Windows: < > : " | ? *
      // These are already blocked by validation, but add extra safety
      if ('<>:"|?*'.includes(char)) {
        return '_';
      }

      return char;
    })
    .join('');
}

/**
 * Security audit helper for testing
 *
 * Returns a list of test cases that should be blocked by the validator.
 * Useful for security testing and audit purposes.
 *
 * @returns Array of malicious test cases
 */
export function getSecurityTestCases(): Array<{ input: string; description: string }> {
  return [
    // Path traversal attempts
    { input: '../', description: 'Parent directory traversal (Unix)' },
    { input: '..\\', description: 'Parent directory traversal (Windows)' },
    { input: '../../etc/passwd', description: 'Multi-level traversal' },
    { input: '..\\..\\windows\\system32', description: 'Multi-level traversal (Windows)' },
    { input: '....//', description: 'Evasion attempt' },
    { input: './test/../../etc', description: 'Mixed traversal' },

    // Absolute paths
    { input: '/etc/passwd', description: 'Unix absolute path' },
    { input: 'C:\\Windows\\System32', description: 'Windows absolute path' },
    { input: 'C:/Windows/System32', description: 'Windows path with forward slash' },
    { input: '\\\\server\\share', description: 'UNC path' },

    // Null byte injection
    { input: 'test\x00.txt', description: 'Null byte injection' },
    { input: '../../etc/passwd\x00.png', description: 'Null byte bypass attempt' },

    // URL-encoded attacks
    { input: '%2e%2e%2f', description: 'URL-encoded parent directory' },
    { input: '%2e%2e%5c', description: 'URL-encoded Windows parent directory' },
    { input: '..%252f', description: 'Double-encoded traversal' },

    // Unicode evasion
    { input: '\u002e\u002e\u002f', description: 'Unicode parent directory' },

    // Windows reserved names
    { input: 'CON', description: 'Windows reserved device name' },
    { input: 'PRN', description: 'Windows reserved device name' },
    { input: 'AUX', description: 'Windows reserved device name' },
    { input: 'NUL', description: 'Windows reserved device name' },
    { input: 'COM1', description: 'Windows serial port' },
    { input: 'LPT1', description: 'Windows parallel port' },

    // Edge cases
    { input: '', description: 'Empty string' },
    { input: '   ', description: 'Whitespace only' },
    { input: 'a'.repeat(101), description: 'Excessively long ID (DoS)' },

    // Special characters
    { input: 'project<script>', description: 'XSS attempt' },
    { input: 'project; rm -rf /', description: 'Command injection' },
    { input: 'project`whoami`', description: 'Backtick injection' },
    { input: 'project$(id)', description: 'Command substitution' },

    // Valid IDs (should pass)
    { input: 'demo', description: 'Reserved demo project (VALID)' },
    { input: 'my-project-123', description: 'Simple project ID (VALID)' },
    { input: 'project_abc', description: 'Underscore ID (VALID)' },
    { input: '550e8400-e29b-41d4-a716-446655440000', description: 'UUID v4 (VALID)' },
    { input: 'project.test.name', description: 'Dot notation (VALID)' },
    { input: 'MyProject-2024', description: 'Mixed case with hyphen (VALID)' },
  ];
}

/**
 * Run security audit on validator
 *
 * Tests all known attack patterns and valid cases.
 * Returns detailed audit results.
 *
 * @returns Audit results with pass/fail for each test case
 */
export function runSecurityAudit(): {
  totalTests: number;
  passed: number;
  failed: number;
  results: Array<{
    input: string;
    description: string;
    expected: 'valid' | 'invalid';
    actual: 'valid' | 'invalid';
    passed: boolean;
  }>;
} {
  const testCases = getSecurityTestCases();
  const results = testCases.map((testCase) => {
    const result = validateProjectId(testCase.input);
    const expected: 'valid' | 'invalid' = testCase.description.includes('(VALID)')
      ? 'valid'
      : 'invalid';
    const actual: 'valid' | 'invalid' = result.valid ? 'valid' : 'invalid';
    const passed = actual === expected;

    return {
      input: testCase.input,
      description: testCase.description,
      expected,
      actual,
      passed,
    };
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    totalTests: testCases.length,
    passed,
    failed,
    results,
  };
}
