/**
 * Permission Denied Banner Component
 *
 * Displays when a user lacks authorization to access calendar features.
 * This is a security component that prevents unauthorized access while
 * providing clear feedback to users about why access was denied.
 *
 * Security: TASK-006, CALC-SEC-005
 */

import React from 'react';
import { AlertTriangle, Lock, FolderOpen } from 'lucide-react';

interface PermissionDeniedBannerProps {
  /** The error message from the permission check */
  error?: string;
  /** The error code for specific messaging */
  code?: 'FORBIDDEN' | 'NOT_FOUND' | 'UNKNOWN';
  /** Optional callback to request access */
  onRequestAccess?: () => void;
  /** Project name for context */
  projectName?: string;
}

/**
 * Get user-friendly message based on error code
 */
function getErrorMessage(code?: string, projectName?: string): {
  title: string;
  message: string;
  suggestion: string;
} {
  switch (code) {
    case 'FORBIDDEN':
      return {
        title: 'Access Denied',
        message: `You do not have permission to access this calendar.`,
        suggestion: 'Contact your system administrator to request access to this project.',
      };
    case 'NOT_FOUND':
      return {
        title: 'Project Not Found',
        message: projectName
          ? `The project "${projectName}" could not be found.`
          : 'The project could not be found.',
        suggestion: 'The project may have been moved or deleted. Try refreshing the project list.',
      };
    default:
      return {
        title: 'Calendar Access Error',
        message: 'Unable to access the calendar for this project.',
        suggestion: 'Try refreshing the page or contact support if the problem persists.',
      };
  }
}

/**
 * PermissionDeniedBanner Component
 *
 * Shows a clear, accessible warning when calendar access is denied.
 * Provides guidance on next steps and optional access request button.
 */
export const PermissionDeniedBanner: React.FC<PermissionDeniedBannerProps> = ({
  error,
  code = 'UNKNOWN',
  onRequestAccess,
  projectName,
}) => {
  const { title, message, suggestion } = getErrorMessage(code, projectName);

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-center gap-4 p-4 m-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg"
    >
      {/* Icon Container */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-center w-12 h-12 bg-amber-100 dark:bg-amber-900/50 rounded-full">
          <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
            {title}
          </h3>
        </div>

        <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
          {error || message}
        </p>

        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
          {suggestion}
        </p>

        {/* Optional Request Access Button */}
        {onRequestAccess && code === 'FORBIDDEN' && (
          <div className="mt-3">
            <button
              type="button"
              onClick={onRequestAccess}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-amber-900 bg-amber-100 rounded-md hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:bg-amber-900 dark:text-amber-100 dark:hover:bg-amber-800"
            >
              <FolderOpen className="w-4 h-4" aria-hidden="true" />
              Request Access
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Compact variant for inline use
 */
export const PermissionDeniedInline: React.FC<Omit<PermissionDeniedBannerProps, 'onRequestAccess'>> = ({
  error,
  code = 'UNKNOWN',
}) => {
  const { title } = getErrorMessage(code);

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md"
    >
      <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
        {title}
      </span>
      {error && (
        <span className="text-sm text-amber-700 dark:text-amber-300 truncate">
          : {error}
        </span>
      )}
    </div>
  );
};

/**
 * Full page variant for when calendar is completely inaccessible
 */
export const PermissionDeniedPage: React.FC<PermissionDeniedBannerProps> = (props) => {
  const { title, message, suggestion } = getErrorMessage(props.code, props.projectName);

  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center justify-center w-20 h-20 bg-amber-100 dark:bg-amber-900/50 rounded-full">
            <Lock className="w-10 h-10 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {title}
        </h2>

        {/* Message */}
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {props.error || message}
        </p>

        {/* Suggestion */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg mb-6">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {suggestion}
          </p>
        </div>

        {/* Request Access Button */}
        {props.onRequestAccess && props.code === 'FORBIDDEN' && (
          <button
            type="button"
            onClick={props.onRequestAccess}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <FolderOpen className="w-4 h-4" aria-hidden="true" />
            Request Access
          </button>
        )}
      </div>
    </div>
  );
};

export default PermissionDeniedBanner;
