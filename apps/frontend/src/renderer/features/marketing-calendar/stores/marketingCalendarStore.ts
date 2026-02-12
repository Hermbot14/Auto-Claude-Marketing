/**
 * Marketing Calendar Store
 * Unified calendar store combining generic calendar and marketing-specific features
 *
 * This store replaces:
 * - stores/calendarStore.ts (generic calendar)
 * - features/content-calendar/ContentCalendarStore.ts (marketing calendar)
 *
 * @deprecated Use this store instead of calendarStore or ContentCalendarStore
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  MarketingCalendarItem,
  MarketingCalendarData,
  MarketingCalendarFilters,
  CalendarViewMode,
  CalendarZoomLevel,
  ExternalCalendarConnection,
  ScheduleConflict,
  ConflictResolution,
  CalendarDate,
  WeekDay,
  MarketingEventType,
  SocialPlatform,
  DragDropContext,
} from '../../../../shared/types/marketing-calendar';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isWithinInterval,
  addMonths,
  subMonths,
} from 'date-fns';
import { sanitizeCalendarItem } from '../../../../shared/utils/input-sanitizer';

// ============================================
// Default Values
// ============================================

const defaultFilters: MarketingCalendarFilters = {
  eventTypes: [],
  statuses: [],
  sources: [],
  contentTypes: [],
  platforms: [],
  tags: [],
  searchQuery: '',
};

const createEmptyCalendarData = (projectId: string): MarketingCalendarData => ({
  projectId,
  items: [],
  externalConnections: [],
  viewMode: 'month',
  zoomLevel: 'month',
  currentDate: new Date(),
  filters: defaultFilters,
  updatedAt: new Date(),
});

// ============================================
// State Interface
// ============================================

interface MarketingCalendarState {
  // === Core Data ===
  calendarData: MarketingCalendarData | null;
  externalConnections: ExternalCalendarConnection[];
  selectedItem: MarketingCalendarItem | null;
  hoveredItem: MarketingCalendarItem | null;

  // === UI State ===
  isLoading: boolean;
  isSaving: boolean;
  isSyncing: boolean;
  error: string | null;
  pendingItemIds: Set<string>;

  // === View Settings ===
  currentDate: Date;
  viewMode: CalendarViewMode;
  zoomLevel: CalendarZoomLevel;
  filters: MarketingCalendarFilters;

  // === Conflict Detection ===
  conflicts: ScheduleConflict[];
  showConflictDialog: boolean;

  // === Drag & Drop ===
  dragDrop: DragDropContext;

  // === Actions ===

  // Data management
  setCalendarData: (data: MarketingCalendarData | null) => void;
  setExternalConnections: (connections: ExternalCalendarConnection[]) => void;
  setSelectedItem: (item: MarketingCalendarItem | null) => void;
  setHoveredItem: (item: MarketingCalendarItem | null) => void;

  // UI state
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setError: (error: string | null) => void;
  addPendingItem: (itemId: string) => void;
  removePendingItem: (itemId: string) => void;

  // View management
  setCurrentDate: (date: Date) => void;
  setViewMode: (mode: CalendarViewMode) => void;
  setZoomLevel: (level: CalendarZoomLevel) => void;
  setFilters: (filters: Partial<MarketingCalendarFilters>) => void;
  clearFilters: () => void;

  // Navigation
  goToToday: () => void;
  navigatePrev: () => void;
  navigateNext: () => void;

  // Item CRUD
  addItem: (item: Omit<MarketingCalendarItem, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateItem: (id: string, updates: Partial<MarketingCalendarItem>) => void;
  deleteItem: (id: string) => void;
  updateItemDate: (id: string, startDate: Date, endDate?: Date) => void;

  // Filtering helpers
  getFilteredItems: () => MarketingCalendarItem[];
  getItemsForDate: (date: Date) => MarketingCalendarItem[];
  getItemsInRange: (start: Date, end: Date) => MarketingCalendarItem[];

  // Conflict detection
  checkConflicts: (itemId: string, newDate: Date) => ScheduleConflict[];
  resolveConflict: (resolution: ConflictResolution) => void;
  dismissConflict: (conflictId: string) => void;

  // Drag and drop
  startDrag: (item: MarketingCalendarItem) => void;
  endDrag: () => void;
  handleDrop: (itemId: string, targetDate: Date) => void;

  // Platform integration
  addExternalConnection: (connection: ExternalCalendarConnection) => void;
  removeExternalConnection: (connectionId: string) => void;
  syncWithExternal: (provider: ExternalProvider) => Promise<void>;
  scheduleForPlatforms: (itemId: string, platforms: SocialPlatform[]) => void;

  // Calendar grid generation
  generateMonthGrid: (date: Date) => CalendarDate[];
  generateWeekDays: (date: Date) => WeekDay[];
}

// ============================================
// Store Creation with Immer Middleware
// ============================================

export const useMarketingCalendarStore = create<MarketingCalendarState>()(
  immer((set, get) => ({
    // ============================================
    // Initial State
    // ============================================

    calendarData: null,
    externalConnections: [],
    selectedItem: null,
    hoveredItem: null,
    isLoading: false,
    isSaving: false,
    isSyncing: false,
    error: null,
    pendingItemIds: new Set<string>(),
    currentDate: new Date(),
    viewMode: 'month',
    zoomLevel: 'month',
    filters: defaultFilters,
    conflicts: [],
    showConflictDialog: false,
    dragDrop: {
      draggedItem: null,
      isDragOver: false,
      dropTargetDate: null,
    },

    // ============================================
    // Data Management
    // ============================================

    setCalendarData: (data) => {
      set({ calendarData: data });
    },

    setExternalConnections: (connections) => {
      set({ externalConnections: connections });
    },

    setSelectedItem: (item) => {
      set({ selectedItem: item });
    },

    setHoveredItem: (item) => {
      set({ hoveredItem: item });
    },

    setLoading: (loading) => {
      set({ isLoading: loading });
    },

    setSaving: (saving) => {
      set({ isSaving: saving });
    },

    setSyncing: (syncing) => {
      set({ isSyncing: syncing });
    },

    setError: (error) => {
      set({ error });
    },

    addPendingItem: (itemId) => {
      set((state) => {
        state.pendingItemIds.add(itemId);
      });
    },

    removePendingItem: (itemId) => {
      set((state) => {
        state.pendingItemIds.delete(itemId);
      });
    },

    // ============================================
    // View Management
    // ============================================

    setCurrentDate: (date) => {
      set({ currentDate: date });
    },

    setViewMode: (mode) => {
      set({ viewMode: mode });
    },

    setZoomLevel: (level) => {
      set({ zoomLevel: level });
    },

    setFilters: (partialFilters) => {
      set((state) => {
        state.filters = { ...state.filters, ...partialFilters };
      });
    },

    clearFilters: () => {
      set({ filters: defaultFilters });
    },

    // ============================================
    // Navigation
    // ============================================

    goToToday: () => {
      set({ currentDate: new Date() });
    },

    navigatePrev: () => {
      set((state) => {
        const { zoomLevel, currentDate } = state;
        switch (zoomLevel) {
          case 'day':
            state.currentDate = addMonths(currentDate, -1);
            break;
          case 'week':
            state.currentDate = addMonths(currentDate, -1);
            break;
          case 'month':
            state.currentDate = subMonths(currentDate, 1);
            break;
          case 'quarter':
            state.currentDate = subMonths(currentDate, 3);
            break;
          default:
            state.currentDate = subMonths(currentDate, 1);
        }
      });
    },

    navigateNext: () => {
      set((state) => {
        const { zoomLevel, currentDate } = state;
        switch (zoomLevel) {
          case 'day':
            state.currentDate = addMonths(currentDate, 1);
            break;
          case 'week':
            state.currentDate = addMonths(currentDate, 1);
            break;
          case 'month':
            state.currentDate = addMonths(currentDate, 1);
            break;
          case 'quarter':
            state.currentDate = addMonths(currentDate, 3);
            break;
          default:
            state.currentDate = addMonths(currentDate, 1);
        }
      });
    },

    // ============================================
    // Item CRUD Operations
    // ============================================

    addItem: (itemData) => {
      // SECURITY: Sanitize all user input to prevent XSS attacks
      const sanitizedItem = sanitizeCalendarItem(itemData) as Omit<MarketingCalendarItem, 'id' | 'createdAt' | 'updatedAt'>;

      const newItem: MarketingCalendarItem = {
        ...sanitizedItem,
        id: `marketing-calendar-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      set((state) => {
        if (!state.calendarData) return;
        state.calendarData.items.push(newItem);
        state.calendarData.updatedAt = new Date();
      });

      return newItem.id;
    },

    updateItem: (id, updates) => {
      set((state) => {
        if (!state.calendarData) return;

        // SECURITY: Sanitize all updates
        const sanitizedUpdates = sanitizeCalendarItem(updates);

        const item = state.calendarData.items.find((i) => i.id === id);
        if (item) {
          Object.assign(item, sanitizedUpdates, { updatedAt: new Date() });
          state.calendarData.updatedAt = new Date();
        }

        // Update selected item if it matches
        if (state.selectedItem?.id === id) {
          Object.assign(state.selectedItem, sanitizedUpdates, { updatedAt: new Date() });
        }
      });
    },

    deleteItem: (id) => {
      set((state) => {
        if (!state.calendarData) return;

        state.calendarData.items = state.calendarData.items.filter((item) => item.id !== id);
        state.calendarData.updatedAt = new Date();

        if (state.selectedItem?.id === id) {
          state.selectedItem = null;
        }
      });
    },

    updateItemDate: (id, startDate, endDate) => {
      set((state) => {
        if (!state.calendarData) return;

        const item = state.calendarData.items.find((i) => i.id === id);
        if (item) {
          item.startDate = startDate;
          item.endDate = endDate;
          item.updatedAt = new Date();
          state.calendarData.updatedAt = new Date();
        }

        if (state.selectedItem?.id === id) {
          state.selectedItem.startDate = startDate;
          state.selectedItem.endDate = endDate;
          state.selectedItem.updatedAt = new Date();
        }
      });
    },

    // ============================================
    // Filtering Helpers
    // ============================================

    getFilteredItems: () => {
      const state = get();
      const { calendarData, filters } = state;
      if (!calendarData) return [];

      let items = calendarData.items;

      // Filter by event type
      if (filters.eventTypes.length > 0) {
        items = items.filter((item) => filters.eventTypes.includes(item.type));
      }

      // Filter by status
      if (filters.statuses.length > 0) {
        items = items.filter((item) => filters.statuses.includes(item.status));
      }

      // Filter by source
      if (filters.sources.length > 0) {
        items = items.filter((item) => filters.sources.includes(item.source));
      }

      // Filter by content type
      if (filters.contentTypes.length > 0) {
        items = items.filter((item) =>
          item.contentType ? filters.contentTypes.includes(item.contentType) : false
        );
      }

      // Filter by platforms
      if (filters.platforms.length > 0) {
        items = items.filter((item) =>
          item.platforms?.some((p) => filters.platforms.includes(p))
        );
      }

      // Filter by tags
      if (filters.tags.length > 0) {
        items = items.filter((item) =>
          item.tags?.some((tag) => filters.tags.includes(tag))
        );
      }

      // Filter by date range
      if (filters.dateRange) {
        items = items.filter((item) => {
          const itemStart = item.startDate;
          const itemEnd = item.endDate || item.startDate;
          return (
            itemStart <= filters.dateRange!.end &&
            itemEnd >= filters.dateRange!.start
          );
        });
      }

      // Filter by search query
      if (filters.searchQuery && filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        items = items.filter(
          (item) =>
            item.title.toLowerCase().includes(query) ||
            item.description?.toLowerCase().includes(query) ||
            item.tags?.some((tag) => tag.toLowerCase().includes(query))
        );
      }

      return items;
    },

    getItemsForDate: (date) => {
      const state = get();
      const { calendarData } = state;
      if (!calendarData) return [];

      return calendarData.items.filter((item) => {
        if (item.allDay) {
          return isSameDay(item.startDate, date);
        }
        const itemEnd = item.endDate || item.startDate;
        return isWithinInterval(date, {
          start: startOfDay(item.startDate),
          end: endOfDay(itemEnd),
        });
      });
    },

    getItemsInRange: (start, end) => {
      const state = get();
      const { calendarData } = state;
      if (!calendarData) return [];

      return calendarData.items.filter((item) => {
        const itemEnd = item.endDate || item.startDate;
        return item.startDate <= end && itemEnd >= start;
      });
    },

    // ============================================
    // Conflict Detection
    // ============================================

    checkConflicts: (itemId, newDate) => {
      const state = get();
      const { calendarData } = state;
      if (!calendarData) return [];

      const item = calendarData.items.find((i) => i.id === itemId);
      if (!item) return [];

      const conflicts: ScheduleConflict[] = [];

      // 1. Time overlap detection
      const conflictingItems = calendarData.items.filter((other) => {
        if (other.id === itemId) return false;

        const newDateStart = startOfDay(newDate);
        const newDateEnd = endOfDay(newDate);
        const otherStart = startOfDay(other.startDate);
        const otherEnd = endOfDay(other.endDate || other.startDate);

        return (
          newDateStart < otherEnd &&
          newDateEnd > otherStart
        );
      });

      if (conflictingItems.length > 0) {
        conflicts.push({
          id: `conflict-${Date.now()}`,
          type: 'time-overlap',
          severity: conflictingItems.length > 2 ? 'critical' : 'warning',
          message: `${conflictingItems.length} event(s) overlap with this time`,
          conflictingItems,
        });
      }

      // 2. Platform overload detection (max 3 posts per platform per day)
      if (item.platforms && item.platforms.length > 0) {
        for (const platform of item.platforms) {
          const platformItems = calendarData.items.filter((other) =>
            other.platforms?.includes(platform) &&
            isSameDay(other.startDate, newDate) &&
            other.id !== itemId
          );

          if (platformItems.length >= 3) {
            conflicts.push({
              id: `platform-overload-${platform}-${Date.now()}`,
              type: 'platform-overload',
              severity: 'warning',
              message: `Maximum 3 posts per day reached for ${platform}`,
              conflictingItems: platformItems,
            });
          }
        }
      }

      // 3. Resource conflict detection (same assignee)
      if (item.assignee) {
        const assigneeConflicts = calendarData.items.filter((other) =>
          other.assignee === item.assignee &&
          other.id !== itemId &&
          isSameDay(other.startDate, newDate)
        );

        if (assigneeConflicts.length > 0) {
          conflicts.push({
            id: `resource-conflict-${item.assignee}-${Date.now()}`,
            type: 'resource-conflict',
            severity: 'warning',
            message: `${item.assignee} has overlapping events`,
            conflictingItems: assigneeConflicts,
          });
        }
      }

      // 4. Deadline violation detection
      if (item.dueDate && newDate > item.dueDate) {
        conflicts.push({
          id: `deadline-violation-${itemId}-${Date.now()}`,
          type: 'deadline-violation',
          severity: 'error',
          message: 'Scheduled date is after deadline',
          conflictingItems: [item],
        });
      }

      return conflicts;
    },

    resolveConflict: (resolution) => {
      set((state) => {
        if (!state.calendarData) return;

        // Apply rescheduled items
        for (const { itemId, newDate } of resolution.rescheduledItems) {
          const item = state.calendarData.items.find((i) => i.id === itemId);
          if (item) {
            item.startDate = newDate;
            item.updatedAt = new Date();
          }
        }

        // Remove cancelled items
        state.calendarData.items = state.calendarData.items.filter(
          (item) => !resolution.cancelledItems.includes(item.id)
        );

        state.calendarData.updatedAt = new Date();

        // Update conflicts list
        state.conflicts = state.conflicts.filter(
          (c) => !resolution.rescheduledItems.some((r) => r.itemId === c.conflictingItems[0]?.id)
        );

        if (state.conflicts.length === 0) {
          state.showConflictDialog = false;
        }
      });
    },

    dismissConflict: (conflictId) => {
      set((state) => {
        state.conflicts = state.conflicts.filter((c) => c.id !== conflictId);
        if (state.conflicts.length === 0) {
          state.showConflictDialog = false;
        }
      });
    },

    // ============================================
    // Drag and Drop
    // ============================================

    startDrag: (item) => {
      set((state) => {
        state.dragDrop.draggedItem = item;
        state.dragDrop.isDragOver = true;
      });
    },

    endDrag: () => {
      set((state) => {
        state.dragDrop.draggedItem = null;
        state.dragDrop.isDragOver = false;
        state.dragDrop.dropTargetDate = null;
      });
    },

    handleDrop: (itemId, targetDate) => {
      set((state) => {
        // Check for conflicts first
        const conflicts = get().checkConflicts(itemId, targetDate);

        if (conflicts.length > 0) {
          state.conflicts = conflicts;
          state.showConflictDialog = true;
        } else {
          // No conflicts, update the item date
          const item = state.calendarData?.items.find((i) => i.id === itemId);
          if (item) {
            item.startDate = targetDate;
            item.updatedAt = new Date();
            state.calendarData!.updatedAt = new Date();
          }
        }

        // Reset drag state
        state.dragDrop.draggedItem = null;
        state.dragDrop.isDragOver = false;
        state.dragDrop.dropTargetDate = null;
      });
    },

    // ============================================
    // Platform Integration
    // ============================================

    addExternalConnection: (connection) => {
      set((state) => {
        state.externalConnections.push(connection);
      });
    },

    removeExternalConnection: (connectionId) => {
      set((state) => {
        state.externalConnections = state.externalConnections.filter(
          (c) => c.id !== connectionId
        );
      });
    },

    syncWithExternal: async (provider) => {
      set({ isSyncing: true, error: null });
      try {
        // Import events from external calendar
        // This would call the external calendar integration
        // Implementation depends on the specific provider API
        set({ isSyncing: false });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Sync failed',
          isSyncing: false,
        });
      }
    },

    scheduleForPlatforms: (itemId, platforms) => {
      set((state) => {
        const item = state.calendarData?.items.find((i) => i.id === itemId);
        if (item) {
          item.platforms = platforms;
          item.updatedAt = new Date();
          state.calendarData!.updatedAt = new Date();
        }
      });
    },

    // ============================================
    // Calendar Grid Generation
    // ============================================

    generateMonthGrid: (date) => {
      const year = date.getFullYear();
      const month = date.getMonth();

      // Get first day of month and total days
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const today = new Date();
      const grid: CalendarDate[] = [];

      // Add days from previous month
      const prevMonthLastDay = new Date(year, month, 0).getDate();
      for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        const gridDate = new Date(year, month - 1, day);
        grid.push({
          date: gridDate,
          isToday: gridDate.toDateString() === today.toDateString(),
          isCurrentMonth: false,
          items: get().getItemsForDate(gridDate),
        });
      }

      // Add days from current month
      for (let day = 1; day <= daysInMonth; day++) {
        const gridDate = new Date(year, month, day);
        grid.push({
          date: gridDate,
          isToday: gridDate.toDateString() === today.toDateString(),
          isCurrentMonth: true,
          items: get().getItemsForDate(gridDate),
        });
      }

      // Add days from next month to complete 42-day grid (6 weeks)
      const remainingDays = 42 - grid.length;
      for (let day = 1; day <= remainingDays; day++) {
        const gridDate = new Date(year, month + 1, day);
        grid.push({
          date: gridDate,
          isToday: gridDate.toDateString() === today.toDateString(),
          isCurrentMonth: false,
          items: get().getItemsForDate(gridDate),
        });
      }

      return grid;
    },

    generateWeekDays: (date) => {
      const weekStart = new Date(date);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - dayOfWeek);

      const today = new Date();
      const weekDays: WeekDay[] = [];

      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(weekStart);
        currentDay.setDate(weekStart.getDate() + i);

        weekDays.push({
          date: currentDay,
          day: currentDay.getDate(),
          isToday: currentDay.toDateString() === today.toDateString(),
          isCurrentMonth: currentDay.getMonth() === date.getMonth(),
          items: get().getItemsForDate(currentDay),
        });
      }

      return weekDays;
    },
  }))
);

// ============================================
// Helper Functions
// ============================================

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ============================================
// Export Types
// ============================================

export type { MarketingCalendarState };
