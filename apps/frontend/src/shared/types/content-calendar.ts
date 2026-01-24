/**
 * Content Calendar Types
 * Extends Roadmap types for calendar-based campaign management
 */

import type { RoadmapFeature } from './roadmap';

// ============================================
// Content Types
// ============================================

export type ContentType = 'blog' | 'social' | 'email' | 'ad' | 'video' | 'other';

export interface ContentCampaign extends RoadmapFeature {
  // Content-specific fields
  contentType: ContentType;
  scheduledDate?: Date;
  dueDate?: Date;
  estimatedHours?: number;
  platforms?: string[];  // For social media (twitter, linkedin, etc.)
  tags?: string[];
}

// ============================================
// Calendar View Types
// ============================================

export type CalendarView = 'month' | 'week' | 'day' | 'list';

export interface CalendarDate {
  date: Date;
  isToday: boolean;
  isCurrentMonth: boolean;
  campaigns: ContentCampaign[];
}

export interface WeekDay {
  date: Date;
  day: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  campaigns: ContentCampaign[];
}

// ============================================
// Filter Types
// ============================================

export interface CalendarFilters {
  contentTypes: ContentType[];
  statuses: string[];
  platforms?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
}

// ============================================
// Scheduling Types
// ============================================

export interface ScheduleConflict {
  campaignId: string;
  conflictingCampaigns: ContentCampaign[];
  severity: 'warning' | 'error';
  message: string;
}

export interface DragDropCampaign {
  campaign: ContentCampaign;
  sourceDate: Date;
  targetDate: Date;
}

// ============================================
// Calendar Event Types
// ============================================

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
  campaign: ContentCampaign;
  color?: string;
}
