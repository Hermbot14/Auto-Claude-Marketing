import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ============================================
// Optimistic Update Types
// ============================================

/**
 * Pending mutation status in the queue
 */
export type MutationStatus = 'pending' | 'processing' | 'success' | 'failed';

/**
 * Types of mutations that can be optimistically updated
 */
export type MutationType =
  | 'update_task_status'
  | 'update_task_title'
  | 'update_task_description'
  | 'create_task'
  | 'delete_task'
  | 'update_feature_status'
  | 'update_feature_title'
  | 'update_feature_description'
  | 'add_feature'
  | 'delete_feature'
  | 'reorder_features'
  | 'reorder_phases'
  | 'update_roadmap_metadata';

/**
 * A pending mutation in the queue
 */
export interface PendingMutation {
  id: string;
  type: MutationType;
  status: MutationStatus;
  timestamp: Date;
  // Target resource identifiers
  targetId?: string;
  projectId?: string;
  // Mutation data
  data: Record<string, unknown>;
  // Rollback data for error recovery
  rollbackData?: {
    tasks?: unknown[];
    features?: unknown[];
    phases?: unknown[];
    taskOrder?: Record<string, string[]>;
  };
  // Error information if failed
  error?: string;
  // Retry count
  retryCount: number;
}

/**
 * Conflict information when server state differs
 */
export interface ConflictInfo {
  mutationId: string;
  localState: Record<string, unknown>;
  serverState: Record<string, unknown>;
  conflictFields: string[];
  timestamp: Date;
}

/**
 * Sync status for tracking overall health
 */
export interface SyncStatus {
  isOnline: boolean;
  lastSyncAt: Date | null;
  pendingCount: number;
  failedCount: number;
}

// ============================================
// Optimistic Update Store State
// ============================================

interface OptimisticState {
  // Queue of pending mutations
  mutations: PendingMutation[];

  // Conflicts that need resolution
  conflicts: ConflictInfo[];

  // Overall sync status
  syncStatus: SyncStatus;

  // Actions
  addMutation: (mutation: Omit<PendingMutation, 'id' | 'timestamp' | 'retryCount'>) => string;
  updateMutationStatus: (id: string, status: MutationStatus, error?: string) => void;
  removeMutation: (id: string) => void;
  retryMutation: (id: string) => void;
  clearMutations: () => void;
  clearFailedMutations: () => void;

  // Conflict actions
  addConflict: (conflict: Omit<ConflictInfo, 'id' | 'timestamp'>) => string;
  resolveConflict: (conflictId: string, useServerState: boolean) => void;
  dismissConflict: (conflictId: string) => void;
  clearConflicts: () => void;

  // Sync status actions
  setOnlineStatus: (isOnline: boolean) => void;
  updateSyncStatus: (updates: Partial<SyncStatus>) => void;

  // Selectors
  getPendingMutations: () => PendingMutation[];
  getFailedMutations: () => PendingMutation[];
  getProcessingMutation: () => PendingMutation | null;
  getPendingCount: () => number;
}

// Maximum retry attempts for failed mutations
const MAX_RETRIES = 3;

// Delay between retry attempts (ms)
const RETRY_DELAY = 2000;

// Maximum mutations in queue
const MAX_QUEUE_SIZE = 50;

/**
 * Create an empty sync status
 */
function createEmptySyncStatus(): SyncStatus {
  return {
    isOnline: navigator.onLine ?? true,
    lastSyncAt: null,
    pendingCount: 0,
    failedCount: 0
  };
}

// ============================================
// Store Implementation
// ============================================

