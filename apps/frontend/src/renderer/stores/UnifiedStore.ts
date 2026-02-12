/**
 * Unified Store - Single source of truth for all application state
 *
 * Architecture:
 * - Slice-based organization (calendar, ideation, insights, roadmap)
 * - Immer middleware for immutable updates
 * - DevTools integration for time-travel debugging
 * - Performance optimized with selective subscriptions
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  CalendarData,
  CalendarItem,
  CalendarItemType,
  CalendarViewMode,
  CalendarZoomLevel,
  CalendarFilters,
  ExternalCalendarConnection,
} from '../../shared/types';
import type {
  IdeationSession,
  Idea,
  IdeationStatus,
  IdeationGenerationStatus,
  IdeationType,
  IdeationConfig,
  IdeationSummary,
} from '../../shared/types';

// IdeationTypeState is defined locally since it's specific to store implementation
import type {
  InsightsSession,
  InsightsSessionSummary,
  InsightsChatMessage,
  InsightsChatStatus,
  InsightsStreamChunk,
  InsightsToolUsage,
  InsightsModelConfig,
} from '../../shared/types';
import type {
  Roadmap,
  RoadmapFeature,
  RoadmapFeatureStatus,
  RoadmapGenerationStatus,
  RoadmapProgressLog,
  RoadmapPhase,
  RoadmapOperation,
  CompetitorAnalysis,
} from '../../shared/types';

// ============================================
// Time-Travel Debugging Types
// ============================================

interface TimeTravelState {
  past: RootState[];
  future: RootState[];
}

const MAX_HISTORY_SIZE = 50;

// ============================================
// Calendar Slice
// ============================================

interface CalendarState {
  // Data
  calendarData: CalendarData | null;
  externalConnections: ExternalCalendarConnection[];
  selectedItem: CalendarItem | null;
  hoveredItem: CalendarItem | null;

  // UI State
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  pendingItemIds: Set<string>;

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
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  addPendingItem: (itemId: string) => void;
  removePendingItem: (itemId: string) => void;

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

const createInitialCalendarState = (): CalendarState => ({
  calendarData: null,
  externalConnections: [],
  selectedItem: null,
  hoveredItem: null,
  isLoading: false,
  isSaving: false,
  error: null,
  pendingItemIds: new Set<string>(),
  currentDate: new Date(),
  viewMode: 'month',
  zoomLevel: 'day',
  filters: defaultFilters,

  setCalendarData: (data) => {
    UnifiedStore.setState((state) => {
      state.calendar.calendarData = data;
    });
  },

  setExternalConnections: (connections) => {
    UnifiedStore.setState((state) => {
      state.calendar.externalConnections = connections;
    });
  },

  setSelectedItem: (item) => {
    UnifiedStore.setState((state) => {
      state.calendar.selectedItem = item;
    });
  },

  setHoveredItem: (item) => {
    UnifiedStore.setState((state) => {
      state.calendar.hoveredItem = item;
    });
  },

  setLoading: (loading) => {
    UnifiedStore.setState((state) => {
      state.calendar.isLoading = loading;
    });
  },

  setSaving: (saving) => {
    UnifiedStore.setState((state) => {
      state.calendar.isSaving = saving;
    });
  },

  setError: (error) => {
    UnifiedStore.setState((state) => {
      state.calendar.error = error;
    });
  },

  addPendingItem: (itemId) => {
    UnifiedStore.setState((state) => {
      state.calendar.pendingItemIds.add(itemId);
    });
  },

  removePendingItem: (itemId) => {
    UnifiedStore.setState((state) => {
      state.calendar.pendingItemIds.delete(itemId);
    });
  },

  setCurrentDate: (date) => {
    UnifiedStore.setState((state) => {
      state.calendar.currentDate = date;
    });
  },

  setViewMode: (mode) => {
    UnifiedStore.setState((state) => {
      state.calendar.viewMode = mode;
    });
  },

  setZoomLevel: (level) => {
    UnifiedStore.setState((state) => {
      state.calendar.zoomLevel = level;
    });
  },

  setFilters: (partialFilters) => {
    UnifiedStore.setState((state) => {
      state.calendar.filters = { ...state.calendar.filters, ...partialFilters };
    });
  },

  clearFilters: () => {
    UnifiedStore.setState((state) => {
      state.calendar.filters = defaultFilters;
    });
  },

  goToToday: () => {
    UnifiedStore.setState((state) => {
      state.calendar.currentDate = new Date();
    });
  },

  navigatePrev: () => {
    UnifiedStore.setState((state) => {
      const { zoomLevel, currentDate } = state.calendar;
      const newDate = new Date(currentDate);
      switch (zoomLevel) {
        case 'day':
          newDate.setMonth(newDate.getMonth() - 1);
          break;
        case 'week':
          newDate.setMonth(newDate.getMonth() - 1);
          break;
        case 'month':
          newDate.setMonth(newDate.getMonth() - 1);
          break;
        case 'quarter':
          newDate.setMonth(newDate.getMonth() - 3);
          break;
      }
      state.calendar.currentDate = newDate;
    });
  },

  navigateNext: () => {
    UnifiedStore.setState((state) => {
      const { zoomLevel, currentDate } = state.calendar;
      const newDate = new Date(currentDate);
      switch (zoomLevel) {
        case 'day':
          newDate.setMonth(newDate.getMonth() + 1);
          break;
        case 'week':
          newDate.setMonth(newDate.getMonth() + 1);
          break;
        case 'month':
          newDate.setMonth(newDate.getMonth() + 1);
          break;
        case 'quarter':
          newDate.setMonth(newDate.getMonth() + 3);
          break;
      }
      state.calendar.currentDate = newDate;
    });
  },

  addItem: (itemData) => {
    const newItem: CalendarItem = {
      ...itemData,
      id: `calendar-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    UnifiedStore.setState((state) => {
      if (!state.calendar.calendarData) return;
      state.calendar.calendarData.items.push(newItem);
      state.calendar.calendarData.updatedAt = new Date();
    });

    return newItem.id;
  },

  updateItem: (id, updates) => {
    UnifiedStore.setState((state) => {
      if (!state.calendar.calendarData) return;
      const item = state.calendar.calendarData.items.find((i) => i.id === id);
      if (item) {
        Object.assign(item, updates, { updatedAt: new Date() });
        state.calendar.calendarData.updatedAt = new Date();
      }
      if (state.calendar.selectedItem?.id === id) {
        Object.assign(state.calendar.selectedItem, updates, { updatedAt: new Date() });
      }
    });
  },

  deleteItem: (id) => {
    UnifiedStore.setState((state) => {
      if (!state.calendar.calendarData) return;
      state.calendar.calendarData.items = state.calendar.calendarData.items.filter((i) => i.id !== id);
      state.calendar.calendarData.updatedAt = new Date();
      if (state.calendar.selectedItem?.id === id) {
        state.calendar.selectedItem = null;
      }
    });
  },

  updateItemDate: (id, startDate, endDate) => {
    UnifiedStore.setState((state) => {
      if (!state.calendar.calendarData) return;
      const item = state.calendar.calendarData.items.find((i) => i.id === id);
      if (item) {
        item.startDate = startDate;
        item.endDate = endDate;
        item.updatedAt = new Date();
        state.calendar.calendarData.updatedAt = new Date();
      }
      if (state.calendar.selectedItem?.id === id) {
        state.calendar.selectedItem.startDate = startDate;
        state.calendar.selectedItem.endDate = endDate;
        state.calendar.selectedItem.updatedAt = new Date();
      }
    });
  },

  getFilteredItems: () => {
    const state = UnifiedStore.getState();
    const { calendarData, filters } = state.calendar;
    if (!calendarData) return [];

    let items = calendarData.items;

    if (filters.itemTypes.length > 0) {
      items = items.filter((item) => filters.itemTypes.includes(item.type));
    }

    if (filters.status.length > 0) {
      items = items.filter((item) => filters.status.includes(item.status));
    }

    if (filters.sources.length > 0) {
      items = items.filter((item) => filters.sources.includes(item.source));
    }

    if (filters.tags.length > 0) {
      items = items.filter((item) =>
        item.tags?.some((tag) => filters.tags.includes(tag))
      );
    }

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
    const state = UnifiedStore.getState();
    const { calendarData } = state.calendar;
    if (!calendarData) return [];

    return calendarData.items.filter((item) => {
      if (item.allDay) {
        return item.startDate.toDateString() === date.toDateString();
      }
      const itemEnd = item.endDate || item.startDate;
      return date >= item.startDate && date <= itemEnd;
    });
  },

  getItemsInRange: (start, end) => {
    const state = UnifiedStore.getState();
    const { calendarData } = state.calendar;
    if (!calendarData) return [];

    return calendarData.items.filter((item) => {
      const itemEnd = item.endDate || item.startDate;
      return item.startDate <= end && itemEnd >= start;
    });
  },
});

// ============================================
// Ideation Slice
// ============================================

// Local type definition - not exported from shared/types
export type IdeationTypeState = 'pending' | 'generating' | 'completed' | 'failed';

interface IdeationState {
  // Data
  currentProjectId: string | null;
  session: IdeationSession | null;
  generationStatus: IdeationGenerationStatus;
  config: IdeationConfig;
  logs: string[];
  typeStates: Record<IdeationType, IdeationTypeState>;
  selectedIds: Set<string>;
  isGenerating: boolean;

  // Actions
  setCurrentProjectId: (projectId: string | null) => void;
  setSession: (session: IdeationSession | null) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setGenerationStatus: (status: IdeationGenerationStatus) => void;
  setConfig: (config: Partial<IdeationConfig>) => void;
  updateIdeaStatus: (ideaId: string, status: IdeationStatus) => void;
  setIdeaTaskId: (ideaId: string, taskId: string) => void;
  dismissIdea: (ideaId: string) => void;
  dismissAllIdeas: () => void;
  archiveIdea: (ideaId: string) => void;
  deleteIdea: (ideaId: string) => void;
  deleteMultipleIdeas: (ideaIds: string[]) => void;
  clearSession: () => void;
  addLog: (log: string) => void;
  clearLogs: () => void;
  toggleSelectIdea: (ideaId: string) => void;
  selectAllIdeas: (ideaIds: string[]) => void;
  clearSelection: () => void;
  initializeTypeStates: (types: IdeationType[]) => void;
  setTypeState: (type: IdeationType, state: IdeationTypeState) => void;
  addIdeasForType: (ideationType: string, ideas: Idea[]) => void;
  resetGeneratingTypes: (toState: IdeationTypeState) => void;
}

const initialIdeationConfig: IdeationConfig = {
  enabledTypes: ['campaign_concepts', 'content_ideas', 'growth_tactics'],
  includeRoadmapContext: true,
  includeKanbanContext: true,
  maxIdeasPerType: 10,
};

const initialGenerationStatus: IdeationGenerationStatus = {
  phase: 'idle',
  progress: 0,
  message: '',
};

const initialTypeStates: Record<IdeationType, IdeationTypeState> = {
  campaign_concepts: 'pending',
  content_ideas: 'pending',
  growth_tactics: 'pending',
  brand_partnerships: 'pending',
  viral_strategies: 'pending',
  channel_ideas: 'pending',
};

const createInitialIdeationState = (): IdeationState => ({
  currentProjectId: null,
  session: null,
  generationStatus: initialGenerationStatus,
  config: initialIdeationConfig,
  logs: [],
  typeStates: { ...initialTypeStates },
  selectedIds: new Set<string>(),
  isGenerating: false,

  setCurrentProjectId: (projectId) => {
    UnifiedStore.setState((state) => {
      if (state.ideation.currentProjectId !== projectId) {
        state.ideation.currentProjectId = projectId;
        state.ideation.session = null;
        state.ideation.generationStatus = initialGenerationStatus;
        state.ideation.logs = [];
        state.ideation.typeStates = { ...initialTypeStates };
        state.ideation.selectedIds = new Set<string>();
        state.ideation.isGenerating = false;
      }
    });
  },

  setSession: (session) => {
    UnifiedStore.setState((state) => {
      state.ideation.session = session;
    });
  },

  setIsGenerating: (isGenerating) => {
    UnifiedStore.setState((state) => {
      state.ideation.isGenerating = isGenerating;
    });
  },

  setGenerationStatus: (status) => {
    UnifiedStore.setState((state) => {
      state.ideation.generationStatus = status;
    });
  },

  setConfig: (newConfig) => {
    UnifiedStore.setState((state) => {
      state.ideation.config = { ...state.ideation.config, ...newConfig };
    });
  },

  updateIdeaStatus: (ideaId, status) => {
    UnifiedStore.setState((state) => {
      if (!state.ideation.session) return;
      const idea = state.ideation.session.ideas.find((i) => i.id === ideaId);
      if (idea) {
        idea.status = status;
        state.ideation.session.updatedAt = new Date();
      }
    });
  },

  setIdeaTaskId: (ideaId, taskId) => {
    UnifiedStore.setState((state) => {
      if (!state.ideation.session) return;
      const idea = state.ideation.session.ideas.find((i) => i.id === ideaId);
      if (idea) {
        idea.taskId = taskId;
        idea.status = 'archived';
        state.ideation.session.updatedAt = new Date();
      }
    });
  },

  dismissIdea: (ideaId) => {
    UnifiedStore.setState((state) => {
      if (!state.ideation.session) return;
      const idea = state.ideation.session.ideas.find((i) => i.id === ideaId);
      if (idea) {
        idea.status = 'dismissed';
        state.ideation.session.updatedAt = new Date();
      }
    });
  },

  dismissAllIdeas: () => {
    UnifiedStore.setState((state) => {
      if (!state.ideation.session) return;
      state.ideation.session.ideas.forEach((idea) => {
        if (idea.status !== 'dismissed' && idea.status !== 'converted' && idea.status !== 'archived') {
          idea.status = 'dismissed';
        }
      });
      state.ideation.session.updatedAt = new Date();
    });
  },

  archiveIdea: (ideaId) => {
    UnifiedStore.setState((state) => {
      if (!state.ideation.session) return;
      const idea = state.ideation.session.ideas.find((i) => i.id === ideaId);
      if (idea) {
        idea.status = 'archived';
        state.ideation.session.updatedAt = new Date();
      }
    });
  },

  deleteIdea: (ideaId) => {
    UnifiedStore.setState((state) => {
      if (!state.ideation.session) return;
      state.ideation.session.ideas = state.ideation.session.ideas.filter((i) => i.id !== ideaId);
      state.ideation.selectedIds.delete(ideaId);
      state.ideation.session.updatedAt = new Date();
    });
  },

  deleteMultipleIdeas: (ideaIds) => {
    UnifiedStore.setState((state) => {
      if (!state.ideation.session) return;
      const idsToDelete = new Set(ideaIds);
      state.ideation.session.ideas = state.ideation.session.ideas.filter(
        (idea) => !idsToDelete.has(idea.id)
      );
      ideaIds.forEach((id) => state.ideation.selectedIds.delete(id));
      state.ideation.session.updatedAt = new Date();
    });
  },

  clearSession: () => {
    UnifiedStore.setState((state) => {
      state.ideation.session = null;
      state.ideation.generationStatus = initialGenerationStatus;
      state.ideation.typeStates = { ...initialTypeStates };
      state.ideation.selectedIds = new Set<string>();
    });
  },

  addLog: (log) => {
    UnifiedStore.setState((state) => {
      state.ideation.logs.push(log);
      if (state.ideation.logs.length > 100) {
        state.ideation.logs = state.ideation.logs.slice(-100);
      }
    });
  },

  clearLogs: () => {
    UnifiedStore.setState((state) => {
      state.ideation.logs = [];
    });
  },

  toggleSelectIdea: (ideaId) => {
    UnifiedStore.setState((state) => {
      if (state.ideation.selectedIds.has(ideaId)) {
        state.ideation.selectedIds.delete(ideaId);
      } else {
        state.ideation.selectedIds.add(ideaId);
      }
    });
  },

  selectAllIdeas: (ideaIds) => {
    UnifiedStore.setState((state) => {
      state.ideation.selectedIds = new Set(ideaIds);
    });
  },

  clearSelection: () => {
    UnifiedStore.setState((state) => {
      state.ideation.selectedIds = new Set<string>();
    });
  },

  initializeTypeStates: (types) => {
    UnifiedStore.setState((state) => {
      const newTypeStates = { ...initialTypeStates };
      types.forEach((type) => {
        newTypeStates[type] = 'generating';
      });
      Object.keys(newTypeStates).forEach((type) => {
        if (!types.includes(type as IdeationType)) {
          newTypeStates[type as IdeationType] = 'pending';
        }
      });
      state.ideation.typeStates = newTypeStates;
    });
  },

  setTypeState: (type, typeState) => {
    UnifiedStore.setState((state) => {
      state.ideation.typeStates[type] = typeState;
    });
  },

  addIdeasForType: (ideationType, ideas) => {
    UnifiedStore.setState((state) => {
      const newTypeStates = { ...state.ideation.typeStates };
      newTypeStates[ideationType as IdeationType] = 'completed';
      state.ideation.typeStates = newTypeStates;

      if (!state.ideation.session) {
        state.ideation.session = {
          id: `session-${Date.now()}`,
          projectId: '',
          config: state.ideation.config,
          ideas,
          projectContext: {
            existingFeatures: [],
            techStack: [],
            plannedFeatures: [],
          },
          generatedAt: new Date(),
          updatedAt: new Date(),
        };
        return;
      }

      const otherTypeIdeas = state.ideation.session.ideas.filter(
        (idea) => idea.type !== ideationType
      );
      state.ideation.session.ideas = [...otherTypeIdeas, ...ideas];
      state.ideation.session.updatedAt = new Date();
    });
  },

  resetGeneratingTypes: (toState) => {
    UnifiedStore.setState((state) => {
      Object.entries(state.ideation.typeStates).forEach(([type, currentState]) => {
        if (currentState === 'generating') {
          state.ideation.typeStates[type as IdeationType] = toState;
        }
      });
    });
  },
});

// ============================================
// Insights Slice
// ============================================

interface InsightsState {
  session: InsightsSession | null;
  sessions: InsightsSessionSummary[];
  status: InsightsChatStatus;
  pendingMessage: string;
  streamingContent: string;
  currentTool: { name: string; input?: string } | null;
  toolsUsed: InsightsToolUsage[];
  isLoadingSessions: boolean;

  setSession: (session: InsightsSession | null) => void;
  setSessions: (sessions: InsightsSessionSummary[]) => void;
  setStatus: (status: InsightsChatStatus) => void;
  setPendingMessage: (message: string) => void;
  addMessage: (message: InsightsChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;
  appendStreamingContent: (content: string) => void;
  clearStreamingContent: () => void;
  setCurrentTool: (tool: { name: string; input?: string } | null) => void;
  addToolUsage: (tool: { name: string; input?: string }) => void;
  clearToolsUsed: () => void;
  finalizeStreamingMessage: (suggestedTask?: InsightsChatMessage['suggestedTask']) => void;
  clearSession: () => void;
  setLoadingSessions: (loading: boolean) => void;
}

const initialInsightsStatus: InsightsChatStatus = {
  phase: 'idle',
  message: '',
};

const createInitialInsightsState = (): InsightsState => ({
  session: null,
  sessions: [],
  status: initialInsightsStatus,
  pendingMessage: '',
  streamingContent: '',
  currentTool: null,
  toolsUsed: [],
  isLoadingSessions: false,

  setSession: (session) => {
    UnifiedStore.setState((state) => {
      state.insights.session = session;
    });
  },

  setSessions: (sessions) => {
    UnifiedStore.setState((state) => {
      state.insights.sessions = sessions;
    });
  },

  setStatus: (status) => {
    UnifiedStore.setState((state) => {
      state.insights.status = status;
    });
  },

  setLoadingSessions: (loading) => {
    UnifiedStore.setState((state) => {
      state.insights.isLoadingSessions = loading;
    });
  },

  setPendingMessage: (message) => {
    UnifiedStore.setState((state) => {
      state.insights.pendingMessage = message;
    });
  },

  addMessage: (message) => {
    UnifiedStore.setState((state) => {
      if (!state.insights.session) {
        state.insights.session = {
          id: `session-${Date.now()}`,
          projectId: '',
          messages: [message],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      } else {
        state.insights.session.messages.push(message);
        state.insights.session.updatedAt = new Date();
      }
    });
  },

  updateLastAssistantMessage: (content) => {
    UnifiedStore.setState((state) => {
      if (!state.insights.session || state.insights.session.messages.length === 0) return;
      const lastMessage = state.insights.session.messages[state.insights.session.messages.length - 1];
      if (lastMessage.role === 'assistant') {
        lastMessage.content = content;
        state.insights.session.updatedAt = new Date();
      }
    });
  },

  appendStreamingContent: (content) => {
    UnifiedStore.setState((state) => {
      state.insights.streamingContent += content;
    });
  },

  clearStreamingContent: () => {
    UnifiedStore.setState((state) => {
      state.insights.streamingContent = '';
    });
  },

  setCurrentTool: (tool) => {
    UnifiedStore.setState((state) => {
      state.insights.currentTool = tool;
    });
  },

  addToolUsage: (tool) => {
    UnifiedStore.setState((state) => {
      state.insights.toolsUsed.push({
        name: tool.name,
        input: tool.input,
        timestamp: new Date(),
      });
    });
  },

  clearToolsUsed: () => {
    UnifiedStore.setState((state) => {
      state.insights.toolsUsed = [];
    });
  },

  finalizeStreamingMessage: (suggestedTask) => {
    UnifiedStore.setState((state) => {
      const content = state.insights.streamingContent;
      const toolsUsed = state.insights.toolsUsed.length > 0 ? [...state.insights.toolsUsed] : undefined;

      if (!content && !suggestedTask && !toolsUsed) {
        state.insights.streamingContent = '';
        state.insights.toolsUsed = [];
        return;
      }

      const newMessage: InsightsChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: new Date(),
        suggestedTask,
        toolsUsed,
      };

      if (!state.insights.session) {
        state.insights.session = {
          id: `session-${Date.now()}`,
          projectId: '',
          messages: [newMessage],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      } else {
        state.insights.session.messages.push(newMessage);
        state.insights.session.updatedAt = new Date();
      }

      state.insights.streamingContent = '';
      state.insights.toolsUsed = [];
    });
  },

  clearSession: () => {
    UnifiedStore.setState((state) => {
      state.insights.session = null;
      state.insights.status = initialInsightsStatus;
      state.insights.pendingMessage = '';
      state.insights.streamingContent = '';
      state.insights.currentTool = null;
      state.insights.toolsUsed = [];
    });
  },
});

// ============================================
// Roadmap Slice
// ============================================

interface RoadmapState {
  roadmap: Roadmap | null;
  competitorAnalysis: CompetitorAnalysis | null;
  generationStatus: RoadmapGenerationStatus;
  progressLogs: RoadmapProgressLog[];
  currentProjectId: string | null;
  chatMessages: { id: string; role: string; content: string; timestamp: Date; operations?: RoadmapOperation[] }[];
  isChatProcessing: boolean;
  history: { past: Roadmap[]; future: Roadmap[] };

  setRoadmap: (roadmap: Roadmap | null) => void;
  setCompetitorAnalysis: (analysis: CompetitorAnalysis | null) => void;
  setGenerationStatus: (status: RoadmapGenerationStatus) => void;
  addProgressLog: (log: RoadmapProgressLog) => void;
  clearProgressLogs: () => void;
  setCurrentProjectId: (projectId: string | null) => void;
  updateFeatureStatus: (featureId: string, status: RoadmapFeatureStatus) => void;
  updateFeatureTitle: (featureId: string, title: string) => void;
  updateFeatureDescription: (featureId: string, description: string) => void;
  updateFeaturePriority: (featureId: string, priority: 'must' | 'should' | 'could' | 'wont') => void;
  addContextToFeature: (featureId: string, context: string) => void;
  markFeatureDoneBySpecId: (specId: string) => void;
  updateFeatureLinkedSpec: (featureId: string, specId: string) => void;
  deleteFeature: (featureId: string) => void;
  updatePhase: (phaseId: string, updates: Partial<RoadmapPhase>) => void;
  addPhase: (phase: Omit<RoadmapPhase, 'id'>) => string;
  deletePhase: (phaseId: string) => void;
  reorderFeatures: (phaseId: string, featureIds: string[]) => void;
  reorderPhases: (phaseIds: string[]) => void;
  updateFeaturePhase: (featureId: string, newPhaseId: string) => void;
  addFeature: (feature: Omit<RoadmapFeature, 'id'>) => string;
  addChatMessage: (message: Omit<{ id: string; role: string; content: string; timestamp: Date; operations?: RoadmapOperation[] }, 'id' | 'timestamp'>) => void;
  clearChatMessages: () => void;
  setChatProcessing: (isProcessing: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearRoadmap: () => void;
}

const initialRoadmapGenerationStatus: RoadmapGenerationStatus = {
  phase: 'idle',
  progress: 0,
  message: '',
};

const createInitialRoadmapState = (): RoadmapState => ({
  roadmap: null,
  competitorAnalysis: null,
  generationStatus: initialRoadmapGenerationStatus,
  progressLogs: [],
  currentProjectId: null,
  chatMessages: [],
  isChatProcessing: false,
  history: { past: [], future: [] },

  setRoadmap: (roadmap) => {
    UnifiedStore.setState((state) => {
      state.roadmap.roadmap = roadmap;
      state.roadmap.history = { past: [], future: [] };
    });
  },

  setCompetitorAnalysis: (analysis) => {
    UnifiedStore.setState((state) => {
      state.roadmap.competitorAnalysis = analysis;
    });
  },

  setGenerationStatus: (status) => {
    UnifiedStore.setState((state) => {
      state.roadmap.generationStatus = status;
    });
  },

  addProgressLog: (log) => {
    UnifiedStore.setState((state) => {
      state.roadmap.progressLogs.unshift(log);
      if (state.roadmap.progressLogs.length > 100) {
        state.roadmap.progressLogs = state.roadmap.progressLogs.slice(0, 100);
      }
    });
  },

  clearProgressLogs: () => {
    UnifiedStore.setState((state) => {
      state.roadmap.progressLogs = [];
    });
  },

  setCurrentProjectId: (projectId) => {
    UnifiedStore.setState((state) => {
      state.roadmap.currentProjectId = projectId;
    });
  },

  updateFeatureStatus: (featureId, status) => {
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap) return;
      const feature = state.roadmap.roadmap.features.find((f) => f.id === featureId);
      if (feature) {
        state.roadmap.history.past.push({ ...state.roadmap.roadmap });
        if (state.roadmap.history.past.length > MAX_HISTORY_SIZE) {
          state.roadmap.history.past.shift();
        }
        state.roadmap.history.future = [];
        feature.status = status;
        state.roadmap.roadmap.updatedAt = new Date();
      }
    });
  },

  updateFeatureTitle: (featureId, title) => {
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap) return;
      const feature = state.roadmap.roadmap.features.find((f) => f.id === featureId);
      if (feature) {
        state.roadmap.history.past.push({ ...state.roadmap.roadmap });
        if (state.roadmap.history.past.length > MAX_HISTORY_SIZE) {
          state.roadmap.history.past.shift();
        }
        state.roadmap.history.future = [];
        feature.title = title;
        state.roadmap.roadmap.updatedAt = new Date();
      }
    });
  },

  updateFeatureDescription: (featureId, description) => {
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap) return;
      const feature = state.roadmap.roadmap.features.find((f) => f.id === featureId);
      if (feature) {
        state.roadmap.history.past.push({ ...state.roadmap.roadmap });
        if (state.roadmap.history.past.length > MAX_HISTORY_SIZE) {
          state.roadmap.history.past.shift();
        }
        state.roadmap.history.future = [];
        feature.description = description;
        state.roadmap.roadmap.updatedAt = new Date();
      }
    });
  },

  updateFeaturePriority: (featureId, priority) => {
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap) return;
      const feature = state.roadmap.roadmap.features.find((f) => f.id === featureId);
      if (feature) {
        state.roadmap.history.past.push({ ...state.roadmap.roadmap });
        if (state.roadmap.history.past.length > MAX_HISTORY_SIZE) {
          state.roadmap.history.past.shift();
        }
        state.roadmap.history.future = [];
        feature.priority = priority;
        state.roadmap.roadmap.updatedAt = new Date();
      }
    });
  },

  addContextToFeature: (featureId, context) => {
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap) return;
      const feature = state.roadmap.roadmap.features.find((f) => f.id === featureId);
      if (feature) {
        state.roadmap.history.past.push({ ...state.roadmap.roadmap });
        if (state.roadmap.history.past.length > MAX_HISTORY_SIZE) {
          state.roadmap.history.past.shift();
        }
        state.roadmap.history.future = [];
        feature.rationale = feature.rationale ? `${feature.rationale}\n\n${context}` : context;
        state.roadmap.roadmap.updatedAt = new Date();
      }
    });
  },

  markFeatureDoneBySpecId: (specId) => {
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap) return;
      const feature = state.roadmap.roadmap.features.find((f) => f.linkedSpecId === specId);
      if (feature) {
        state.roadmap.history.past.push({ ...state.roadmap.roadmap });
        if (state.roadmap.history.past.length > MAX_HISTORY_SIZE) {
          state.roadmap.history.past.shift();
        }
        state.roadmap.history.future = [];
        feature.status = 'done';
        state.roadmap.roadmap.updatedAt = new Date();
      }
    });
  },

  updateFeatureLinkedSpec: (featureId, specId) => {
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap) return;
      const feature = state.roadmap.roadmap.features.find((f) => f.id === featureId);
      if (feature) {
        state.roadmap.history.past.push({ ...state.roadmap.roadmap });
        if (state.roadmap.history.past.length > MAX_HISTORY_SIZE) {
          state.roadmap.history.past.shift();
        }
        state.roadmap.history.future = [];
        feature.linkedSpecId = specId;
        feature.status = 'in_progress';
        state.roadmap.roadmap.updatedAt = new Date();
      }
    });
  },

  deleteFeature: (featureId) => {
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap) return;
      state.roadmap.history.past.push({ ...state.roadmap.roadmap });
      if (state.roadmap.history.past.length > MAX_HISTORY_SIZE) {
        state.roadmap.history.past.shift();
      }
      state.roadmap.history.future = [];
      state.roadmap.roadmap.features = state.roadmap.roadmap.features.filter((f) => f.id !== featureId);
      state.roadmap.roadmap.updatedAt = new Date();
    });
  },

  updatePhase: (phaseId, updates) => {
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap) return;
      const phase = state.roadmap.roadmap.phases.find((p) => p.id === phaseId);
      if (phase) {
        state.roadmap.history.past.push({ ...state.roadmap.roadmap });
        if (state.roadmap.history.past.length > MAX_HISTORY_SIZE) {
          state.roadmap.history.past.shift();
        }
        state.roadmap.history.future = [];
        Object.assign(phase, updates);
        state.roadmap.roadmap.updatedAt = new Date();
      }
    });
  },

  addPhase: (phaseData) => {
    const newId = `phase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap) return;
      state.roadmap.history.past.push({ ...state.roadmap.roadmap });
      if (state.roadmap.history.past.length > MAX_HISTORY_SIZE) {
        state.roadmap.history.past.shift();
      }
      state.roadmap.history.future = [];
      state.roadmap.roadmap.phases.push({
        ...phaseData,
        id: newId,
      });
      state.roadmap.roadmap.updatedAt = new Date();
    });
    return newId;
  },

  deletePhase: (phaseId) => {
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap) return;
      state.roadmap.history.past.push({ ...state.roadmap.roadmap });
      if (state.roadmap.history.past.length > MAX_HISTORY_SIZE) {
        state.roadmap.history.past.shift();
      }
      state.roadmap.history.future = [];
      state.roadmap.roadmap.phases = state.roadmap.roadmap.phases.filter((p) => p.id !== phaseId);
      state.roadmap.roadmap.features = state.roadmap.roadmap.features.filter((f) => f.phaseId !== phaseId);
      state.roadmap.roadmap.updatedAt = new Date();
    });
  },

  reorderFeatures: (phaseId, featureIds) => {
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap) return;
      state.roadmap.history.past.push({ ...state.roadmap.roadmap });
      if (state.roadmap.history.past.length > MAX_HISTORY_SIZE) {
        state.roadmap.history.past.shift();
      }
      state.roadmap.history.future = [];

      const orderMap = new Map(featureIds.map((id, index) => [id, index]));
      const sortedFeatures = [...state.roadmap.roadmap.features].sort((a, b) => {
        const aInPhase = a.phaseId === phaseId;
        const bInPhase = b.phaseId === phaseId;

        if (aInPhase && bInPhase) {
          const aOrder = orderMap.get(a.id) ?? 999;
          const bOrder = orderMap.get(b.id) ?? 999;
          return aOrder - bOrder;
        } else if (aInPhase) {
          return -1;
        } else if (bInPhase) {
          return 1;
        } else {
          return 0;
        }
      });

      state.roadmap.roadmap.features = sortedFeatures;
      state.roadmap.roadmap.updatedAt = new Date();
    });
  },

  reorderPhases: (phaseIds) => {
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap) return;
      state.roadmap.history.past.push({ ...state.roadmap.roadmap });
      if (state.roadmap.history.past.length > MAX_HISTORY_SIZE) {
        state.roadmap.history.past.shift();
      }
      state.roadmap.history.future = [];

      const orderMap = new Map(phaseIds.map((id, index) => [id, index]));
      const sortedPhases = [...state.roadmap.roadmap.phases].sort((a, b) => {
        const aOrder = orderMap.get(a.id) ?? 999;
        const bOrder = orderMap.get(b.id) ?? 999;
        return aOrder - bOrder;
      });

      state.roadmap.roadmap.phases = sortedPhases;
      state.roadmap.roadmap.updatedAt = new Date();
    });
  },

  updateFeaturePhase: (featureId, newPhaseId) => {
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap) return;
      const feature = state.roadmap.roadmap.features.find((f) => f.id === featureId);
      if (feature) {
        state.roadmap.history.past.push({ ...state.roadmap.roadmap });
        if (state.roadmap.history.past.length > MAX_HISTORY_SIZE) {
          state.roadmap.history.past.shift();
        }
        state.roadmap.history.future = [];
        feature.phaseId = newPhaseId;
        state.roadmap.roadmap.updatedAt = new Date();
      }
    });
  },

  addFeature: (featureData) => {
    const newId = `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap) return;
      state.roadmap.history.past.push({ ...state.roadmap.roadmap });
      if (state.roadmap.history.past.length > MAX_HISTORY_SIZE) {
        state.roadmap.history.past.shift();
      }
      state.roadmap.history.future = [];
      state.roadmap.roadmap.features.push({
        ...featureData,
        id: newId,
      });
      state.roadmap.roadmap.updatedAt = new Date();
    });
    return newId;
  },

  addChatMessage: (message) => {
    UnifiedStore.setState((state) => {
      state.roadmap.chatMessages.push({
        ...message,
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      });
    });
  },

  clearChatMessages: () => {
    UnifiedStore.setState((state) => {
      state.roadmap.chatMessages = [];
    });
  },

  setChatProcessing: (isProcessing) => {
    UnifiedStore.setState((state) => {
      state.roadmap.isChatProcessing = isProcessing;
    });
  },

  undo: () => {
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap || state.roadmap.history.past.length === 0) return;
      state.roadmap.history.future.push({ ...state.roadmap.roadmap });
      const previous = state.roadmap.history.past.pop();
      if (previous) {
        state.roadmap.roadmap = previous;
      }
    });
  },

  redo: () => {
    UnifiedStore.setState((state) => {
      if (!state.roadmap.roadmap || state.roadmap.history.future.length === 0) return;
      state.roadmap.history.past.push({ ...state.roadmap.roadmap });
      const next = state.roadmap.history.future.pop();
      if (next) {
        state.roadmap.roadmap = next;
      }
    });
  },

  canUndo: () => {
    const state = UnifiedStore.getState();
    return state.roadmap.history.past.length > 0;
  },

  canRedo: () => {
    const state = UnifiedStore.getState();
    return state.roadmap.history.future.length > 0;
  },

  clearRoadmap: () => {
    UnifiedStore.setState((state) => {
      state.roadmap.roadmap = null;
      state.roadmap.competitorAnalysis = null;
      state.roadmap.generationStatus = initialRoadmapGenerationStatus;
      state.roadmap.progressLogs = [];
      state.roadmap.currentProjectId = null;
      state.roadmap.chatMessages = [];
      state.roadmap.isChatProcessing = false;
      state.roadmap.history = { past: [], future: [] };
    });
  },
});

// ============================================
// Root State & Store Creation
// ============================================

interface RootState {
  calendar: CalendarState;
  ideation: IdeationState;
  insights: InsightsState;
  roadmap: RoadmapState;
  _timeTravel: TimeTravelState;
  _meta: {
    version: number;
    lastUpdate: Date | null;
  };
}

const createInitialRootState = (): RootState => ({
  calendar: createInitialCalendarState(),
  ideation: createInitialIdeationState(),
  insights: createInitialInsightsState(),
  roadmap: createInitialRoadmapState(),
  _timeTravel: {
    past: [],
    future: [],
  },
  _meta: {
    version: 1,
    lastUpdate: null,
  },
});

// Create the unified store with middleware
export const UnifiedStore = create<RootState>()(
  devtools(
    immer((set, get) => {
      return createInitialRootState();
    }),
    {
      name: 'UnifiedStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================
// Time-Travel Actions
// ============================================

export const timeTravelActions = {
  undo: () => {
    const state = UnifiedStore.getState();
    if (state._timeTravel.past.length === 0) return;

    const previous = state._timeTravel.past.pop()!;
    UnifiedStore.setState({
      ...state,
      _timeTravel: {
        past: state._timeTravel.past,
        future: [...state._timeTravel.future, { ...state }],
      },
    });
  },

  redo: () => {
    const state = UnifiedStore.getState();
    if (state._timeTravel.future.length === 0) return;

    const next = state._timeTravel.future.pop()!;
    UnifiedStore.setState({
      ...state,
      _timeTravel: {
        past: [...state._timeTravel.past, { ...state }],
        future: state._timeTravel.future,
      },
    });
  },

  jumpTo: (index: number) => {
    const state = UnifiedStore.getState();
    const targetState = state._timeTravel.past[index];
    if (!targetState) return;

    UnifiedStore.setState({
      ...targetState,
      _timeTravel: {
        past: state._timeTravel.past.slice(0, index),
        future: [...state._timeTravel.past.slice(index + 1), ...state._timeTravel.future],
      },
    });
  },

  clearHistory: () => {
    UnifiedStore.setState((state) => {
      state._timeTravel = { past: [], future: [] };
    });
  },

  canUndo: () => {
    return UnifiedStore.getState()._timeTravel.past.length > 0;
  },

  canRedo: () => {
    return UnifiedStore.getState()._timeTravel.future.length > 0;
  },

  getHistory: () => {
    return UnifiedStore.getState()._timeTravel.past;
  },
};

// ============================================
// Slice Selectors (for optimized subscriptions)
// ============================================

export const useCalendar = () => UnifiedStore((state) => state.calendar);
export const useIdeation = () => UnifiedStore((state) => state.ideation);
export const useInsights = () => UnifiedStore((state) => state.insights);
export const useRoadmap = () => UnifiedStore((state) => state.roadmap);

// Optimized selectors for specific values
export const useCalendarData = () => UnifiedStore((state) => state.calendar.calendarData);
export const useIdeationSession = () => UnifiedStore((state) => state.ideation.session);
export const useInsightsSession = () => UnifiedStore((state) => state.insights.session);
export const useRoadmapData = () => UnifiedStore((state) => state.roadmap.roadmap);

// ============================================
// Backward Compatibility Hooks
// ============================================

/**
 * Backward compatibility: useUnifiedCalendarStore
 * Provides same API as old useCalendarStore for gradual migration
 */
