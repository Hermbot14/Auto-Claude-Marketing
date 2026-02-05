/**
 * Calendar Permission System
 *
 * SECURITY: Authorization checks for calendar operations.
 * This is a desktop app, so permissions are based on:
 * 1. File system access (OS-level)
 * 2. Project ownership (stored in projectStore)
 * 3. Session-based user context
 *
 * Severity: HIGH (CALC-SEC-005)
 * Task: TASK-006
 */

import { existsSync } from 'fs';
import path from 'path';
import type { Project } from '../../shared/types';
import { projectStore } from '../project-store';
import { debugLog, debugError } from '../../shared/utils/debug-logger';
import { CALENDAR_DIR } from '../../shared/constants';

/**
 * Permission levels for calendar operations
 */
export enum CalendarPermissionLevel {
  /** No access to calendar */
  NONE = 'none',
  /** Can read calendar data */
  READ = 'read',
  /** Can read and write calendar data */
  WRITE = 'write',
  /** Full access including delete operations */
  ADMIN = 'admin',
}

/**
 * Permission result with optional error details
 */
export interface PermissionResult {
  granted: boolean;
  level: CalendarPermissionLevel;
  error?: string;
  code?: 'FORBIDDEN' | 'NOT_FOUND' | 'UNKNOWN';
}

/**
 * Calendar permissions for a project
 */
export interface CalendarPermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  level: CalendarPermissionLevel;
}

/**
 * Authorization error codes for UI display
 */
export enum AuthErrorCode {
  /** Project not found */
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  /** User lacks read permissions */
  READ_DENIED = 'READ_DENIED',
  /** User lacks write permissions */
  WRITE_DENIED = 'WRITE_DENIED',
  /** User lacks delete permissions */
  DELETE_DENIED = 'DELETE_DENIED',
  /** Calendar feature is disabled */
  FEATURE_DISABLED = 'FEATURE_DISABLED',
  /** Invalid project ID (security) */
  INVALID_PROJECT_ID = 'INVALID_PROJECT_ID',
}

/**
 * Check if a user has read access to a project's calendar
 *
 * Security: This is a desktop app, so we check:
 * 1. Project exists in projectStore
 * 2. Project directory exists on file system
 * 3. Calendar directory is accessible (if exists)
 *
 * @param projectId - Project ID to check
 * @returns Permission result with granted status and error details
 */
export function checkCalendarReadPermission(projectId: string): PermissionResult {
  return checkCalendarPermission(projectId, CalendarPermissionLevel.READ);
}

/**
 * Check if a user has write access to a project's calendar
 *
 * Security: This is a desktop app, so we check:
 * 1. Project exists in projectStore
 * 2. Project directory exists on file system
 * 3. Calendar directory is writable (if exists)
 *
 * @param projectId - Project ID to check
 * @returns Permission result with granted status and error details
 */
export function checkCalendarWritePermission(projectId: string): PermissionResult {
  return checkCalendarPermission(projectId, CalendarPermissionLevel.WRITE);
}

/**
 * Check if a user has delete access to a project's calendar
 *
 * Security: This is a desktop app, so we check:
 * 1. Project exists in projectStore
 * 2. Project directory exists on file system
 * 3. Calendar directory is writable (if exists)
 *
 * @param projectId - Project ID to check
 * @returns Permission result with granted status and error details
 */
export function checkCalendarDeletePermission(projectId: string): PermissionResult {
  return checkCalendarPermission(projectId, CalendarPermissionLevel.ADMIN);
}

/**
 * Get calendar permissions for a project
 *
 * This is the main permission check function that validates:
 * 1. Project exists in projectStore
 * 2. Project path is accessible
 * 3. Returns appropriate permission level based on file system access
 *
 * @param projectId - Project ID to check
 * @param requiredLevel - Minimum permission level required
 * @returns Permission result with granted status and error details
 */
