/**
 * Devtools Store
 *
 * Zustand store for managing developer tools state
 * Includes state inspection, API logging, performance tracking, etc.
 */

import { create, StoreApi } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { DevtoolsStore, DevtoolsState, DevtoolsActions, StoreEntry, StateSnapshot, ApiCallLog, EventLog, PerformanceMetric, MemorySnapshot, DevtoolsTab } from '../components/devtools/types'

const initialState: DevtoolsState = {
  isOpen: false,
  activeTab: 'state',
  preferences: {
    position: { x: 20, y: 20 },
    size: { width: 800, height: 600 },
    activeTab: 'state',
    isMaximized: false,
    autoRefresh: true,
    refreshInterval: 1000
  },
  inspectedState: [],
  stateHistory: [],
  historyIndex: -1,
  apiCalls: [],
  loggedEvents: [],
  performanceMetrics: [],
  memorySnapshots: [],
  apiFilter: '',
  eventFilter: ''
}

/**
 * Create devtools store with Zustand
 * Only active in development mode
 */
export const useDevtoolsStore = create<DevtoolsStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setIsOpen: (open) => set({ isOpen: open }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      updatePreferences: (prefs) => set((state) => ({
        preferences: { ...state.preferences, ...prefs }
      })),

      setInspectedState: (state) => set({ inspectedState: state }),

      setStateHistory: (history) => set({ stateHistory: history }),

      setHistoryIndex: (index) => set({ historyIndex: index }),

      addApiCall: (call) => set((state) => ({
        apiCalls: [...state.apiCalls, call].slice(-500) // Keep last 500
      })),

      setApiCalls: (calls) => set({ apiCalls: calls }),

      clearApiCalls: () => set({ apiCalls: [] }),

      addEventLog: (event) => set((state) => ({
        loggedEvents: [...state.loggedEvents, event].slice(-500) // Keep last 500
      })),

      setLoggedEvents: (events) => set({ loggedEvents: events }),

      clearEventLogs: () => set({ loggedEvents: [] }),

      addPerformanceMetric: (metric) => set((state) => ({
        performanceMetrics: [...state.performanceMetrics, metric].slice(-200) // Keep last 200
      })),

      setPerformanceMetrics: (metrics) => set({ performanceMetrics: metrics }),

      clearPerformanceMetrics: () => set({ performanceMetrics: [] }),

      addMemorySnapshot: (snapshot) => set((state) => ({
        memorySnapshots: [...state.memorySnapshots, snapshot].slice(-100) // Keep last 100
      })),

      clearMemorySnapshots: () => set({ memorySnapshots: [] })
    }),
    { name: 'DevtoolsStore', enabled: import.meta.env.MODE === 'development' }
  )
)

/**
 * Hook to inspect all Zustand stores in the application
 */
export function useStoreInspector() {
  const [stores, setStores] = useState<StoreEntry[]>([])
  const inspectedState = useDevtoolsStore((state) => state.inspectedState)
  const stateHistory = useDevtoolsStore((state) => state.stateHistory)
  const historyIndex = useDevtoolsStore((state) => state.historyIndex)

  // Discover stores on mount and interval
  useEffect(() => {
    const discoverStores = () => {
      const discovered: StoreEntry[] = []

      // Find stores from window global if registered
      if ((window as unknown as Record<string, unknown>).__ZUSTAND_STORES__) {
        const globalStores = (window as unknown as Record<string, unknown>).__ZUSTAND_STORES__ as Record<string, StoreApi<unknown>>
        for (const [name, store] of Object.entries(globalStores)) {
          try {
            discovered.push({
              name,
              store,
              state: store.getState()
            })
          } catch (err) {
            console.error(`[Devtools] Failed to read store ${name}:`, err)
          }
        }
      }

      // Also track known stores directly
      // This is a fallback for stores that don't register themselves
      const knownStoreModules = [
        { name: 'project', getter: () => import('../stores/project-store').then(m => m.useProjectStore.getState()) },
        { name: 'task', getter: () => import('../stores/task-store').then(m => m.useTaskStore.getState()) },
        { name: 'settings', getter: () => import('../stores/settings-store').then(m => m.useSettingsStore.getState()) },
        { name: 'terminal', getter: () => import('../stores/terminal-store').then(m => m.useTerminalStore.getState()) }
      ]

      setStores(discovered)
      useDevtoolsStore.getState().setInspectedState(discovered)
    }

    discoverStores()
    const interval = setInterval(discoverStores, 2000)

    return () => clearInterval(interval)
  }, [])

  // Take snapshot
  const takeSnapshot = useCallback(() => {
    const snapshot: StateSnapshot = {
      timestamp: Date.now(),
      states: {}
    }

    for (const entry of stores) {
      try {
        snapshot.states[entry.name] = entry.store.getState()
      } catch (err) {
        console.error(`[Devtools] Failed to snapshot store ${entry.name}:`, err)
      }
    }

    const currentHistory = useDevtoolsStore.getState().stateHistory
    const currentIndex = useDevtoolsStore.getState().historyIndex

    useDevtoolsStore.getState().setStateHistory([
      ...currentHistory.slice(0, currentIndex + 1),
      snapshot
    ])
    useDevtoolsStore.getState().setHistoryIndex(currentHistory.length)
  }, [stores])

  // Restore snapshot
  const restoreSnapshot = useCallback((index: number) => {
    const snapshot = stateHistory[index]
    if (!snapshot) return

    for (const [name, state] of Object.entries(snapshot.states)) {
      const store = stores.find(s => s.name === name)
      if (store) {
        try {
          store.store.setState(state)
        } catch (err) {
          console.error(`[Devtools] Failed to restore store ${name}:`, err)
        }
      }
    }

    useDevtoolsStore.getState().setHistoryIndex(index)
  }, [stateHistory, stores])

  return {
    stores,
    stateHistory,
    historyIndex,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < stateHistory.length - 1,
    takeSnapshot,
    restoreSnapshot,
    undo: () => restoreSnapshot(historyIndex - 1),
    redo: () => restoreSnapshot(historyIndex + 1)
  }
}

