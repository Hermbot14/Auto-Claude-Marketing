import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

interface CalendarSkeletonProps {
  layout?: 'timeline' | 'month';
}

export function CalendarSkeleton({ layout = 'timeline' }: CalendarSkeletonProps) {
  const { t } = useTranslation(['calendar']);

  return (
    <div className="h-full flex flex-col" role="status" aria-live="polite" aria-label={t('calendar:a11y.loading')}>
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-2">
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          <div className="h-5 w-16 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 bg-muted animate-pulse rounded-lg" />
          <div className="h-9 w-9 bg-muted animate-pulse rounded-lg" />
          <div className="h-9 w-9 bg-muted animate-pulse rounded-lg" />
          <div className="h-9 w-9 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>

      {/* Timeline skeleton */}
      {layout === 'timeline' && (
        <div className="flex-1 overflow-hidden p-4">
          {/* Time header */}
          <div className="flex items-center gap-4 mb-4">
            <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            <div className="flex-1 flex gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex-1 h-6 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </div>

          {/* Timeline rows */}
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-12 w-24 bg-muted/50 animate-pulse rounded" />
                <div className="flex-1 h-12 bg-muted/30 animate-pulse rounded relative">
                  {/* Simulated event card */}
                  <motion.div
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: 0.6 }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.1 }}
                    className="absolute left-4 top-2 h-8 w-32 bg-primary/20 rounded"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month view skeleton */}
      {layout === 'month' && (
        <div className="flex-1 overflow-hidden p-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-8 bg-muted animate-pulse rounded text-center text-sm font-medium" />
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="aspect-square bg-muted/30 animate-pulse rounded p-1">
                {/* Simulated event indicators */}
                {i % 5 === 0 && (
                  <div className="h-2 w-full bg-primary/20 rounded mt-1" />
                )}
                {i % 7 === 0 && (
                  <div className="h-2 w-3/4 bg-accent/50 rounded mt-0.5" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading text */}
      <div className="sr-only">{t('calendar:a11y.loading')}</div>
    </div>
  );
}

/**
 * Inline skeleton for calendar item card
 */
export function CalendarItemCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ repeat: Infinity, duration: 1.5 }}
      className="h-16 bg-muted/30 rounded-lg p-3"
      role="status"
      aria-label="Loading item"
    >
      <div className="h-4 w-3/4 bg-muted animate-pulse rounded mb-2" />
      <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
    </motion.div>
  );
}

/**
 * Inline skeleton for detail panel
 */
export function CalendarDetailSkeleton() {
  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card border-l shadow-xl overflow-y-auto p-6"
      role="status"
      aria-label="Loading item details"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="h-6 w-20 bg-muted animate-pulse rounded" />
            <div className="h-6 w-16 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-8 w-full bg-muted animate-pulse rounded" />
        </div>

        {/* Content sections */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-3 w-full bg-muted/50 animate-pulse rounded" />
            <div className="h-3 w-3/4 bg-muted/50 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
