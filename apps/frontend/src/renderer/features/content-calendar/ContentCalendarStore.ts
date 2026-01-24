import { create } from 'zustand';
import type {
  ContentCampaign,
  CalendarView,
  CalendarFilters,
  ContentType,
  ScheduleConflict,
  CalendarDate,
  WeekDay
} from '../../../shared/types/content-calendar';
import { CONTENT_TYPES } from '../../../shared/constants/content-calendar';

interface ContentCalendarState {
  // Current view state
  currentView: CalendarView;
  currentDate: Date;
  selectedDate: Date | null;
  selectedCampaign: ContentCampaign | null;

  // Filters
  filters: CalendarFilters;

  // Data
  campaigns: ContentCampaign[];
  conflicts: ScheduleConflict[];

  // UI state
  isDragOver: boolean;
  draggedCampaign: ContentCampaign | null;
  showConflictDialog: boolean;

  // Actions
  setCurrentView: (view: CalendarView) => void;
  setCurrentDate: (date: Date) => void;
  setSelectedDate: (date: Date | null) => void;
  setSelectedCampaign: (campaign: ContentCampaign | null) => void;
  setFilters: (filters: Partial<CalendarFilters>) => void;
  resetFilters: () => void;

  // Campaign management
  setCampaigns: (campaigns: ContentCampaign[]) => void;
  updateCampaign: (campaignId: string, updates: Partial<ContentCampaign>) => void;
  updateCampaignDate: (campaignId: string, newDate: Date) => void;
  deleteCampaign: (campaignId: string) => void;

  // Drag and drop
  startDrag: (campaign: ContentCampaign) => void;
  endDrag: () => void;
  handleDrop: (campaignId: string, targetDate: Date) => void;

  // Conflict detection
  checkConflicts: (campaignId: string, newDate: Date) => ScheduleConflict[];
  resolveConflict: (campaignId: string) => void;
}

const initialFilters: CalendarFilters = {
  contentTypes: [],
  statuses: [],
  platforms: [],
  searchQuery: ''
};

export const useContentCalendarStore = create<ContentCalendarState>((set, get) => ({
  // Initial state
  currentView: 'month',
  currentDate: new Date(),
  selectedDate: null,
  selectedCampaign: null,
  filters: initialFilters,
  campaigns: [],
  conflicts: [],
  isDragOver: false,
  draggedCampaign: null,
  showConflictDialog: false,

  // View actions
  setCurrentView: (view) => set({ currentView: view }),

  setCurrentDate: (date) => set({ currentDate: date }),

  setSelectedDate: (date) => set({ selectedDate: date }),

  setSelectedCampaign: (campaign) => set({ selectedCampaign: campaign }),

  // Filter actions
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters }
    })),

  resetFilters: () => set({ filters: initialFilters }),

  // Campaign management
  setCampaigns: (campaigns) => set({ campaigns }),

  updateCampaign: (campaignId, updates) =>
    set((state) => ({
      campaigns: state.campaigns.map((campaign) =>
        campaign.id === campaignId ? { ...campaign, ...updates } : campaign
      )
    })),

  updateCampaignDate: (campaignId, newDate) => {
    const conflicts = get().checkConflicts(campaignId, newDate);

    if (conflicts.length > 0) {
      // Show conflict dialog
      set({
        conflicts,
        showConflictDialog: true
      });
    } else {
      // No conflicts, update the date
      set((state) => ({
        campaigns: state.campaigns.map((campaign) =>
          campaign.id === campaignId
            ? { ...campaign, scheduledDate: newDate }
            : campaign
        ),
        conflicts: []
      }));
    }
  },

  deleteCampaign: (campaignId) =>
    set((state) => ({
      campaigns: state.campaigns.filter((c) => c.id !== campaignId),
      selectedCampaign: state.selectedCampaign?.id === campaignId ? null : state.selectedCampaign
    })),

  // Drag and drop actions
  startDrag: (campaign) =>
    set({
      draggedCampaign: campaign,
      isDragOver: true
    }),

  endDrag: () =>
    set({
      draggedCampaign: null,
      isDragOver: false
    }),

  handleDrop: (campaignId, targetDate) => {
    const conflicts = get().checkConflicts(campaignId, targetDate);

    if (conflicts.length > 0) {
      set({
        conflicts,
        showConflictDialog: true
      });
    } else {
      set((state) => ({
        campaigns: state.campaigns.map((campaign) =>
          campaign.id === campaignId
            ? { ...campaign, scheduledDate: targetDate }
            : campaign
        ),
        draggedCampaign: null,
        isDragOver: false,
        conflicts: []
      }));
    }
  },

  // Conflict detection
  checkConflicts: (campaignId, newDate) => {
    const state = get();
    const campaign = state.campaigns.find((c) => c.id === campaignId);

    if (!campaign) return [];

    const conflictingCampaigns = state.campaigns.filter((otherCampaign) => {
      // Skip self and campaigns without scheduled dates
      if (otherCampaign.id === campaignId || !otherCampaign.scheduledDate) {
        return false;
      }

      // Check if dates are the same (day-level comparison)
      const newDateDay = new Date(newDate).toDateString();
      const otherDateDay = new Date(otherCampaign.scheduledDate).toDateString();

      return newDateDay === otherDateDay;
    });

    if (conflictingCampaigns.length === 0) return [];

    return [{
      campaignId,
      conflictingCampaigns,
      severity: conflictingCampaigns.length > 2 ? 'error' : 'warning',
      message: `${conflictingCampaigns.length} campaign(s) already scheduled for this date`
    }];
  },

  resolveConflict: (campaignId) => {
    set((state) => ({
      conflicts: state.conflicts.filter((c) => c.campaignId !== campaignId),
      showConflictDialog: state.conflicts.length <= 1
    }));
  }
}));

