/**
 * Content Calendar Constants
 * Content types, colors, and labels
 */

// ============================================
// Content Types
// ============================================

export interface ContentTypeConfig {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  description: string;
}

export const CONTENT_TYPES: Record<string, ContentTypeConfig> = {
  blog: {
    id: 'blog',
    label: 'Blog Post',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: 'FileText',
    description: 'Blog articles and tutorials'
  },
  social: {
    id: 'social',
    label: 'Social Media',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
    icon: 'Share2',
    description: 'Social media posts and updates'
  },
  email: {
    id: 'email',
    label: 'Email Campaign',
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
    icon: 'Mail',
    description: 'Email newsletters and campaigns'
  },
  ad: {
    id: 'ad',
    label: 'Advertisement',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 border-orange-200',
    icon: 'Megaphone',
    description: 'Paid advertisements'
  },
  video: {
    id: 'video',
    label: 'Video',
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    icon: 'Video',
    description: 'Video content and tutorials'
  },
  other: {
    id: 'other',
    label: 'Other',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 border-gray-200',
    icon: 'MoreHorizontal',
    description: 'Other content types'
  }
};

// ============================================
// Calendar Views
// ============================================

export const CALENDAR_VIEWS = [
  { id: 'month', label: 'Month', icon: 'Calendar' },
  { id: 'week', label: 'Week', icon: 'CalendarDays' },
  { id: 'day', label: 'Day', icon: 'CalendarClock' },
  { id: 'list', label: 'List', icon: 'List' },
  { id: 'tour-timeline', label: 'Tour Timeline', icon: 'GitBranch' }
] as const;

// ============================================
// Platform Options
// ============================================

export const SOCIAL_PLATFORMS = [
  { id: 'twitter', label: 'Twitter/X', icon: 'Twitter', color: 'text-blue-400' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'Linkedin', color: 'text-blue-600' },
  { id: 'facebook', label: 'Facebook', icon: 'Facebook', color: 'text-blue-500' },
  { id: 'instagram', label: 'Instagram', icon: 'Instagram', color: 'text-pink-500' },
  { id: 'youtube', label: 'YouTube', icon: 'Youtube', color: 'text-red-600' },
  { id: 'tiktok', label: 'TikTok', icon: 'Music', color: 'text-gray-800' }
] as const;

// ============================================
// Calendar Colors by Status
// ============================================

export const CALENDAR_STATUS_COLORS = {
  under_review: 'bg-gray-100 text-gray-700 border-gray-300',
  planned: 'bg-blue-100 text-blue-700 border-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  done: 'bg-green-100 text-green-700 border-green-300'
} as const;

// ============================================
// Date Formatting
// ============================================

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const;

export const DAY_NAMES = [
  'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
] as const;

export const DAY_NAMES_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday'
] as const;
