import { memo } from 'react';
import { motion } from 'motion/react';
import { format, isSameDay, differenceInDays } from 'date-fns';
import { Calendar, Clock, MapPin, User, AlertCircle, Tag, Repeat } from 'lucide-react';
import type { CalendarItem as CalendarItemType } from '../../../shared/types';
import { CALENDAR_COLORS, CALENDAR_ITEM_TYPE_LABELS } from '../../../shared/constants';

interface CalendarItemProps {
  item: CalendarItemType;
  isSelected?: boolean;
  isHovered?: boolean;
  onClick?: () => void;
  onHover?: () => void;
  onHoverEnd?: () => void;
  startDate: Date;
  endDate?: Date;
  viewMode: 'day' | 'week' | 'month';
}

export const CalendarItem = memo<CalendarItemProps>(({
  item,
  isSelected = false,
  isHovered = false,
  onClick,
  onHover,
  onHoverEnd,
  startDate,
  endDate,
  viewMode,
}) => {
  const colors = CALENDAR_COLORS[item.type];
  const duration = endDate ? differenceInDays(endDate, startDate) + 1 : 1;

  const getStatusColor = () => {
    switch (item.status) {
      case 'published':
        return 'bg-emerald-500/20';
      case 'scheduled':
        return 'bg-blue-500/20';
      case 'draft':
        return 'bg-gray-500/20';
      case 'cancelled':
        return 'bg-red-500/20 line-through';
      default:
        return 'bg-gray-500/20';
    }
  };

  const getPriorityIndicator = () => {
    if (item.priority === 'high') {
      return <AlertCircle className="h-3 w-3 text-red-500 ml-auto" />;
    }
    return null;
  };

  const getRecurrenceIndicator = () => {
    if (item.recurrence) {
      return <Repeat className="h-3 w-3 text-white/80 ml-auto" />;
    }
    return null;
  };

  const formatTime = (date: Date) => {
    return format(date, 'h:mm a');
  };

  const formatTimeShort = (date: Date) => {
    return format(date, 'ha').toLowerCase();
  };

  const formatDuration = () => {
    if (!endDate || isSameDay(startDate, endDate)) {
      return item.allDay ? 'All Day' : formatTimeShort(startDate);
    }
    if (duration <= 7) {
      return `${duration}d`;
    }
    return `${Math.ceil(duration / 7)}w`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
      className={`
        relative group cursor-pointer rounded-lg border-2 transition-all shadow-md
        ${isSelected ? 'ring-2 ring-offset-2 ring-offset-background' : ''}
        ${isHovered ? 'shadow-xl' : ''}
      `}
      style={{
        background: colors.gradient,
        borderColor: isSelected ? colors.solid : 'rgba(255,255,255,0.3)',
        ringColor: colors.solid,
      }}
    >
      {/* Status indicator */}
      <div className={`absolute top-0 right-0 w-2.5 h-2.5 rounded-full m-1 ring-2 ring-white/30 ${getStatusColor()}`} />

      {/* Content - TeamUp style layout */}
      <div className="h-full flex flex-col justify-between p-2.5">
        {/* Top: Time indicator */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-black text-white tracking-wide drop-shadow-sm">
            {formatDuration()}
          </span>
          <div className="flex items-center gap-1">
            {getRecurrenceIndicator()}
            {getPriorityIndicator()}
          </div>
        </div>

        {/* Center: Title (main focus) */}
        <div className="flex-1 flex items-center min-h-0">
          <h4 className="font-bold text-sm text-white truncate leading-tight drop-shadow-sm">
            {item.title}
          </h4>
        </div>

        {/* Bottom: Type badge and additional info */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="px-2 py-0.5 rounded-md bg-white/25 text-xs font-bold text-white shadow-sm capitalize">
            {item.type}
          </span>

          {/* Location or assignee */}
          {item.location && viewMode !== 'month' && (
            <span className="flex items-center gap-1 text-xs text-white/70 truncate max-w-20">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{item.location}</span>
            </span>
          )}
          {item.assignee && !item.location && viewMode !== 'month' && (
            <span className="flex items-center gap-1 text-xs text-white/70 truncate max-w-16">
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{item.assignee}</span>
            </span>
          )}
        </div>

        {/* Source indicator */}
        {item.source !== 'manual' && (
          <div className="absolute top-2 right-2">
            <span className="text-[10px] text-white/50 uppercase font-medium tracking-wider">
              {item.source === 'roadmap' ? 'RD' : item.source.slice(0, 2)}
            </span>
          </div>
        )}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none" />
    </motion.div>
  );
});

CalendarItem.displayName = 'CalendarItem';
