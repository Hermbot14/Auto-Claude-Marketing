/**
 * Task Monitor Component
 * =====================
 *
 * Admin dashboard for monitoring background task queue status.
 * Displays tasks, workers, statistics, and controls.
 */

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Play, Pause, Trash2, Filter, Download, Settings } from 'lucide-react';
import { useTaskQueueStore, getFilteredTasks, getTasksByStatus, formatDuration, getStatusColor, getPriorityColor } from '../../stores/taskQueueStore';
import { cn } from '../../lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ViewToggleProps {
  view: 'list' | 'grid' | 'timeline';
  icon: React.ReactNode;
  label: string;
}

// ============================================================================
// Subcomponents
// ============================================================================

function ViewToggle({ view, icon, label }: ViewToggleProps) {
  const { viewMode, setViewMode } = useTaskQueueStore();
  const isActive = viewMode === view;

  return (
    <button
      onClick={() => setViewMode(view)}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-muted'
      )}
      title={`Switch to ${label} view`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function StatusBadge({ status, count }: { status: string; count: number }) {
  const colors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    queued: 'bg-blue-100 text-blue-700',
    running: 'bg-green-100 text-green-700',
    completed: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
    retrying: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', colors[status] || colors.pending)}>
      <span>{status}</span>
      <span className="text-muted-foreground">({count})</span>
    </div>
  );
}

