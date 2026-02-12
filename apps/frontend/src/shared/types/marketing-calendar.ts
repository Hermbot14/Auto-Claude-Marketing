/**
 * Marketing Calendar Types
 * Unified calendar system combining generic calendar and marketing-specific features
 */

import type { RoadmapFeature } from './roadmap';

// ============================================
// Marketing Event Types
// ============================================

/**
 * Extended marketing event types combining calendar.ts and content-calendar.ts
 */
export type MarketingEventType =
  | 'campaign'       // Purple - Marketing campaigns
  | 'content'        // Blue - Content pieces (blog, video, etc.)
  | 'social'         // Pink - Social media posts
  | 'email'          // Green - Email marketing
  | 'seo'            // Orange - SEO tasks
  | 'deadline'       // Red - Important deadlines
  | 'event'          // Indigo - External events
  | 'ad'            // Orange - Paid advertisements (from content-calendar)
  | 'video';         // Red - Video content (from content-calendar)

/**
 * Content types from content-calendar.ts, maintained for compatibility
 */
export type ContentType = 'blog' | 'social' | 'email' | 'ad' | 'video' | 'other';

/**
 * Publishing status for marketing content
 */
export type PublishingStatus = 'draft' | 'scheduled' | 'published' | 'cancelled';

/**
 * Priority levels for calendar items
 */
export type Priority = 'high' | 'medium' | 'low';

/**
 * Social media platforms for multi-platform scheduling
 */
export type SocialPlatform = 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'youtube' | 'tiktok';

/**
 * External calendar providers
 */
export type ExternalProvider = 'google' | 'outlook' | 'ical' | 'calDAV';

/**
 * Calendar view modes including tour-timeline
 */
export type CalendarViewMode = 'day' | 'week' | 'month' | 'list' | 'tour-timeline';

/**
 * Zoom levels for calendar navigation
 */
export type CalendarZoomLevel = 'day' | 'week' | 'month' | 'quarter';

/**
 * Source of calendar item
 */
export type CalendarItemSource = 'roadmap' | 'file' | 'external' | 'manual';

// ============================================
// Base Calendar Item Interface
// ============================================

/**
 * Base calendar item with core fields
 */
interface BaseCalendarItem {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Marketing Calendar Item
// ============================================

/**
 * Unified marketing calendar item that extends both CalendarItem and ContentCampaign
 * This type provides all features from both systems:
 * - Generic calendar fields (type, status, source, tags, recurrence)
 * - Marketing-specific fields (platforms, contentType, campaign linking)
 * - Publishing fields (priority, engagement metrics)
 */
export interface MarketingCalendarItem extends BaseCalendarItem {
  // Core calendar fields
  type: MarketingEventType;
  status: PublishingStatus;
  source: CalendarItemSource;

  // Relationships
  linkedFeatureId?: string;     // Link to roadmap feature
  linkedTaskId?: string;        // Link to task/spec
  linkedFileId?: string;        // Link to project file
  externalEventId?: string;     // Link to external calendar
  campaignId?: string;          // Link to parent campaign

  // Marketing-specific fields
  platforms?: SocialPlatform[];  // Multi-platform scheduling
  contentType?: ContentType;      // Content type granularity

  // Content metadata
  tags?: string[];
  assignee?: string;
  priority?: Priority;
  location?: string;
  notes?: string;

  // Engagement metrics
  expectedReach?: number;
  actualReach?: number;

  // Publishing status
  dueDate?: Date;               // Content deadline
  scheduledDate?: Date;          // When content is scheduled
  estimatedHours?: number;        // Time estimate for creation

  // Recurrence support (from calendar.ts)
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    until?: Date;
    count?: number;
  };
}

// ============================================
// Conflict Detection Types
// ============================================

/**
 * Severity level for conflicts
 */
export type ConflictSeverity = 'warning' | 'error' | 'critical';

/**
 * Type of conflict detected
 */
export type ConflictType =
  | 'time-overlap'        // Events scheduled at same time
  | 'platform-overload'     // Too many posts per platform per day
  | 'resource-conflict'    // Same assignee for overlapping events
  | 'deadline-violation';   // Content scheduled after campaign deadline

/**
 * Detected schedule conflict
 */
export interface ScheduleConflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  message: string;
  conflictingItems: MarketingCalendarItem[];
  suggestedResolution?: ConflictResolution;
}

