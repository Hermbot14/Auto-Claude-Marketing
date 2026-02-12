/**
 * StateInspector - Visualize and Modify Application State
 *
 * Provides real-time inspection of all Zustand stores with:
 * - Expandable tree view of state objects
 * - Search/filter state keys
 * - State change history (time travel)
 * - Direct state modification
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, Search, Undo, Redo, Save, RefreshCw, Copy, Check } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { useDevtoolsStore } from '../../stores/devtools-store'
import { useStoreInspector } from '../../stores/devtools-store'
import type { StoreEntry } from './types'
import { clsx } from 'clsx'

interface JsonViewProps {
  /** Data to display */
  data: unknown
  /** Depth limit */
  depth?: number
  /** Initial expanded paths */
  expandedPaths?: Set<string>
  /** On toggle expand */
  onToggle?: (path: string) => void
  /** Current path */
  path?: string
}

/**
 * JSON tree view component
 */
function JsonView({ data, depth = 0, expandedPaths = new Set(), onToggle, path = '' }: JsonViewProps) {
  const isExpandable = data !== null && typeof data === 'object'
  const isExpanded = expandedPaths.has(path)
  const isArray = Array.isArray(data)
  const isEmpty = isExpandable && Object.keys(data).length === 0

  if (data === null) {
    return <span className="text-purple-600 dark:text-purple-400 font-medium">null</span>
  }

  if (data === undefined) {
    return <span className="text-gray-500 dark:text-gray-400 italic">undefined</span>
  }

  if (typeof data === 'boolean') {
    return <span className="text-blue-600 dark:text-blue-400 font-medium">{String(data)}</span>
  }

  if (typeof data === 'number') {
    return <span className="text-orange-600 dark:text-orange-400 font-medium">{data}</span>
  }

  if (typeof data === 'string') {
    // Truncate long strings
    const display = data.length > 50 ? `${data.slice(0, 50)}...` : data
    return (
      <span className="text-green-600 dark:text-green-400">
        &quot;{display}&quot;
      </span>
    )
  }

  if (isExpandable) {
    const entries = Object.entries(data)
    const isLarge = entries.length > 10

    return (
      <div>
        <button
          onClick={() => onToggle?.(path)}
          className="flex items-center gap-1 hover:bg-muted/50 rounded px-1 py-0.5 text-left transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          <span className={clsx(
            'font-mono text-xs',
            isArray && 'text-cyan-600 dark:text-cyan-400',
            !isArray && 'text-yellow-600 dark:text-yellow-400'
          )}>
            {isArray ? `Array(${entries.length})` : `{}`}
          </span>
          {!isExpanded && !isEmpty && isLarge && (
            <span className="text-muted-foreground text-xs">
              ({entries.length} items)
            </span>
          )}
        </button>

        {isExpanded && !isEmpty && (
          <div className="ml-4 border-l border-border pl-2">
            {entries.map(([key, value]) => (
              <div key={key} className="py-0.5">
                <span className="font-mono text-xs text-purple-600 dark:text-purple-400">
                  {key}:
                </span>{' '}
                <JsonView
                  data={value}
                  depth={depth + 1}
                  expandedPaths={expandedPaths}
                  onToggle={onToggle}
                  path={`${path}.${key}`}
                />
              </div>
            ))}
          </div>
        )}

        {isEmpty && (
          <span className="text-muted-foreground text-xs italic">empty</span>
        )}
      </div>
    )
  }

  return <span>{String(data)}</span>
}

interface StoreViewerProps {
  /** Store entry to display */
  entry: StoreEntry
  /** Whether this store can be modified */
  readonly?: boolean
}

/**
 * Individual store viewer component
 */
