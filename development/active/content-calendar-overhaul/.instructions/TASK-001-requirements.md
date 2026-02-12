# TASK-001: Content Calendar Requirements Document

**Task ID:** TASK-001
**Title:** Analyze Current Implementation & Define Requirements
**Status:** Completed
**Date:** 2026-02-05
**Author:** AI Agent (Claude)

---

## Executive Summary

This document captures the analysis of the existing Content Calendar implementation and defines comprehensive requirements for the complete overhaul. The current implementation has two parallel calendar systems that need consolidation:

1. **Legacy Calendar System** (`calendarStore.ts`) - Generic calendar with IPC-based persistence
2. **Content Calendar System** (`ContentCalendarStore.ts`) - Marketing-focused with content types

**Key Finding:** The codebase has TWO separate calendar implementations that need to be merged into a unified, production-ready system.

---

## Part 1: Current Implementation Audit

### 1.1 Component Inventory

#### Primary Calendar Components

| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| `ContentCalendar.tsx` | `apps/frontend/src/renderer/features/content-calendar/` | Main calendar container | ✅ Functional |
| `ContentCalendarStore.ts` | `apps/frontend/src/renderer/features/content-calendar/` | Zustand state management | ⚠️ Needs consolidation |
| `CalendarHeader.tsx` | `apps/frontend/src/renderer/features/content-calendar/` | Navigation and view switching | ✅ Functional |
| `MonthView.tsx` | `apps/frontend/src/renderer/features/content-calendar/` | Month grid view | ✅ Functional |
| `WeekView.tsx` | `apps/frontend/src/renderer/features/content-calendar/` | Week columns view | ✅ Functional |
| `DayView.tsx` | `apps/frontend/src/renderer/features/content-calendar/` | Day detail view | ✅ Functional |
| `ListView.tsx` | `apps/frontend/src/renderer/features/content-calendar/` | List/table view | ✅ Functional |
| `TourTimelineView.tsx` | `apps/frontend/src/renderer/features/content-calendar/` | Tour-specific timeline | ✅ Functional |
| `FilterBar.tsx` | `apps/frontend/src/renderer/features/content-calendar/` | Filtering UI | ✅ Functional |
| `CampaignCard.tsx` | `apps/frontend/src/renderer/features/content-calendar/` | Event display card | ✅ Functional |
| `CampaignDialog.tsx` | `apps/frontend/src/renderer/features/content-calendar/` | Edit/create dialog | ✅ Functional |
| `ConflictDialog.tsx` | `apps/frontend/src/renderer/features/content-calendar/` | Scheduling conflict UI | ✅ Functional |

#### Legacy Calendar Components (To Be Migrated)

| Component | Location | Purpose | Migration Status |
|-----------|----------|---------|------------------|
| `calendarStore.ts` | `apps/frontend/src/renderer/stores/` | Legacy Zustand store | ❌ Needs merge |
| `CalendarView.tsx` | `apps/frontend/src/renderer/components/calendar/` | Generic calendar view | ⚠️ Duplicate |
| `CalendarTimeline.tsx` | `apps/frontend/src/renderer/components/calendar/` | Timeline component | ⚠️ May reuse |
| `CalendarMonthView.tsx` | `apps/frontend/src/renderer/components/calendar/` | Month view | ⚠️ Duplicate |

### 1.2 Data Models Analysis

#### Content Calendar Types (`shared/types/content-calendar.ts`)

```typescript
// Current content types
type ContentType = 'blog' | 'social' | 'email' | 'ad' | 'video' | 'other';

interface ContentCampaign extends RoadmapFeature {
  contentType: ContentType;
  scheduledDate?: Date;
  dueDate?: Date;
  estimatedHours?: number;
  platforms?: string[];
  tags?: string[];
}

type CalendarView = 'month' | 'week' | 'day' | 'list' | 'tour-timeline';

interface CalendarFilters {
  contentTypes: ContentType[];
  statuses: string[];
  platforms?: string[];
  dateRange?: { start: Date; end: Date };
  searchQuery?: string;
}
```

**Issues Identified:**
- ⚠️ `ContentCampaign` extends `RoadmapFeature` which creates tight coupling
- ⚠️ Uses `scheduledDate` instead of `startDate`/`endDate` pattern (inconsistent)
- ⚠️ No `allDay` field support
- ⚠️ No recurrence support
- ⚠️ No assignee/collaboration fields

#### Legacy Calendar Types (`shared/types/calendar.ts`)