export const useUnifiedCalendarStore = () => {
  const calendar = useCalendar();
  return {
    ...calendar,
    // Ensure all methods are bound to current state
  };
};

/**
 * Backward compatibility: useUnifiedIdeationStore
 */
export const useUnifiedIdeationStore = () => {
  const ideation = useIdeation();
  return {
    ...ideation,
  };
};

/**
 * Backward compatibility: useUnifiedInsightsStore
 */
export const useUnifiedInsightsStore = () => {
  const insights = useInsights();
  return {
    ...insights,
  };
};

/**
 * Backward compatibility: useUnifiedRoadmapStore
 */
export const useUnifiedRoadmapStore = () => {
  const roadmap = useRoadmap();
  return {
    ...roadmap,
  };
};

// ============================================
// Performance Utilities
// ============================================

/**
 * Batch multiple state updates into a single re-render
 * Use this when updating multiple slices at once
 */
export function batchStateUpdates(updater: (state: RootState) => void) {
  UnifiedStore.setState(updater);
}

/**
 * Subscribe to specific slice changes only
 * Reduces re-renders by avoiding global state subscriptions
 */
export function subscribeToCalendar(
  callback: (calendar: CalendarState) => void
): () => void {
  let lastState = UnifiedStore.getState().calendar;
  const unsubscribe = UnifiedStore.subscribe(() => {
    const currentState = UnifiedStore.getState().calendar;
    if (currentState !== lastState) {
      lastState = currentState;
      callback(currentState);
    }
  });
  return unsubscribe;
}

