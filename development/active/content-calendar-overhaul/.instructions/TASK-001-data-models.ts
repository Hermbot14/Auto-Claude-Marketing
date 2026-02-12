/**
 * TASK-001: Content Calendar Data Models
 *
 * This file defines the unified data models for the Content Calendar overhaul.
 * These types combine the best features from both the legacy CalendarItem and
 * the ContentCampaign types, while addressing all identified issues.
 *
 * @fileoverview Unified calendar event data models and types
 * @author AI Agent (Claude)
 * @created 2026-02-05
 */

// ============================================================================
// CORE EVENT TYPES
// ============================================================================

/**
 * Unified Calendar Event
 *
 * This is the primary data structure for all calendar events. It combines:
 * - Date range support from CalendarItem (startDate/endDate)
 * - Content type support from ContentCampaign
 * - Recurrence support from CalendarItem
 * - Rich relationship linking from CalendarItem
 * - Assignee fields from CalendarItem
 *
 * All date fields are Date objects (not strings) for type safety.
 * All optional fields are explicitly marked with `?`.
 */
export interface CalendarEvent {
  // ============================================
  // IDENTITY
  // ============================================

  /**
   * Unique identifier for the event
   * Format: `evt-{timestamp}-{random}`
   * Example: "evt-1701234567890-abc123def"
   */
  id: string;

  /**
   * Type of event - determines color coding and available fields
   */
  type: CalendarEventType;

  /**
   * Current workflow status
   */
  status: CalendarEventStatus;

  // ============================================
  // CORE CONTENT
  // ============================================

  /**
   * Event title (required)
   * Max length: 200 characters
   */
  title: string;

  /**
   * Optional description
   * Supports markdown formatting
   * Max length: 5000 characters
   */
  description?: string;

  // ============================================
  // DATE/TIME (unified pattern)
  // ============================================

  /**
   * Event start date/time
   * Required for all events
   */
  startDate: Date;

  /**
   * Event end date/time
   * Optional - if not provided, event is considered instantaneous
   * Must be after startDate if provided
   */
  endDate?: Date;

  /**
   * Whether this is an all-day event (no time component)
   * If true, startDate and endDate should be dates at midnight
   */
  allDay: boolean;

  // ============================================
  // CATEGORIZATION
  // ============================================

  /**
   * User-defined tags for filtering and organization
   * Max 50 tags, max 30 characters each
   */
  tags: string[];

  /**
   * Custom category for grouping
   * Allows user-defined categorization beyond event types
   * Max 50 characters
   */
  category?: string;

  /**
   * Priority level for sorting and filtering
   */
  priority: CalendarEventPriority;

  // ============================================
  // RELATIONSHIPS
  // ============================================

  /**
   * Link to roadmap feature (if imported from roadmap)
   */
  linkedFeatureId?: string;

  /**
   * Link to task/spec (if imported from tasks)
   */
  linkedTaskId?: string;

  /**
   * Link to project file (if scanned from files)
   */
  linkedFileId?: string;

  /**
   * Link to external calendar event (if synced)
   */
  externalEventId?: string;

  // ============================================
  // ASSIGNMENT (for collaboration)
  // ============================================

  /**
   * ID of the user/team assigned to this event
   */
  assigneeId?: string;

  /**
   * Display name of assignee (for UI display)
   * Max 100 characters
   */
  assigneeName?: string;

  // ============================================
  // LOCATION AND NOTES
  // ============================================

  /**
   * Physical or virtual location
   * Max 200 characters
   */
  location?: string;

  /**
   * Additional notes or comments
   * Supports markdown
   * Max 5000 characters
   */
  notes?: string;

  // ============================================
  // CONTENT-SPECIFIC FIELDS (conditional)
  // ============================================

  /**
   * Content type (for content/social events)
   * Only applies when type is 'content' or 'social'
   */
  contentType?: ContentType;

  /**
   * Social media platforms (for social events)
   * Only applies when type is 'social'
   * Examples: ['twitter', 'linkedin', 'instagram']
   */
  platforms?: string[];

