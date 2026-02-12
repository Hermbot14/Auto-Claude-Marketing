/**
 * ApiProfiler - API Request/Response Logging
 *
 * Tracks and displays all API calls with:
 * - Request/response headers and bodies
 * - Timing information
 * - Status codes and errors
 * - Request filtering and search
 * - Export capabilities
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Search, Filter, X, Download, ChevronDown, ChevronRight, Clock, AlertCircle, CheckCircle } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { useDevtoolsStore } from '../../stores/devtools-store'
import type { ApiCallLog } from './types'
import { clsx } from 'clsx'

interface CallDetailProps {
  /** API call entry */
  call: ApiCallLog
  /** Whether detail is expanded */
  expanded: boolean
  /** Toggle expand */
  onToggle: () => void
}

/**
 * Individual API call detail view
 */
function CallDetail({ call, expanded, onToggle }: CallDetailProps) {
  const statusColor = useMemo(() => {
    if (call.error) return 'text-red-500'
    if (typeof call.status === 'number') {
      if (call.status >= 200 && call.status < 300) return 'text-green-500'
      if (call.status >= 300 && call.status < 400) return 'text-yellow-500'
      if (call.status >= 400 && call.status < 500) return 'text-orange-500'
      return 'text-red-500'
    }
    return 'text-muted-foreground'
  }, [call.error, call.status])

  const methodColor = useMemo(() => {
    switch (call.method.toLowerCase()) {
      case 'get': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
      case 'post': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
      case 'put': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
      case 'delete': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
      case 'patch': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    }
  }, [call.method])

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

        <span className={clsx('rounded px-1.5 py-0.5 text-xs font-semibold', methodColor)}>
          {call.method}
        </span>

        <span className="font-mono text-sm flex-1 truncate">{call.url}</span>

        {call.duration !== undefined && (
          <span className={clsx(
            'text-xs',
            call.duration > 1000 ? 'text-red-500' : call.duration > 500 ? 'text-yellow-500' : 'text-muted-foreground'
          )}>
            {call.duration.toFixed(0)}ms
          </span>
        )}

        {call.error ? (
          <AlertCircle className="h-4 w-4 text-red-500" />
        ) : typeof call.status === 'number' && (
          <span className={clsx('text-xs font-semibold', statusColor)}>
            {call.status}
          </span>
        )}

        {call.cached && (
          <span className="text-muted-foreground text-xs">(cached)</span>
        )}
      </button>

      {expanded && (
        <div className="border-t bg-muted/30 p-3">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Request */}
            {call.request !== undefined && (
              <div>
                <h4 className="mb-2 font-semibold text-sm">Request</h4>
                <pre className="overflow-auto rounded bg-background p-2 text-xs">
                  {JSON.stringify(call.request, null, 2)}
                </pre>
                {call.requestSize !== undefined && (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Size: {(call.requestSize / 1024).toFixed(2)} KB
                  </p>
                )}
              </div>
            )}

            {/* Response */}
            {call.response !== undefined && (
              <div>
                <h4 className="mb-2 font-semibold text-sm">Response</h4>
                <pre className="overflow-auto rounded bg-background p-2 text-xs">
                  {JSON.stringify(call.response, null, 2)}
                </pre>
                {call.responseSize !== undefined && (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Size: {(call.responseSize / 1024).toFixed(2)} KB
                  </p>
                )}
              </div>
            )}

            {/* Error */}
            {call.error && (
              <div className="md:col-span-2">
                <h4 className="mb-2 font-semibold text-sm text-red-500">Error</h4>
                <pre className="overflow-auto rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-500">
                  {call.error}
                </pre>
              </div>
            )}

            {/* Metadata */}
            <div className="md:col-span-2">
              <h4 className="mb-2 font-semibold text-sm">Metadata</h4>
              <div className="grid gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Timestamp:</span>
                  <span className="font-mono">
                    {new Date(call.timestamp).toLocaleString()}
                  </span>
                </div>
                {call.duration !== undefined && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Duration:</span>
                    <span className={clsx(
                      'font-mono',
                      call.duration > 1000 ? 'text-red-500' : call.duration > 500 ? 'text-yellow-500' : ''
                    )}>
                      {call.duration.toFixed(2)}ms
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Stats summary component
 */
function StatsSummary({ calls }: { calls: ApiCallLog[] }) {
  const stats = useMemo(() => {
    const total = calls.length
    const errors = calls.filter(c => c.error).length
    const cached = calls.filter(c => c.cached).length
    const avgDuration = calls.length > 0
      ? calls.reduce((sum, c) => sum + (c.duration || 0), 0) / calls.length
      : 0

    const byMethod = calls.reduce((acc, c) => {
      acc[c.method] = (acc[c.method] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return { total, errors, cached, avgDuration, byMethod }
  }, [calls])

  return (
    <div className="flex flex-wrap items-center gap-4 border-b bg-muted/30 px-4 py-2 text-xs">
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">Total:</span>
        <span className="font-semibold">{stats.total}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">Errors:</span>
        <span className={clsx('font-semibold', stats.errors > 0 ? 'text-red-500' : '')}>
          {stats.errors}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">Cached:</span>
        <span className="font-semibold">{stats.cached}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">Avg:</span>
        <span className={clsx(
          'font-semibold',
          stats.avgDuration > 500 ? 'text-yellow-500' : stats.avgDuration > 1000 ? 'text-red-500' : ''
        )}>
          {stats.avgDuration.toFixed(0)}ms
        </span>
      </div>
      <div className="flex items-center gap-2">
        {Object.entries(stats.byMethod).map(([method, count]) => (
          <span key={method} className="rounded bg-background px-2 py-0.5">
            {method}: {count}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Main API profiler component
 */
export function ApiProfiler() {
  const apiCalls = useDevtoolsStore((state) => state.apiCalls)
  const clearApiCalls = useDevtoolsStore((state) => state.clearApiCalls)
  const [filter, setFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set())

  // Filter calls
  const filteredCalls = useMemo(() => {
    return apiCalls.filter(call => {
      // Text filter
      if (filter) {
        const searchLower = filter.toLowerCase()
        const matchesUrl = call.url.toLowerCase().includes(searchLower)
        const matchesRequest = call.request ? JSON.stringify(call.request).toLowerCase().includes(searchLower) : false
        const matchesResponse = call.response ? JSON.stringify(call.response).toLowerCase().includes(searchLower) : false

        if (!matchesUrl && !matchesRequest && !matchesResponse) {
          return false
        }
      }

      // Method filter
      if (methodFilter !== 'all' && call.method.toLowerCase() !== methodFilter) {
        return false
      }

      // Status filter
      if (statusFilter === 'error' && !call.error) {
        return false
      }
      if (statusFilter === 'success' && (call.error || (call.status && call.status >= 400))) {
        return false
      }

      return true
    })
  }, [apiCalls, filter, methodFilter, statusFilter])

  const toggleExpand = useCallback((id: string) => {
    setExpandedCalls(prev => {
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
    setExpandedCalls(new Set(filteredCalls.map(c => c.id)))
  }, [filteredCalls])

  const collapseAll = useCallback(() => {
    setExpandedCalls(new Set())
  }, [])

  const exportCalls = useCallback(() => {
    const data = JSON.stringify(filteredCalls, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `api-calls-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredCalls])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">API Profiler</h2>
          <p className="text-muted-foreground text-xs">
            {filteredCalls.length} call{filteredCalls.length !== 1 ? 's' : ''} / {apiCalls.length} total
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
            onClick={exportCalls}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearApiCalls}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Stats summary */}
      <StatsSummary calls={apiCalls} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="text-muted-foreground absolute left-2 top-2 h-4 w-4" />
          <Input
            placeholder="Search URL, request, or response..."
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
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="h-8 rounded border bg-background px-2 text-xs"
        >
          <option value="all">All Methods</option>
          <option value="get">GET</option>
          <option value="post">POST</option>
          <option value="put">PUT</option>
          <option value="delete">DELETE</option>
          <option value="patch">PATCH</option>
          <option value="ipc">IPC</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded border bg-background px-2 text-xs"
        >
          <option value="all">All Status</option>
          <option value="success">Success (2xx/3xx)</option>
          <option value="error">Errors (4xx/5xx)</option>
        </select>
      </div>

      {/* Call list */}
      <div className="flex-1 overflow-auto">
        {filteredCalls.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">
              {apiCalls.length === 0 ? 'No API calls recorded yet' : 'No calls match the current filters'}
            </p>
          </div>
        ) : (
          <div>
            {filteredCalls.map((call) => (
              <CallDetail
                key={call.id}
                call={call}
                expanded={expandedCalls.has(call.id)}
                onToggle={() => toggleExpand(call.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
