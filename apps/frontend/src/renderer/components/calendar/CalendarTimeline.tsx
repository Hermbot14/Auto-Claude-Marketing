import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachDayOfInterval,
  addMonths,
  isSameDay,
  isWithinInterval,
  differenceInDays,
  addDays,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Minus,
  GripVertical,
  CalendarDays,
  LayoutGrid,
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
  onItemDateChange?: (itemId: string, newStartDate: Date, newEndDate: Date) => void;
  onDateClick?: (date: Date) => void;
  selectedItem?: CalendarItemType | null;
}

interface LaneAssignment {
  lane: number;
  item: CalendarItemType;
}

// Smart lane assignment algorithm with collision detection
const assignLanes = (items: CalendarItemType[]): LaneAssignment[] => {
  if (items.length === 0) return [];

  // Sort items by start date, then by duration (longer first)
  const sortedItems = [...items].sort((a, b) => {
    const startDiff = a.startDate.getTime() - b.startDate.getTime();
    if (startDiff !== 0) return startDiff;
    // Longer items get priority
    const aDuration = (a.endDate || a.startDate).getTime() - a.startDate.getTime();
    const bDuration = (b.endDate || b.startDate).getTime() - b.startDate.getTime();
    return bDuration - aDuration;
  });

  const lanes: LaneAssignment[] = [];
  const laneEndTimes: number[] = [];

  for (const item of sortedItems) {
    const itemEnd = (item.endDate || item.startDate).getTime();
    const itemStart = item.startDate.getTime();

    // Find first available lane
    let assignedLane = -1;
    for (let i = 0; i < laneEndTimes.length; i++) {
      // Check if this lane is available (no overlap)
      if (laneEndTimes[i] < itemStart) {
        assignedLane = i;
        laneEndTimes[i] = itemEnd;
        break;
      }
    }

    // If no available lane, create a new one
    if (assignedLane === -1) {
      assignedLane = laneEndTimes.length;
      laneEndTimes.push(itemEnd);
    }

    lanes.push({ lane: assignedLane, item });
  }

  return lanes;
};

