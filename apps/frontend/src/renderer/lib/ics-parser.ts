/**
 * Secure ICS Parser with Security Validation
 *
 * This module provides secure parsing of ICS (iCalendar) files with protection against:
 * - Prototype pollution attacks
 * - XSS injection through event fields
 * - DoS through large files or malformed structures
 * - Code injection through malicious date formats
 *
 * Security Level: CRITICAL (CALC-SEC-001)
 */

import { z } from 'zod';

// ============================================
// Security Constants
// ============================================

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_LINE_LENGTH = 1000; // Prevent memory issues
export const MAX_EVENTS_PER_FILE = 1000; // Prevent DoS
export const MAX_STRING_LENGTH = 1000; // For text fields
export const MAX_TAGS_COUNT = 50; // Prevent array abuse
export const MAX_RECURSION_DEPTH = 100; // For nested structures

// ============================================
// Error Types
// ============================================

export class ICSSecurityError extends Error {
  constructor(
    message: string,
    public readonly code: SecurityErrorCode,
    public readonly severity: 'critical' | 'high' | 'medium' | 'low'
  ) {
    super(message);
    this.name = 'ICSSecurityError';
  }
}

export type SecurityErrorCode =
  | 'FILE_TOO_LARGE'
  | 'MALFORMED_STRUCTURE'
  | 'PROTOTYPE_POLLUTION'
  | 'INVALID_DATE_FORMAT'
  | 'XSS_ATTEMPT'
  | 'TOO_MANY_EVENTS'
  | 'INVALID_PROPERTY'
  | 'INVALID_VALUE'
  | 'MISSING_REQUIRED_FIELD'
  | 'LINE_TOO_LONG';

// ============================================
// Security Logging
// ============================================

interface SecurityEvent {
  timestamp: Date;
  eventType: string;
  code: SecurityErrorCode;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  details?: unknown;
}

const securityEvents: SecurityEvent[] = [];

export function logSecurityEvent(
  eventType: string,
  code: SecurityErrorCode,
  severity: 'critical' | 'high' | 'medium' | 'low',
  message: string,
  details?: unknown
): void {
  const event: SecurityEvent = {
    timestamp: new Date(),
    eventType,
    code,
    severity,
    message,
    details,
  };

  securityEvents.push(event);

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.warn('[ICS Security]', event);
  }

  // In production, send to monitoring service
  if (severity === 'critical' || severity === 'high') {
    // TODO: Send to Sentry/monitoring service
    console.error('[ICS Security] Critical/High event:', event);
  }
}

export function getSecurityEvents(): SecurityEvent[] {
  return [...securityEvents];
}

export function clearSecurityEvents(): void {
  securityEvents.length = 0;
}

// ============================================
// Input Sanitization
// ============================================

/**
 * Sanitize string fields to prevent XSS attacks
 */
export function sanitizeString(input: string, maxLength: number = MAX_STRING_LENGTH): string {
  if (typeof input !== 'string') {
    throw new ICSSecurityError(
      'Input must be a string',
      'INVALID_VALUE',
      'high'
    );
  }

  // Truncate to max length
  let sanitized = input.slice(0, maxLength);

  // Remove potential XSS patterns
  // 1. Remove script tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 2. Remove on* event handlers
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '');

  // 3. Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // 4. Remove data URLs with script content
  sanitized = sanitized.replace(/data:script[^,]*,/gi, '');

  // 5. Remove iframe/object/embed tags
  sanitized = sanitized.replace(/<(iframe|object|embed|form|input)\b[^>]*>/gi, '');

  // 6. Remove style tags (can contain javascript expressions)
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  return sanitized.trim();
}

/**
 * Validate date string format and range
 */
export function validateICSDate(dateStr: string): Date | null {
  if (typeof dateStr !== 'string') {
    return null;
  }

  // Basic ICS date format: YYYYMMDD or YYYYMMDDTHHmmssZ
  const icsDateRegex = /^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})Z?)?$/;
  const match = dateStr.match(icsDateRegex);

  if (!match) {
    return null;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
  const day = parseInt(match[3], 10);

  // Validate reasonable date range (1900-2200)
  if (year < 1900 || year > 2200) {
    return null;
  }

  if (month < 0 || month > 11) {
    return null;
  }

  if (day < 1 || day > 31) {
    return null;
  }

  // Create date object
  const date = new Date(year, month, day);

  // Validate the date is valid (e.g., not Feb 30)
  if (date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day) {
    return null;
  }

  // Add time if present
  if (match[4]) {
    const hour = parseInt(match[5], 10);
    const minute = parseInt(match[6], 10);
    const second = parseInt(match[7], 10);

    if (hour > 23 || minute > 59 || second > 59) {
      return null;
    }

    date.setHours(hour, minute, second, 0);
  }

  return date;
}

