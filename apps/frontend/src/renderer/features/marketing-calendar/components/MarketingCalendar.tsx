/**
 * Marketing Calendar Component
 * Main calendar component with unified store and conflict detection
 *
 * Replaces:
 * - features/content-calendar/ContentCalendar.tsx
 * - Components using old calendarStore.ts
 *
 * @deprecated Use MarketingCalendar instead of ContentCalendar
 */

import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useMarketingCalendarStore,
  type MarketingCalendarState,
} from '../stores/marketingCalendarStore';
import type { CalendarViewMode, MarketingCalendarItem, ScheduleConflict } from '../../../../shared/types/marketing-calendar';
import { CalendarFilters } from './CalendarFilters';
import { CalendarHeader } from './CalendarHeader';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { ConflictDialog } from './ConflictDialog';

// ============================================
// Main Component
// ============================================

interface MarketingCalendarProps {
  projectId: string;
  className?: string;
}

export function MarketingCalendar({ projectId, className = '' }: MarketingCalendarProps) {
  const { t } = useTranslation(['marketing-calendar', 'common']);

  // Store selectors
  const calendarData = useMarketingCalendarStore((state) => state.calendarData);
  const currentDate = useMarketingCalendarStore((state) => state.currentDate);
  const viewMode = useMarketingCalendarStore((state) => state.viewMode);
  const filters = useMarketingCalendarStore((state) => state.filters);
  const isLoading = useMarketingCalendarStore((state) => state.isLoading);
  const error = useMarketingCalendarStore((state) => state.error);
  const conflicts = useMarketingCalendarStore((state) => state.conflicts);
  const showConflictDialog = useMarketingCalendarStore((state) => state.showConflictDialog);

  // Actions
  const setCurrentDate = useMarketingCalendarStore((state) => state.setCurrentDate);
  const setViewMode = useMarketingCalendarStore((state) => state.setViewMode);
  const setFilters = useMarketingCalendarStore((state) => state.setFilters);
  const clearFilters = useMarketingCalendarStore((state) => state.clearFilters);
  const setSelectedItem = useMarketingCalendarStore((state) => state.setSelectedItem);
  const resolveConflict = useMarketingCalendarStore((state) => state.resolveConflict);
  const dismissConflict = useMarketingCalendarStore((state) => state.dismissConflict);

  // Load calendar data on mount
  useEffect(() => {
    // Calendar data should be loaded via API
    // This is handled by the parent component or a separate data loading hook
    if (!calendarData && projectId) {
      // Trigger data load if not already loaded
      // This would call the loadMarketingCalendarData function
    }
  }, [projectId, calendarData]);

  // Handle view mode change
  const handleViewModeChange = useCallback((mode: CalendarViewMode) => {
    setViewMode(mode);
  }, [setViewMode]);

  // Handle filter change
  const handleFilterChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
  }, [setFilters]);

  // Handle filter clear
  const handleClearFilters = useCallback(() => {
    clearFilters();
  }, [clearFilters]);

  // Handle item selection
  const handleItemSelect = useCallback((item: MarketingCalendarItem | null) => {
    setSelectedItem(item);
  }, [setSelectedItem]);

  // Handle conflict resolution
  const handleResolveConflict = useCallback((resolution: ScheduleConflict) => {
    const resolution = resolveConflict(resolution);
    // Apply resolution
    if (resolution) {
      resolveConflict(resolution);
    }
  }, [resolveConflict]);

  const handleDismissConflict = useCallback((conflictId: string) => {
    dismissConflict(conflictId);
  }, [dismissConflict]);

  // Handle date navigation
  const handleDateChange = useCallback((date: Date) => {
    setCurrentDate(date);
  }, [setCurrentDate]);

  // Render current view
  const renderView = () => {
    switch (viewMode) {
      case 'month':
        return <MonthView />;
      case 'week':
        return <WeekView />;
      case 'day':
        return <WeekView viewMode="day" />;
      case 'list':
        return <ListView />;
      case 'tour-timeline':
        return <TourTimelineView />;
      default:
        return <MonthView />;
    }
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className={`marketing-calendar ${className}`}>
      {/* Header with navigation and view mode selector */}
      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onDateChange={handleDateChange}
      />

      {/* Filters */}
      <CalendarFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">
            {t('common:loading')}
          </span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 m-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Calendar View */}
      {!isLoading && !error && renderView()}

      {/* Conflict Dialog */}
      {showConflictDialog && conflicts.length > 0 && (
        <ConflictDialog
          conflicts={conflicts}
          onResolve={handleResolveConflict}
          onDismiss={handleDismissConflict}
        />
      )}
    </div>
  );
}

// ============================================
// Sub-Components (placeholder implementations)
// ============================================

/**
 * Month View Component
 * Displays calendar in month grid format
 */