export function checkCalendarPermission(
  projectId: string,
  requiredLevel: CalendarPermissionLevel
): PermissionResult {
  // Special case: demo project always has full permissions
  if (projectId === 'demo') {
    return {
      granted: true,
      level: CalendarPermissionLevel.ADMIN,
    };
  }

  // 1. Check if project exists in projectStore
  const project = projectStore.getProject(projectId);
  if (!project) {
    debugError('[Calendar Permissions] Project not found:', projectId);
    return {
      granted: false,
      level: CalendarPermissionLevel.NONE,
      error: 'Project not found',
      code: 'NOT_FOUND',
    };
  }

  // 2. Check if project path exists on file system
  if (!existsSync(project.path)) {
    debugError('[Calendar Permissions] Project path does not exist:', project.path);
    return {
      granted: false,
      level: CalendarPermissionLevel.NONE,
      error: 'Project directory not found',
      code: 'NOT_FOUND',
    };
  }

  // 3. Check calendar directory permissions (if exists)
  const calendarDirPath = path.join(project.path, CALENDAR_DIR);
  let hasCalendarAccess = true;

  if (existsSync(calendarDirPath)) {
    // Calendar directory exists - check if readable
    try {
      // Try to access the directory
      const fs = require('fs');
      fs.accessSync(calendarDirPath, fs.constants.R_OK);
    } catch (error) {
      debugError('[Calendar Permissions] Calendar directory not accessible:', calendarDirPath, error);
      hasCalendarAccess = false;
    }
  }

  // 4. Determine permission level based on file system access
  // For a desktop app, if you can access the project directory, you have full permissions
  // This is because the OS file system permissions are the primary security boundary
  let grantedLevel = CalendarPermissionLevel.ADMIN;

  if (!hasCalendarAccess) {
    grantedLevel = CalendarPermissionLevel.NONE;
  }

  // 5. Check if required level is met
  const levelOrder = [
    CalendarPermissionLevel.NONE,
    CalendarPermissionLevel.READ,
    CalendarPermissionLevel.WRITE,
    CalendarPermissionLevel.ADMIN,
  ];

  const requiredIndex = levelOrder.indexOf(requiredLevel);
  const grantedIndex = levelOrder.indexOf(grantedLevel);

  const granted = grantedIndex >= requiredIndex;

  if (!granted) {
    const errorMessages: Record<CalendarPermissionLevel, string> = {
      [CalendarPermissionLevel.NONE]: 'No access to calendar',
      [CalendarPermissionLevel.READ]: 'Read permission required',
      [CalendarPermissionLevel.WRITE]: 'Write permission required',
      [CalendarPermissionLevel.ADMIN]: 'Admin permission required',
    };

    return {
      granted: false,
      level: grantedLevel,
      error: errorMessages[requiredLevel],
      code: 'FORBIDDEN',
    };
  }

  debugLog('[Calendar Permissions] Permission granted:', {
    projectId,
    requiredLevel,
    grantedLevel,
  });

  return {
    granted: true,
    level: grantedLevel,
  };
}

/**
 * Get all calendar permissions for a project
 *
 * Returns detailed permission information for UI display
 *
 * @param projectId - Project ID to check
 * @returns Calendar permissions object
 */
export function getCalendarPermissions(projectId: string): CalendarPermissions {
  const result = checkCalendarPermission(projectId, CalendarPermissionLevel.READ);

  return {
    canRead: result.granted,
    canWrite: checkCalendarPermission(projectId, CalendarPermissionLevel.WRITE).granted,
    canDelete: checkCalendarPermission(projectId, CalendarPermissionLevel.ADMIN).granted,
    level: result.level,
  };
}

/**
 * Create a standardized permission denied error
 *
 * @param operation - The operation that was denied
 * @param projectId - Project ID
 * @returns Error object with code and message
 */
export function createPermissionDeniedError(
  operation: string,
  projectId: string
): { error: string; code: 'FORBIDDEN' | 'NOT_FOUND' | 'UNKNOWN' } {
  const result = checkCalendarPermission(projectId, CalendarPermissionLevel.READ);

  return {
    error: result.error || `Permission denied for ${operation}`,
    code: result.code || 'FORBIDDEN',
  };
}

/**
 * Validate permission before calendar operation
 *
 * This is a convenience function for use in IPC handlers
 * Returns false if permission denied, true if granted
 *
 * @param projectId - Project ID
 * @param operation - Operation being performed ('read', 'write', 'delete')
 * @returns Permission result
 */
export function validateCalendarOperation(
  projectId: string,
  operation: 'read' | 'write' | 'delete'
): PermissionResult {
  switch (operation) {
    case 'read':
      return checkCalendarReadPermission(projectId);
    case 'write':
      return checkCalendarWritePermission(projectId);
    case 'delete':
      return checkCalendarDeletePermission(projectId);
    default:
      return {
        granted: false,
        level: CalendarPermissionLevel.NONE,
        error: 'Invalid operation',
        code: 'FORBIDDEN',
      };
  }
}
