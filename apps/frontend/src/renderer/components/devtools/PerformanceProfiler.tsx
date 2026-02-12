/**
 * PerformanceProfiler - Performance Metrics and Monitoring
 *
 * Tracks and displays performance metrics:
 * - FPS counter
 * - Component render times
 * - Memory usage graph
 * - Resource loading metrics
 * - Performance bottleneck identification
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Activity, Clock, Zap, Cpu, MemoryStick, BarChart3, RefreshCw } from 'lucide-react'
import { Button } from '../ui/button'
import { useDevtoolsStore } from '../../stores/devtools-store'
import type { PerformanceMetric } from './types'
import { clsx } from 'clsx'

/**
 * FPS counter component
 */
function FpsCounter() {
  const [fps, setFps] = useState(0)
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(performance.now())
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    const updateFPS = () => {
      frameCountRef.current++
      const currentTime = performance.now()
      const elapsed = currentTime - lastTimeRef.current

      if (elapsed >= 1000) {
        const currentFps = Math.round((frameCountRef.current / elapsed) * 1000)
        setFps(currentFps)

        // Add to devtools metrics
        useDevtoolsStore.getState().addPerformanceMetric({
          id: `fps-${Date.now()}`,
          timestamp: Date.now(),
          type: 'render',
          label: 'FPS',
          duration: elapsed / frameCountRef.current,
          metadata: { fps: currentFps }
        })

        frameCountRef.current = 0
        lastTimeRef.current = currentTime
      }

      animationFrameRef.current = requestAnimationFrame(updateFPS)
    }

    animationFrameRef.current = requestAnimationFrame(updateFPS)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const fpsColor = useMemo(() => {
    if (fps >= 55) return 'text-green-500'
    if (fps >= 30) return 'text-yellow-500'
    return 'text-red-500'
  }, [fps])

  return (
    <div className="flex items-center gap-2">
      <Activity className={clsx('h-4 w-4', fpsColor)} />
      <span className={clsx('text-2xl font-bold', fpsColor)}>{fps}</span>
      <span className="text-muted-foreground text-sm">FPS</span>
    </div>
  )
}

/**
 * Performance metric card
 */
interface MetricCardProps {
  /** Icon */
  icon: React.ReactNode
  /** Label */
  label: string
  /** Value to display */
  value: string | number
  /** Unit */
  unit?: string
  /** Color indicator */
  color?: 'green' | 'yellow' | 'red'
  /** Additional info */
  info?: string
}

function MetricCard({ icon, label, value, unit, color, info }: MetricCardProps) {
  const colorClass = useMemo(() => {
    switch (color) {
      case 'green': return 'border-green-500/30 bg-green-500/10'
      case 'yellow': return 'border-yellow-500/30 bg-yellow-500/10'
      case 'red': return 'border-red-500/30 bg-red-500/10'
      default: return 'border-border bg-muted/20'
    }
  }, [color])

  return (
    <div className={clsx('rounded-lg border p-4', colorClass)}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2">
        <span className="text-2xl font-bold">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && (
          <span className="text-muted-foreground text-sm">{unit}</span>
        )}
      </div>
      {info && (
        <p className="text-muted-foreground mt-2 text-xs">{info}</p>
      )}
    </div>
  )
}

/**
 * Mini sparkline chart
 */
interface SparklineProps {
  /** Data points */
  data: number[]
  /** Width in pixels */
  width?: number
  /** Height in pixels */
  height?: number
  /** Line color */
  color?: string
}

