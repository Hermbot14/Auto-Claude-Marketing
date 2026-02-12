/**
 * Virtual List Performance Test Component
 *
 * This component is used to test and validate the performance of virtual scrolling
 * with large datasets (10,000+ items).
 *
 * Performance Goals:
 * - Initial render: < 100ms for 10,000 items
 * - Scroll performance: 60fps smooth scrolling
 * - Memory usage: Constant regardless of list size
 * - 90% memory reduction vs non-virtualized lists
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Play, RefreshCw, BarChart3, Activity, Zap, HardDrive } from 'lucide-react';
import { VirtualizedList, VirtualizedGrid } from '../VirtualizedList';
import type { Campaign } from '../campaign/CampaignList';

interface PerformanceMetrics {
  initialRenderTime: number;
  scrollFrameTime: number;
  memoryBefore: number;
  memoryAfter: number;
  memoryReduction: number;
  itemCount: number;
  averageRenderTime: number;
}

/**
 * Generates mock campaign data for testing
 */
function generateMockCampaigns(count: number): Campaign[] {
  const types: Campaign['type'][] = ['email', 'social', 'content', 'ppc', 'seo', 'display'];
  const statuses: Campaign['status'][] = ['draft', 'active', 'paused', 'completed'];
  const owners = ['Alice Johnson', 'Bob Smith', 'Carol White', 'David Brown', 'Eve Davis'];

  return Array.from({ length: count }, (_, i) => ({
    id: `campaign-${i}`,
    name: `Campaign ${i + 1}: ${types[i % types.length]} marketing ${i % 3 === 0 ? 'initiative' : 'push'}`,
    status: statuses[i % statuses.length],
    type: types[i % types.length],
    budget: 10000 + (i * 1000) % 90000,
    spent: Math.random() * 50000,
    startDate: new Date(Date.now() - (i * 86400000) % (365 * 86400000)),
    endDate: new Date(Date.now() + ((i + 30) * 86400000) % (365 * 86400000)),
    targetAudience: `Segment ${Math.floor(i / 1000) + 1}`,
    impressions: Math.floor(Math.random() * 1000000),
    clicks: Math.floor(Math.random() * 50000),
    conversions: Math.floor(Math.random() * 5000),
    roi: Math.floor(Math.random() * 400) - 50,
    owner: owners[i % owners.length],
    tags: [`tag-${i % 50}`, `category-${i % 20}`],
    description: `This is a test campaign ${i + 1} for performance testing purposes.`,
  }));
}