function ProgressBar({ progress, message }: { progress: number; message: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{message}</span>
        <span>{progress.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function WorkerCard({ worker }: { worker: ReturnType<typeof getTasksByStatus>[0] }) {
  const statusColors: Record<string, string> = {
    idle: 'bg-gray-100 text-gray-700',
    busy: 'bg-green-100 text-green-700',
    stopping: 'bg-yellow-100 text-yellow-700',
    stopped: 'bg-red-100 text-red-700',
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm">{worker.workerId}</span>
        <span className={cn('px-2 py-1 rounded-full text-xs font-medium', statusColors[worker.status] || statusColors.idle)}>
          {worker.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Current Task:</span>
          <span className="font-medium">{worker.currentTaskId || 'None'}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Completed:</span>
          <span className="font-medium">{worker.tasksCompleted}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Failed:</span>
          <span className="font-medium">{worker.tasksFailed}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Utilisation:</span>
          <span className="font-medium">{(worker.utilisation * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TaskMonitor() {
  const {
    tasks,
    workers,
    stats,
    statsLoading,
    filters,
    setFilters,
    fetchTasks,
    fetchStats,
    refreshTasks,
    clearCompleted,
    pauseQueue,
    resumeQueue,
    autoRefresh,
    viewMode,
    setAutoRefresh,
    setViewMode,
  } = useTaskQueueStore();

  const [searchInput, setSearchInput] = useState(filters.search);

  const filteredTasks = getFilteredTasks(useTaskQueueStore.getState());

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchTasks();
      fetchStats();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    setFilters({ ...filters, search: value });
  }, [filters, setFilters]);

  const handleStatusFilter = useCallback((status: 'all' | typeof filters.status) => {
    setFilters({ ...filters, status: status === 'all' ? 'all' : status });
  }, [filters, setFilters]);

  const handlePriorityFilter = useCallback((priority: 'all' | typeof filters.priority) => {
    setFilters({ ...filters, priority: priority === 'all' ? 'all' : priority });
  }, [filters, setFilters]);

  const getPendingCount = () => stats?.pending || 0;
  const getRunningCount = () => stats?.running || 0;
  const getCompletedCount = () => stats?.completed || 0;
  const getFailedCount = () => stats?.failed || 0;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Task Queue Monitor</h1>

            {/* View Toggle */}
            <div className="flex items-center bg-muted rounded-lg p-1">
              <ViewToggle
                view="list"
                icon={<Filter className="h-4 w-4" />}
                label="List"
              />
              <ViewToggle
                view="grid"
                icon={<div className="h-4 w-4 grid grid-cols-2 gap-0.5"><div className="bg-current rounded-sm" /><div className="bg-current rounded-sm" /></div>}
                label="Grid"
              />
              <ViewToggle
                view="timeline"
                icon={<div className="h-4 w-4 space-y-0.5"><div className="bg-current rounded-sm" /><div className="bg-current rounded-sm" /></div>}
                label="Timeline"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                'p-2 rounded-md transition-colors',
                autoRefresh ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
              title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
            >
              <RefreshCw className={cn('h-4 w-4', autoRefresh && 'animate-spin')} />
            </button>

            <button
              onClick={refreshTasks}
              className="p-2 hover:bg-muted rounded-md transition-colors"
              title="Refresh now"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            <button
              onClick={() => clearCompleted()}
              className="p-2 hover:bg-muted rounded-md transition-colors text-destructive"
              title="Clear completed tasks"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            <button
              className="p-2 hover:bg-muted rounded-md transition-colors"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3 mt-4">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <select
            value={filters.status}
            onChange={(e) => handleStatusFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={filters.priority}
            onChange={(e) => handlePriorityFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Statistics Bar */}
      <div className="border-b bg-muted/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <StatusBadge status="Pending" count={getPendingCount()} />
            <StatusBadge status="Queued" count={stats?.byPriority?.medium || 0} />
            <StatusBadge status="Running" count={getRunningCount()} />
            <StatusBadge status="Completed" count={getCompletedCount()} />
            <StatusBadge status="Failed" count={getFailedCount()} />
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {statsLoading && <span>Loading...</span>}
            {!statsLoading && stats && (
              <>
                <span>Workers: {stats.workerStats?.totalWorkers || 0}</span>
                <span>Active: {stats.workerStats?.activeWorkers || 0}</span>
                <span>
                  Util: {stats.workerStats?.averageUtilisation?.toFixed(1) || 0}%
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {statsLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p className="text-sm text-muted-foreground">Loading queue data...</p>
            </div>
          </div>
        ) : viewMode === 'list' ? (
          /* List View */
          <div className="p-4 space-y-3">
            {filteredTasks.map(task => (
              <div key={task.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{task.name}</span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getPriorityColor(task.priority))}>
                        {task.priority}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getStatusColor(task.status))}>
                        {task.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ID: <span className="font-mono">{task.id}</span>
                      Created: {new Date(task.createdAt).toLocaleString()}
                    </div>
                    {task.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {task.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-muted rounded text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {task.duration && (
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(task.duration)}
                    </span>
                  )}
                </div>

                {task.status === 'running' && task.progress && (
                  <ProgressBar progress={task.progress.progress} message={task.progress.message} />
                )}

                {task.result && task.result.error && (
                  <div className="mt-2 rounded bg-destructive/10 p-3 text-sm">
                    <p className="font-medium text-destructive">Error:</p>
                    <pre className="mt-1 text-xs overflow-auto text-destructive/80">{task.result.error}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTasks.map(task => (
              <div key={task.id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{task.name}</span>
                  <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getStatusColor(task.status))}>
                    {task.status}
                  </span>
                </div>
                {task.status === 'running' && task.progress && (
                  <ProgressBar progress={task.progress.progress} message={task.progress.message} />
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Timeline View */
          <div className="p-4">
            <div className="relative space-y-8">
              {filteredTasks.map((task, index) => (
                <div key={task.id} className="relative">
                  {/* Timeline line */}
                  {index < filteredTasks.length - 1 && (
                    <div className="absolute left-4 top-8 h-full w-0.5 bg-muted" />
                  )}

                  <div className="relative flex gap-4">
                    {/* Timeline dot */}
                    <div className={cn(
                      'relative z-10 h-8 w-8 rounded-full border-4 flex items-center justify-center',
                      task.status === 'completed' && 'border-emerald-500 bg-background',
                      task.status === 'failed' && 'border-red-500 bg-background',
                      task.status === 'running' && 'border-green-500 bg-green-100',
                      ['pending', 'queued'].includes(task.status) && 'border-gray-400 bg-background',
                    )}>
                      {task.status === 'running' && (
                        <div className="h-3 w-3 animate-ping rounded-full bg-green-500" />
                      )}
                    </div>

                    {/* Task card */}
                    <div className="flex-1 rounded-lg border bg-card p-3 min-w-[300px]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{task.name}</span>
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getPriorityColor(task.priority))}>
                          {task.priority}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(task.createdAt).toLocaleString()}
                      </div>
                      {task.status === 'running' && task.progress && (
                        <ProgressBar progress={task.progress.progress} message={task.progress.message} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredTasks.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-3">
              <Filter className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-medium">No tasks found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters or wait for new tasks to be queued
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Workers Panel */}
      <div className="border-t bg-muted/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Workers</h2>
          <div className="flex items-center gap-2 text-sm">
            <span>Active: {getActiveWorkers(useTaskQueueStore()).length}</span>
            <span>Idle: {getIdleWorkers(useTaskQueueStore()).length}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {workers.map(worker => (
            <WorkerCard key={worker.workerId} worker={worker} />
          ))}
        </div>
      </div>
    </div>
  );
}
