/**
 * MemoryProfiler - Memory Usage Tracking
 *
 * Monitors and visualizes memory usage:
 * - JS heap size tracking
 * - Memory growth detection
 * - Memory leak identification
 * - GC event tracking
 * - Historical memory snapshots
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, Activity, Download, Trash2, Play, Pause } from 'lucide-react'
import { Button } from '../ui/button'
import { useDevtoolsStore } from '../../stores/devtools-store'
import type { MemorySnapshot } from './types'
import { clsx } from 'clsx'

/**
 * Memory info from Performance API
 */
interface MemoryInfo {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  usagePercentage: number
  timestamp: number
}

/**
 * Get current memory info
 */
function getMemoryInfo(): MemoryInfo | null {
  if ('memory' in performance && (performance as Performance & { memory: any }).memory) {
    const mem = (performance as Performance & { memory: any }).memory
    return {
      usedJSHeapSize: mem.usedJSHeapSize,
      totalJSHeapSize: mem.totalJSHeapSize,
      jsHeapSizeLimit: mem.jsHeapSizeLimit,
      usagePercentage: (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100,
      timestamp: Date.now()
    }
  }
  return null
}

/**
 * Mini chart component
 */
interface MemoryChartProps {
  /** Data points */
  data: { value: number; timestamp: number }[]
  /** Height in pixels */
  height?: number
  /** Width in pixels */
  width?: number
  /** Max value for scaling */
  maxValue?: number
}

function MemoryChart({ data, height = 100, width = 400, maxValue }: MemoryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const max = maxValue || Math.max(...data.map(d => d.value), 1)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(dpr, dpr)

    if (data.length < 2) return

    // Draw line
    ctx.beginPath()
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    data.forEach((point, idx) => {
      const x = (idx / (data.length - 1)) * width
      const y = height - (point.value / max) * height

      if (idx === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })

    ctx.stroke()

    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)')
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)')

    ctx.lineTo(width, height)
    ctx.lineTo(0, height)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // Draw warning threshold line at 80%
    const warningY = height * 0.2
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'
    ctx.setLineDash([5, 5])
    ctx.moveTo(0, warningY)
    ctx.lineTo(width, warningY)
    ctx.stroke()
    ctx.setLineDash([])

  }, [data, height, width, max])

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: `${height}px` }}
      />
    </div>
  )
}

/**
 * Memory stat card
 */
interface MemoryStatProps {
  /** Label */
  label: string
  /** Value in bytes */
  value: number
  /** Max value in bytes */
  max: number
  /** Format as MB */
  formatAsMB?: boolean
  /** Color indicator */
  color?: 'green' | 'yellow' | 'red'
}

