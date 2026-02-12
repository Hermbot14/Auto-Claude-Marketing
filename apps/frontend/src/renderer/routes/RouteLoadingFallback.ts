/**
 * Route loading fallback component.
 *
 * Displays during lazy-loaded component chunk fetching.
 * Provides visual feedback and maintains perceived performance.
 */

import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

export function RouteLoadingFallback() {
  const { t } = useTranslation('common');

  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {t('loading', { defaultValue: 'Loading...' })}
        </p>
      </div>
    </div>
  );
}

/**
 * Inline route loading indicator for smaller components.
 *
 * Use this when loading a component within an existing layout.
 */
export function InlineRouteLoader({ size = 'default' }: { size?: 'small' | 'default' | 'large' }) {
  const sizeClasses = {
    small: 'h-4 w-4',
    default: 'h-6 w-6',
    large: 'h-8 w-8',
  };

  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-muted-foreground`} aria-hidden="true" />
    </div>
  );
}