function Sparkline({ data, width = 100, height = 30, color = '#3b82f6' }: SparklineProps) {
  const max = useMemo(() => Math.max(...data, 1), [data])
  const min = useMemo(() => Math.min(...data, 0), [data])

  const points = useMemo(() => {
    return data.map((value, idx) => {
      const x = (idx / (data.length - 1)) * width
      const normalizedValue = (value - min) / (max - min)
      const y = height - (normalizedValue * height)
      return `${x},${y}`
    }).join(' ')
  }, [data, width, height, max, min])

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/**
 * Main performance profiler component
 */
export function PerformanceProfiler() {
  const performanceMetrics = useDevtoolsStore((state) => state.performanceMetrics)
  const clearPerformanceMetrics = useDevtoolsStore((state) => state.clearPerformanceMetrics)
  const [autoMeasure, setAutoMeasure] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null)

  // Current memory usage
  const memoryInfo = useMemo(() => {
    if ('memory' in performance && (performance as Performance & { memory: any }).memory) {
      const mem = (performance as Performance & { memory: any }).memory
      return {
        usedJSHeapSize: mem.usedJSHeapSize,
        totalJSHeapSize: mem.totalJSHeapSize,
        jsHeapSizeLimit: mem.jsHeapSizeLimit,
        usagePercentage: (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100
      }
    }
    return null
  }, [])

  // Calculate metrics from history
  const stats = useMemo(() => {
    const renderMetrics = performanceMetrics.filter(m => m.type === 'render')
    const networkMetrics = performanceMetrics.filter(m => m.type === 'network')
    const memoryMetrics = performanceMetrics.filter(m => m.type === 'memory')

    const avgRenderTime = renderMetrics.length > 0
      ? renderMetrics.reduce((sum, m) => sum + m.duration, 0) / renderMetrics.length
      : 0

    const slowRenders = renderMetrics.filter(m => m.duration > 16).length

    const totalNetworkTime = networkMetrics.reduce((sum, m) => sum + m.duration, 0)

    return {
      totalMetrics: performanceMetrics.length,
      avgRenderTime,
      slowRenders,
      totalNetworkTime,
      networkCalls: networkMetrics.length,
      memorySnapshots: memoryMetrics.length
    }
  }, [performanceMetrics])

  // Recent render times for sparkline
  const recentRenderTimes = useMemo(() => {
    return performanceMetrics
      .filter(m => m.type === 'render')
      .slice(-30)
      .map(m => m.duration)
  }, [performanceMetrics])

  // Toggle auto-measurement
  useEffect(() => {
    if (!autoMeasure) return

    // Measure FPS continuously
    // Measure navigation timing
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming
          useDevtoolsStore.getState().addPerformanceMetric({
            id: `nav-${Date.now()}`,
            timestamp: Date.now(),
            type: 'network',
            label: 'Navigation',
            duration: navEntry.loadEventEnd - navEntry.fetchStart,
            metadata: {
              domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.fetchStart,
              firstPaint: navEntry.responseStart - navEntry.fetchStart
            }
          })
        }
      }
    })

    try {
      observer.observe({ entryTypes: ['navigation'] })
    } catch {
      // Navigation timing might not be supported
    }

    return () => {
      try {
        observer.disconnect()
      } catch {}
    }
  }, [autoMeasure])

  const handleRefresh = useCallback(() => {
    // Trigger memory measurement
    if (memoryInfo) {
      useDevtoolsStore.getState().addPerformanceMetric({
        id: `memory-${Date.now()}`,
        timestamp: Date.now(),
        type: 'memory',
        label: 'Memory Snapshot',
        duration: memoryInfo.usedJSHeapSize,
        metadata: memoryInfo
      })
    }
  }, [memoryInfo])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-sm font-semibold">Performance</h2>
            <p className="text-muted-foreground text-xs">
              {stats.totalMetrics} metrics recorded
            </p>
          </div>

          <FpsCounter />
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={autoMeasure}
              onChange={(e) => setAutoMeasure(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Auto-measure
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Snapshot
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearPerformanceMetrics}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={<Clock className="h-4 w-4" />}
            label="Avg Render Time"
            value={stats.avgRenderTime.toFixed(1)}
            unit="ms"
            color={stats.avgRenderTime > 16 ? 'red' : stats.avgRenderTime > 8 ? 'yellow' : 'green'}
          />

          <MetricCard
            icon={<Zap className="h-4 w-4" />}
            label="Slow Renders"
            value={stats.slowRenders}
            color={stats.slowRenders > 10 ? 'red' : stats.slowRenders > 5 ? 'yellow' : 'green'}
            info="> 16ms (below 60fps)"
          />

          <MetricCard
            icon={<Activity className="h-4 w-4" />}
            label="Network Time"
            value={(stats.totalNetworkTime / 1000).toFixed(1)}
            unit="s"
            info={`${stats.networkCalls} calls`}
          />

          <MetricCard
            icon={<Cpu className="h-4 w-4" />}
            label="Memory Snapshots"
            value={stats.memorySnapshots}
          />
        </div>

        {/* Memory info */}
        {memoryInfo && (
          <div className="mb-6 rounded-lg border bg-card p-4">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-sm">
              <MemoryStick className="h-4 w-4" />
              Memory Usage
            </h3>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Heap Used</span>
                  <span className="font-mono">
                    {(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={clsx(
                      'h-full transition-all',
                      memoryInfo.usagePercentage > 80 ? 'bg-red-500' :
                      memoryInfo.usagePercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    )}
                    style={{ width: `${memoryInfo.usagePercentage}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Total Heap:</span>
                  <p className="font-mono">
                    {(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Heap Limit:</span>
                  <p className="font-mono">
                    {(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Usage:</span>
                  <p className={clsx(
                    'font-mono font-bold',
                    memoryInfo.usagePercentage > 80 ? 'text-red-500' :
                    memoryInfo.usagePercentage > 60 ? 'text-yellow-500' : 'text-green-500'
                  )}>
                    {memoryInfo.usagePercentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Render time chart */}
        {recentRenderTimes.length > 0 && (
          <div className="mb-6 rounded-lg border bg-card p-4">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-sm">
              <BarChart3 className="h-4 w-4" />
              Render Time (Last 30)
            </h3>
            <div className="flex items-center gap-4">
              <Sparkline data={recentRenderTimes} width={400} height={60} />
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">Slow (&gt;16ms)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-muted-foreground">Medium (&gt;8ms)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Fast (&lt;8ms)</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Performance recommendations */}
        {stats.avgRenderTime > 16 && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <h4 className="mb-2 font-semibold text-sm text-red-500">
              Performance Issues Detected
            </h4>
            <ul className="list-inside list-disc space-y-1 text-sm">
              <li>Average render time exceeds 16ms (60fps threshold)</li>
              <li>Consider using React.memo() to prevent unnecessary re-renders</li>
              <li>Check for large state objects that trigger cascading updates</li>
              <li>Use React DevTools Profiler to identify slow components</li>
            </ul>
          </div>
        )}

        {memoryInfo && memoryInfo.usagePercentage > 80 && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
            <h4 className="mb-2 font-semibold text-sm text-yellow-600">
              High Memory Usage
            </h4>
            <ul className="list-inside list-disc space-y-1 text-sm">
              <li>Memory usage exceeds 80% of heap limit</li>
              <li>Consider implementing pagination or virtualization for large lists</li>
              <li>Clear unused state and cache data</li>
              <li>Check for memory leaks in event listeners</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
