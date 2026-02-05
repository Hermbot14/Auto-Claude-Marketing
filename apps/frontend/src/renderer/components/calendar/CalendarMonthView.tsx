import { memo, useRef, useEffect, useState, useCallback } from 'react';
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
  differenceInDays,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CalendarItem as CalendarItemType } from '../../../shared/types';
import { CALENDAR_COLORS, CALENDAR_ITEM_TYPE_LABELS } from '../../../shared/constants';

interface CalendarMonthViewProps {
  items: CalendarItemType[];
  currentDate: Date;
  onNavigate: (direction: 'prev' | 'next' | 'today') => void;
  onItemClick?: (item: CalendarItemType) => void;
  onDateClick?: (date: Date) => void;
  selectedItem?: CalendarItemType | null;
}

export const CalendarMonthView = memo<CalendarMonthViewProps>(({
  items,
  currentDate,
  onNavigate,
  onItemClick,
  onDateClick,
  selectedItem,
}) => {
  const { t } = useTranslation(['calendar', 'common']);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [focusedDate, setFocusedDate] = useState<Date | null>(null);

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
      return date >= item.startDate && date <= itemEnd;
    });
  }, [items]);

  // Limit items displayed per day (show N more indicator)
  const MAX_ITEMS_PER_DAY = 3;

  const calendarGrid = getCalendarGrid();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();

  // Handle day click
  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    onDateClick?.(date);
  };

  return (
    <div className="flex flex-col h-full bg-background" role="region" aria-label={t('calendar:a11y.calendarGrid', { month: format(currentDate, 'MMMM'), year: format(currentDate, 'yyyy') })}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card shadow-sm" role="banner">
        {/* Left: Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-xl font-bold text-foreground">
              {format(currentDate, 'MMMM yyyy')}
            </h1>
          </div>
          <div className="h-6 w-px bg-border" aria-hidden="true" />
          <span className="text-sm text-muted-foreground" aria-live="polite">
            ({items.length} {t('calendar:header.itemsCount', { count: items.length })})
          </span>
        </div>

        {/* Right: Navigation */}
        <div className="flex items-center gap-2" role="group" aria-label={t('calendar:a11y.navigation')}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('prev')}
            className="p-2.5 rounded-lg bg-background hover:bg-accent transition-all border-2 border-border shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={t('calendar:navigation.previousMonth')}
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('today')}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all border-2 border-primary shadow-md hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={t('calendar:navigation.goToToday')}
          >
            {t('calendar:navigation.today')}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('next')}
            className="p-2.5 rounded-lg bg-background hover:bg-accent transition-all border-2 border-border shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={t('calendar:navigation.nextMonth')}
          >
            <ChevronRight className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="h-full flex flex-col">
          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2" role="row">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center py-2 text-xs font-black text-muted-foreground uppercase tracking-wider"
                role="columnheader"
                aria-label={day}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="flex-1 grid grid-cols-7 gap-1" role="grid" aria-label={t('calendar:a11y.calendarGrid', { month: format(currentDate, 'MMMM'), year: format(currentDate, 'yyyy') })}>
            <AnimatePresence>
              {calendarGrid.map((date, index) => {
                const dayItems = getItemsForDate(date);
                const isCurrentMonth = isSameMonth(date, currentDate);
                const isTodayDate = isToday(date);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const isHovered = hoveredDate && isSameDay(date, hoveredDate);
                const isFocused = focusedDate && isSameDay(date, focusedDate);
                const displayItems = dayItems.slice(0, MAX_ITEMS_PER_DAY);
                const remainingCount = Math.max(0, dayItems.length - MAX_ITEMS_PER_DAY);

                const handleKeyDown = (e: React.KeyboardEvent) => {
                  switch (e.key) {
                    case 'ArrowLeft':
                    case 'ArrowRight':
                    case 'ArrowUp':
                    case 'ArrowDown':
                    case 'Home':
                    case 'End':
                    case 'PageUp':
                    case 'PageDown':
                      e.preventDefault();
                      break;
                    case 'Enter':
                    case ' ':
                      handleDayClick(date);
                      e.preventDefault();
                      break;
                  }
                };

                return (
                  <motion.div
                    key={date.toISOString()}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.01 }}
                    onMouseEnter={() => setHoveredDate(date)}
                    onMouseLeave={() => setHoveredDate(null)}
                    onFocus={() => setFocusedDate(date)}
                    onBlur={() => setFocusedDate(null)}
                    onClick={() => handleDayClick(date)}
                    onKeyDown={handleKeyDown}
                    className={`
                      relative p-1 rounded-lg border transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                      ${isCurrentMonth
                        ? 'bg-card border-border hover:border-primary/50'
                        : 'bg-muted/30 border-border/50 hover:border-border'
                      }
                      ${isTodayDate ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
                      ${isSelected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}
                      ${isFocused ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}
                      ${isHovered ? 'shadow-md' : ''}
                    `}
                    style={{ minHeight: '100px' }}
                    role="gridcell"
                    tabIndex={isTodayDate || isSelected ? 0 : -1}
                    aria-label={t('calendar:a11y.dayCell', { day: format(date, 'EEEE'), date: format(date, 'MMMM d, yyyy') })}
                    aria-selected={isSelected}
                    data-date={date.toISOString()}
                  >
                    {/* Date number */}
                    <div className={`
                      text-sm font-bold mb-1 flex items-center justify-between
                      ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}
                      ${isTodayDate ? 'text-primary' : ''}
                    `}>
                      <span>{format(date, 'd')}</span>
                      {isTodayDate && (
                        <span className="text-xs text-primary">Today</span>
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
                          className={`
                            px-1.5 py-0.5 rounded text-xs font-medium truncate
                            ${selectedItem?.id === item.id ? 'ring-1 ring-white' : ''}
                          `}
                          style={{
                            background: CALENDAR_COLORS[item.type].gradient,
                            color: 'white',
                          }}
                        >
                          {format(item.startDate, item.allDay ? '' : 'h:mm a')} {item.title}
                        </motion.div>
                      ))}

                      {/* More indicator */}
                      {remainingCount > 0 && (
                        <div
                          className="px-1.5 py-0.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                          tabIndex={0}
                          role="button"
                          aria-label={t('calendar:event.moreEvents', { count: remainingCount })}
                        >
                          +{remainingCount} {t('calendar:event.more').toLowerCase()}
                        </div>
                      )}
                    </div>

                    {/* Hover overlay */}
                    {isHovered && dayItems.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-primary/10 rounded-lg pointer-events-none"
                      />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-3 border-t bg-card shadow-sm overflow-x-auto">
        <span className="text-sm font-semibold text-foreground">Event Types:</span>
        {Object.entries(CALENDAR_ITEM_TYPE_LABELS).map(([type, label]) => (
          <div
            key={type}
            className="flex items-center gap-1.5 flex-shrink-0"
          >
            <div
              className="w-3.5 h-3.5 rounded-sm shadow-sm"
              style={{
                background: CALENDAR_COLORS[type as keyof typeof CALENDAR_COLORS]?.gradient,
              }}
            />
            <span className="text-xs font-medium text-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

CalendarMonthView.displayName = 'CalendarMonthView';
