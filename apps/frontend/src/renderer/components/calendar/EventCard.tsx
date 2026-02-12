import { memo, useCallback } from 'react';
import { motion } from 'motion/react';
import { format, isSameDay } from 'date-fns';
import { Clock, User, Tag, MoreVertical, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CalendarItem as CalendarItemType } from '../../../shared/types';
import { CALENDAR_COLORS, CALENDAR_ITEM_TYPE_ICONS } from '../../../shared/constants';

interface EventCardProps {
  event: CalendarItemType;
  viewMode?: 'month' | 'week' | 'day';
  size?: 'compact' | 'default' | 'detailed';
  isDragging?: boolean;
  isSelected?: boolean;
  isPast?: boolean;
  onClick?: (event: CalendarItemType) => void;
  onDoubleClick?: (event: CalendarItemType) => void;
  onEdit?: (event: CalendarItemType) => void;
  onDelete?: (event: CalendarItemType) => void;
  className?: string;
}

/**
 * EventCard Component
 *
 * Displays calendar events in a compact, informative card format across all calendar views.
 *
 * Features:
 * - Color-coded by event type
 * - Responsive size variants (compact, default, detailed)
 * - Accessible to screen readers
 * - Keyboard navigation support
 * - Hover and drag states
 */
export const EventCard = memo<EventCardProps>(({
  event,
  viewMode = 'month',
  size = 'default',
  isDragging = false,
  isSelected = false,
  isPast = false,
  onClick,
  onDoubleClick,
  onEdit,
  onDelete,
  className = '',
}) => {
  const { t } = useTranslation(['calendar', 'common']);

  // Handle click event
  const handleClick = useCallback(() => {
    onClick?.(event);
  }, [event, onClick]);

  // Handle double click event
  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.(event);
  }, [event, onDoubleClick]);

  // Get event color scheme
  const colorScheme = CALENDAR_COLORS[event.type] || CALENDAR_COLORS.event;

  // Determine size classes
  const sizeClasses = {
    compact: 'h-8 px-1.5 py-0.5 text-xs',
    default: 'h-10 px-2 py-1 text-sm',
    detailed: 'h-14 px-3 py-2 text-sm',
  }[size];

  // Generate accessible label
  const ariaLabel = t('calendar:a11y.eventCard', {
    title: event.title,
    type: event.type,
    date: format(event.startDate, 'MMM d, yyyy'),
    time: event.allDay ? t('calendar:event.allDay') : format(event.startDate, 'h:mm a'),
    status: event.status,
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: isDragging ? 1.05 : 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`
        relative flex items-center gap-2 rounded-md border-l-4
        ${sizeClasses}
        ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
        ${isPast ? 'opacity-60 grayscale' : 'opacity-100'}
        ${isDragging ? 'shadow-lg rotate-2 z-50' : 'shadow-sm'}
        transition-all duration-200 cursor-pointer
        ${className}
      `}
      style={{
        background: `linear-gradient(135deg, ${colorScheme.solid}15, ${colorScheme.solid}08)`,
        borderLeftColor: colorScheme.solid,
        borderColor: isSelected ? 'hsl(var(--primary))' : 'transparent',
      }}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Drag handle (visible on hover) */}
      <motion.div
        className="absolute left-0 top-0 bottom-0 flex items-center pl-0.5 opacity-0 hover:opacity-100 group-hover:opacity-100"
        whileHover={{ scale: 1.1 }}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </motion.div>

      {/* Type icon indicator */}
      <div
        className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-white text-xs"
        style={{ background: colorScheme.gradient }}
        aria-hidden="true"
      >
        {CALENDAR_ITEM_TYPE_ICONS[event.type] === 'megaphone' && '📢'}
        {CALENDAR_ITEM_TYPE_ICONS[event.type] === 'file-text' && '📝'}
        {CALENDAR_ITEM_TYPE_ICONS[event.type] === 'share-2' && '📷'}
        {CALENDAR_ITEM_TYPE_ICONS[event.type] === 'mail' && '✉️'}
        {CALENDAR_ITEM_TYPE_ICONS[event.type] === 'search' && '🔍'}
        {CALENDAR_ITEM_TYPE_ICONS[event.type] === 'alert-circle' && '⚠️'}
        {CALENDAR_ITEM_TYPE_ICONS[event.type] === 'calendar' && '📅'}
      </div>

      {/* Event content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Title */}
        <div className="font-semibold text-foreground truncate" title={event.title}>
          {event.title}
        </div>

        {/* Time / metadata row */}
        {(size === 'default' || size === 'detailed') && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {/* Time indicator */}
            {!event.allDay && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {format(event.startDate, 'h:mm a')}
                  {event.endDate && !isSameDay(event.endDate, event.startDate) && (
                    <> - {format(event.endDate, 'h:mm a')}</>
                  )}
                </span>
              </span>
            )}

            {/* Assignee */}
            {event.assignee && size === 'detailed' && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{event.assignee}</span>
              </span>
            )}

            {/* Tags */}
            {event.tags && event.tags.length > 0 && size === 'detailed' && (
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{event.tags[0]}</span>
                {event.tags.length > 1 && (
                  <span className="text-xs">+{event.tags.length - 1}</span>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Priority indicator */}
      {event.priority === 'high' && (
        <div
          className="flex-shrink-0 w-2 h-2 rounded-full"
          style={{ backgroundColor: '#DC2626' }}
          aria-label="High priority"
        />
      )}

      {/* More actions button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="flex-shrink-0 p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="More options"
        onClick={(e) => {
          e.stopPropagation();
          // TODO: Open context menu
        }}
      >
        <MoreVertical className="h-3 w-3 text-muted-foreground" />
      </motion.button>

      {/* Selection ring overlay */}
      {isSelected && (
        <div className="absolute inset-0 rounded-md ring-2 ring-primary ring-offset-2 pointer-events-none" />
      )}
    </motion.div>
  );
});

EventCard.displayName = 'EventCard';