export const useOptimisticStore = create<OptimisticState>()(
  immer((set, get) => ({
    // Initial state
    mutations: [],
    conflicts: [],
    syncStatus: createEmptySyncStatus(),

    // ============================================
    // Mutation Queue Management
    // ============================================

    /**
     * Add a new mutation to the queue
     * Generates unique ID and timestamps automatically
     */
    addMutation: (mutationData) => {
      const id = `mutation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const mutation: PendingMutation = {
        ...mutationData,
        id,
        timestamp: new Date(),
        status: 'pending',
        retryCount: 0
      };

      set((state) => {
        // Enforce max queue size
        if (state.mutations.length >= MAX_QUEUE_SIZE) {
          console.warn('[OptimisticStore] Mutation queue full, removing oldest mutation');
          state.mutations.shift();
        }

        state.mutations.push(mutation);
        state.syncStatus.pendingCount = state.mutations.filter(
          m => m.status === 'pending' || m.status === 'processing'
        ).length;
      });

      // Auto-process pending mutations
      setTimeout(() => {
        get().processNextMutation();
      }, 0);

      return id;
    },

    /**
     * Update the status of an existing mutation
     */
    updateMutationStatus: (id, status, error) => {
      set((state) => {
        const mutation = state.mutations.find(m => m.id === id);
        if (!mutation) return;

        mutation.status = status;
        if (error) {
          mutation.error = error;
        }

        // Update sync status counts
        state.syncStatus.pendingCount = state.mutations.filter(
          m => m.status === 'pending' || m.status === 'processing'
        ).length;
        state.syncStatus.failedCount = state.mutations.filter(
          m => m.status === 'failed'
        ).length;
      });
    },

    /**
     * Remove a mutation from the queue (typically after success)
     */
    removeMutation: (id) => {
      set((state) => {
        state.mutations = state.mutations.filter(m => m.id !== id);
        state.syncStatus.lastSyncAt = new Date();
        state.syncStatus.pendingCount = state.mutations.filter(
          m => m.status === 'pending' || m.status === 'processing'
        ).length;
      });
    },

    /**
     * Retry a failed mutation
     */
    retryMutation: (id) => {
      const state = get();
      const mutation = state.mutations.find(m => m.id === id);

      if (!mutation || mutation.status !== 'failed') return;

      if (mutation.retryCount >= MAX_RETRIES) {
        console.error('[OptimisticStore] Max retries exceeded for mutation:', id);
        return;
      }

      // Reset to pending and increment retry count
      set((draft) => {
        const m = draft.mutations.find(m => m.id === id);
        if (!m) return;

        m.status = 'pending';
        m.retryCount++;
        m.error = undefined;
      });

      // Schedule retry
      setTimeout(() => {
        get().processNextMutation();
      }, RETRY_DELAY);
    },

    /**
     * Clear all mutations (e.g., on page unload)
     */
    clearMutations: () => {
      set((state) => {
        state.mutations = [];
        state.syncStatus.pendingCount = 0;
      });
    },

    /**
     * Clear only failed mutations
     */
    clearFailedMutations: () => {
      set((state) => {
        state.mutations = state.mutations.filter(m => m.status !== 'failed');
        state.syncStatus.failedCount = 0;
      });
    },

    // ============================================
    // Conflict Management
    // ============================================

    /**
     * Add a conflict that needs user resolution
     */
    addConflict: (conflictData) => {
      const id = `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const conflict: ConflictInfo = {
        ...conflictData,
        id,
        timestamp: new Date()
      };

      set((state) => {
        state.conflicts.push(conflict);
      });

      return id;
    },

    /**
     * Resolve a conflict by choosing local or server state
     */
    resolveConflict: (conflictId, useServerState) => {
      set((state) => {
        const conflict = state.conflicts.find(c => c.id === conflictId);
        if (!conflict) return;

        // Remove conflict after resolution
        state.conflicts = state.conflicts.filter(c => c.id !== conflictId);
      });
    },

    /**
     * Dismiss a conflict without resolving
     */
    dismissConflict: (conflictId) => {
      set((state) => {
        state.conflicts = state.conflicts.filter(c => c.id !== conflictId);
      });
    },

    /**
     * Clear all conflicts
     */
    clearConflicts: () => {
      set((state) => {
        state.conflicts = [];
      });
    },

    // ============================================
    // Sync Status Management
    // ============================================

    /**
     * Update online/offline status
     */
    setOnlineStatus: (isOnline) => {
      set((state) => {
        state.syncStatus.isOnline = isOnline;

        // If coming back online, retry failed mutations
        if (isOnline) {
          const failedMutations = state.mutations.filter(
            m => m.status === 'failed' && m.retryCount < MAX_RETRIES
          );

          // Reset failed mutations to pending for retry
          failedMutations.forEach(m => {
            const mutation = state.mutations.find(mut => mut.id === m.id);
            if (mutation) {
              mutation.status = 'pending';
              mutation.error = undefined;
            }
          });

          // Process queue
          setTimeout(() => {
            get().processNextMutation();
          }, 100);
        }
      });
    },

    /**
     * Update sync status fields
     */
    updateSyncStatus: (updates) => {
      set((state) => {
        state.syncStatus = { ...state.syncStatus, ...updates };
      });
    },

    // ============================================
    // Selectors
    // ============================================

    getPendingMutations: () => {
      const state = get();
      return state.mutations.filter(m => m.status === 'pending' || m.status === 'processing');
    },

    getFailedMutations: () => {
      const state = get();
      return state.mutations.filter(m => m.status === 'failed');
    },

    getProcessingMutation: () => {
      const state = get();
      return state.mutations.find(m => m.status === 'processing') || null;
    },

    getPendingCount: () => {
      const state = get();
      return state.mutations.filter(
        m => m.status === 'pending' || m.status === 'processing'
      ).length;
    },

    // ============================================
    // Internal: Process Next Mutation
    // ============================================
    processNextMutation: async () => {
      const state = get();
      const nextMutation = state.mutations.find(
        m => m.status === 'pending'
      );

      if (!nextMutation) return;

      // Mark as processing
      get().updateMutationStatus(nextMutation.id, 'processing');

      try {
        // Here the actual API call would be made
        // For now, we simulate success after a delay
        // In production, this would call the appropriate API method
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mark as success
        get().removeMutation(nextMutation.id);
      } catch (error) {
        // Mark as failed
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        get().updateMutationStatus(nextMutation.id, 'failed', errorMessage);
      }

      // Process next mutation
      setTimeout(() => {
        get().processNextMutation();
      }, 100);
    }
  }))
);

