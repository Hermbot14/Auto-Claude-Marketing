/**
 * EventLogger - Event Flow Visualization
 *
 * Tracks and displays application events:
 * - User interactions (clicks, inputs)
 * - System events (navigation, lifecycle)
 * - IPC messages
 * - Network events
 * - Event filtering and search
 * - Timeline visualization
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Search, Filter, X, ChevronDown, ChevronRight, MousePointer, Globe, MessageSquare, Zap, Calendar } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { useDevtoolsStore, useEventLogger } from '../../stores/devtools-store'
import type { EventLog } from './types'
import { clsx } from 'clsx'

/**
 * Get event type icon
 */
function getEventIcon(type: EventLog['type']) {
  switch (type) {
    case 'user':
      return <MousePointer className="h-3.5 w-3.5 text-blue-500" />
    case 'system':
      return <Zap className="h-3.5 w-3.5 text-purple-500" />
    case 'ipc':
      return <MessageSquare className="h-3.5 w-3.5 text-green-500" />
    case 'network':
      return <Globe className="h-3.5 w-3.5 text-cyan-500" />
    case 'lifecycle':
      return <Calendar className="h-3.5 w-3.5 text-orange-500" />
    default:
      return <div className="h-3.5 w-3.5 rounded-full bg-gray-500" />
  }
}

/**
 * Event detail view
 */
interface EventDetailProps {
  /** Event log entry */
  event: EventLog
  /** Whether expanded */
  expanded: boolean
  /** Toggle expand */
  onToggle: () => void
}