export const CalendarTimeline = memo<CalendarTimelineProps>(({
  items,
  currentDate,
  zoomLevel,
  onNavigate,
  onZoomChange,
  onItemClick,
  onItemDateChange,
  onDateClick,
  selectedItem,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [draggedItem, setDraggedItem] = useState<CalendarItemType | null>(null);
  const [dragStartDate, setDragStartDate] = useState<Date | null>(null);
  const [dragCurrentDate, setDragCurrentDate] = useState<Date | null>(null);

  // Get date range based on zoom level
  const getDateRange = useCallback(() => {
    const monthsToShow = zoomLevel === 'quarter' ? 3 : zoomLevel === 'month' ? 1 : 1;
    const startDate = startOfMonth(currentDate);
    const endDate = endOfMonth(addMonths(startDate, monthsToShow - 1));

    return { startDate, endDate };
  }, [currentDate, zoomLevel]);

  // Get time slots based on zoom level
  const getTimeSlots = useCallback(() => {
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
  }, [getDateRange, zoomLevel]);

  // Filter items for current view
  const getVisibleItems = useCallback(() => {
    const { startDate, endDate } = getDateRange();
    return items.filter((item) => {
      const itemEnd = item.endDate || item.startDate;
      return item.startDate <= endDate && itemEnd >= startDate;
    });
  }, [items, getDateRange]);

  // Get item position and width
  const getItemStyle = useCallback((item: CalendarItemType, offsetDays = 0) => {
    const { startDate, endDate } = getDateRange();
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const itemStart = new Date(Math.max(item.startDate.getTime(), startDate.getTime()));
    const itemEnd = new Date(Math.min((item.endDate || item.startDate).getTime(), endDate.getTime()));

    // Apply drag offset
    const adjustedStart = addDays(itemStart, offsetDays);
    const adjustedEnd = addDays(itemEnd, offsetDays);

    const startOffset = Math.ceil((adjustedStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((adjustedEnd.getTime() - adjustedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const left = Math.max(0, Math.min(100, (startOffset / totalDays) * 100));
    const width = Math.max(1, Math.min(100, (duration / totalDays) * 100));

    return { left: `${left}%`, width: `${width}%` };
  }, [getDateRange]);

  // Calculate drag offset in days
  const calculateDragOffset = useCallback((clientX: number) => {
    if (!draggedItem || !scrollContainerRef.current) return 0;

    const { startDate, endDate } = getDateRange();
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const containerWidth = scrollContainerRef.current.scrollWidth - 192; // Subtract lane label width
    const pixelsPerDay = containerWidth / totalDays;

    const dragDeltaPixels = clientX - dragStart;
    const dragDeltaDays = Math.round(dragDeltaPixels / pixelsPerDay);

    return dragDeltaDays;
  }, [draggedItem, dragStart, getDateRange]);

  // Get visible items with lane assignments
  const visibleItems = getVisibleItems();
  const laneAssignments = assignLanes(visibleItems);
  const maxLanes = Math.max(4, laneAssignments.length > 0 ? Math.max(...laneAssignments.map(l => l.lane)) + 1 : 4);

  // Lane labels based on actual lanes used
  const laneLabels = maxLanes <= 4
    ? ['Campaigns', 'Content', 'Social', 'Email'].slice(0, maxLanes)
    : Array.from({ length: maxLanes }, (_, i) => `Lane ${i + 1}`);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight') {
        onNavigate('next');
      } else if (e.key === 't' || e.key === 'T') {
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
  }, [currentDate, zoomLevel, getDateRange]);

  // Mouse drag scrolling for timeline
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag if clicking on empty space (not an item)
    if (e.button === 0 && (e.target as HTMLElement).closest('.calendar-item') === null) {
      setIsDragging(true);
      setDragStart(e.clientX);
    }
  };

  // Double-click handler for quick add
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!onDateClick || (e.target as HTMLElement).closest('.calendar-item')) return;

    if (scrollContainerRef.current) {
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollContainerRef.current.scrollLeft - 192; // Subtract lane label width
      const { startDate, endDate } = getDateRange();
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const containerWidth = scrollContainerRef.current.scrollWidth - 192;
      const pixelsPerDay = containerWidth / totalDays;
      const clickDayOffset = Math.floor(x / pixelsPerDay);
      const clickedDate = addDays(startDate, clickDayOffset);
      onDateClick(clickedDate);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scrollContainerRef.current) {
      const delta = e.clientX - dragStart;
      scrollContainerRef.current.scrollLeft -= delta * 1.5;
      setDragStart(e.clientX);
    }

    // Update drag preview
    if (draggedItem && onItemDateChange) {
      const offsetDays = calculateDragOffset(e.clientX);
      const newDate = addDays(dragStartDate!, offsetDays);
      setDragCurrentDate(newDate);
    }
  };

  const handleMouseUp = () => {
    if (draggedItem && dragCurrentDate && onItemDateChange) {
      const offsetDays = calculateDragOffset(dragStart); // Use the last known position
      const newStartDate = addDays(draggedItem.startDate, offsetDays);
      const newEndDate = draggedItem.endDate ? addDays(draggedItem.endDate, offsetDays) : newStartDate;

      // Only update if the date actually changed
      if (!isSameDay(newStartDate, draggedItem.startDate)) {
        onItemDateChange(draggedItem.id, newStartDate, newEndDate);
      }
    }

    setIsDragging(false);
    setDraggedItem(null);
    setDragStartDate(null);
    setDragCurrentDate(null);
  };

  // Handle item drag start
  const handleItemDragStart = (e: React.MouseEvent, item: CalendarItemType) => {
    e.stopPropagation();
    if (onItemDateChange) {
      setDraggedItem(item);
      setDragStartDate(item.startDate);
      setDragCurrentDate(item.startDate);
      setDragStart(e.clientX);
    }
  };

  const timeSlots = getTimeSlots();
  const { startDate: viewStartDate, endDate: viewEndDate } = getDateRange();
  const totalDays = Math.ceil((viewEndDate.getTime() - viewStartDate.getTime()) / (1000 * 60 * 60 * 24));

  // Calculate drag offset for preview
  const dragOffsetDays = draggedItem && dragCurrentDate
    ? differenceInDays(dragCurrentDate, draggedItem.startDate)
    : 0;

  // Get week number for display
  const getWeekNumber = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  // Get date range text for display
  const getDateRangeText = () => {
    const { startDate, endDate } = getDateRange();
    return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Main Header - TeamUp style */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card shadow-sm">
        {/* Left: Title and Date Range */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Marketing Calendar</h1>
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {getDateRangeText()}
            </span>
            <span className="text-xs text-muted-foreground">
              ({visibleItems.length} events)
            </span>
          </div>
        </div>

        {/* Center: Navigation - Enhanced with stronger visual hierarchy */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('prev')}
            className="p-2.5 rounded-lg bg-background hover:bg-accent transition-all border-2 border-border shadow-sm hover:shadow-md"
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('today')}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all border-2 border-primary shadow-md hover:shadow-lg"
          >
            Today
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('next')}
            className="p-2.5 rounded-lg bg-background hover:bg-accent transition-all border-2 border-border shadow-sm hover:shadow-md"
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </motion.button>
        </div>

        {/* Right: View toggles and Zoom */}
        <div className="flex items-center gap-3">
          {/* View toggles */}
          <div className="hidden md:flex items-center gap-1 bg-muted rounded-lg p-1">
            {(['Month', 'Week', 'Timeline'] as const).map((view) => {
              const isActive = zoomLevel === (view === 'Timeline' ? 'month' : view.toLowerCase() as CalendarZoomLevel);
              return (
                <motion.button
                  key={view}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onZoomChange(view.toLowerCase() as CalendarZoomLevel)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {view}
                </motion.button>
              );
            })}
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const levels: CalendarZoomLevel[] = ['day', 'week', 'month', 'quarter'];
                const currentIndex = levels.indexOf(zoomLevel);
                if (currentIndex < levels.length - 1) {
                  onZoomChange(levels[currentIndex + 1]);
                }
              }}
              className="p-1.5 rounded-md hover:bg-background transition-colors text-foreground"
              aria-label="Zoom out"
            >
              <Minus className="h-3.5 w-3.5" />
            </motion.button>
            <div className="w-px h-4 bg-border/50" />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const levels: CalendarZoomLevel[] = ['day', 'week', 'month', 'quarter'];
                const currentIndex = levels.indexOf(zoomLevel);
                if (currentIndex > 0) {
                  onZoomChange(levels[currentIndex - 1]);
                }
              }}
              className="p-1.5 rounded-md hover:bg-background transition-colors text-foreground"
              aria-label="Zoom in"
            >
              <Plus className="h-3.5 w-3.5" />
            </motion.button>
          </div>

          {/* Drag hint */}
          {onItemDateChange && (
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1.5 bg-muted/50 rounded-lg border border-border/50">
              <GripVertical className="h-3 w-3" />
              <span>Drag to reschedule</span>
            </div>
          )}
        </div>
      </div>

      {/* Secondary control bar - Week/Zoom info - Enhanced with stronger background */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-accent/60 border-b-2 border-border shadow-sm">
        <div className="flex items-center gap-4 text-xs">
          <span className="font-semibold text-foreground">View:</span>
          <span className="capitalize font-bold text-primary">{zoomLevel}</span>
          <div className="h-4 w-px bg-border" />
          <span className="font-semibold text-foreground">Weeks:</span>
          <span className="font-bold text-foreground">
            W{getWeekNumber(viewStartDate)} - W{getWeekNumber(viewEndDate)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <LayoutGrid className="h-3.5 w-3.5 text-foreground" />
          <span className="font-semibold text-foreground">{maxLanes} {maxLanes === 1 ? 'lane' : 'lanes'}</span>
        </div>
      </div>

      {/* Timeline Header - Date Grid - Enhanced with stronger visual weight */}
      <div className="flex border-b-2 border-border bg-card shadow-md">
        {/* Lane header */}
        <div className="w-48 flex-shrink-0 p-3 border-r-2 border-border bg-accent/60 shadow-sm">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-foreground" />
            <span className="text-sm font-black text-foreground">Timeline</span>
          </div>
        </div>

        {/* Time slots header */}
        <div className="flex-1 overflow-hidden">
          <div className="flex">
            {timeSlots.map((slot, index) => {
              const slotStart = index === 0 ? viewStartDate : slot;
              const slotEnd = index === timeSlots.length - 1 ? viewEndDate :
                zoomLevel === 'month' ? endOfMonth(slot) :
                zoomLevel === 'week' ? addDays(slot, 6) : slot;

              const isToday = isSameDay(new Date(), slot) ||
                (isWithinInterval(new Date(), { start: slotStart, end: slotEnd }));

              return (
                <div
                  key={index}
                  className={`flex-1 min-w-28 p-3 text-center border-r last:border-r-0 ${
                    isToday ? 'bg-primary/10' : ''
                  }`}
                >
                  {zoomLevel === 'month' ? (
                    <>
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <span className="text-xl font-black text-foreground tracking-tight">
                          {format(slot, 'MMM')}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {format(slot, 'yyyy')}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-primary bg-primary/20 rounded-full inline-block px-2.5 py-1 shadow-sm">
                        W{getWeekNumber(slot)}
                      </div>
                    </>
                  ) : zoomLevel === 'week' ? (
                    <>
                      <div className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">
                        {format(slot, 'EEEEEEE')}
                      </div>
                      <div className={`text-2xl font-black ${isToday ? 'text-primary' : 'text-foreground'} tracking-tight`}>
                        {format(slot, 'd')}
                      </div>
                      <div className="text-xs font-semibold text-muted-foreground">
                        {format(slot, 'MMM')}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-lg font-black text-foreground tracking-tight">
                        {format(slot, 'MMM d')}
                      </div>
                      <div className="text-xs font-semibold text-muted-foreground">
                        {format(slot, 'EEEEEEE')}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Timeline content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden bg-background"
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
          {/* Lane labels - Enhanced with clearer boundaries */}
          <div
            className="w-48 flex-shrink-0 border-r-2 border-border bg-accent/40 shadow-sm"
            style={{ height: `${maxLanes * 64}px` }}
          >
            <div className="grid h-full" style={{ gridTemplateRows: `repeat(${maxLanes}, 1fr)` }}>
              {laneLabels.map((label, i) => (
                <div
                  key={i}
                  className={`p-3 border-b border-border/60 last:border-b-0 flex items-center transition-colors ${
                    i % 2 === 0 ? 'bg-card/80' : 'bg-card/60'
                  } hover:bg-card`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-4 h-4 rounded-md shadow-md flex-shrink-0 ring-2 ring-background"
                      style={{
                        background: CALENDAR_COLORS[
                          ['campaign', 'content', 'social', 'email', 'seo', 'deadline', 'event'][i % 7] as keyof typeof CALENDAR_COLORS
                        ]?.gradient,
                      }}
                    />
                    <span className="text-sm font-black text-foreground">{label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline grid */}
          <div
            className="flex-1 relative bg-background"
            style={{ minWidth: '1400px', height: `${maxLanes * 64}px` }}
            onDoubleClick={handleDoubleClick}
          >
            {/* Grid background with alternating lane backgrounds */}
            <div className="absolute inset-0">
              {/* Alternating lane backgrounds */}
              {Array.from({ length: maxLanes }).map((_, i) => (
                <div
                  key={i}
                  className={`absolute left-0 right-0 border-b border-border/40 ${
                    i % 2 === 0 ? 'bg-accent/10' : 'bg-muted/10'
                  }`}
                  style={{
                    top: `${(i / maxLanes) * 100}%`,
                    height: `${100 / maxLanes}%`,
                  }}
                />
              ))}
              {/* Vertical grid lines */}
              <div
                className="absolute inset-0 grid"
                style={{ gridTemplateColumns: `repeat(${timeSlots.length}, 1fr)` }}
              >
                {timeSlots.map((slot, i) => {
                  const slotStart = index === 0 ? viewStartDate : slot;
                  const slotEnd = index === timeSlots.length - 1 ? viewEndDate :
                    zoomLevel === 'month' ? endOfMonth(slot) :
                    zoomLevel === 'week' ? addDays(slot, 6) : slot;

                  const isToday = isSameDay(new Date(), slot) ||
                    (isWithinInterval(new Date(), { start: slotStart, end: slotEnd }));

                  return (
                    <div
                      key={i}
                      className={`border-r border-border/60 ${i % 2 === 0 ? 'bg-accent/5' : ''} ${
                        isToday ? 'bg-primary/15' : ''
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Today indicator - more visible */}
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 shadow-lg"
                style={{
                  left: `${(differenceInDays(new Date(), viewStartDate) / totalDays) * 100}%`,
                }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full shadow-md" />
              </div>
            </div>

            {/* Items with smart lane assignment */}
            <div className="relative h-full p-2">
              <AnimatePresence>
                {laneAssignments.map(({ lane, item }) => {
                  const isDraggingItem = draggedItem?.id === item.id;
                  const offsetDays = isDraggingItem ? dragOffsetDays : 0;
                  const style = getItemStyle(item, offsetDays);
                  const laneHeight = 100 / maxLanes;
                  const laneOffset = lane * laneHeight;

                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{
                        opacity: isDraggingItem ? 0.6 : 1,
                        y: 0,
                        scale: isDraggingItem ? 1.02 : 1,
                      }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute calendar-item rounded-md shadow-sm hover:shadow-md transition-shadow"
                      style={{
                        ...style,
                        top: `${laneOffset + 1.5}%`,
                        height: `${laneHeight - 3}%`,
                        cursor: onItemDateChange ? 'grab' : 'pointer',
                        zIndex: isDraggingItem ? 100 : 1,
                      }}
                      onClick={(e) => {
                        if (!isDraggingItem) {
                          onItemClick?.(item);
                        }
                      }}
                      onMouseDown={(e) => handleItemDragStart(e, item)}
                    >
                      <div className="relative h-full p-2 overflow-hidden">
                        <CalendarItem
                          item={item}
                          startDate={offsetDays !== 0 ? addDays(item.startDate, offsetDays) : item.startDate}
                          endDate={offsetDays !== 0 && item.endDate ? addDays(item.endDate, offsetDays) : item.endDate}
                          viewMode={zoomLevel === 'day' ? 'day' : zoomLevel === 'week' ? 'week' : 'month'}
                          isSelected={selectedItem?.id === item.id}
                          onClick={() => onItemClick?.(item)}
                        />
                        {isDraggingItem && (
                          <div className="absolute inset-0 bg-primary/30 rounded-md pointer-events-none" />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Legend - improved styling */}
      <div className="flex items-center gap-4 px-4 py-3 border-t bg-card shadow-sm overflow-x-auto">
        <span className="text-sm font-semibold text-foreground flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-blue-500 to-purple-500" />
          Event Types:
        </span>
        {Object.entries(CALENDAR_ITEM_TYPE_LABELS).map(([type, label]) => (
          <div
            key={type}
            className="flex items-center gap-1.5 flex-shrink-0 px-2 py-1 rounded-md bg-muted/50 hover:bg-muted transition-colors cursor-default"
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

CalendarTimeline.displayName = 'CalendarTimeline';
