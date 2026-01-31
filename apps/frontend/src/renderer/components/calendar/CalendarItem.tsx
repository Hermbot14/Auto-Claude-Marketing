import { memo } from 'react';
import { motion } from 'motion/react';
import { format, isSameDay, differenceInDays } from 'date-fns';
import { Calendar, Clock, MapPin, User, AlertCircle, Tag } from 'lucide-react';
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

  const formatTime = (date: Date) => {
    return format(date, 'h:mm a');
  };

  const formatDuration = () => {
    if (!endDate || isSameDay(startDate, endDate)) {
      return item.allDay ? 'All day' : formatTime(startDate);
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
        relative group cursor-pointer rounded-lg border transition-all
        ${isSelected ? 'ring-2 ring-offset-2 ring-offset-background' : ''}
        ${isHovered ? 'shadow-lg' : 'shadow-sm'}
      `}
      style={{
        background: colors.gradient,
        borderColor: isSelected ? colors.solid : 'transparent',
        ringColor: colors.solid,
      }}
    >
      {/* Status indicator */}
      <div className={`absolute top-0 right-0 w-2 h-2 rounded-full m-1 ${getStatusColor()}`} />

      {/* Content */}
      <div className="p-2 space-y-1">
        {/* Title row */}
        <div className="flex items-start gap-2">
          <h4 className="font-medium text-sm text-white truncate flex-1">
            {item.title}
          </h4>
          {getPriorityIndicator()}
        </div>

        {/* Details */}
        {viewMode !== 'month' && item.description && (
          <p className="text-xs text-white/80 line-clamp-2">
            {item.description}
          </p>
        )}

        {/* Meta information */}
        <div className="flex items-center gap-3 text-xs text-white/70">
          {/* Type badge */}
          <span className="px-1.5 py-0.5 rounded bg-white/20">
            {CALENDAR_ITEM_TYPE_LABELS[item.type]}
          </span>

          {/* Duration/Time */}
          <span className="flex items-center gap-1">
            {item.allDay ? (
              <Calendar className="h-3 w-3" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
            {formatDuration()}
          </span>

          {/* Location */}
          {item.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate max-w-20">{item.location}</span>
            </span>
          )}

          {/* Assignee */}
          {item.assignee && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="truncate max-w-16">{item.assignee}</span>
            </span>
          )}
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Tag className="h-3 w-3 text-white/70" />
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded bg-white/20 text-xs text-white/90"
              >
                {tag}
              </span>
            ))}
            {item.tags.length > 3 && (
              <span className="px-1.5 py-0.5 rounded bg-white/20 text-xs text-white/90">
                +{item.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Source indicator */}
        {item.source !== 'manual' && (
          <div className="absolute bottom-1 left-1">
            <span className="text-xs text-white/50 uppercase">
              {item.source}
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
