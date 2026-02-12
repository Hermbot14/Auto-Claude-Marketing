import { memo, useMemo, useCallback, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isSameDay, isPast, isToday, addDays } from 'date-fns';
import { Clock, User, Tag, MoreVertical, Calendar, Filter, SortAsc, SortDesc, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CalendarItem as CalendarItemType } from '../../../shared/types';
import { CALENDAR_COLORS } from '../../../shared/constants';
import { VirtualizedList, VirtualizedGrid } from '../VirtualizedList';
import { EventCard } from './EventCard';

interface VirtualizedEventListProps {
  events: CalendarItemType[];
  currentDate: Date;
  onEventClick?: (event: CalendarItemType) => void;
  onEventDoubleClick?: (event: CalendarItemType) => void;
  onEventEdit?: (event: CalendarItemType) => void;
  onEventDelete?: (eventId: string) => void;
  selectedEventId?: string | null;
  className?: string;
  loading?: boolean;
  error?: string | null;
}

type ViewMode = 'list' | 'grid';
type SortField = 'startDate' | 'title' | 'type' | 'status' | 'priority';
type SortOrder = 'asc' | 'desc';
type GroupBy = 'none' | 'date' | 'type' | 'status';

/**
 * VirtualizedEventList Component
 *
 * A high-performance virtual scrolling list for displaying large numbers of calendar events.
 * Uses TanStack Virtual for smooth scrolling with 10,000+ events.
 *
 * Features:
 * - Virtual scrolling for constant memory usage
 * - List and grid view modes
 * - Grouping by date, type, or status
 * - Sorting by multiple fields
 * - Filtering by type and status
 * - Keyboard navigation
 * - Screen reader accessibility
 * - Responsive design
 */
