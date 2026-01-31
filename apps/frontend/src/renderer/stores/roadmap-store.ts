import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  CompetitorAnalysis,
  Roadmap,
  RoadmapFeature,
  RoadmapFeatureStatus,
  RoadmapGenerationStatus,
  RoadmapProgressLog,
  RoadmapPhase,
  FeatureSource
} from '../../shared/types';

/**
 * Migrate roadmap data to latest schema
 * - Converts 'idea' status to 'under_review' (Canny-compatible)
 * - Adds default source for features without one
 */
function migrateRoadmapIfNeeded(roadmap: Roadmap): Roadmap {
  let needsMigration = false;

  const migratedFeatures = roadmap.features.map((feature) => {
    const migratedFeature = { ...feature };

    // Migrate 'idea' status to 'under_review'
    if ((feature.status as string) === 'idea') {
      migratedFeature.status = 'under_review';
      needsMigration = true;
    }

    // Add default source if missing
    if (!feature.source) {
      migratedFeature.source = { provider: 'internal' } as FeatureSource;
      needsMigration = true;
    }

    return migratedFeature;
  });

  if (needsMigration) {
    console.log('[Roadmap] Migrated roadmap data to latest schema');
    return {
      ...roadmap,
      features: migratedFeatures,
      updatedAt: new Date()
    };
  }

  return roadmap;
}

// ============================================
// Chat Message Types
// ============================================

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: Date;
  operations?: RoadmapOperation[];
}

export type RoadmapOperationType =
  | 'add_context'
  | 'redefine_phase'
  | 'redefine_task'
  | 'update_status'
  | 'rearrange_priority'
  | 'add_task'
  | 'delete_task'
  | 'move_task';

export interface RoadmapOperation {
  type: RoadmapOperationType;
  targetId?: string;
  data: Record<string, unknown>;
  description: string;
}

// ============================================
// Undo/Redo History Types
// ============================================

interface HistoryState {
  past: Roadmap[];
  future: Roadmap[];
}

// Maximum history size for undo/redo
const MAX_HISTORY_SIZE = 50;

interface RoadmapState {
  // Data
  roadmap: Roadmap | null;
  competitorAnalysis: CompetitorAnalysis | null;
  generationStatus: RoadmapGenerationStatus;
  progressLogs: RoadmapProgressLog[];
  currentProjectId: string | null;  // Track which project we're viewing/generating for

  // Chat state
  chatMessages: ChatMessage[];
  isChatProcessing: boolean;

  // History for undo/redo
  history: HistoryState;

  // Actions
  setRoadmap: (roadmap: Roadmap | null) => void;
  setCompetitorAnalysis: (analysis: CompetitorAnalysis | null) => void;
  setGenerationStatus: (status: RoadmapGenerationStatus) => void;
  addProgressLog: (log: RoadmapProgressLog) => void;
  clearProgressLogs: () => void;
  setCurrentProjectId: (projectId: string | null) => void;

  // Feature actions
  updateFeatureStatus: (featureId: string, status: RoadmapFeatureStatus) => void;
  updateFeatureTitle: (featureId: string, title: string) => void;
  updateFeatureDescription: (featureId: string, description: string) => void;
  updateFeaturePriority: (featureId: string, priority: 'must' | 'should' | 'could' | 'wont') => void;
  addContextToFeature: (featureId: string, context: string) => void;
  markFeatureDoneBySpecId: (specId: string) => void;
  updateFeatureLinkedSpec: (featureId: string, specId: string) => void;
  deleteFeature: (featureId: string) => void;

  // Phase actions
  updatePhase: (phaseId: string, updates: Partial<RoadmapPhase>) => void;
  addPhase: (phase: Omit<RoadmapPhase, 'id'>) => string;
  deletePhase: (phaseId: string) => void;

  // Drag-and-drop actions
  reorderFeatures: (phaseId: string, featureIds: string[]) => void;
  reorderPhases: (phaseIds: string[]) => void;
  updateFeaturePhase: (featureId: string, newPhaseId: string) => void;
  addFeature: (feature: Omit<RoadmapFeature, 'id'>) => string;

  // Chat actions
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChatMessages: () => void;
  setChatProcessing: (isProcessing: boolean) => void;

  // Undo/Redo actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Clear
  clearRoadmap: () => void;
}

const initialGenerationStatus: RoadmapGenerationStatus = {
  phase: 'idle',
  progress: 0,
  message: ''
};

const initialHistoryState: HistoryState = {
  past: [],
  future: []
};

