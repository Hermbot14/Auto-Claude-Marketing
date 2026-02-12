/**
 * DevtoolsPanel - Main Developer Tools Panel
 *
 * Provides development-only tools for:
 * - State inspection
 * - API profiling
 * - Component tree visualization
 * - Performance profiling
 * - Event logging
 * - Memory tracking
 *
 * Only available in development mode.
 * Toggle with Cmd/Ctrl+Shift+D
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Minimize2, Maximize2, RefreshCw, Settings, Download, Upload } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Button } from '../ui/button'
import { StateInspector } from './StateInspector'
import { ApiProfiler } from './ApiProfiler'
import { ComponentTree } from './ComponentTree'
import { PerformanceProfiler } from './PerformanceProfiler'
import { EventLogger } from './EventLogger'
import { MemoryProfiler } from './MemoryProfiler'
import { useDevtoolsStore } from '../../stores/devtools-store'
import type { DevtoolsTab } from './types'

import './styles/devtools.css'

interface DevtoolsPanelProps {
  /** Whether the panel is open */
  isOpen: boolean
  /** Callback when panel should close */
  onClose: () => void
}

/**
 * Main developer tools panel component
 * Renders a floating panel with various debugging tools
 */
export function DevtoolsPanel({ isOpen, onClose }: DevtoolsPanelProps) {
  const [activeTab, setActiveTab] = useState<DevtoolsTab>('state')
  const [isMaximized, setIsMaximized] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Store state for persistence
  const preferences = useDevtoolsStore((state) => state.preferences)
  const updatePreferences = useDevtoolsStore((state) => state.updatePreferences)

  // Load saved preferences on mount
  useEffect(() => {
    if (preferences.position) {
      setPosition(preferences.position)
    }
    if (preferences.size) {
      setSize(preferences.size)
    }
    if (preferences.activeTab) {
      setActiveTab(preferences.activeTab)
    }
    if (preferences.isMaximized !== undefined) {
      setIsMaximized(preferences.isMaximized)
    }
  }, [])

  // Save preferences on change
  useEffect(() => {
    updatePreferences({
      position: position,
      size: size,
      activeTab: activeTab,
      isMaximized
    })
  }, [position, size, activeTab, isMaximized, updatePreferences])

  // Keyboard shortcut to close
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === 'Escape') {
        onClose()
      }
      // Cmd/Ctrl+Shift+D to toggle
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Drag handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag from header
    if ((e.target as HTMLElement).closest('.devtools-header')) {
      setIsDragging(true)
      dragStartRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      }
    }
  }, [position])

  // Resize handling
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizing(true)
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    }
  }, [size])

  // Mouse move for drag/resize
  useEffect(() => {
    if (!isDragging && !isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragStartRef.current) {
        const newX = e.clientX - dragStartRef.current.x
        const newY = e.clientY - dragStartRef.current.y
        setPosition({
          x: Math.max(0, newX),
          y: Math.max(0, newY)
        })
      }
      if (isResizing && resizeStartRef.current) {
        const newWidth = Math.max(400, resizeStartRef.current.width + (e.clientX - resizeStartRef.current.x))
        const newHeight = Math.max(300, resizeStartRef.current.height + (e.clientY - resizeStartRef.current.y))
        setSize({
          width: newWidth,
          height: newHeight
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
      dragStartRef.current = null
      resizeStartRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing])

  // Export state
  const handleExport = useCallback(() => {
    const state = useDevtoolsStore.getState()
    const data = {
      timestamp: new Date().toISOString(),
      state: state.inspectedState,
      events: state.loggedEvents,
      apiCalls: state.apiCalls,
      performanceMetrics: state.performanceMetrics
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `devtools-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // Import state
  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const data = JSON.parse(text)

        const store = useDevtoolsStore.getState()
        if (data.state) store.setInspectedState(data.state)
        if (data.events) store.setLoggedEvents(data.events)
        if (data.apiCalls) store.setApiCalls(data.apiCalls)
        if (data.performanceMetrics) store.setPerformanceMetrics(data.performanceMetrics)

        console.log('[Devtools] Imported data:', data)
      } catch (err) {
        console.error('[Devtools] Failed to import:', err)
      }
    }
    input.click()
  }, [])

  if (!isOpen) return null

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    left: isMaximized ? 0 : `${position.x}px`,
    top: isMaximized ? 0 : `${position.y}px`,
    width: isMaximized ? '100vw' : `${size.width}px`,
    height: isMaximized ? '100vh' : `${size.height}px`,
    zIndex: 9999,
    transition: isDragging || isResizing ? 'none' : 'all 0.2s ease'
  }

  return (
    <div
      ref={panelRef}
      className="devtools-panel"
      style={panelStyle}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="devtools-header flex items-center justify-between border-b bg-muted/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Developer Tools</h2>
          <span className="text-xs text-muted-foreground">
            {import.meta.env.MODE === 'development' ? 'Dev Mode' : 'Production'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleExport}
            title="Export data"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleImport}
            title="Import data"
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            title="Close (Escape)"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="devtools-content flex h-[calc(100%-41px)]">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DevtoolsTab)} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-6 border-b">
            <TabsTrigger value="state" className="text-xs">
              State
            </TabsTrigger>
            <TabsTrigger value="api" className="text-xs">
              API
            </TabsTrigger>
            <TabsTrigger value="components" className="text-xs">
              Components
            </TabsTrigger>
            <TabsTrigger value="performance" className="text-xs">
              Performance
            </TabsTrigger>
            <TabsTrigger value="events" className="text-xs">
              Events
            </TabsTrigger>
            <TabsTrigger value="memory" className="text-xs">
              Memory
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto">
            <TabsContent value="state" className="m-0 h-full p-0">
              <StateInspector />
            </TabsContent>
            <TabsContent value="api" className="m-0 h-full p-0">
              <ApiProfiler />
            </TabsContent>
            <TabsContent value="components" className="m-0 h-full p-0">
              <ComponentTree />
            </TabsContent>
            <TabsContent value="performance" className="m-0 h-full p-0">
              <PerformanceProfiler />
            </TabsContent>
            <TabsContent value="events" className="m-0 h-full p-0">
              <EventLogger />
            </TabsContent>
            <TabsContent value="memory" className="m-0 h-full p-0">
              <MemoryProfiler />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Resize handle */}
      {!isMaximized && (
        <div
          className="devtools-resize-handle absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
          onMouseDown={handleResizeStart}
        >
          <div className="absolute bottom-0 right-0 h-2 w-2 border-r-2 border-b-2 border-muted-foreground/30" />
        </div>
      )}
    </div>
  )
}

/**
 * Hook to use devtools panel
 * Manages open state and keyboard shortcut
 */
export function useDevtoolsPanel() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Only enable in development
    if (import.meta.env.MODE !== 'development') return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+Shift+D to toggle
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev)
  }
}
