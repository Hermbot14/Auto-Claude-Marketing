import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Zap,
  Package,
  Cpu,
  Globe,
  Download,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './ui/table';
import { Badge } from './ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './ui/tooltip';

/**
 * Performance metric data structure
 */
interface PerformanceMetric {
  name: string;
  category: 'performance' | 'resources' | 'memory' | 'network';
  actual: number;
  budget: number;
  warning: number;
  unit: string;
  status: 'pass' | 'warning' | 'fail';
  trend?: 'up' | 'down' | 'neutral';
  description: string;
}

/**
 * Performance data snapshot for history tracking
 */
interface PerformanceSnapshot {
  timestamp: number;
  metrics: PerformanceMetric[];
}

/**
 * Performance budget configuration
 */
interface PerformanceBudget {
  budgets: {
    performance: Record<string, { budget: number; warning: number; unit: string; description: string; rationale: string }>;
    resources: {
      bundleSize: Record<string, { budget: number; warning: number; unit: string; description: string; rationale: string }>;
      assets: Record<string, { budget: number; warning: number; unit: string; description: string; rationale: string }>;
    };
    memory: Record<string, { budget: number; warning: number; unit: string; description: string; rationale: string }>;
    network: Record<string, { budget: number; warning: number; unit: string; description: string; rationale: string }>;
  };
  lighthouse: {
    categories: Record<string, { budget: number; warning: number }>;
  };
}

/**
 * Format values for display
 */
function formatValue(value: number, unit: string): string {
  switch (unit) {
    case 'bytes':
      if (value >= 1024 * 1024) {
        return `${(value / (1024 * 1024)).toFixed(2)} MB`;
      }
      return `${(value / 1024).toFixed(2)} KB`;
    case 'ms':
      return `${value.toFixed(0)}ms`;
    case 'score':
      return value.toFixed(0);
    case 'count':
      return value.toString();
    default:
      return value.toString();
  }
}

/**
 * Calculate percentage of budget used
 */
function getPercentageUsed(actual: number, budget: number): number {
  return Math.min((actual / budget) * 100, 100);
}

/**
 * Get status color class
 */
function getStatusColor(status: 'pass' | 'warning' | 'fail'): string {
  switch (status) {
    case 'pass':
      return 'text-green-500';
    case 'warning':
      return 'text-yellow-500';
    case 'fail':
      return 'text-red-500';
  }
}

/**
 * Get progress bar variant
 */
function getProgressVariant(status: 'pass' | 'warning' | 'fail'): 'default' | 'warning' | 'destructive' {
  switch (status) {
    case 'pass':
      return 'default';
    case 'warning':
      return 'warning';
    case 'fail':
      return 'destructive';
  }
}