function MemoryStat({ label, value, max, formatAsMB = true, color }: MemoryStatProps) {
  const percentage = (value / max) * 100

  const colorClass = useMemo(() => {
    if (color) {
      switch (color) {
        case 'green': return 'text-green-500'
        case 'yellow': return 'text-yellow-500'
        case 'red': return 'text-red-500'
      }
    }
    if (percentage > 80) return 'text-red-500'
    if (percentage > 60) return 'text-yellow-500'
    return 'text-green-500'
  }, [percentage, color])

  const barColor = useMemo(() => {
    if (color) return color
    if (percentage > 80) return 'red'
    if (percentage > 60) return 'yellow'
    return 'green'
  }, [percentage, color])

  const formatValue = (val: number) => {
    return formatAsMB
      ? `${(val / 1024 / 1024).toFixed(2)} MB`
      : `${(val / 1024).toFixed(2)} KB`
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={clsx('font-mono font-semibold', colorClass)}>
          {formatValue(value)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={clsx('h-full transition-all', {
            'bg-green-500': barColor === 'green',
            'bg-yellow-500': barColor === 'yellow',
            'bg-red-500': barColor === 'red'
          })}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="text-muted-foreground mt-1 text-xs">
        {formatValue(max)} total ({percentage.toFixed(1)}%)
      </div>
    </div>
  )
}

/**
 * Main memory profiler component
 */
export function MemoryProfiler() {
  const memorySnapshots = useDevtoolsStore((state) => state.memorySnapshots)
  const clearMemorySnapshots = useDevtoolsStore((state) => state.clearMemorySnapshots)
  const addMemorySnapshot = useDevtoolsStore((state) => state.addMemorySnapshot)

  const [isRecording, setIsRecording] = useState(false)
  const [recordingInterval, setRecordingInterval] = useState(1000)
  const [maxSnapshots, setMaxSnapshots] = useState(100)

  const currentMemory = useMemo(() => getMemoryInfo(), [])

  // Calculate memory stats
  const stats = useMemo(() => {
    if (memorySnapshots.length === 0) {
      return null
    }

    const first = memorySnapshots[0]
    const last = memorySnapshots[memorySnapshots.length - 1]

    const growth = last.usedJSHeapSize ? (first?.usedJSHeapSize || 0) - (first?.usedJSHeapSize || 0) : 0
    const growthPercent = first?.usedJSHeapSize
      ? (growth / first.usedJSHeapSize) * 100
      : 0

    const avgUsage = memorySnapshots.reduce((sum, s) =>
      sum + (s.usedJSHeapSize || 0), 0) / memorySnapshots.length

    const peakUsage = Math.max(...memorySnapshots.map(s => s.usedJSHeapSize || 0))

    return {
      totalSnapshots: memorySnapshots.length,
      growth,
      growthPercent: growthPercent,
      avgUsage,
      peakUsage,
      leakDetected: growthPercent > 50 && memorySnapshots.length > 10
    }
  }, [memorySnapshots])

  // Chart data (last 50 snapshots)
  const chartData = useMemo(() => {
    return memorySnapshots.slice(-50).map(s => ({
      value: s.usedJSHeapSize || 0,
      timestamp: s.timestamp
    }))
  }, [memorySnapshots])

  // Recording logic
  useEffect(() => {
    if (!isRecording) return

    const interval = setInterval(() => {
      const memInfo = getMemoryInfo()
      if (memInfo) {
        addMemorySnapshot(memInfo)

        // Auto-limit snapshots
        const currentSnapshots = useDevtoolsStore.getState().memorySnapshots
        if (currentSnapshots.length >= maxSnapshots) {
          setIsRecording(false)
        }
      }
    }, recordingInterval)

    return () => clearInterval(interval)
  }, [isRecording, recordingInterval, maxSnapshots, addMemorySnapshot])

  // Take manual snapshot
  const takeSnapshot = useCallback(() => {
    const memInfo = getMemoryInfo()
    if (memInfo) {
      addMemorySnapshot(memInfo)
    }
  }, [addMemorySnapshot])

  const exportSnapshots = useCallback(() => {
    const data = JSON.stringify(memorySnapshots, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `memory-snapshots-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [memorySnapshots])

  if (!currentMemory) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Activity className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">
            Memory profiling is not available in this browser.
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            The Performance API with memory support is required.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Memory Profiler</h2>
          <p className="text-muted-foreground text-xs">
            {memorySnapshots.length} snapshot{memorySnapshots.length !== 1 ? 's' : ''} recorded
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={recordingInterval.toString()}
            onChange={(e) => setRecordingInterval(Number(e.target.value))}
            className="h-8 rounded border bg-background px-2 text-xs"
            disabled={isRecording}
          >
            <option value="500">500ms</option>
            <option value="1000">1s</option>
            <option value="2000">2s</option>
            <option value="5000">5s</option>
          </select>

          <Button
            variant={isRecording ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => setIsRecording(!isRecording)}
          >
            {isRecording ? (
              <>
                <Pause className="mr-1 h-3.5 w-3.5" />
                Stop
              </>
            ) : (
              <>
                <Play className="mr-1 h-3.5 w-3.5" />
                Record
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={takeSnapshot}
            disabled={isRecording}
          >
            Snapshot
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportSnapshots}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Export
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={clearMemorySnapshots}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Current memory */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          {currentMemory && (
            <>
              <MemoryStat
                label="Heap Used"
                value={currentMemory.usedJSHeapSize}
                max={currentMemory.jsHeapSizeLimit}
              />
              <MemoryStat
                label="Heap Total"
                value={currentMemory.totalJSHeapSize}
                max={currentMemory.jsHeapSizeLimit}
              />
              <MemoryStat
                label="Heap Limit"
                value={currentMemory.jsHeapSizeLimit}
                max={currentMemory.jsHeapSizeLimit}
                color="green"
              />
            </>
          )}
        </div>

        {/* Memory chart */}
        {chartData.length > 1 && (
          <div className="mb-6 rounded-lg border bg-card p-4">
            <h3 className="mb-4 font-semibold text-sm">Memory Usage Over Time</h3>
            <MemoryChart data={chartData} height={150} />
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-muted-foreground text-xs">Growth</p>
              <p className={clsx(
                'text-xl font-bold',
                stats.growth > 0 ? 'text-red-500' : stats.growth < 0 ? 'text-green-500' : 'text-yellow-500'
              )}>
                {stats.growth > 0 ? '+' : ''}{(stats.growth / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <p className="text-muted-foreground text-xs">Growth %</p>
              <p className={clsx(
                'text-xl font-bold',
                stats.growthPercent > 20 ? 'text-red-500' : stats.growthPercent > 10 ? 'text-yellow-500' : 'text-green-500'
              )}>
                {stats.growthPercent.toFixed(1)}%
              </p>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <p className="text-muted-foreground text-xs">Avg Usage</p>
              <p className="text-xl font-bold">
                {(stats.avgUsage / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <p className="text-muted-foreground text-xs">Peak Usage</p>
              <p className="text-xl font-bold">
                {(stats.peakUsage / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
        )}

        {/* Leak detection */}
        {stats?.leakDetected && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <h4 className="mb-2 flex items-center gap-2 font-semibold text-sm text-red-500">
              <AlertTriangle className="h-4 w-4" />
              Potential Memory Leak Detected
            </h4>
            <ul className="list-inside list-disc space-y-1 text-sm">
              <li>Memory usage has grown by {stats.growthPercent.toFixed(1)}%</li>
              <li>Consider checking for:</li>
              <li className="ml-4">- Uncleared intervals/timeouts</li>
              <li className="ml-4">- Event listeners not removed</li>
              <li className="ml-4">- Large retained objects</li>
              <li className="ml-4">- Console log accumulation</li>
            </ul>
          </div>
        )}

        {/* Growth trend */}
        {stats && stats.growthPercent > 0 && (
          <div className={clsx(
            'rounded-lg border bg-card p-4',
            stats.growthPercent > 20 ? 'border-red-500/30' : 'border-yellow-500/30'
          )}>
            <div className="flex items-center gap-2">
              {stats.growthPercent > 20 ? (
                <TrendingUp className="h-5 w-5 text-red-500" />
              ) : (
                <TrendingUp className="h-5 w-5 text-yellow-500" />
              )}
              <div>
                <h4 className="font-semibold text-sm">Memory Increasing</h4>
                <p className="text-muted-foreground text-xs">
                  Heap usage has grown by {(stats.growth / 1024 / 1024).toFixed(2)} MB
                  ({stats.growthPercent.toFixed(1)}%) over the recording period
                </p>
              </div>
            </div>
          </div>
        )}

        {stats && stats.growthPercent < 0 && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-green-500" />
              <div>
                <h4 className="font-semibold text-sm">Memory Decreasing</h4>
                <p className="text-muted-foreground text-xs">
                  Heap usage has decreased by {Math.abs(stats.growth / 1024 / 1024).toFixed(2)} MB
                  ({Math.abs(stats.growthPercent).toFixed(1)}%) over the recording period
                </p>
                <p className="text-green-600 mt-1 text-xs">
                  This is normal - GC is working properly
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