  /**
   * Estimated work hours
   * For planning and resource allocation
   */
  estimatedHours?: number;

  // ============================================
  // RECURRENCE
  // ============================================

  /**
   * Recurrence rule for repeating events
   * If present, this event represents a series
   */
  recurrence?: RecurrenceRule;

  // ============================================
  // EXTERNAL INTEGRATION
  // ============================================

  /**
   * Where this event originated
   */
  source: EventSource;

  /**
   * ID of external calendar (if from external source)
   */
  externalCalendarId?: string;

  // ============================================
  // TIMESTAMPS
  // ============================================

  /**
   * When this event was created
   */
  createdAt: Date;

  /**
   * When this event was last updated
   */
  updatedAt: Date;

  /**
   * ID of user who created this event
   */
  createdById?: string;
}

/**
 * Event type determines color coding and available fields
 */
export type CalendarEventType =
  | 'campaign'      // Marketing campaigns (purple)
  | 'content'       // Content pieces (blog, video) (blue)
  | 'social'        // Social media posts (pink)
  | 'email'         // Email marketing (green)
  | 'seo'           // SEO tasks (orange)
  | 'deadline'      // Important deadlines (red)
  | 'event'         // External events (indigo)
  | 'milestone';    // Project milestones (teal)

/**
 * Event workflow status
 */
export type CalendarEventStatus =
  | 'draft'         // Not yet scheduled
  | 'scheduled'     // Planned, not started
  | 'in-progress'   // Currently being worked on
  | 'under-review'  // Awaiting approval
  | 'published'     // Completed/published
  | 'cancelled';    // Cancelled

/**
 * Priority levels
 */
export type CalendarEventPriority =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'none';

/**
 * Where the event originated
 */
export type EventSource =
  | 'manual'        // Created by user
  | 'roadmap'       // Imported from roadmap
  | 'file'          // Scanned from project files
  | 'external'      // External calendar sync
  | 'automation';   // Created by automation rules

/**
 * Content types (for content/social events)
 */
export type ContentType =
  | 'blog'
  | 'social'
  | 'email'
  | 'ad'
  | 'video'
  | 'podcast'
  | 'infographic'
  | 'other';

// ============================================================================
// RECURRENCE TYPES
// ============================================================================

/**
 * Recurrence rule (similar to iCalendar RRULE)
 *
 * Defines how a repeating event should be generated.
 * Uses a simplified version of the iCalendar RRULE format.
 *
 * @example
 * // Daily for 30 days
 * { frequency: 'daily', interval: 1, count: 30 }
 *
 * // Weekly on Mon, Wed, Fri indefinitely
 * { frequency: 'weekly', interval: 1, byDay: [1, 3, 5] }
 *
 * // Monthly on the 15th until end of year
 * { frequency: 'monthly', interval: 1, byMonthDay: [15], until: new Date('2025-12-31') }
 */
export interface RecurrenceRule {
  /**
   * How often the event repeats
   */
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';

  /**
   * Interval between occurrences
   * - 1 = every day/week/month/year
   * - 2 = every 2 days/weeks/months/years
   */
  interval: number;

  /**
   * When the recurrence ends (date)
   * Mutually exclusive with `count`
   */
  until?: Date;

  /**
   * How many occurrences total
   * Mutually exclusive with `until`
   */
  count?: number;

  /**
   * Days of week (0 = Sunday, 6 = Saturday)
   * Only valid for weekly frequency
   * Example: [0, 2, 4] = Sunday, Tuesday, Thursday
   */
  byDay?: number[];

  /**
   * Days of month (1-31)
   * Only valid for monthly frequency
   * Example: [1, 15, 31] = 1st, 15th, and last day
   */
  byMonthDay?: number[];

  /**
   * Months (0 = January, 11 = December)
   * Only valid for yearly frequency
   * Example: [0, 6, 11] = January, July, December
   */
  byMonth?: number[];
}

// ============================================================================
// VIEW TYPES
// ============================================================================

/**
 * Available calendar views
 */
