# Tour Timeline Component - Integration Guide

## Overview

The Tour Timeline component is a horizontal scrolling calendar view designed for displaying Tour campaigns (sports events, concerts, festivals, championships, etc.) with an intuitive timeline interface.

## Files Created

1. **Mock Data**: `apps/frontend/src/renderer/data/mockTourCampaigns.ts`
   - Contains 12 mock Tour campaigns based on major sporting events
   - Includes helper functions for filtering campaigns by date range, category, and year
   - Defines tour category types and configurations

2. **Component**: `apps/frontend/src/renderer/features/content-calendar/TourTimelineView.tsx`
   - Horizontal timeline component with zoom levels (month/quarter/year)
   - Filter by category, search, and year
   - Campaign detail panel with full event information
   - Today indicator
   - Responsive design with tooltips

3. **Translations**: `apps/frontend/src/shared/i18n/locales/en/content-calendar.json` (updated)
   - Added translation keys for the Tour Timeline component

## Quick Start

### Option 1: Standalone Usage

```tsx
import { TourTimelineView } from './features/content-calendar/TourTimelineView';

function MyComponent() {
  return (
    <div className="h-screen">
      <TourTimelineView />
    </div>
  );
}
```

### Option 2: Integration with Content Calendar

#### Step 1: Update Calendar View Types

Edit `apps/frontend/src/shared/types/content-calendar.ts`:

```typescript
export type CalendarView = 'month' | 'week' | 'day' | 'list' | 'tour-timeline';
```

#### Step 2: Update Calendar Views Constant

Edit `apps/frontend/src/shared/constants/content-calendar.ts`:

```typescript
export const CALENDAR_VIEWS = [
  { id: 'month', label: 'Month', icon: 'Calendar' },
  { id: 'week', label: 'Week', icon: 'CalendarDays' },
  { id: 'day', label: 'Day', icon: 'CalendarClock' },
  { id: 'list', label: 'List', icon: 'List' },
  { id: 'tour-timeline', label: 'Tour Timeline', icon: 'Timeline' } // Add this
] as const;
```

#### Step 3: Update ContentCalendar Component

Edit `apps/frontend/src/renderer/features/content-calendar/ContentCalendar.tsx`:

```tsx
import { TourTimelineView } from './TourTimelineView';
import { MOCK_TOUR_CAMPAIGNS } from '../../data/mockTourCampaigns';

// In the component, add a new case for tour-timeline view:
{currentView === 'tour-timeline' && (
  <TourTimelineView
    campaigns={MOCK_TOUR_CAMPAIGNS}
    onCampaignClick={(campaign) => setSelectedCampaign(campaign)}
  />
)}
```

#### Step 4: Update Translations

The translation keys have already been added to:
`apps/frontend/src/shared/i18n/locales/en/content-calendar.json`

For French translations, add to `apps/frontend/src/shared/i18n/locales/fr/content-calendar.json`:

```json
{
  "tourTimeline": {
    "title": "Chronologie des Tournées",
    "dates": "Dates",
    "duration": "Durée",
    "location": "Lieu",
    "attendees": "Participants Attendus",
    "pricing": "Gamme de Prix des Billets",
    "organizer": "Organisme Organisateur",
    "visitWebsite": "Visiter le Site Web",
    "categories": {
      "sports-event": "Événement Sportif",
      "concert-tour": "Tournée de Concert",
      "festival": "Festival",
      "exhibition": "Exposition",
      "championship": "Championnat",
      "olympics": "Jeux Olympiques"
    }
  }
}
```

## Component Props

```typescript
interface TourTimelineViewProps {
  campaigns?: TourCampaign[];      // Campaign data (defaults to mock data)
  onCampaignClick?: (campaign: TourCampaign) => void;  // Click handler
  initialZoomLevel?: 'month' | 'quarter' | 'year';     // Initial zoom (default: 'quarter')
  showFilters?: boolean;            // Show filter bar (default: true)
}
```

## Tour Campaign Data Structure