function EventDetail({ event, expanded, onToggle }: EventDetailProps) {
  const formattedTime = useMemo(() => {
    return new Date(event.timestamp).toLocaleTimeString()
  }, [event.timestamp])

  const formattedData = useMemo(() => {
    if (event.data === null) return 'null'
    if (event.data === undefined) return 'undefined'
    if (typeof event.data === 'string') return event.data
    if (typeof event.data === 'object') {
      return JSON.stringify(event.data, null, 2)
    }
    return String(event.data)
  }, [event.data])

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}

        {getEventIcon(event.type)}

        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold uppercase">
          {event.type}
        </span>

        <span className="font-mono text-sm flex-1 truncate">{event.event}</span>

        <span className="text-muted-foreground text-xs">{formattedTime}</span>

        {event.source && (
          <span className="text-muted-foreground text-xs">
            from {event.source}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t bg-muted/30 p-3">
          <h4 className="mb-2 font-semibold text-sm">Event Data</h4>
          <pre className="overflow-auto rounded bg-background p-2 text-xs">
            {formattedData}
          </pre>

          {/* Metadata */}
          <div className="mt-3 grid gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Type:</span>
              <span className="rounded bg-background px-2 py-0.5 font-mono">
                {event.type}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Timestamp:</span>
              <span className="font-mono">
                {new Date(event.timestamp).toLocaleString()}
              </span>
            </div>
            {event.source && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Source:</span>
                <span className="font-mono">{event.source}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Timeline visualization
 */
interface TimelineProps {
  /** Events to display */
  events: EventLog[]
  /** Time window in ms */
  timeWindow?: number
  /** On click event */
  onEventClick?: (event: EventLog) => void
}

function EventTimeline({ events, timeWindow = 10000, onEventClick }: TimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredEvent, setHoveredEvent] = useState<EventLog | null>(null)

  const timelineData = useMemo(() => {
    if (events.length === 0) return []

    const now = Date.now()
    const windowStart = now - timeWindow

    // Filter events in time window
    const inWindow = events.filter(e => e.timestamp >= windowStart)

    // Calculate positions
    return inWindow.map(event => {
      const offset = event.timestamp - windowStart
      const x = (offset / timeWindow) * 100
      return { event, x }
    })
  }, [events, timeWindow])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || timelineData.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width = canvas.offsetWidth * 2
    const height = canvas.height = 60 * 2

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Group by type for stacking
    const typeY: Record<string, number> = {
      user: 20,
      system: 35,
      ipc: 50,
      network: 65,
      lifecycle: 80
    }

    // Draw events
    timelineData.forEach(({ event, x }) => {
      const xPos = (x / 100) * width
      const yPos = typeY[event.type] || 40
      const radius = 6

      ctx.beginPath()
      ctx.arc(xPos, yPos, radius, 0, Math.PI * 2)

      // Color by type
      switch (event.type) {
        case 'user':
          ctx.fillStyle = '#3b82f6'
          break
        case 'system':
          ctx.fillStyle = '#a855f7'
          break
        case 'ipc':
          ctx.fillStyle = '#22c55e'
          break
        case 'network':
          ctx.fillStyle = '#06b6d4'
          break
        case 'lifecycle':
          ctx.fillStyle = '#f97316'
          break
        default:
          ctx.fillStyle = '#6b7280'
      }

      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()
    })

    // Draw time markers
    ctx.fillStyle = '#6b7280'
    ctx.font = '24px sans-serif'
    ctx.fillText('Now', width - 80, 25)
    ctx.fillText(`-${timeWindow / 1000}s`, 20, 25)

  }, [timelineData, timeWindow])

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: '60px' }}
      />
      {hoveredEvent && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 rounded bg-background border px-2 py-1 text-xs shadow-lg">
          <span className="font-semibold">{hoveredEvent.event}</span>
          <span className="text-muted-foreground ml-2">
            {new Date(hoveredEvent.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Stats summary
 */
function EventStats({ events }: { events: EventLog[] }) {
  const stats = useMemo(() => {
    const byType = events.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const uniqueEvents = new Set(events.map(e => e.event)).size

    const timeSpan = events.length > 0
      ? events[events.length - 1].timestamp - events[0].timestamp
      : 0

    return {
      total: events.length,
      byType,
      uniqueEvents,
      timeSpan
    }
  }, [events])

  return (
    <div className="flex flex-wrap items-center gap-4 border-b bg-muted/30 px-4 py-2 text-xs">
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">Total:</span>
        <span className="font-semibold">{stats.total}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">Unique:</span>
        <span className="font-semibold">{stats.uniqueEvents}</span>
      </div>
      {stats.timeSpan > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Span:</span>
          <span className="font-semibold">
            {(stats.timeSpan / 1000).toFixed(1)}s
          </span>
        </div>
      )}
      <div className="flex items-center gap-2">
        {Object.entries(stats.byType).map(([type, count]) => (
          <span key={type} className="rounded bg-background px-2 py-0.5">
            {type}: {count}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Main event logger component
 */
export function EventLogger() {
  const loggedEvents = useDevtoolsStore((state) => state.loggedEvents)
  const clearEventLogs = useDevtoolsStore((state) => state.clearEventLogs)
  const [filter, setFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [timeWindow, setTimeWindow] = useState(30000) // 30 seconds default

  // Hook up event logger on mount
  useEffect(() => {
    // Event logging is handled by the useEventLogger hook in devtools-store
  }, [])

  // Filter events
  const filteredEvents = useMemo(() => {
    return loggedEvents.filter(event => {
      // Text filter
      if (filter) {
        const searchLower = filter.toLowerCase()
        const matchesEvent = event.event.toLowerCase().includes(searchLower)
        const matchesData = event.data
          ? JSON.stringify(event.data).toLowerCase().includes(searchLower)
          : false
        const matchesSource = event.source
          ? event.source.toLowerCase().includes(searchLower)
          : false

        if (!matchesEvent && !matchesData && !matchesSource) {
          return false
        }
      }

      // Type filter
      if (typeFilter !== 'all' && event.type !== typeFilter) {
        return false
      }

      return true
    })
  }, [loggedEvents, filter, typeFilter])

  const toggleExpand = useCallback((id: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpandedEvents(new Set(filteredEvents.map(e => e.id)))
  }, [filteredEvents])

  const collapseAll = useCallback(() => {
    setExpandedEvents(new Set())
  }, [])

  const exportEvents = useCallback(() => {
    const data = JSON.stringify(filteredEvents, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `events-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredEvents])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Event Logger</h2>
          <p className="text-muted-foreground text-xs">
            {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} / {loggedEvents.length} total
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={expandAll}
          >
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={collapseAll}
          >
            Collapse All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportEvents}
          >
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearEventLogs}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Stats */}
      <EventStats events={loggedEvents} />

      {/* Timeline */}
      {loggedEvents.length > 0 && (
        <div className="border-b px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold">Timeline</span>
            <select
              value={timeWindow.toString()}
              onChange={(e) => setTimeWindow(Number(e.target.value))}
              className="h-6 rounded border bg-background px-2 text-xs"
            >
              <option value="5000">5 seconds</option>
              <option value="10000">10 seconds</option>
              <option value="30000">30 seconds</option>
              <option value="60000">1 minute</option>
              <option value="300000">5 minutes</option>
            </select>
          </div>
          <EventTimeline events={loggedEvents} timeWindow={timeWindow} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="text-muted-foreground absolute left-2 top-2 h-4 w-4" />
          <Input
            placeholder="Search events..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 pl-8"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="text-muted-foreground absolute right-2 top-2 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-8 rounded border bg-background px-2 text-xs"
        >
          <option value="all">All Types</option>
          <option value="user">User</option>
          <option value="system">System</option>
          <option value="ipc">IPC</option>
          <option value="network">Network</option>
          <option value="lifecycle">Lifecycle</option>
        </select>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-auto">
        {filteredEvents.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">
              {loggedEvents.length === 0 ? 'No events recorded yet' : 'No events match the current filters'}
            </p>
          </div>
        ) : (
          <div>
            {filteredEvents.map((event) => (
              <EventDetail
                key={event.id}
                event={event}
                expanded={expandedEvents.has(event.id)}
                onToggle={() => toggleExpand(event.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