export type CalendarViewMode =
  | 'month'        // Traditional month grid (7 columns x 5-6 rows)
  | 'week'         // Week columns with time slots
  | 'day'          // Single day with hourly slots
  | 'list'         // Sortable list/table view
  | 'timeline'     // Horizontal Gantt-style timeline
  | 'agenda';      // Upcoming events list (chronological)

/**
 * Zoom levels for timeline view
 */
export type TimelineZoomLevel =
  | 'day'          // Show individual days
  | 'week'         // Show weeks
  | 'month'        // Show months
  | 'quarter';     // Show quarters (3 months)

/**
 * View configuration
 *
 * Defines how the calendar should be displayed and behave.
 * This is separate from the event data and can be customized per user.
 */
export interface CalendarViewConfig {
  /**
   * Current view mode
   */
  mode: CalendarViewMode;

  /**
   * The date currently being viewed
   * - Month view: determines which month to show
   * - Week view: determines which week to show
   * - Day view: determines which day to show
   */
  currentDate: Date;

  /**
   * Zoom level for timeline view
   * Only applicable when mode is 'timeline'
   */
  zoomLevel?: TimelineZoomLevel;

  /**
   * First day of week (0 = Sunday, 1 = Monday, 6 = Saturday)
   * Defaults to locale-appropriate value
   */
  firstDayOfWeek?: 0 | 1 | 6;

  /**
   * Working hours for time-based views
   * Used to highlight working hours in day/week views
   */
  workingHours?: {
    /**
     * Start of work day (0-23)
     * Example: 9 = 9 AM
     */
    start: number;

    /**
     * End of work day (0-23)
     * Example: 17 = 5 PM
     */
    end: number;
  };

  /**
   * Hidden days of week (0 = Sunday, 6 = Saturday)
   * Useful for hiding weekends in business calendars
   */
  hiddenDays?: number[];

  /**
   * Time slot duration in minutes
   * Options: 15, 30, 60
   * Default: 30
   */
  timeSlotDuration?: 15 | 30 | 60;

  /**
   * Whether to show weekends
   * If false, weekends are hidden or de-emphasized
   */
  showWeekends?: boolean;
}

// ============================================================================
// FILTER AND SORT TYPES
// ============================================================================

/**
 * Calendar filters
 *
 * Defines which events should be displayed.
 * All filter arrays are AND'ed together (all conditions must be met).
 * Within each array, values are OR'ed (any value matches).
 */
export interface CalendarFilters {
  // ============================================
  // TYPE FILTERS
  // ============================================

  /**
   * Filter by event type
   * Empty array = show all types
   * Multiple values = show any of these types
   */
  eventTypes: CalendarEventType[];

  /**
   * Filter by status
   * Empty array = show all statuses
   */
  statuses: CalendarEventStatus[];

  /**
   * Filter by priority
   * Empty array = show all priorities
   */
  priorities: CalendarEventPriority[];

  /**
   * Filter by content type
   * Empty array = show all content types
   * Only applies to events with contentType field
   */
  contentTypes: ContentType[];

  /**
   * Filter by social platforms
   * Empty array = show all platforms
   * Only applies to social media events
   */
  platforms: string[];

  // ============================================
  // DATE RANGE
  // ============================================

  /**
   * Filter by date range
   * Events must overlap with this range to be shown
   */
  dateRange?: {
    start: Date;
    end: Date;
  };

  // ============================================
  // ASSIGNMENT
  // ============================================

  /**
   * Filter by assignee
   * Empty array = show all assignees (including unassigned)
   */
  assigneeIds: string[];

  // ============================================
  // TAGS AND CATEGORIES
  // ============================================

  /**
   * Filter by tags
   * Events must have at least one of these tags
   * Empty array = show all tags
   */
  tags: string[];

  /**
   * Filter by custom category
   * Empty array = show all categories
   */
  categories: string[];

  // ============================================
  // SEARCH
  // ============================================

  /**
   * Full-text search query
   * Searches in: title, description, notes, tags
   * Case-insensitive, partial matches allowed
   */
  searchQuery?: string;

  // ============================================
  // SOURCE
  // ============================================

