/**
 * Calendar Utilities - ICS export and other calendar functions
 */

import type { CalendarItem } from '../../../shared/types';
import { format } from 'date-fns';

/**
 * Format date for ICS file (YYYYMMDDTHHmmssZ)
 */
function formatDateForICS(date: Date): string {
  return format(date, "yyyyMMdd'T'HHmmss'Z'");
}

/**
 * Escape ICS text values
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Convert CalendarItem to ICS format
 */
function itemToICS(item: CalendarItem): string {
  const lines: string[] = [];

  // Begin event
  lines.push('BEGIN:VEVENT');

  // UID (unique identifier)
  lines.push(`UID:${item.id}`);

  // Summary (title)
  lines.push(`SUMMARY:${escapeICS(item.title)}`);

  // Description
  if (item.description) {
    lines.push(`DESCRIPTION:${escapeICS(item.description)}`);
  }

  // Location
  if (item.location) {
    lines.push(`LOCATION:${escapeICS(item.location)}`);
  }

  // Start date/time
  lines.push(`DTSTART:${formatDateForICS(item.startDate)}`);

  // End date/time
  if (item.endDate) {
    lines.push(`DTEND:${formatDateForICS(item.endDate)}`);
  }

  // All day event
  if (item.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${format(item.startDate, 'yyyyMMdd')}`);
    if (item.endDate) {
      const endDate = new Date(item.endDate);
      endDate.setDate(endDate.getDate() + 1); // ICS end date is exclusive
      lines.push(`DTEND;VALUE=DATE:${format(endDate, 'yyyyMMdd')}`);
    }
  }

  // Status
  const statusMap: Record<string, string> = {
    draft: 'TENTATIVE',
    scheduled: 'CONFIRMED',
    published: 'CONFIRMED',
    cancelled: 'CANCELLED',
  };
  lines.push(`STATUS:${statusMap[item.status] || 'TENTATIVE'}`);

  // Priority
  if (item.priority === 'high') {
    lines.push('PRIORITY:1');
  } else if (item.priority === 'low') {
    lines.push('PRIORITY:9');
  } else {
    lines.push('PRIORITY:5');
  }

  // Categories (tags)
  if (item.tags && item.tags.length > 0) {
    lines.push(`CATEGORIES:${item.tags.map(escapeICS).join(',')}`);
  }

  // Attendee (assignee)
  if (item.assignee) {
    lines.push(`ATTENDEE:CN=${escapeICS(item.assignee)}:RSVP=TRUE`);
  }

  // Created and Last Modified timestamps
  lines.push(`CREATED:${formatDateForICS(item.createdAt)}`);
  lines.push(`LAST-MODIFIED:${formatDateForICS(item.updatedAt)}`);

  // Recurrence rule (RRULE)
  if (item.recurrence) {
    const rruleParts: string[] = [
      `FREQ=${item.recurrence.frequency.toUpperCase()}`,
      `INTERVAL=${item.recurrence.interval}`,
    ];

    if (item.recurrence.until) {
      rruleParts.push(`UNTIL=${formatDateForICS(item.recurrence.until)}`);
    } else if (item.recurrence.count) {
      rruleParts.push(`COUNT=${item.recurrence.count}`);
    }

    lines.push(`RRULE:${rruleParts.join(';')}`);
  }

  // End event
  lines.push('END:VEVENT');

  return lines.join('\r\n');
}

/**
 * Export calendar items to ICS format
 */
export function exportToICS(items: CalendarItem[], calendarName: string = 'Marketing Calendar'): string {
  const lines: string[] = [];

  // Begin calendar
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//AutoMarketing//EN');
  lines.push(`X-WR-CALNAME:${escapeICS(calendarName)}`);
  lines.push('METHOD:PUBLISH');

  // Add all events
  items.forEach((item) => {
    lines.push(itemToICS(item));
  });

  // End calendar
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Download ICS file
 */
export function downloadICS(items: CalendarItem[], filename: string = 'calendar.ics'): void {
  const icsContent = exportToICS(items);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Import ICS file (basic parser)
 * This is a simplified parser that handles basic VEVENT items
 */
export function importICS(icsContent: string): CalendarItem[] {
  const items: CalendarItem[] = [];
  const lines = icsContent.split(/\r\n|\n|\r/);

  let currentItem: Partial<CalendarItem> | null = null;
  let inEvent = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      currentItem = {
        id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source: 'external',
        type: 'event',
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else if (trimmed === 'END:VEVENT') {
      if (currentItem && currentItem.title) {
        items.push(currentItem as CalendarItem);
      }
      currentItem = null;
      inEvent = false;
    } else if (inEvent && currentItem) {
      // Parse ICS properties
      if (trimmed.startsWith('SUMMARY:')) {
        currentItem.title = trimmed.substring(8).replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
      } else if (trimmed.startsWith('DESCRIPTION:')) {
        currentItem.description = trimmed.substring(11).replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
      } else if (trimmed.startsWith('LOCATION:')) {
        currentItem.location = trimmed.substring(9).replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
      } else if (trimmed.startsWith('DTSTART') || trimmed.startsWith('DTSTART;')) {
        // Parse date (simplified - doesn't handle all timezone cases)
        const dateMatch = trimmed.match(/:([0-9]{8})/);
        if (dateMatch) {
          const year = parseInt(dateMatch[1].substring(0, 4));
          const month = parseInt(dateMatch[1].substring(4, 6)) - 1;
          const day = parseInt(dateMatch[1].substring(6, 8));
          currentItem.startDate = new Date(year, month, day);
        }
      } else if (trimmed.startsWith('DTEND') || trimmed.startsWith('DTEND;')) {
        const dateMatch = trimmed.match(/:([0-9]{8})/);
        if (dateMatch) {
          const year = parseInt(dateMatch[1].substring(0, 4));
          const month = parseInt(dateMatch[1].substring(4, 6)) - 1;
          const day = parseInt(dateMatch[1].substring(6, 8));
          currentItem.endDate = new Date(year, month, day);
        }
      } else if (trimmed.startsWith('STATUS:')) {
        const status = trimmed.substring(7);
        if (status === 'CANCELLED') {
          currentItem.status = 'cancelled';
        } else if (status === 'CONFIRMED') {
          currentItem.status = 'published';
        } else {
          currentItem.status = 'draft';
        }
      } else if (trimmed.startsWith('PRIORITY:')) {
        const priority = parseInt(trimmed.substring(9));
        currentItem.priority = priority <= 3 ? 'high' : priority >= 7 ? 'low' : 'medium';
      } else if (trimmed.startsWith('CATEGORIES:')) {
        currentItem.tags = trimmed.substring(11).split(',').map(t => t.trim().replace(/\\,/g, ',').replace(/\\;/g, ';'));
      } else if (trimmed.startsWith('ATTENDEE')) {
        const cnMatch = trimmed.match(/CN=([^:]+)/);
        if (cnMatch) {
          currentItem.assignee = cnMatch[1].replace(/\\,/g, ',').replace(/\\;/g, ';');
        }
      }
    }
  }

  return items;
}

/**
 * Read ICS file from File object
 */
export async function readICSFile(file: File): Promise<CalendarItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const items = importICS(content);
        resolve(items);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
