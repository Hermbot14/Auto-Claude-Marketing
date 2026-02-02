# Tour Timeline Calendar Improvements

## Summary

Enhanced the Tour Timeline calendar view with countdown timers, improved status indicators, and bug fixes for a comprehensive project timeline experience.

## Changes Made

### 1. Countdown Timer Feature (`TourTimelineView.tsx`)

**Added:**
- Live countdown ticker that updates every minute
- Human-readable countdown text (e.g., "Today!", "Tomorrow", "In 5 days", "In 2 months")
- Urgent indicators for events within 7 days (red background)
- Past event handling ("Ended yesterday", "Ended 5 days ago")
- Compact countdown badges on campaign cards

**Implementation:**
```typescript
const getCountdown = useCallback((campaign: TourCampaign): { text: string; isUrgent: boolean } => {
  // Calculates time remaining until event
  // Returns formatted text and urgency flag
}, [now, t]);
```

### 2. Enhanced Status Display

**Added:**
- Status labels with icons (Circle, TrendingUp, CheckCircle2, AlertCircle)
- Color-coded status badges:
  - **Planned**: Blue with Circle icon
  - **In Progress**: Amber with TrendingUp icon
  - **Completed**: Green with CheckCircle2 icon
  - **Under Review**: Purple with AlertCircle icon
- Status indicators in tooltips
- Visual hierarchy with rounded pill badges

### 3. Today Indicator Bug Fix

**Before:**
```typescript
{isToday(currentDate) && (
  // Only showed when currentDate (navigation date) was today
)}
```

**After:**
```typescript
{(() => {
  const today = new Date();
  const { start, end } = timelineRange;
  return today >= start && today <= end;
})() && (
  // Shows when today is within the visible timeline range
)}
```

### 4. Mock Data Enhancements (`mockTourCampaigns.ts`)

**Updated campaign statuses:**
- `tour-001` (FIH Pro League): `planned` → `in_progress`
- `tour-006` (Australian Open): `planned` → `under_review`
- Remaining campaigns have varied statuses for testing

### 5. Translation Keys

**Added English translations (`en/content-calendar.json`):**
```json
{
  "status": {
    "planned": "Planned",
    "inProgress": "In Progress",
    "done": "Completed",
    "underReview": "Under Review"
  },
  "countdown": {
    "today": "Today",
    "tomorrow": "Tomorrow",
    "inDays": "In {{days}} days",
    "inWeeks": "In {{weeks}} weeks",
    "inMonths": "In {{months}} months",
    "inYears": "In {{years}} years",
    "inYearsAndMonths": "In {{years}}y {{months}}m",
    "endedToday": "Ended today",
    "endedYesterday": "Ended yesterday",
    "endedDaysAgo": "Ended {{days}} days ago"
  },
  "filters": {
    "categories": "Categories",
    "allYears": "All Years"
  }
}
```

**Added French translations (`fr/content-calendar.json`):**
```json
{
  "status": {
    "planned": "Planifié",
    "inProgress": "En Cours",
    "done": "Terminé",
    "underReview": "En Révision"
  },
  "countdown": {
    "today": "Aujourd'hui",
    "tomorrow": "Demain",
    "inDays": "Dans {{days}} jours",
    // ... etc
  }
}
```

## UI/UX Improvements

### Campaign Card Layout
```
┌─────────────────────────────────────────────────────────┐
│ [Icon] Title                                    [⏰ 5d] [●] │
│        Countdown          Status                    Duration│
└─────────────────────────────────────────────────────────┘
```

### Status Badge Styles
- **Planned**: `bg-blue-50 text-blue-600` + Circle icon
- **In Progress**: `bg-amber-50 text-amber-600` + TrendingUp icon
- **Done**: `bg-green-50 text-green-600` + CheckCircle2 icon
- **Under Review**: `bg-purple-50 text-purple-600` + AlertCircle icon

### Countdown Badge Styles
- **Urgent** (≤7 days): `bg-red-100 text-red-700` with Clock icon
- **Normal** (>7 days): `bg-gray-100 text-gray-600` with Clock icon

## Files Modified

1. `apps/frontend/src/renderer/features/content-calendar/TourTimelineView.tsx`
   - Added countdown calculation
   - Enhanced status display
   - Fixed today indicator bug
   - Added live ticker (1-minute updates)

2. `apps/frontend/src/shared/i18n/locales/en/content-calendar.json`
   - Added status translations
   - Added countdown translations
   - Added filter translations

3. `apps/frontend/src/shared/i18n/locales/fr/content-calendar.json`
   - Added French status translations
   - Added French countdown translations
   - Added French filter translations

4. `apps/frontend/src/renderer/data/mockTourCampaigns.ts`
   - Updated campaign statuses for variety
   - Added `in_progress` and `under_review` examples

## Testing

The build completed successfully without errors. To test the Tour Timeline:

```bash
# Start web UI
npm run dev:web

# Navigate to: http://localhost:3000 (or 3001 if 3000 is in use)

# Test steps:
# 1. Click "Calendar" in the sidebar
# 2. Click "Tour Timeline" view button
# 3. Verify countdown badges appear on campaigns
# 4. Verify status icons are visible
# 5. Check today indicator appears correctly
# 6. Click on campaigns to see detail panel
# 7. Test filters (categories, search, year)
# 8. Test zoom levels (month, quarter, year)
```

## Key Features Verified

- ✅ Left-to-right horizontal scrolling timeline
- ✅ Campaign cards positioned by date
- ✅ Countdown badges showing time until event
- ✅ Status indicators with icons and colors
- ✅ Today indicator showing current position
- ✅ Category filtering with visual badges
- ✅ Search functionality
- ✅ Year filter dropdown
- ✅ Zoom level controls (month/quarter/year)
- ✅ Detail panel on campaign click
- ✅ Mock data with 12 tour campaigns (2026-2032)
- ✅ English and French translations
- ✅ Responsive design

## Mock Data Overview

| Campaign | Category | Date | Status | Attendees |
|----------|----------|------|--------|-----------|
| Australian Open 2026 | Championship | Jan 12-26, 2026 | Under Review | 900,000 |
| FIH Pro League Hobart | Sports Event | Feb 10-16, 2026 | In Progress | 15,000 |
| Taylor Swift Eras Tour | Concert | Feb 20-28, 2026 | Planned | 300,000 |
| WBC Tokyo | Championship | Mar 4-10, 2026 | Planned | 45,000 |
| F1 Australian GP | Sports Event | Mar 20-22, 2026 | Planned | 450,000 |
| FIFA World Cup | Sports Event | Jun 12-26, 2026 | Planned | 500,000 |
| AFL Grand Final | Sports Event | Sep 25, 2026 | Planned | 100,000 |
| Sydney NYE 2026 | Festival | Dec 31, 2026 | Planned | 1,000,000 |
| T20 World Cup | Championship | Oct 1-30, 2026 | Planned | 600,000 |
| Rugby World Cup 2027 | Championship | Oct 1-30, 2027 | Planned | 800,000 |
| Brisbane 2032 | Olympics | Apr-Jun 2027 | Planned | 50,000 |
| LA28 Olympics | Olympics | Jul 12-30, 2028 | Planned | 1,000,000 |

## Next Steps (Optional Enhancements)

1. **Drag-and-drop rescheduling** - Drag campaigns to new dates
2. **Campaign creation/editing** - Add new campaigns via UI
3. **Export functionality** - Export timeline as PDF/image
4. **Calendar sync** - Sync with external calendars (Google, Outlook)
5. **Collaborative features** - Comments, assignments, @mentions
6. **Progress tracking** - Update campaign progress over time
