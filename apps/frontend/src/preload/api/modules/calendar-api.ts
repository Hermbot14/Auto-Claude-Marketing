import { IPC_CHANNELS } from '../../../shared/constants';
import type { CalendarData, CalendarItem, CalendarSyncStatus, IPCResult } from '../../../shared/types';
import { createIpcListener, invokeIpc, IpcListenerCleanup } from './ipc-utils';

/**
 * Calendar API operations
 */
export interface CalendarAPI {
  // Data operations
  getCalendarData: (projectId: string) => Promise<IPCResult<CalendarData | null>>;
  saveCalendarData: (projectId: string, data: CalendarData) => Promise<IPCResult>;

  // Item operations
  addCalendarItem: (projectId: string, item: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<IPCResult<string>>;
  updateCalendarItem: (projectId: string, itemId: string, updates: Partial<Omit<CalendarItem, 'id'>>) => Promise<IPCResult>;
  deleteCalendarItem: (projectId: string, itemId: string) => Promise<IPCResult>;

  // Sync operations
  syncRoadmap: (projectId: string, roadmapData: any) => Promise<IPCResult<CalendarItem[]>>;
  scanFiles: (projectId: string) => Promise<IPCResult<CalendarItem[]>>;

  // Integration operations
  checkCalendarConnection: (projectId: string) => Promise<IPCResult<CalendarSyncStatus>>;
}

/**
 * Creates the Calendar API implementation
 */
export const createCalendarAPI = (): CalendarAPI => ({
  // Data operations
  getCalendarData: (projectId: string): Promise<IPCResult<CalendarData | null>> =>
    invokeIpc(IPC_CHANNELS.CALENDAR_GET_DATA, projectId),

  saveCalendarData: (projectId: string, data: CalendarData): Promise<IPCResult> =>
    invokeIpc(IPC_CHANNELS.CALENDAR_SAVE_DATA, projectId, data),

  // Item operations
  addCalendarItem: (projectId: string, item: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<IPCResult<string>> =>
    invokeIpc(IPC_CHANNELS.CALENDAR_ADD_ITEM, projectId, item),

  updateCalendarItem: (projectId: string, itemId: string, updates: Partial<Omit<CalendarItem, 'id'>>): Promise<IPCResult> =>
    invokeIpc(IPC_CHANNELS.CALENDAR_UPDATE_ITEM, projectId, itemId, updates),

  deleteCalendarItem: (projectId: string, itemId: string): Promise<IPCResult> =>
    invokeIpc(IPC_CHANNELS.CALENDAR_DELETE_ITEM, projectId, itemId),

  // Sync operations
  syncRoadmap: (projectId: string, roadmapData: any): Promise<IPCResult<CalendarItem[]>> =>
    invokeIpc(IPC_CHANNELS.CALENDAR_SYNC_ROADMAP, projectId, roadmapData),

  scanFiles: (projectId: string): Promise<IPCResult<CalendarItem[]>> =>
    invokeIpc(IPC_CHANNELS.CALENDAR_SCAN_FILES, projectId),

  // Integration operations
  checkCalendarConnection: (projectId: string): Promise<IPCResult<CalendarSyncStatus>> =>
    invokeIpc(IPC_CHANNELS.CALENDAR_CHECK_CONNECTION, projectId),
});