```typescript
type CalendarItemType = 'campaign' | 'content' | 'social' | 'email' | 'seo' | 'deadline' | 'event';

interface CalendarItem {
  id: string;
  title: string;
  description?: string;
  type: CalendarItemType;
  status: CalendarItemStatus;
  source: CalendarItemSource;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  linkedFeatureId?: string;
  linkedTaskId?: string;
  linkedFileId?: string;
  externalEventId?: string;
  tags?: string[];
  assignee?: string;
  priority?: 'high' | 'medium' | 'low';
  location?: string;
  notes?: string;
  recurrence?: RecurrenceRule;
  createdAt: Date;
  updatedAt: Date;
}
```

**Strengths:**
- ✅ Better date range support (`startDate`/`endDate`)
- ✅ `allDay` field support
- ✅ Recurrence support
- ✅ Rich relationship linking (features, tasks, files)
- ✅ Assignee and priority fields

### 1.3 State Management Architecture

#### Content Calendar Store (Zustand)

**Structure:**
```typescript
interface ContentCalendarState {
  currentView: CalendarView;
  currentDate: Date;
  selectedDate: Date | null;
  selectedCampaign: ContentCampaign | null;
  filters: CalendarFilters;
  campaigns: ContentCampaign[];
  conflicts: ScheduleConflict[];
  isDragOver: boolean;
  draggedCampaign: ContentCampaign | null;
  showConflictDialog: boolean;
}
```

**Actions:**
- View management: `setCurrentView`, `setCurrentDate`
- Filter management: `setFilters`, `resetFilters`
- Campaign CRUD: `setCampaigns`, `updateCampaign`, `updateCampaignDate`, `deleteCampaign`
- Drag and drop: `startDrag`, `endDrag`, `handleDrop`
- Conflict detection: `checkConflicts`, `resolveConflict`

**Issues:**
- ⚠️ No data persistence layer (only in-memory state)
- ⚠️ No integration with IPC handlers
- ⚠️ No optimistic updates
- ⚠️ No caching strategy

#### Legacy Calendar Store (Zustand + IPC)

**Structure:**
```typescript
interface CalendarState {
  calendarData: CalendarData | null;
  externalConnections: ExternalCalendarConnection[];
  selectedItem: CalendarItem | null;
  isLoading: boolean;
  error: string | null;
  currentDate: Date;
  viewMode: CalendarViewMode;
  zoomLevel: CalendarZoomLevel;
  filters: CalendarFilters;
}
```

**Strengths:**
- ✅ Has IPC integration (`window.electronAPI.getCalendarData`)
- ✅ File-based persistence (`.auto-claude/calendar/calendar.json`)
- ✅ External calendar connection support
- ✅ Loading and error states

**Issues:**
- ⚠️ Type duplication with Content Calendar
- ⚠️ Snake_case/camelCase transformation complexity
- ⚠️ No optimistic updates

### 1.4 Backend/IPC Integration

#### Calendar IPC Handlers (`main/ipc-handlers/calendar-handlers.ts`)

**Channels:**
- `CALENDAR_GET_DATA` - Load calendar data from file
- `CALENDAR_SAVE_DATA` - Persist calendar data
- `CALENDAR_ADD_ITEM` - Create new calendar item
- `CALENDAR_UPDATE_ITEM` - Update existing item
- `CALENDAR_DELETE_ITEM` - Delete item
- `CALENDAR_SYNC_ROADMAP` - Sync with roadmap data
- `CALENDAR_SCAN_FILES` - Scan files for TODOs/deadlines
- `CALENDAR_CHECK_CONNECTION` - Validate external calendar connection

**Storage:**
- Location: `{projectPath}/.auto-claude/calendar/calendar.json`
- Format: JSON with snake_case keys
- Transformation: camelCase in frontend, snake_case in storage

**Issues:**
- ⚠️ Only works with legacy `CalendarItem` type
- ⚠️ No support for Content Calendar's `ContentCampaign` type
- ⚠️ No bulk operations support
- ⚠️ File scanning not implemented

### 1.5 Current Bug Catalog

#### Critical Issues

| ID | Severity | Issue | Location | Impact |
|----|----------|-------|----------|--------|
| BUG-001 | **High** | No data persistence - Content Calendar data lost on refresh | `ContentCalendarStore.ts` | Data loss |
| BUG-002 | **High** | Two parallel calendar systems create confusion | Multiple files | Maintenance burden |
| BUG-003 | **High** | Drag-and-drop only updates local state (no persistence) | `MonthView.tsx`, `WeekView.tsx` | Data loss |
| BUG-004 | **Medium** | Date type inconsistency (`scheduledDate` vs `startDate`/`endDate`) | Type definitions | Confusing API |
| BUG-005 | **Medium** | No error handling for failed IPC calls | IPC handlers | Silent failures |
| BUG-006 | **Medium** | Search debounce implementation broken (timeout not cleared) | `FilterBar.tsx:69-74` | Memory leak |
| BUG-007 | **Medium** | Conflict detection only checks day-level (ignores time) | `ContentCalendarStore.ts:167-194` | False positives |
| BUG-008 | **Low** | Month view hardcoded to 42 days (6 weeks) | `MonthView.tsx:311` | Wasted space |

