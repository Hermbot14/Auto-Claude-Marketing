# Content Calendar Features

## Overview

The Content Calendar is a comprehensive calendar system for managing marketing campaigns, events, and tours. It supports multiple view modes including Month, Week, Day, List, and Tour Timeline.

## Features

### View Modes

#### 1. Month View
- Traditional calendar grid layout
- Displays campaigns for each day
- Drag-and-drop support for rescheduling
- Campaign limit indicators

#### 2. Week View
- Detailed single-week view
- Day-by-day campaign breakdown
- Vertical scrolling for multiple campaigns per day

#### 3. Day View
- Single day detailed view
- Full campaign details displayed
- Time-based scheduling

#### 4. List View
- Vertical list of all campaigns
- Sortable and filterable
- Compact display for quick scanning

#### 5. Tour Timeline View (NEW)
- Horizontal scrolling Gantt chart-style timeline
- Color-coded event categories
- Precise date-based positioning
- Zoom levels: Month, Quarter, Year

## Tour Timeline View

### Current Implementation (v1.0.0)

**Implemented Features:**
- ✅ Horizontal scrolling with fixed 150px columns
- ✅ Sticky header with time period labels
- ✅ Vertical grid lines for time boundaries
- ✅ Today indicator (red vertical line)
- ✅ Color-coded event categories with gradient backgrounds
- ✅ Category legend in header
- ✅ Campaign tooltips with full details
- ✅ Countdown badges showing time until event
- ✅ Status indicators (Planned, In Progress, Completed, Under Review)
- ✅ Zoom controls (Month, Quarter, Year views)
- ✅ Category and search filters
- ✅ Mock tour campaigns data

### Color Coding

| Category | Color | Icon | Gradient |
|----------|-------|------|----------|
| Sports Event | Blue | 🏅 Trophy | `#3b82f6 → #2563eb` |
| Concert Tour | Purple | 🎵 Music | `#a855f7 → #9333ea` |
| Festival | Pink | ✨ Sparkles | `#ec4899 → #db2777` |
| Exhibition | Orange | 🖼️ Gallery | `#f97316 → #ea580c` |
| Championship | Gold | 🏆 Medal | `#eab308 → #ca8a04` |
| Olympics | Emerald | 🔥 Flame | `#10b981 → #059669` |

### Known Issues & Future Improvements

**UI/UX Issues to Fix:**
1. **Campaign Overlap**: Events may visually overlap when they occur on similar dates
   - Current: Simple vertical stacking by index
   - Needed: Smart overlap detection and row distribution

2. **Campaign Width**: Very short events (1-2 days) may be difficult to click
   - Current: Minimum 0.5% width
   - Needed: Minimum pixel width (e.g., 20px) for better usability

3. **Vertical Scrolling**: With many events, the timeline becomes very tall
   - Current: No maximum height or virtualization
   - Needed: Virtual scrolling or pagination for large datasets

4. **Responsiveness**: Fixed 150px columns may not work well on smaller screens
   - Current: Fixed column width
   - Needed: Responsive column sizing or horizontal-only scroll on mobile

5. **Empty Space**: When campaigns are sparse, there's lots of empty vertical space
   - Current: Fixed 56px height per campaign
   - Needed: Dynamic row height or compact view option

**Enhancement Opportunities:**
1. **Drag-and-Drop**: Allow campaigns to be rescheduled by dragging
2. **Resize Handles**: Allow campaign duration to be adjusted by dragging edges
3. **Multi-Select**: Select multiple campaigns for bulk operations
4. **Export**: Export timeline view as image or PDF
5. **Print**: Print-friendly layout for timeline
6. **Timeline Zoom**: Zoom in/out beyond preset levels
7. **Date Markers**: Show important dates (holidays, milestones) on timeline
8. **Category Swimlanes**: Option to show categories as separate horizontal tracks

### Files

| File | Description |
|------|-------------|
| `ContentCalendar.tsx` | Main calendar container with view switching |
| `TourTimelineView.tsx` | Tour Timeline Gantt chart implementation |
| `MonthView.tsx` | Traditional month calendar grid |
| `WeekView.tsx` | Week view with day columns |
| `DayView.tsx` | Single day detailed view |
| `ListView.tsx` | Vertical list of campaigns |
| `CalendarHeader.tsx` | Calendar navigation and view selector |
| `CampaignCard.tsx` | Reusable campaign display component |
| `ContentCalendarStore.ts` | Zustand state management |
| `FilterBar.tsx` | Campaign filtering UI |
| `CampaignDialog.tsx` | Campaign create/edit dialog |
| `ConflictDialog.tsx` | Scheduling conflict resolution |

### Data Structure

**TourCampaign** extends `ContentCampaign` with:
- `category`: Event category (sports-event, concert-tour, etc.)
- `venue`: Event venue name
- `location`: Event location
- `expectedAttendees`: Expected attendance number
- `ticketPriceRange`: Ticket pricing information
- `website`: Event website URL
- `organizingBody`: Event organizer

### Mock Data

Located at `src/renderer/data/mockTourCampaigns.ts`:
- 12 sample events from 2026-2028
- Includes major sporting events, concerts, championships
- Real-world examples (Olympics, World Cup, Grand Slams, etc.)

## Internationalization

Translation namespaces:
- `contentCalendar`: Calendar-specific terms
- `common`: Shared labels and buttons

Translation files:
- `src/shared/i18n/locales/en/content-calendar.json`
- `src/shared/i18n/locales/fr/content-calendar.json`

## State Management

Uses Zustand (`ContentCalendarStore.ts`):
- `currentView`: Active calendar view
- `currentDate`: Currently displayed date
- `selectedCampaign`: Campaign detail panel state
- `filters`: Active filters (categories, search, etc.)
- `draggedCampaign`: Drag-and-drop state

## Development Notes

### Adding New Categories

1. Update `TourCampaignCategory` type in `mockTourCampaigns.ts`
2. Add category config to `TOUR_CATEGORY_CONFIG`
3. Update `getCategoryIcon()` mapping
4. Add color gradient in `getCategoryColor()`
5. Add translation keys in `content-calendar.json`

### Modifying Timeline Positioning

The `getCampaignPosition()` function calculates campaign positioning:
- `leftPercent`: (days from timeline start / total days) × 100
- `widthPercent`: (campaign duration / total days) × 100

Modify these calculations to adjust positioning behavior.

## Changelog

### v1.0.0 (2026-02-03)
- Initial Tour Timeline implementation
- Horizontal scrolling with fixed-width columns
- Color-coded event categories
- Zoom level controls (Month/Quarter/Year)
- Category filtering and search
- Mock data for 12 tour events
- Today indicator
- Campaign tooltips and countdown badges
