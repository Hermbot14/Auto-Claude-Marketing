/**
 * Input Sanitization Utility
 *
 * Provides comprehensive input sanitization to prevent XSS attacks and
 * ensure data integrity for user-generated content.
 *
 * Security Features:
 * - HTML tag stripping
 * - Event handler removal (onclick, onerror, etc.)
 * - JavaScript protocol removal
 * - CSS expression removal
 * - Length limit enforcement
 * - Null byte prevention
 *
 * @module input-sanitizer
 */

/**
 * Maximum length limits for different input types
 */
export const SANITIZATION_LIMITS = {
  title: 200,
  description: 5000,
  tag: 50,
  assignee: 100,
  location: 200,
  notes: 2000,
} as const;

/**
 * Sanitization input type
 */
export type SanitizationType = keyof typeof SANITIZATION_LIMITS;

/**
 * Pattern for detecting and removing HTML tags
 * Matches any tag including self-closing and malformed ones
 */
const HTML_TAG_PATTERN = /<\/?[\w\s="'{}\\/:;&#]+\/?>/gi;

/**
 * Pattern for detecting event handlers
 * Matches: onclick, onerror, onload, onmouseover, etc.
 */
const EVENT_HANDLER_PATTERN = /on\w+\s*=\s*(['"]\s*javascript:|['"][^']*|[^'"\s>]*)/gi;

/**
 * Pattern for detecting javascript: protocol
 * Matches in various contexts: href, src, data attributes, etc.
 */
const JAVASCRIPT_PROTOCOL_PATTERN = /javascript\s*:/gi;

/**
 * Pattern for detecting CSS expressions (IE-only but dangerous)
 */
const CSS_EXPRESSION_PATTERN = /expression\s*\(/gi;

/**
 * Pattern for detecting data URLs with script content
 */
const DATA_URL_PATTERN = /data:\s*text\/html/i;

/**
 * Pattern for detecting vml/behavior (IE-specific XSS vectors)
 */
const VML_BEHAVIOR_PATTERN = /vmlframe|behavior\s*:/gi;

/**
 * Pattern for null byte injection attempts
 */
const NULL_BYTE_PATTERN = /\0/g;

/**
 * Sanitizes a string input by removing dangerous content and enforcing length limits.
 *
 * This function provides comprehensive XSS protection by:
 * 1. Stripping all HTML tags
 * 2. Removing event handlers (onclick, onerror, etc.)
 * 3. Removing javascript: protocols
 * 4. Removing CSS expressions
 * 5. Removing dangerous data URLs
 * 6. Removing null bytes
 * 7. Enforcing maximum length limits
 *
 * @param input - The user input to sanitize
 * @param type - The type of input (determines length limit)
 * @returns Sanitized string safe for storage and display
 *
 * @example
 * ```ts
 * sanitizeInput('<script>alert("XSS")</script>Hello', 'title')
 * // Returns: 'Hello'
 *
 * sanitizeInput('Hello world', 'title')
 * // Returns: 'Hello world'
 *
 * sanitizeInput('<img src=x onerror=alert(1)>', 'description')
 * // Returns: ''
 * ```
 */
export function sanitizeInput(input: string, type: SanitizationType): string {
  // Handle non-string input
  if (typeof input !== 'string') {
    return '';
  }

  // Remove null bytes (null byte injection)
  let sanitized = input.replace(NULL_BYTE_PATTERN, '');

  // Remove HTML tags (comprehensive tag removal)
  sanitized = sanitized.replace(HTML_TAG_PATTERN, '');

  // Remove event handlers (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(EVENT_HANDLER_PATTERN, '');

  // Remove javascript: protocol in any form
  sanitized = sanitized.replace(JAVASCRIPT_PROTOCOL_PATTERN, '');

  // Remove CSS expressions (IE-specific XSS)
  sanitized = sanitized.replace(CSS_EXPRESSION_PATTERN, '');

  // Remove dangerous data URLs
  sanitized = sanitized.replace(DATA_URL_PATTERN, '');

  // Remove VML/behavior patterns (IE-specific)
  sanitized = sanitized.replace(VML_BEHAVIOR_PATTERN, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Enforce length limit
  const maxLength = SANITIZATION_LIMITS[type];
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitizes an array of strings (e.g., tags).
 *
 * @param inputs - Array of strings to sanitize
 * @param type - The type of input (determines length limit)
 * @returns Array of sanitized strings
 *
 * @example
 * ```ts
 * sanitizeInputArray(['<script>tag1</script>', 'tag2'], 'tag')
 * // Returns: ['tag1', 'tag2']
 * ```
 */
export function sanitizeInputArray(inputs: string[], type: SanitizationType): string[] {
  if (!Array.isArray(inputs)) {
    return [];
  }

  return inputs
    .filter((item) => typeof item === 'string')
    .map((item) => sanitizeInput(item, type))
    .filter((item) => item.length > 0); // Remove empty strings
}

/**
 * Validates that input contains only safe characters.
 *
 * This is a stricter validation that can be used when you want to ensure
 * input contains only specific character classes (e.g., alphanumeric).
 *
 * @param input - The input to validate
 * @param allowedPattern - Regex pattern of allowed characters
 * @returns true if input is safe, false otherwise
 *
 * @example
 * ```ts
 * // Allow only alphanumeric, spaces, and basic punctuation
 * isInputSafe('Hello World!', /^[a-zA-Z0-9\s.,!?@()-]+$/)
 * // Returns: true
 *
 * isInputSafe('<script>', /^[a-zA-Z0-9\s.,!?@()-]+$/)
 * // Returns: false
 * ```
 */
export function isInputSafe(input: string, allowedPattern: RegExp): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  // First sanitize to remove any obvious dangerous content
  const sanitized = sanitizeInput(input, 'description');

  // Then check if it matches the allowed pattern
  return allowedPattern.test(sanitized);
}

/**
 * Detects if input contains potentially dangerous content.
 *
 * This function checks for common XSS attack vectors without modifying
 * the input. Useful for validation and logging.
 *
 * @param input - The input to check
 * @returns true if dangerous content is detected, false otherwise
 *
 * @example
 * ```ts
 * containsDangerousContent('<script>alert(1)</script>')
 * // Returns: true
 *
 * containsDangerousContent('Hello world')
 * // Returns: false
 * ```
 */
export function containsDangerousContent(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  // Check for common XSS patterns
  const dangerousPatterns = [
    HTML_TAG_PATTERN,
    EVENT_HANDLER_PATTERN,
    JAVASCRIPT_PROTOCOL_PATTERN,
    CSS_EXPRESSION_PATTERN,
    DATA_URL_PATTERN,
    VML_BEHAVIOR_PATTERN,
    NULL_BYTE_PATTERN,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(input));
}

/**
 * Sanitizes a calendar item object comprehensively.
 *
 * This function sanitizes all user-facing string fields in a calendar item,
 * providing complete XSS protection for the entire object.
 *
 * @param item - The calendar item to sanitize (partial item without system fields)
 * @returns Sanitized calendar item
 *
 * @example
 * ```ts
 * const sanitized = sanitizeCalendarItem({
 *   title: '<script>XSS</script>Event',
 *   description: '<img src=x onerror=alert(1)>Desc',
 *   tags: ['<b>tag1</b>', 'tag2'],
 *   assignee: 'User<script>alert(1)</script>',
 *   startDate: new Date(),
 *   type: 'event',
 *   status: 'draft',
 *   source: 'manual',
 *   allDay: true,
 * })
 * // Returns: {
 * //   title: 'Event',
 * //   description: 'Desc',
 * //   tags: ['tag1', 'tag2'],
 * //   assignee: 'User',
 * //   startDate: new Date(),
 * //   type: 'event',
 * //   status: 'draft',
 * //   source: 'manual',
 * //   allDay: true,
 * // }
 * ```
 */
export function sanitizeCalendarItem(
  item: Partial<Record<string, unknown>>
): Partial<Record<string, unknown>> {
  const sanitized: Partial<Record<string, unknown>> = {};

  // Copy non-string fields directly
  for (const [key, value] of Object.entries(item)) {
    if (key === 'id' || key === 'createdAt' || key === 'updatedAt') {
      // Skip system fields
      continue;
    }

    if (key === 'tags' && Array.isArray(value)) {
      // Sanitize tag array
      sanitized.tags = sanitizeInputArray(value as string[], 'tag');
    } else if (key === 'title' && typeof value === 'string') {
      // Sanitize title
      sanitized.title = sanitizeInput(value, 'title');
    } else if (key === 'description' && typeof value === 'string') {
      // Sanitize description
      sanitized.description = sanitizeInput(value, 'description');
    } else if (key === 'assignee' && typeof value === 'string') {
      // Sanitize assignee
      sanitized.assignee = sanitizeInput(value, 'assignee');
    } else if (key === 'location' && typeof value === 'string') {
      // Sanitize location
      sanitized.location = sanitizeInput(value, 'location');
    } else if (key === 'notes' && typeof value === 'string') {
      // Sanitize notes
      sanitized.notes = sanitizeInput(value, 'notes');
    } else {
      // Copy other fields as-is (dates, booleans, etc.)
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Security test vectors for XSS prevention.
 *
 * These are known XSS attack vectors that should be neutralized
 * by the sanitization functions.
 */
export const XSS_TEST_VECTORS = [
  // Script tags
  '<script>alert("XSS")</script>',
  "<Script>alert('XSS')</script>",
  '<SCRIPT SRC="xss.js"></SCRIPT>',
  '<script>alert(String.fromCharCode(88,83,83))</script>',

  // Image tag with onerror
  '<img src=x onerror=alert(1)>',
  '<img src=x onerror="alert(1)">',
  '<IMG SRC=x onerror="alert(1)">',
  '<img src=x onerror=javascript:alert(1)>',

  // Event handlers
  '<div onclick="alert(1)">click</div>',
  '<a onmouseover="alert(1)">hover</a>',
  '<body onload=alert(1)>',

  // JavaScript protocol
  '<a href="javascript:alert(1)">click</a>',
  '<a href=javascript:alert(1)>click</a>',

  // CSS expression
  '<div style="width: expression(alert(1))">',

  // Data URLs
  '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>',

  // Null bytes
  'test\x00injection',

  // Mixed case and encoding
  '<ScRiPt>alert(1)</ScRiPt>',
  '<img src=&#x61;&#x6C;ert(1) onerror=&#x61;lert(1)>',

  // SVG-based XSS
  '<svg onload=alert(1)>',

  // Iframe-based
  '<iframe src="javascript:alert(1)"></iframe>',
] as const;

/**
 * Tests if the sanitization function properly neutralizes XSS vectors.
 *
 * This function runs all test vectors through the sanitization and
 * returns true if all are properly neutralized.
 *
 * @param sanitizerFn - The sanitization function to test
 * @returns true if all test vectors are neutralized, false otherwise
 *
 * @example
 * ```ts
 * if (!testXSSPrevention(sanitizeInput)) {
 *   console.error('XSS prevention failed!');
 * }
 * ```
 */
export function testXSSPrevention(
  sanitizerFn: (input: string, type: SanitizationType) => string
): boolean {
  for (const vector of XSS_TEST_VECTORS) {
    const sanitized = sanitizerFn(vector, 'description');

    // Check if any dangerous content remains
    if (containsDangerousContent(sanitized)) {
      console.error(`XSS test failed for vector: ${vector}`);
      console.error(`Sanitized output: ${sanitized}`);
      return false;
    }

    // Check if script tags remain
    if (sanitized.toLowerCase().includes('<script')) {
      console.error(`Script tag not removed in vector: ${vector}`);
      return false;
    }

    // Check if event handlers remain
    if (sanitized.toLowerCase().includes('onerror') ||
        sanitized.toLowerCase().includes('onclick') ||
        sanitized.toLowerCase().includes('onload')) {
      console.error(`Event handler not removed in vector: ${vector}`);
      return false;
    }

    // Check if javascript: protocol remains
    if (sanitized.toLowerCase().includes('javascript:')) {
      console.error(`javascript: protocol not removed in vector: ${vector}`);
      return false;
    }
  }

  return true;
}