/**
 * Resolution strategy for conflicts
 */
export type ResolutionStrategy =
  | 'auto-resolve'         // Move to next available slot
  | 'manual-resolve'       // User selects date
  | 'cancel-conflicting'     // Cancel conflicting event
  | 'split-interval';       // Divide overlapping time

/**
 * Conflict resolution action
 */
export interface ConflictResolution {
  strategy: ResolutionStrategy;
  targetDate?: Date;
  rescheduledItems: Array<{ itemId: string; newDate: Date }>;
  cancelledItems: string[];
}

// ============================================
// External Calendar Integration
// ============================================

/**
 * External calendar connection configuration
 */
export interface ExternalCalendarConnection {
  id: string;
  provider: ExternalProvider;
  name: string;
  email?: string;
  enabled: boolean;
  lastSync?: Date;
  syncError?: string;
  color?: string;
  syncSettings?: {
    bidirectional?: boolean;  // Sync both ways
    importEvents?: boolean;    // Import from external
    exportEvents?: boolean;    // Export to external
  };
}

/**
 * External calendar event (for import/export)
 */
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
  source: ExternalProvider;
}

/**
 * Sync status for external calendars
 */
export interface CalendarSyncStatus {
  provider: ExternalProvider;
  isConnected: boolean;
  lastSync?: Date;
  lastError?: string;
  isSyncing: boolean;
  eventsImported?: number;
  eventsExported?: number;
}

// ============================================
// Calendar Data & Filters
// ============================================

/**
 * Main calendar data structure
 */
export interface MarketingCalendarData {
  projectId: string;
  items: MarketingCalendarItem[];
  externalConnections: ExternalCalendarConnection[];
  viewMode: CalendarViewMode;
  zoomLevel: CalendarZoomLevel;
  currentDate: Date;
  filters: MarketingCalendarFilters;
  updatedAt: Date;
}

/**
 * Unified filter interface combining both calendar systems
 */
export interface MarketingCalendarFilters {
  // Type filters (from calendar.ts)
  eventTypes: MarketingEventType[];
  statuses: PublishingStatus[];
  sources: CalendarItemSource[];

  // Marketing filters (from content-calendar.ts)
  contentTypes: ContentType[];
  platforms: SocialPlatform[];

  // Common filters
  tags: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
}

// ============================================
// Drag & Drop Types
// ============================================

/**
 * Drag drop context for calendar items
 */
export interface DragDropContext {
  draggedItem: MarketingCalendarItem | null;
  isDragOver: boolean;
  dropTargetDate: Date | null;
}

// ============================================
// Calendar Grid Types (for views)
// ============================================

/**
 * Calendar date cell with items
 */
export interface CalendarDate {
  date: Date;
  isToday: boolean;
  isCurrentMonth: boolean;
  items: MarketingCalendarItem[];
}

/**
 * Week day structure
 */
export interface WeekDay {
  date: Date;
  day: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  items: MarketingCalendarItem[];
}

// ============================================
// Campaign Types (for marketing campaigns)
// ============================================

/**
 * Marketing campaign with multiple content pieces
 * Extends RoadmapFeature for roadmap integration
 */
export interface MarketingCampaign extends RoadmapFeature {
  // Marketing-specific
  campaignType?: 'awareness' | 'consideration' | 'conversion' | 'retention';
  platforms?: SocialPlatform[];
  contentType?: ContentType;
  targetAudience?: string;
  budget?: number;

  // Timeline
  startDate: Date;
  endDate?: Date;

  // Content pieces within campaign
  contentItems?: string[];  // IDs of associated content items

  // Metrics
  targetReach?: number;
  actualReach?: number;
  engagement?: number;
  conversions?: number;
}

// ============================================
// Statistics & Analytics Types
// ============================================

/**
 * Calendar statistics for dashboard
 */
export interface CalendarStatistics {
  totalItems: number;
  itemsByType: Record<MarketingEventType, number>;
  itemsByStatus: Record<PublishingStatus, number>;
  itemsByPlatform: Record<SocialPlatform, number>;
  upcomingDeadlines: MarketingCalendarItem[];
  conflicts: ScheduleConflict[];
}

/**
 * Content performance metrics
 */
export interface ContentMetrics {
  itemId: string;
  platform: SocialPlatform;
  publishedAt: Date;
  reach: number;
  engagement: number;
  clicks: number;
  shares: number;
  conversions: number;
}
