import { create } from 'zustand';
import type {
  CalendarData,
  CalendarItem,
  CalendarItemType,
  CalendarViewMode,
  CalendarZoomLevel,
  CalendarFilters,
  ExternalCalendarConnection,
} from '../../shared/types';
import { CALENDAR_COLORS, CALENDAR_ITEM_TYPE_LABELS } from '../../shared/constants';
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

/**
 * Calendar Store - State management for calendar feature
 */
interface CalendarState {
  // Data
  calendarData: CalendarData | null;
  externalConnections: ExternalCalendarConnection[];
  selectedItem: CalendarItem | null;
  hoveredItem: CalendarItem | null;

  // UI State
  isLoading: boolean;
  error: string | null;

  // View Settings
  currentDate: Date;
  viewMode: CalendarViewMode;
  zoomLevel: CalendarZoomLevel;
  filters: CalendarFilters;

  // Actions
  setCalendarData: (data: CalendarData | null) => void;
  setExternalConnections: (connections: ExternalCalendarConnection[]) => void;
  setSelectedItem: (item: CalendarItem | null) => void;
  setHoveredItem: (item: CalendarItem | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // View Actions
  setCurrentDate: (date: Date) => void;
  setViewMode: (mode: CalendarViewMode) => void;
  setZoomLevel: (level: CalendarZoomLevel) => void;
  setFilters: (filters: Partial<CalendarFilters>) => void;
  clearFilters: () => void;

  // Navigation
  goToToday: () => void;
  navigatePrev: () => void;
  navigateNext: () => void;

  // Item Actions
  addItem: (item: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateItem: (id: string, updates: Partial<Omit<CalendarItem, 'id'>>) => void;
  deleteItem: (id: string) => void;
  updateItemDate: (id: string, startDate: Date, endDate?: Date) => void;

  // Filtering Helpers
  getFilteredItems: () => CalendarItem[];
  getItemsForDate: (date: Date) => CalendarItem[];
  getItemsInRange: (start: Date, end: Date) => CalendarItem[];
}

const defaultFilters: CalendarFilters = {
  itemTypes: [],
  status: [],
  sources: [],
  tags: [],
  searchQuery: '',
};

const createEmptyCalendarData = (projectId: string): CalendarData => ({
  projectId,
  items: [],
  viewMode: 'month',
  zoomLevel: 'day',
  currentDate: new Date(),
  filters: defaultFilters,
  updatedAt: new Date(),
});

export const useCalendarStore = create<CalendarState>((set, get) => ({
  // Initial state
  calendarData: null,
  externalConnections: [],
  selectedItem: null,
  hoveredItem: null,
  isLoading: false,
  error: null,
  currentDate: new Date(),
  viewMode: 'month',
  zoomLevel: 'day',
  filters: defaultFilters,

  // Setters
  setCalendarData: (data) => set({ calendarData: data }),

  setExternalConnections: (connections) => set({ externalConnections: connections }),

  setSelectedItem: (item) => set({ selectedItem: item }),

  setHoveredItem: (item) => set({ hoveredItem: item }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  // View Actions
  setCurrentDate: (date) => set({ currentDate: date }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setZoomLevel: (level) => set({ zoomLevel: level }),

  setFilters: (partialFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...partialFilters },
    })),

  clearFilters: () =>
    set({
      filters: defaultFilters,
    }),

  // Navigation
  goToToday: () => set({ currentDate: new Date() }),

  navigatePrev: () =>
    set((state) => {
      const { zoomLevel, currentDate } = state;
      switch (zoomLevel) {
        case 'day':
          return { currentDate: addMonths(currentDate, -1) };
        case 'week':
          return { currentDate: addMonths(currentDate, -1) };
        case 'month':
          return { currentDate: subMonths(currentDate, 1) };
        case 'quarter':
          return { currentDate: subMonths(currentDate, 3) };
        default:
          return { currentDate: subMonths(currentDate, 1) };
      }
    }),

  navigateNext: () =>
    set((state) => {
      const { zoomLevel, currentDate } = state;
      switch (zoomLevel) {
        case 'day':
          return { currentDate: addMonths(currentDate, 1) };
        case 'week':
          return { currentDate: addMonths(currentDate, 1) };
        case 'month':
          return { currentDate: addMonths(currentDate, 1) };
        case 'quarter':
          return { currentDate: addMonths(currentDate, 3) };
        default:
          return { currentDate: addMonths(currentDate, 1) };
      }
    }),

  // Item Actions
  addItem: (itemData) => {
    const newItem: CalendarItem = {
      ...itemData,
      id: `calendar-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set((state) => {
      if (!state.calendarData) return state;
      return {
        calendarData: {
          ...state.calendarData,
          items: [...state.calendarData.items, newItem],
          updatedAt: new Date(),
        },
      };
    });

    return newItem.id;
  },

  updateItem: (id, updates) =>
    set((state) => {
      if (!state.calendarData) return state;

      const updatedItems = state.calendarData.items.map((item) =>
        item.id === id
          ? { ...item, ...updates, updatedAt: new Date() }
          : item
      );

      return {
        calendarData: {
          ...state.calendarData,
          items: updatedItems,
          updatedAt: new Date(),
        },
        selectedItem:
          state.selectedItem?.id === id
            ? { ...state.selectedItem, ...updates, updatedAt: new Date() }
            : state.selectedItem,
      };
    }),

  deleteItem: (id) =>
    set((state) => {
      if (!state.calendarData) return state;

      return {
        calendarData: {
          ...state.calendarData,
          items: state.calendarData.items.filter((item) => item.id !== id),
          updatedAt: new Date(),
        },
        selectedItem: state.selectedItem?.id === id ? null : state.selectedItem,
      };
    }),

  updateItemDate: (id, startDate, endDate) =>
    set((state) => {
      if (!state.calendarData) return state;

      const updatedItems = state.calendarData.items.map((item) =>
        item.id === id
          ? { ...item, startDate, endDate, updatedAt: new Date() }
          : item
      );

      return {
        calendarData: {
          ...state.calendarData,
          items: updatedItems,
          updatedAt: new Date(),
        },
        selectedItem:
          state.selectedItem?.id === id
            ? { ...state.selectedItem, startDate, endDate, updatedAt: new Date() }
            : state.selectedItem,
      };
    }),

  // Filtering Helpers
  getFilteredItems: () => {
    const { calendarData, filters } = get();
    if (!calendarData) return [];

    let items = calendarData.items;

    // Filter by item type
    if (filters.itemTypes.length > 0) {
      items = items.filter((item) => filters.itemTypes.includes(item.type));
    }

    // Filter by status
    if (filters.status.length > 0) {
      items = items.filter((item) => filters.status.includes(item.status));
    }

    // Filter by source
    if (filters.sources.length > 0) {
      items = items.filter((item) => filters.sources.includes(item.source));
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
    const { calendarData } = get();
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
    const { calendarData } = get();
    if (!calendarData) return [];

    return calendarData.items.filter((item) => {
      const itemEnd = item.endDate || item.startDate;
      return item.startDate <= end && itemEnd >= start;
    });
  },
}));

// Helper function to normalize dates for comparison
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
// Helper Functions for Calendar Operations
// ============================================

/**
 * Load calendar data for a project
 */
export async function loadCalendarData(projectId: string): Promise<void> {
  const store = useCalendarStore.getState();
  store.setLoading(true);
  store.setError(null);

  try {
    const result = await window.electronAPI.getCalendarData(projectId);
    if (result.success && result.data) {
      store.setCalendarData(result.data);
    } else {
      store.setCalendarData(createEmptyCalendarData(projectId));
    }
  } catch (error) {
    console.error('[Calendar] Failed to load calendar data:', error);
    store.setError(
      error instanceof Error ? error.message : 'Failed to load calendar data'
    );
    store.setCalendarData(createEmptyCalendarData(projectId));
  } finally {
    store.setLoading(false);
  }
}

/**
 * Save calendar data
 */
export async function saveCalendarData(projectId: string): Promise<void> {
  const store = useCalendarStore.getState();
  const { calendarData } = store;

  if (!calendarData) {
    console.warn('[Calendar] No calendar data to save');
    return;
  }

  try {
    const result = await window.electronAPI.saveCalendarData(projectId, calendarData);
    if (!result.success) {
      throw new Error(result.error || 'Failed to save calendar data');
    }
  } catch (error) {
    console.error('[Calendar] Failed to save calendar data:', error);
    store.setError(
      error instanceof Error ? error.message : 'Failed to save calendar data'
    );
    throw error;
  }
}

/**
 * Aggregate items from roadmap phases
 */
export function aggregateFromRoadmap(roadmap: any): CalendarItem[] {
  const items: CalendarItem[] = [];
  const now = new Date();

  if (!roadmap || !roadmap.phases) return items;

  roadmap.phases.forEach((phase: any, index: number) => {
    // Estimate phase dates based on order (rough approximation)
    const startDate = addMonths(now, index * 2);
    const endDate = addMonths(startDate, 2);

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

  return items;
}

/**
 * Get color for item type
 */
export function getItemColor(type: CalendarItemType): typeof CALENDAR_COLORS[CalendarItemType] {
  return CALENDAR_COLORS[type] || CALENDAR_COLORS.event;
}

/**
 * Get label for item type
 */
export function getItemTypeLabel(type: CalendarItemType): string {
  return CALENDAR_ITEM_TYPE_LABELS[type] || 'Event';
}