export const useRoadmapStore = create<RoadmapState>()(
  immer((set, get) => ({
    // Initial state
    roadmap: null,
    competitorAnalysis: null,
    generationStatus: initialGenerationStatus,
    progressLogs: [],
    currentProjectId: null,
    chatMessages: [],
    isChatProcessing: false,
    history: initialHistoryState,

    // Actions
    setRoadmap: (roadmap) =>
      set((state) => {
        state.roadmap = roadmap;
        // Reset history when loading a new roadmap
        state.history = initialHistoryState;
      }),

    setCompetitorAnalysis: (analysis) =>
      set((state) => {
        state.competitorAnalysis = analysis;
      }),

    setGenerationStatus: (status) =>
      set((state) => {
        state.generationStatus = status;
        // Clear progress logs when generation completes or errors
        if (status.phase === 'complete' || status.phase === 'error') {
          // Keep logs for viewing, don't clear immediately
        }
      }),

    addProgressLog: (log) =>
      set((state) => {
        // Add log to the beginning (newest first)
        state.progressLogs.unshift(log);
        // Keep only last 100 logs to prevent memory issues
        if (state.progressLogs.length > 100) {
          state.progressLogs = state.progressLogs.slice(0, 100);
        }
      }),

    clearProgressLogs: () =>
      set((state) => {
        state.progressLogs = [];
      }),

    setCurrentProjectId: (projectId) =>
      set((state) => {
        state.currentProjectId = projectId;
      }),

  updateFeatureStatus: (featureId, status) =>
    set((state) => {
      if (!state.roadmap) return;

      // Save current state to history for undo
      const currentRoadmap = { ...state.roadmap };
      state.history.past.push(currentRoadmap);
      // Trim history if needed
      if (state.history.past.length > MAX_HISTORY_SIZE) {
        state.history.past.shift();
      }
      // Clear future when making new changes
      state.history.future = [];

      // Update feature status
      const feature = state.roadmap.features.find((f) => f.id === featureId);
      if (feature) {
        feature.status = status;
      }
      state.roadmap.updatedAt = new Date();
    }),

  updateFeatureTitle: (featureId, title) =>
    set((state) => {
      if (!state.roadmap) return;

      const currentRoadmap = { ...state.roadmap };
      state.history.past.push(currentRoadmap);
      if (state.history.past.length > MAX_HISTORY_SIZE) {
        state.history.past.shift();
      }
      state.history.future = [];

      const feature = state.roadmap.features.find((f) => f.id === featureId);
      if (feature) {
        feature.title = title;
      }
      state.roadmap.updatedAt = new Date();
    }),

  updateFeatureDescription: (featureId, description) =>
    set((state) => {
      if (!state.roadmap) return;

      const currentRoadmap = { ...state.roadmap };
      state.history.past.push(currentRoadmap);
      if (state.history.past.length > MAX_HISTORY_SIZE) {
        state.history.past.shift();
      }
      state.history.future = [];

      const feature = state.roadmap.features.find((f) => f.id === featureId);
      if (feature) {
        feature.description = description;
      }
      state.roadmap.updatedAt = new Date();
    }),

  updateFeaturePriority: (featureId, priority) =>
    set((state) => {
      if (!state.roadmap) return;

      const currentRoadmap = { ...state.roadmap };
      state.history.past.push(currentRoadmap);
      if (state.history.past.length > MAX_HISTORY_SIZE) {
        state.history.past.shift();
      }
      state.history.future = [];

      const feature = state.roadmap.features.find((f) => f.id === featureId);
      if (feature) {
        feature.priority = priority;
      }
      state.roadmap.updatedAt = new Date();
    }),

  addContextToFeature: (featureId, context) =>
    set((state) => {
      if (!state.roadmap) return;

      const currentRoadmap = { ...state.roadmap };
      state.history.past.push(currentRoadmap);
      if (state.history.past.length > MAX_HISTORY_SIZE) {
        state.history.past.shift();
      }
      state.history.future = [];

      const feature = state.roadmap.features.find((f) => f.id === featureId);
      if (feature) {
        feature.rationale = feature.rationale ? `${feature.rationale}\n\n${context}` : context;
      }
      state.roadmap.updatedAt = new Date();
    }),

  markFeatureDoneBySpecId: (specId) =>
    set((state) => {
      if (!state.roadmap) return;

      const currentRoadmap = { ...state.roadmap };
      state.history.past.push(currentRoadmap);
      if (state.history.past.length > MAX_HISTORY_SIZE) {
        state.history.past.shift();
      }
      state.history.future = [];

      const feature = state.roadmap.features.find((f) => f.linkedSpecId === specId);
      if (feature) {
        feature.status = 'done';
      }
      state.roadmap.updatedAt = new Date();
    }),

  updateFeatureLinkedSpec: (featureId, specId) =>
    set((state) => {
      if (!state.roadmap) return;

      const currentRoadmap = { ...state.roadmap };
      state.history.past.push(currentRoadmap);
      if (state.history.past.length > MAX_HISTORY_SIZE) {
        state.history.past.shift();
      }
      state.history.future = [];

      const feature = state.roadmap.features.find((f) => f.id === featureId);
      if (feature) {
        feature.linkedSpecId = specId;
        feature.status = 'in_progress';
      }
      state.roadmap.updatedAt = new Date();
    }),

  deleteFeature: (featureId) =>
    set((state) => {
      if (!state.roadmap) return;

      const currentRoadmap = { ...state.roadmap };
      state.history.past.push(currentRoadmap);
      if (state.history.past.length > MAX_HISTORY_SIZE) {
        state.history.past.shift();
      }
      state.history.future = [];

      state.roadmap.features = state.roadmap.features.filter((f) => f.id !== featureId);
      state.roadmap.updatedAt = new Date();
    }),

  updatePhase: (phaseId, updates) =>
    set((state) => {
      if (!state.roadmap) return;

      const currentRoadmap = { ...state.roadmap };
      state.history.past.push(currentRoadmap);
      if (state.history.past.length > MAX_HISTORY_SIZE) {
        state.history.past.shift();
      }
      state.history.future = [];

      const phase = state.roadmap.phases.find((p) => p.id === phaseId);
      if (phase) {
        Object.assign(phase, updates);
      }
      state.roadmap.updatedAt = new Date();
    }),

  addPhase: (phaseData) => {
    const newId = `phase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newPhase: RoadmapPhase = {
      ...phaseData,
      id: newId
    };

    set((state) => {
      if (!state.roadmap) return;

      const currentRoadmap = { ...state.roadmap };
      state.history.past.push(currentRoadmap);
      if (state.history.past.length > MAX_HISTORY_SIZE) {
        state.history.past.shift();
      }
      state.history.future = [];

      state.roadmap.phases.push(newPhase);
      state.roadmap.updatedAt = new Date();
    });

    return newId;
  },

  deletePhase: (phaseId) =>
    set((state) => {
      if (!state.roadmap) return;

      const currentRoadmap = { ...state.roadmap };
      state.history.past.push(currentRoadmap);
      if (state.history.past.length > MAX_HISTORY_SIZE) {
        state.history.past.shift();
      }
      state.history.future = [];

      state.roadmap.phases = state.roadmap.phases.filter((p) => p.id !== phaseId);
      // Also remove features in this phase
      state.roadmap.features = state.roadmap.features.filter((f) => f.phaseId !== phaseId);
      state.roadmap.updatedAt = new Date();
    }),

  clearRoadmap: () =>
    set((state) => {
      state.roadmap = null;
      state.competitorAnalysis = null;
      state.generationStatus = initialGenerationStatus;
      state.progressLogs = [];
      state.currentProjectId = null;
      state.chatMessages = [];
      state.history = initialHistoryState;
    }),

  reorderFeatures: (phaseId, featureIds) =>
    set((state) => {
      if (!state.roadmap) return;

      const currentRoadmap = { ...state.roadmap };
      state.history.past.push(currentRoadmap);
      if (state.history.past.length > MAX_HISTORY_SIZE) {
        state.history.past.shift();
      }
      state.history.future = [];

      // Create a map of feature order based on the new featureIds array
      const orderMap = new Map(featureIds.map((id, index) => [id, index]));

      // Sort all features: first by phase, then by order within phase
      const sortedFeatures = [...state.roadmap.features].sort((a, b) => {
        // Features in the target phase come first
        const aInPhase = a.phaseId === phaseId;
        const bInPhase = b.phaseId === phaseId;

        if (aInPhase && bInPhase) {
          // Both in target phase - use new order
          const aOrder = orderMap.get(a.id) ?? 999;
          const bOrder = orderMap.get(b.id) ?? 999;
          return aOrder - bOrder;
        } else if (aInPhase) {
          return -1; // a comes first
        } else if (bInPhase) {
          return 1; // b comes first
        } else {
          // Neither in target phase - maintain relative order
          return 0;
        }
      });

      state.roadmap.features = sortedFeatures;
      state.roadmap.updatedAt = new Date();
    }),

  reorderPhases: (phaseIds) =>
    set((state) => {
      if (!state.roadmap) return;

      const currentRoadmap = { ...state.roadmap };
      state.history.past.push(currentRoadmap);
      if (state.history.past.length > MAX_HISTORY_SIZE) {
        state.history.past.shift();
      }
      state.history.future = [];

      const orderMap = new Map(phaseIds.map((id, index) => [id, index]));
      const sortedPhases = [...state.roadmap.phases].sort((a, b) => {
        const aOrder = orderMap.get(a.id) ?? 999;
        const bOrder = orderMap.get(b.id) ?? 999;
        return aOrder - bOrder;
      });

      state.roadmap.phases = sortedPhases;
      state.roadmap.updatedAt = new Date();
    }),

  updateFeaturePhase: (featureId, newPhaseId) =>
    set((state) => {
      if (!state.roadmap) return;

      const currentRoadmap = { ...state.roadmap };
      state.history.past.push(currentRoadmap);
      if (state.history.past.length > MAX_HISTORY_SIZE) {
        state.history.past.shift();
      }
      state.history.future = [];

      const feature = state.roadmap.features.find((f) => f.id === featureId);
      if (feature) {
        feature.phaseId = newPhaseId;
      }
      state.roadmap.updatedAt = new Date();
    }),

  addFeature: (featureData) => {
    const newId = `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newFeature: RoadmapFeature = {
      ...featureData,
      id: newId
    };

    set((state) => {
      if (!state.roadmap) return;

      const currentRoadmap = { ...state.roadmap };
      state.history.past.push(currentRoadmap);
      if (state.history.past.length > MAX_HISTORY_SIZE) {
        state.history.past.shift();
      }
      state.history.future = [];

      state.roadmap.features.push(newFeature);
      state.roadmap.updatedAt = new Date();
    });

    return newId;
  },

  // Chat actions
  addChatMessage: (message) =>
    set((state) => {
      const newMessage: ChatMessage = {
        ...message,
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date()
      };
      state.chatMessages.push(newMessage);
    }),

  clearChatMessages: () =>
    set((state) => {
      state.chatMessages = [];
    }),

  setChatProcessing: (isProcessing) =>
    set((state) => {
      state.isChatProcessing = isProcessing;
    }),

  // Undo/Redo actions
  undo: () =>
    set((state) => {
      if (!state.roadmap || state.history.past.length === 0) return;

      // Save current state to future
      state.history.future.push({ ...state.roadmap });

      // Restore previous state
      const previous = state.history.past.pop();
      if (previous) {
        state.roadmap = previous;
      }
    }),

  redo: () =>
    set((state) => {
      if (!state.roadmap || state.history.future.length === 0) return;

      // Save current state to past
      state.history.past.push({ ...state.roadmap });

      // Restore next state
      const next = state.history.future.pop();
      if (next) {
        state.roadmap = next;
      }
    }),

  canUndo: () => get().history.past.length > 0,
  canRedo: () => get().history.future.length > 0,

  // Reorder features within a phase
  reorderFeatures: (phaseId, featureIds) =>
    set((state) => {
      if (!state.roadmap) return state;

      // Get features for this phase in the new order
      const phaseFeatures = featureIds
        .map((id) => state.roadmap!.features.find((f) => f.id === id))
        .filter((f): f is RoadmapFeature => f !== undefined);

      // Get features from other phases (unchanged)
      const otherFeatures = state.roadmap.features.filter(
        (f) => f.phaseId !== phaseId
      );

      // Combine: other phases first, then reordered phase features
      const updatedFeatures = [...otherFeatures, ...phaseFeatures];

      return {
        roadmap: {
          ...state.roadmap,
          features: updatedFeatures,
          updatedAt: new Date()
        }
      };
    })
})));