#### Performance Issues

| ID | Severity | Issue | Impact |
|----|----------|-------|--------|
| PERF-001 | **High** | No virtualization for large event lists | Slow rendering with 1000+ events |
| PERF-002 | **High** | Filtering runs on every render (no memoization) | Unnecessary re-renders |
| PERF-003 | **Medium** | Date operations not memoized in grid generation | Repeated calculations |
| PERF-004 | **Medium** | Campaign cards re-render on every state change | Poor responsiveness |

#### UX Issues

| ID | Severity | Issue | Impact |
|----|----------|-------|--------|
| UX-001 | **Medium** | No loading states during data fetch | Confusing UI |
| UX-002 | **Medium** | No error states displayed to user | Silent failures |
| UX-003 | **Medium** | No undo for drag-and-drop operations | Easy to make mistakes |
| UX-004 | **Low** | No keyboard navigation support | Poor accessibility |
| UX-005 | **Low** | No ARIA labels on interactive elements | Screen reader issues |

#### Accessibility Issues

| ID | Severity | Issue | WCAG Criterion |
|----|----------|-------|----------------|
| A11Y-001 | **High** | Drag-and-drop not keyboard accessible | 2.1.1 Keyboard |
| A11Y-002 | **High** | Calendar grid missing ARIA labels | 1.3.1 Info and Relationships |
| A11Y-003 | **Medium** | No focus indicators on calendar cells | 2.4.7 Focus Visible |
| A11Y-004 | **Medium** | Color-only status indicators | 1.4.1 Use of Color |
| A11Y-005 | **Low** | Missing skip navigation link | 2.4.1 Bypass Blocks |

#### Internationalization Issues

| ID | Severity | Issue | Impact |
|----|----------|-------|--------|
| I18N-001 | **Medium** | Hard-coded English strings in components | Not translatable |
| I18N-002 | **Medium** | Date formatting not locale-aware | Poor UX for non-US |
| I18N-003 | **Low** | Week start day hardcoded to Sunday | Cultural mismatch |
| I18N-004 | **Low** | No RTL language support | Broken layout for Arabic/Hebrew |

---

## Part 2: New Data Models and Interfaces

### 2.1 Unified Calendar Event Interface

```typescript
/**
 * Unified Calendar Event
 * Combines the best of both ContentCampaign and CalendarItem
 */
export interface CalendarEvent {
  // Identity
  id: string;
  type: CalendarEventType;
  status: CalendarEventStatus;

  // Core content
  title: string;
  description?: string;

  // Date/time (unified pattern)
  startDate: Date;
  endDate?: Date;
  allDay: boolean;

  // Categorization
  tags: string[];
  category?: string; // For custom grouping
  priority: CalendarEventPriority;

  // Relationships
  linkedFeatureId?: string;
  linkedTaskId?: string;
  linkedFileId?: string;
  externalEventId?: string;

  // Assignment (for collaboration)
  assigneeId?: string;
  assigneeName?: string;

  // Location and notes
  location?: string;
  notes?: string;

  // Content-specific fields (conditional)
  contentType?: ContentType;
  platforms?: string[]; // For social media
  estimatedHours?: number;

  // Recurrence
  recurrence?: RecurrenceRule;

  // External integration
  source: EventSource;
  externalCalendarId?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
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

/**
 * Recurrence rule (RRULE-like)
 */
export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // e.g., 2 = every 2 weeks
  until?: Date;
  count?: number;
  byDay?: number[]; // [0, 2, 4] = Mon, Wed, Fri
  byMonth?: number[]; // [0, 6, 11] = Jan, Jul, Dec
}
```

### 2.2 Calendar View Types

