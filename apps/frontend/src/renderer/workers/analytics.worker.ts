/**
 * Analytics Worker
 *
 * Handles analytics and metrics calculations off the main thread.
 * Processes large datasets for campaign performance, idea generation,
 * and task completion metrics.
 */

import type {
  WorkerMessage,
  WorkerResponse,
  WorkerProgress,
  AnalyticsRequest,
  AnalyticsMetrics,
  ChartDataRequest,
  ChartDataPoint
} from './types';

// ============================================
// Utility Functions
// ============================================

/**
 * Send progress update to main thread
 */
function reportProgress(id: string, progress: number, message?: string): void {
  const progress: WorkerProgress = {
    id,
    type: 'progress',
    progress,
    message
  };
  self.postMessage(progress);
}

/**
 * Calculate completion rate
 */
function calculateCompletionRate(items: Array<{ status?: string }>): number {
  if (items.length === 0) return 0;
  const completed = items.filter((item) => item.status === 'completed' || item.status === 'done').length;
  return Math.round((completed / items.length) * 100);
}

/**
 * Group items by a field
 */
function groupByField<T extends Record<string, unknown>>(
  items: T[],
  field: keyof T
): Record<string, number> {
  return items.reduce((acc, item) => {
    const key = String(item[field] || 'unknown');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Group by date for timeline
 */
function groupByDate<T extends { createdAt: Date }>(
  items: T[],
  groupBy: 'day' | 'week' | 'month'
): Array<{ date: string; count: number }> {
  const groups = new Map<string, T[]>();

  items.forEach((item) => {
    const date = new Date(item.createdAt);
    let key: string;

    if (groupBy === 'day') {
      key = date.toISOString().split('T')[0];
    } else if (groupBy === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  });

  return Array.from(groups.entries()).map(([date, items]) => ({
    date,
    count: items.length
  }));
}

// ============================================
// Analytics Calculations
// ============================================

/**
 * Calculate comprehensive analytics metrics
 */
function calculateAnalytics(request: AnalyticsRequest): AnalyticsMetrics {
  const { campaigns, ideas, tasks, timeframe, startDate, endDate } = request;

  // Filter by timeframe if specified
  const filteredCampaigns = filterByTimeframe(campaigns || [], timeframe, startDate, endDate);
  const filteredIdeas = filterByTimeframe(ideas || [], timeframe, startDate, endDate);
  const filteredTasks = filterByTimeframe(tasks || [], timeframe, startDate, endDate);

  // Campaign metrics
  const totalCampaigns = filteredCampaigns.length;
  const campaignsByStatus = groupByField(filteredCampaigns, 'status' as const);
  const campaignsByType = groupByField(filteredCampaigns, 'contentType' as const);
  const campaignCompletionRate = calculateCompletionRate(filteredCampaigns);

  // Idea metrics
  const totalIdeas = filteredIdeas.length;
  const ideasByType = groupByField(filteredIdeas, 'type' as const);
  const ideasByStatus = groupByField(filteredIdeas, 'status' as const);

  // Calculate idea conversion rate (ideas converted to tasks/campaigns)
  const convertedIdeas = filteredIdeas.filter(
    (idea) => idea.status === 'converted' || idea.status === 'archived'
  ).length;
  const ideaConversionRate = totalIdeas > 0
    ? Math.round((convertedIdeas / totalIdeas) * 100)
    : 0;

  // Task metrics
  const totalTasks = filteredTasks.length;
  const tasksByStatus = groupByField(filteredTasks, 'status' as const);
  const taskCompletionRate = calculateCompletionRate(filteredTasks);

  // Calculate average task duration
  const completedTasks = filteredTasks.filter(
    (task) => task.status === 'done' && task.completedAt
  );
  const averageTaskDuration = completedTasks.length > 0
    ? completedTasks.reduce((sum, task) => {
        const duration = task.completedAt!.getTime() - task.createdAt.getTime();
        return sum + duration;
      }, 0) / completedTasks.length / (1000 * 60 * 60) // Convert to hours
    : 0;

  // Engagement metrics
  const totalViews = filteredCampaigns.reduce((sum, c) => sum + (c.views || 0), 0);
  const totalClicks = filteredCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
  const totalConversions = filteredCampaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
  const averageEngagementRate = totalViews > 0
    ? Math.round((totalClicks / totalViews) * 100)
    : 0;

  // Timeline data for charts
  const campaignTimeline = groupByDate(filteredCampaigns, 'day');
  const ideaTimeline = groupByDate(filteredIdeas, 'day');
  const taskTimeline = groupByDate(filteredTasks, 'day');

  // Merge all timeline data
  const allDates = new Set<string>();
  campaignTimeline.forEach((t) => allDates.add(t.date));
  ideaTimeline.forEach((t) => allDates.add(t.date));
  taskTimeline.forEach((t) => allDates.add(t.date));

  const timeline = Array.from(allDates)
    .sort()
    .map((date) => {
      const campaignData = campaignTimeline.find((t) => t.date === date);
      const ideaData = ideaTimeline.find((t) => t.date === date);
      const taskData = taskTimeline.find((t) => t.date === date);

      return {
        date,
        campaigns: campaignData?.count || 0,
        ideas: ideaData?.count || 0,
        tasks: taskData?.count || 0
      };
    });

  return {
    // Campaign metrics
    totalCampaigns,
    campaignsByStatus,
    campaignsByType,
    campaignCompletionRate,

    // Idea metrics
    totalIdeas,
    ideasByType,
    ideasByStatus,
    ideaConversionRate,

    // Task metrics
    totalTasks,
    tasksByStatus,
    taskCompletionRate,
    averageTaskDuration,

    // Engagement metrics
    totalViews,
    totalClicks,
    totalConversions,
    averageEngagementRate,

    timeline
  };
}

/**
 * Filter data by timeframe
 */
function filterByTimeframe<T extends { createdAt: Date }>(
  items: T[],
  timeframe: AnalyticsRequest['timeframe'] = 'all',
  startDate?: Date,
  endDate?: Date
): T[] {
  const now = new Date();

  // Custom date range
  if (startDate && endDate) {
    return items.filter((item) => {
      const itemDate = new Date(item.createdAt);
      return itemDate >= startDate && itemDate <= endDate;
    });
  }

  // Predefined timeframes
  switch (timeframe) {
    case 'week':
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return items.filter((item) => new Date(item.createdAt) >= weekAgo);

    case 'month':
      const monthAgo = new Date(now);
      monthAgo.setMonth(now.getMonth() - 1);
      return items.filter((item) => new Date(item.createdAt) >= monthAgo);

    case 'quarter':
      const quarterAgo = new Date(now);
      quarterAgo.setMonth(now.getMonth() - 3);
      return items.filter((item) => new Date(item.createdAt) >= quarterAgo);

    case 'year':
      const yearAgo = new Date(now);
      yearAgo.setFullYear(now.getFullYear() - 1);
      return items.filter((item) => new Date(item.createdAt) >= yearAgo);

    case 'all':
    default:
      return items;
  }
}

// ============================================
// Chart Data Generation
// ============================================

/**
 * Generate chart data based on request parameters
 */
function generateChartData(request: ChartDataRequest): ChartDataPoint[] {
  const { type, dataType, groupBy, data } = request;
  const analytics = calculateAnalytics(data);

  let dataPoints: ChartDataPoint[] = [];

  switch (dataType) {
    case 'campaigns':
      dataPoints = generateCampaignChartData(type, groupBy, analytics);
      break;

    case 'ideas':
      dataPoints = generateIdeaChartData(type, groupBy, analytics);
      break;

    case 'tasks':
      dataPoints = generateTaskChartData(type, groupBy, analytics);
      break;

    case 'engagement':
      dataPoints = generateEngagementChartData(type, groupBy, analytics);
      break;
  }

  return dataPoints;
}

/**
 * Generate campaign chart data
 */
function generateCampaignChartData(
  type: ChartDataRequest['type'],
  groupBy: ChartDataRequest['groupBy'],
  analytics: AnalyticsMetrics
): ChartDataPoint[] {
  switch (type) {
    case 'pie':
      return Object.entries(analytics.campaignsByType).map(([label, value]) => ({
        label,
        value,
        category: label
      }));

    case 'bar':
      if (groupBy === 'status') {
        return Object.entries(analytics.campaignsByStatus).map(([label, value]) => ({
          label,
          value,
          category: label
        }));
      }
      // Fall through for type grouping
      return Object.entries(analytics.campaignsByType).map(([label, value]) => ({
        label,
        value,
        category: label
      }));

    case 'line':
    case 'area':
      return analytics.timeline.map((point) => ({
        label: point.date,
        value: point.campaigns,
        date: point.date
      }));

    default:
      return [];
  }
}

/**
 * Generate idea chart data
 */
function generateIdeaChartData(
  type: ChartDataRequest['type'],
  groupBy: ChartDataRequest['groupBy'],
  analytics: AnalyticsMetrics
): ChartDataPoint[] {
  switch (type) {
    case 'pie':
      return Object.entries(analytics.ideasByType).map(([label, value]) => ({
        label,
        value,
        category: label
      }));

    case 'bar':
      if (groupBy === 'status') {
        return Object.entries(analytics.ideasByStatus).map(([label, value]) => ({
          label,
          value,
          category: label
        }));
      }
      return Object.entries(analytics.ideasByType).map(([label, value]) => ({
        label,
        value,
        category: label
      }));

    case 'line':
    case 'area':
      return analytics.timeline.map((point) => ({
        label: point.date,
        value: point.ideas,
        date: point.date
      }));

    default:
      return [];
  }
}

/**
 * Generate task chart data
 */
function generateTaskChartData(
  type: ChartDataRequest['type'],
  groupBy: ChartDataRequest['groupBy'],
  analytics: AnalyticsMetrics
): ChartDataPoint[] {
  switch (type) {
    case 'pie':
      return Object.entries(analytics.tasksByStatus).map(([label, value]) => ({
        label,
        value,
        category: label
      }));

    case 'bar':
      return Object.entries(analytics.tasksByStatus).map(([label, value]) => ({
        label,
        value,
        category: label
      }));

    case 'line':
    case 'area':
      return analytics.timeline.map((point) => ({
        label: point.date,
        value: point.tasks,
        date: point.date
      }));

    default:
      return [];
  }
}

/**
 * Generate engagement chart data
 */
function generateEngagementChartData(
  type: ChartDataRequest['type'],
  groupBy: ChartDataRequest['groupBy'],
  analytics: AnalyticsMetrics
): ChartDataPoint[] {
  if (type === 'bar' || type === 'pie') {
    return [
      { label: 'Views', value: analytics.totalViews, category: 'views' },
      { label: 'Clicks', value: analytics.totalClicks, category: 'clicks' },
      { label: 'Conversions', value: analytics.totalConversions, category: 'conversions' }
    ];
  }

  if (type === 'line' || type === 'area') {
    return analytics.timeline.map((point) => {
      // Aggregate engagement for this date point
      const dayCampaigns = request.data.campaigns?.filter((c) => {
        if (!c.scheduledDate) return false;
        const campaignDate = new Date(c.scheduledDate).toISOString().split('T')[0];
        return campaignDate === point.date;
      }) || [];

      const views = dayCampaigns.reduce((sum, c) => sum + (c.views || 0), 0);
      const clicks = dayCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);

      return {
        label: point.date,
        value: clicks,
        date: point.date
      };
    });
  }

  return [];
}

// ============================================
// Message Handler
// ============================================

/**
 * Main message handler for analytics worker
 */
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const { id, type, data } = event.data;
  const startTime = performance.now();

  try {
    let result: unknown;

    switch (type) {
      case 'calculate':
        reportProgress(id, 0, 'Calculating analytics...');
        result = calculateAnalytics(data as AnalyticsRequest);
        reportProgress(id, 100, 'Analytics calculated');
        break;

      case 'chart':
        reportProgress(id, 0, 'Generating chart data...');
        result = generateChartData(data as ChartDataRequest);
        reportProgress(id, 100, 'Chart data generated');
        break;

      default:
        throw new Error(`Unknown operation type: ${type}`);
    }

    const response: WorkerResponse = {
      id,
      type,
      data: result
    };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id,
      type,
      error: error instanceof Error ? error.message : String(error)
    };
    self.postMessage(response);
  }
});

// Export for testing
if (typeof window !== 'undefined') {
  (window as unknown as { worker: unknown }).worker = self;
}

export {};