// Helper functions for loading roadmap
export async function loadRoadmap(projectId: string): Promise<void> {
  const store = useRoadmapStore.getState();

  // Always set current project ID first - this ensures event handlers
  // only process events for the currently viewed project
  store.setCurrentProjectId(projectId);

  // Query if roadmap generation is currently running for this project
  // This restores the generation status when switching back to a project
  const statusResult = await window.electronAPI.getRoadmapStatus(projectId);
  if (statusResult.success && statusResult.data?.isRunning) {
    // Generation is running - restore the UI state to show progress
    // The actual progress will be updated by incoming events
    store.setGenerationStatus({
      phase: 'analyzing',
      progress: 0,
      message: 'Roadmap generation in progress...'
    });
  } else {
    // Generation is not running - reset to idle
    store.setGenerationStatus({
      phase: 'idle',
      progress: 0,
      message: ''
    });
  }

  const result = await window.electronAPI.getRoadmap(projectId);
  if (result.success && result.data) {
    // Migrate roadmap to latest schema if needed
    const migratedRoadmap = migrateRoadmapIfNeeded(result.data);
    store.setRoadmap(migratedRoadmap);

    // Save migrated roadmap if changes were made
    if (migratedRoadmap !== result.data) {
      window.electronAPI.saveRoadmap(projectId, migratedRoadmap).catch((err) => {
        console.error('[Roadmap] Failed to save migrated roadmap:', err);
      });
    }

    // Extract and set competitor analysis separately if present
    if (migratedRoadmap.competitorAnalysis) {
      store.setCompetitorAnalysis(migratedRoadmap.competitorAnalysis);
    } else {
      store.setCompetitorAnalysis(null);
    }
  } else {
    store.setRoadmap(null);
    store.setCompetitorAnalysis(null);
  }
}