// Helper functions
export function getFilteredCampaigns(
  campaigns: ContentCampaign[],
  filters: CalendarFilters
): ContentCampaign[] {
  return campaigns.filter((campaign) => {
    // Filter by content type
    if (
      filters.contentTypes.length > 0 &&
      !filters.contentTypes.includes(campaign.contentType)
    ) {
      return false;
    }

    // Filter by status
    if (
      filters.statuses.length > 0 &&
      !filters.statuses.includes(campaign.status)
    ) {
      return false;
    }

    // Filter by platforms
    if (
      filters.platforms &&
      filters.platforms.length > 0 &&
      campaign.platforms
    ) {
      const hasPlatform = filters.platforms.some((platform) =>
        campaign.platforms?.includes(platform)
      );
      if (!hasPlatform) return false;
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesTitle = campaign.title.toLowerCase().includes(query);
      const matchesDescription = campaign.description?.toLowerCase().includes(query);
      if (!matchesTitle && !matchesDescription) return false;
    }

    // Filter by date range
    if (filters.dateRange && campaign.scheduledDate) {
      const campaignDate = new Date(campaign.scheduledDate);
      if (
        campaignDate < filters.dateRange.start ||
        campaignDate > filters.dateRange.end
      ) {
        return false;
      }
    }

    return true;
  });
}

export function getCampaignsForDate(
  campaigns: ContentCampaign[],
  date: Date
): ContentCampaign[] {
  const targetDate = date.toDateString();

  return campaigns.filter((campaign) => {
    if (!campaign.scheduledDate) return false;
    return new Date(campaign.scheduledDate).toDateString() === targetDate;
  });
}

export function generateMonthGrid(date: Date): CalendarDate[] {
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
    const date = new Date(year, month - 1, day);
    grid.push({
      date,
      isToday: date.toDateString() === today.toDateString(),
      isCurrentMonth: false,
      campaigns: []
    });
  }

  // Add days from current month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    grid.push({
      date,
      isToday: date.toDateString() === today.toDateString(),
      isCurrentMonth: true,
      campaigns: []
    });
  }

  // Add days from next month to complete 42-day grid (6 weeks)
  const remainingDays = 42 - grid.length;
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day);
    grid.push({
      date,
      isToday: date.toDateString() === today.toDateString(),
      isCurrentMonth: false,
      campaigns: []
    });
  }

  return grid;
}

export function generateWeekDays(date: Date): WeekDay[] {
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
      campaigns: []
    });
  }

  return weekDays;
}
