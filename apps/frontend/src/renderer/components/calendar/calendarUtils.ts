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
 * Read ICS file from File object
 * Uses secure ICS parser with comprehensive security validation
 */
export async function readICSFile(file: File): Promise<CalendarItem[]> {
  // Security: Check file size before reading
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`ICS file exceeds maximum size of ${MAX_FILE_SIZE} bytes`);
  }

  // Security: Validate file extension
  if (!file.name.toLowerCase().endsWith('.ics')) {
    throw new Error('Invalid file type. Only .ics files are allowed.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        // Use secure ICS parser
        const { parseICSToCalendarItems } = await import('../../lib/ics-parser');
        const items = parseICSToCalendarItems(content);

        // Add IDs and timestamps to each imported item
        const itemsWithMetadata: CalendarItem[] = items.map((item) => ({
          ...item,
          id: `import-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        resolve(itemsWithMetadata);
      } catch (error) {
        if (error instanceof Error) {
          reject(new Error(`Failed to parse ICS file: ${error.message}`));
        } else {
          reject(new Error('Failed to parse ICS file: Unknown error'));
        }
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