export function generateRoadmap(
  projectId: string,
  enableCompetitorAnalysis?: boolean,
  refreshCompetitorAnalysis?: boolean
): void {
  // Debug logging
  if (window.DEBUG) {
    console.log('[Roadmap] Starting generation:', { projectId, enableCompetitorAnalysis, refreshCompetitorAnalysis });
  }

  useRoadmapStore.getState().setGenerationStatus({
    phase: 'analyzing',
    progress: 0,
    message: 'Starting roadmap generation...'
  });
  window.electronAPI.generateRoadmap(projectId, enableCompetitorAnalysis, refreshCompetitorAnalysis);
}

export function refreshRoadmap(
  projectId: string,
  enableCompetitorAnalysis?: boolean,
  refreshCompetitorAnalysis?: boolean
): void {
  // Debug logging
  if (window.DEBUG) {
    console.log('[Roadmap] Starting refresh:', { projectId, enableCompetitorAnalysis, refreshCompetitorAnalysis });
  }

  useRoadmapStore.getState().setGenerationStatus({
    phase: 'analyzing',
    progress: 0,
    message: 'Refreshing roadmap...'
  });
  window.electronAPI.refreshRoadmap(projectId, enableCompetitorAnalysis, refreshCompetitorAnalysis);
}

export async function stopRoadmap(projectId: string): Promise<boolean> {
  const store = useRoadmapStore.getState();

  // Debug logging
  if (window.DEBUG) {
    console.log('[Roadmap] Stop requested:', { projectId });
  }

  // Always update UI state to 'idle' when user requests stop, regardless of backend response
  // This prevents the UI from getting stuck in "generating" state if the process already ended
  store.setGenerationStatus({
    phase: 'idle',
    progress: 0,
    message: 'Generation stopped'
  });

  const result = await window.electronAPI.stopRoadmap(projectId);

  // Debug logging
  if (window.DEBUG) {
    console.log('[Roadmap] Stop result:', { projectId, success: result.success });
  }

  if (!result.success) {
    // Backend couldn't find/stop the process (likely already finished/crashed)
    console.log('[Roadmap] Process already stopped');
  }

  return result.success;
}

