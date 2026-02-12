/**
 * Worker Fallback Implementation
 *
 * Provides synchronous alternatives to Web Workers for browsers
 * that don't support workers or when worker support is disabled.
 * Executes operations on the main thread with chunking to prevent UI blocking.
 */

import type {
  AnalyticsRequest,
  AnalyticsMetrics,
  ChartDataRequest,
  ChartDataPoint,
  FilterRequest,
  SortRequest,
  TransformRequest,
  BatchRequest,
  ExportRequest,
  DataProcessResult
} from '../workers/types';

// ============================================
// Fallback Configuration
// ============================================

const CHUNK_SIZE = 100; // Process items in chunks to allow UI updates
const MIN_DELAY = 0; // Minimum delay between chunks (0 = next tick)

/**
 * Async delay to allow UI updates
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process items in chunks to prevent blocking
 */
async function processInChunks<T, R>(
  items: T[],
  processor: (item: T, index: number) => R,
  onProgress?: (progress: number) => void
): Promise<R[]> {
  const results: R[] = [];
  const total = items.length;

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);

    for (let j = 0; j < chunk.length; j++) {
      results.push(processor(chunk[j], i + j));
    }

    // Report progress
    if (onProgress) {
      onProgress(Math.min(Math.round(((i + chunk.length) / total) * 100), 100));
    }

    // Yield to main thread
    if (i + chunk.length < items.length) {
      await delay(MIN_DELAY);
    }
  }

  return results;
}

// ============================================
// Analytics Fallback
// ============================================

/**
 * Calculate analytics on main thread (fallback)
 */