  /**
   * Filter by event source
   * Empty array = show all sources
   */
  sources: EventSource[];
}

/**
 * Sort options
 *
 * Defines how filtered events should be ordered.
 */
export interface CalendarSortOptions {
  /**
   * Field to sort by
   */
  field: CalendarSortField;

  /**
   * Sort order
   */
  order: 'asc' | 'desc';
}

/**
 * Available sort fields
 */
export type CalendarSortField =
  | 'startDate'     // Sort by event start date
  | 'endDate'       // Sort by event end date
  | 'title'         // Sort alphabetically by title
  | 'status'        // Sort by status
  | 'priority'      // Sort by priority level
  | 'type'          // Sort by event type
  | 'createdAt'     // Sort by creation date
  | 'updatedAt';    // Sort by last update date

/**
 * Saved filter preset
 *
 * Users can save commonly-used filter combinations as presets.
 */
export interface FilterPreset {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * User-defined name
   */
  name: string;

  /**
   * The filter configuration
   */
  filters: CalendarFilters;

  /**
   * Optional sort configuration
   */
  sortOptions?: CalendarSortOptions;

  /**
   * Whether this is the default preset
   * Only one preset should have this = true
   */
  isDefault?: boolean;

  /**
   * When this preset was created
   */
  createdAt: Date;

  /**
   * When this preset was last modified
   */
  updatedAt: Date;

  /**
   * ID of user who created this preset
   */
  createdBy?: string;
}

// ============================================================================
// STATE MANAGEMENT TYPES
// ============================================================================

/**
 * Main calendar state interface
 *
 * This is the complete state shape for the Zustand store.
 * All fields are readonly externally (modified only via actions).
 */
export interface CalendarState {
  // ============================================
  // DATA
  // ============================================

  /**
   * All calendar events (unfiltered)
   * This is the source of truth for event data
   */
  events: CalendarEvent[];

  /**
   * Saved filter presets
   */
  filterPresets: FilterPreset[];

  /**
   * External calendar connections
   */
  externalConnections: ExternalCalendarConnection[];

  // ============================================
  // UI STATE
  // ============================================

  /**
   * Loading indicator for async operations
   */
  isLoading: boolean;

  /**
   * Error from last failed operation
   */
  error: Error | null;

  /**
   * ID of currently selected event
   */
  selectedEventId: string | null;

  /**
   * ID of currently hovered event
   */
  hoveredEventId: string | null;

  /**
   * ID of event currently being dragged
   */
  draggedEventId: string | null;

  // ============================================
  // VIEW CONFIGURATION
  // ============================================

  /**
   * Current view configuration
   */
  viewConfig: CalendarViewConfig;

  /**
   * Active filters
   */
  filters: CalendarFilters;

  /**
   * Active sort options
   */
  sortOptions: CalendarSortOptions;

  // ============================================
  // CONFLICT DETECTION
  // ============================================

  /**
   * Detected scheduling conflicts
   */
  conflicts: EventConflict[];

  /**
   * Whether to show conflict resolution dialog
   */
  showConflictDialog: boolean;
}

// ============================================================================
// EXTERNAL CALENDAR TYPES
// ============================================================================

/**
 * External calendar providers
 */
export type ExternalCalendarProvider =
  | 'google'        // Google Calendar
  | 'outlook'       // Microsoft Outlook/Office 365
  | 'ical'          // iCal file import
  | 'calDAV';       // Generic CalDAV server

/**
 * External calendar connection
 *
 * Represents a connection to an external calendar service.
 */
export interface ExternalCalendarConnection {
  /**
   * Unique identifier for this connection
   */
  id: string;

  /**
   * Calendar provider
   */
  provider: ExternalCalendarProvider;

  /**
   * User-defined name for this connection
   */
  name: string;

  /**
   * Email address associated with the calendar
   */
  email?: string;

  /**
   * Whether this connection is currently enabled
   */
  enabled: boolean;

  /**
   * When this connection was last synced
   */
  lastSync?: Date;

  /**
   * Error from last sync attempt (if failed)
   */
  syncError?: string;