```typescript
/**
 * Available calendar views
 */
export type CalendarViewMode =
  | 'month'        // Traditional month grid
  | 'week'         // Week columns with time slots
  | 'day'          // Single day with hourly slots
  | 'list'         // Sortable list/table view
  | 'timeline'     // Horizontal Gantt-style timeline
  | 'agenda';      // Upcoming events list

/**
 * Zoom levels for timeline view
 */
export type TimelineZoomLevel =
  | 'day'          // Show days
  | 'week'         // Show weeks
  | 'month'        // Show months
  | 'quarter';     // Show quarters

/**
 * View configuration
 */
export interface CalendarViewConfig {
  mode: CalendarViewMode;
  currentDate: Date;
  zoomLevel?: TimelineZoomLevel;
  firstDayOfWeek?: 0 | 1 | 6; // Sun, Mon, Sat
  workingHours?: {
    start: number; // 0-23
    end: number;   // 0-23
  };
  hiddenDays?: number[]; // [0, 6] = hide Sunday, Saturday
}
```

### 2.3 Filter and Sort Types

```typescript
/**
 * Calendar filters
 */
export interface CalendarFilters {
  // Type filters
  eventTypes: CalendarEventType[];
  statuses: CalendarEventStatus[];
  priorities: CalendarEventPriority[];
  contentTypes: ContentType[];
  platforms: string[];

  // Date range
  dateRange?: {
    start: Date;
    end: Date;
  };

  // Assignment
  assigneeIds: string[];

  // Tags
  tags: string[];
  categories: string[];

  // Search
  searchQuery?: string;

  // Sources
  sources: EventSource[];
}

/**
 * Sort options
 */
export interface CalendarSortOptions {
  field: CalendarSortField;
  order: 'asc' | 'desc';
}

export type CalendarSortField =
  | 'startDate'
  | 'endDate'
  | 'title'
  | 'status'
  | 'priority'
  | 'type'
  | 'createdAt'
  | 'updatedAt';

/**
 * Saved filter preset
 */
export interface FilterPreset {
  id: string;
  name: string;
  filters: CalendarFilters;
  sortOptions?: CalendarSortOptions;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.4 State Management Architecture

```typescript
/**
 * Main calendar state interface
 */
export interface CalendarState {
  // Data
  events: CalendarEvent[];
  filterPresets: FilterPreset[];
  externalConnections: ExternalCalendarConnection[];

  // UI state
  isLoading: boolean;
  error: Error | null;
  selectedEventId: string | null;
  hoveredEventId: string | null;
  draggedEventId: string | null;

  // View configuration
  viewConfig: CalendarViewConfig;
  filters: CalendarFilters;
  sortOptions: CalendarSortOptions;

  // Conflict detection
  conflicts: EventConflict[];
  showConflictDialog: boolean;

  // Actions (defined in state for Zustand)
  // ... (see implementation)
}

/**
 * External calendar connection
 */
export interface ExternalCalendarConnection {
  id: string;
  provider: ExternalCalendarProvider;
  name: string;
  email?: string;
  enabled: boolean;
  lastSync?: Date;
  syncError?: string;
  color?: string;
  syncFrequency?: 'manual' | 'hourly' | 'daily' | 'weekly';
}

/**
 * Event conflict
 */
export interface EventConflict {
  eventId: string;
  conflictingEventIds: string[];
  severity: 'warning' | 'error';
  message: string;
  resolution?: ConflictResolution;
}

/**
 * Conflict resolution options
 */
