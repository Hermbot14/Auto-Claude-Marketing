/**
 * Calendar-related types for the marketing calendar feature
 */

// ============================================
// Calendar Item Types
// ============================================

export type CalendarItemType =
  | 'campaign'       // Purple - Marketing campaigns
  | 'content'        // Blue - Content pieces (blog, video, etc.)
  | 'social'         // Pink - Social media posts
  | 'email'          // Green - Email marketing
  | 'seo'            // Orange - SEO tasks
  | 'deadline'       // Red - Important deadlines
  | 'event';         // Indigo - External events

export type CalendarItemStatus = 'draft' | 'scheduled' | 'published' | 'cancelled';

export type CalendarItemSource = 'roadmap' | 'file' | 'external' | 'manual';

// ============================================
// Calendar Item Interface
// ============================================

export interface CalendarItem {
  id: string;
  title: string;
  description?: string;
  type: CalendarItemType;
  status: CalendarItemStatus;
  source: CalendarItemSource;

  // Date/time information
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;

  // Relationships
  linkedFeatureId?: string;     // Link to roadmap feature
  linkedTaskId?: string;        // Link to task/spec
  linkedFileId?: string;        // Link to project file
  externalEventId?: string;     // Link to external calendar

  // Metadata
  tags?: string[];
  assignee?: string;
  priority?: 'high' | 'medium' | 'low';
  location?: string;
  notes?: string;

  // Recurrence
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    until?: Date;
    count?: number;
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Calendar View Types
// ============================================

export type CalendarViewMode = 'day' | 'week' | 'month';
export type CalendarZoomLevel = 'day' | 'week' | 'month' | 'quarter';

// ============================================
// Calendar Data Interface
// ============================================

export interface CalendarData {
  projectId: string;
  items: CalendarItem[];
  viewMode: CalendarViewMode;
  zoomLevel: CalendarZoomLevel;
  currentDate: Date;
  filters: CalendarFilters;
  updatedAt: Date;
}

// ============================================

// Calendar Filters
// ============================================

export interface CalendarFilters {
  itemTypes: CalendarItemType[];
  status: CalendarItemStatus[];
  sources: CalendarItemSource[];
  tags: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
}

// ============================================
// External Calendar Integration
// ============================================

export type ExternalCalendarProvider = 'google' | 'outlook' | 'ical' | 'calDAV';

export interface ExternalCalendarConnection {
  id: string;
  provider: ExternalCalendarProvider;
  name: string;
  email?: string;
  enabled: boolean;
  lastSync?: Date;
  syncError?: string;
  color?: string;
}

export interface ExternalCalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  attendees?: string[];
  recurrence?: string;
  source: ExternalCalendarProvider;
}