export async function calculateAnalyticsFallback(
  request: AnalyticsRequest,
  onProgress?: (progress: number) => void
): Promise<AnalyticsMetrics> {
  onProgress?.(0);

  const { campaigns, ideas, tasks } = request;

  // Process campaigns in chunks
  const processedCampaigns = await processInChunks(
    campaigns || [],
    (campaign) => campaign,
    onProgress
  );

  // Process ideas in chunks
  await processInChunks(ideas || [], (idea) => idea);

  // Process tasks in chunks
  await processInChunks(tasks || [], (task) => task);

  onProgress?.(50);

  // Calculate metrics (simplified version)
  const totalCampaigns = processedCampaigns.length;
  const campaignsByStatus = processedCampaigns.reduce((acc, c) => {
    const status = c.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const campaignsByType = processedCampaigns.reduce((acc, c) => {
    const type = c.contentType || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const completedCampaigns = processedCampaigns.filter((c) => c.status === 'completed' || c.status === 'done').length;
  const campaignCompletionRate = totalCampaigns > 0
    ? Math.round((completedCampaigns / totalCampaigns) * 100)
    : 0;

  const totalIdeas = (ideas || []).length;
  const ideasByStatus = (ideas || []).reduce((acc, i) => {
    const status = i.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const ideasByType = (ideas || []).reduce((acc, i) => {
    const type = i.type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalTasks = (tasks || []).length;
  const tasksByStatus = (tasks || []).reduce((acc, t) => {
    const status = t.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const completedTasks = (tasks || []).filter((t) => t.status === 'done').length;
  const taskCompletionRate = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  // Timeline data
  const timeline: Array<{ date: string; campaigns: number; ideas: number; tasks: number }> = [];

  // Engagement metrics
  const totalViews = processedCampaigns.reduce((sum, c) => sum + (c.views || 0), 0);
  const totalClicks = processedCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
  const totalConversions = processedCampaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);

  onProgress?.(100);

  return {
    totalCampaigns,
    campaignsByStatus,
    campaignsByType,
    campaignCompletionRate,
    totalIdeas,
    ideasByType,
    ideasByStatus,
    ideaConversionRate: 0,
    totalTasks,
    tasksByStatus,
    taskCompletionRate,
    averageTaskDuration: 0,
    totalViews,
    totalClicks,
    totalConversions,
    averageEngagementRate: totalViews > 0 ? Math.round((totalClicks / totalViews) * 100) : 0,
    timeline
  };
}

/**
 * Generate chart data on main thread (fallback)
 */
export async function generateChartDataFallback(
  request: ChartDataRequest,
  onProgress?: (progress: number) => void
): Promise<ChartDataPoint[]> {
  onProgress?.(0);

  const analytics = await calculateAnalyticsFallback(request.data, onProgress);

  onProgress?.(50);

  // Generate chart data based on type
  let dataPoints: ChartDataPoint[] = [];

  switch (request.dataType) {
    case 'campaigns':
      if (request.type === 'pie') {
        dataPoints = Object.entries(analytics.campaignsByType).map(([label, value]) => ({
          label,
          value,
          category: label
        }));
      } else if (request.type === 'bar') {
        dataPoints = Object.entries(analytics.campaignsByStatus).map(([label, value]) => ({
          label,
          value,
          category: label
        }));
      } else {
        dataPoints = analytics.timeline.map((point) => ({
          label: point.date,
          value: point.campaigns,
          date: point.date
        }));
      }
      break;

    case 'ideas':
      if (request.type === 'pie') {
        dataPoints = Object.entries(analytics.ideasByType).map(([label, value]) => ({
          label,
          value,
          category: label
        }));
      } else if (request.type === 'bar') {
        dataPoints = Object.entries(analytics.ideasByStatus).map(([label, value]) => ({
          label,
          value,
          category: label
        }));
      } else {
        dataPoints = analytics.timeline.map((point) => ({
          label: point.date,
          value: point.ideas,
          date: point.date
        }));
      }
      break;

    case 'tasks':
      if (request.type === 'pie' || request.type === 'bar') {
        dataPoints = Object.entries(analytics.tasksByStatus).map(([label, value]) => ({
          label,
          value,
          category: label
        }));
      } else {
        dataPoints = analytics.timeline.map((point) => ({
          label: point.date,
          value: point.tasks,
          date: point.date
        }));
      }
      break;

    case 'engagement':
      if (request.type === 'bar' || request.type === 'pie') {
        dataPoints = [
          { label: 'Views', value: analytics.totalViews, category: 'views' },
          { label: 'Clicks', value: analytics.totalClicks, category: 'clicks' },
          { label: 'Conversions', value: analytics.totalConversions, category: 'conversions' }
        ];
      } else {
        dataPoints = analytics.timeline.map((point) => ({
          label: point.date,
          value: 0,
          date: point.date
        }));
      }
      break;
  }

  onProgress?.(100);
  return dataPoints;
}

// ============================================
// Data Processing Fallback
// ============================================

/**
 * Filter items on main thread (fallback)
 */
export async function filterItemsFallback<T extends Record<string, unknown>>(
  request: FilterRequest<T>,
  onProgress?: (progress: number) => void
): Promise<DataProcessResult<T>> {
  const startTime = performance.now();
  const { items, filters, searchQuery, searchFields } = request;

  onProgress?.(0);

  // Process in chunks
  const filtered = await processInChunks(
    items,
    (item) => {
      // Apply filters
      if (filters && filters.length > 0) {
        const passesFilters = filters.every((filter) => {
          const value = item[filter.field as keyof T] as unknown;
          return matchesFilterCondition(value, filter);
        });
        if (!passesFilters) return null;
      }

      // Apply search query
      if (searchQuery) {
        const matchesSearch = searchFields && searchFields.length > 0
          ? searchFields.some((field) => {
              const value = item[field as keyof T] as unknown;
              return value !== null && value !== undefined &&
                String(value).toLowerCase().includes(searchQuery.toLowerCase());
            })
          : Object.values(item).some(
              (value) =>
                typeof value === 'string' &&
                value.toLowerCase().includes(searchQuery.toLowerCase())
            );
        if (!matchesSearch) return null;
      }

      return item;
    },
    onProgress
  );

  onProgress?.(100);

  const result = filtered.filter((item): item is T => item !== null);

  return {
    items: result,
    totalProcessed: items.length,
    filtered: items.length - result.length,
    duration: performance.now() - startTime
  };
}

/**
 * Check if value matches filter condition
 */
function matchesFilterCondition(value: unknown, filter: FilterRequest['filters'][0]): boolean {
  switch (filter.operator) {
    case 'eq':
      return value === filter.value;

    case 'ne':
      return value !== filter.value;

    case 'gt':
      return typeof value === 'number' && typeof filter.value === 'number' && value > filter.value;

    case 'gte':
      return typeof value === 'number' && typeof filter.value === 'number' && value >= filter.value;

    case 'lt':
      return typeof value === 'number' && typeof filter.value === 'number' && value < filter.value;

    case 'lte':
      return typeof value === 'number' && typeof filter.value === 'number' && value <= filter.value;

    case 'contains':
      return typeof value === 'string' &&
        typeof filter.value === 'string' &&
        value.toLowerCase().includes(filter.value.toLowerCase());

    case 'startsWith':
      return typeof value === 'string' &&
        typeof filter.value === 'string' &&
        value.toLowerCase().startsWith(filter.value.toLowerCase());

    default:
      return false;
  }
}

/**
 * Sort items on main thread (fallback)
 */
export async function sortItemsFallback<T extends Record<string, unknown>>(
  request: SortRequest<T>,
  onProgress?: (progress: number) => void
): Promise<DataProcessResult<T>> {
  const startTime = performance.now();
  const { items, sortBy, order, customComparator } = request;

  onProgress?.(0);

  // Sort all at once (sorting is generally fast)
  const sorted = [...items];
  sorted.sort((a, b) => {
    if (customComparator) {
      return customComparator(a, b);
    }

    const aVal = a[sortBy as keyof T] as unknown;
    const bVal = b[sortBy as keyof T] as unknown;

    // Handle null/undefined
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    // Numeric comparison
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return order === 'asc' ? aVal - bVal : bVal - aVal;
    }

    // Date comparison
    if (aVal instanceof Date && bVal instanceof Date) {
      const diff = aVal.getTime() - bVal.getTime();
      return order === 'asc' ? diff : -diff;
    }

    // String comparison
    const aStr = String(aVal ?? '').toLowerCase();
    const bStr = String(bVal ?? '').toLowerCase();
    const comparison = aStr.localeCompare(bStr);
    return order === 'asc' ? comparison : -comparison;
  });

  onProgress?.(100);

  return {
    items: sorted,
    totalProcessed: items.length,
    duration: performance.now() - startTime
  };
}

/**
 * Transform items on main thread (fallback)
 */
export async function transformItemsFallback<T, R>(
  request: TransformRequest<T, R>,
  onProgress?: (progress: number) => void
): Promise<DataProcessResult<R>> {
  const startTime = performance.now();

  const results = await processInChunks(
    request.items,
    (item, index) => request.transform(item),
    onProgress
  );

  return {
    items: results,
    totalProcessed: request.items.length,
    transformed: results.length,
    duration: performance.now() - startTime
  };
}

/**
 * Batch process items on main thread (fallback)
 */
export async function processBatchFallback<T, R>(
  request: BatchRequest<T, R>,
  onProgress?: (progress: number) => void
): Promise<DataProcessResult<R>> {
  const startTime = performance.now();

  const results = await processInChunks(
    request.items,
    (item) => request.operation(item),
    onProgress
  );

  return {
    items: results,
    totalProcessed: request.items.length,
    duration: performance.now() - startTime
  };
}

/**
 * Export data on main thread (fallback)
 */
export async function exportDataFallback<T extends Record<string, unknown>>(
  request: ExportRequest<T>,
  onProgress?: (progress: number) => void
): Promise<string> {
  onProgress?.(0);

  const result = await processInChunks(
    request.items,
    (item, index) => {
      onProgress?.(Math.round(((index + 1) / request.items.length) * 100));
      return item;
    }
  );

  onProgress?.(100);

  // Generate export string
  switch (request.format) {
    case 'json':
      const data = request.fields && request.fields.length > 0
        ? result.map((item) => {
            const filtered: Record<string, unknown> = {};
            request.fields.forEach((field) => {
              filtered[String(field)] = item[field as keyof T];
            });
            return filtered;
          })
        : result;
      return JSON.stringify(data, null, 2);

    case 'csv':
      const headers = request.fields && request.fields.length > 0
        ? request.fields.join(',')
        : Object.keys(result[0] || {}).join(',');

      const rows = result.map((item) => {
        if (request.fields && request.fields.length > 0) {
          return request.fields
            .map((field) => {
              const value = item[field as keyof T];
              return escapeCSVValue(value);
            })
            .join(',');
        }
        return Object.values(item).map((v) => escapeCSVValue(v)).join(',');
      });

      return [headers, ...rows].join('\n');

    case 'markdown':
      return result
        .map((item, index) => {
          let md = `## Item ${index + 1}\n\n`;

          if (request.fields && request.fields.length > 0) {
            request.fields.forEach((field) => {
              const value = item[field as keyof T];
              md += `**${String(field)}**: ${value !== undefined && value !== null ? String(value) : 'N/A'}\n\n`;
            });
          } else {
            Object.entries(item).forEach(([key, value]) => {
              md += `**${key}**: ${value !== undefined && value !== null ? String(value) : 'N/A'}\n\n`;
            });
          }

          return md;
        })
        .join('\n---\n\n');
  }

  return '';
}

/**
 * Escape CSV value
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ============================================
// Worker Capability Detection
// ============================================

/**
 * Check if workers are supported
 */
export function isWorkerSupported(): boolean {
  return typeof Worker !== 'undefined';
}

/**
 * Get a user-friendly message about fallback mode
 */
export function getFallbackMessage(): string {
  return 'Web Workers are not supported in this browser. Operations will run on the main thread, which may affect UI responsiveness during heavy processing.';
}

/**
 * Show fallback notification to user
 */
export function showFallbackNotification(): void {
  console.warn('[Worker Fallback]', getFallbackMessage());

  // Could show a toast notification here if needed
  // For now, just log to console
}