export const VirtualizedEventList = memo<VirtualizedEventListProps>(({
  events,
  currentDate,
  onEventClick,
  onEventDoubleClick,
  onEventEdit,
  onEventDelete,
  selectedEventId,
  className = '',
  loading = false,
  error = null,
}) => {
  const { t } = useTranslation(['calendar', 'common']);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortField, setSortField] = useState<SortField>('startDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [groupBy, setGroupBy] = useState<GroupBy>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Memoize filtered and sorted events
  const { filteredEvents, groups } = useMemo(() => {
    let result = [...events];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.description?.toLowerCase().includes(query) ||
          e.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      result = result.filter((e) => e.type === typeFilter);
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((e) => e.status === statusFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'startDate':
          aVal = a.startDate.getTime();
          bVal = b.startDate.getTime();
          break;
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'type':
          aVal = a.type;
          bVal = b.type;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'priority':
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          aVal = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1;
          bVal = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Create groups if needed
    let grouped: { title: string; events: CalendarItemType[] }[] = [];

    if (groupBy === 'none') {
      grouped = [{ title: 'All Events', events: result }];
    } else if (groupBy === 'date') {
      // Group by date
      const dateMap = new Map<string, CalendarItemType[]>();
      result.forEach((event) => {
        const dateKey = format(event.startDate, 'yyyy-MM-dd');
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, []);
        }
        dateMap.get(dateKey)!.push(event);
      });

      grouped = Array.from(dateMap.entries())
        .map(([dateKey, dateEvents]) => ({
          title: format(new Date(dateKey), 'EEEE, MMMM d, yyyy'),
          events: dateEvents,
        }))
        .sort((a, b) => {
          // Sort groups by date
          const dateA = new Date(a.title);
          const dateB = new Date(b.title);
          return dateA.getTime() - dateB.getTime();
        });
    } else if (groupBy === 'type') {
      // Group by type
      const typeMap = new Map<string, CalendarItemType[]>();
      result.forEach((event) => {
        if (!typeMap.has(event.type)) {
          typeMap.set(event.type, []);
        }
        typeMap.get(event.type)!.push(event);
      });

      grouped = Array.from(typeMap.entries()).map(([type, typeEvents]) => ({
        title: type.charAt(0).toUpperCase() + type.slice(1) + ' Events',
        events: typeEvents,
      }));
    } else if (groupBy === 'status') {
      // Group by status
      const statusMap = new Map<string, CalendarItemType[]>();
      result.forEach((event) => {
        if (!statusMap.has(event.status)) {
          statusMap.set(event.status, []);
        }
        statusMap.get(event.status)!.push(event);
      });

      grouped = Array.from(statusMap.entries()).map(([status, statusEvents]) => ({
        title: status.charAt(0).toUpperCase() + status.slice(1),
        events: statusEvents,
      }));
    }

    return { filteredEvents: result, groups: grouped };
  }, [events, searchQuery, typeFilter, statusFilter, sortField, sortOrder, groupBy]);

  // Handle sort change
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField, sortOrder]);

  // Handle event selection
  const handleSelectEvent = useCallback((eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelection = new Set(selectedEvents);
    if (newSelection.has(eventId)) {
      newSelection.delete(eventId);
    } else {
      newSelection.add(eventId);
    }
    setSelectedEvents(newSelection);
  }, [selectedEvents]);

  // Calculate flat list for virtualization with group headers
  const flatListItems = useMemo(() => {
    const items: { type: 'header' | 'event'; data: CalendarItemType | string; groupIndex?: number }[] = [];

    groups.forEach((group, groupIdx) => {
      items.push({ type: 'header', data: group.title, groupIndex: groupIdx });
      group.events.forEach((event) => {
        items.push({ type: 'event', data: event, groupIndex: groupIdx });
      });
    });

    return items;
  }, [groups]);

  // Get estimated height for list items
  const getEstimateSize = useCallback((item: typeof flatListItems[0]) => {
    if (item.type === 'header') return 40;
    return 72; // Event card height
  }, []);

  // Render event list item
  const renderEventItem = useCallback((item: CalendarItemType, index: number) => {
    const isSelected = selectedEvents.has(item.id);
    const isPastEvent = isPast(item.startDate) && !isToday(item.startDate);
    const isEventSelected = selectedEventId === item.id;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        whileHover={{ x: 4 }}
        onClick={() => onEventClick?.(item)}
        onDoubleClick={() => onEventDoubleClick?.(item)}
        className={`
          relative flex items-center gap-3 p-3 border-b cursor-pointer transition-all
          ${isEventSelected ? 'bg-primary/10 border-primary' : 'hover:bg-accent/50'}
          ${isPastEvent ? 'opacity-60' : 'opacity-100'}
        `}
        role="listitem"
        tabIndex={0}
        aria-label={`${item.title} - ${format(item.startDate, 'MMM d, yyyy')}`}
        aria-selected={isEventSelected}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onEventClick?.(item);
          }
        }}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => handleSelectEvent(item.id, e)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 flex-shrink-0"
          aria-label={`Select ${item.title}`}
        />

        {/* Date column */}
        <div className="w-16 flex-shrink-0 text-center">
          <div className={`text-2xl font-bold ${isToday(item.startDate) ? 'text-primary' : ''}`}>
            {format(item.startDate, 'd')}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(item.startDate, 'MMM')}
          </div>
        </div>

        {/* Color indicator */}
        <div
          className="w-1 h-12 rounded-full flex-shrink-0"
          style={{ background: CALENDAR_COLORS[item.type]?.solid || '#888' }}
        />

        {/* Event info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm truncate">{item.title}</h4>
            {item.priority === 'high' && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-600 font-medium">
                High
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            {!item.allDay && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(item.startDate, 'h:mm a')}
              </span>
            )}
            {item.assignee && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {item.assignee}
              </span>
            )}
            {item.type && (
              <span className="capitalize">{item.type}</span>
            )}
          </div>
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
            {item.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Status */}
        <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
          item.status === 'published' ? 'bg-green-500/20 text-green-600' :
          item.status === 'scheduled' ? 'bg-blue-500/20 text-blue-600' :
          item.status === 'draft' ? 'bg-gray-500/20 text-gray-600' :
          'bg-yellow-500/20 text-yellow-600'
        }`}>
          {item.status}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEventEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEventEdit(item);
              }}
              className="p-1.5 rounded hover:bg-accent transition-colors"
              aria-label={`Edit ${item.title}`}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>
    );
  }, [selectedEvents, selectedEventId, onEventClick, onEventDoubleClick, onEventEdit, handleSelectEvent]);

  // Render event card for grid view
  const renderEventCard = useCallback((event: CalendarItemType) => {
    const isSelected = selectedEvents.has(event.id);
    const isEventSelected = selectedEventId === event.id;
    const isPastEvent = isPast(event.startDate) && !isToday(event.startDate);

    return (
      <EventCard
        key={event.id}
        event={event}
        viewMode="month"
        size="detailed"
        isPast={isPastEvent}
        isSelected={isEventSelected}
        onClick={() => onEventClick?.(event)}
        onDoubleClick={() => onEventDoubleClick?.(event)}
        onEdit={onEventEdit}
        onDelete={onEventDelete}
        className={`${isPastEvent ? 'opacity-60' : ''}`}
      />
    );
  }, [selectedEvents, selectedEventId, onEventClick, onEventDoubleClick, onEventEdit, onEventDelete]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">{t('common:loading')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <Filter className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Error Loading Events</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (filteredEvents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">No Events Found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your filters or search query'
                : 'No events scheduled for this period'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-card flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              className="w-full px-4 py-2 pl-10 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Search events"
            />
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>

          {/* Filters */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            aria-label="Filter by event type"
          >
            <option value="all">All Types</option>
            <option value="campaign">Campaign</option>
            <option value="content">Content</option>
            <option value="social">Social</option>
            <option value="email">Email</option>
            <option value="seo">SEO</option>
            <option value="event">Event</option>
            <option value="deadline">Deadline</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="draft">Draft</option>
          </select>

          {/* Group by */}
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            aria-label="Group events by"
          >
            <option value="date">Group by Date</option>
            <option value="type">Group by Type</option>
            <option value="status">Group by Status</option>
            <option value="none">No Grouping</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort buttons */}
          <button
            onClick={() => handleSort('startDate')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
              sortField === 'startDate' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
            }`}
            aria-label="Sort by date"
          >
            Date
            {sortField === 'startDate' && (
              sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => handleSort('title')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
              sortField === 'title' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
            }`}
            aria-label="Sort by title"
          >
            Title
            {sortField === 'title' && (
              sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
            )}
          </button>

          {/* View mode toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list' ? 'bg-accent' : 'hover:bg-accent'
            }`}
            aria-label={`Switch to ${viewMode === 'list' ? 'grid' : 'list'} view`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Selection info */}
      {selectedEvents.size > 0 && (
        <div className="px-4 py-2 bg-primary/10 border-b text-sm flex items-center justify-between">
          <span className="font-medium">{selectedEvents.size} events selected</span>
          <button
            onClick={() => setSelectedEvents(new Set())}
            className="text-sm text-primary hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Events list/grid */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'list' ? (
          <VirtualizedList
            items={filteredEvents}
            getKey={(event) => event.id}
            renderItem={(event) => renderEventItem(event, 0)}
            estimateSize={() => 72}
            overscan={10}
            ariaLabel="Calendar events list"
            ariaDescription={`Showing ${filteredEvents.length} of ${events.length} events`}
          />
        ) : (
          <VirtualizedGrid
            items={filteredEvents}
            getKey={(event) => event.id}
            renderItem={(event) => renderEventCard(event)}
            columns={3}
            estimateRowHeight={() => 150}
            overscan={2}
            gap={16}
            ariaLabel="Calendar events grid"
          />
        )}
      </div>

      {/* Footer stats */}
      <div className="px-4 py-2 border-t bg-card text-sm text-muted-foreground flex items-center justify-between">
        <span>Showing {filteredEvents.length} of {events.length} events</span>
        <span>Current date: {format(currentDate, 'MMMM d, yyyy')}</span>
      </div>
    </div>
  );
});

VirtualizedEventList.displayName = 'VirtualizedEventList';