// Selectors
export function getFeaturesByPhase(
  roadmap: Roadmap | null,
  phaseId: string
): RoadmapFeature[] {
  if (!roadmap) return [];
  return roadmap.features.filter((f) => f.phaseId === phaseId);
}

export function getFeaturesByPriority(
  roadmap: Roadmap | null,
  priority: string
): RoadmapFeature[] {
  if (!roadmap) return [];
  return roadmap.features.filter((f) => f.priority === priority);
}

export function getFeatureStats(roadmap: Roadmap | null): {
  total: number;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  byComplexity: Record<string, number>;
} {
  if (!roadmap) {
    return {
      total: 0,
      byPriority: {},
      byStatus: {},
      byComplexity: {}
    };
  }

  const byPriority: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byComplexity: Record<string, number> = {};

  roadmap.features.forEach((feature) => {
    byPriority[feature.priority] = (byPriority[feature.priority] || 0) + 1;
    byStatus[feature.status] = (byStatus[feature.status] || 0) + 1;
    byComplexity[feature.complexity] = (byComplexity[feature.complexity] || 0) + 1;
  });

  return {
    total: roadmap.features.length,
    byPriority,
    byStatus,
    byComplexity
  };
}

// ============================================
// IPC Event Listener Setup
// ============================================

/**
 * Setup roadmap event listeners - call this once when the app initializes
 * This handles IPC events from the main process for roadmap generation
 */