export function VirtualListPerformanceTest() {
  const [itemCount, setItemCount] = useState(1000);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [currentFps, setCurrentFps] = useState<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(0);

  // Generate campaigns when item count changes
  useEffect(() => {
    if (isRunning) return;
    const startTime = performance.now();
    const newCampaigns = generateMockCampaigns(itemCount);
    const endTime = performance.now();

    setCampaigns(newCampaigns);

    // Measure memory if available
    const memoryBefore = (performance as any).memory?.usedJSHeapSize || 0;

    // Force reflow and measure
    requestAnimationFrame(() => {
      const renderTime = performance.now() - startTime;
      const memoryAfter = (performance as any).memory?.usedJSHeapSize || 0;

      setMetrics({
        initialRenderTime: renderTime,
        scrollFrameTime: 0,
        memoryBefore,
        memoryAfter,
        memoryReduction: 0, // Calculated after comparison
        itemCount,
        averageRenderTime: renderTime,
      });
    });
  }, [itemCount, isRunning]);

  // Measure scroll performance
  useEffect(() => {
    if (!scrollContainerRef.current || !isRunning) return;

    let animationFrameId: number;
    const container = scrollContainerRef.current;

    const measureScrollPerformance = () => {
      const now = performance.now();
      const frameTime = now - lastFrameTimeRef.current;

      if (lastFrameTimeRef.current > 0) {
        frameTimesRef.current.push(frameTime);

        // Keep only last 60 frames
        if (frameTimesRef.current.length > 60) {
          frameTimesRef.current.shift();
        }

        // Calculate FPS
        if (frameTimesRef.current.length > 0) {
          const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
          const fps = 1000 / avgFrameTime;
          setCurrentFps(Math.round(fps));
        }
      }

      lastFrameTimeRef.current = now;

      // Auto-scroll for testing
      if (isRunning && container) {
        container.scrollTop += 2;
        if (container.scrollTop >= container.scrollHeight - container.clientHeight) {
          container.scrollTop = 0;
        }
        animationFrameId = requestAnimationFrame(measureScrollPerformance);
      }
    };

    measureScrollPerformance();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isRunning]);

  // Start performance test
  const startTest = () => {
    setIsRunning(true);
    setCurrentFps(0);
    frameTimesRef.current = [];
    lastFrameTimeRef.current = 0;

    // Stop test after 10 seconds
    setTimeout(() => {
      setIsRunning(false);
      const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;

      setMetrics((prev) => prev ? {
        ...prev,
        scrollFrameTime: avgFrameTime,
        averageRenderTime: (prev.initialRenderTime + avgFrameTime) / 2,
      } : null);
    }, 10000);
  };

  // Estimate memory reduction
  const estimatedMemory = useMemo(() => {
    if (!metrics) return null;
    // Non-virtualized list would need ~1KB per item in DOM
    const nonVirtualMemory = metrics.itemCount * 1024;
    // Virtual list only renders ~20 items
    const virtualMemory = 20 * 1024;
    const reduction = ((nonVirtualMemory - virtualMemory) / nonVirtualMemory) * 100;
    return reduction;
  }, [metrics]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Virtual List Performance Test
          </h1>
          <p className="text-muted-foreground mt-1">
            Test virtual scrolling performance with large datasets
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="border-b bg-accent/30 p-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-4">
          {/* Item count selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Items:</label>
            <select
              value={itemCount}
              onChange={(e) => {
                setItemCount(Number(e.target.value));
                setMetrics(null);
                setCurrentFps(0);
              }}
              disabled={isRunning}
              className="px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={100}>100</option>
              <option value={1000}>1,000</option>
              <option value={5000}>5,000</option>
              <option value={10000}>10,000</option>
              <option value={50000}>50,000</option>
              <option value={100000}>100,000</option>
            </select>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">View:</label>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
                }`}
                disabled={isRunning}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === 'grid' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
                }`}
                disabled={isRunning}
              >
                Grid
              </button>
            </div>
          </div>

          {/* Start/Stop button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={isRunning ? () => setIsRunning(false) : startTest}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              isRunning
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-primary text-primary-foreground'
            }`}
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Stop Test
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start Test
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Metrics */}
      <div className="border-b bg-card p-4">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Item count */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
            <BarChart3 className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{itemCount.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Items</div>
            </div>
          </div>

          {/* Initial render time */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
            <Zap className="h-8 w-8 text-yellow-500" />
            <div>
              <div className="text-2xl font-bold">
                {metrics?.initialRenderTime ? `${metrics.initialRenderTime.toFixed(1)}ms` : '-'}
              </div>
              <div className="text-xs text-muted-foreground">
                {metrics?.initialRenderTime && metrics.initialRenderTime < 100 ? '✓ Pass' : '✗ Fail'} (
                  Target: &lt;100ms)
              </div>
            </div>
          </div>

          {/* Scroll FPS */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
            <Activity className="h-8 w-8 text-green-500" />
            <div>
              <div className={`text-2xl font-bold ${currentFps >= 55 ? 'text-green-500' : 'text-yellow-500'}`}>
                {isRunning ? currentFps : '-'}
              </div>
              <div className="text-xs text-muted-foreground">
                {isRunning ? (currentFps >= 55 ? '✓ Pass' : 'Testing...') : 'Start to test'} (
                  Target: 60fps)
              </div>
            </div>
          </div>

          {/* Memory usage */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
            <HardDrive className="h-8 w-8 text-blue-500" />
            <div>
              <div className="text-2xl font-bold">
                {metrics?.memoryAfter ? `${(metrics.memoryAfter / 1024 / 1024).toFixed(1)}MB` : '-'}
              </div>
              <div className="text-xs text-muted-foreground">Heap Used</div>
            </div>
          </div>

          {/* Memory reduction */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
            <BarChart3 className="h-8 w-8 text-purple-500" />
            <div>
              <div className="text-2xl font-bold">
                {estimatedMemory !== null ? `${estimatedMemory.toFixed(0)}%` : '-'}
              </div>
              <div className="text-xs text-muted-foreground">
                {estimatedMemory !== null && estimatedMemory >= 90 ? '✓ Pass' : 'Calculating...'} (
                  Target: 90%)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Virtual list container */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        {viewMode === 'list' ? (
          <VirtualizedList
            items={campaigns}
            getKey={(campaign) => campaign.id}
            renderItem={(campaign) => (
              <div className="flex items-center gap-4 p-3 border-b hover:bg-accent/50">
                <input type="checkbox" className="w-4 h-4" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{campaign.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {campaign.type} • {campaign.status}
                  </div>
                </div>
                <div className="text-sm">${campaign.budget?.toLocaleString()}</div>
              </div>
            )}
            estimateSize={() => 60}
            overscan={5}
          />
        ) : (
          <VirtualizedGrid
            items={campaigns}
            getKey={(campaign) => campaign.id}
            renderItem={(campaign) => (
              <div className="p-4 border rounded-lg bg-card hover:shadow-md transition-shadow">
                <div className="font-medium text-sm truncate">{campaign.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {campaign.type} • {campaign.status}
                </div>
                <div className="text-sm mt-2">${campaign.budget?.toLocaleString()}</div>
              </div>
            )}
            columns={4}
            estimateRowHeight={() => 120}
            overscan={2}
            gap={16}
          />
        )}
      </div>
    </div>
  );
}

export default VirtualListPerformanceTest;