function MonthView() {
  const generateMonthGrid = useMarketingCalendarStore((state) => state.generateMonthGrid);
  const currentDate = useMarketingCalendarStore((state) => state.currentDate);
  const getItemsForDate = useMarketingCalendarStore((state) => state.getItemsForDate);

  const grid = generateMonthGrid(currentDate);

  return (
    <div className="month-view grid grid-cols-7 gap-1">
      {grid.map((cell, index) => (
        <div
          key={cell.date.toISOString()}
          className={`
            calendar-day min-h-[100px] p-2 border rounded
            ${cell.isCurrentMonth
              ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800'
            }
            ${cell.isToday ? 'ring-2 ring-primary-500' : ''}
          `}
        >
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {cell.date.getDate()}
          </div>
          <div className="space-y-1">
            {cell.items.map((item) => (
              <EventCard key={item.id} item={item} compact />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Week View Component
 * Displays calendar in week format
 */
interface WeekViewProps {
  viewMode?: 'week' | 'day';
}

function WeekView({ viewMode = 'week' }: WeekViewProps) {
  const generateWeekDays = useMarketingCalendarStore((state) => state.generateWeekDays);
  const currentDate = useMarketingCalendarStore((state) => state.currentDate);

  const weekDays = generateWeekDays(currentDate);

  return (
    <div className="week-view">
      {weekDays.map((day) => (
        <div
          key={day.date.toISOString()}
          className={`
            week-day flex-1 p-4 border-l
            ${day.isToday ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
          `}
        >
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          <div className="space-y-2">
            {day.items.map((item) => (
              <EventCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * List View Component
 * Displays calendar items in a list format
 */
function ListView() {
  const getFilteredItems = useMarketingCalendarStore((state) => state.getFilteredItems);
  const items = getFilteredItems();

  return (
    <div className="list-view space-y-2">
      {items.map((item) => (
        <EventCard key={item.id} item={item} />
      ))}
      {items.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No events found
        </div>
      )}
    </div>
  );
}

/**
 * Tour Timeline View Component
 * Displays calendar items in a timeline format for tour/roadmap
 */
function TourTimelineView() {
  const getFilteredItems = useMarketingCalendarStore((state) => state.getFilteredItems);
  const items = getFilteredItems().filter((item) => item.type === 'campaign');

  return (
    <div className="tour-timeline-view space-y-4">
      {items.map((item) => (
        <div key={item.id} className="tour-timeline-item">
          <EventCard item={item} />
        </div>
      ))}
      {items.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No campaigns found
        </div>
      )}
    </div>
  );
}

/**
 * Event Card Component
 * Displays a single calendar event
 */
interface EventCardProps {
  item: MarketingCalendarItem;
  compact?: boolean;
}

function EventCard({ item, compact = false }: EventCardProps) {
  const { t } = useTranslation(['marketing-calendar', 'common']);
  const setSelectedItem = useMarketingCalendarStore((state) => state.setSelectedItem);
  const startDrag = useMarketingCalendarStore((state) => state.startDrag);

  // Get color based on event type
  const getEventColor = () => {
    const colors = {
      campaign: 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200',
      content: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200',
      social: 'bg-pink-100 dark:bg-pink-900/20 text-pink-800 dark:text-pink-200',
      email: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200',
      seo: 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200',
      deadline: 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200',
      event: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-200',
      ad: 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200',
      video: 'bg-rose-100 dark:bg-rose-900/20 text-rose-800 dark:text-rose-200',
    };
    return colors[item.type] || colors.event;
  };

  const handleDragStart = useCallback(() => {
    startDrag(item);
  }, [item, startDrag]);

  const handleClick = useCallback(() => {
    setSelectedItem(item);
  }, [item, setSelectedItem]);

  if (compact) {
    return (
      <div
        className={`event-card-compact cursor-pointer rounded px-2 py-1 text-xs truncate ${getEventColor()}`}
        onClick={handleClick}
        draggable
        onDragStart={handleDragStart}
      >
        {item.title}
      </div>
    );
  }

  return (
    <div
      className={`
        event-card rounded-lg shadow-sm border border
        hover:shadow-md transition-shadow cursor-move
        ${getEventColor()}
      `}
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
    >
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-sm flex-1">{item.title}</h4>
          {item.priority && (
            <span className={`
              text-xs px-2 py-0.5 rounded-full
              ${item.priority === 'high' ? 'bg-red-500 text-white' : ''}
              ${item.priority === 'medium' ? 'bg-yellow-500 text-white' : ''}
              ${item.priority === 'low' ? 'bg-green-500 text-white' : ''}
            `}>
              {t(`marketing-calendar:priorities.${item.priority}`)}
            </span>
          )}
        </div>

        {item.description && !compact && (
          <p className="text-xs opacity-80 line-clamp-2 mb-2">{item.description}</p>
        )}

        <div className="flex items-center gap-2 text-xs opacity-70">
          {item.startDate && (
            <span>{new Date(item.startDate).toLocaleDateString()}</span>
          )}
          {item.platforms && item.platforms.length > 0 && (
            <span>{item.platforms.join(', ')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Exports
// ============================================

export default MarketingCalendar;
