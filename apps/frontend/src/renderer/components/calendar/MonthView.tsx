import { memo, useCallback, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { CalendarGrid } from './CalendarGrid';
import { CalendarHeader } from './CalendarHeader';
import { EventCard } from './EventCard';
import type { CalendarItem as CalendarItemType } from '../../../shared/types';
import { CALENDAR_ITEM_TYPE_LABELS } from '../../../shared/constants';

interface MonthViewProps {
  items: CalendarItemType[];
  currentDate: Date;
  onNavigate?: (direction: 'prev' | 'next' | 'today') => void;
  onViewChange?: (view: 'month' | 'week' | 'day') => void;
  onItemClick?: (item: CalendarItemType) => void;
  onDateClick?: (date: Date) => void;
  onCreateEvent?: () => void;
  className?: string;
}

/**
 * MonthView Component
 *
 * Displays a monthly calendar grid with events.
 *
 * Features:
 * - 7-column grid for days of week
 * - Events displayed within date cells
 * - Handles month overflow dates
 * - Month navigation
 * - Responsive layout
 * - Keyboard navigation
 * - Accessible to screen readers
 */
export const MonthView = memo<MonthViewProps>(({
  items,
  currentDate,
  onNavigate,
  onViewChange,
  onItemClick,
  onDateClick,
  onCreateEvent,
  className = '',
}) => {
  const { t } = useTranslation(['calendar', 'common']);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedItem, setSelectedItem] = useState<CalendarItemType | null>(null);

  // Handle date click
  const handleDateClick = useCallback((date: Date) => {
    setSelectedDate(date);
    onDateClick?.(date);
  }, [onDateClick]);

  // Handle item click
  const handleItemClick = useCallback((item: CalendarItemType) => {
    setSelectedItem(item);
    onItemClick?.(item);
  }, [onItemClick]);

  // Custom day cell renderer with EventCard
  const renderDayCell = useCallback((
    date: Date,
    dayItems: CalendarItemType[],
    index: number
  ) => {
    const { format } = require('date-fns');
    const { isSameMonth, isToday } = require('date-fns');

    const isCurrentMonth = isSameMonth(date, currentDate);
    const isTodayDate = isToday(date);

    // Limit items displayed per day
    const MAX_ITEMS_PER_DAY = 3;
    const displayItems = dayItems.slice(0, MAX_ITEMS_PER_DAY);
    const remainingCount = Math.max(0, dayItems.length - MAX_ITEMS_PER_DAY);

    return (
      <div className="h-full flex flex-col">
        {/* Date number */}
        <div className={`
          text-sm font-bold mb-1 flex items-center justify-between
          ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}
          ${isTodayDate ? 'text-primary' : ''}
        `}>
          <span>{format(date, 'd')}</span>
          {isTodayDate && (
            <span className="text-xs text-primary">{t('calendar:grid.today')}</span>
          )}
        </div>

        {/* Events with EventCard */}
        <div className="space-y-1 flex-1 overflow-y-auto">
          <AnimatePresence>
            {displayItems.map((item) => (
              <EventCard
                key={item.id}
                event={item}
                viewMode="month"
                size="compact"
                isSelected={selectedItem?.id === item.id}
                onClick={handleItemClick}
                className="shadow-sm"
              />
            ))}
          </AnimatePresence>

          {/* More indicator */}
          {remainingCount > 0 && (
            <div
              className="px-1.5 py-0.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-center"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Show all events for this day in a modal
              }}
            >
              {t('calendar:event.moreEvents', { count: remainingCount })}
            </div>
          )}
        </div>
      </div>
    );
  }, [currentDate, selectedItem, handleItemClick, t]);

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Header */}
      <CalendarHeader
        currentDate={currentDate}
        viewMode="month"
        eventsCount={items.length}
        onNavigate={onNavigate}
        onViewChange={onViewChange}
        onCreateEvent={onCreateEvent}
      />

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-4">
        <CalendarGrid
          currentDate={currentDate}
          items={items}
          onDateClick={handleDateClick}
          onItemClick={handleItemClick}
          renderDayCell={renderDayCell}
          selectedDate={selectedDate}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-3 border-t bg-card shadow-sm overflow-x-auto">
        <span className="text-sm font-semibold text-foreground">
          {t('calendar:legend.eventTypes')}:
        </span>
        {Object.entries(CALENDAR_ITEM_TYPE_LABELS).map(([type, label]) => (
          <div
            key={type}
            className="flex items-center gap-1.5 flex-shrink-0"
          >
            <div
              className="w-3.5 h-3.5 rounded-sm shadow-sm"
              style={{
                background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
              }}
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

MonthView.displayName = 'MonthView';