export interface ConflictResolution {
  action: 'move' | 'split' | 'cancel' | 'ignore';
  newStartDate?: Date;
  newEndDate?: Date;
}
```

---

## Part 3: Technical Requirements

### 3.1 Performance Requirements

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Initial page load | < 500ms | 1000+ calendar events |
| View navigation | < 200ms | Month/week/day switching |
| Filter application | < 100ms | Complex multi-filter queries |
| Drag-and-drop | < 50ms | Visual feedback latency |
| Search response | < 150ms | Full-text search across events |
| Event creation | < 300ms | End-to-end with persistence |
| Event update | < 200ms | Optimistic update + sync |
| Event deletion | < 200ms | With confirmation dialog |
| List view scroll | 60 FPS | 10,000+ events with virtualization |
| Timeline render | < 500ms | 100+ concurrent events |

**Optimization Strategies:**
- ✅ Virtualization for list and timeline views (react-window or react-virtuoso)
- ✅ Memoized components and selectors (React.memo, useMemo, useCallback)
- ✅ Efficient date calculations (date-fns with immutable operations)
- ✅ Debounced search input (300ms)
- ✅ Request deduplication for parallel data fetches
- ✅ Optimistic updates with rollback on error
- ✅ IndexedDB caching for offline access
- ✅ Service worker for asset caching

### 3.2 Accessibility Requirements (WCAG 2.1 AA)

| Criterion | Requirement | Implementation |
|-----------|-------------|----------------|
| **1.1.1 Non-text Content** | Alt text for icons | All calendar event icons have aria-label |
| **1.3.1 Info and Relationships** | Semantic HTML | Use proper heading hierarchy and list markup |
| **1.4.1 Use of Color** | Not color-only | Status indicators use icons + colors |
| **1.4.3 Contrast (Minimum)** | 4.5:1 text | All text meets WCAG AA contrast |
| **1.4.4 Resize Text** | 200% zoom | Calendar layout breaks gracefully |
| **1.4.10 Reflow** | 320px width | Mobile responsive design |
| **1.4.11 Non-text Contrast** | 3:1 UI components | Icons and borders have sufficient contrast |
| **1.4.12 Text Spacing** | Letter/word/line spacing | Doesn't break layout |
| **1.4.13 Content on Hover** | Dismissible | Tooltips can be dismissed |
| **2.1.1 Keyboard** | All functionality | Full keyboard navigation |
| **2.1.2 No Trap** | Keyboard focus | Focus never trapped |
| **2.1.4 Character Key Shortcuts** | Can disable | Custom shortcuts can be turned off |
| **2.4.3 Focus Order** | Logical order | Tab order follows visual flow |
| **2.4.7 Focus Visible** | Clear indicator | Focus always visible |
| **2.5.1 Pointer Gestures** | Not required | Drag-and-drop has alternative |
| **2.5.2 Pointer Cancellation** | Abortable | Drag operations can be cancelled |
| **2.5.4 Motion Actuation** | No motion | No motion-activated features |
| **2.5.5 Target Size** | 24x24px min | Interactive elements meet size |
| **3.2.1 On Focus** | No context change | Focus doesn't trigger actions |
| **3.2.2 On Input** | No automatic change | Settings require confirmation |
| **3.3.1 Error Identification** | Clear errors | Form errors are described |
| **3.3.2 Labels or Instructions** | Clear labels | All inputs have labels |
| **3.3.3 Error Suggestion** | Fix suggestions | Validation errors suggest fixes |
| **3.3.4 Error Prevention** | Confirmation | Destructive actions require confirm |
| **4.1.1 Parsing** | Valid HTML | No markup errors |
| **4.1.2 Name, Role, Value** | ARIA attributes | All dynamic content has ARIA |
| **4.1.3 Status Messages** | Live regions | Errors and updates announced |

**Screen Reader Support:**
- ✅ Announce view changes (e.g., "Month view, February 2025")
- ✅ Announce event details on focus
- ✅ Announce drag-and-drop operations
- ✅ Live region for filter results count
- ✅ Hidden text for icon-only buttons

**Keyboard Navigation:**
- ✅ Arrow keys for date navigation
- ✅ Home/End for first/last day of week
- ✅ Page Up/Down for month navigation
- ✅ Enter/Space to activate events
- ✅ Escape to close dialogs
- ✅ Tab/Shift+Tab for focus traversal
- ✅ Shortcuts: N (today), M/W/D/L (views), F (filter focus), / (search focus)

### 3.3 Internationalization Requirements

**Supported Languages:**
- English (en) - Primary
- French (fr) - Secondary
- Spanish (es) - Future
- German (de) - Future
- Japanese (ja) - Future
- RTL languages (ar, he) - Future

**Translation Files:**
```
apps/frontend/src/shared/i18n/locales/
├── en/
│   ├── calendar.json           # Calendar-specific
│   ├── calendar-events.json    # Event types and statuses
│   ├── calendar-filters.json   # Filter labels
│   └── calendar-dialogs.json   # Dialog strings
├── fr/
│   ├── calendar.json
│   ├── calendar-events.json
│   ├── calendar-filters.json
│   └── calendar-dialogs.json
```

**Locale-Specific Formatting:**
- ✅ Date format: locale-aware (date-fns with `locale` parameter)
- ✅ Time format: 12h vs 24h based on locale
- ✅ First day of week: Sunday (US), Monday (EU), Saturday (some regions)
- ✅ Number formatting: thousand separators, decimals
- ✅ Currency: For budget fields (if added)
- ✅ Text direction: LTR vs RTL support

**Translation Keys Pattern:**
```jsonc
{
  "calendar": {
    "views": {
      "month": "Month",
      "week": "Week"
    },
    "events": {
      "type": {
        "campaign": "Campaign",
        "content": "Content"
      },
      "status": {
        "draft": "Draft",
        "scheduled": "Scheduled"
      }
    },
    "actions": {
      "createEvent": "Create Event",
      "deleteEvent": "Delete Event"
    },
    "messages": {
      "eventCreated": "Event created successfully",
      "confirmDelete": "Are you sure you want to delete this event?"
    }
  }
}
```

### 3.4 API Integration Requirements

**Internal IPC Channels:**

| Channel | Purpose | Request | Response |
|---------|---------|---------|----------|
| `calendar:get-data` | Load all events | `projectId: string` | `CalendarEvent[]` |
| `calendar:save-event` | Create/update event | `event: CalendarEvent` | `event: CalendarEvent` |
| `calendar:delete-event` | Delete event | `eventId: string` | `success: boolean` |
| `calendar:bulk-delete` | Delete multiple | `eventIds: string[]` | `deleted: number` |
| `calendar:sync-roadmap` | Import from roadmap | `projectId: string` | `CalendarEvent[]` |
| `calendar:scan-files` | Scan for TODOs | `projectId: string` | `CalendarEvent[]` |
| `calendar:search` | Full-text search | `query: string` | `CalendarEvent[]` |
| `calendar:get-filter-presets` | Load presets | `projectId: string` | `FilterPreset[]` |
| `calendar:save-filter-preset` | Save preset | `preset: FilterPreset` | `preset: FilterPreset` |

**External Calendar Integrations:**

| Provider | API | Features | Priority |
|----------|-----|----------|----------|
| Google Calendar | Google Calendar API | Bi-directional sync | P0 |
| Outlook | Microsoft Graph API | Bi-directional sync | P0 |
| iCloud | CalDAV | Read-only sync | P1 |
| Exchange Web Services | EWS | Read-only sync | P2 |

**Sync Behavior:**
- ✅ Manual sync (user-triggered)
- ✅ Auto-sync (configurable frequency: hourly, daily, weekly)
- ✅ Conflict resolution (local wins, remote wins, ask user)
- ✅ Sync status indicators
- ✅ Incremental sync (only changed events)
- ✅ Background sync with service worker

**Error Handling:**
- ✅ Network errors retry with exponential backoff
- ✅ Authentication errors trigger re-auth flow
- ✅ Rate limiting handled with delays
- ✅ Sync failures visible in UI
- ✅ Offline mode with IndexedDB cache

### 3.5 Data Persistence Requirements

**Storage Strategy:**

| Data Type | Storage | Format | Sync |
|-----------|---------|--------|------|
| Calendar events | File + IndexedDB | JSON | IPC to main |
| Filter presets | File + IndexedDB | JSON | IPC to main |
| View preferences | localStorage | JSON | Local only |
| External auth | secureStorage (OS) | Encrypted | IPC to main |

**File Storage:**
- Location: `{projectPath}/.auto-claude/calendar/events.json`
- Format: JSON with ISO 8601 dates
- Backup: Auto-backup on save (`.bak` files)
- Migration: Version field for schema migrations

**IndexedDB Cache:**
- Database: `CalendarCache`
- Stores: `events`, `presets`, `external-events`
- Indexes: `startDate`, `type`, `status`, `assigneeId`
- Sync strategy: Write-through cache

**Data Validation:**
- ✅ Zod schemas for all data types
- ✅ Validate on IPC receive
- ✅ Validate before file write
- ✅ Sanitize user inputs (XSS prevention)

---

## Part 4: Integration and Dependencies

### 4.1 Internal Dependencies

| Dependency | Type | Purpose | Version |
|------------|------|---------|---------|
| `@dnd-kit/core` | Library | Drag-and-drop | ^7.0.0 |
| `@dnd-kit/sortable` | Library | List drag-and-drop | ^8.0.0 |
| `date-fns` | Library | Date operations | ^3.0.0 |
| `zustand` | Library | State management | ^4.0.0 |
| `react-i18next` | Library | Internationalization | ^14.0.0 |
| `zod` | Library | Schema validation | ^3.0.0 |
| `motion` | Library | Animations | ^11.0.0 |
| `lucide-react` | Library | Icons | ^0.400.0 |
| `roadmap` | Feature | Roadmap integration | Internal |
| `project-store` | Module | Project state | Internal |
| `electronAPI` | API | IPC communication | Internal |

### 4.2 External Dependencies (Future)

| Dependency | Type | Purpose | Priority |
|------------|------|---------|----------|
| `@googleapis/calendar` | API | Google Calendar sync | P0 |
| `@microsoft/microsoft-graph-client` | API | Outlook sync | P0 |
| `react-virtuoso` | Library | List virtualization | P0 |
| `ical.js` | Library | iCal parsing | P1 |
| `dav` | Library | CalDAV client | P1 |

### 4.3 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐      ┌──────────────┐      ┌────────────┐ │
│  │ Month/Week  │      │   Day/Timeline│     │   List     │ │
│  │   Views     │──────▶│    Views     │──────▶│   View    │ │
│  └─────────────┘      └──────────────┘      └────────────┘ │
│         │                       │                     │     │
│         └───────────────────────┴─────────────────────┘     │
│                              ▼                               │
│                    ┌─────────────────┐                       │
│                    │ CalendarStore   │                       │
│                    │   (Zustand)     │                       │
│                    └────────┬────────┘                       │
│                             │                                │
│                             ▼                                │
│                    ┌─────────────────┐                       │
│                    │  CalendarAPI    │                       │
│                    │  (fetch layer)  │                       │
│                    └────────┬────────┘                       │
└────────────────────────────┼────────────────────────────────┘
                             │
                         ┌───▼─────────────────┐
                         │   IPC Bridge        │
                         │ (preload layer)     │
                         └───┬─────────────────┘
┌────────────────────────────┼────────────────────────────────┐
│                         Main Process│                        │
├────────────────────────────┼────────────────────────────────┤
│                             ▼                                │
│                    ┌─────────────────┐                       │
│                    │ IPC Handlers    │                       │
│                    │ (validation)    │                       │
│                    └────────┬────────┘                       │
│                             │                                │
│                             ▼                                │
│                    ┌─────────────────┐                       │
│                    │ CalendarFile    │                       │
│                    │ (.json storage) │                       │
│                    └─────────────────┘                       │
│                                                               │
│                             │                                │
│                             ▼                                │
│                    ┌─────────────────┐                       │
│                    │ External APIs   │                       │
│                    │ (Google/Outlook)│                       │
│                    └─────────────────┘                       │
└───────────────────────────────────────────────────────────────┘
```