export function setupRoadmapListeners(): () => void {
  const store = useRoadmapStore.getState;

  // Helper to check if event is for the current project
  const isCurrentProject = (eventProjectId: string): boolean => {
    const currentProjectId = store().currentProjectId;
    return currentProjectId === eventProjectId;
  };

  // Listen for progress updates
  const unsubProgress = window.electronAPI.roadmap.onRoadmapProgress((projectId, status) => {
    // Only process events for the current project
    if (!isCurrentProject(projectId)) {
      if (window.DEBUG) {
        console.log('[Roadmap] Ignoring progress for different project:', projectId);
      }
      return;
    }

    // Debug logging
    if (window.DEBUG) {
      console.log('[Roadmap] Progress update:', {
        projectId,
        phase: status.phase,
        progress: status.progress,
        message: status.message
      });
    }

    store().setGenerationStatus(status);
  });

  // Listen for log messages (new structured logs)
  const unsubLog = window.electronAPI.roadmap.onRoadmapLog((projectId, log) => {
    if (!isCurrentProject(projectId)) {
      if (window.DEBUG) {
        console.log('[Roadmap] Ignoring log for different project:', projectId);
      }
      return;
    }

    // Debug logging
    if (window.DEBUG) {
      console.log('[Roadmap] Log:', {
        projectId,
        severity: log.severity,
        message: log.message,
        tool: log.tool,
        phase: log.phase
      });
    }

    // Convert timestamp string to Date for the ProgressLog component
    const progressLog = {
      ...log,
      timestamp: new Date(log.timestamp)
    };

    store().addProgressLog(progressLog);
  });

  // Listen for completion
  const unsubComplete = window.electronAPI.roadmap.onRoadmapComplete(async (projectId, roadmap) => {
    if (!isCurrentProject(projectId)) {
      if (window.DEBUG) {
        console.log('[Roadmap] Ignoring complete for different project:', projectId);
      }
      return;
    }

    // Debug logging
    if (window.DEBUG) {
      console.log('[Roadmap] Generation complete:', { projectId });
    }

    // Migrate roadmap to latest schema if needed
    const migratedRoadmap = migrateRoadmapIfNeeded(roadmap);
    store().setRoadmap(migratedRoadmap);
    store().setGenerationStatus({
      phase: 'complete',
      progress: 100,
      message: 'Roadmap generation complete!'
    });

    // Clear progress logs on completion
    store().clearProgressLogs();

    // Save migrated roadmap if changes were made
    if (migratedRoadmap !== roadmap) {
      try {
        await window.electronAPI.saveRoadmap(projectId, migratedRoadmap);
      } catch (err) {
        console.error('[Roadmap] Failed to save migrated roadmap:', err);
      }
    }

    // Extract and set competitor analysis separately if present
    if (migratedRoadmap.competitorAnalysis) {
      store().setCompetitorAnalysis(migratedRoadmap.competitorAnalysis);
    }
  });

  // Listen for errors
  const unsubError = window.electronAPI.roadmap.onRoadmapError((projectId, error) => {
    if (!isCurrentProject(projectId)) {
      if (window.DEBUG) {
        console.log('[Roadmap] Ignoring error for different project:', projectId);
      }
      return;
    }

    // Debug logging
    if (window.DEBUG) {
      console.log('[Roadmap] Generation error:', { projectId, error });
    }

    store().setGenerationStatus({
      phase: 'error',
      progress: 0,
      message: 'Generation failed',
      error
    });
  });

  // Listen for stopped events
  const unsubStopped = window.electronAPI.roadmap.onRoadmapStopped((projectId) => {
    if (!isCurrentProject(projectId)) {
      if (window.DEBUG) {
        console.log('[Roadmap] Ignoring stopped for different project:', projectId);
      }
      return;
    }

    // Debug logging
    if (window.DEBUG) {
      console.log('[Roadmap] Generation stopped:', { projectId });
    }

    store().setGenerationStatus({
      phase: 'idle',
      progress: 0,
      message: 'Generation stopped'
    });

    // Clear progress logs when stopped
    store().clearProgressLogs();
  });

  // Return cleanup function
  return () => {
    unsubProgress();
    unsubLog();
    unsubComplete();
    unsubError();
    unsubStopped();
  };
}