  /**
   * Color to use for events from this calendar
   * Hex color code (e.g., "#7C3AED")
   */
  color?: string;

  /**
   * How often to automatically sync
   */
  syncFrequency?: 'manual' | 'hourly' | 'daily' | 'weekly';

  /**
   * Connection credentials (encrypted, stored in OS keychain)
   * Not stored in state, used only for IPC
   */
  credentials?: ExternalCalendarCredentials;
}

/**
 * External calendar credentials
 *
 * Authentication credentials for external calendars.
 * These should never be stored in the main store - use OS keychain.
 */
export interface ExternalCalendarCredentials {
  /**
   * OAuth access token
   */
  accessToken?: string;

  /**
   * OAuth refresh token
   */
  refreshToken?: string;

  /**
   * Token expiry timestamp
   */
  expiresAt?: Date;

  /**
   * API key (for services that use API keys)
   */
  apiKey?: string;

  /**
   * CalDAV URL (for CalDAV connections)
   */
  caldavUrl?: string;

  /**
   * CalDAV username
   */
  username?: string;

  /**
   * CalDAV password
   */
  password?: string;
}

/**
 * External calendar event
 *
 * Represents an event from an external calendar source.
 * This is separate from CalendarEvent to handle provider-specific fields.
 */
export interface ExternalCalendarEvent {
  /**
   * Event ID in external system
   */
  id: string;

  /**
   * Calendar ID this event belongs to
   */
  calendarId: string;

  /**
   * Event title
   */
  title: string;

  /**
   * Event description
   */
  description?: string;

  /**
   * Event start date/time
   */
  startDate: Date;

  /**
   * Event end date/time
   */
  endDate?: Date;

  /**
   * Physical or virtual location
   */
  location?: string;

  /**
   * Event attendees
   */
  attendees?: ExternalEventAttendee[];

  /**
   * Recurrence rule (iCalendar RRULE format)
   */
  recurrence?: string;

  /**
   * Which provider this event came from
   */
  source: ExternalCalendarProvider;
}

/**
 * Event attendee
 */
export interface ExternalEventAttendee {
  /**
   * Attendee email
   */
  email: string;

  /**
   * Attendee name
   */
  name?: string;

  /**
   * Response status
   */
  response?: 'accepted' | 'declined' | 'tentative' | 'needs-action';
}

// ============================================================================
// CONFLICT TYPES
// ============================================================================

/**
 * Event conflict
 *
 * Represents a scheduling conflict between events.
 */
export interface EventConflict {
  /**
   * ID of the event being moved/created
   */
  eventId: string;

  /**
   * IDs of events that conflict
   */
  conflictingEventIds: string[];

  /**
   * Conflict severity
   */
  severity: 'warning' | 'error';

  /**
   * Human-readable conflict message
   */
  message: string;

  /**
   * Suggested resolution
   */
  resolution?: ConflictResolution;
}

/**
 * Conflict resolution options
 */
export interface ConflictResolution {
  /**
   * What action to take
   */
  action: 'move' | 'split' | 'cancel' | 'ignore';

  /**
   * New start date (if action is 'move')
   */
  newStartDate?: Date;

