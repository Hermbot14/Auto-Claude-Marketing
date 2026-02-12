/**
 * Integration tests for Calendar workflows
 * Tests calendar CRUD operations, filtering, and view switching
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCalendarStore, loadCalendarData, saveCalendarData, aggregateFromRoadmap, getItemColor, getItemTypeLabel } from '../../renderer/stores/calendarStore';
import type { CalendarItem, CalendarData } from '../../shared/types';
import { CALENDAR_COLORS, CALENDAR_ITEM_TYPE_LABELS } from '../../shared/constants';

// Helper to create test calendar item
function createTestItem(overrides: Partial<CalendarItem> = {}): CalendarItem {
  const now = new Date();
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    title: 'Test Item',
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

// Helper to create test calendar data
function createTestData(overrides: Partial<CalendarData> = {}): CalendarData {
  const now = new Date();
  return {
    projectId: 'test-project',
    items: [],
    viewMode: 'month',
    zoomLevel: 'day',
    currentDate: now,
    filters: {
      itemTypes: [],
      status: [],
      sources: [],
      tags: [],
      searchQuery: '',
    },
    updatedAt: now,
    ...overrides,
  };
}

// Mock window.electronAPI
const mockElectronAPI = {
  getCalendarData: vi.fn(),
  saveCalendarData: vi.fn(),
};

describe('Calendar Integration Tests - CRUD Workflow', () => {
  beforeEach(() => {
    // Reset store state
    useCalendarStore.setState({
      calendarData: null,
      externalConnections: [],
      selectedItem: null,
      hoveredItem: null,
      isLoading: false,
      error: null,
      currentDate: new Date(),
      viewMode: 'month',
      zoomLevel: 'day',
      filters: {
        itemTypes: [],
        status: [],
        sources: [],
        tags: [],
        searchQuery: '',
      },
    });

    // Reset mocks
    vi.clearAllMocks();

    // Setup mock electronAPI
    (window as any).electronAPI = mockElectronAPI;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Item Workflow', () => {
    it('should create item and add to calendar', () => {
      const testData = createTestData({ items: [] });
      useCalendarStore.getState().setCalendarData(testData);

      const newItemData = {
        title: 'New Campaign Event',
        type: 'campaign' as const,
        status: 'scheduled' as const,
        source: 'manual' as const,
        startDate: new Date('2024-06-20T10:00:00Z'),
        endDate: new Date('2024-06-20T12:00:00Z'),
        allDay: false,
        description: 'New marketing campaign launch',
        tags: ['marketing', 'launch'],
      };

      act(() => {
        useCalendarStore.getState().addItem(newItemData);
      });

      const state = useCalendarStore.getState();
      expect(state.calendarData?.items).toHaveLength(1);
      expect(state.calendarData?.items[0].title).toBe('New Campaign Event');
      expect(state.calendarData?.items[0].type).toBe('campaign');
      expect(state.calendarData?.items[0].tags).toEqual(['marketing', 'launch']);
    });

    it('should create multiple items in sequence', () => {
      const testData = createTestData({ items: [] });
      useCalendarStore.getState().setCalendarData(testData);

      const itemsToAdd = [
        { title: 'Event 1', type: 'event' as const, status: 'scheduled' as const, source: 'manual' as const, startDate: new Date(), allDay: false },
        { title: 'Event 2', type: 'content' as const, status: 'draft' as const, source: 'manual' as const, startDate: new Date(), allDay: false },
        { title: 'Event 3', type: 'social' as const, status: 'published' as const, source: 'manual' as const, startDate: new Date(), allDay: false },
      ];

      act(() => {
        itemsToAdd.forEach((itemData) => {
          useCalendarStore.getState().addItem(itemData);
        });
      });

      const state = useCalendarStore.getState();
      expect(state.calendarData?.items).toHaveLength(3);
      expect(state.calendarData?.items.map((i) => i.title)).toEqual(['Event 1', 'Event 2', 'Event 3']);
    });

    it('should create all-day event', () => {
      const testData = createTestData({ items: [] });
      useCalendarStore.getState().setCalendarData(testData);

      act(() => {
        useCalendarStore.getState().addItem({
          title: 'All Day Conference',
          type: 'event',
          status: 'scheduled',
          source: 'manual',
          startDate: new Date('2024-06-20T00:00:00Z'),
          allDay: true,
        });
      });

      const state = useCalendarStore.getState();
      expect(state.calendarData?.items[0].allDay).toBe(true);
      expect(state.calendarData?.items[0].endDate).toBeUndefined();
    });
  });

  describe('Read Item Workflow', () => {
    it('should retrieve items for specific date', () => {
      const targetDate = new Date('2024-06-15T12:00:00Z');
      const items = [
        createTestItem({
          id: 'item-1',
          title: 'Morning Event',
          startDate: new Date('2024-06-15T09:00:00Z'),
          endDate: new Date('2024-06-15T11:00:00Z'),
        }),
        createTestItem({
          id: 'item-2',
          title: 'Afternoon Event',
          startDate: new Date('2024-06-15T14:00:00Z'),
          endDate: new Date('2024-06-15T16:00:00Z'),
        }),
        createTestItem({
          id: 'item-3',
          title: 'Different Day Event',
          startDate: new Date('2024-06-16T10:00:00Z'),
          endDate: new Date('2024-06-16T12:00:00Z'),
        }),
      ];

      const testData = createTestData({ items });
      useCalendarStore.getState().setCalendarData(testData);

      const itemsForDate = useCalendarStore.getState().getItemsForDate(targetDate);
      expect(itemsForDate).toHaveLength(2);
      expect(itemsForDate.map((i) => i.title)).toEqual(['Morning Event', 'Afternoon Event']);
    });

    it('should retrieve items in date range', () => {
      const items = [
        createTestItem({
          id: 'item-1',
          title: 'Event in Range',
          startDate: new Date('2024-06-15T10:00:00Z'),
          endDate: new Date('2024-06-15T12:00:00Z'),
        }),
        createTestItem({
          id: 'item-2',
          title: 'Event Before Range',
          startDate: new Date('2024-06-01T10:00:00Z'),
          endDate: new Date('2024-06-01T12:00:00Z'),
        }),
        createTestItem({
          id: 'item-3',
          title: 'Event After Range',
          startDate: new Date('2024-06-30T10:00:00Z'),
          endDate: new Date('2024-06-30T12:00:00Z'),
        }),
      ];

      const testData = createTestData({ items });
      useCalendarStore.getState().setCalendarData(testData);

      const itemsInRange = useCalendarStore.getState().getItemsInRange(
        new Date('2024-06-10T00:00:00Z'),
        new Date('2024-06-20T23:59:59Z')
      );

      expect(itemsInRange).toHaveLength(1);
      expect(itemsInRange[0].title).toBe('Event in Range');
    });

    it('should retrieve items with filter applied', () => {
      const items = [
        createTestItem({ id: 'item-1', title: 'Campaign A', type: 'campaign', status: 'scheduled', source: 'manual', startDate: new Date() }),
        createTestItem({ id: 'item-2', title: 'Content B', type: 'content', status: 'published', source: 'manual', startDate: new Date() }),
        createTestItem({ id: 'item-3', title: 'Campaign B', type: 'campaign', status: 'published', source: 'manual', startDate: new Date() }),
      ];

      const testData = createTestData({ items });
      useCalendarStore.getState().setCalendarData(testData);

      // Filter by type
      useCalendarStore.getState().setFilters({ itemTypes: ['campaign'] });
      let filtered = useCalendarStore.getState().getFilteredItems();
      expect(filtered).toHaveLength(2);

      // Add status filter
      useCalendarStore.getState().setFilters({ itemTypes: ['campaign'], status: ['published'] });
      filtered = useCalendarStore.getState().getFilteredItems();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Campaign B');
    });
  });

  describe('Update Item Workflow', () => {
    it('should update item properties', () => {
      const item = createTestItem({
        id: 'item-1',
        title: 'Original Title',
        status: 'draft',
        priority: 'low',
      });
      const testData = createTestData({ items: [item] });
      useCalendarStore.getState().setCalendarData(testData);

      act(() => {
        useCalendarStore.getState().updateItem('item-1', {
          title: 'Updated Title',
          status: 'published',
          priority: 'high',
        });
      });

      const state = useCalendarStore.getState();
      const updatedItem = state.calendarData?.items[0];
      expect(updatedItem?.title).toBe('Updated Title');
      expect(updatedItem?.status).toBe('published');
      expect(updatedItem?.priority).toBe('high');
      expect(updatedItem?.updatedAt.getTime()).toBeGreaterThan(item.updatedAt.getTime());
    });

    it('should update item date', () => {
      const item = createTestItem({
        id: 'item-1',
        startDate: new Date('2024-06-15T10:00:00Z'),
        endDate: new Date('2024-06-15T11:00:00Z'),
      });
      const testData = createTestData({ items: [item] });
      useCalendarStore.getState().setCalendarData(testData);

      act(() => {
        useCalendarStore.getState().updateItemDate(
          'item-1',
          new Date('2024-06-20T14:00:00Z'),
          new Date('2024-06-20T16:00:00Z')
        );
      });

      const state = useCalendarStore.getState();
      const updatedItem = state.calendarData?.items[0];
      expect(updatedItem?.startDate).toEqual(new Date('2024-06-20T14:00:00Z'));
      expect(updatedItem?.endDate).toEqual(new Date('2024-06-20T16:00:00Z'));
    });

    it('should update selected item synchronously', () => {
      const item = createTestItem({ id: 'item-1', title: 'Original' });
      const testData = createTestData({ items: [item] });
      useCalendarStore.getState().setCalendarData(testData);
      useCalendarStore.getState().setSelectedItem(item);

      act(() => {
        useCalendarStore.getState().updateItem('item-1', { title: 'Updated' });
      });

      const state = useCalendarStore.getState();
      expect(state.selectedItem?.title).toBe('Updated');
    });
  });

  describe('Delete Item Workflow', () => {
    it('should delete item from calendar', () => {
      const items = [
        createTestItem({ id: 'item-1' }),
        createTestItem({ id: 'item-2' }),
        createTestItem({ id: 'item-3' }),
      ];
      const testData = createTestData({ items });
      useCalendarStore.getState().setCalendarData(testData);

      act(() => {
        useCalendarStore.getState().deleteItem('item-2');
      });

      const state = useCalendarStore.getState();
      expect(state.calendarData?.items).toHaveLength(2);
      expect(state.calendarData?.items.map((i) => i.id)).toEqual(['item-1', 'item-3']);
    });

    it('should clear selected item when deleted', () => {
      const item = createTestItem({ id: 'item-1' });
      const testData = createTestData({ items: [item] });
      useCalendarStore.getState().setCalendarData(testData);
      useCalendarStore.getState().setSelectedItem(item);

      act(() => {
        useCalendarStore.getState().deleteItem('item-1');
      });

      const state = useCalendarStore.getState();
      expect(state.selectedItem).toBeNull();
    });
  });

  describe('Filter Workflow', () => {
    beforeEach(() => {
      const items = [
        createTestItem({
          id: 'item-1',
          title: 'Campaign Launch',
          type: 'campaign',
          status: 'scheduled',
          source: 'roadmap',
          tags: ['marketing', 'urgent'],
          startDate: new Date('2024-06-15T10:00:00Z'),
        }),
        createTestItem({
          id: 'item-2',
          title: 'Blog Post Draft',
          type: 'content',
          status: 'draft',
          source: 'file',
          tags: ['content', 'blog'],
          startDate: new Date('2024-06-16T10:00:00Z'),
        }),
        createTestItem({
          id: 'item-3',
          title: 'Social Media Post',
          type: 'social',
          status: 'published',
          source: 'manual',
          tags: ['social', 'twitter'],
          startDate: new Date('2024-06-17T10:00:00Z'),
        }),
        createTestItem({
          id: 'item-4',
          title: 'Email Newsletter',
          type: 'email',
          status: 'scheduled',
          source: 'manual',
          tags: ['email', 'newsletter'],
          startDate: new Date('2024-06-18T10:00:00Z'),
        }),
      ];
      const testData = createTestData({ items });
      useCalendarStore.getState().setCalendarData(testData);
    });

    it('should apply multiple filters simultaneously', () => {
      act(() => {
        useCalendarStore.getState().setFilters({
          itemTypes: ['campaign', 'social'],
          status: ['scheduled', 'published'],
        });
      });

      const filtered = useCalendarStore.getState().getFilteredItems();
      expect(filtered).toHaveLength(2);
      expect(filtered.map((i) => i.id)).toEqual(['item-1', 'item-3']);
    });

    it('should clear all filters', () => {
      act(() => {
        useCalendarStore.getState().setFilters({
          itemTypes: ['campaign'],
          status: ['scheduled'],
          sources: ['roadmap'],
          tags: ['urgent'],
          searchQuery: 'campaign',
        });
      });

      let filtered = useCalendarStore.getState().getFilteredItems();
      expect(filtered).toHaveLength(1);

      act(() => {
        useCalendarStore.getState().clearFilters();
      });

      filtered = useCalendarStore.getState().getFilteredItems();
      expect(filtered).toHaveLength(4);
    });

    it('should filter by search query across title, description, and tags', () => {
      act(() => {
        useCalendarStore.getState().setFilters({ searchQuery: 'post' });
      });

      const filtered = useCalendarStore.getState().getFilteredItems();
      expect(filtered).toHaveLength(2); // 'Blog Post Draft', 'Social Media Post'
    });

    it('should filter by date range', () => {
      act(() => {
        useCalendarStore.getState().setFilters({
          dateRange: {
            start: new Date('2024-06-16T00:00:00Z'),
            end: new Date('2024-06-17T23:59:59Z'),
          },
        });
      });

      const filtered = useCalendarStore.getState().getFilteredItems();
      expect(filtered).toHaveLength(2);
      expect(filtered.map((i) => i.id)).toEqual(['item-2', 'item-3']);
    });

    it('should combine search query with other filters', () => {
      act(() => {
        useCalendarStore.getState().setFilters({
          itemTypes: ['campaign', 'content'],
          searchQuery: 'launch',
        });
      });

      const filtered = useCalendarStore.getState().getFilteredItems();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Campaign Launch');
    });
  });

  describe('View Switching Workflow', () => {
    it('should switch between view modes', () => {
      expect(useCalendarStore.getState().viewMode).toBe('month');

      act(() => {
        useCalendarStore.getState().setViewMode('week');
      });
      expect(useCalendarStore.getState().viewMode).toBe('week');

      act(() => {
        useCalendarStore.getState().setViewMode('day');
      });
      expect(useCalendarStore.getState().viewMode).toBe('day');
    });

    it('should switch between zoom levels', () => {
      expect(useCalendarStore.getState().zoomLevel).toBe('day');

      act(() => {
        useCalendarStore.getState().setZoomLevel('week');
      });
      expect(useCalendarStore.getState().zoomLevel).toBe('week');

      act(() => {
        useCalendarStore.getState().setZoomLevel('month');
      });
      expect(useCalendarStore.getState().zoomLevel).toBe('month');

      act(() => {
        useCalendarStore.getState().setZoomLevel('quarter');
      });
      expect(useCalendarStore.getState().zoomLevel).toBe('quarter');
    });

    it('should navigate previous with different zoom levels', () => {
      const initialDate = new Date('2024-06-15T00:00:00Z');
      useCalendarStore.getState().setCurrentDate(initialDate);

      // Day zoom
      act(() => {
        useCalendarStore.getState().setZoomLevel('day');
        useCalendarStore.getState().navigatePrev();
      });
      let currentDate = useCalendarStore.getState().currentDate;
      expect(currentDate.getMonth()).toBe(5); // Still June (day zoom adds -1 month)

      // Month zoom
      act(() => {
        useCalendarStore.getState().setZoomLevel('month');
        useCalendarStore.getState().navigatePrev();
      });
      currentDate = useCalendarStore.getState().currentDate;
      expect(currentDate.getMonth()).toBe(4); // May

      // Quarter zoom
      act(() => {
        useCalendarStore.getState().setZoomLevel('quarter');
        useCalendarStore.getState().navigatePrev();
      });
      currentDate = useCalendarStore.getState().currentDate;
      expect(currentDate.getMonth()).toBe(1); // February
    });

    it('should navigate next with different zoom levels', () => {
      const initialDate = new Date('2024-06-15T00:00:00Z');
      useCalendarStore.getState().setCurrentDate(initialDate);

      // Month zoom
      act(() => {
        useCalendarStore.getState().setZoomLevel('month');
        useCalendarStore.getState().navigateNext();
      });
      let currentDate = useCalendarStore.getState().currentDate;
      expect(currentDate.getMonth()).toBe(6); // July

      // Quarter zoom
      act(() => {
        useCalendarStore.getState().setZoomLevel('quarter');
        useCalendarStore.getState().navigateNext();
      });
      currentDate = useCalendarStore.getState().currentDate;
      expect(currentDate.getMonth()).toBe(9); // October
    });

    it('should navigate to today', () => {
      const pastDate = new Date('2024-01-01T00:00:00Z');
      useCalendarStore.getState().setCurrentDate(pastDate);

      act(() => {
        useCalendarStore.getState().goToToday();
      });

      const currentDate = useCalendarStore.getState().currentDate;
      const today = new Date();
      expect(currentDate.toDateString()).toBe(today.toDateString());
    });
  });

  describe('Data Persistence Workflow', () => {
    it('should load calendar data from API', async () => {
      const mockData: CalendarData = {
        projectId: 'test-project',
        items: [
          createTestItem({ id: 'loaded-1', title: 'Loaded Event' }),
        ],
        viewMode: 'month',
        zoomLevel: 'day',
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

      mockElectronAPI.getCalendarData.mockResolvedValue({
        success: true,
        data: mockData,
      });

      await loadCalendarData('test-project');

      const state = useCalendarStore.getState();
      expect(state.calendarData).toEqual(mockData);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should create empty data when API returns no data', async () => {
      mockElectronAPI.getCalendarData.mockResolvedValue({
        success: false,
        error: 'No data found',
      });

      await loadCalendarData('test-project');

      const state = useCalendarStore.getState();
      expect(state.calendarData).not.toBeNull();
      expect(state.calendarData?.projectId).toBe('test-project');
      expect(state.calendarData?.items).toHaveLength(0);
      expect(state.isLoading).toBe(false);
    });

    it('should handle API errors gracefully', async () => {
      mockElectronAPI.getCalendarData.mockRejectedValue(new Error('Network error'));

      await loadCalendarData('test-project');

      const state = useCalendarStore.getState();
      expect(state.calendarData).not.toBeNull(); // Creates empty data as fallback
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });

    it('should save calendar data to API', async () => {
      const testData = createTestData({
        items: [createTestItem({ id: 'save-1', title: 'Save Test' })],
      });
      useCalendarStore.getState().setCalendarData(testData);

      mockElectronAPI.saveCalendarData.mockResolvedValue({
        success: true,
      });

      await saveCalendarData('test-project');

      expect(mockElectronAPI.saveCalendarData).toHaveBeenCalledWith('test-project', testData);
    });

    it('should handle save errors', async () => {
      const testData = createTestData({ items: [] });
      useCalendarStore.getState().setCalendarData(testData);

      mockElectronAPI.saveCalendarData.mockResolvedValue({
        success: false,
        error: 'Save failed',
      });

      await expect(saveCalendarData('test-project')).rejects.toThrow();
      expect(useCalendarStore.getState().error).toBe('Save failed');
    });
  });

  describe('Helper Functions', () => {
    it('should get correct color for item type', () => {
      expect(getItemColor('campaign')).toEqual(CALENDAR_COLORS.campaign);
      expect(getItemColor('content')).toEqual(CALENDAR_COLORS.content);
      expect(getItemColor('social')).toEqual(CALENDAR_COLORS.social);
      expect(getItemColor('email')).toEqual(CALENDAR_COLORS.email);
      expect(getItemColor('seo')).toEqual(CALENDAR_COLORS.seo);
      expect(getItemColor('deadline')).toEqual(CALENDAR_COLORS.deadline);
      expect(getItemColor('event')).toEqual(CALENDAR_COLORS.event);
    });

    it('should get correct label for item type', () => {
      expect(getItemTypeLabel('campaign')).toBe(CALENDAR_ITEM_TYPE_LABELS.campaign);
      expect(getItemTypeLabel('content')).toBe(CALENDAR_ITEM_TYPE_LABELS.content);
      expect(getItemTypeLabel('social')).toBe(CALENDAR_ITEM_TYPE_LABELS.social);
      expect(getItemTypeLabel('email')).toBe(CALENDAR_ITEM_TYPE_LABELS.email);
      expect(getItemTypeLabel('seo')).toBe(CALENDAR_ITEM_TYPE_LABELS.seo);
      expect(getItemTypeLabel('deadline')).toBe(CALENDAR_ITEM_TYPE_LABELS.deadline);
      expect(getItemTypeLabel('event')).toBe(CALENDAR_ITEM_TYPE_LABELS.event);
    });

    it('should aggregate items from roadmap', () => {
      const roadmap = {
        phases: [
          {
            id: 'phase-1',
            name: 'Phase 1 Campaign',
            description: 'Initial marketing push',
            status: 'completed',
          },
          {
            id: 'phase-2',
            name: 'Phase 2 Campaign',
            description: 'Follow-up campaign',
            status: 'in-progress',
          },
          {
            id: 'phase-3',
            name: 'Phase 3 Campaign',
            description: 'Final push',
            status: 'pending',
          },
        ],
      };

      const items = aggregateFromRoadmap(roadmap);

      expect(items).toHaveLength(3);
      expect(items[0].title).toBe('Phase 1 Campaign');
      expect(items[0].type).toBe('campaign');
      expect(items[0].status).toBe('published'); // completed -> published
      expect(items[0].linkedFeatureId).toBe('phase-1');

      expect(items[1].title).toBe('Phase 2 Campaign');
      expect(items[1].status).toBe('scheduled'); // in-progress -> scheduled

      expect(items[2].title).toBe('Phase 3 Campaign');
      expect(items[2].status).toBe('scheduled'); // pending -> scheduled
    });

    it('should handle empty roadmap', () => {
      const items = aggregateFromRoadmap({});
      expect(items).toHaveLength(0);
    });

    it('should handle roadmap without phases', () => {
      const items = aggregateFromRoadmap({ phases: null });
      expect(items).toHaveLength(0);
    });
  });

  describe('Selection Workflow', () => {
    it('should select and deselect items', () => {
      const item = createTestItem({ id: 'select-1' });
      const testData = createTestData({ items: [item] });
      useCalendarStore.getState().setCalendarData(testData);

      // Select item
      act(() => {
        useCalendarStore.getState().setSelectedItem(item);
      });
      expect(useCalendarStore.getState().selectedItem).toEqual(item);

      // Deselect item
      act(() => {
        useCalendarStore.getState().setSelectedItem(null);
      });
      expect(useCalendarStore.getState().selectedItem).toBeNull();
    });

    it('should track hovered item', () => {
      const item = createTestItem({ id: 'hover-1' });

      act(() => {
        useCalendarStore.getState().setHoveredItem(item);
      });
      expect(useCalendarStore.getState().hoveredItem).toEqual(item);

      act(() => {
        useCalendarStore.getState().setHoveredItem(null);
      });
      expect(useCalendarStore.getState().hoveredItem).toBeNull();
    });
  });

  describe('Error Handling Workflow', () => {
    it('should set and clear error state', () => {
      act(() => {
        useCalendarStore.getState().setError('Test error');
      });
      expect(useCalendarStore.getState().error).toBe('Test error');

      act(() => {
        useCalendarStore.getState().setError(null);
      });
      expect(useCalendarStore.getState().error).toBeNull();
    });

    it('should set loading state during operations', () => {
      expect(useCalendarStore.getState().isLoading).toBe(false);

      act(() => {
        useCalendarStore.getState().setLoading(true);
      });
      expect(useCalendarStore.getState().isLoading).toBe(true);

      act(() => {
        useCalendarStore.getState().setLoading(false);
      });
      expect(useCalendarStore.getState().isLoading).toBe(false);
    });
  });
});