export function subscribeToIdeation(
  callback: (ideation: IdeationState) => void
): () => void {
  let lastState = UnifiedStore.getState().ideation;
  const unsubscribe = UnifiedStore.subscribe(() => {
    const currentState = UnifiedStore.getState().ideation;
    if (currentState !== lastState) {
      lastState = currentState;
      callback(currentState);
    }
  });
  return unsubscribe;
}

export function subscribeToInsights(
  callback: (insights: InsightsState) => void
): () => void {
  let lastState = UnifiedStore.getState().insights;
  const unsubscribe = UnifiedStore.subscribe(() => {
    const currentState = UnifiedStore.getState().insights;
    if (currentState !== lastState) {
      lastState = currentState;
      callback(currentState);
    }
  });
  return unsubscribe;
}

export function subscribeToRoadmap(
  callback: (roadmap: RoadmapState) => void
): () => void {
  let lastState = UnifiedStore.getState().roadmap;
  const unsubscribe = UnifiedStore.subscribe(() => {
    const currentState = UnifiedStore.getState().roadmap;
    if (currentState !== lastState) {
      lastState = currentState;
      callback(currentState);
    }
  });
  return unsubscribe;
}

// ============================================
// Type Exports
// ============================================

export type { CalendarState, IdeationState, InsightsState, RoadmapState, RootState, TimeTravelState };
// IdeationTypeState is exported above where it's defined