/**
 * Check for prototype pollution patterns
 */
export function checkPrototypePollution(key: string): boolean {
  const dangerousPatterns = [
    '__proto__',
    'constructor.prototype',
    'prototype',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
  ];

  const normalizedKey = key.toLowerCase().trim();

  return dangerousPatterns.some(pattern =>
    normalizedKey.includes(pattern.toLowerCase())
  );
}

// ============================================
// Zod Schemas for ICS Validation
// ============================================

/**
 * Safe ICS event schema - ONLY allows known properties
 */
const SafeICSEventSchema = z.object({
  // Required fields
  uid: z.string().max(255),
  summary: z.string().min(1).max(MAX_STRING_LENGTH),

  // Optional fields with strict validation
  description: z.string().max(MAX_STRING_LENGTH).optional(),
  location: z.string().max(MAX_STRING_LENGTH).optional(),
  dtstart: z.date(),
  dtend: z.date().optional(),
  allDay: z.boolean().optional().default(false),

  // Status validation
  status: z.enum(['TENTATIVE', 'CONFIRMED', 'CANCELLED']).optional(),

  // Priority (1-9, lower is higher priority)
  priority: z.number().int().min(1).max(9).optional(),

  // Categories/tags - prevent array abuse
  categories: z.array(z.string().max(100)).max(MAX_TAGS_COUNT).optional(),

  // Attendee - prevent injection
  attendee: z.string().max(255).optional(),

  // Recurrence rule - strict format
  rrule: z.string().max(500).optional(),

  // Timestamps
  created: z.date().optional(),
  'last-modified': z.date().optional(),

  // URL - prevent javascript: protocol
  url: z.string().max(2048).refine(
    (url) => !url.toLowerCase().startsWith('javascript:'),
    'URL cannot use javascript: protocol'
  ).optional(),
}).strict(); // CRITICAL: Reject any unknown properties (prevents prototype pollution)

export type SafeICSEvent = z.infer<typeof SafeICSEventSchema>;

/**
 * Validate parsed ICS event against safe schema
 */
export function validateICSEvent(event: Record<string, unknown>): SafeICSEvent {
  try {
    return SafeICSEventSchema.parse(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ICSSecurityError(
        `Invalid ICS event: ${firstError.message}`,
        'INVALID_VALUE',
        'high'
      );
    }
    throw error;
  }
}

// ============================================
// Secure ICS Parser
// ============================================

interface ParseOptions {
  maxFileSize?: number;
  maxEvents?: number;
  allowUnknownProperties?: boolean;
}

interface ParseResult {
  events: SafeICSEvent[];
  warnings: string[];
  securityEvents: SecurityEvent[];
}

/**
 * Secure ICS file parser with comprehensive security checks
 */
