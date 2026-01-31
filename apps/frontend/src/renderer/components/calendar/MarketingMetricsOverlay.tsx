import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  isSameDay,
  isToday,
  addDays,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
  differenceInDays,
} from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart,
  PieChart,
  Target,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  X,
  Calendar,
  Filter,
  Download,
} from 'lucide-react';

// Metric types
export type MetricType =
  | 'traffic'
  | 'conversions'
  | 'revenue'
  | 'engagement'
  | 'followers'
  | 'email'
  | 'content';

// Metric data interface
export interface MarketingMetric {
  id: string;
  type: MetricType;
  name: string;
  value: number;
  previousValue?: number;
  target?: number;
  unit: string;
  date: Date;
  changePercent?: number;
  status: 'on-track' | 'warning' | 'critical';
}

// Period comparison data
export interface PeriodComparison {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  period: 'week' | 'month' | 'quarter';
}

// Metric type config
const METRIC_TYPE_CONFIG: Record<
  MetricType,
  { label: string; icon: typeof TrendingUp; color: string; gradient: string }
> = {
  traffic: {
    label: 'Traffic',
    icon: TrendingUp,
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6, #60A5FA)',
  },
  conversions: {
    label: 'Conversions',
    icon: Target,
    color: '#10B981',
    gradient: 'linear-gradient(135deg, #10B981, #34D399)',
  },
  revenue: {
    label: 'Revenue',
    icon: BarChart3,
    color: '#8B5CF6',
    gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
  },
  engagement: {
    label: 'Engagement',
    icon: LineChart,
    color: '#EC4899',
    gradient: 'linear-gradient(135deg, #EC4899, #F472B6)',
  },
  followers: {
    label: 'Followers',
    icon: PieChart,
    color: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
  },
  email: {
    label: 'Email',
    icon: TrendingUp,
    color: '#6366F1',
    gradient: 'linear-gradient(135deg, #6366F1, #818CF8)',
  },
  content: {
    label: 'Content',
    icon: BarChart3,
    color: '#14B8A6',
    gradient: 'linear-gradient(135deg, #14B8A6, #2DD4BF)',
  },
};

interface MarketingMetricsOverlayProps {
  projectId: string;
  currentDate?: Date;
}

