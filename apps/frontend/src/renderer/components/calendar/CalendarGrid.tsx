import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { CalendarItem as CalendarItemType } from '../../../shared/types';

interface CalendarGridProps {
  currentDate: Date;
  items: CalendarItemType[];
  onDateClick?: (date: Date) => void;
  onItemClick?: (item: CalendarItemType) => void;
  renderDayCell?: (date: Date, items: CalendarItemType[], index: number) => React.ReactNode;
  selectedDate?: Date | null;
  className?: string;
}

/**
 * CalendarGrid Component
 *
 * Base component for calendar grid layouts with responsive design and keyboard navigation.
 *
 * Features:
 * - Responsive grid layout (7 columns for week days)
 * - Keyboard navigation support
 * - Accessible to screen readers
 * - Touch-friendly interactions
 * - Smooth animations
 */
export const CalendarGrid = memo<CalendarGridProps>(({
  currentDate,
  items,
  onDateClick,
  onItemClick,
  renderDayCell,
  selectedDate,
  className = '',
}) => {
  const { t } = useTranslation(['calendar', 'common']);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Get the calendar grid for current month
  const getCalendarGrid = useCallback(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // Get items for a specific date
  const getItemsForDate = useCallback((date: Date) => {
    return items.filter((item) => {
      if (item.allDay) {
        return isSameDay(item.startDate, date);
      }
      const itemEnd = item.endDate || item.startDate;
      const itemStart = new Date(item.startDate);
      itemStart.setHours(0, 0, 0, 0);
      const itemEndMidnight = new Date(itemEnd);
      itemEndMidnight.setHours(23, 59, 59, 999);
      const dateMidnight = new Date(date);
      dateMidnight.setHours(12, 0, 0, 0);
      return dateMidnight >= itemStart && dateMidnight <= itemEndMidnight;
    });
  }, [items]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, date: Date) => {
    const grid = getCalendarGrid();
    const currentIndex = grid.findIndex(d => isSameDay(d, date));

    if (currentIndex === -1) return;

    let newIndex = currentIndex;
    switch (e.key) {
      case 'ArrowLeft':
        newIndex = currentIndex - 1;
        e.preventDefault();
        break;
      case 'ArrowRight':
        newIndex = currentIndex + 1;
        e.preventDefault();
        break;
      case 'ArrowUp':
        newIndex = currentIndex - 7;
        e.preventDefault();
        break;
      case 'ArrowDown':
        newIndex = currentIndex + 7;
        e.preventDefault();
        break;
      case 'Home':
        newIndex = Math.floor(currentIndex / 7) * 7;
        e.preventDefault();
        break;
      case 'End':
        newIndex = Math.floor(currentIndex / 7) * 7 + 6;
        e.preventDefault();
        break;
      case 'PageUp':
        newIndex = currentIndex - 7;
        e.preventDefault();
        break;
      case 'PageDown':
        newIndex = currentIndex + 7;
        e.preventDefault();
        break;
      case 'Enter':
      case ' ':
        onDateClick?.(date);
        e.preventDefault();
        return;
      default:
        return;
    }

    // Clamp to valid range
    newIndex = Math.max(0, Math.min(newIndex, grid.length - 1));
    const newDate = grid[newIndex];
    setFocusedDate(newDate);

    // Focus the new cell
    const cellElement = gridRef.current?.querySelector(`[data-date="${newDate.toISOString()}"]`) as HTMLElement;
    cellElement?.focus();
  }, [getCalendarGrid, onDateClick]);

  // Handle day click
  const handleDayClick = useCallback((date: Date) => {
    onDateClick?.(date);
  }, [onDateClick]);

  const calendarGrid = getCalendarGrid();
  const weekDays = [
    t('calendar:grid.weekDays.sun'),
    t('calendar:grid.weekDays.mon'),
    t('calendar:grid.weekDays.tue'),
    t('calendar:grid.weekDays.wed'),
    t('calendar:grid.weekDays.thu'),
    t('calendar:grid.weekDays.fri'),
    t('calendar:grid.weekDays.sat'),
  ];

  return (
    <div
      ref={gridRef}
      className={`flex flex-col h-full bg-background ${className}`}
      role="grid"
      aria-label={t('calendar:a11y.calendarGrid', {
        month: format(currentDate, 'MMMM'),
        year: format(currentDate, 'yyyy'),
      })}
    >
      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2 px-2">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className="text-center py-2 text-xs font-black text-muted-foreground uppercase tracking-wider"
            role="columnheader"
            aria-label={t('calendar:grid.weekDaysFull', {
              sunday: 'Sunday',
              monday: 'Monday',
              tuesday: 'Tuesday',
              wednesday: 'Wednesday',
              thursday: 'Thursday',
              friday: 'Friday',
              saturday: 'Saturday',
            })[Object.keys(t('calendar:grid.weekDaysFull', {
              sunday: 'Sunday',
              monday: 'Monday',
              tuesday: 'Tuesday',
              wednesday: 'Wednesday',
              thursday: 'Thursday',
              friday: 'Friday',
              saturday: 'Saturday',
            }))[index]]}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="flex-1 grid grid-cols-7 gap-1 px-2">
        <AnimatePresence>
          {calendarGrid.map((date, index) => {
            const dayItems = getItemsForDate(date);
            const isCurrentMonth = isSameMonth(date, currentDate);
            const isTodayDate = isToday(date);
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            const isHovered = hoveredDate && isSameDay(date, hoveredDate);
            const isFocused = focusedDate && isSameDay(date, focusedDate);

            return (
              <motion.div
                key={date.toISOString()}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.01 }}
                data-date={date.toISOString()}
                onMouseEnter={() => setHoveredDate(date)}
                onMouseLeave={() => setHoveredDate(null)}
                onFocus={() => setFocusedDate(date)}
                onBlur={() => setFocusedDate(null)}
                onClick={() => handleDayClick(date)}
                onKeyDown={(e) => handleKeyDown(e, date)}
                className={`
                  relative p-2 rounded-lg border transition-all cursor-pointer outline-none
                  ${isCurrentMonth
                    ? 'bg-card border-border hover:border-primary/50'
                    : 'bg-muted/30 border-border/50 hover:border-border'
                  }
                  ${isTodayDate ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
                  ${isSelected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}
                  ${isFocused ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
                  ${isHovered ? 'shadow-md' : ''}
                `}
                style={{ minHeight: '100px' }}
                role="gridcell"
                tabIndex={isTodayDate || isSelected ? 0 : -1}
                aria-label={t('calendar:a11y.dayCell', {
                  day: format(date, 'EEEE'),
                  date: format(date, 'MMMM d, yyyy'),
                })}
                aria-selected={isSelected}
              >
                {/* Custom render function or default day cell */}
                {renderDayCell ? (
                  renderDayCell(date, dayItems, index)
                ) : (
                  <DefaultDayCell
                    date={date}
                    items={dayItems}
                    isCurrentMonth={isCurrentMonth}
                    isToday={isTodayDate}
                    isHovered={isHovered}
                    onItemClick={onItemClick}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
});

CalendarGrid.displayName = 'CalendarGrid';

// Default day cell renderer
interface DefaultDayCellProps {
  date: Date;
  items: CalendarItemType[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isHovered: boolean;
  onItemClick?: (item: CalendarItemType) => void;
}

const DefaultDayCell = memo<DefaultDayCellProps>(({
  date,
  items,
  isCurrentMonth,
  isToday,
  isHovered,
  onItemClick,
}) => {
  const { t } = useTranslation(['calendar', 'common']);

  // Limit items displayed per day
  const MAX_ITEMS_PER_DAY = 3;
  const displayItems = items.slice(0, MAX_ITEMS_PER_DAY);
  const remainingCount = Math.max(0, items.length - MAX_ITEMS_PER_DAY);

  return (
    <>
      {/* Date number */}
      <div className={`
        text-sm font-bold mb-1 flex items-center justify-between
        ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}
        ${isToday ? 'text-primary' : ''}
      `}>
        <span>{format(date, 'd')}</span>
        {isToday && (
          <span className="text-xs text-primary">{t('calendar:grid.today')}</span>
        )}
      </div>

      {/* Events */}
      <div className="space-y-1">
        {displayItems.map((item) => (
          <motion.div
            key={item.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={(e) => {
              e.stopPropagation();
              onItemClick?.(item);
            }}
            className="px-1.5 py-0.5 rounded text-xs font-medium truncate text-white shadow-sm"
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
            }}
          >
            {format(item.startDate, item.allDay ? '' : 'h:mm a')} {item.title}
          </motion.div>
        ))}

        {/* More indicator */}
        {remainingCount > 0 && (
          <div
            className="px-1.5 py-0.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Show all events for this day
            }}
          >
            {t('calendar:event.moreEvents', { count: remainingCount })}
          </div>
        )}
      </div>

      {/* Hover overlay */}
      {isHovered && items.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-primary/10 rounded-lg pointer-events-none"
        />
      )}
    </>
  );
});

DefaultDayCell.displayName = 'DefaultDayCell';
