/**
 * Calendar-related constants
 */

import type { CalendarItemType } from '../types';

// ============================================
// Color Scheme (from PRD)
// ============================================

export const CALENDAR_COLORS: Record<CalendarItemType, { gradient: string; solid: string; light: string }> = {
  campaign: {
    gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
    solid: '#8B5CF6',
    light: 'bg-purple-100 dark:bg-purple-900/20',
  },
  content: {
    gradient: 'linear-gradient(135deg, #3B82F6, #60A5FA)',
    solid: '#3B82F6',
    light: 'bg-blue-100 dark:bg-blue-900/20',
  },
  social: {
    gradient: 'linear-gradient(135deg, #EC4899, #F472B6)',
    solid: '#EC4899',
    light: 'bg-pink-100 dark:bg-pink-900/20',
  },
  email: {
    gradient: 'linear-gradient(135deg, #10B981, #34D399)',
    solid: '#10B981',
    light: 'bg-green-100 dark:bg-green-900/20',
  },
  seo: {
    gradient: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
    solid: '#F59E0B',
    light: 'bg-amber-100 dark:bg-amber-900/20',
  },
  deadline: {
    gradient: 'linear-gradient(135deg, #EF4444, #F87171)',
    solid: '#EF4444',
    light: 'bg-red-100 dark:bg-red-900/20',
  },
  event: {
    gradient: 'linear-gradient(135deg, #6366F1, #818CF8)',
    solid: '#6366F1',
    light: 'bg-indigo-100 dark:bg-indigo-900/20',
  },
};

// ============================================
// Item Type Labels
// ============================================

export const CALENDAR_ITEM_TYPE_LABELS: Record<CalendarItemType, string> = {
  campaign: 'Campaign',
  content: 'Content',
  social: 'Social Media',
  email: 'Email',
  seo: 'SEO',
  deadline: 'Deadline',
  event: 'Event',
};

// ============================================
// Item Type Icons
// ============================================

export const CALENDAR_ITEM_TYPE_ICONS: Record<CalendarItemType, string> = {
  campaign: 'megaphone',
  content: 'file-text',
  social: 'share-2',
  email: 'mail',
  seo: 'search',
  deadline: 'alert-circle',
  event: 'calendar',
};

// ============================================
// Calendar Storage Paths
// ============================================

export const CALENDAR_DIR = '.auto-claude/calendar';
export const CALENDAR_DATA_FILE = 'calendar.json';
export const CALENDAR_EXTERNAL_DIR = 'external-calendars';
