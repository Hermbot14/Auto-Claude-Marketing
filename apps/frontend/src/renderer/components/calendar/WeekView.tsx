import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, startOfWeek, isSameDay, isToday, setHours, setMinutes } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { CalendarHeader } from './CalendarHeader';
import { EventCard } from './EventCard';
import type { CalendarItem as CalendarItemType } from '../../../shared/types';

interface WeekViewProps {
  items: CalendarItemType[];
  currentDate: Date;
  onNavigate?: (direction: 'prev' | 'next' | 'today') => void;
  onViewChange?: (view: 'month' | 'week' | 'day') => void;
  onItemClick?: (item: CalendarItemType) => void;
  onCreateEvent?: () => void;
  className?: string;
}

/**
 * WeekView Component
 *
 * Displays a weekly calendar with time-based columns.
 *
 * Features:
 * - Time-based column layout (00:00 - 23:59)
 * - Events rendered at correct time positions
 * - Handles multi-day events across columns
 * - Week navigation
 * - Current time indicator
 * - Working hours highlight
 * - Responsive design
 * - Keyboard navigation
 * - Accessible to screen readers
 */
export const WeekView = memo<WeekViewProps>(({
  items,
  currentDate,
  onNavigate,
  onViewChange,
  onItemClick,
  onCreateEvent,
  className = '',
}) => {
  const { t } = useTranslation(['calendar', 'common']);
  const [selectedItem, setSelectedItem] = useState<CalendarItemType | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Get week dates (7 days starting from Sunday)
  const weekDates = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  // Generate time slots (00:00 - 23:00, hourly)
  const timeSlots = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => i);
  }, []);

  // Get items for a specific day
  const getItemsForDay = useCallback((date: Date) => {
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

  // Calculate event position and height
  const calculateEventStyle = useCallback((item: CalendarItemType) => {
    if (item.allDay) {
      return {
        top: '0px',
        height: '40px',
      };
    }

    const startHour = item.startDate.getHours() + item.startDate.getMinutes() / 60;
    const endDateTime = item.endDate || item.startDate;
    const endHour = endDateTime.getHours() + endDateTime.getMinutes() / 60;
    const duration = Math.max(1, endHour - startHour); // Minimum 1 hour

    return {
      top: `${startHour * 60}px`,
      height: `${duration * 60}px`,
    };
  }, []);

  // Handle item click
  const handleItemClick = useCallback((item: CalendarItemType) => {
    setSelectedItem(item);
    onItemClick?.(item);
  }, [onItemClick]);

  // Get current time position
  const getCurrentTimePosition = useCallback(() => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    return (hours + minutes / 60) * 60;
  }, [currentTime]);

  // Check if time is within working hours (8 AM - 6 PM)
  const isWorkingHour = (hour: number) => hour >= 8 && hour < 18;

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Header */}
      <CalendarHeader
        currentDate={currentDate}
        viewMode="week"
        eventsCount={items.length}
        onNavigate={onNavigate}
        onViewChange={onViewChange}
        onCreateEvent={onCreateEvent}
      />

      {/* Week Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Time labels column */}
        <div className="w-16 flex-shrink-0 border-r bg-card overflow-hidden">
          <div className="h-12 border-b" /> {/* Spacer for all-day row */}
          <div
            ref={scrollContainerRef}
            className="overflow-y-auto"
            style={{ height: 'calc(100% - 48px)' }}
          >
            {timeSlots.map((hour) => (
              <div
                key={hour}
                className="h-[60px] px-2 py-1 text-xs text-muted-foreground text-right border-b"
              >
                {format(setHours(new Date(), hour), 'ha')}
              </div>
            ))}
          </div>
        </div>

        {/* Day columns */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex min-w-max">
            {weekDates.map((date, dayIndex) => {
              const dayItems = getItemsForDay(date);
              const isTodayDate = isToday(date);

              return (
                <div
                  key={date.toISOString()}
                  className="flex-1 w-[140px] border-r last:border-r-0"
                >
                  {/* Day header */}
                  <div className={`
                    h-12 px-2 py-2 border-b flex flex-col items-center justify-center
                    ${isTodayDate ? 'bg-primary/10' : 'bg-card'}
                  `}>
                    <div className="text-xs font-medium text-muted-foreground uppercase">
                      {format(date, 'EEE')}
                    </div>
                    <div className={`
                      text-lg font-bold
                      ${isTodayDate ? 'text-primary' : 'text-foreground'}
                    `}>
                      {format(date, 'd')}
                    </div>
                  </div>

                  {/* Time slots */}
                  <div
                    className="relative overflow-y-auto"
                    style={{ height: 'calc(100% - 48px)' }}
                  >
                    {/* All day row */}
                    <div className="h-10 border-b bg-muted/30 relative">
                      {dayItems.filter(item => item.allDay).map((item) => (
                        <EventCard
                          key={item.id}
                          event={item}
                          viewMode="week"
                          size="compact"
                          isSelected={selectedItem?.id === item.id}
                          onClick={handleItemClick}
                          className="absolute inset-0 m-0.5 rounded shadow-sm"
                        />
                      ))}
                    </div>

                    {/* Hourly time slots */}
                    {timeSlots.map((hour) => (
                      <div
                        key={hour}
                        className={`
                          h-[60px] border-b relative
                          ${isWorkingHour(hour) ? 'bg-primary/5' : ''}
                        `}
                      >
                        {/* Half-hour line */}
                        <div className="absolute top-1/2 left-0 right-0 border-t border-border/30" />
                      </div>
                    ))}

                    {/* Events */}
                    <AnimatePresence>
                      {dayItems.filter(item => !item.allDay).map((item) => {
                        const style = calculateEventStyle(item);

                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            style={style}
                            className="absolute left-1 right-1 p-1 rounded shadow-sm border border-border/50"
                          >
                            <EventCard
                              event={item}
                              viewMode="week"
                              size="compact"
                              isSelected={selectedItem?.id === item.id}
                              onClick={handleItemClick}
                              className="h-full"
                            />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>

                    {/* Current time indicator */}
                    {isTodayDate && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute left-0 right-0 z-10 pointer-events-none"
                        style={{ top: `${getCurrentTimePosition()}px` }}
                      >
                        <div className="flex items-center">
                          <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                          <div className="flex-1 h-0.5 bg-red-500" />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

WeekView.displayName = 'WeekView';