export function MarketingMetricsOverlay({
  projectId,
  currentDate = new Date(),
}: MarketingMetricsOverlayProps) {
  // UI State
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showMetrics, setShowMetrics] = useState(true);
  const [selectedMetricType, setSelectedMetricType] = useState<MetricType | 'all'>('all');
  const [comparisonPeriod, setComparisonPeriod] = useState<'week' | 'month'>('week');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailMetric, setDetailMetric] = useState<MarketingMetric | null>(null);

  // Generate sample metrics data (in real app, this would come from analytics integrations)
  const metricsData = useMemo(() => {
    return generateSampleMetrics(currentDate);
  }, [currentDate]);

  // Filter metrics by type
  const filteredMetrics = useMemo(() => {
    if (selectedMetricType === 'all') {
      return metricsData;
    }
    return metricsData.filter((m) => m.type === selectedMetricType);
  }, [metricsData, selectedMetricType]);

  // Get KPI alerts (metrics that are off-track)
  const kpiAlerts = useMemo(() => {
    return metricsData.filter((m) => m.status === 'critical' || m.status === 'warning');
  }, [metricsData]);

  // Calculate period comparisons
  const periodComparisons = useMemo(() => {
    return calculatePeriodComparisons(metricsData, comparisonPeriod);
  }, [metricsData, comparisonPeriod]);

  // Toggle metrics visibility for a date
  const toggleDateMetrics = (date: Date) => {
    if (selectedDate && isSameDay(date, selectedDate)) {
      setSelectedDate(null);
    } else {
      setSelectedDate(date);
    }
  };

  // Get metrics for a specific date
  const getMetricsForDate = (date: Date): MarketingMetric[] => {
    return metricsData.filter((m) => isSameDay(m.date, date));
  };

  return (
    <div className="relative">
      {/* Metrics Summary Bar */}
      {showMetrics && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-b bg-gradient-to-r from-purple-500/10 to-blue-500/10 backdrop-blur-sm"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-purple-500/20">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-semibold">Marketing Metrics Overview</span>
              <span className="text-xs text-muted-foreground">
                ({format(currentDate, 'MMMM yyyy')})
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* KPI Alerts */}
              {kpiAlerts.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 text-amber-600 text-xs font-medium">
                  <AlertCircle className="h-3 w-3" />
                  {kpiAlerts.length} KPI{ kpiAlerts.length > 1 ? 's' : '' } need attention
                </div>
              )}

              {/* Period Comparison Toggle */}
              <div className="flex items-center gap-1 border rounded-lg p-0.5">
                {(['week', 'month'] as const).map((period) => (
                  <motion.button
                    key={period}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setComparisonPeriod(period)}
                    className={`
                      px-2 py-0.5 rounded text-xs font-medium capitalize transition-colors
                      ${comparisonPeriod === period
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent'
                      }
                    `}
                  >
                    {period}
                  </motion.button>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowMetrics(false)}
                className="p-1 rounded hover:bg-accent"
                title="Hide metrics"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-4 mb-3">
              {/* Metric Type Filter */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => setSelectedMetricType('all')}
                  className={`
                    px-2 py-1 rounded-md text-xs font-medium transition-colors
                    ${selectedMetricType === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                    }
                  `}
                >
                  All Metrics
                </button>
                {Object.entries(METRIC_TYPE_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <motion.button
                      key={key}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedMetricType(key as MetricType)}
                      className={`
                        px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors
                        ${selectedMetricType === key
                          ? 'bg-white text-gray-900'
                          : 'bg-white/50 hover:bg-white/70'
                        }
                      `}
                    >
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {filteredMetrics.slice(0, 7).map((metric) => {
                const config = METRIC_TYPE_CONFIG[metric.type];
                const Icon = config.icon;
                const comparison = periodComparisons[metric.type];
                const isPositive = comparison?.changePercent ?? 0 >= 0;

                return (
                  <motion.div
                    key={metric.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    onClick={() => {
                      setDetailMetric(metric);
                      setShowDetailModal(true);
                    }}
                    className="relative p-3 rounded-lg border bg-card cursor-pointer hover:shadow-lg transition-all"
                    style={{
                      borderColor: metric.status === 'critical' ? '#EF4444' :
                                   metric.status === 'warning' ? '#F59E0B' :
                                   'transparent',
                    }}
                  >
                    {/* Status indicator */}
                    <div className="absolute top-2 right-2">
                      {metric.status === 'critical' ? (
                        <AlertCircle className="h-3 w-3 text-red-500" />
                      ) : metric.status === 'warning' ? (
                        <AlertCircle className="h-3 w-3 text-amber-500" />
                      ) : (
                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                      )}
                    </div>

                    {/* Metric icon */}
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="p-1.5 rounded"
                        style={{ background: config.gradient }}
                      >
                        <Icon className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {config.label}
                      </span>
                    </div>

                    {/* Value */}
                    <div className="text-lg font-semibold">
                      {metric.value.toLocaleString()}
                      <span className="text-xs font-normal text-muted-foreground ml-0.5">
                        {metric.unit}
                      </span>
                    </div>

                    {/* Change indicator */}
                    {comparison && (
                      <div className="flex items-center gap-1 mt-1">
                        {isPositive ? (
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        <span
                          className={`text-xs font-medium ${
                            isPositive ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {comparison.changePercent.toFixed(1)}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          vs last {comparisonPeriod}
                        </span>
                      </div>
                    )}

                    {/* Target progress */}
                    {metric.target && (
                      <div className="mt-2">
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${Math.min((metric.value / metric.target) * 100, 100)}%`,
                              background: config.gradient,
                            }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {Math.round((metric.value / metric.target) * 100)}% of target
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Goal Progress Summary */}
            <div className="mt-3 p-3 rounded-lg bg-muted/30">
              <h4 className="text-xs font-semibold mb-2">Monthly Goal Progress</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(METRIC_TYPE_CONFIG).slice(0, 4).map(([key, config]) => {
                  const metric = metricsData.find((m) => m.type === key);
                  if (!metric?.target) return null;

                  const progress = Math.min((metric.value / metric.target) * 100, 100);
                  const isOnTrack = progress >= 75;

                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{config.label}</span>
                        <span className={`text-xs font-medium ${isOnTrack ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {progress.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${isOnTrack ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Show metrics button (when hidden) */}
      {!showMetrics && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowMetrics(true)}
          className="absolute top-4 right-4 z-10 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-lg flex items-center gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          Show Metrics
        </motion.button>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && detailMetric && (
          <MetricDetailModal
            metric={detailMetric}
            comparison={periodComparisons[detailMetric.type]}
            onClose={() => {
              setShowDetailModal(false);
              setDetailMetric(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Generate sample metrics data
function generateSampleMetrics(date: Date): MarketingMetric[] {
  const metrics: MarketingMetric[] = [];
  const metricTypes: MetricType[] = ['traffic', 'conversions', 'revenue', 'engagement', 'followers', 'email', 'content'];

  metricTypes.forEach((type) => {
    const baseValue = Math.floor(Math.random() * 10000) + 1000;
    const target = Math.floor(baseValue * 1.2);
    const value = Math.floor(baseValue * (0.8 + Math.random() * 0.4));
    const changePercent = (Math.random() - 0.3) * 30; // -15% to +15%

    let status: 'on-track' | 'warning' | 'critical' = 'on-track';
    if (value < target * 0.5) status = 'critical';
    else if (value < target * 0.75) status = 'warning';

    metrics.push({
      id: `metric-${type}-${format(date, 'yyyy-MM-dd')}`,
      type,
      name: METRIC_TYPE_CONFIG[type].label,
      value,
      target,
      unit: type === 'revenue' ? '$' : type === 'followers' ? '' : '',
      date,
      changePercent,
      status,
    });
  });

  return metrics;
}

// Calculate period comparisons
function calculatePeriodComparisons(
  metrics: MarketingMetric[],
  period: 'week' | 'month'
): Record<MetricType, PeriodComparison> {
  const comparisons: Record<string, PeriodComparison> = {};

  metrics.forEach((metric) => {
    const changePercent = metric.changePercent || (Math.random() - 0.3) * 20;
    const previousValue = metric.value / (1 + changePercent / 100);

    comparisons[metric.type] = {
      current: metric.value,
      previous: previousValue,
      change: metric.value - previousValue,
      changePercent,
      period,
    };
  });

  return comparisons;
}

// Metric Detail Modal
function MetricDetailModal({
  metric,
  comparison,
  onClose,
}: {
  metric: MarketingMetric;
  comparison?: PeriodComparison;
  onClose: () => void;
}) {
  const config = METRIC_TYPE_CONFIG[metric.type];
  const Icon = config.icon;
  const isPositive = (comparison?.changePercent ?? 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-lg shadow-xl max-w-md w-full p-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-lg"
              style={{ background: config.gradient }}
            >
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{metric.name}</h2>
              <p className="text-sm text-muted-foreground">
                {format(metric.date, 'MMMM d, yyyy')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Value */}
        <div className="p-4 rounded-lg bg-muted/30 mb-4">
          <div className="text-sm text-muted-foreground mb-1">Current Value</div>
          <div className="text-3xl font-bold">
            {metric.value.toLocaleString()}
            <span className="text-lg font-normal text-muted-foreground ml-1">
              {metric.unit}
            </span>
          </div>
        </div>

        {/* Comparison */}
        {comparison && (
          <div className="p-4 rounded-lg border mb-4">
            <div className="text-sm text-muted-foreground mb-2">
              Comparison with previous {comparison.period}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Previous</div>
                <div className="text-lg font-semibold">
                  {comparison.previous.toLocaleString()}
                  {metric.unit}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Change</div>
                <div className={`text-lg font-semibold flex items-center gap-1 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {isPositive ? '+' : ''}
                  {comparison.changePercent.toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Absolute change:</span>
                <span className={`font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}
                  {comparison.change.toFixed(0)}
                  {metric.unit}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Target Progress */}
        {metric.target && (
          <div className="p-4 rounded-lg border mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Goal Progress</span>
              <span className="text-sm font-medium">
                {Math.round((metric.value / metric.target) * 100)}%
              </span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-2">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.min((metric.value / metric.target) * 100, 100)}%`,
                  background: config.gradient,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current:</span>
              <span className="font-medium">
                {metric.value.toLocaleString()}
                {metric.unit}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Target:</span>
              <span className="font-medium">
                {metric.target.toLocaleString()}
                {metric.unit}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-muted-foreground">Remaining:</span>
              <span className={`font-medium ${
                metric.value >= metric.target ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                {Math.max(0, metric.target - metric.value).toLocaleString()}
                {metric.unit}
              </span>
            </div>
          </div>
        )}

        {/* Status */}
        <div className={`p-3 rounded-lg ${
          metric.status === 'critical' ? 'bg-red-500/10 border border-red-500/20' :
          metric.status === 'warning' ? 'bg-amber-500/10 border border-amber-500/20' :
          'bg-emerald-500/10 border border-emerald-500/20'
        }`}>
          <div className="flex items-center gap-2">
            {metric.status === 'critical' ? (
              <AlertCircle className="h-4 w-4 text-red-500" />
            ) : metric.status === 'warning' ? (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            )}
            <span className="text-sm font-medium">
              {metric.status === 'critical' ? 'Needs Attention - Below 50% of target' :
               metric.status === 'warning' ? 'At Risk - Below 75% of target' :
               'On Track - Making good progress'}
            </span>
          </div>
        </div>

        {/* Export */}
        <div className="mt-4 flex items-center gap-2">
          <button className="flex-1 px-4 py-2 rounded-lg bg-muted text-sm font-medium flex items-center justify-center gap-2 hover:bg-accent">
            <Download className="h-4 w-4" />
            Export Report
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
