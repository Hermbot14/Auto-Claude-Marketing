/**
 * Devtools Types
 *
 * Type definitions for the developer tools system
 */

import type { StoreApi } from 'zustand'

/**
 * Available devtools tabs
 */
export type DevtoolsTab = 'state' | 'api' | 'components' | 'performance' | 'events' | 'memory'

/**
 * Store entry for state inspection
 */
export interface StoreEntry {
  /** Store name/identifier */
  name: string
  /** Zustand store instance */
  store: StoreApi<unknown>
  /** Store state snapshot */
  state: unknown
}

/**
 * State snapshot for time travel
 */
export interface StateSnapshot {
  /** Timestamp when snapshot was taken */
  timestamp: number
  /** All store states at this point in time */
  states: Record<string, unknown>
  /** Optional label for this snapshot */
  label?: string
}

/**
 * API call log entry
 */
export interface ApiCallLog {
  /** Unique identifier */
  id: string
  /** Timestamp of call */
  timestamp: number
  /** HTTP method or 'ipc' for Electron IPC */
  method: string
  /** API endpoint or IPC channel */
  url: string
  /** Request payload */
  request?: unknown
  /** Response data */
  response?: unknown
  /** HTTP status code or IPC success flag */
  status?: number | boolean
  /** Request duration in milliseconds */
  duration?: number
  /** Error message if call failed */
  error?: string
  /** Request size in bytes */
  requestSize?: number
  /** Response size in bytes */
  responseSize?: number
  /** Cache hit status */
  cached?: boolean
}

/**
 * Component tree node
 */
export interface ComponentTreeNode {
  /** Component display name */
  name: string
  /** Component file path (if available) */
  path?: string
  /** Component props */
  props?: Record<string, unknown>
  /** Component state */
  state?: Record<string, unknown>
  /** Child components */
  children: ComponentTreeNode[]
  /** Render time in milliseconds */
  renderTime?: number
  /** Number of times rendered */
  renderCount?: number
  /** Component depth in tree */
  depth: number
}

/**
 * Performance metric entry
 */
export interface PerformanceMetric {
  /** Unique identifier */
  id: string
  /** Timestamp */
  timestamp: number
  /** Metric type */
  type: 'render' | 'effect' | 'transition' | 'network' | 'memory'
  /** Metric label/name */
  label: string
  /** Duration in milliseconds */
  duration: number
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Event log entry
 */
export interface EventLog {
  /** Unique identifier */
  id: string
  /** Timestamp */
  timestamp: number
  /** Event type */
  type: 'user' | 'system' | 'ipc' | 'network' | 'lifecycle'
  /** Event name/type */
  event: string
  /** Event data */
  data?: unknown
  /** Event source */
  source?: string
}

/**
 * Memory snapshot
 */
export interface MemorySnapshot {
  /** Timestamp */
  timestamp: number
  /** Used JS heap size in bytes */
  usedJSHeapSize?: number
  /** Total JS heap size in bytes */
  totalJSHeapSize?: number
  /** JS heap size limit in bytes */
  jsHeapSizeLimit?: number
  /** Performance API memory entries */
  performanceEntries?: PerformanceEntry[]
}

/**
 * Devtools preferences
 */
export interface DevtoolsPreferences {
  /** Saved panel position */
  position?: { x: number; y: number }
  /** Saved panel size */
  size?: { width: number; height: number }
  /** Last active tab */
  activeTab?: DevtoolsTab
  /** Maximized state */
  isMaximized?: boolean
  /** Auto-refresh enabled */
  autoRefresh?: boolean
  /** Refresh interval in ms */
  refreshInterval?: number
}

/**
 * Devtools store state
 */
export interface DevtoolsState {
  /** Current panel open state */
  isOpen: boolean
  /** Active tab */
  activeTab: DevtoolsTab
  /** User preferences */
  preferences: DevtoolsPreferences
  /** Inspected store states */
  inspectedState: StoreEntry[]
  /** State history for time travel */
  stateHistory: StateSnapshot[]
  /** Current position in history */
  historyIndex: number
  /** Logged API calls */
  apiCalls: ApiCallLog[]
  /** Logged events */
  loggedEvents: EventLog[]
  /** Performance metrics */
  performanceMetrics: PerformanceMetric[]
  /** Memory snapshots */
  memorySnapshots: MemorySnapshot[]
  /** API call filter */
  apiFilter: string
  /** Event filter */
  eventFilter: string
}

/**
 * Devtools store actions
 */
export interface DevtoolsActions {
  /** Set panel open state */
  setIsOpen: (open: boolean) => void
  /** Set active tab */
  setActiveTab: (tab: DevtoolsTab) => void
  /** Update preferences */
  updatePreferences: (prefs: Partial<DevtoolsPreferences>) => void
  /** Set inspected state */
  setInspectedState: (state: StoreEntry[]) => void
  /** Set state history */
  setStateHistory: (history: StateSnapshot[]) => void
  /** Set history index */
  setHistoryIndex: (index: number) => void
  /** Add API call log */
  addApiCall: (call: ApiCallLog) => void
  /** Set API calls */
  setApiCalls: (calls: ApiCallLog[]) => void
  /** Clear API calls */
  clearApiCalls: () => void
  /** Add event log */
  addEventLog: (event: EventLog) => void
  /** Set logged events */
  setLoggedEvents: (events: EventLog[]) => void
  /** Clear event logs */
  clearEventLogs: () => void
  /** Add performance metric */
  addPerformanceMetric: (metric: PerformanceMetric) => void
  /** Set performance metrics */
  setPerformanceMetrics: (metrics: PerformanceMetric[]) => void
  /** Clear performance metrics */
  clearPerformanceMetrics: () => void
  /** Add memory snapshot */
  addMemorySnapshot: (snapshot: MemorySnapshot) => void
  /** Clear memory snapshots */
  clearMemorySnapshots: () => void
}

/**
 * Combined devtools store type
 */
export type DevtoolsStore = DevtoolsState & DevtoolsActions
