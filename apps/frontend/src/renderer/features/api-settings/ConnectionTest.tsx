/**
 * ConnectionTest - Component for testing API connection
 *
 * Features:
 * - Test button with loading state
 * - Visual feedback for success/failure
 * - Error message display
 * - Auto-hide results after 5 seconds
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useApiSettingsStore } from './ApiSettingsStore';
import type { TestConnectionResult } from '@shared/types/profile';
import { cn } from '../../lib/utils';

interface ConnectionTestProps {
  className?: string;
}

export function ConnectionTest({ className }: ConnectionTestProps) {
  const { t } = useTranslation();
  const { isTestingConnection, testConnectionResult, testConnection, clearTestResult } =
    useApiSettingsStore();

  const [showResult, setShowResult] = useState(false);

  // Auto-hide test result after 5 seconds
  useEffect(() => {
    if (testConnectionResult) {
      setShowResult(true);
      const timeoutId = () => {
        setShowResult(false);
        clearTestResult();
      };
      const timer = setTimeout(timeoutId, 5000);
      return () => clearTimeout(timer);
    }
  }, [testConnectionResult, clearTestResult]);

  const handleTestConnection = async () => {
    await testConnection();
  };

  const isError = testConnectionResult && !testConnectionResult.success;
  const isSuccess = testConnectionResult && testConnectionResult.success;

  return (
    <div className={cn('space-y-3', className)}>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleTestConnection}
        disabled={isTestingConnection}
      >
        {isTestingConnection ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Testing connection...
          </>
        ) : (
          'Test Connection'
        )}
      </Button>

      {/* Test result display */}
      {showResult && testConnectionResult && (
        <div
          className={cn(
            'flex items-start gap-2 p-3 rounded-lg border transition-opacity',
            isSuccess
              ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
              : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
          )}
        >
          {isSuccess ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p
              className={cn('text-sm font-medium', isSuccess ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200')}
            >
              {isSuccess ? 'Connection successful' : 'Connection failed'}
            </p>
            <p
              className={cn('text-sm', isSuccess ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300')}
            >
              {testConnectionResult.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