export function PerformanceDashboard() {
  const { t } = useTranslation('settings');
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'performance' | 'resources' | 'memory' | 'network'>('all');
  const [showRationale, setShowRationale] = useState(false);

  /**
   * Load performance budget configuration
   */
  useEffect(() => {
    loadBudgetConfig();
  }, []);

  /**
   * Monitor performance metrics in real-time
   */
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming;
          handleNavigationMetrics(navEntry);
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['navigation', 'resource'] });
    } catch (e) {
      // Navigation timing might not be available in all contexts
      console.warn('Performance Observer not fully supported:', e);
    }

    // Monitor memory usage
    const memoryInterval = setInterval(() => {
      if ('memory' in performance) {
        const mem = (performance as any).memory;
        updateMemoryMetrics(mem);
      }
    }, 5000);

    return () => {
      observer.disconnect();
      clearInterval(memoryInterval);
    };
  }, []);

  /**
   * Load budget configuration from file
   */
  async function loadBudgetConfig() {
    try {
      setLoading(true);

      // Try to load the budget config
      const response = await fetch('/performance-budget.config.json');
      if (!response.ok) {
        throw new Error('Failed to load budget config');
      }

      const budget: PerformanceBudget = await response.json();

      // Convert budget config to metrics
      const loadedMetrics: PerformanceMetric[] = [];

      // Performance metrics
      for (const [key, value] of Object.entries(budget.budgets.performance)) {
        const actual = getActualValue(key);
        loadedMetrics.push({
          name: key,
          category: 'performance',
          actual,
          budget: value.budget,
          warning: value.warning,
          unit: value.unit,
          status: getStatus(actual, value.budget, value.warning),
          description: value.description
        });
      }

      // Bundle sizes
      for (const [key, value] of Object.entries(budget.budgets.resources.bundleSize)) {
        const actual = getBundleSize(key);
        loadedMetrics.push({
          name: `bundleSize.${key}`,
          category: 'resources',
          actual,
          budget: value.budget,
          warning: value.warning,
          unit: value.unit,
          status: getStatus(actual, value.budget, value.warning),
          description: value.description
        });
      }

      // Memory metrics
      for (const [key, value] of Object.entries(budget.budgets.memory)) {
        const actual = getMemoryValue(key);
        loadedMetrics.push({
          name: key,
          category: 'memory',
          actual,
          budget: value.budget,
          warning: value.warning,
          unit: value.unit,
          status: getStatus(actual, value.budget, value.warning),
          description: value.description
        });
      }

      // Network metrics
      for (const [key, value] of Object.entries(budget.budgets.network)) {
        const actual = getNetworkValue(key);
        loadedMetrics.push({
          name: key,
          category: 'network',
          actual,
          budget: value.budget,
          warning: value.warning,
          unit: value.unit,
          status: getStatus(actual, value.budget, value.warning),
          description: value.description
        });
      }

      setMetrics(loadedMetrics);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load performance budget:', error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Get actual value for a performance metric
   */
  function getActualValue(key: string): number {
    const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    switch (key) {
      case 'timeToInteractive':
        // TDI approximation
        if (perfData) {
          return perfData.domContentLoadedEventEnd - perfData.fetchStart;
        }
        return 0;
      case 'firstContentfulPaint':
        const fcp = performance.getEntriesByName('first-contentful-paint')[0] as PerformancePaintTiming;
        return fcp?.startTime || 0;
      case 'largestContentfulPaint':
        // Would need LCP observer
        return 0;
      case 'cumulativeLayoutShift':
        // Would need CLS observer
        return 0;
      case 'firstInputDelay':
        // Would need FID observer
        return 0;
      case 'timeToFirstByte':
        if (perfData) {
          return perfData.responseStart - perfData.fetchStart;
        }
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Get bundle size from build
   */
  function getBundleSize(key: string): number {
    // In a real implementation, this would read from the built bundle
    // For now, return estimated values
    const sizes: Record<string, number> = {
      main: 1200000, // ~1.2MB
      renderer: 800000, // ~800KB
      preload: 300000, // ~300KB
      css: 150000 // ~150KB
    };
    return sizes[key] || 0;
  }

  /**
   * Get memory usage
   */
  function getMemoryValue(key: string): number {
    if ('memory' in performance) {
      const mem = (performance as any).memory;
      switch (key) {
        case 'heapSize':
          return mem.usedJSHeapSize || 0;
        case 'jsHeapSizeLimit':
          return mem.jsHeapSizeLimit || 0;
      }
    }
    return 0;
  }

  /**
   * Update memory metrics from performance.memory
   */
  function updateMemoryMetrics(mem: any) {
    setMetrics(prev => prev.map(m => {
      if (m.name === 'heapSize') {
        return {
          ...m,
          actual: mem.usedJSHeapSize || 0,
          status: getStatus(mem.usedJSHeapSize || 0, m.budget, m.warning)
        };
      }
      return m;
    }));
  }

  /**
   * Get network metrics
   */
  function getNetworkValue(key: string): number {
    const resources = performance.getEntriesByType('resource');
    switch (key) {
      case 'requests':
        return resources.length;
      case 'totalTransferSize':
        return resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
      default:
        return 0;
    }
  }

  /**
   * Handle navigation timing metrics
   */
  function handleNavigationMetrics(entry: PerformanceNavigationTiming) {
    setMetrics(prev => prev.map(m => {
      if (m.name === 'timeToInteractive') {
        const tti = entry.domContentLoadedEventEnd - entry.fetchStart;
        return { ...m, actual: tti, status: getStatus(tti, m.budget, m.warning) };
      }
      if (m.name === 'timeToFirstByte') {
        const ttfb = entry.responseStart - entry.fetchStart;
        return { ...m, actual: ttfb, status: getStatus(ttfb, m.budget, m.warning) };
      }
      return m;
    }));
  }

  /**
   * Get status based on actual value vs budgets
   */
  function getStatus(actual: number, budget: number, warning: number): 'pass' | 'warning' | 'fail' {
    if (actual > budget) return 'fail';
    if (actual > warning) return 'warning';
    return 'pass';
  }

  /**
   * Get filtered metrics
   */
  const filteredMetrics = selectedCategory === 'all'
    ? metrics
    : metrics.filter(m => m.category === selectedCategory);

  /**
   * Get summary statistics
   */
  const summary = {
    total: metrics.length,
    passed: metrics.filter(m => m.status === 'pass').length,
    warning: metrics.filter(m => m.status === 'warning').length,
    failed: metrics.filter(m => m.status === 'fail').length
  };

  /**
   * Category icons
   */
  const categoryIcons: Record<string, React.ReactNode> = {
    performance: <Zap className="h-4 w-4" />,
    resources: <Package className="h-4 w-4" />,
    memory: <Cpu className="h-4 w-4" />,
    network: <Globe className="h-4 w-4" />
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{t('performance.title', { ns: 'settings' })}</h2>
            <p className="text-muted-foreground">
              {t('performance.description', { ns: 'settings' })}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadBudgetConfig()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('performance.refresh', { ns: 'settings' })}
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('performance.totalMetrics', { ns: 'settings' })}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-500">{t('performance.passed', { ns: 'settings' })}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{summary.passed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-500">{t('performance.warnings', { ns: 'settings' })}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{summary.warning}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-500">{t('performance.failed', { ns: 'settings' })}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{summary.failed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
          >
            {t('performance.all', { ns: 'settings' })}
          </Button>
          <Button
            variant={selectedCategory === 'performance' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('performance')}
          >
            <Zap className="h-4 w-4 mr-1" />
            {t('performance.performance', { ns: 'settings' })}
          </Button>
          <Button
            variant={selectedCategory === 'resources' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('resources')}
          >
            <Package className="h-4 w-4 mr-1" />
            {t('performance.resources', { ns: 'settings' })}
          </Button>
          <Button
            variant={selectedCategory === 'memory' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('memory')}
          >
            <Cpu className="h-4 w-4 mr-1" />
            {t('performance.memory', { ns: 'settings' })}
          </Button>
          <Button
            variant={selectedCategory === 'network' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('network')}
          >
            <Globe className="h-4 w-4 mr-1" />
            {t('performance.network', { ns: 'settings' })}
          </Button>
        </div>

        {/* Metrics Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('performance.metrics', { ns: 'settings' })}</CardTitle>
            {lastUpdate && (
              <CardDescription>
                {t('performance.lastUpdate', { ns: 'settings' })}: {lastUpdate.toLocaleTimeString()}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('performance.metric', { ns: 'settings' })}</TableHead>
                    <TableHead>{t('performance.actual', { ns: 'settings' })}</TableHead>
                    <TableHead>{t('performance.budget', { ns: 'settings' })}</TableHead>
                    <TableHead>{t('performance.usage', { ns: 'settings' })}</TableHead>
                    <TableHead>{t('performance.status', { ns: 'settings' })}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMetrics.map((metric) => (
                    <TableRow key={metric.name}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {categoryIcons[metric.category]}
                          {metric.name}
                        </div>
                      </TableCell>
                      <TableCell>{formatValue(metric.actual, metric.unit)}</TableCell>
                      <TableCell>{formatValue(metric.budget, metric.unit)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={getPercentageUsed(metric.actual, metric.budget)}
                            className="flex-1"
                            variant={getProgressVariant(metric.status)}
                          />
                          <span className="text-sm text-muted-foreground w-12 text-right">
                            {getPercentageUsed(metric.actual, metric.budget).toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={metric.status === 'pass' ? 'default' : metric.status === 'warning' ? 'secondary' : 'destructive'}
                        >
                          {metric.status === 'pass' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {metric.status === 'warning' && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {metric.status === 'fail' && <XCircle className="h-3 w-3 mr-1" />}
                          {metric.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Rationale Section */}
        {showRationale && (
          <Card>
            <CardHeader>
              <CardTitle>{t('performance.rationaleTitle', { ns: 'settings' })}</CardTitle>
              <CardDescription>
                {t('performance.rationaleDescription', { ns: 'settings' })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredMetrics.map((metric) => (
                  <div key={metric.name} className="border-l-2 border-muted-foreground/20 pl-4">
                    <h4 className="font-medium">{metric.name}</h4>
                    <p className="text-sm text-muted-foreground">{metric.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
