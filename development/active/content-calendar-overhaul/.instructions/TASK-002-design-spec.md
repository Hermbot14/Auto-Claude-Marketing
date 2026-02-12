# TASK-002: Content Calendar UI/UX Design Specification

**Task ID:** TASK-002
**Title:** Design New UI/UX for Content Calendar
**Status:** In Progress
**Date:** 2026-02-05
**Author:** AI Agent (Claude)
**Version:** 1.0.0

---

## Table of Contents

1. [Design System](#1-design-system)
2. [Component Specifications](#2-component-specifications)
3. [View Specifications](#3-view-specifications)
4. [Interaction Patterns](#4-interaction-patterns)
5. [Responsive Design](#5-responsive-design)
6. [Accessibility Specifications](#6-accessibility-specifications)
7. [Animation and Transitions](#7-animation-and-transitions)

---

## 1. Design System

### 1.1 Color Palette

#### Event Type Colors (8 Types)

| Event Type | Primary Color | Background Gradient | Border Color | Text Color | Icon |
|------------|---------------|---------------------|--------------|------------|------|
| **Campaign** | `#7C3AED` (Purple 600) | `linear-gradient(135deg, #7C3AED, #A78BFA)` | `#6D28D9` (Purple 700) | `#FFFFFF` | Megaphone |
| **Content** | `#2563EB` (Blue 600) | `linear-gradient(135deg, #2563EB, #60A5FA)` | `#1D4ED8` (Blue 700) | `#FFFFFF` | FileText |
| **Social** | `#DB2777` (Pink 600) | `linear-gradient(135deg, #DB2777, #F472B6)` | `#BE185D` (Pink 700) | `#FFFFFF` | Share2 |
| **Email** | `#059669` (Emerald 600) | `linear-gradient(135deg, #059669, #34D399)` | `#047857` (Emerald 700) | `#FFFFFF` | Mail |
| **SEO** | `#D97706` (Amber 600) | `linear-gradient(135deg, #D97706, #FBBF24)` | `#B45309` (Amber 700) | `#FFFFFF` | Search |
| **Deadline** | `#DC2626` (Red 600) | `linear-gradient(135deg, #DC2626, #F87171)` | `#B91C1C` (Red 700) | `#FFFFFF` | AlertCircle |
| **Event** | `#4F46E5` (Indigo 600) | `linear-gradient(135deg, #4F46E5, #818CF8)` | `#4338CA` (Indigo 700) | `#FFFFFF` | Calendar |
| **Milestone** | `#0D9488` (Teal 600) | `linear-gradient(135deg, #0D9488, #2DD4BF)` | `#0F766E` (Teal 700) | `#FFFFFF` | Flag |

#### Status Colors (6 Statuses)

| Status | Background | Border | Text | Badge Style |
|--------|------------|--------|------|-------------|
| **Draft** | `#F3F4F6` (Gray 100) | `#D1D5DB` (Gray 300) | `#374151` (Gray 700) | Dashed border |
| **Scheduled** | `#DBEAFE` (Blue 100) | `#93C5FD` (Blue 300) | `#1E40AF` (Blue 800) | Solid border |
| **In Progress** | `#FEF3C7` (Amber 100) | `#FCD34D` (Amber 300) | `#92400E` (Amber 800) | Solid border |
| **Under Review** | `#E0E7FF` (Indigo 100) | `#A5B4FC` (Indigo 300) | `#3730A3` (Indigo 800) | Solid border |
| **Published** | `#D1FAE5` (Emerald 100) | `#6EE7B7` (Emerald 300) | `#065F46` (Emerald 800) | Solid border |
| **Cancelled** | `#FEE2E2` (Red 100) | `#FCA5A5` (Red 300) | `#991B1B` (Red 800) | Strikethrough text |

#### Priority Indicators

| Priority | Color | Icon | Visual Treatment |
|----------|-------|------|------------------|
| **Critical** | `#DC2626` (Red 600) | Double arrow up | Pulsing badge |
| **High** | `#EA580C` (Orange 600) | Arrow up | Solid badge |
| **Medium** | `#CA8A04` (Yellow 600) | Minus | Solid badge |
| **Low** | `#65A30D` (Lime 600) | Arrow down | Subtle badge |
| **None** | `#9CA3AF` (Gray 400) | - | No indicator |

#### UI Element Colors

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| **Background** | `#FFFFFF` | `#111827` (Gray 900) |
| **Surface** | `#F9FAFB` (Gray 50) | `#1F2937` (Gray 800) |
| **Border** | `#E5E7EB` (Gray 200) | `#374151` (Gray 700) |
| **Text Primary** | `#111827` (Gray 900) | `#F9FAFB` (Gray 50) |
| **Text Secondary** | `#6B7280` (Gray 500) | `#9CA3AF` (Gray 400) |
| **Text Muted** | `#9CA3AF` (Gray 400) | `#6B7280` (Gray 500) |
| **Focus Ring** | `#3B82F6` (Blue 500) | `#60A5FA` (Blue 400) |
| **Hover Overlay** | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.08)` |
| **Active Overlay** | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.12)` |

### 1.2 Typography

#### Font Families

```css
/* Primary font */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Monospace for dates/code */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Display headers (optional) */
--font-display: 'Cal Sans', 'Inter', sans-serif;
```

#### Type Scale

| Usage | Size | Weight | Line Height | Letter Spacing |
|-------|------|--------|-------------|----------------|
| **Display** | 32px / 2rem | 700 | 1.2 | -0.02em |
| **H1 - Page Title** | 28px / 1.75rem | 600 | 1.3 | -0.01em |
| **H2 - Section** | 20px / 1.25rem | 600 | 1.4 | 0 |
| **H3 - Subsection** | 16px / 1rem | 600 | 1.5 | 0 |
| **Body Large** | 15px / 0.9375rem | 400 | 1.6 | 0 |
| **Body** | 14px / 0.875rem | 400 | 1.5 | 0 |
| **Body Small** | 13px / 0.8125rem | 400 | 1.5 | 0 |
| **Caption** | 12px / 0.75rem | 400 | 1.4 | 0 |
| **Button** | 14px / 0.875rem | 500 | 1 | 0 |

#### Text Styles by Component

| Component | Style | Color |
|-----------|-------|-------|
| **Event Card Title** | Body Semibold (14px / 600) | Text Primary |
| **Event Card Date** | Caption (12px) | Text Secondary |
| **Navigation Label** | Body Small (13px) | Text Secondary |
| **Filter Label** | Body Small (13px / 500) | Text Secondary |
| **View Switcher** | Button (14px / 500) | Text Primary |
| **Day Number** | H3 (16px / 600) | Text Primary |
| **Current Day** | H3 (16px / 700) | Event (Solid) |

### 1.3 Spacing System

Based on 4px base unit:

| Token | Value | Usage |
|-------|-------|-------|
| `spacing-0` | 0 | None |
| `spacing-1` | 4px | Tight spacing |
| `spacing-2` | 8px | Compact spacing |
| `spacing-3` | 12px | Default spacing |
| `spacing-4` | 16px | Comfortable spacing |
| `spacing-5` | 20px | Section spacing |
| `spacing-6` | 24px | Large section spacing |
| `spacing-8` | 32px | Component separation |
| `spacing-10` | 40px | Page margins |
| `spacing-12` | 48px | Large margins |

**Component-Specific Spacing:**

- **Event Card Padding:** `spacing-2` (8px) all around
- **Grid Cell Padding:** `spacing-2` (8px) all around
- **Header Padding:** `spacing-4` (16px) horizontal, `spacing-3` (12px) vertical
- **Filter Panel Gap:** `spacing-3` (12px) between items
- **Navigation Buttons:** `spacing-2` (8px) between buttons

### 1.4 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Small elements, tags |
| `radius-md` | 6px | Default buttons, inputs |
| `radius-lg` | 8px | Cards, large buttons |
| `radius-xl` | 12px | Modals, panels |
| `radius-full` | 9999px | Pills, badges |

**Component-Specific Radius:**

- **Event Card:** `radius-md` (6px)
- **Filter Badge:** `radius-full` (pill)
- **View Switcher:** `radius-md` (6px)
- **Modal:** `radius-xl` (12px)
- **Day Cell (Current):** `radius-lg` (8px)

### 1.5 Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle elevation |
| `shadow-sm` | `0 1px 3px rgba(0,0,0,0.1)` | Cards, buttons |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | Dropdowns, tooltips |
| `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | Modals, panels |
| `shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.1)` | Elevated modals |

**Special Effects:**

- **Focus Ring:** `0 0 0 3px rgba(59, 130, 246, 0.4)` (Blue with opacity)
- **Drag Preview:** `shadow-lg` with rotation effect
- **Event Card Hover:** `shadow-sm` → `shadow-md` transition

### 1.6 Iconography

#### Icon Library

- **Primary:** Lucide React (consistent 24x24px stroke icons)
- **Sizing:** 16px (small), 20px (default), 24px (large)

#### Icon Assignments

| Component | Icon | Size |
|-----------|------|------|
| **Navigation - Today** | `Calendar` | 20px |
| **Navigation - Previous** | `ChevronLeft` | 20px |
| **Navigation - Next** | `ChevronRight` | 20px |
| **View Switcher - Month** | `Calendar` | 18px |
| **View Switcher - Week** | `CalendarDays` | 18px |
| **View Switcher - Day** | `CalendarClock` | 18px |
| **View Switcher - List** | `List` | 18px |
| **View Switcher - Timeline** | `Timeline` | 18px |
| **View Switcher - Agenda** | `ScrollText` | 18px |
| **Filter - Funnel** | `Filter` | 16px |
| **Search** | `Search` | 16px |
| **Create Event** | `Plus` | 20px |
| **Edit** | `Pencil` | 16px |
| **Delete** | `Trash2` | 16px |
| **Drag Handle** | `GripVertical` | 16px |
| **Expand/Collapse** | `ChevronDown` / `ChevronRight` | 16px |
| **More Actions** | `MoreVertical` | 16px |
| **Close** | `X` | 20px |
| **Check** | `Check` | 16px |
| **Alert/Conflict** | `AlertTriangle` | 16px |

---

## 2. Component Specifications

### 2.1 EventCard Component

#### Purpose

Display calendar events in a compact, informative card format across all calendar views.

#### Visual Design

```
┌─────────────────────────────────────────────────────┐
│ [Type Icon] Event Title            [Priority] [More] │
│ 9:00 AM - 10:00 AM • [Status Badge]                 │
│ [Assignee Avatar] John D. • [Tag] [Tag]            │
└─────────────────────────────────────────────────────┘
```

#### States

| State | Visual Treatment |
|-------|------------------|
| **Default** | Solid color strip (4px left) + light background |
| **Hover** | Shadow elevation + border highlight |
| **Selected** | Blue ring (2px) + darker background |
| **Drag Preview** | `shadow-lg` + 2deg rotation + opacity 0.9 |
| **Disabled/Past** | Opacity 0.6 + grayscale |

#### Size Variants

| Variant | Height | Padding | Font Size |
|---------|--------|---------|-----------|
| **Compact** | 32px | 6px | 13px |
| **Default** | 48px | 8px | 14px |
| **Detailed** | 64px | 12px | 14px |

#### Component Structure

```tsx
<EventCard>
  <EventCard.Indicator />     // 4px color strip (left)
  <EventCard.Icon />          // Type icon (16px)
  <EventCard.Content>
    <EventCard.Title />       // Truncated with ellipsis
    <EventCard.Time />        // Date/time range
    <EventCard.Meta />        // Assignee, tags, status
  </EventCard.Content>
  <EventCard.Actions />       // Priority, more menu
</EventCard>
```

#### Props Interface

```typescript
interface EventCardProps {
  event: CalendarEvent;
  viewMode: CalendarViewMode;
  size?: 'compact' | 'default' | 'detailed';
  isDragging?: boolean;
  isSelected?: boolean;
  isPast?: boolean;
  onClick?: (event: CalendarEvent) => void;
  onDoubleClick?: (event: CalendarEvent) => void;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
  className?: string;
}
```

#### Accessibility

- **Role:** `button` (if clickable) or `article` (if display-only)
- **ARIA Label:** `"{title}, {type}, {date} at {time}, {status}"`
- **Tab Index:** `0` (interactive), `-1` (display)
- **Keyboard:** Enter/Space to activate

### 2.2 CalendarHeader Component

#### Purpose

Provide navigation, view switching, and global actions for the calendar.

#### Visual Design

```
┌──────────────────────────────────────────────────────────────────────┐
│ [<] February 2025 [>]                                               │
│                                                                      │
│ [Month] [Week] [Day] [List] [Timeline] [Agenda]                     │
│                                                                      │
│ [Search...] [Filter ▾] [+ New Event]          [Today] [Sync] [Menu] │
└──────────────────────────────────────────────────────────────────────┘
```

#### Layout

- **Height:** 120px (collapsed), 160px (expanded filters)
- **Padding:** 16px horizontal, 12px vertical
- **Gap:** 12px between sections

#### Component Structure

```tsx
<CalendarHeader>
  <CalendarHeader.Navigation>
    <CalendarHeader.PrevButton />
    <CalendarHeader.CurrentDateLabel />
    <CalendarHeader.NextButton />
  </CalendarHeader.Navigation>

  <CalendarHeader.ViewSwitcher>
    <ViewButton mode="month" />
    <ViewButton mode="week" />
    <ViewButton mode="day" />
    <ViewButton mode="list" />
    <ViewButton mode="timeline" />
    <ViewButton mode="agenda" />
  </CalendarHeader.ViewSwitcher>

  <CalendarHeader.Actions>
    <SearchInput />
    <FilterButton />
    <CreateEventButton />
    <TodayButton />
    <SyncButton />
    <MenuButton />
  </CalendarHeader.Actions>
</CalendarHeader>
```

#### View Switcher

| State | Style |
|-------|-------|
| **Active** | Solid primary color background + white text |
| **Inactive** | Transparent background + secondary text |
| **Hover** | Surface background |
| **Focus** | Focus ring (2px blue) |

#### Search Input

- **Width:** 240px (expanded), 40px (collapsed icon-only)
- **Placeholder:** "Search events..."
- **Debounce:** 300ms
- **Clear Button:** Shown when input has value

### 2.3 FilterPanel Component

#### Purpose

Provide comprehensive filtering options for calendar events.

#### Visual Design (Collapsible Sidebar)

```
┌────────────────────────────────────────────┐
│ Filters                              [×]   │
├────────────────────────────────────────────┤
│ Search                                    │
│ ┌──────────────────────────────────────┐  │
│ │ 🔍 Search events...                  │  │
│ └──────────────────────────────────────┘  │
│                                            │
│ Event Types                    [Clear All]│
│ ☑ Campaign (42)                           │
│ ☑ Content (128)                           │
│ ☐ Social (15)                             │
│ ☐ Email (8)                               │
│ [+ Show 4 more]                           │
│                                            │
│ Status                                    │
│ ◉ All  ○ Scheduled  ○ Published          │
│                                            │
│ Priority                                  │
│ ◉ All  ○ Critical  ○ High                │
│                                            │
│ Date Range                                │
│ ┌──────────────────────────────────────┐  │
│ │ From: [02/01/2025]  To: [02/28/2025]│  │
│ └──────────────────────────────────────┘  │
│                                            │
│ Assignees                                 │
│ ☑ John Doe                                │
│ ☐ Jane Smith                              │
│                                            │
│ Saved Filters                [+ New Preset]│
│ ○ My Events                               │
│ ○ This Week                               │
│ ○ Published Content                       │
│                                            │
│ [Reset All]                    [Apply]    │
└────────────────────────────────────────────┘
```

#### Layout

- **Width:** 280px (desktop), 320px (tablet)
- **Position:** Fixed left sidebar or drawer
- **Transition:** Slide-in from left (300ms ease)

#### Filter Sections

| Section | Control Type | Options |
|---------|--------------|---------|
| **Event Types** | Checkbox group | 8 event types with counts |
| **Status** | Radio buttons | All, Scheduled, Published, etc. |
| **Priority** | Radio buttons | All, Critical, High, Medium, Low |
| **Date Range** | Date picker | Start/end dates |
| **Assignees** | Checkbox group | User list with avatars |
| **Tags** | Multi-select | Tag search with suggestions |
| **Saved** | Preset buttons | User-saved combinations |

#### Filter Badge (Inline Display)

When filters are active, show badge in header:

```
┌──────────────────────────┐
│ Filters (3)            [×]│
│ • Campaign              │
│ • Scheduled             │
│ • This Week             │
└──────────────────────────┘
```

### 2.4 SearchBar Component

#### Purpose

Quick full-text search across all events with suggestions.

#### Visual Design

```
┌────────────────────────────────────────────────────────┐
│ 🔍 Search events...                            [Esc]   │
├────────────────────────────────────────────────────────┤
│ Recent Searches                                      │
│ • "blog post"                      [×]               │
│ • "email campaign"                 [×]               │
│                                                      │
│ Suggestions                                          │
│ • "blog post" in Content (12 results)                │
│ • "email campaign" in Email (3 results)              │
│                                                      │
│ Press Enter to see all 15 results                   │
└────────────────────────────────────────────────────────┘
```

#### Behavior

- **Debounce:** 300ms after typing stops
- **Min Characters:** 2 before searching
- **Max Results:** 10 in dropdown
- **Highlight:** Bold matching text in results
- **Keyboard:** Esc to close, Enter to select, Arrows to navigate

---

## 3. View Specifications

### 3.1 Month View

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│                   [<] February 2025 [>]                     │
├───────┬───────┬───────┬───────┬───────┬───────┬───────┤
│ Sun   │ Mon   │ Tue   │ Wed   │ Thu   │ Fri   │ Sat   │
├───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│ 26    │ 27    │ 28    │ 29    │ 30    │ 31    │  1    │
│       │       │       │       │       │       │ Event │
│       │       │       │       │       │       │ Card  │
├───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│  2    │  3    │  4    │  5 ◉  │  6    │  7    │  8    │
│ Event │       │ Event │Event  │ Event │       │       │
│ Card  │       │ Card  │ Card  │ Card  │       │       |
│       │       │ Event │       │ Event │       │       |
│       │       │ Card  │       │ Card  │       │       |
├───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│  9    │ 10    │ 11    │ 12    │ 13    │ 14    │ 15    │
│ ...   │ ...   │ ...   │ ...   │ ...   │ ...   │ ...   │
└───────┴───────┴───────┴───────┴───────┴───────┴───────┘
```

#### Grid Specifications

| Property | Value |
|----------|-------|
| **Columns** | 7 (Sunday - Saturday) |
| **Rows** | 5-6 (dynamic based on month) |
| **Cell Height** | 100px (desktop), 80px (tablet), 60px (mobile) |
| **Cell Gap** | 1px (border) |
| **Min Width** | 320px (mobile) |

#### Day Cell States

| State | Visual Treatment |
|-------|------------------|
| **Current Month** | White background |
| **Previous/Next Month** | 50% opacity + gray text |
| **Today** | Blue background (100) + bold text |
| **Selected** | Blue ring (2px) |
| **Hover** | Gray overlay (4%) |
| **Drag Over** | Dashed blue border + blue overlay (10%) |

#### Event Rendering

- **Max Visible:** 3 events + "N more" link
- **Overflow:** Click to show all events in popover
- **Multi-Day:** Spans across cells with rounded ends
- **All-Day:** Full width card at top of cell
- **Timed:** Colored bar on left edge with time label

### 3.2 Week View

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                      [<] Feb 2 - Feb 8, 2025 [>]                    │
├────────┬────────┬────────┬────────┬────────┬────────┬────────┐
│        │ Sun 2  │ Mon 3  │ Tue 4  │ Wed 5  │ Thu 6  │ Fri 7  │ Sat 8 │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│ All Day│ Event  │        │ Event  │        │ Event  │        │
│        │ Event  │        │ Event  │        │        │        │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│ 12 AM  │        │        │        │        │        │        │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│  1 AM  │        │        │        │        │        │        │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│  2 AM  │        │        │        │        │        │        │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│  3 AM  │        │        │        │        │        │        │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│  4 AM  │        │        │        │        │        │        │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│  5 AM  │        │        │        │        │        │        │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│  6 AM  │        │        │        │        │        │        │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│  7 AM  │        │        │        │        │        │        │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│  8 AM  │        │ Event  │        │        │        │        │
│        │        │────────│        │        │        │        │
│        │        │Meeting │        │        │        │        │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│  9 AM  │        │        │ Event  │        │        │        │
│        │        │        │────────│        │        │        │
│        │        │        │Standup │        │        │        │
└────────┴────────┴────────┴────────┴────────┴────────┴────────┘
```

#### Grid Specifications

| Property | Value |
|----------|-------|
| **Columns** | 8 (1 time label + 7 days) |
| **Time Slot Height** | 60px (30 min increments) |
| **Column Width** | Min 140px |
| **Scroll Range** | 00:00 - 23:59 |
| **Initial Scroll** | 08:00 (working hours) |

#### Time Slots

- **Major Lines:** Every hour (thick border)
- **Minor Lines:** 30-minute increments (thin border)
- **Current Time:** Red horizontal line + "Now" label
- **Working Hours:** Subtle background tint (8 AM - 6 PM)

#### Event Positioning

- **Top:** Calculated based on start time
- **Height:** Calculated based on duration
- **Width:** Column width - 16px (padding)
- **Overlap:** Side-by-side with minimum 40% width

### 3.3 Day View

#### Layout

Similar to Week View but with a single day column, providing more detail.

#### Grid Specifications

| Property | Value |
|----------|-------|
| **Columns** | 2 (1 time label + 1 day) |
| **Time Slot Height** | 80px (15 min increments) |
| **Column Width** | Remaining space |
| **Scroll Range** | 00:00 - 23:59 |
| **Initial Scroll** | Current time |

#### Enhanced Features

- **Expanded Event Cards:** Show description inline
- **Drag Handles:** Resize handles on top/bottom edges
- **Conflict Indicators:** Visual warning for overlapping events
- **Day Navigation:** Previous/Next day buttons

### 3.4 List View

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Filters: [Campaign ▾] [Scheduled ▾] [Sort: Date ▾]  [Grid] [List] │
├─────────────────────────────────────────────────────────────────────┤
│ ☑  │ [Type│ Campaign Launch                    │ Feb 5  │ [Actions]│
│     │      Icon] Status: Scheduled                │ 9:00 AM │          │
│     │       Assignee: John Doe                   │         │          │
├─────┼───────┼─────────────────────────────────────┼────────┼──────────┤
│ ☐  │ [Type│ Blog Post: SEO Tips                  │ Feb 6  │ [Actions]│
│     │      Icon] Status: In Progress              │ 2:00 PM │          │
│     │       Assignee: Jane Smith                  │         │          │
├─────┼───────┼─────────────────────────────────────┼────────┼──────────┤
│ ... │ ...   │ ...                                 │ ...    │ ...      │
└─────┴───────┴─────────────────────────────────────┴────────┴──────────┘
```

#### Grid Specifications

| Property | Value |
|----------|-------|
| **Row Height** | 64px (compact), 80px (default) |
| **Columns** | Select, Type, Title, Date, Actions |
| **Sortable:** | All columns except Select |
| **Virtualization:** | Required for 1000+ events |

#### Columns

| Column | Width | Sortable | Filterable |
|--------|-------|----------|------------|
| **Select** | 40px | No | No |
| **Type** | 48px | Yes | Yes |
| **Title** | Auto | Yes | Yes (text) |
| **Date** | 140px | Yes | Yes (range) |
| **Status** | 120px | Yes | Yes |
| **Assignee** | 140px | Yes | Yes |
| **Actions** | 48px | No | No |

#### Bulk Actions

- **Select All:** Checkbox in header
- **Bulk Delete:** Visible when 1+ selected
- **Bulk Status Change:** Dropdown menu
- **Bulk Export:** CSV, iCal formats

### 3.5 Timeline View

#### Layout (Gantt-Style)

```
┌─────────────────────────────────────────────────────────────────────┐
│ February 2025                            [Day ▾] [-] [+] [Reset]   │
├──────┬─────────────────────────────────────────────────────────────┤
│ Event│ Sun 1  Mon 2  Tue 3  Wed 4  Thu 5  Fri 6  Sat 7  Sun 8 ... │
├──────┼─────────────────────────────────────────────────────────────┤
│ E1   │ ████████████████████████████                              │
│      │ Campaign Launch                                             │
├──────┼─────────────────────────────────────────────────────────────┤
│ E2   │        █████████████████████                              │
│      │        Blog Post Series                                     │
├──────┼─────────────────────────────────────────────────────────────┤
│ E3   │              ████████████                                 │
│      │              Email Campaign                                │
└──────┴─────────────────────────────────────────────────────────────┘
```

#### Grid Specifications

| Property | Value |
|----------|-------|
| **Row Height** | 48px |
| **Day Width** | 40px (day), 20px (week zoom), 8px (month zoom) |
| **Header Height** | 40px |
| **Zoom Levels** | Day, Week, Month, Quarter |
| **Horizontal Scroll:** | Required for extended ranges |

#### Timeline Features

- **Zoom Controls:** - (zoom out), + (zoom in), Reset
- **Current Date:** Vertical red line
- **Dependencies:** Arrow lines between related events
- **Milestones:** Diamond-shaped markers
- **Progress:** Fill percentage based on status

### 3.6 Agenda View

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Agenda: February 2025                              [Past] [Upcoming]│
├─────────────────────────────────────────────────────────────────────┤
│ TODAY - Wednesday, February 5                                       │
│                                                                     │
│  9:00 AM  📢 Campaign Launch                          Scheduled    │
│           Status: Scheduled | Assignee: John Doe                   │
│                                                                     │
│  2:00 PM  📝 Blog Post Planning                        In Progress  │
│           Status: In Progress | Assignee: You                      │
│                                                                     │
│ TOMORROW - Thursday, February 6                                    │
│                                                                     │
│ 10:00 AM  ✉️ Email Newsletter Draft                     Draft       │
│           Status: Draft | Assignee: Jane Smith                     │
│                                                                     │
│  3:00 PM  📷 Social Media Shoot                         Scheduled    │
│           Status: Scheduled | Assignee: John Doe                   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Organization

- **Sections:** Today, Tomorrow, Next 7 Days, Future
- **Sorting:** Chronological within sections
- **Grouping:** Optional by type, status, or assignee
- **Empty States:** Friendly message + CTA button

---

## 4. Interaction Patterns

### 4.1 Navigation

#### Date Navigation

| Interaction | Behavior |
|-------------|----------|
| **Click Previous** | Navigate to previous period (month/week/day) |
| **Click Next** | Navigate to next period |
| **Click Today** | Jump to current date |
| **Click Date** | Switch to day view for that date |
| **Keyboard (Left/Right)** | Navigate by day |
| **Keyboard (Page Up/Down)** | Navigate by week |
| **Keyboard (Home/End)** | Jump to start/end of week |
| **Keyboard (N)** | Jump to today |

#### View Switching

- **Click View Button:** Switch to selected view with current date
- **Animation:** Cross-fade (200ms) between views
- **State Preservation:** Maintain scroll position when switching back

### 4.2 Event Interactions

#### Create Event

| Method | Trigger | Behavior |
|--------|---------|----------|
| **Button** | Click "+ New Event" | Open modal with current date/time |
| **Click Empty** | Click day cell | Open modal with clicked date |
| **Click Time** | Click time slot | Open modal with clicked time |
| **Drag** | Drag across time range | Open modal with selected range |

#### Edit Event

| Method | Trigger | Behavior |
|--------|---------|----------|
| **Double Click** | Double click event | Open edit modal |
| **Enter Key** | Press Enter on focused event | Open edit modal |
| **Context Menu** | Right click event | Show quick actions menu |
| **Edit Button** | Click pencil icon | Open edit modal |

#### Delete Event

| Method | Trigger | Behavior |
|--------|---------|----------|
| **Delete Key** | Press Delete on selected event | Show confirmation dialog |
| **Context Menu** | Right click → Delete | Show confirmation dialog |
| **Delete Button** | Click trash icon | Show confirmation dialog |

#### Drag and Drop

| Interaction | Visual Feedback | Behavior |
|-------------|-----------------|----------|
| **Drag Start** | `shadow-lg` + rotation | Create drag preview |
| **Drag Over** | Dashed border + overlay | Highlight drop target |
| **Invalid Drop** | Shake animation + red border | Revert to original position |
| **Valid Drop** | Snap animation | Update event date/time |
| **Escape** | Cancel drag | Revert to original position |

**Drag Modes:**

1. **Move:** Drag center of card → move to new time/date
2. **Resize:** Drag bottom edge → extend duration
3. **Copy:** Alt + drag → create copy at new location

### 4.3 Selection

| Interaction | Behavior |
|-------------|----------|
| **Click** | Select single event (blue ring) |
| **Shift + Click** | Select range of events |
| **Ctrl/Cmd + Click** | Toggle selection (multi-select) |
| **Ctrl/Cmd + A** | Select all visible events |
| **Escape** | Deselect all |

### 4.4 Filtering

#### Filter Application

| Trigger | Behavior |
|---------|----------|
| **Change Filter** | Update filtered list instantly |
| **Apply Button** | Commit filter changes |
| **Reset Button** | Clear all filters |
| **Saved Preset** | Load preset configuration |
| **Save Preset** | Store current filters |

#### Filter Persistence

- **Session:** Maintain filters during navigation
- **Local Storage:** Save filter preferences
- **URL Query:** Optional sync with URL params

### 4.5 Search

#### Search Behavior

| Action | Behavior |
|--------|----------|
| **Type** | Debounce 300ms, then search |
| **Press Enter** | Search immediately |
| **Press Esc** | Clear search, close dropdown |
| **Click Result** | Navigate to event date + select |
| **Click Suggestion** | Apply filter + show results |

#### Search Scope

- **Fields:** Title, description, notes, tags
- **Case:** Insensitive
- **Partial:** Match substrings
- **Fuzzy:** Allow 1-2 character errors

---

## 5. Responsive Design

### 5.1 Breakpoints

| Breakpoint | Width | Target | Layout Changes |
|------------|-------|--------|----------------|
| **Mobile** | 320px - 639px | Phones | Single column, stacked |
| **Tablet** | 640px - 1023px | Tablets | 2-column, modified |
| **Desktop** | 1024px - 1535px | Laptops | Full layout |
| **Wide** | 1536px+ | Desktops | Enhanced spacing |

### 5.2 Month View Responsiveness

| Breakpoint | Grid | Cell Height | Events Shown |
|------------|------|-------------|--------------|
| **Mobile** | 1-column (list) | N/A | All events |
| **Tablet** | 7-column | 80px | 2 + "N more" |
| **Desktop** | 7-column | 100px | 3 + "N more" |

### 5.3 Week/Day View Responsiveness

| Breakpoint | Layout | Time Labels |
|------------|--------|-------------|
| **Mobile** | Single day | Hidden (tap to see) |
| **Tablet** | 3-day | Abbreviated (8a, 9a) |
| **Desktop** | 7-day | Full (8:00 AM) |

### 5.4 Component Adaptations

#### Header

- **Mobile:** Hamburger menu, collapsible filters, icon-only buttons
- **Tablet:** Partial labels, grouped actions
- **Desktop:** Full labels, all actions visible

#### Filter Panel

- **Mobile:** Full-screen drawer, slide-over
- **Tablet:** 280px sidebar, collapsible
- **Desktop:** 280px sidebar, always visible

#### Event Cards

- **Mobile:** Full width, stacked details
- **Tablet:** Compact, inline details
- **Desktop:** Default, inline details

### 5.5 Touch Optimizations

| Element | Touch Target Size | Gesture Support |
|---------|-------------------|-----------------|
| **Buttons** | Min 44x44px | Tap |
| **Event Cards** | Min 44px height | Tap, Long press |
| **Drag Handles** | 44x44px | Drag |
| **Resize Handles** | 44px height | Drag |
| **Navigation** | 44px width | Swipe (optional) |

---

## 6. Accessibility Specifications

### 6.1 WCAG 2.1 AA Compliance

#### Color Contrast

| Element | Foreground | Background | Ratio | Pass |
|---------|------------|------------|-------|------|
| **Body Text** | `#111827` | `#FFFFFF` | 16.1:1 | ✅ |
| **Secondary Text** | `#6B7280` | `#FFFFFF` | 5.74:1 | ✅ |
| **Links** | `#2563EB` | `#FFFFFF` | 7.48:1 | ✅ |
| **Event Card (Purple)** | `#FFFFFF` | `#7C3AED` | 4.73:1 | ✅ |
| **Event Card (Pink)** | `#FFFFFF` | `#DB2777` | 4.54:1 | ✅ |
| **Disabled Text** | `#9CA3AF` | `#F9FAFB` | 3.14:1 | ⚠️ Use icon |

#### Keyboard Navigation

| Key | Function | Scope |
|-----|----------|-------|
| **Tab** | Navigate focusable elements | Global |
| **Shift + Tab** | Reverse navigation | Global |
| **Enter / Space** | Activate focused element | Global |
| **Escape** | Close modal, cancel drag | Global |
| **Arrow Keys** | Navigate grid, move selection | Contextual |
| **Page Up/Down** | Navigate by week | Calendar |
| **Home/End** | Jump to start/end of row | Calendar |
| **N** | Jump to today | Shortcut |
| **M/W/D/L** | Switch views | Shortcut |
| **F** | Focus search | Shortcut |
| **/** | Open search | Shortcut |

#### ARIA Labels

| Component | Role | Label | Live Region |
|-----------|------|-------|-------------|
| **Calendar Grid** | `grid` | "February 2025 calendar" | No |
| **Day Cell** | `gridcell` | "February 5, Wednesday" | No |
| **Event Card** | `button` | "Campaign Launch, February 5 at 9:00 AM" | No |
| **View Switcher** | `tablist` | "Calendar views" | No |
| **Filter Panel** | `dialog` | "Event filters" | No |
| **Search Results** | `listbox` | "Search results" | Yes (polite) |
| **Loading State** | `status` | "Loading events..." | Yes (polite) |
| **Error Message** | `alert` | "Failed to load events" | Yes (assertive) |

#### Focus Management

| Scenario | Focus Behavior |
|----------|----------------|
| **Open Modal** | Trap focus, move to first input |
| **Close Modal** | Return to trigger element |
| **Navigate Views** | Maintain focus on view switcher |
| **Delete Event** | Return to grid after confirmation |
| **Drag End** | Return focus to dragged element |

### 6.2 Screen Reader Support

#### Announcements

| Event | Announcement |
|-------|--------------|
| **View Change** | "Month view, February 2025" |
| **Navigate Date** | "February 5, 3 events" |
| **Select Event** | "Campaign Launch selected" |
| **Filter Change** | "Showing 12 of 45 events" |
| **Search Complete** | "Found 8 results for 'blog'" |
| **Drag Start** | "Moving Campaign Launch to February 6" |
| **Drag Complete** | "Moved to February 6 at 10:00 AM" |

#### Hidden Text

```tsx
// Icon-only buttons
<button aria-label="Previous month">
  <ChevronLeft />
  <span class="sr-only">Previous month</span>
</button>

// Event type indicators
<div role="img" aria-label="Campaign event">
  <Megaphone />
  <span class="sr-only">Campaign</span>
</div>

// Status badges
<span className="status-badge">
  <span className="sr-only">Status:</span>
  Scheduled
</span>
```

---

## 7. Animation and Transitions

### 7.1 Transition Durations

| Context | Duration | Easing |
|---------|----------|--------|
| **Hover** | 150ms | ease-out |
| **Focus Ring** | 200ms | ease-out |
| **Modal Open** | 200ms | ease-out |
| **View Switch** | 200ms | ease-in-out |
| **Drag Start** | 100ms | ease-out |
| **Drag End** | 200ms | ease-in-out |
| **Filter Panel** | 300ms | ease-in-out |
| **Page Load** | 300ms | ease-out |

### 7.2 Animations

#### Keyframe Animations

```css
/* Pulse for critical priority */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* Shake for invalid drop */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

/* Fade in for new events */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

#### Motion Preferences

- **Reduced Motion:** Respect `prefers-reduced-motion` media query
- **Fallback:** Instant transitions, no animations
- **Detection:** Check `window.matchMedia('(prefers-reduced-motion: reduce)')`

---

## 8. Edge Cases and Error States

### 8.1 Empty States

| Scenario | Message | Action |
|----------|---------|--------|
| **No Events** | "No events scheduled for this period" | "Create your first event" |
| **No Search Results** | "No events match '{query}'" | "Clear search" |
| **No Filter Results** | "No events match your filters" | "Reset filters" |
| **Offline Mode** | "You're offline. Showing cached events." | "Retry connection" |
| **Error Loading** | "Failed to load events" | "Retry" |

### 8.2 Loading States

| Component | Loading Indicator | Skeleton |
|-----------|-------------------|----------|
| **Calendar Grid** | Spinner in center | Gray cell placeholders |
| **Event Cards** | Shimmer effect | Gray rectangles |
| **Filter Panel** | Small spinners | Gray bars |
| **Modal** | Disabled state | N/A |

### 8.3 Error States

| Error | Visual Treatment | Action |
|-------|------------------|--------|
| **Network Error** | Red banner top + icon | "Retry" button |
| **Validation Error** | Red border + error text | "Fix" button |
| **Conflict Error** | Yellow warning banner | "Resolve" link |
| **Permission Error** | Lock icon + message | "Request access" |
| **Sync Error** | Orange badge on sync button | "View details" |

---

## 9. Deliverables Checklist

### Design Artifacts

- [x] Design system specification (colors, typography, spacing)
- [x] Component specifications (EventCard, Header, FilterPanel, SearchBar)
- [x] View specifications (Month, Week, Day, List, Timeline, Agenda)
- [x] Interaction patterns (navigation, CRUD, drag-and-drop, selection)
- [x] Responsive design specifications (breakpoints, adaptations)
- [x] Accessibility specifications (WCAG AA compliance, keyboard, screen reader)
- [x] Animation and transition specifications

### Next Steps

- [ ] Create detailed wireframes (TASK-002-wireframes.md)
- [ ] Design user flow diagrams
- [ ] Create state transition diagrams
- [ ] Document API integration points
- [ ] Create component hierarchy diagram

---

**Document Status:** ✅ Complete
**Next Action:** Create wireframes document (TASK-002-wireframes.md)
