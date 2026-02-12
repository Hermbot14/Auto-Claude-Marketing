/**
 * Unit tests for Calendar Store
 * Tests state management, actions, filtering, and date navigation
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type {
  CalendarData,
  CalendarItem,
  CalendarItemType,
  CalendarViewMode,
  CalendarZoomLevel,
  CalendarFilters,
} from '../../../shared/types';
import { useCalendarStore } from '../calendarStore';
import { addMonths, subMonths } from 'date-fns';

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
    endDate: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour later
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

describe('Calendar Store', () => {
  beforeEach(() => {
    // Reset store state before each test
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
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useCalendarStore.getState();

      expect(state.calendarData).toBeNull();
      expect(state.externalConnections).toEqual([]);
      expect(state.selectedItem).toBeNull();
      expect(state.hoveredItem).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.currentDate).toBeInstanceOf(Date);
      expect(state.viewMode).toBe('month');
      expect(state.zoomLevel).toBe('day');
      expect(state.filters).toEqual({
        itemTypes: [],
        status: [],
        sources: [],
        tags: [],
        searchQuery: '',
      });
    });
  });

  describe('Setters', () => {
    it('should set calendar data', () => {
      const testData = createTestData({
        items: [createTestItem({ title: 'Test Event' })],
      });

      useCalendarStore.getState().setCalendarData(testData);

      const state = useCalendarStore.getState();
      expect(state.calendarData).toEqual(testData);
    });

    it('should set external connections', () => {
      const connections = [
        {
          id: 'conn-1',
          provider: 'google',
          name: 'Google Calendar',
          enabled: true,
        },
      ];

      useCalendarStore.getState().setExternalConnections(connections);

      const state = useCalendarStore.getState();
      expect(state.externalConnections).toEqual(connections);
    });

    it('should set selected item', () => {
      const item = createTestItem({ id: 'item-1' });

      useCalendarStore.getState().setSelectedItem(item);

      const state = useCalendarStore.getState();
      expect(state.selectedItem).toEqual(item);
    });

    it('should clear selected item', () => {
      const item = createTestItem({ id: 'item-1' });
      useCalendarStore.getState().setSelectedItem(item);

      useCalendarStore.getState().setSelectedItem(null);

      const state = useCalendarStore.getState();
      expect(state.selectedItem).toBeNull();
    });

    it('should set hovered item', () => {
      const item = createTestItem({ id: 'item-1' });

      useCalendarStore.getState().setHoveredItem(item);

      const state = useCalendarStore.getState();
      expect(state.hoveredItem).toEqual(item);
    });

    it('should set loading state', () => {
      useCalendarStore.getState().setLoading(true);

      let state = useCalendarStore.getState();
      expect(state.isLoading).toBe(true);

      useCalendarStore.getState().setLoading(false);
      state = useCalendarStore.getState();
      expect(state.isLoading).toBe(false);
    });

    it('should set error', () => {
      const errorMessage = 'Test error message';

      useCalendarStore.getState().setError(errorMessage);

      let state = useCalendarStore.getState();
      expect(state.error).toBe(errorMessage);

      useCalendarStore.getState().setError(null);
      state = useCalendarStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('View Actions', () => {
    it('should set current date', () => {
      const newDate = new Date('2024-06-15T00:00:00Z');

      useCalendarStore.getState().setCurrentDate(newDate);

      const state = useCalendarStore.getState();
      expect(state.currentDate).toEqual(newDate);
    });

    it('should set view mode', () => {
      const viewMode: CalendarViewMode = 'week';

      useCalendarStore.getState().setViewMode(viewMode);

      const state = useCalendarStore.getState();
      expect(state.viewMode).toBe('week');
    });

    it('should set zoom level', () => {
      const zoomLevel: CalendarZoomLevel = 'month';

      useCalendarStore.getState().setZoomLevel(zoomLevel);

      const state = useCalendarStore.getState();
      expect(state.zoomLevel).toBe('month');
    });

    it('should set partial filters', () => {
      const partialFilters: Partial<CalendarFilters> = {
        itemTypes: ['campaign', 'content'],
      };

      useCalendarStore.getState().setFilters(partialFilters);

      const state = useCalendarStore.getState();
      expect(state.filters.itemTypes).toEqual(['campaign', 'content']);
      // Other filter values should remain
      expect(state.filters.status).toEqual([]);
      expect(state.filters.sources).toEqual([]);
    });

    it('should merge filters correctly', () => {
      useCalendarStore.getState().setFilters({ itemTypes: ['campaign'] });
      useCalendarStore.getState().setFilters({ status: ['published'] });

      const state = useCalendarStore.getState();
      expect(state.filters.itemTypes).toEqual(['campaign']);
      expect(state.filters.status).toEqual(['published']);
    });

    it('should clear all filters', () => {
      useCalendarStore.getState().setFilters({
        itemTypes: ['campaign'],
        status: ['published'],
        sources: ['roadmap'],
        tags: ['important'],
        searchQuery: 'test query',
      });

      useCalendarStore.getState().clearFilters();

      const state = useCalendarStore.getState();
      expect(state.filters).toEqual({
        itemTypes: [],
        status: [],
        sources: [],
        tags: [],
        searchQuery: '',
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to today', () => {
      const pastDate = new Date('2024-01-01T00:00:00Z');
      useCalendarStore.getState().setCurrentDate(pastDate);

      useCalendarStore.getState().goToToday();

      const state = useCalendarStore.getState();
      const today = new Date();
      expect(state.currentDate.toDateString()).toBe(today.toDateString());
    });

    it('should navigate previous with day zoom level', () => {
      const currentDate = new Date('2024-06-15T00:00:00Z');
      useCalendarStore.getState().setCurrentDate(currentDate);
      useCalendarStore.getState().setZoomLevel('day');

      useCalendarStore.getState().navigatePrev();

      const state = useCalendarStore.getState();
      const expected = addMonths(currentDate, -1);
      expect(state.currentDate.getMonth()).toBe(expected.getMonth());
    });

    it('should navigate previous with week zoom level', () => {
      const currentDate = new Date('2024-06-15T00:00:00Z');
      useCalendarStore.getState().setCurrentDate(currentDate);
      useCalendarStore.getState().setZoomLevel('week');

      useCalendarStore.getState().navigatePrev();

      const state = useCalendarStore.getState();
      const expected = addMonths(currentDate, -1);
      expect(state.currentDate.getMonth()).toBe(expected.getMonth());
    });

    it('should navigate previous with month zoom level', () => {
      const currentDate = new Date('2024-06-15T00:00:00Z');
      useCalendarStore.getState().setCurrentDate(currentDate);
      useCalendarStore.getState().setZoomLevel('month');

      useCalendarStore.getState().navigatePrev();

      const state = useCalendarStore.getState();
      const expected = subMonths(currentDate, 1);
      expect(state.currentDate.getMonth()).toBe(expected.getMonth());
    });

    it('should navigate previous with quarter zoom level', () => {
      const currentDate = new Date('2024-06-15T00:00:00Z');
      useCalendarStore.getState().setCurrentDate(currentDate);
      useCalendarStore.getState().setZoomLevel('quarter');

      useCalendarStore.getState().navigatePrev();

      const state = useCalendarStore.getState();
      const expected = subMonths(currentDate, 3);
      expect(state.currentDate.getMonth()).toBe(expected.getMonth());
    });

    it('should navigate next with day zoom level', () => {
      const currentDate = new Date('2024-06-15T00:00:00Z');
      useCalendarStore.getState().setCurrentDate(currentDate);
      useCalendarStore.getState().setZoomLevel('day');

      useCalendarStore.getState().navigateNext();

      const state = useCalendarStore.getState();
      const expected = addMonths(currentDate, 1);
      expect(state.currentDate.getMonth()).toBe(expected.getMonth());
    });

    it('should navigate next with month zoom level', () => {
      const currentDate = new Date('2024-06-15T00:00:00Z');
      useCalendarStore.getState().setCurrentDate(currentDate);
      useCalendarStore.getState().setZoomLevel('month');

      useCalendarStore.getState().navigateNext();

      const state = useCalendarStore.getState();
      const expected = addMonths(currentDate, 1);
      expect(state.currentDate.getMonth()).toBe(expected.getMonth());
    });

    it('should navigate next with quarter zoom level', () => {
      const currentDate = new Date('2024-06-15T00:00:00Z');
      useCalendarStore.getState().setCurrentDate(currentDate);
      useCalendarStore.getState().setZoomLevel('quarter');

      useCalendarStore.getState().navigateNext();

      const state = useCalendarStore.getState();
      const expected = addMonths(currentDate, 3);
      expect(state.currentDate.getMonth()).toBe(expected.getMonth());
    });
  });

  describe('Item Actions', () => {
    beforeEach(() => {
      const testData = createTestData({ items: [] });
      useCalendarStore.getState().setCalendarData(testData);
    });

    it('should add item and generate ID', () => {
      const itemData = {
        title: 'New Event',
        type: 'event' as CalendarItemType,
        status: 'scheduled' as const,
        source: 'manual' as const,
        startDate: new Date(),
        endDate: new Date(Date.now() + 3600000),
        allDay: false,
      };

      const itemId = useCalendarStore.getState().addItem(itemData);

      const state = useCalendarStore.getState();
      expect(state.calendarData?.items).toHaveLength(1);
      expect(state.calendarData?.items[0].id).toBe(itemId);
      expect(state.calendarData?.items[0].title).toBe('New Event');
      expect(state.calendarData?.items[0].createdAt).toBeInstanceOf(Date);
      expect(state.calendarData?.items[0].updatedAt).toBeInstanceOf(Date);
    });

    it('should add item without end date', () => {
      const itemData = {
        title: 'All Day Event',
        type: 'deadline' as CalendarItemType,
        status: 'scheduled' as const,
        source: 'manual' as const,
        startDate: new Date(),
        allDay: true,
      };

      const itemId = useCalendarStore.getState().addItem(itemData);

      const state = useCalendarStore.getState();
      expect(state.calendarData?.items[0].endDate).toBeUndefined();
    });

    it('should update existing item', () => {
      const item = createTestItem({ id: 'item-1', title: 'Original Title' });
      const testData = createTestData({ items: [item] });
      useCalendarStore.getState().setCalendarData(testData);

      useCalendarStore.getState().updateItem('item-1', {
        title: 'Updated Title',
        status: 'published',
      });

      const state = useCalendarStore.getState();
      const updatedItem = state.calendarData?.items.find((i) => i.id === 'item-1');
      expect(updatedItem?.title).toBe('Updated Title');
      expect(updatedItem?.status).toBe('published');
      expect(updatedItem?.updatedAt).toBeInstanceOf(Date);
    });

    it('should update selected item when it matches', () => {
      const item = createTestItem({ id: 'item-1', title: 'Original' });
      const testData = createTestData({ items: [item] });
      useCalendarStore.getState().setCalendarData(testData);
      useCalendarStore.getState().setSelectedItem(item);

      useCalendarStore.getState().updateItem('item-1', { title: 'Updated' });

      const state = useCalendarStore.getState();
      expect(state.selectedItem?.title).toBe('Updated');
    });

    it('should not update selected item when ID does not match', () => {
      const item1 = createTestItem({ id: 'item-1', title: 'Item 1' });
      const item2 = createTestItem({ id: 'item-2', title: 'Item 2' });
      const testData = createTestData({ items: [item1, item2] });
      useCalendarStore.getState().setCalendarData(testData);
      useCalendarStore.getState().setSelectedItem(item1);

      useCalendarStore.getState().updateItem('item-2', { title: 'Updated Item 2' });

      const state = useCalendarStore.getState();
      expect(state.selectedItem?.title).toBe('Item 1'); // Unchanged
    });

    it('should delete item', () => {
      const item1 = createTestItem({ id: 'item-1' });
      const item2 = createTestItem({ id: 'item-2' });
      const testData = createTestData({ items: [item1, item2] });
      useCalendarStore.getState().setCalendarData(testData);

      useCalendarStore.getState().deleteItem('item-1');

      const state = useCalendarStore.getState();
      expect(state.calendarData?.items).toHaveLength(1);
      expect(state.calendarData?.items[0].id).toBe('item-2');
    });

    it('should clear selected item when deleted', () => {
      const item = createTestItem({ id: 'item-1' });
      const testData = createTestData({ items: [item] });
      useCalendarStore.getState().setCalendarData(testData);
      useCalendarStore.getState().setSelectedItem(item);

      useCalendarStore.getState().deleteItem('item-1');

      const state = useCalendarStore.getState();
      expect(state.selectedItem).toBeNull();
    });

    it('should not clear selected item when different item deleted', () => {
      const item1 = createTestItem({ id: 'item-1' });
      const item2 = createTestItem({ id: 'item-2' });
      const testData = createTestData({ items: [item1, item2] });
      useCalendarStore.getState().setCalendarData(testData);
      useCalendarStore.getState().setSelectedItem(item1);

      useCalendarStore.getState().deleteItem('item-2');

      const state = useCalendarStore.getState();
      expect(state.selectedItem?.id).toBe('item-1');
    });

    it('should update item date', () => {
      const item = createTestItem({
        id: 'item-1',
        startDate: new Date('2024-06-15T10:00:00Z'),
        endDate: new Date('2024-06-15T11:00:00Z'),
      });
      const testData = createTestData({ items: [item] });
      useCalendarStore.getState().setCalendarData(testData);

      const newStartDate = new Date('2024-06-20T14:00:00Z');
      const newEndDate = new Date('2024-06-20T16:00:00Z');

      useCalendarStore.getState().updateItemDate('item-1', newStartDate, newEndDate);

      const state = useCalendarStore.getState();
      const updatedItem = state.calendarData?.items[0];
      expect(updatedItem?.startDate).toEqual(newStartDate);
      expect(updatedItem?.endDate).toEqual(newEndDate);
    });

    it('should update item date without end date', () => {
      const item = createTestItem({
        id: 'item-1',
        startDate: new Date('2024-06-15T10:00:00Z'),
      });
      const testData = createTestData({ items: [item] });
      useCalendarStore.getState().setCalendarData(testData);

      const newStartDate = new Date('2024-06-20T14:00:00Z');

      useCalendarStore.getState().updateItemDate('item-1', newStartDate);

      const state = useCalendarStore.getState();
      const updatedItem = state.calendarData?.items[0];
      expect(updatedItem?.startDate).toEqual(newStartDate);
      expect(updatedItem?.endDate).toBeUndefined();
    });

    it('should do nothing when calendar data is null', () => {
      useCalendarStore.getState().setCalendarData(null);

      const itemId = useCalendarStore.getState().addItem({
        title: 'Test',
        type: 'event',
        status: 'scheduled',
        source: 'manual',
        startDate: new Date(),
      });

      // Should return ID but state unchanged
      expect(itemId).toBeDefined();
      expect(useCalendarStore.getState().calendarData).toBeNull();
    });
  });

  describe('Filtering Helpers', () => {
    beforeEach(() => {
      const now = new Date('2024-06-15T10:00:00Z');
      const items = [
        createTestItem({
          id: 'item-1',
          title: 'Campaign Event',
          type: 'campaign',
          status: 'scheduled',
          source: 'roadmap',
          tags: ['marketing', 'important'],
          startDate: now,
        }),
        createTestItem({
          id: 'item-2',
          title: 'Blog Post',
          type: 'content',
          status: 'published',
          source: 'file',
          tags: ['content'],
          startDate: new Date(now.getTime() + 86400000),
        }),
        createTestItem({
          id: 'item-3',
          title: 'Social Post',
          type: 'social',
          status: 'draft',
          source: 'manual',
          tags: ['social', 'urgent'],
          startDate: new Date(now.getTime() + 172800000),
        }),
      ];
      const testData = createTestData({ items });
      useCalendarStore.getState().setCalendarData(testData);
    });

    describe('getFilteredItems', () => {
      it('should return all items when no filters applied', () => {
        const filtered = useCalendarStore.getState().getFilteredItems();
        expect(filtered).toHaveLength(3);
      });

      it('should filter by item type', () => {
        useCalendarStore.getState().setFilters({ itemTypes: ['campaign'] });

        const filtered = useCalendarStore.getState().getFilteredItems();
        expect(filtered).toHaveLength(1);
        expect(filtered[0].type).toBe('campaign');
      });

      it('should filter by multiple item types', () => {
        useCalendarStore.getState().setFilters({ itemTypes: ['campaign', 'content'] });

        const filtered = useCalendarStore.getState().getFilteredItems();
        expect(filtered).toHaveLength(2);
        expect(filtered.map((i) => i.type)).toEqual(['campaign', 'content']);
      });

      it('should filter by status', () => {
        useCalendarStore.getState().setFilters({ status: ['published'] });

        const filtered = useCalendarStore.getState().getFilteredItems();
        expect(filtered).toHaveLength(1);
        expect(filtered[0].status).toBe('published');
      });

      it('should filter by multiple statuses', () => {
        useCalendarStore.getState().setFilters({ status: ['scheduled', 'draft'] });

        const filtered = useCalendarStore.getState().getFilteredItems();
        expect(filtered).toHaveLength(2);
        expect(filtered.map((i) => i.status).sort()).toEqual(['draft', 'scheduled']);
      });

      it('should filter by source', () => {
        useCalendarStore.getState().setFilters({ sources: ['roadmap'] });

        const filtered = useCalendarStore.getState().getFilteredItems();
        expect(filtered).toHaveLength(1);
        expect(filtered[0].source).toBe('roadmap');
      });

      it('should filter by tags', () => {
        useCalendarStore.getState().setFilters({ tags: ['marketing'] });

        const filtered = useCalendarStore.getState().getFilteredItems();
        expect(filtered).toHaveLength(1);
        expect(filtered[0].tags).toContain('marketing');
      });

      it('should filter by multiple tags (any match)', () => {
        useCalendarStore.getState().setFilters({ tags: ['marketing', 'urgent'] });

        const filtered = useCalendarStore.getState().getFilteredItems();
        expect(filtered).toHaveLength(2); // item-1 has 'marketing', item-3 has 'urgent'
      });

      it('should filter by date range', () => {
        const startDate = new Date('2024-06-15T00:00:00Z');
        const endDate = new Date('2024-06-16T23:59:59Z');
        useCalendarStore.getState().setFilters({ dateRange: { start: startDate, end: endDate } });

        const filtered = useCalendarStore.getState().getFilteredItems();
        // Items that overlap with the date range should be included
        expect(filtered.length).toBeGreaterThanOrEqual(1);
        expect(filtered[0].id).toBe('item-1');
      });

      it('should filter by search query in title', () => {
        useCalendarStore.getState().setFilters({ searchQuery: 'Campaign' });

        const filtered = useCalendarStore.getState().getFilteredItems();
        expect(filtered).toHaveLength(1);
        expect(filtered[0].title).toContain('Campaign');
      });

      it('should filter by search query in description', () => {
        const item = createTestItem({
          id: 'item-4',
          title: 'Event',
          type: 'event',
          status: 'scheduled',
          source: 'manual',
          description: 'Important marketing meeting',
          startDate: new Date(),
        });
        const state = useCalendarStore.getState();
        if (state.calendarData) {
          state.calendarData.items.push(item);
        }

        useCalendarStore.getState().setFilters({ searchQuery: 'marketing' });

        const filtered = useCalendarStore.getState().getFilteredItems();
        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered.some((i) => i.description?.toLowerCase().includes('marketing'))).toBe(true);
      });

      it('should filter by search query in tags', () => {
        useCalendarStore.getState().setFilters({ searchQuery: 'urgent' });

        const filtered = useCalendarStore.getState().getFilteredItems();
        expect(filtered).toHaveLength(1);
        expect(filtered[0].tags).toContain('urgent');
      });

      it('should be case insensitive for search query', () => {
        useCalendarStore.getState().setFilters({ searchQuery: 'CAMPAIGN' });

        const filtered = useCalendarStore.getState().getFilteredItems();
        expect(filtered).toHaveLength(1);
        expect(filtered[0].title).toBe('Campaign Event');
      });

      it('should apply multiple filters together', () => {
        useCalendarStore.getState().setFilters({
          itemTypes: ['campaign', 'social'],
          status: ['scheduled', 'draft'],
          searchQuery: 'post',
        });

        const filtered = useCalendarStore.getState().getFilteredItems();
        expect(filtered).toHaveLength(1);
        expect(filtered[0].type).toBe('social');
      });

      it('should return empty array when no items match', () => {
        useCalendarStore.getState().setFilters({
          itemTypes: ['email'],
          status: ['cancelled'],
        });

        const filtered = useCalendarStore.getState().getFilteredItems();
        expect(filtered).toHaveLength(0);
      });

      it('should return empty array when calendar data is null', () => {
        useCalendarStore.getState().setCalendarData(null);

        const filtered = useCalendarStore.getState().getFilteredItems();
        expect(filtered).toHaveLength(0);
      });
    });

    describe('getItemsForDate', () => {
      it('should return items for specific date (all day)', () => {
        const targetDate = new Date('2024-06-15T12:00:00Z');
        const allDayItem = createTestItem({
          id: 'all-day-1',
          title: 'All Day Event',
          type: 'event',
          status: 'scheduled',
          source: 'manual',
          startDate: targetDate,
          allDay: true,
        });

        const state = useCalendarStore.getState();
        if (state.calendarData) {
          state.calendarData.items.push(allDayItem);
        }

        const items = useCalendarStore.getState().getItemsForDate(targetDate);
        expect(items).toContainEqual(allDayItem);
      });

      it('should return items for specific date (time range)', () => {
        const targetDate = new Date('2024-06-15T12:00:00Z');
        const rangedItem = createTestItem({
          id: 'ranged-1',
          title: 'Ranged Event',
          type: 'event',
          status: 'scheduled',
          source: 'manual',
          startDate: new Date('2024-06-15T10:00:00Z'),
          endDate: new Date('2024-06-15T14:00:00Z'),
          allDay: false,
        });

        const state = useCalendarStore.getState();
        if (state.calendarData) {
          state.calendarData.items.push(rangedItem);
        }

        const items = useCalendarStore.getState().getItemsForDate(targetDate);
        expect(items).toContainEqual(rangedItem);
      });

      it('should not return items for different date (all day)', () => {
        const queryDate = new Date('2024-06-20T00:00:00Z');
        const allDayItem = createTestItem({
          id: 'all-day-1',
          title: 'All Day Event',
          type: 'event',
          status: 'scheduled',
          source: 'manual',
          startDate: new Date('2024-06-15T00:00:00Z'),
          allDay: true,
        });

        const state = useCalendarStore.getState();
        if (state.calendarData) {
          state.calendarData.items.push(allDayItem);
        }

        const items = useCalendarStore.getState().getItemsForDate(queryDate);
        expect(items).not.toContainEqual(allDayItem);
      });

      it('should return empty array when calendar data is null', () => {
        useCalendarStore.getState().setCalendarData(null);

        const items = useCalendarStore.getState().getItemsForDate(new Date());
        expect(items).toHaveLength(0);
      });
    });

    describe('getItemsInRange', () => {
      it('should return items that overlap with date range', () => {
        const start = new Date('2024-06-01T00:00:00Z');
        const end = new Date('2024-06-30T23:59:59Z');

        const inRangeItem = createTestItem({
          id: 'in-range-1',
          title: 'In Range Event',
          type: 'event',
          status: 'scheduled',
          source: 'manual',
          startDate: new Date('2024-06-15T10:00:00Z'),
          endDate: new Date('2024-06-15T12:00:00Z'),
        });

        const state = useCalendarStore.getState();
        if (state.calendarData) {
          state.calendarData.items.push(inRangeItem);
        }

        const items = useCalendarStore.getState().getItemsInRange(start, end);
        expect(items).toContainEqual(inRangeItem);
      });

      it('should return items that start before range and end during range', () => {
        const start = new Date('2024-06-15T00:00:00Z');
        const end = new Date('2024-06-20T23:59:59Z');

        const overlappingItem = createTestItem({
          id: 'overlap-1',
          title: 'Overlapping Event',
          type: 'event',
          status: 'scheduled',
          source: 'manual',
          startDate: new Date('2024-06-10T10:00:00Z'),
          endDate: new Date('2024-06-17T12:00:00Z'),
        });

        const state = useCalendarStore.getState();
        if (state.calendarData) {
          state.calendarData.items.push(overlappingItem);
        }

        const items = useCalendarStore.getState().getItemsInRange(start, end);
        expect(items).toContainEqual(overlappingItem);
      });

      it('should return items that start during range and end after range', () => {
        const start = new Date('2024-06-15T00:00:00Z');
        const end = new Date('2024-06-20T23:59:59Z');

        const overlappingItem = createTestItem({
          id: 'overlap-2',
          title: 'Overlapping Event',
          type: 'event',
          status: 'scheduled',
          source: 'manual',
          startDate: new Date('2024-06-17T10:00:00Z'),
          endDate: new Date('2024-06-25T12:00:00Z'),
        });

        const state = useCalendarStore.getState();
        if (state.calendarData) {
          state.calendarData.items.push(overlappingItem);
        }

        const items = useCalendarStore.getState().getItemsInRange(start, end);
        expect(items).toContainEqual(overlappingItem);
      });

      it('should not return items completely outside range', () => {
        const start = new Date('2024-06-15T00:00:00Z');
        const end = new Date('2024-06-20T23:59:59Z');

        const outsideItem = createTestItem({
          id: 'outside-1',
          title: 'Outside Event',
          type: 'event',
          status: 'scheduled',
          source: 'manual',
          startDate: new Date('2024-07-01T10:00:00Z'),
          endDate: new Date('2024-07-02T12:00:00Z'),
        });

        const state = useCalendarStore.getState();
        if (state.calendarData) {
          state.calendarData.items.push(outsideItem);
        }

        const items = useCalendarStore.getState().getItemsInRange(start, end);
        expect(items).not.toContainEqual(outsideItem);
      });

      it('should return empty array when calendar data is null', () => {
        useCalendarStore.getState().setCalendarData(null);

        const items = useCalendarStore.getState().getItemsInRange(new Date(), new Date());
        expect(items).toHaveLength(0);
      });
    });
  });

  describe('Store Updates', () => {
    it('should update updatedAt timestamp when adding item', () => {
      const testData = createTestData({
        items: [],
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });
      useCalendarStore.getState().setCalendarData(testData);

      const beforeUpdate = useCalendarStore.getState().calendarData?.updatedAt;

      useCalendarStore.getState().addItem({
        title: 'Test',
        type: 'event',
        status: 'scheduled',
        source: 'manual',
        startDate: new Date(),
      });

      const afterUpdate = useCalendarStore.getState().calendarData?.updatedAt;
      expect(afterUpdate?.getTime()).toBeGreaterThan(beforeUpdate?.getTime() || 0);
    });

    it('should update updatedAt timestamp when updating item', () => {
      const item = createTestItem({ id: 'item-1' });
      const testData = createTestData({
        items: [item],
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });
      useCalendarStore.getState().setCalendarData(testData);

      const beforeUpdate = useCalendarStore.getState().calendarData?.updatedAt;

      useCalendarStore.getState().updateItem('item-1', { title: 'Updated' });

      const afterUpdate = useCalendarStore.getState().calendarData?.updatedAt;
      expect(afterUpdate?.getTime()).toBeGreaterThan(beforeUpdate?.getTime() || 0);
    });

    it('should update updatedAt timestamp when deleting item', () => {
      const item = createTestItem({ id: 'item-1' });
      const testData = createTestData({
        items: [item],
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });
      useCalendarStore.getState().setCalendarData(testData);

      const beforeUpdate = useCalendarStore.getState().calendarData?.updatedAt;

      useCalendarStore.getState().deleteItem('item-1');

      const afterUpdate = useCalendarStore.getState().calendarData?.updatedAt;
      expect(afterUpdate?.getTime()).toBeGreaterThan(beforeUpdate?.getTime() || 0);
    });
  });
});
