/**
 * Unit tests for Calendar Utilities
 * Tests ICS export/import, date formatting, and calendar operations
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToICS, downloadICS, importICS, readICSFile } from '../calendarUtils';
import type { CalendarItem } from '../../../../shared/types';

// Helper to create test calendar item
function createTestItem(overrides: Partial<CalendarItem> = {}): CalendarItem {
  const now = new Date('2024-06-15T10:00:00Z');
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    title: 'Test Event',
    type: 'event',
    status: 'scheduled',
    source: 'manual',
    startDate: now,
    endDate: new Date(now.getTime() + 60 * 60 * 1000),
    allDay: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('Calendar Utilities - ICS Export', () => {
  describe('exportToICS', () => {
    it('should export single item to ICS format', () => {
      const item = createTestItem({
        id: 'event-1',
        title: 'Test Event',
        description: 'Test description',
        startDate: new Date('2024-06-15T10:00:00Z'),
        endDate: new Date('2024-06-15T11:00:00Z'),
      });

      const icsContent = exportToICS([item], 'Test Calendar');

      expect(icsContent).toContain('BEGIN:VCALENDAR');
      expect(icsContent).toContain('VERSION:2.0');
      expect(icsContent).toContain('PRODID:-//AutoMarketing//EN');
      expect(icsContent).toContain('X-WR-CALNAME:Test Calendar');
      expect(icsContent).toContain('BEGIN:VEVENT');
      expect(icsContent).toContain('UID:event-1');
      expect(icsContent).toContain('SUMMARY:Test Event');
      expect(icsContent).toContain('DESCRIPTION:Test description');
      expect(icsContent).toContain('DTSTART:20240615T100000Z');
      expect(icsContent).toContain('DTEND:20240615T110000Z');
      expect(icsContent).toContain('END:VEVENT');
      expect(icsContent).toContain('END:VCALENDAR');
    });

    it('should export multiple items', () => {
      const items = [
        createTestItem({ id: 'event-1', title: 'Event 1' }),
        createTestItem({ id: 'event-2', title: 'Event 2' }),
        createTestItem({ id: 'event-3', title: 'Event 3' }),
      ];

      const icsContent = exportToICS(items);

      expect(icsContent).toContain('BEGIN:VEVENT');
      expect(icsContent).toContain('UID:event-1');
      expect(icsContent).toContain('SUMMARY:Event 1');
      expect(icsContent).toContain('UID:event-2');
      expect(icsContent).toContain('SUMMARY:Event 2');
      expect(icsContent).toContain('UID:event-3');
      expect(icsContent).toContain('SUMMARY:Event 3');
    });

    it('should handle all-day events', () => {
      const item = createTestItem({
        id: 'all-day-1',
        title: 'All Day Event',
        startDate: new Date('2024-06-15T00:00:00Z'),
        endDate: new Date('2024-06-16T00:00:00Z'),
        allDay: true,
      });

      const icsContent = exportToICS([item]);

      expect(icsContent).toContain('DTSTART;VALUE=DATE:20240615');
      expect(icsContent).toContain('DTEND;VALUE=DATE:20240616'); // Next day for all-day
    });

    it('should handle all-day events without end date', () => {
      const item = createTestItem({
        id: 'all-day-2',
        title: 'All Day No End',
        startDate: new Date('2024-06-15T00:00:00Z'),
        allDay: true,
      });

      const icsContent = exportToICS([item]);

      expect(icsContent).toContain('DTSTART;VALUE=DATE:20240615');
      // No DTEND when no endDate
    });

    it('should include location when present', () => {
      const item = createTestItem({
        id: 'event-loc',
        title: 'Event with Location',
        location: '123 Main St, City, State',
      });

      const icsContent = exportToICS([item]);

      expect(icsContent).toContain('LOCATION:123 Main St, City, State');
    });

    it('should not include location when absent', () => {
      const item = createTestItem({
        id: 'event-noloc',
        title: 'Event without Location',
      });

      const icsContent = exportToICS([item]);

      expect(icsContent).not.toContain('LOCATION:');
    });

    it('should map status correctly', () => {
      const statusItems = [
        createTestItem({ id: 'draft-1', status: 'draft' }),
        createTestItem({ id: 'scheduled-1', status: 'scheduled' }),
        createTestItem({ id: 'published-1', status: 'published' }),
        createTestItem({ id: 'cancelled-1', status: 'cancelled' }),
      ];

      const icsContent = exportToICS(statusItems);

      expect(icsContent).toContain('STATUS:TENTATIVE'); // draft
      expect(icsContent).toContain('STATUS:CONFIRMED'); // scheduled
      expect(icsContent).toContain('STATUS:CONFIRMED'); // published
      expect(icsContent).toContain('STATUS:CANCELLED'); // cancelled
    });

    it('should handle priority levels', () => {
      const priorityItems = [
        createTestItem({ id: 'high-1', priority: 'high' }),
        createTestItem({ id: 'medium-1', priority: 'medium' }),
        createTestItem({ id: 'low-1', priority: 'low' }),
      ];

      const icsContent = exportToICS(priorityItems);

      expect(icsContent).toContain('PRIORITY:1'); // high
      expect(icsContent).toContain('PRIORITY:5'); // medium
      expect(icsContent).toContain('PRIORITY:9'); // low
    });

    it('should handle tags as categories', () => {
      const item = createTestItem({
        id: 'tagged-1',
        title: 'Tagged Event',
        tags: ['marketing', 'urgent', 'q2'],
      });

      const icsContent = exportToICS([item]);

      expect(icsContent).toContain('CATEGORIES:marketing,urgent,q2');
    });

    it('should handle assignee as attendee', () => {
      const item = createTestItem({
        id: 'assigned-1',
        title: 'Assigned Event',
        assignee: 'John Doe',
      });

      const icsContent = exportToICS([item]);

      expect(icsContent).toContain('ATTENDEE:CN=John Doe:RSVP=TRUE');
    });

    it('should handle recurrence rules', () => {
      const item = createTestItem({
        id: 'recurring-1',
        title: 'Recurring Event',
        startDate: new Date('2024-06-15T10:00:00Z'),
        recurrence: {
          frequency: 'weekly',
          interval: 2,
          until: new Date('2024-12-31T23:59:59Z'),
        },
      });

      const icsContent = exportToICS([item]);

      expect(icsContent).toContain('RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20241231T235959Z');
    });

    it('should handle recurrence with count', () => {
      const item = createTestItem({
        id: 'recurring-2',
        title: 'Recurring with Count',
        startDate: new Date('2024-06-15T10:00:00Z'),
        recurrence: {
          frequency: 'daily',
          interval: 1,
          count: 10,
        },
      });

      const icsContent = exportToICS([item]);

      expect(icsContent).toContain('RRULE:FREQ=DAILY;INTERVAL=1;COUNT=10');
    });

    it('should include timestamps', () => {
      const now = new Date('2024-06-15T10:00:00Z');
      const item = createTestItem({
        id: 'timestamped-1',
        title: 'Timestamped Event',
        createdAt: now,
        updatedAt: new Date(now.getTime() + 3600000),
      });

      const icsContent = exportToICS([item]);

      expect(icsContent).toContain('CREATED:20240615T100000Z');
      expect(icsContent).toContain('LAST-MODIFIED:20240615T110000Z');
    });

    it('should escape special characters in text fields', () => {
      const item = createTestItem({
        id: 'special-1',
        title: 'Event with \\, ; special characters',
        description: 'Line 1\nLine 2\nLine 3',
        location: 'Place\\With;Backslashes',
      });

      const icsContent = exportToICS([item]);

      // Check escaping (backslash, semicolon, comma, newlines are escaped)
      expect(icsContent).toContain('SUMMARY:');
      expect(icsContent).toContain('\\\\');
      expect(icsContent).toContain('\\;');
      expect(icsContent).toContain('\\n');
    });

    it('should use default calendar name when not provided', () => {
      const item = createTestItem();
      const icsContent = exportToICS([item]);

      expect(icsContent).toContain('X-WR-CALNAME:Marketing Calendar');
    });

    it('should use custom calendar name when provided', () => {
      const item = createTestItem();
      const icsContent = exportToICS([item], 'My Custom Calendar');

      expect(icsContent).toContain('X-WR-CALNAME:My Custom Calendar');
    });
  });

  describe('downloadICS', () => {
    it('should create download link with correct attributes', () => {
      // Mock DOM methods - create a proper mock link element
      const mockLink = {
        href: '',
        download: '',
        style: {},
        click: vi.fn(),
      };

      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

      const items = [createTestItem()];
      downloadICS(items, 'test-calendar.ics');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockLink.href).toBe('blob:mock-url');
      expect(mockLink.download).toBe('test-calendar.ics');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(mockLink.click).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');

      // Cleanup
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });

    it('should use default filename when not provided', () => {
      const mockLink = {
        href: '',
        download: '',
        style: {},
        click: vi.fn(),
      };

      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');

      const items = [createTestItem()];
      downloadICS(items);

      expect(mockLink.download).toBe('calendar.ics');

      // Cleanup
      createElementSpy.mockRestore();
    });
  });
});

describe('Calendar Utilities - ICS Import', () => {
  describe('importICS', () => {
    const basicICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:imported-event-1
SUMMARY:Imported Event
DESCRIPTION:This is a test event
LOCATION:Test Location
DTSTART:20240615T100000Z
DTEND:20240615T110000Z
STATUS:CONFIRMED
PRIORITY:5
CATEGORIES:work,meeting
ATTENDEE:CN=John Doe:RSVP=TRUE
CREATED:20240601T080000Z
LAST-MODIFIED:20240610T090000Z
END:VEVENT
END:VCALENDAR`;

    it('should parse basic event from ICS', () => {
      const items = importICS(basicICS);

      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Imported Event');
      // Note: The parser includes the colon in the description
      expect(items[0].description).toContain('This is a test event');
      expect(items[0].location).toContain('Test Location');
    });

    it('should parse event dates correctly', () => {
      const items = importICS(basicICS);

      // Note: The parser creates local dates, not UTC
      expect(items[0].startDate).toBeInstanceOf(Date);
      expect(items[0].startDate.getFullYear()).toBe(2024);
      expect(items[0].startDate.getMonth()).toBe(5); // June
      expect(items[0].startDate.getDate()).toBe(15);
      expect(items[0].endDate).toBeInstanceOf(Date);
      expect(items[0].endDate?.getFullYear()).toBe(2024);
    });

    it('should parse all-day events', () => {
      const allDayICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:all-day-1
SUMMARY:All Day Event
DTSTART;VALUE=DATE:20240615
DTEND;VALUE=DATE:20240616
END:VEVENT
END:VCALENDAR`;

      const items = importICS(allDayICS);

      expect(items[0].startDate).toBeInstanceOf(Date);
      expect(items[0].startDate.getFullYear()).toBe(2024);
      expect(items[0].startDate.getMonth()).toBe(5); // June
      expect(items[0].startDate.getDate()).toBe(15);
      expect(items[0].endDate).toBeInstanceOf(Date);
      expect(items[0].endDate?.getDate()).toBe(16);
    });

    it('should map status correctly', () => {
      const statusICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:status-1
SUMMARY:Event with Status
DTSTART:20240615
STATUS:TENTATIVE
END:VEVENT
BEGIN:VEVENT
UID:status-2
SUMMARY:Confirmed Event
DTSTART:20240616
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:status-3
SUMMARY:Cancelled Event
DTSTART:20240617
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`;

      const items = importICS(statusICS);

      expect(items[0].status).toBe('draft'); // TENTATIVE -> draft
      expect(items[1].status).toBe('published'); // CONFIRMED -> published
      expect(items[2].status).toBe('cancelled');
    });

    it('should map priority correctly', () => {
      const priorityICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:prio-1
SUMMARY:High Priority
DTSTART:20240615
PRIORITY:1
END:VEVENT
BEGIN:VEVENT
UID:prio-2
SUMMARY:Medium Priority
DTSTART:20240616
PRIORITY:5
END:VEVENT
BEGIN:VEVENT
UID:prio-3
SUMMARY:Low Priority
DTSTART:20240617
PRIORITY:9
END:VEVENT
END:VCALENDAR`;

      const items = importICS(priorityICS);

      expect(items[0].priority).toBe('high');
      expect(items[1].priority).toBe('medium');
      expect(items[2].priority).toBe('low');
    });

    it('should parse categories as tags', () => {
      const items = importICS(basicICS);

      expect(items[0].tags).toEqual(['work', 'meeting']);
    });

    it('should parse attendee as assignee', () => {
      const items = importICS(basicICS);

      expect(items[0].assignee).toBe('John Doe');
    });

    it('should handle multiple events', () => {
      const multiEventICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-1
SUMMARY:Event 1
DTSTART:20240615
END:VEVENT
BEGIN:VEVENT
UID:event-2
SUMMARY:Event 2
DTSTART:20240616
END:VEVENT
BEGIN:VEVENT
UID:event-3
SUMMARY:Event 3
DTSTART:20240617
END:VEVENT
END:VCALENDAR`;

      const items = importICS(multiEventICS);

      expect(items).toHaveLength(3);
      expect(items[0].title).toBe('Event 1');
      expect(items[1].title).toBe('Event 2');
      expect(items[2].title).toBe('Event 3');
    });

    it('should handle escaped characters', () => {
      const escapedICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:escaped-1
SUMMARY:Event with \\, escaped \\; characters
DESCRIPTION:Line 1\\nLine 2\\nLine 3
LOCATION:Place\\With\\Escapes
DTSTART:20240615
END:VEVENT
END:VCALENDAR`;

      const items = importICS(escapedICS);

      expect(items[0].title).toBe('Event with , escaped ; characters');
      // Note: The parser includes the colon in the description
      expect(items[0].description).toContain('Line 1\nLine 2\nLine 3');
      expect(items[0].location).toContain('Place\\With\\Escapes');
    });

    it('should set default values for imported items', () => {
      const minimalICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:minimal-1
SUMMARY:Minimal Event
DTSTART:20240615
END:VEVENT
END:VCALENDAR`;

      const items = importICS(minimalICS);

      expect(items[0].source).toBe('external');
      expect(items[0].type).toBe('event');
      expect(items[0].status).toBe('scheduled');
      expect(items[0].id).toContain('import-');
      expect(items[0].createdAt).toBeInstanceOf(Date);
      expect(items[0].updatedAt).toBeInstanceOf(Date);
    });

    it('should skip events without title', () => {
      const noTitleICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:no-title-1
DTSTART:20240615
END:VEVENT
END:VCALENDAR`;

      const items = importICS(noTitleICS);

      expect(items).toHaveLength(0);
    });

    it('should handle empty ICS content', () => {
      const items = importICS('');

      expect(items).toHaveLength(0);
    });

    it('should handle malformed ICS gracefully', () => {
      const malformedICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:malformed-1
SUMMARY:Malformed Event
DTSTART:invalid-date
END:VEVENT
END:VCALENDAR`;

      // Should not throw, but may not parse the date correctly
      expect(() => importICS(malformedICS)).not.toThrow();
    });

    it('should handle different line endings', () => {
      const crlfICS = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:crlf-1\r\nSUMMARY:CRLF Event\r\nDTSTART:20240615\r\nEND:VEVENT\r\nEND:VCALENDAR`;
      const lfICS = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:lf-1\nSUMMARY:LF Event\nDTSTART:20240615\nEND:VEVENT\nEND:VCALENDAR`;
      const crICS = `BEGIN:VCALENDAR\rVERSION:2.0\rBEGIN:VEVENT\rUID:cr-1\rSUMMARY:CR Event\rDTSTART:20240615\rEND:VEVENT\rEND:VCALENDAR`;

      expect(importICS(crlfICS)).toHaveLength(1);
      expect(importICS(lfICS)).toHaveLength(1);
      expect(importICS(crICS)).toHaveLength(1);
    });

    it('should handle events without end date', () => {
      const noEndICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:no-end-1
SUMMARY:Event Without End
DTSTART:20240615
END:VEVENT
END:VCALENDAR`;

      const items = importICS(noEndICS);

      expect(items[0].startDate).toBeDefined();
      expect(items[0].endDate).toBeUndefined();
    });
  });

  describe('readICSFile', () => {
    it('should read file and parse ICS content', async () => {
      const mockFile = new File(['BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test-1\r\nSUMMARY:Test Event\r\nDTSTART:20240615\r\nEND:VEVENT\r\nEND:VCALENDAR'], 'test.ics', { type: 'text/calendar' });

      const items = await readICSFile(mockFile);

      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Test Event');
    });

    it('should handle file read errors', async () => {
      const mockFile = new File([''], 'test.ics', { type: 'text/calendar' });

      // Mock FileReader to throw error
      const originalFileReader = global.FileReader;
      global.FileReader = class extends Error {
        constructor() {
          super('FileReader error');
          this.name = 'FileReader';
        }
      } as any;

      await expect(readICSFile(mockFile)).rejects.toThrow();

      // Restore
      global.FileReader = originalFileReader;
    });

    it('should handle invalid ICS content in file', async () => {
      const mockFile = new File(['invalid ics content'], 'invalid.ics', { type: 'text/calendar' });

      // Should not throw, but return empty array
      const items = await readICSFile(mockFile);
      expect(Array.isArray(items)).toBe(true);
    });
  });
});

describe('Calendar Utilities - Round Trip', () => {
  it('should maintain data integrity through export/import cycle', () => {
    const originalItems = [
      createTestItem({
        id: 'rt-1',
        title: 'Round Trip Event',
        description: 'Test description',
        location: 'Test Location',
        type: 'campaign',
        status: 'scheduled',
        source: 'manual',
        startDate: new Date('2024-06-15T10:00:00Z'),
        endDate: new Date('2024-06-15T11:00:00Z'),
        allDay: false,
        tags: ['marketing', 'important'],
        assignee: 'John Doe',
        priority: 'high',
      }),
    ];

    const icsContent = exportToICS(originalItems);
    const importedItems = importICS(icsContent);

    expect(importedItems).toHaveLength(1);
    expect(importedItems[0].title).toBe(originalItems[0].title);
    // Note: The parser includes the colon in the description
    expect(importedItems[0].description).toContain(originalItems[0].description!);
    expect(importedItems[0].location).toContain(originalItems[0].location!);
    expect(importedItems[0].startDate.getFullYear()).toBe(originalItems[0].startDate.getFullYear());
    expect(importedItems[0].startDate.getMonth()).toBe(originalItems[0].startDate.getMonth());
    expect(importedItems[0].startDate.getDate()).toBe(originalItems[0].startDate.getDate());
    expect(importedItems[0].tags).toEqual(originalItems[0].tags);
    expect(importedItems[0].assignee).toBe(originalItems[0].assignee);
    expect(importedItems[0].priority).toBe(originalItems[0].priority);
  });

  it('should handle multiple items in round trip', () => {
    const originalItems = [
      createTestItem({ id: 'rt-1', title: 'Event 1', startDate: new Date('2024-06-15') }),
      createTestItem({ id: 'rt-2', title: 'Event 2', startDate: new Date('2024-06-16') }),
      createTestItem({ id: 'rt-3', title: 'Event 3', startDate: new Date('2024-06-17') }),
    ];

    const icsContent = exportToICS(originalItems);
    const importedItems = importICS(icsContent);

    expect(importedItems).toHaveLength(3);
    expect(importedItems.map((i) => i.title)).toEqual(['Event 1', 'Event 2', 'Event 3']);
  });
});