```typescript
interface TourCampaign extends ContentCampaign {
  category: TourCampaignCategory;   // Event category
  venue?: string;                    // Venue name
  location?: string;                 // City, country
  expectedAttendees?: number;        // Expected attendance
  ticketPriceRange?: string;         // Price range (e.g., "$50 - $500")
  website?: string;                  // Event website
  organizingBody?: string;           // Organization name
}

type TourCampaignCategory =
  | 'sports-event'
  | 'concert-tour'
  | 'festival'
  | 'exhibition'
  | 'championship'
  | 'olympics';
```

## Features

### 1. Zoom Levels
- **Month**: Shows 12 months with daily campaign bars
- **Quarter**: Shows 8 quarters (2 years) with broader view
- **Year**: Shows 5 years with high-level overview

### 2. Filtering
- **Category Filter**: Filter by event type (sports, concerts, festivals, etc.)
- **Search**: Full-text search across title, description, location, and tags
- **Year Filter**: Filter campaigns by year

### 3. Navigation
- Previous/Next buttons for time navigation
- Today button to jump to current date
- Click on time period header to navigate

### 4. Campaign Display
- Horizontal bars spanning event duration
- Color-coded by category
- Status indicators (planned, in-progress, done)
- Duration badges for multi-day events
- Hover tooltips with event details

### 5. Detail Panel
- Slide-in panel with full campaign information
- Event dates and duration
- Location and venue details
- Expected attendees
- Ticket pricing
- Organizing body
- Website link
- Campaign tags

## Mock Data Included

The mock data includes these major events:

1. **FIH Pro League Hobart** (Feb 10-16, 2026)
2. **World Baseball Classic Tokyo** (Mar 4-10, 2026)
3. **FIFA World Cup Socceroos** (Jun 12-26, 2026)
4. **Rugby World Cup 2027 Australia** (Oct 1-30, 2027)
5. **LA28 Olympics** (Jul 12-30, 2028)
6. **Australian Open Tennis 2026** (Jan 12-26, 2026)
7. **Formula 1 Australian Grand Prix 2026** (Mar 20-22, 2026)
8. **ICC T20 World Cup 2026** (Oct 1-30, 2026)
9. **Taylor Swift | The Eras Tour - Australia** (Feb 20-28, 2026)
10. **AFL Grand Final 2026** (Sep 25, 2026)
11. **Sydney New Year's Eve 2026** (Dec 31, 2026 - Jan 1, 2027)
12. **Brisbane 2032 Olympics - Preliminary Events** (Apr 1 - Jun 30, 2027)

## Styling

The component uses:
- Tailwind CSS classes for styling
- Lucide React icons
- Framer Motion for animations
- ShadCN UI components (Button, Badge, Select, Tooltip)

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- High contrast color schemes
- Screen reader friendly

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires ES2020+ support
- Uses date-fns for date manipulation

## Dependencies

All dependencies are already installed in the project:
- `react` & `react-dom`
- `date-fns`
- `motion` (Framer Motion)
- `lucide-react`
- `react-i18next`
- ShadCN UI components

## Future Enhancements

Possible improvements:
1. Export to PDF/Image functionality
2. Drag and drop to reschedule campaigns
3. Multi-campaign selection
4. Bulk operations
5. Integration with external calendars (Google, Outlook)
6. Real-time updates from API
7. Conflict detection and resolution
8. Resource allocation view
9. Budget tracking visualization
10. Milestone markers on timeline

## Troubleshooting

### Campaigns not showing
- Check that campaign dates are within the visible timeline range
- Verify filters are not excluding all campaigns
- Ensure campaigns have valid `scheduledDate` values

### Timeline not rendering correctly
- Check that parent container has defined height
- Verify date-fns functions are working correctly
- Check browser console for errors

### Translations missing
- Verify translation keys exist in all locale files
- Check i18n configuration
- Ensure namespace is correctly referenced

## Support

For issues or questions:
1. Check the component code: `apps/frontend/src/renderer/features/content-calendar/TourTimelineView.tsx`
2. Review mock data: `apps/frontend/src/renderer/data/mockTourCampaigns.ts`
3. Check translations: `apps/frontend/src/shared/i18n/locales/en/content-calendar.json`
