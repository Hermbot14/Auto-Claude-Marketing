import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addDays,
  addWeeks,
  addMonths,
  differenceInDays,
  startOfYear,
  endOfYear,
} from 'date-fns';
import {
  Calendar,
  Bell,
  Plus,
  X,
  Edit2,
  Trash2,
  Filter,
  Star,
  TrendingUp,
  Users,
  Globe,
  Package,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { useCalendarStore } from '../../stores/calendarStore';
import type { CalendarItem } from '../../../shared/types';

// Event reminder types
export type EventReminderType =
  | 'holiday'
  | 'conference'
  | 'launch'
  | 'competitor'
  | 'custom';

// Event reminder configuration
const EVENT_TYPE_CONFIG: Record<
  EventReminderType,
  { label: string; icon: typeof Star; color: string; gradient: string }
> = {
  holiday: {
    label: 'Holiday',
    icon: Star,
    color: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
  },
  conference: {
    label: 'Conference',
    icon: Users,
    color: '#8B5CF6',
    gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
  },
  launch: {
    label: 'Product Launch',
    icon: Package,
    color: '#10B981',
    gradient: 'linear-gradient(135deg, #10B981, #34D399)',
  },
  competitor: {
    label: 'Competitor Event',
    icon: TrendingUp,
    color: '#EF4444',
    gradient: 'linear-gradient(135deg, #EF4444, #F87171)',
  },
  custom: {
    label: 'Custom Event',
    icon: Calendar,
    color: '#6366F1',
    gradient: 'linear-gradient(135deg, #6366F1, #818CF8)',
  },
};

// Common holidays (US) - can be extended for other regions
const COMMON_HOLIDAYS = [
  { name: "New Year's Day", month: 0, day: 1, recurring: true },
  { name: "Martin Luther King Jr. Day", month: 0, day: 15, weekday: 1, recurring: true }, // 3rd Monday
  { name: "Presidents' Day", month: 1, day: 15, weekday: 1, recurring: true }, // 3rd Monday
  { name: "Memorial Day", month: 4, day: 25, weekday: 1, recurring: true }, // Last Monday
  { name: "Juneteenth", month: 5, day: 19, recurring: true },
  { name: "Independence Day", month: 6, day: 4, recurring: true },
  { name: "Labor Day", month: 8, day: 1, weekday: 1, recurring: true }, // 1st Monday
  { name: "Columbus Day", month: 9, day: 8, weekday: 1, recurring: true }, // 2nd Monday
  { name: "Veterans Day", month: 10, day: 11, recurring: true },
  { name: "Thanksgiving", month: 10, day: 22, weekday: 4, recurring: true }, // 4th Thursday
  { name: "Christmas Day", month: 11, day: 25, recurring: true },
];

// Popular marketing conferences
const MARKETING_CONFERENCES = [
  { name: 'CES', month: 0, day: 1, approximate: true },
  { name: 'SXSW', month: 2, day: 10, approximate: true },
  { name: 'MarketingProfs B2B Forum', month: 3, day: 1, approximate: true },
  { name: 'Social Media Marketing World', month: 2, day: 15, approximate: true },
  { name: 'Content Marketing World', month: 8, day: 1, approximate: true },
  { name: 'INBOUND', month: 8, day: 5, approximate: true },
  { name: 'HubSpot Annual Conference', month: 8, day: 5, approximate: true },
  { name: 'Adobe MAX', month: 9, day: 15, approximate: true },
  { name: 'Web Summit', month: 10, day: 1, approximate: true },
];

interface EventRemindersProps {
  projectId: string;
}

export function EventReminders({ projectId }: EventRemindersProps) {
  const { calendarData, addItem, updateItem, deleteItem, getFilteredItems } = useCalendarStore();

  // UI State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTypes, setSelectedTypes] = useState<EventReminderType[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Get all reminder events
  const reminderEvents = useMemo(() => {
    const userEvents = getFilteredItems().filter(
      (item) => item.type === 'event' || item.tags?.includes('reminder')
    );

    // Generate standard holidays for current year
    const year = currentDate.getFullYear();
    const standardHolidays = generateHolidays(year);

    // Generate marketing conferences
    const conferences = generateConferences(year);

    return [...userEvents, ...standardHolidays, ...conferences];
  }, [getFilteredItems, currentDate]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return reminderEvents.filter((event) => {
      // Type filter
      if (selectedTypes.length > 0) {
        const eventType = getEventType(event);
        if (!selectedTypes.includes(eventType)) {
          return false;
        }
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!event.title.toLowerCase().includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [reminderEvents, selectedTypes, searchQuery]);

  // Upcoming events (next 30 days)
  const upcomingEvents = useMemo(() => {
    const thirtyDaysLater = addDays(new Date(), 30);
    return filteredEvents
      .filter((event) => {
        const eventDate = event.startDate;
        return eventDate >= new Date() && eventDate <= thirtyDaysLater;
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .slice(0, 10);
  }, [filteredEvents]);

  // Get event type from calendar item
  function getEventType(item: CalendarItem): EventReminderType {
    const typeTag = item.tags?.find((t) =>
      ['holiday', 'conference', 'launch', 'competitor', 'custom'].includes(t.toLowerCase())
    );
    return (typeTag?.toLowerCase() as EventReminderType) || 'custom';
  }

  // Generate holidays for a given year
  function generateHolidays(year: number): CalendarItem[] {
    return COMMON_HOLIDAYS.map((holiday) => {
      const date = new Date(year, holiday.month, holiday.day);
      return {
        id: `holiday-${year}-${holiday.name.replace(/\s+/g, '-').toLowerCase()}`,
        title: holiday.name,
        type: 'event',
        status: 'published',
        source: 'manual',
        startDate: date,
        allDay: true,
        tags: ['holiday', 'reminder'],
      };
    });
  }

  // Generate conferences for a given year
  function generateConferences(year: number): CalendarItem[] {
    return MARKETING_CONFERENCES.map((conf) => {
      const date = new Date(year, conf.month, conf.day);
      return {
        id: `conference-${year}-${conf.name.replace(/\s+/g, '-').toLowerCase()}`,
        title: conf.name,
        type: 'event',
        status: 'published',
        source: 'manual',
        startDate: date,
        endDate: addDays(date, 3),
        allDay: true,
        tags: ['conference', 'reminder'],
      };
    });
  }

  // Get days until event
  function getDaysUntil(event: CalendarItem): number {
    return differenceInDays(event.startDate, new Date());
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-purple-500" />
          <h2 className="text-lg font-semibold">Marketing Event Reminders</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              className="pl-8 pr-4 py-2 rounded-lg border bg-background text-sm w-48 focus:w-64 transition-all focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Add Event */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Event
          </motion.button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">Event Types:</span>
        <div className="flex flex-wrap gap-1">
          {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => {
            const isSelected = selectedTypes.includes(key as EventReminderType);
            const Icon = config.icon;

            return (
              <motion.button
                key={key}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSelectedTypes((prev) =>
                    prev.includes(key as EventReminderType)
                      ? prev.filter((t) => t !== key)
                      : [...prev, key as EventReminderType]
                  );
                }}
                className={`
                  px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors
                  ${isSelected ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}
                `}
                style={isSelected ? { background: config.gradient } : {}}
              >
                <Icon className="h-3 w-3" />
                {config.label}
              </motion.button>
            );
          })}
        </div>

        {selectedTypes.length > 0 && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedTypes([])}
            className="px-2 py-1 rounded bg-muted text-xs font-medium ml-auto"
          >
            Clear Filters
          </motion.button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Upcoming Events Section */}
        <div className="p-4 border-b">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Upcoming Events (Next 30 Days)
          </h3>

          {upcomingEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No upcoming events in the next 30 days
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcomingEvents.map((event) => {
                const eventType = getEventType(event);
                const config = EVENT_TYPE_CONFIG[eventType];
                const Icon = config.icon;
                const daysUntil = getDaysUntil(event);

                return (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => {
                      setEditingEvent(event);
                      setShowAddModal(true);
                    }}
                    className="p-3 rounded-lg border bg-card cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{ background: config.gradient }}
                      >
                        <Icon className="h-4 w-4 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {event.title}
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{format(event.startDate, 'MMM d')}</span>
                          {daysUntil === 0 ? (
                            <span className="text-amber-600 font-medium">Today!</span>
                          ) : daysUntil === 1 ? (
                            <span className="text-amber-600 font-medium">Tomorrow</span>
                          ) : daysUntil <= 7 ? (
                            <span className="text-amber-600 font-medium">{daysUntil} days</span>
                          ) : (
                            <span>{daysUntil} days</span>
                          )}
                        </div>

                        {event.description && (
                          <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {event.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* All Events by Month */}
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-3">All Events</h3>

          <div className="space-y-6">
            {(() => {
              // Group events by month
              const eventsByMonth: Record<string, CalendarItem[]> = {};
              filteredEvents.forEach((event) => {
                const monthKey = format(event.startDate, 'MMMM yyyy');
                if (!eventsByMonth[monthKey]) {
                  eventsByMonth[monthKey] = [];
                }
                eventsByMonth[monthKey].push(event);
              });

              return Object.entries(eventsByMonth)
                .sort((a, b) => {
                  const dateA = new Date(a[0]);
                  const dateB = new Date(b[0]);
                  return dateA.getTime() - dateB.getTime();
                })
                .slice(0, 6) // Show next 6 months
                .map(([monthKey, events]) => (
                  <div key={monthKey}>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                      {monthKey}
                    </h4>
                    <div className="space-y-2">
                      {events.map((event) => {
                        const eventType = getEventType(event);
                        const config = EVENT_TYPE_CONFIG[eventType];
                        const Icon = config.icon;

                        return (
                          <motion.div
                            key={event.id}
                            layout
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            whileHover={{ x: 2 }}
                            onClick={() => {
                              setEditingEvent(event);
                              setShowAddModal(true);
                            }}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                          >
                            <div
                              className="p-1.5 rounded"
                              style={{ background: config.gradient }}
                            >
                              <Icon className="h-3 w-3 text-white" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">
                                  {event.title}
                                </span>
                                {event.source === 'manual' && (
                                  <span className="text-xs text-muted-foreground">
                                    (Custom)
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(event.startDate, 'MMM d, yyyy')}
                                {event.endDate &&
                                  ` - ${format(event.endDate, 'MMM d, yyyy')}`}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingEvent(event);
                                  setShowAddModal(true);
                                }}
                                className="p-1 rounded hover:bg-accent"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Delete this event?')) {
                                    deleteItem(event.id);
                                  }
                                }}
                                className="p-1 rounded hover:bg-destructive hover:text-destructive-foreground"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ));
            })()}
          </div>
        </div>
      </div>

      {/* Add/Edit Event Modal */}
      <AnimatePresence>
        {showAddModal && (
          <EventReminderModal
            event={editingEvent}
            onClose={() => {
              setShowAddModal(false);
              setEditingEvent(null);
            }}
            onSave={(eventData) => {
              if (editingEvent) {
                updateItem(editingEvent.id, eventData);
              } else {
                addItem(eventData);
              }
              setShowAddModal(false);
              setEditingEvent(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Event Reminder Modal
function EventReminderModal({
  event,
  onClose,
  onSave,
}: {
  event: CalendarItem | null;
  onClose: () => void;
  onSave: (eventData: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [eventType, setEventType] = useState<EventReminderType>(
    event?.tags?.find((t) =>
      ['holiday', 'conference', 'launch', 'competitor', 'custom'].includes(t.toLowerCase())
    )?.toLowerCase() as EventReminderType || 'custom'
  );
  const [startDate, setStartDate] = useState(
    event?.startDate ? format(event.startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(
    event?.endDate ? format(event.endDate, 'yyyy-MM-dd') : ''
  );
  const [reminderDays, setReminderDays] = useState<number>(7);

  const handleSave = () => {
    if (!title.trim()) return;

    const eventData: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'> = {
      title: title.trim(),
      description: description.trim() || undefined,
      type: 'event',
      status: 'published',
      source: 'manual',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      allDay: true,
      tags: [eventType, 'reminder'],
      notes: reminderDays ? `Remind ${reminderDays} days before` : undefined,
    };

    onSave(eventData);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-lg shadow-xl max-w-md w-full p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {event ? 'Edit Event Reminder' : 'Add Event Reminder'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1 block">Event Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter event title..."
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Event Type */}
          <div>
            <label className="text-sm font-medium mb-1 block">Event Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventReminderType)}
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="text-sm font-medium mb-1 block">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* End Date (optional) */}
          <div>
            <label className="text-sm font-medium mb-1 block">End Date (optional)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Reminder */}
          <div>
            <label className="text-sm font-medium mb-1 block">Reminder Before (days)</label>
            <input
              type="number"
              value={reminderDays}
              onChange={(e) => setReminderDays(parseInt(e.target.value) || 0)}
              min={0}
              max={365}
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1 block">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add event description..."
              className="w-full min-h-20 px-3 py-2 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
            >
              {event ? 'Save Changes' : 'Add Event'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-muted font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