---

## Part 5: Recommendations

### 5.1 Immediate Actions (For TASK-003: Core Data Layer)

1. **Merge the two calendar stores** into a unified `CalendarStore`
   - Use `CalendarEvent` interface (combines best of both)
   - Implement IPC persistence from legacy store
   - Keep Zustand for state management
   - Add loading and error states

2. **Create unified types** in `shared/types/calendar/`
   - `event.ts` - Core event types
   - `view.ts` - View configuration types
   - `filter.ts` - Filter and sort types
   - `external.ts` - External calendar types

3. **Implement proper API layer** in `renderer/api/calendar.ts`
   - Wrapper functions for all IPC calls
   - Error handling with retry logic
   - Optimistic updates with rollback
   - Request deduplication

4. **Add comprehensive validation** with Zod schemas
   - Validate all IPC responses
   - Validate before file write
   - Validate user inputs in forms
   - Sanitize to prevent XSS

### 5.2 Medium-term Actions (For TASK-004 through TASK-009)

1. **Implement virtualization** for large datasets
   - Use `react-virtuoso` for list view
   - Implement windowing for month view (200+ events)
   - Lazy load event details

2. **Add comprehensive error handling**
   - Error boundaries for React components
   - User-friendly error messages (i18n)
   - Retry mechanisms with backoff
   - Error reporting/analytics