// ============================================
// Helper Functions
// ============================================

/**
 * Optimistically update a task in the UI
 * @param store The zustand store to update
 * @param taskId Task ID to update
 * @param updates Data to apply optimistically
 * @returns Mutation ID for tracking
 */
export function optimisticTaskUpdate<T extends { updateTask: (id: string, updates: unknown) => void }>(
  store: T,
  taskId: string,
  updates: Record<string, unknown>
): string {
  // Capture current state for rollback
  const currentState = store.getState();

  // Apply optimistic update immediately
  store.updateTask(taskId, updates as any);

  // Add to mutation queue
  const optimisticStore = useOptimisticStore.getState();
  return optimisticStore.addMutation({
    type: 'update_task_status',
    targetId: taskId,
    data: updates,
    rollbackData: {
      // Would capture relevant state here for rollback
    }
  });
}

/**
 * Optimistically update a feature in the UI
 * @param store The zustand store to update
 * @param featureId Feature ID to update
 * @param updates Data to apply optimistically
 * @returns Mutation ID for tracking
 */
export function optimisticFeatureUpdate<T extends { updateFeatureStatus: (id: string, status: unknown) => void }>(
  store: T,
  featureId: string,
  updates: Record<string, unknown>
): string {
  // Apply optimistic update immediately
  (store as any).updateFeatureStatus(featureId, updates.status as any);

  // Add to mutation queue
  const optimisticStore = useOptimisticStore.getState();
  return optimisticStore.addMutation({
    type: 'update_feature_status',
    targetId: featureId,
    data: updates,
    rollbackData: {}
  });
}

/**
 * Rollback an optimistic update on error
 * @param mutationId The mutation ID to rollback
 * @param rollbackData Data to restore
 */
export function rollbackOptimisticUpdate(
  mutationId: string,
  rollbackData: Record<string, unknown> | undefined
): void {
  const optimisticStore = useOptimisticStore.getState();
  const mutation = optimisticStore.mutations.find(m => m.id === mutationId);

  if (!mutation) {
    console.error('[OptimisticStore] Mutation not found for rollback:', mutationId);
    return;
  }

  // Apply rollback data if available
  if (rollbackData) {
    // In a real implementation, this would restore the state
    console.log('[OptimisticStore] Rolling back mutation:', mutationId);
  }

  // Remove mutation from queue
  optimisticStore.removeMutation(mutationId);
}

/**
 * Check for conflicts between local and server state
 * @param localState Local state data
 * @param serverState Server state data
 * @returns Conflict info or null if no conflict
 */
export function detectConflict(
  localState: Record<string, unknown>,
  serverState: Record<string, unknown>
): { hasConflict: boolean; conflictFields: string[] } {
  const conflictFields: string[] = [];

  // Check for version conflicts
  if (localState.version !== serverState.version) {
    conflictFields.push('version');
  }

  // Check for updatedAt conflicts
  const localUpdatedAt = new Date(localState.updatedAt as string);
  const serverUpdatedAt = new Date(serverState.updatedAt as string);

  if (localUpdatedAt < serverUpdatedAt) {
    conflictFields.push('updatedAt');
  }

  return {
    hasConflict: conflictFields.length > 0,
    conflictFields
  };
}

// ============================================
// Online/Offline Detection
// ============================================

/**
 * Setup online/offline event listeners
 * Call this once during app initialization
 */
export function setupOptimisticListeners(): () => void {
  const handleOnline = () => {
    useOptimisticStore.getState().setOnlineStatus(true);
  };

  const handleOffline = () => {
    useOptimisticStore.getState().setOnlineStatus(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Set initial state
  useOptimisticStore.getState().setOnlineStatus(navigator.onLine ?? true);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