export function secureParseICS(
  content: string,
  options: ParseOptions = {}
): ParseResult {
  const {
    maxFileSize = MAX_FILE_SIZE_BYTES,
    maxEvents = MAX_EVENTS_PER_FILE,
    allowUnknownProperties = false,
  } = options;

  const warnings: string[] = [];
  const events: SafeICSEvent[] = [];

  // Check file size
  const contentSize = new Blob([content]).size;
  if (contentSize > maxFileSize) {
    const error = new ICSSecurityError(
      `ICS file exceeds maximum size of ${maxFileSize} bytes`,
      'FILE_TOO_LARGE',
      'critical'
    );
    logSecurityEvent(
      'parse',
      'FILE_TOO_LARGE',
      'critical',
      error.message,
      { size: contentSize, maxSize: maxFileSize }
    );
    throw error;
  }

  // Split into lines
  const lines = content.split(/\r\n|\n|\r/);

  // Check for reasonable line count (prevent DoS)
  if (lines.length > 50000) {
    const error = new ICSSecurityError(
      'ICS file has too many lines (possible DoS attempt)',
      'MALFORMED_STRUCTURE',
      'high'
    );
    logSecurityEvent(
      'parse',
      'MALFORMED_STRUCTURE',
      'high',
      error.message,
      { lineCount: lines.length }
    );
    throw error;
  }

  // Validate ICS structure
  let inCalendar = false;
  let inEvent = false;
  let currentEvent: Record<string, unknown> = {};
  let eventCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNumber = i + 1;

    // Check line length
    if (line.length > MAX_LINE_LENGTH) {
      warnings.push(`Line ${lineNumber}: Line exceeds maximum length`);
      continue;
    }

    // Handle ICS structure
    if (line === 'BEGIN:VCALENDAR') {
      inCalendar = true;
      continue;
    }

    if (line === 'END:VCALENDAR') {
      inCalendar = false;
      break;
    }

    if (!inCalendar) {
      continue;
    }

    if (line === 'BEGIN:VEVENT') {
      // Check event limit
      if (eventCount >= maxEvents) {
        warnings.push(`Reached maximum event limit (${maxEvents}), skipping remaining events`);
        logSecurityEvent(
          'parse',
          'TOO_MANY_EVENTS',
          'medium',
          `ICS file contains more than ${maxEvents} events`,
          { eventCount }
        );
        break;
      }

      inEvent = true;
      currentEvent = {};
      continue;
    }

    if (line === 'END:VEVENT') {
      if (inEvent && Object.keys(currentEvent).length > 0) {
        try {
          // Validate event against safe schema
          const validatedEvent = validateICSEvent(currentEvent);
          events.push(validatedEvent);
          eventCount++;
        } catch (error) {
          if (error instanceof ICSSecurityError) {
            warnings.push(`Event ${eventCount + 1}: ${error.message}`);
            logSecurityEvent(
              'parse',
              error.code,
              error.severity,
              error.message,
              { event: currentEvent }
            );
          } else {
            // For Zod validation errors, just add a warning but don't log as security event
            if (error instanceof z.ZodError) {
              warnings.push(`Event ${eventCount + 1}: ${error.errors[0].message}`);
            } else {
              warnings.push(`Event ${eventCount + 1}: ${(error as Error).message}`);
            }
          }
        }
      }
      inEvent = false;
      currentEvent = {};
      continue;
    }

    // Parse event properties
    if (inEvent) {
      parseICSProperty(line, currentEvent, lineNumber, warnings);
    }
  }

  return {
    events,
    warnings,
    securityEvents: getSecurityEvents(),
  };
}

/**
 * Parse individual ICS property line
 */