function StoreViewer({ entry, readonly = false }: StoreViewerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editValue, setEditValue] = useState('')

  const filteredState = useMemo(() => {
    if (!filter) return entry.state

    const recursiveFilter = (obj: unknown, path = ''): unknown => {
      if (obj === null || typeof obj !== 'object') {
        return path.toLowerCase().includes(filter.toLowerCase()) ? obj : undefined
      }

      const result: Record<string, unknown> = {}
      let hasMatch = false

      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key
        const filtered = recursiveFilter(value, currentPath)

        if (filtered !== undefined) {
          result[key] = filtered
          hasMatch = true
        }
      }

      return hasMatch ? result : undefined
    }

    return recursiveFilter(entry.state, entry.name)
  }, [entry.state, entry.name, filter])

  const togglePath = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const copyState = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(entry.state, null, 2))
  }, [entry.state])

  const startEdit = useCallback(() => {
    setEditValue(JSON.stringify(entry.state, null, 2))
    setEditMode(true)
  }, [entry.state])

  const saveEdit = useCallback(() => {
    try {
      const newState = JSON.parse(editValue)
      entry.store.setState(newState)
      setEditMode(false)
    } catch (err) {
      console.error('Failed to parse JSON:', err)
    }
  }, [entry, editValue])

  return (
    <div className="border rounded-lg bg-card">
      {/* Store header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="font-mono text-sm font-semibold">{entry.name}</h3>
          <span className="text-muted-foreground text-xs">
            {typeof entry.state === 'object' && entry.state !== null
              ? `${Object.keys(entry.state).length} keys`
              : 'primitive'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={copyState}
            title="Copy state"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {!readonly && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={startEdit}
              title="Edit state"
            >
              <Save className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="border-b px-3 py-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute left-2 top-2 h-4 w-4" />
          <Input
            placeholder="Filter state..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 pl-8"
          />
        </div>
      </div>

      {/* State content */}
      <div className="max-h-96 overflow-auto p-3">
        {editMode ? (
          <div className="space-y-2">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full h-64 rounded border bg-background p-2 font-mono text-xs"
              spellCheck={false}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditMode(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveEdit}
              >
                <Check className="mr-1 h-4 w-4" />
                Apply
              </Button>
            </div>
          </div>
        ) : (
          <JsonView
            data={filteredState}
            expandedPaths={expandedPaths}
            onToggle={togglePath}
            path={entry.name}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Main state inspector component
 */
export function StateInspector() {
  const { stores, stateHistory, historyIndex, canUndo, canRedo, undo, redo, takeSnapshot } = useStoreInspector()
  const [autoSnapshot, setAutoSnapshot] = useState(false)
  const [autoSnapshotInterval, setAutoSnapshotInterval] = useState(5000)

  // Auto snapshot
  useEffect(() => {
    if (!autoSnapshot) return

    const interval = setInterval(() => {
      takeSnapshot()
    }, autoSnapshotInterval)

    return () => clearInterval(interval)
  }, [autoSnapshot, autoSnapshotInterval, takeSnapshot])

  // Snapshot all stores
  const handleSnapshotAll = useCallback(() => {
    takeSnapshot()
  }, [takeSnapshot])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">State Inspector</h2>
          <p className="text-muted-foreground text-xs">
            {stores.length} store{stores.length !== 1 ? 's' : ''} · {stateHistory.length} snapshots
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* History controls */}
          <div className="flex items-center gap-1 border-r pr-3">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={undo}
              disabled={!canUndo}
              title="Undo"
            >
              <Undo className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={redo}
              disabled={!canRedo}
              title="Redo"
            >
              <Redo className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={handleSnapshotAll}
              title="Take snapshot"
            >
              <Save className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Auto snapshot toggle */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoSnapshot}
              onChange={(e) => setAutoSnapshot(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <span className="text-xs">Auto ({autoSnapshotInterval}ms)</span>
          </label>
        </div>
      </div>

      {/* History slider */}
      {stateHistory.length > 0 && (
        <div className="border-b px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs w-20">
              {historyIndex >= 0 ? `${historyIndex + 1}/${stateHistory.length}` : 'Live'}
            </span>
            <input
              type="range"
              min={-1}
              max={stateHistory.length - 1}
              value={historyIndex}
              onChange={(e) => {
                const index = Number(e.target.value)
                if (index === -1) {
                  // Live mode
                } else {
                  useStoreInspector().restoreSnapshot(index)
                }
              }}
              className="flex-1"
            />
            <span className="text-muted-foreground text-xs w-24">
              {historyIndex >= 0
                ? new Date(stateHistory[historyIndex].timestamp).toLocaleTimeString()
                : 'Current'}
            </span>
          </div>
        </div>
      )}

      {/* Stores grid */}
      <div className="flex-1 overflow-auto p-4">
        {stores.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <RefreshCw className="text-muted-foreground mx-auto mb-2 h-8 w-8 animate-spin" />
              <p className="text-muted-foreground text-sm">Discovering stores...</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <StoreViewer key={store.name} entry={store} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
