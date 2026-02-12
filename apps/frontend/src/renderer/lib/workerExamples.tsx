/**
 * Worker Usage Examples
 *
 * Demonstrates how to use the Web Workers API in React components.
 * Includes examples for analytics, filtering, sorting, and data transformation.
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  calculateAnalytics,
  generateChartData,
  filterItems,
  sortItems,
  transformItems,
  exportData,
  useWorker
} from './workerApi';

import type {
  AnalyticsRequest,
  ChartDataRequest,
  FilterRequest,
  SortRequest,
  ExportRequest
} from '../workers/types';

// ============================================
// Example 1: Analytics Dashboard
// ============================================

/**
 * Example hook for analytics dashboard with worker support
 */
export function useAnalyticsDashboard() {
  const { t } = useTranslation(['common']);
  const { calculateAnalytics, isUsingWorkers, getFallbackMessage } = useWorker();

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [metrics, setMetrics] = useState<{
    totalCampaigns: number;
    totalIdeas: number;
    completionRate: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Calculate analytics with progress tracking
  const runAnalytics = useCallback(async (request: AnalyticsRequest) => {
    setIsLoading(true);
    setError(null);
    setProgress(0);

    try {
      const result = await calculateAnalytics(request, {
        onProgress: (prog, message) => {
          setProgress(prog);
          console.log(`[Analytics] ${prog}%: ${message || ''}`);
        }
      });

      setMetrics({
        totalCampaigns: result.totalCampaigns,
        totalIdeas: result.totalIdeas,
        completionRate: result.campaignCompletionRate
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  }, [calculateAnalytics]);

  // Show warning if using fallback
  useEffect(() => {
    if (!isUsingWorkers()) {
      console.warn(getFallbackMessage());
    }
  }, [isUsingWorkers, getFallbackMessage]);

  return {
    isLoading,
    progress,
    metrics,
    error,
    runAnalytics,
    isUsingWorkers
  };
}

// ============================================
// Example 2: Filterable Data Table
// ============================================

/**
 * Example hook for data tables with worker-based filtering
 */
export function useFilterableData<T extends Record<string, unknown>>(
  initialData: T[]
) {
  const { filterItems, sortItems, isUsingWorkers } = useWorker();

  const [data, setData] = useState<T[]>(initialData);
  const [filteredData, setFilteredData] = useState<T[]>(initialData);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Apply filters with worker
  const applyFilters = useCallback(async (filters: FilterRequest<T>['filters']) => {
    setIsProcessing(true);
    setProgress(0);

    try {
      const result = await filterItems({
        items: data,
        filters
      }, {
        onProgress: setProgress
      });

      setFilteredData(result.items);
    } catch (err) {
      console.error('Filter failed:', err);
      setFilteredData(data); // Fallback to unfiltered
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [data, filterItems]);

  // Apply sort with worker
  const applySort = useCallback(async (sortBy: SortRequest<T>['sortBy'], order: SortRequest<T>['order']) => {
    setIsProcessing(true);
    setProgress(0);

    try {
      const result = await sortItems({
        items: filteredData,
        sortBy,
        order
      }, {
        onProgress: setProgress
      });

      setFilteredData(result.items);
    } catch (err) {
      console.error('Sort failed:', err);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [filteredData, sortItems]);

  return {
    data: filteredData,
    isProcessing,
    progress,
    applyFilters,
    applySort,
    setData,
    isUsingWorkers
  };
}

// ============================================
// Example 3: Data Export
// ============================================

/**
 * Example hook for exporting data with worker
 */
export function useDataExport<T extends Record<string, unknown>>() {
  const { exportData, isUsingWorkers } = useWorker();

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  // Export data function
  const exportItems = useCallback(async (items: T[], filename?: string) => {
    setIsExporting(true);
    setProgress(0);
    setExportUrl(null);

    try {
      const csvData = await exportData({
        items,
        format: 'csv',
        filename: filename || 'export.csv'
      }, {
        onProgress: (prog, message) => {
          setProgress(prog);
          console.log(`[Export] ${prog}%: ${message || ''}`);
        }
      });

      // Create download URL
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      setExportUrl(url);

      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'export.csv';
      a.click();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  }, [exportData]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
      }
    };
  }, [exportUrl]);

  return {
    isExporting,
    progress,
    exportItems,
    isUsingWorkers
  };
}

// ============================================
// Example 4: Chart Generation
// ============================================

/**
 * Example hook for generating chart data with worker
 */
export function useChartData() {
  const { generateChartData, isUsingWorkers } = useWorker();

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [chartData, setChartData] = useState<Array<{
    label: string;
    value: number;
  }>>([]);

  // Generate chart data
  const generate = useCallback(async (request: ChartDataRequest) => {
    setIsGenerating(true);
    setProgress(0);

    try {
      const data = await generateChartData(request, {
        onProgress: setProgress
      });

      setChartData(data);
    } catch (err) {
      console.error('Chart generation failed:', err);
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  }, [generateChartData]);

  return {
    isGenerating,
    progress,
    chartData,
    generate,
    isUsingWorkers
  };
}

// ============================================
// Example 5: Batch Operations
// ============================================

/**
 * Example hook for batch processing items
 */
export function useBatchProcessor<T, R>() {
  const { processBatch, isUsingWorkers } = useWorker();

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<R[]>([]);

  // Process items in batch
  const processItems = useCallback(async (
    items: T[],
    operation: (item: T) => R,
    operationName: string
  ) => {
    setIsProcessing(true);
    setProgress(0);
    setResults([]);

    try {
      const result = await processBatch({
        items,
        operation,
        operationName
      }, {
        onProgress: setProgress
      });

      setResults(result.items as R[]);
    } catch (err) {
      console.error(`${operationName} failed:`, err);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [processBatch]);

  return {
    isProcessing,
    progress,
    results,
    processItems,
    isUsingWorkers
  };
}

// ============================================
// Complete Component Example
// ============================================

/**
 * Example component showing all worker patterns
 */
export function WorkerExampleComponent() {
  const analytics = useAnalyticsDashboard();
  const { data, applyFilters, isProcessing, progress, isUsingWorkers: filterUsingWorkers } =
    useFilterableData([
      { id: '1', title: 'Campaign A', status: 'active', type: 'email' },
      { id: '2', title: 'Campaign B', status: 'completed', type: 'social' },
      { id: '3', title: 'Campaign C', status: 'draft', type: 'blog' }
    ]);
  const { exportItems, isExporting, progress: exportProgress, isUsingWorkers: exportUsingWorkers } =
    useDataExport();

  const { chartData, isGenerating, generate, isUsingWorkers: chartUsingWorkers } =
    useChartData();

  return (
    <div className="worker-examples p-6 space-y-6">
      {/* Worker Status Indicator */}
      <div className="worker-status mb-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Worker Status</h3>
        <div className="space-y-2">
          <p><strong>Analytics:</strong> {analytics.isUsingWorkers ? 'Using Workers' : 'Fallback Mode'}</p>
          <p><strong>Filtering:</strong> {filterUsingWorkers ? 'Using Workers' : 'Fallback Mode'}</p>
          <p><strong>Exporting:</strong> {exportUsingWorkers ? 'Using Workers' : 'Fallback Mode'}</p>
          <p><strong>Charts:</strong> {chartUsingWorkers ? 'Using Workers' : 'Fallback Mode'}</p>
        </div>
        {!analytics.isUsingWorkers && (
          <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900 rounded">
            ⚠️ Web Workers not supported. Some operations may be slower.
          </div>
        )}
      </div>

      {/* Analytics Example */}
      <div className="analytics-example p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Analytics Dashboard</h3>
        <button
          onClick={() => analytics.runAnalytics({
            campaigns: [],
            ideas: [],
            tasks: [],
            timeframe: 'month'
          })}
          disabled={analytics.isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {analytics.isLoading ? `Calculating... ${analytics.progress}%` : 'Calculate Analytics'}
        </button>

        {analytics.metrics && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
              <div className="text-2xl font-bold">{analytics.metrics.totalCampaigns}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Campaigns</div>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
              <div className="text-2xl font-bold">{analytics.metrics.totalIdeas}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Ideas</div>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
              <div className="text-2xl font-bold">{analytics.metrics.completionRate}%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Completion Rate</div>
            </div>
          </div>
        )}
      </div>

      {/* Filter/Sort Example */}
      <div className="filter-example p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Filter & Sort</h3>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => applyFilters([{ field: 'status', operator: 'eq', value: 'active' }])}
            disabled={isProcessing}
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Show Active
          </button>
          <button
            onClick={() => applyFilters([{ field: 'status', operator: 'eq', value: 'completed' }])}
            disabled={isProcessing}
            className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            Show Completed
          </button>
          <button
            onClick={() => applyFilters([])}
            disabled={isProcessing}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Show All
          </button>
        </div>
        {isProcessing && (
          <div className="mb-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Processing... {progress}%</p>
        </div>}
        <div className="space-y-2">
          {data.map((item) => (
            <div key={item.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="font-medium">{item.title}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Status: {item.status} | Type: {item.type}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export Example */}
      <div className="export-example p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Export Data</h3>
        <button
          onClick={() => exportItems(data, 'campaigns.csv')}
          disabled={isExporting}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
        >
          {isExporting ? `Exporting... ${exportProgress}%` : 'Export as CSV'}
        </button>
      </div>

      {/* Chart Example */}
      <div className="chart-example p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Generate Chart Data</h3>
        <button
          onClick={() => generate({
            type: 'bar',
            dataType: 'campaigns',
            groupBy: 'status',
            data: { campaigns: [], ideas: [], tasks: [] }
          })}
          disabled={isGenerating}
          className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Generate Bar Chart'}
        </button>
        {chartData.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded">
            <h4 className="font-medium mb-2">Chart Data Points:</h4>
            <ul className="space-y-1">
              {chartData.map((point, index) => (
                <li key={index} className="text-sm">
                  <span className="font-medium">{point.label}:</span> {point.value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// Export for use in components
export default WorkerExampleComponent;
