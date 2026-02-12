/**
 * Calendar Test Utilities and Helpers
 * Provides reusable test data, factories, and helpers for calendar testing
 */

import type {
  CalendarData,
  CalendarItem,
  CalendarItemType,
  CalendarItemStatus,
  CalendarItemSource,
  CalendarFilters,
} from '../../shared/types';

// ============================================
// Test Data Factories
// ============================================

/**
 * Create a test calendar item with default values
 */
export function createTestCalendarItem(overrides: Partial<CalendarItem> = {}): CalendarItem {
  const now = new Date();
  const id = overrides.id || `item-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  return {
    id,
    title: 'Test Event',
    type: 'event',
    status: 'scheduled',
    source: 'manual',
    startDate: now,
    endDate: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour later
    allDay: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create multiple test calendar items
 */
export function createTestCalendarItems(
  count: number,
  overrides: Partial<CalendarItem> = {}
): CalendarItem[] {
  const items: CalendarItem[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + i);
    startDate.setHours(10, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setHours(11, 0, 0, 0);

    items.push(
      createTestCalendarItem({
        ...overrides,
        id: `item-${i}-${Date.now()}`,
        title: overrides.title || `Test Event ${i + 1}`,
        startDate,
        endDate,
      })
    );
  }

  return items;
}

/**
 * Create test calendar data with default values
 */
export function createTestCalendarData(overrides: Partial<CalendarData> = {}): CalendarData {
  const now = new Date();

  return {
    projectId: 'test-project',
    items: [],
    viewMode: 'month',
    zoomLevel: 'day',
    currentDate: now,
    filters: createDefaultFilters(),
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create default calendar filters
 */
export function createDefaultFilters(): CalendarFilters {
  return {
    itemTypes: [],
    status: [],
    sources: [],
    tags: [],
    searchQuery: '',
  };
}

/**
 * Create a populated calendar with sample data
 */
export function createPopulatedCalendar(
  itemCount: number = 10
): CalendarData {
  const items = createTestCalendarItems(itemCount);

  return createTestCalendarData({
    items,
  });
}

// ============================================
// Preset Test Data
// ============================================

/**
 * Get preset items of different types
 */
export function getPresetItemsByType(): Record<CalendarItemType, CalendarItem> {
  const now = new Date();

  return {
    campaign: createTestCalendarItem({
      id: 'campaign-1',
      title: 'Marketing Campaign Q3',
      type: 'campaign',
      status: 'scheduled',
      startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      tags: ['marketing', 'Q3'],
    }),
    content: createTestCalendarItem({
      id: 'content-1',
      title: 'Blog Post: AI in Marketing',
      type: 'content',
      status: 'draft',
      startDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
      tags: ['content', 'blog', 'AI'],
    }),
    social: createTestCalendarItem({
      id: 'social-1',
      title: 'Twitter Thread: Product Launch',
      type: 'social',
      status: 'published',
      startDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      tags: ['social', 'twitter', 'launch'],
    }),
    email: createTestCalendarItem({
      id: 'email-1',
      title: 'Newsletter: Monthly Updates',
      type: 'email',
      status: 'scheduled',
      startDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      tags: ['email', 'newsletter'],
    }),
    seo: createTestCalendarItem({
      id: 'seo-1',
      title: 'SEO Audit: Product Pages',
      type: 'seo',
      status: 'scheduled',
      startDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
      tags: ['seo', 'audit'],
    }),
    deadline: createTestCalendarItem({
      id: 'deadline-1',
      title: 'Campaign Submission Deadline',
      type: 'deadline',
      status: 'scheduled',
      priority: 'high',
      startDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      allDay: true,
      tags: ['deadline', 'critical'],
    }),
    event: createTestCalendarItem({
      id: 'event-1',
      title: 'Industry Conference 2024',
      type: 'event',
      status: 'scheduled',
      source: 'external',
      startDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000),
      location: 'San Francisco, CA',
      tags: ['event', 'conference'],
    }),
  };
}

/**
 * Get preset items by status
 */
export function getPresetItemsByStatus(): Record<CalendarItemStatus, CalendarItem> {
  return {
    draft: createTestCalendarItem({
      id: 'draft-1',
      title: 'Draft Campaign',
      status: 'draft',
    }),
    scheduled: createTestCalendarItem({
      id: 'scheduled-1',
      title: 'Scheduled Campaign',
      status: 'scheduled',
    }),
    published: createTestCalendarItem({
      id: 'published-1',
      title: 'Published Campaign',
      status: 'published',
    }),
    cancelled: createTestCalendarItem({
      id: 'cancelled-1',
      title: 'Cancelled Campaign',
      status: 'cancelled',
    }),
  };
}

/**
 * Get sample roadmap data for aggregation tests
 */
export function getSampleRoadmapData() {
  return {
    phases: [
      {
        id: 'phase-1',
        name: 'Q1 Marketing Push',
        description: 'Initial marketing campaign for Q1',
        status: 'completed',
        order: 1,
      },
      {
        id: 'phase-2',
        name: 'Q2 Product Launch',
        description: 'Product launch campaign',
        status: 'in-progress',
        order: 2,
      },
      {
        id: 'phase-3',
        name: 'Q3 Growth Campaign',
        description: 'Growth focused marketing initiatives',
        status: 'pending',
        order: 3,
      },
    ],
  };
}

// ============================================
// ICS Test Data
// ============================================

/**
 * Get sample ICS content for import tests
 */
export function getSampleICSContent(): string {
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
METHOD:PUBLISH
BEGIN:VEVENT
UID:event-1@example.com
SUMMARY:Sample Event
DESCRIPTION:This is a test event for calendar import
LOCATION:Test Location
DTSTART:20240615T100000Z
DTEND:20240615T110000Z
STATUS:CONFIRMED
PRIORITY:5
CATEGORIES:work,test
ATTENDEE:CN=John Doe:RSVP=TRUE
CREATED:20240601T080000Z
LAST-MODIFIED:20240610T090000Z
END:VEVENT
BEGIN:VEVENT
UID:event-2@example.com
SUMMARY:All Day Conference
DTSTART;VALUE=DATE:20240620
DTEND;VALUE=DATE:20240621
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
}

/**
 * Get sample ICS content with recurrence
 */
export function getRecurringICSContent(): string {
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:recurring-1@example.com
SUMMARY:Weekly Team Meeting
DTSTART:20240615T100000Z
DTEND:20240615T110000Z
RRULE:FREQ=WEEKLY;INTERVAL=1;COUNT=10
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
}

/**
 * Get malformed ICS content for error handling tests
 */
export function getMalformedICSContent(): string {
  return `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Event without UID
DTSTART:invalid-date
END:VEVENT
INVALID LINE HERE
END:VCALENDAR`;
}

// ============================================
// Filter Test Helpers
// ============================================

/**
 * Create filter presets for testing
 */
export const filterPresets = {
  allCampaigns: {
    itemTypes: ['campaign'] as CalendarItemType[],
  },
  publishedOnly: {
    status: ['published'] as CalendarItemStatus[],
  },
  roadmapSource: {
    sources: ['roadmap'] as CalendarItemSource[],
  },
  marketingTag: {
    tags: ['marketing'],
  },
  dateRangeThisWeek: {
    dateRange: {
      start: new Date(),
      end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  },
  searchCampaign: {
    searchQuery: 'campaign',
  },
  complex: {
    itemTypes: ['campaign', 'content'] as CalendarItemType[],
    status: ['scheduled', 'published'] as CalendarItemStatus[],
    tags: ['marketing', 'urgent'],
    searchQuery: 'launch',
  },
};

// ============================================
// Assertion Helpers
// ============================================

/**
 * Assert that two calendar items are equal
 */
export function expectCalendarItemsEqual(
  actual: CalendarItem,
  expected: CalendarItem
): void {
  expect(actual.id).toBe(expected.id);
  expect(actual.title).toBe(expected.title);
  expect(actual.type).toBe(expected.type);
  expect(actual.status).toBe(expected.status);
  expect(actual.source).toBe(expected.source);
  expect(actual.startDate).toEqual(expected.startDate);
  expect(actual.endDate).toEqual(expected.endDate);
  expect(actual.allDay).toBe(expected.allDay);
}

/**
 * Assert that calendar data structure is valid
 */
export function expectValidCalendarData(data: CalendarData): void {
  expect(data).toHaveProperty('projectId');
  expect(data).toHaveProperty('items');
  expect(data).toHaveProperty('viewMode');
  expect(data).toHaveProperty('zoomLevel');
  expect(data).toHaveProperty('currentDate');
  expect(data).toHaveProperty('filters');
  expect(data).toHaveProperty('updatedAt');

  expect(Array.isArray(data.items)).toBe(true);
  expect(['day', 'week', 'month']).toContain(data.viewMode);
  expect(['day', 'week', 'month', 'quarter']).toContain(data.zoomLevel);
  expect(data.currentDate).toBeInstanceOf(Date);
  expect(data.updatedAt).toBeInstanceOf(Date);
}

/**
 * Assert that calendar item structure is valid
 */
export function expectValidCalendarItem(item: CalendarItem): void {
  expect(item).toHaveProperty('id');
  expect(item).toHaveProperty('title');
  expect(item).toHaveProperty('type');
  expect(item).toHaveProperty('status');
  expect(item).toHaveProperty('source');
  expect(item).toHaveProperty('startDate');
  expect(item).toHaveProperty('createdAt');
  expect(item).toHaveProperty('updatedAt');

  expect(typeof item.id).toBe('string');
  expect(typeof item.title).toBe('string');
  expect(['campaign', 'content', 'social', 'email', 'seo', 'deadline', 'event']).toContain(item.type);
  expect(['draft', 'scheduled', 'published', 'cancelled']).toContain(item.status);
  expect(['roadmap', 'file', 'external', 'manual']).toContain(item.source);
  expect(item.startDate).toBeInstanceOf(Date);
  expect(item.createdAt).toBeInstanceOf(Date);
  expect(item.updatedAt).toBeInstanceOf(Date);
}

// ============================================
// Performance Test Helpers
// ============================================

/**
 * Create a large set of calendar items for performance testing
 */
export function createLargeCalendarData(
  itemCount: number = 1000
): CalendarData {
  const items: CalendarItem[] = [];
  const now = new Date();
  const types: CalendarItemType[] = ['campaign', 'content', 'social', 'email', 'seo', 'deadline', 'event'];
  const statuses: CalendarItemStatus[] = ['draft', 'scheduled', 'published', 'cancelled'];

  for (let i = 0; i < itemCount; i++) {
    const daysOffset = Math.floor(Math.random() * 365);
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + daysOffset);
    startDate.setHours(Math.floor(Math.random() * 24), 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + Math.floor(Math.random() * 8) + 1);

    items.push(
      createTestCalendarItem({
        id: `perf-item-${i}`,
        title: `Performance Test Item ${i}`,
        type: types[Math.floor(Math.random() * types.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        source: 'manual',
        startDate,
        endDate: Math.random() > 0.3 ? endDate : undefined,
        allDay: Math.random() > 0.8,
        tags: Math.random() > 0.5 ? [`tag-${Math.floor(Math.random() * 10)}`] : undefined,
      })
    );
  }

  return createTestCalendarData({ items });
}

/**
 * Measure execution time of a function
 */
export async function measureExecutionTime<T>(
  fn: () => T | Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  return { result, duration };
}

// ============================================
// Mock Helpers
// ============================================

/**
 * Create a mock window.electronAPI with calendar methods
 */
export function createMockElectronAPI() {
  return {
    getCalendarData: jest.fn(),
    saveCalendarData: jest.fn(),
    deleteCalendarData: jest.fn(),
    syncExternalCalendar: jest.fn(),
  };
}

/**
 * Create a mock calendar store state
 */
export function createMockCalendarStoreState() {
  return {
    calendarData: null,
    externalConnections: [],
    selectedItem: null,
    hoveredItem: null,
    isLoading: false,
    error: null,
    currentDate: new Date(),
    viewMode: 'month' as const,
    zoomLevel: 'day' as const,
    filters: createDefaultFilters(),
  };
}
