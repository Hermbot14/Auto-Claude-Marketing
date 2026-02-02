import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS, CALENDAR_DIR, CALENDAR_DATA_FILE } from '../../shared/constants';
import type { IPCResult, CalendarData, CalendarItem } from '../../shared/types';
import type { Project } from '../../shared/types';
import path from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { projectStore } from '../project-store';
import { debugLog, debugError } from '../../shared/utils/debug-logger';
import { safeSendToRenderer } from './utils';

/**
 * Parse .env file content into key-value pairs
 */
function parseEnvFile(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        vars[key] = value;
      }
    }
  }
  return vars;
}

/**
 * Register all calendar-related IPC handlers
 */
export function registerCalendarHandlers(
  getMainWindow: () => BrowserWindow | null
): void {
  // ============================================
  // Calendar Data Operations
  // ============================================

  /**
   * Helper to get calendar config from project env
   */
  const getCalendarConfig = (project: Project): {
    enabled: boolean;
    provider?: string;
    apiKey?: string;
    email?: string;
  } => {
    if (!project.autoBuildPath) return { enabled: false };
    const envPath = path.join(project.path, project.autoBuildPath, '.env');
    if (!existsSync(envPath)) return { enabled: false };

    try {
      const content = readFileSync(envPath, 'utf-8');
      const vars = parseEnvFile(content);
      return {
        enabled: vars['CALENDAR_ENABLED'] === 'true',
        provider: vars['CALENDAR_PROVIDER'],
        apiKey: vars['CALENDAR_API_KEY'],
        email: vars['CALENDAR_EMAIL']
      };
    } catch {
      return { enabled: false };
    }
  };

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_GET_DATA,
    async (_, projectId: string): Promise<IPCResult<CalendarData | null>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const calendarPath = path.join(
        project.path,
        CALENDAR_DIR,
        CALENDAR_DATA_FILE
      );

      if (!existsSync(calendarPath)) {
        // Return empty calendar data if file doesn't exist
        return {
          success: true,
          data: {
            projectId,
            items: [],
            viewMode: 'month',
            zoomLevel: 'month',
            currentDate: new Date(),
            filters: {
              itemTypes: [],
              status: [],
              sources: [],
              tags: [],
              searchQuery: '',
            },
            updatedAt: new Date(),
          },
        };
      }

      try {
        const content = readFileSync(calendarPath, 'utf-8');
        const rawCalendar = JSON.parse(content);

        // Transform snake_case to camelCase for frontend
        const calendarData: CalendarData = {
          projectId: rawCalendar.project_id || projectId,
          items: (rawCalendar.items || []).map((item: Record<string, unknown>) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            type: item.type,
            status: item.status || 'draft',
            source: item.source || 'manual',
            startDate: new Date(item.start_date as string),
            endDate: item.end_date ? new Date(item.end_date as string) : undefined,
            allDay: item.all_day || false,
            linkedFeatureId: item.linked_feature_id,
            linkedTaskId: item.linked_task_id,
            linkedFileId: item.linked_file_id,
            externalEventId: item.external_event_id,
            tags: item.tags || [],
            assignee: item.assignee,
            priority: item.priority,
            location: item.location,
            notes: item.notes,
            recurrence: item.recurrence,
            createdAt: new Date(item.created_at as string),
            updatedAt: new Date(item.updated_at as string),
          })),
          viewMode: rawCalendar.view_mode || 'month',
          zoomLevel: rawCalendar.zoom_level || 'month',
          currentDate: new Date(rawCalendar.current_date || Date.now()),
          filters: rawCalendar.filters || {
            itemTypes: [],
            status: [],
            sources: [],
            tags: [],
            searchQuery: '',
          },
          updatedAt: new Date(rawCalendar.updated_at || Date.now()),
        };

        return { success: true, data: calendarData };
      } catch (error) {
        debugError('[Calendar Handler] Failed to read calendar data:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to read calendar data',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_SAVE_DATA,
    async (_, projectId: string, calendarData: CalendarData): Promise<IPCResult> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const calendarDirPath = path.join(project.path, CALENDAR_DIR);
      const calendarPath = path.join(calendarDirPath, CALENDAR_DATA_FILE);

      try {
        // Ensure directory exists
        if (!existsSync(calendarDirPath)) {
          mkdirSync(calendarDirPath, { recursive: true });
        }

        // Transform camelCase to snake_case for JSON file
        const rawCalendar = {
          project_id: calendarData.projectId,
          items: calendarData.items.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            type: item.type,
            status: item.status,
            source: item.source,
            start_date: item.startDate.toISOString(),
            end_date: item.endDate?.toISOString(),
            all_day: item.allDay,
            linked_feature_id: item.linkedFeatureId,
            linked_task_id: item.linkedTaskId,
            linked_file_id: item.linkedFileId,
            external_event_id: item.externalEventId,
            tags: item.tags || [],
            assignee: item.assignee,
            priority: item.priority,
            location: item.location,
            notes: item.notes,
            recurrence: item.recurrence,
            created_at: item.createdAt.toISOString(),
            updated_at: item.updatedAt.toISOString(),
          })),
          view_mode: calendarData.viewMode,
          zoom_level: calendarData.zoomLevel,
          current_date: calendarData.currentDate.toISOString(),
          filters: calendarData.filters,
          updated_at: new Date().toISOString(),
        };

        writeFileSync(calendarPath, JSON.stringify(rawCalendar, null, 2));
        debugLog('[Calendar Handler] Calendar data saved successfully');

        return { success: true };
      } catch (error) {
        debugError('[Calendar Handler] Failed to save calendar data:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save calendar data',
        };
      }
    }
  );

  // ============================================
  // Calendar Item Operations
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_ADD_ITEM,
    async (_, projectId: string, item: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<IPCResult<string>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const calendarPath = path.join(project.path, CALENDAR_DIR, CALENDAR_DATA_FILE);

      try {
        // Load existing calendar data
        let calendarData: CalendarData;
        if (existsSync(calendarPath)) {
          const content = readFileSync(calendarPath, 'utf-8');
          const rawCalendar = JSON.parse(content);
          calendarData = {
            projectId: rawCalendar.project_id || projectId,
            items: (rawCalendar.items || []).map((i: Record<string, unknown>) => ({
              id: i.id,
              title: i.title,
              description: i.description,
              type: i.type,
              status: i.status || 'draft',
              source: i.source || 'manual',
              startDate: new Date(i.start_date as string),
              endDate: i.end_date ? new Date(i.end_date as string) : undefined,
              allDay: i.all_day || false,
              linkedFeatureId: i.linked_feature_id,
              linkedTaskId: i.linked_task_id,
              linkedFileId: i.linked_file_id,
              externalEventId: i.external_event_id,
              tags: i.tags || [],
              assignee: i.assignee,
              priority: i.priority,
              location: i.location,
              notes: i.notes,
              recurrence: i.recurrence,
              createdAt: new Date(i.created_at as string),
              updatedAt: new Date(i.updated_at as string),
            })),
            viewMode: rawCalendar.view_mode || 'month',
            zoomLevel: rawCalendar.zoom_level || 'month',
            currentDate: new Date(rawCalendar.current_date || Date.now()),
            filters: rawCalendar.filters || {
              itemTypes: [],
              status: [],
              sources: [],
              tags: [],
              searchQuery: '',
            },
            updatedAt: new Date(rawCalendar.updated_at || Date.now()),
          };
        } else {
          calendarData = {
            projectId,
            items: [],
            viewMode: 'month',
            zoomLevel: 'month',
            currentDate: new Date(),
            filters: {
              itemTypes: [],
              status: [],
              sources: [],
              tags: [],
              searchQuery: '',
            },
            updatedAt: new Date(),
          };
        }

        // Create new item
        const newItem: CalendarItem = {
          ...item,
          id: `calendar-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        calendarData.items.push(newItem);
        calendarData.updatedAt = new Date();

        // Save calendar data
        const calendarDirPath = path.join(project.path, CALENDAR_DIR);
        if (!existsSync(calendarDirPath)) {
          mkdirSync(calendarDirPath, { recursive: true });
        }

        const rawCalendar = {
          project_id: calendarData.projectId,
          items: calendarData.items.map((i) => ({
            id: i.id,
            title: i.title,
            description: i.description,
            type: i.type,
            status: i.status,
            source: i.source,
            start_date: i.startDate.toISOString(),
            end_date: i.endDate?.toISOString(),
            all_day: i.allDay,
            linked_feature_id: i.linkedFeatureId,
            linked_task_id: i.linkedTaskId,
            linked_file_id: i.linkedFileId,
            external_event_id: i.externalEventId,
            tags: i.tags || [],
            assignee: i.assignee,
            priority: i.priority,
            location: i.location,
            notes: i.notes,
            recurrence: i.recurrence,
            created_at: i.createdAt.toISOString(),
            updated_at: i.updatedAt.toISOString(),
          })),
          view_mode: calendarData.viewMode,
          zoom_level: calendarData.zoomLevel,
          current_date: calendarData.currentDate.toISOString(),
          filters: calendarData.filters,
          updated_at: calendarData.updatedAt.toISOString(),
        };

        writeFileSync(calendarPath, JSON.stringify(rawCalendar, null, 2));

        return { success: true, data: newItem.id };
      } catch (error) {
        debugError('[Calendar Handler] Failed to add calendar item:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to add calendar item',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_UPDATE_ITEM,
    async (_, projectId: string, itemId: string, updates: Partial<Omit<CalendarItem, 'id'>>): Promise<IPCResult> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const calendarPath = path.join(project.path, CALENDAR_DIR, CALENDAR_DATA_FILE);

      if (!existsSync(calendarPath)) {
        return { success: false, error: 'Calendar not found' };
      }

      try {
        const content = readFileSync(calendarPath, 'utf-8');
        const rawCalendar = JSON.parse(content);

        // Find and update the item
        const item = rawCalendar.items?.find((i: Record<string, unknown>) => i.id === itemId);
        if (!item) {
          return { success: false, error: 'Item not found' };
        }

        // Apply updates
        Object.assign(item, updates);
        if (updates.startDate) {
          item.start_date = updates.startDate.toISOString();
        }
        if (updates.endDate) {
          item.end_date = updates.endDate.toISOString();
        }
        if (updates.createdAt) {
          item.created_at = updates.createdAt.toISOString();
        }
        item.updated_at = new Date().toISOString();

        rawCalendar.updated_at = new Date().toISOString();

        writeFileSync(calendarPath, JSON.stringify(rawCalendar, null, 2));

        return { success: true };
      } catch (error) {
        debugError('[Calendar Handler] Failed to update calendar item:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update calendar item',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_DELETE_ITEM,
    async (_, projectId: string, itemId: string): Promise<IPCResult> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const calendarPath = path.join(project.path, CALENDAR_DIR, CALENDAR_DATA_FILE);

      if (!existsSync(calendarPath)) {
        return { success: false, error: 'Calendar not found' };
      }

      try {
        const content = readFileSync(calendarPath, 'utf-8');
        const rawCalendar = JSON.parse(content);

        // Remove the item
        rawCalendar.items = rawCalendar.items?.filter((i: Record<string, unknown>) => i.id !== itemId);
        rawCalendar.updated_at = new Date().toISOString();

        writeFileSync(calendarPath, JSON.stringify(rawCalendar, null, 2));

        return { success: true };
      } catch (error) {
        debugError('[Calendar Handler] Failed to delete calendar item:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete calendar item',
        };
      }
    }
  );

  // ============================================
  // Calendar Sync Operations
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_SYNC_ROADMAP,
    async (_, projectId: string, roadmapData: any): Promise<IPCResult<CalendarItem[]>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      try {
        // Aggregate items from roadmap phases
        const items: CalendarItem[] = [];
        const now = new Date();

        if (roadmapData?.phases) {
          roadmapData.phases.forEach((phase: any, index: number) => {
            // Estimate phase dates based on order
            const startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() + index * 2);
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 2);

            items.push({
              id: `roadmap-phase-${phase.id}`,
              title: phase.name,
              description: phase.description,
              type: 'campaign',
              status: phase.status === 'completed' ? 'published' : 'scheduled',
              source: 'roadmap',
              linkedFeatureId: phase.id,
              startDate,
              endDate,
              allDay: true,
              createdAt: now,
              updatedAt: now,
            });
          });
        }

        // Add milestones as deadlines
        if (roadmapData?.features) {
          roadmapData.features.forEach((feature: any) => {
            if (feature.acceptanceCriteria && feature.acceptanceCriteria.length > 0) {
              items.push({
                id: `roadmap-feature-${feature.id}`,
                title: `Feature: ${feature.title}`,
                description: feature.description,
                type: 'deadline',
                status: feature.status === 'done' ? 'published' : 'scheduled',
                source: 'roadmap',
                linkedFeatureId: feature.id,
                startDate: new Date(),
                allDay: true,
                createdAt: now,
                updatedAt: now,
              });
            }
          });
        }

        return { success: true, data: items };
      } catch (error) {
        debugError('[Calendar Handler] Failed to sync roadmap:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to sync roadmap',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_SCAN_FILES,
    async (_, projectId: string): Promise<IPCResult<CalendarItem[]>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      try {
        // TODO: Implement file scanning for date-related items
        // This would scan project files for TODOs, deadlines, etc.
        const items: CalendarItem[] = [];

        return { success: true, data: items };
      } catch (error) {
        debugError('[Calendar Handler] Failed to scan files:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to scan files',
        };
      }
    }
  );

  // ============================================
  // Calendar Integration Connection Check
  // ============================================

  ipcMain.handle(
    IPC_CHANNELS.CALENDAR_CHECK_CONNECTION,
    async (_, projectId: string): Promise<IPCResult<import('../../shared/types/integrations').CalendarSyncStatus>> => {
      const project = projectStore.getProject(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      try {
        // Get the calendar config from the project's .env file
        const calendarConfig = getCalendarConfig(project);

        if (!calendarConfig.enabled || !calendarConfig.apiKey) {
          return {
            success: true,
            data: {
              connected: false,
              error: 'Calendar integration is not enabled or API key is missing'
            }
          };
        }

        const provider = (calendarConfig.provider || 'google') as 'google' | 'outlook' | 'ical' | 'calDAV';

        // TODO: Implement actual connection check for each provider
        // For now, return a mock response
        // In production, this would:
        // - For Google: Use googleapis library to call calendar.calendarList.list()
        // - For Outlook: Use Microsoft Graph API to call /me/calendars
        // - For CalDAV: Make a PROPFIND request to the CalDAV server

        debugLog(`[Calendar Handler] Checking ${provider} calendar connection for project ${projectId}`);

        // Mock successful connection for testing
        // Replace this with actual API calls to validate the connection
        const mockData: import('../../shared/types/integrations').CalendarSyncStatus = {
          connected: false,
          provider,
          email: calendarConfig.email,
          calendarName: 'Mock Calendar',
          eventCount: 0,
          lastSyncedAt: undefined,
          error: 'Connection check not yet implemented - please verify API key manually'
        };

        return { success: true, data: mockData };
      } catch (error) {
        debugError('[Calendar Handler] Failed to check calendar connection:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check calendar connection',
        };
      }
    }
  );

  debugLog('[Calendar Handler] Calendar IPC handlers registered');
}