3. **Implement caching strategy**
   - IndexedDB for offline access
   - Service worker for assets
   - Stale-while-revalidate for data
   - Cache invalidation on mutations

4. **Add keyboard navigation**
   - Arrow keys for navigation
   - Shortcuts for common actions
   - Focus management in dialogs
   - Visible focus indicators

### 5.3 Long-term Actions (For TASK-010 through TASK-012)

1. **Full WCAG 2.1 AA compliance**
   - ARIA labels on all interactive elements
   - Screen reader testing
   - Keyboard-only navigation testing
   - Color contrast audit

2. **Complete internationalization**
   - Translate all UI strings
   - RTL language support
   - Locale-aware formatting
   - Cultural preferences (week start, etc.)

3. **External calendar integrations**
   - Google Calendar API
   - Microsoft Graph API
   - CalDAV support
   - Bi-directional sync

4. **Comprehensive testing**
   - Unit tests (80%+ coverage)
   - Integration tests for workflows
   - E2E tests with Playwright
   - Accessibility tests
   - Performance benchmarks

---

## Part 6: Success Criteria

### 6.1 Functional Requirements

- [x] ✅ Complete audit of existing code (this document)
- [x] ✅ Unified data model defined
- [x] ✅ Technical requirements documented
- [ ] ⏳ Data layer implemented (TASK-003)
- [ ] ⏳ UI components built (TASK-004/005/006)
- [ ] ⏳ CRUD operations working (TASK-007)
- [ ] ⏳ Collaborative features added (TASK-008)
- [ ] ⏳ Performance optimized (TASK-009)
- [ ] ⏳ Accessibility compliant (TASK-010)
- [ ] ⏳ Fully tested (TASK-011)
- [ ] ⏳ Documented (TASK-012)