/**
 * Hook to track API calls
 */
export function useApiTracker() {
  const addApiCall = useDevtoolsStore((state) => state.addApiCall)

  useEffect(() => {
    // Intercept fetch calls
    const originalFetch = window.fetch

    window.fetch = async (...args) => {
      const start = performance.now()
      const [url, options] = args

      try {
        const response = await originalFetch(...args)
        const duration = performance.now() - start

        // Try to get response size
        const clone = response.clone()
        let responseSize: number | undefined
        try {
          const blob = await clone.blob()
          responseSize = blob.size
        } catch {
          // Response already consumed
        }

        addApiCall({
          id: `fetch-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          method: options?.method || 'GET',
          url: url.toString(),
          request: options?.body,
          status: response.status,
          duration,
          responseSize
        })

        return response
      } catch (error) {
        const duration = performance.now() - start

        addApiCall({
          id: `fetch-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          method: options?.method || 'GET',
          url: url.toString(),
          request: options?.body,
          error: error instanceof Error ? error.message : String(error),
          duration
        })

        throw error
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [addApiCall])
}

/**
 * Hook to log React events
 */
export function useEventLogger() {
  const addEventLog = useDevtoolsStore((state) => state.addEventLog)

  useEffect(() => {
    // Log React events if available
    const logEvent = (event: string, data?: unknown) => {
      addEventLog({
        id: `event-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        type: 'user',
        event,
        data
      })
    }

    // Listen for custom events
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<unknown>
      logEvent(customEvent.type, customEvent.detail)
    }

    // Log navigation
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState

    history.pushState = (...args) => {
      logEvent('navigation', { method: 'pushState', state: args[0] })
      return originalPushState.apply(history, args as unknown as Parameters<typeof history.pushState>)
    }

    history.replaceState = (...args) => {
      logEvent('navigation', { method: 'replaceState', state: args[0] })
      return originalReplaceState.apply(history, args as unknown as Parameters<typeof history.replaceState>)
    }

    window.addEventListener('popstate', () => {
      logEvent('navigation', { method: 'popstate' })
    })

    // Log hash changes
    window.addEventListener('hashchange', (e) => {
      logEvent('hashchange', { oldURL: e.oldURL, newURL: e.newURL })
    })

    // Log visibility changes
    document.addEventListener('visibilitychange', () => {
      logEvent('visibility', { hidden: document.hidden })
    })

    // Listen for custom app events
    const appEvents = [
      'project-selected',
      'task-created',
      'task-updated',
      'settings-changed',
      'theme-changed',
      'open-app-settings'
    ]

    appEvents.forEach(eventName => {
      window.addEventListener(eventName, handleCustomEvent)
    })

    return () => {
      history.pushState = originalPushState
      history.replaceState = originalReplaceState
      appEvents.forEach(eventName => {
        window.removeEventListener(eventName, handleCustomEvent)
      })
    }
  }, [addEventLog])
}
