import { memo, useCallback } from 'react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CalendarViewMode } from '../../../shared/types';

interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  eventsCount?: number;
  onNavigate?: (direction: 'prev' | 'next' | 'today') => void;
  onViewChange?: (view: CalendarViewMode) => void;
  onCreateEvent?: () => void;
}

/**
 * CalendarHeader Component
 *
 * Provides navigation, view switching, and global actions for the calendar.
 *
 * Features:
 * - Date navigation (previous/next/today)
 * - View mode switching (month/week/day)
 * - Event count display
 * - Create event action
 * - Keyboard shortcuts
 * - Accessible to screen readers
 */
export const CalendarHeader = memo<CalendarHeaderProps>(({
  currentDate,
  viewMode,
  eventsCount = 0,
  onNavigate,
  onViewChange,
  onCreateEvent,
}) => {
  const { t } = useTranslation(['calendar', 'common']);

  // Handle navigation
  const handleNavigate = useCallback((direction: 'prev' | 'next' | 'today') => {
    onNavigate?.(direction);
  }, [onNavigate]);

  // Handle view change
  const handleViewChange = useCallback((newView: CalendarViewMode) => {
    onViewChange?.(newView);
  }, [onViewChange]);

  // Format date label based on view mode
  const formatDateLabel = () => {
    switch (viewMode) {
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      case 'week':
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      default:
        return format(currentDate, 'MMMM yyyy');
    }
  };

  // View mode options
  const viewModes: { value: CalendarViewMode; label: string }[] = [
    { value: 'month', label: t('calendar:views.month') },
    { value: 'week', label: t('calendar:views.week') },
    { value: 'day', label: t('calendar:views.day') },
  ];

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-card shadow-sm">
      {/* Left: Title and event count */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-bold text-foreground">
            {formatDateLabel()}
          </h1>
        </div>
        <div className="h-6 w-px bg-border" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">
          {t('calendar:header.eventsCount', { count: eventsCount })}
        </span>
      </div>

      {/* Right: Navigation and actions */}
      <div className="flex items-center gap-2">
        {/* View switcher */}
        <nav
          className="flex items-center gap-1 p-1 rounded-lg bg-muted"
          role="tablist"
          aria-label={t('calendar:a11y.viewSwitcher')}
        >
          {viewModes.map((mode) => (
            <motion.button
              key={mode.value}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleViewChange(mode.value)}
              className={`
                px-3 py-1.5 rounded-md text-sm font-medium transition-all
                ${viewMode === mode.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }
              `}
              role="tab"
              aria-selected={viewMode === mode.value}
              aria-label={t('calendar:a11y.switchToView', { view: mode.label })}
            >
              {mode.label}
            </motion.button>
          ))}
        </nav>

        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleNavigate('prev')}
            className="p-2.5 rounded-lg bg-background hover:bg-accent transition-all border-2 border-border shadow-sm hover:shadow-md"
            aria-label={t('calendar:a11y.previousPeriod')}
            title={t('calendar:navigation.previous')}
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleNavigate('today')}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all border-2 border-primary shadow-md hover:shadow-lg"
            aria-label={t('calendar:navigation.goToToday')}
          >
            {t('calendar:navigation.today')}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleNavigate('next')}
            className="p-2.5 rounded-lg bg-background hover:bg-accent transition-all border-2 border-border shadow-sm hover:shadow-md"
            aria-label={t('calendar:a11y.nextPeriod')}
            title={t('calendar:navigation.next')}
          >
            <ChevronRight className="h-4 w-4" />
          </motion.button>
        </div>

        {/* Create event button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onCreateEvent}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all border-2 border-primary shadow-md hover:shadow-lg"
          aria-label={t('calendar:event.create')}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('calendar:event.create')}</span>
        </motion.button>
      </div>
    </header>
  );
});

CalendarHeader.displayName = 'CalendarHeader';
