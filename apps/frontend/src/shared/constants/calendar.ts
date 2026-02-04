/**
 * Calendar-related constants
 */

import type { CalendarItemType } from '../types';

// ============================================
// Color Scheme (from PRD)
// ============================================

export const CALENDAR_COLORS: Record<CalendarItemType, { gradient: string; solid: string; light: string }> = {
  campaign: {
    gradient: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
    solid: '#7C3AED',
    light: 'bg-purple-100 dark:bg-purple-900/20',
  },
  content: {
    gradient: 'linear-gradient(135deg, #2563EB, #60A5FA)',
    solid: '#2563EB',
    light: 'bg-blue-100 dark:bg-blue-900/20',
  },
  social: {
    gradient: 'linear-gradient(135deg, #DB2777, #F472B6)',
    solid: '#DB2777',
    light: 'bg-pink-100 dark:bg-pink-900/20',
  },
  email: {
    gradient: 'linear-gradient(135deg, #059669, #34D399)',
    solid: '#059669',
    light: 'bg-green-100 dark:bg-green-900/20',
  },
  seo: {
    gradient: 'linear-gradient(135deg, #D97706, #FBBF24)',
    solid: '#D97706',
    light: 'bg-amber-100 dark:bg-amber-900/20',
  },
  deadline: {
    gradient: 'linear-gradient(135deg, #DC2626, #F87171)',
    solid: '#DC2626',
    light: 'bg-red-100 dark:bg-red-900/20',
  },
  event: {
    gradient: 'linear-gradient(135deg, #4F46E5, #818CF8)',
    solid: '#4F46E5',
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
