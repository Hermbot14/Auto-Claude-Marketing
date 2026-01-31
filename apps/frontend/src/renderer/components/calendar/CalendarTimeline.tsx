import { memo, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameDay,
  isWithinInterval,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Calendar as CalendarIcon,
  Filter,
  Search,
} from 'lucide-react';
import type { CalendarItem as CalendarItemType, CalendarZoomLevel } from '../../../shared/types';
import { CALENDAR_COLORS, CALENDAR_ITEM_TYPE_LABELS } from '../../../shared/constants';
import { CalendarItem } from './CalendarItem';

interface CalendarTimelineProps {
  items: CalendarItemType[];
  currentDate: Date;
  zoomLevel: CalendarZoomLevel;
  onNavigate: (direction: 'prev' | 'next' | 'today') => void;
  onZoomChange: (level: CalendarZoomLevel) => void;
  onItemClick?: (item: CalendarItemType) => void;
  selectedItem?: CalendarItemType | null;
}

export const CalendarTimeline = memo<CalendarTimelineProps>(({
  items,
  currentDate,
  zoomLevel,
  onNavigate,
  onZoomChange,
  onItemClick,
  selectedItem,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);

  // Get date range based on zoom level
  const getDateRange = () => {
    const monthsToShow = zoomLevel === 'quarter' ? 3 : zoomLevel === 'month' ? 1 : 1;
    const startDate = startOfMonth(currentDate);
    const endDate = endOfMonth(addMonths(startDate, monthsToShow - 1));

    return { startDate, endDate };
  };

  // Get time slots based on zoom level
  const getTimeSlots = () => {
    const { startDate, endDate } = getDateRange();

    switch (zoomLevel) {
      case 'quarter':
      case 'month':
        return eachMonthOfInterval({ start: startDate, end: endDate });
      case 'week':
        return eachWeekOfInterval({ start: startDate, end: endDate });
      case 'day':
        return eachDayOfInterval({ start: startDate, end: endDate });
      default:
        return eachMonthOfInterval({ start: startDate, end: endDate });
    }
  };

  // Filter items for current view
  const getVisibleItems = () => {
    const { startDate, endDate } = getDateRange();
    return items.filter((item) => {
      const itemEnd = item.endDate || item.startDate;
      return item.startDate <= endDate && itemEnd >= startDate;
    });
  };

  // Get item position and width
  const getItemStyle = (item: CalendarItemType) => {
    const { startDate, endDate } = getDateRange();
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const itemStart = new Date(Math.max(item.startDate.getTime(), startDate.getTime()));
    const itemEnd = new Date(Math.min((item.endDate || item.startDate).getTime(), endDate.getTime()));

    const startOffset = Math.ceil((itemStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((itemEnd.getTime() - itemStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const left = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;

    return { left: `${left}%`, width: `${width}%` };
  };

  // Get lane for item (simple vertical stacking)
  const getItemLane = (item: CalendarItemType, index: number) => {
    // Simple hash-based lane assignment
    return index % 4;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight') {
        onNavigate('next');
      } else if (e.key === 't') {
        onNavigate('today');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate]);

  // Scroll to current date on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const { startDate, endDate } = getDateRange();
      const now = new Date();
      if (isWithinInterval(now, { start: startDate, end: endDate })) {
        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const currentOffset = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const scrollPercent = (currentOffset / totalDays) * 100;
        scrollContainerRef.current.scrollLeft = (scrollContainerRef.current.scrollWidth * scrollPercent) / 100 - scrollContainerRef.current.clientWidth / 2;
      }
    }
  }, [currentDate, zoomLevel]);

  // Mouse drag scrolling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart(e.clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scrollContainerRef.current) {
      const delta = e.clientX - dragStart;
      scrollContainerRef.current.scrollLeft -= delta * 1.5;
      setDragStart(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const timeSlots = getTimeSlots();
  const visibleItems = getVisibleItems();

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header with controls */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-4">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate('prev')}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate('today')}
              className="px-3 py-1.5 rounded-lg hover:bg-accent transition-colors text-sm font-medium"
            >
              Today
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate('next')}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </motion.button>
          </div>

          {/* Current date range */}
          <div className="text-lg font-semibold">
            {format(currentDate, 'MMMM yyyy')}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 border rounded-lg p-0.5">
            {(['day', 'week', 'month', 'quarter'] as CalendarZoomLevel[]).map((level) => (
              <motion.button
                key={level}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onZoomChange(level)}
                className={`
                  px-2 py-1 rounded-md text-xs font-medium capitalize transition-colors
                  ${zoomLevel === level
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                  }
                `}
              >
                {level === 'quarter' ? '3mo' : level}
              </motion.button>
            ))}
          </div>

          {/* Filter button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            aria-label="Filter"
          >
            <Filter className="h-5 w-5" />
          </motion.button>

          {/* Search button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </motion.button>
        </div>
      </div>

      {/* Timeline header */}
      <div className="flex border-b bg-muted/30">
        {/* Lane header */}
        <div className="w-48 flex-shrink-0 p-2 border-r">
          <span className="text-sm font-medium text-muted-foreground">Timeline</span>
        </div>

        {/* Time slots */}
        <div className="flex-1 overflow-hidden">
          <div className="flex">
            {timeSlots.map((slot, index) => (
              <div
                key={index}
                className="flex-1 min-w-24 p-2 text-center border-r last:border-r-0"
              >
                {zoomLevel === 'day' ? (
                  <span className="text-xs font-medium">
                    {format(slot, 'MMM d')}
                  </span>
                ) : zoomLevel === 'week' ? (
                  <span className="text-xs font-medium">
                    {format(slot, 'MMM d')}
                  </span>
                ) : (
                  <>
                    <div className="text-sm font-medium">
                      {format(slot, 'MMM')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(slot, 'yyyy')}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          scrollSnapType: 'x mandatory',
        }}
      >
        <div className="inline-flex min-w-full">
          {/* Lane labels */}
          <div className="w-48 flex-shrink-0 border-r bg-muted/10">
            <div className="grid grid-rows-4 h-full">
              {['Campaigns', 'Content', 'Social', 'Email'].map((label, i) => (
                <div key={i} className="p-2 border-b last:border-b-0 flex items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{
                        background: CALENDAR_COLORS[
                          ['campaign', 'content', 'social', 'email'][i] as keyof typeof CALENDAR_COLORS
                        ]?.gradient,
                      }}
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline grid */}
          <div className="flex-1 relative" style={{ minWidth: '1200px' }}>
            {/* Grid background */}
            <div className="absolute inset-0 grid grid-cols-12 pointer-events-none">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="border-r border-border/50" />
              ))}
            </div>

            {/* Today indicator */}
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                style={{
                  left: `${(new Date().getDate() / 30) * 100}%`,
                }}
              />
            </div>

            {/* Items */}
            <div className="relative h-full p-2 space-y-1">
              <AnimatePresence>
                {visibleItems.map((item, index) => {
                  const style = getItemStyle(item);
                  const lane = getItemLane(item, index);
                  const laneHeight = 25; // 4 lanes, 25% each
                  const laneOffset = lane * laneHeight;

                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute h-[calc(25%-4px)]"
                      style={{
                        ...style,
                        top: `${laneOffset + 0.5}%`,
                      }}
                    >
                      <CalendarItem
                        item={item}
                        startDate={item.startDate}
                        endDate={item.endDate}
                        viewMode={zoomLevel === 'day' ? 'day' : zoomLevel === 'week' ? 'week' : 'month'}
                        isSelected={selectedItem?.id === item.id}
                        onClick={() => onItemClick?.(item)}
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 p-3 border-t bg-card overflow-x-auto">
        <span className="text-sm font-medium text-muted-foreground">Legend:</span>
        {Object.entries(CALENDAR_ITEM_TYPE_LABELS).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1.5 flex-shrink-0">
            <div
              className="w-3 h-3 rounded-sm"
              style={{
                background: CALENDAR_COLORS[type as keyof typeof CALENDAR_COLORS]?.gradient,
              }}
            />
            <span className="text-xs">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

CalendarTimeline.displayName = 'CalendarTimeline';