### 6.2 Non-Functional Requirements

| Category | Metric | Target |
|----------|--------|--------|
| **Performance** | Page load | < 500ms (1000+ events) |
| **Performance** | View switch | < 200ms |
| **Performance** | Filter apply | < 100ms |
| **Accessibility** | WCAG Level | AA |
| **Accessibility** | Keyboard nav | 100% coverage |
| **i18n** | Languages | 2+ (English, French) |
| **i18n** | Translation | 100% coverage |
| **Testing** | Unit tests | 80%+ coverage |
| **Testing** | E2E tests | All critical paths |
| **Reliability** | Data loss | 0 scenarios |
| **Reliability** | Error recovery | Graceful |

### 6.3 Quality Gates

**Before TASK-003 Implementation:**
- ✅ Requirements approved by stakeholders
- ✅ Data models reviewed
- ✅ Technical approach validated

**Before TASK-004 UI Build:**
- ⏳ Data layer unit tests passing
- ⏳ IPC handlers fully functional
- ⏳ Sample data populated

**Before TASK-011 Testing:**
- ⏳ All features implemented
- ⏳ Manual testing completed
- ⏳ Accessibility audit passed

**Before TASK-012 Documentation:**
- ⏳ All tests passing
- ⏳ Performance benchmarks met
- ⏳ No critical bugs remaining

---

## Appendix A: File Structure (Proposed)

```
apps/frontend/src/
├── shared/
│   ├── types/
│   │   └── calendar/
│   │       ├── event.ts          # CalendarEvent, RecurrenceRule
│   │       ├── view.ts           # View types, ViewConfig
│   │       ├── filter.ts         # Filter types, SortOptions
│   │       ├── external.ts       # External calendar types
│   │       └── index.ts          # Barrels
│   ├── constants/
│   │   └── calendar/
│   │       ├── colors.ts         # Event type colors
│   │       ├── defaults.ts       # Default configs
│   │       └── index.ts
│   ├── utils/
│   │   └── calendar/
│   │       ├── date-utils.ts     # Date operations
│   │       ├── event-utils.ts    # Event calculations
│   │       ├── filter-utils.ts   # Filter logic
│   │       └── index.ts
│   └── i18n/
│       └── locales/
│           ├── en/
│           │   ├── calendar.json
│           │   └── calendar-events.json
│           └── fr/
│               ├── calendar.json
│               └── calendar-events.json
├── renderer/
│   ├── api/
│   │   └── calendar.ts           # IPC wrapper functions
│   ├── stores/
│   │   └── calendarStore.ts      # Unified Zustand store
│   └── features/
│       └── content-calendar/
│           ├── index.ts
│           ├── ContentCalendar.tsx
│           ├── views/
│           │   ├── MonthView.tsx
│           │   ├── WeekView.tsx
│           │   ├── DayView.tsx
│           │   ├── ListView.tsx
│           │   ├── TimelineView.tsx
│           │   └── AgendaView.tsx
│           ├── components/
│           │   ├── CalendarHeader.tsx
│           │   ├── CalendarGrid.tsx
│           │   ├── EventCard.tsx
│           │   ├── EventModal.tsx
│           │   ├── FilterBar.tsx
│           │   ├── SearchBar.tsx
│           │   └── ConflictDialog.tsx
│           └── hooks/
│               ├── useCalendarEvents.ts
│               ├── useCalendarFilters.ts
│               ├── useCalendarView.ts
│               └── useEventDragDrop.ts
└── main/
    └── ipc-handlers/
        └── calendar-handlers.ts   # IPC handlers
```

---

## Appendix B: Migration Strategy

### Phase 1: Consolidation (TASK-003)
1. Create unified `CalendarEvent` interface
2. Implement new `calendarStore.ts` with IPC persistence
3. Migrate existing data to new format
4. Deprecate old stores (keep for compatibility)

### Phase 2: UI Refactor (TASK-004/005/006)
1. Rebuild view components with new types
2. Add proper error/loading states
3. Implement keyboard navigation
4. Add ARIA labels

### Phase 3: Feature Complete (TASK-007/008)
1. Implement CRUD operations
2. Add collaboration features
3. Implement external sync
4. Add automation rules

### Phase 4: Polish (TASK-009/010)
1. Performance optimization
2. Accessibility audit
3. Internationalization
4. Final testing

### Phase 5: Launch (TASK-012)
1. Documentation
2. Migration guide
3. Deployment
4. Post-launch monitoring

---

**Document Status:** ✅ Complete
**Next Action:** Proceed to TASK-002 (Design New UI/UX) or TASK-003 (Implement Core Data Layer)