  /**
   * New end date (if action is 'move' or 'split')
   */
  newEndDate?: Date;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Partial update type for events
 *
 * Allows updating specific fields without providing entire event.
 * All fields except `id` are optional.
 * Does not allow changing `id`, `createdAt`, or `createdById`.
 */
export type CalendarEventUpdate = Partial<
  Pick<
    CalendarEvent,
    | 'title'
    | 'description'
    | 'startDate'
    | 'endDate'
    | 'allDay'
    | 'tags'
    | 'category'
    | 'priority'
    | 'linkedFeatureId'
    | 'linkedTaskId'
    | 'linkedFileId'
    | 'assigneeId'
    | 'assigneeName'
    | 'location'
    | 'notes'
    | 'contentType'
    | 'platforms'
    | 'estimatedHours'
    | 'recurrence'
    | 'status'
    | 'type'
  >
> & {
  /**
   * ID is required for updates
   */
  id: string;

  /**
   * updatedAt is automatically set
   */
  updatedAt?: Date;
};

/**
 * Create event input type
 *
 * Same as CalendarEvent but without auto-generated fields.
 */
export type CalendarEventCreate = Omit<
  CalendarEvent,
  'id' | 'createdAt' | 'updatedAt'
> & {
  /**
   * Optionally specify ID (otherwise auto-generated)
   */
  id?: string;

  /**
   * Optionally specify creation timestamps (otherwise auto-generated)
   */
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Filter preset update type
 */
export type FilterPresetUpdate = Partial<
  Pick<
    FilterPreset,
    'name' | 'filters' | 'sortOptions' | 'isDefault'
  >
> & {
  id: string;
  updatedAt?: Date;
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if an event is all-day
 */
export function isAllDayEvent(event: CalendarEvent): boolean {
  return event.allDay;
}

/**
 * Check if an event is multi-day
 */
export function isMultiDayEvent(event: CalendarEvent): boolean {
  if (!event.endDate) return false;
  const dayDiff = Math.floor(
    (event.endDate.getTime() - event.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return dayDiff > 0;
}

/**
 * Check if an event is recurring
 */
export function isRecurringEvent(event: CalendarEvent): boolean {
  return event.recurrence !== undefined;
}

/**
 * Check if an event is in the past
 */
export function isPastEvent(event: CalendarEvent): boolean {
  const now = new Date();
  const endDate = event.endDate || event.startDate;
  return endDate < now;
}

/**
 * Check if an event is currently happening
 */
export function isCurrentEvent(event: CalendarEvent): boolean {
  const now = new Date();
  return event.startDate <= now && (event.endDate || event.startDate) >= now;
}

/**
 * Check if an event is in the future
 */
export function isFutureEvent(event: CalendarEvent): boolean {
  const now = new Date();
  return event.startDate > now;
}

/**
 * Check if an event has a specific content type
 */
export function isContentTypeEvent(
  event: CalendarEvent,
  contentType: ContentType
): boolean {
  return event.contentType === contentType;
}

/**
 * Check if an event is assigned to a specific user
 */
export function isEventAssignedTo(event: CalendarEvent, assigneeId: string): boolean {
  return event.assigneeId === assigneeId;
}

/**
 * Check if an event matches a filter
 */
export function eventMatchesFilter(
  event: CalendarEvent,
  filters: CalendarFilters
): boolean {
  // Event type filter
  if (filters.eventTypes.length > 0 && !filters.eventTypes.includes(event.type)) {
    return false;
  }

  // Status filter
  if (filters.statuses.length > 0 && !filters.statuses.includes(event.status)) {
    return false;
  }

  // Priority filter
  if (filters.priorities.length > 0 && !filters.priorities.includes(event.priority)) {
    return false;
  }

  // Content type filter
  if (
    filters.contentTypes.length > 0 &&
    event.contentType &&
    !filters.contentTypes.includes(event.contentType)
  ) {
    return false;
  }

  // Platform filter
  if (
    filters.platforms.length > 0 &&
    event.platforms &&
    !filters.platforms.some((p) => event.platforms?.includes(p))
  ) {
    return false;
  }

  // Assignee filter
  if (
    filters.assigneeIds.length > 0 &&
    !filters.assigneeIds.includes(event.assigneeId || '')
  ) {
    return false;
  }

  // Tags filter
  if (
    filters.tags.length > 0 &&
    !filters.tags.some((t) => event.tags.includes(t))
  ) {
    return false;
  }

  // Category filter
  if (
    filters.categories.length > 0 &&
    event.category &&
    !filters.categories.includes(event.category)
  ) {
    return false;
  }

  // Source filter
  if (filters.sources.length > 0 && !filters.sources.includes(event.source)) {
    return false;
  }

  // Date range filter
  if (filters.dateRange) {
    const eventEnd = event.endDate || event.startDate;
    if (event.startDate > filters.dateRange.end || eventEnd < filters.dateRange.start) {
      return false;
    }
  }

  // Search query filter
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    const searchableText = [
      event.title,
      event.description,
      event.notes,
      ...event.tags,
    ].join(' ').toLowerCase();

    if (!searchableText.includes(query)) {
      return false;
    }
  }

  return true;
}

/**
 * Sort events by field and order
 */
export function sortEvents(
  events: CalendarEvent[],
  sortOptions: CalendarSortOptions
): CalendarEvent[] {
  const sorted = [...events];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortOptions.field) {
      case 'startDate':
        comparison = a.startDate.getTime() - b.startDate.getTime();
        break;

      case 'endDate':
        const aEnd = a.endDate || a.startDate;
        const bEnd = b.endDate || b.startDate;
        comparison = aEnd.getTime() - bEnd.getTime();
        break;

      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;

      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;

      case 'priority':
        const priorityOrder = ['critical', 'high', 'medium', 'low', 'none'];
        comparison = priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
        break;

      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;

      case 'createdAt':
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
        break;

      case 'updatedAt':
        comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
        break;
    }

    return sortOptions.order === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Get filtered and sorted events
 */
export function getFilteredAndSortedEvents(
  events: CalendarEvent[],
  filters: CalendarFilters,
  sortOptions: CalendarSortOptions
): CalendarEvent[] {
  const filtered = events.filter((event) => eventMatchesFilter(event, filters));
  return sortEvents(filtered, sortOptions);
}

/**
 * Get events for a specific date
 */
export function getEventsForDate(
  events: CalendarEvent[],
  date: Date
): CalendarEvent[] {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  return events.filter((event) => {
    if (event.allDay) {
      const eventDate = new Date(event.startDate);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() === targetDate.getTime();
    }

    return event.startDate < nextDate && (event.endDate || event.startDate) >= targetDate;
  });
}

/**
 * Get events for a date range
 */
export function getEventsInRange(
  events: CalendarEvent[],
  start: Date,
  end: Date
): CalendarEvent[] {
  const rangeStart = new Date(start);
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(end);
  rangeEnd.setHours(23, 59, 59, 999);

  return events.filter((event) => {
    const eventEnd = event.endDate || event.startDate;
    return event.startDate <= rangeEnd && eventEnd >= rangeStart;
  });
}

/**
 * Get events count by type
 */
export function getEventCountByType(
  events: CalendarEvent[]
): Record<CalendarEventType, number> {
  const counts: Record<string, number> = {};

  for (const type of [
    'campaign',
    'content',
    'social',
    'email',
    'seo',
    'deadline',
    'event',
    'milestone',
  ] as CalendarEventType[]) {
    counts[type] = events.filter((e) => e.type === type).length;
  }

  return counts as Record<CalendarEventType, number>;
}

/**
 * Get events count by status
 */
export function getEventCountByStatus(
  events: CalendarEvent[]
): Record<CalendarEventStatus, number> {
  const counts: Record<string, number> = {};

  for (const status of [
    'draft',
    'scheduled',
    'in-progress',
    'under-review',
    'published',
    'cancelled',
  ] as CalendarEventStatus[]) {
    counts[status] = events.filter((e) => e.status === status).length;
  }

  return counts as Record<CalendarEventStatus, number>;
}

/**
 * Export all types for easy importing
 */
export type {
  // Core types
  CalendarEvent,
  CalendarEventType,
  CalendarEventStatus,
  CalendarEventPriority,
  EventSource,
  ContentType,

  // Recurrence
  RecurrenceRule,

  // View types
  CalendarViewMode,
  TimelineZoomLevel,
  CalendarViewConfig,

  // Filter and sort
  CalendarFilters,
  CalendarSortOptions,
  CalendarSortField,
  FilterPreset,

  // State
  CalendarState,

  // External calendar
  ExternalCalendarProvider,
  ExternalCalendarConnection,
  ExternalCalendarCredentials,
  ExternalCalendarEvent,
  ExternalEventAttendee,

  // Conflict
  EventConflict,
  ConflictResolution,

  // Utility
  CalendarEventUpdate,
  CalendarEventCreate,
  FilterPresetUpdate,
};