function parseICSProperty(
  line: string,
  event: Record<string, unknown>,
  lineNumber: number,
  warnings: string[]
): void {
  // Skip empty lines
  if (!line || line.length === 0) {
    return;
  }

  // Split on first colon
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) {
    warnings.push(`Line ${lineNumber}: Invalid property format (missing colon)`);
    return;
  }

  const propertyName = line.substring(0, colonIndex).trim().toLowerCase();
  const propertyValue = line.substring(colonIndex + 1).trim();

  // Check for prototype pollution
  if (checkPrototypePollution(propertyName)) {
    const error = new ICSSecurityError(
      `Prototype pollution attempt detected: ${propertyName}`,
      'PROTOTYPE_POLLUTION',
      'critical'
    );
    logSecurityEvent(
      'parse_property',
      'PROTOTYPE_POLLUTION',
      'critical',
      error.message,
      { propertyName, lineNumber }
    );
    throw error;
  }

  // Only process known properties
  const knownProperties = new Set([
    'uid',
    'summary',
    'description',
    'location',
    'dtstart',
    'dtend',
    'status',
    'priority',
    'categories',
    'attendee',
    'rrule',
    'created',
    'last-modified',
    'url',
    'dtstart;value=date',
    'dtend;value=date',
  ]);

  if (!knownProperties.has(propertyName)) {
    // Skip unknown properties silently or warn
    return;
  }

  // Parse property value based on type
  try {
    switch (propertyName) {
      case 'uid':
        event.uid = sanitizeString(propertyValue, 255);
        break;

      case 'summary':
        event.summary = sanitizeString(propertyValue);
        break;

      case 'description':
        event.description = sanitizeString(propertyValue);
        break;

      case 'location':
        event.location = sanitizeString(propertyValue);
        break;

      case 'dtstart':
      case 'dtstart;value=date':
        const startDate = validateICSDate(propertyValue);
        if (startDate) {
          event.dtstart = startDate;
        } else {
          warnings.push(`Line ${lineNumber}: Invalid start date format`);
        }
        break;

      case 'dtend':
      case 'dtend;value=date':
        const endDate = validateICSDate(propertyValue);
        if (endDate) {
          event.dtend = endDate;
        } else {
          warnings.push(`Line ${lineNumber}: Invalid end date format`);
        }
        break;

      case 'status':
        if (['TENTATIVE', 'CONFIRMED', 'CANCELLED'].includes(propertyValue.toUpperCase())) {
          event.status = propertyValue.toUpperCase();
        }
        break;

      case 'priority':
        const priority = parseInt(propertyValue, 10);
        if (!isNaN(priority) && priority >= 1 && priority <= 9) {
          event.priority = priority;
        }
        break;

      case 'categories':
        // Split on comma and sanitize each tag, then limit to MAX_TAGS_COUNT
        const tags = propertyValue
          .split(',')
          .map(t => sanitizeString(t.trim(), 100))
          .filter(t => t.length > 0)
          .slice(0, MAX_TAGS_COUNT); // Limit before schema validation
        event.categories = tags;
        break;

      case 'attendee': {
        // Extract CN from ATTENDEE:CN=...
        const cnMatch = propertyValue.match(/CN=([^:;]+)/i);
        if (cnMatch) {
          event.attendee = sanitizeString(cnMatch[1], 255);
        } else {
          event.attendee = sanitizeString(propertyValue, 255);
        }
        break;
      }

      case 'rrule':
        // Basic RRULE validation - just sanitize
        event.rrule = sanitizeString(propertyValue, 500);
        break;

      case 'created':
      case 'last-modified':
        const createdDate = validateICSDate(propertyValue);
        if (createdDate) {
          if (propertyName === 'created') {
            event.created = createdDate;
          } else {
            event['last-modified'] = createdDate;
          }
        }
        break;

      case 'url':
        // Validate URL doesn't use javascript: protocol
        if (propertyValue.toLowerCase().startsWith('javascript:')) {
          warnings.push(`Line ${lineNumber}: Blocked javascript: URL`);
          logSecurityEvent(
            'parse_property',
            'XSS_ATTEMPT',
            'high',
            'Blocked javascript: URL in ICS file',
            { url: propertyValue, lineNumber }
          );
        } else {
          event.url = sanitizeString(propertyValue, 2048);
        }
        break;
    }
  } catch (error) {
    if (error instanceof ICSSecurityError) {
      throw error;
    }
    warnings.push(`Line ${lineNumber}: Failed to parse property`);
  }
}

// ============================================
// CalendarItem Conversion
// ============================================

import type { CalendarItem } from '../../../shared/types';

/**
 * Convert validated SafeICSEvent to CalendarItem
 */
export function icsEventToCalendarItem(event: SafeICSEvent): Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'> {
  // Map ICS status to CalendarItem status
  const statusMap: Record<string, CalendarItem['status']> = {
    'TENTATIVE': 'draft',
    'CONFIRMED': 'published',
    'CANCELLED': 'cancelled',
  };

  // Map ICS priority to CalendarItem priority
  const priorityMap: Record<number, CalendarItem['priority']> = {
    1: 'high',
    2: 'high',
    3: 'high',
    4: 'medium',
    5: 'medium',
    6: 'medium',
    7: 'low',
    8: 'low',
    9: 'low',
  };

  return {
    title: event.summary,
    description: event.description,
    type: 'event', // Default to 'event' type for imported items
    status: statusMap[event.status || 'TENTATIVE'] || 'draft',
    source: 'external',
    startDate: event.dtstart,
    endDate: event.dtend,
    allDay: event.allDay,
    location: event.location,
    priority: event.priority ? priorityMap[event.priority] : undefined,
    tags: event.categories,
    assignee: event.attendee,
  };
}

/**
 * Parse ICS file and convert to CalendarItem array
 */
export function parseICSToCalendarItems(
  content: string,
  options?: ParseOptions
): Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>[] {
  const result = secureParseICS(content, options);

  // Log warnings if any
  if (result.warnings.length > 0) {
    console.warn('[ICS Parser] Warnings:', result.warnings);
  }

  // Convert events to CalendarItems
  return result.events.map(icsEventToCalendarItem);
}
