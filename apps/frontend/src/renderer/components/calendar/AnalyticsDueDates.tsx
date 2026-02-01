import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  format,
  addDays,
  addWeeks,
  addMonths,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isToday,
  differenceInDays,
} from 'date-fns';
import {
  Calendar,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  BarChart3,
  Search,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useCalendarStore } from '../../stores/calendarStore';
import type { CalendarItem } from '../../../shared/types';

// Analytics task types
export type AnalyticsTaskType =
  | 'monthly-report'
  | 'qa-review'
  | 'performance-review'
  | 'seo-audit'
  | 'content-audit'
  | 'competitor-analysis'
  | 'email-performance'
  | 'social-metrics';

// Analytics task configuration
const ANALYTICS_TASK_CONFIG: Record<
  AnalyticsTaskType,
  {
    label: string;
    description: string;
    icon: typeof FileText;
    color: string;
    gradient: string;
    frequency: 'monthly' | 'quarterly' | 'weekly';
    estimatedHours: number;
  }
> = {
  'monthly-report': {
    label: 'Monthly Report',
    description: 'Compile and analyze monthly marketing metrics',
    icon: FileText,
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6, #60A5FA)',
    frequency: 'monthly',
    estimatedHours: 4,
  },
  'qa-review': {
    label: 'QA Review',
    description: 'Review content quality and accuracy',
    icon: CheckCircle,
    color: '#10B981',
    gradient: 'linear-gradient(135deg, #10B981, #34D399)',
    frequency: 'weekly',
    estimatedHours: 2,
  },
  'performance-review': {
    label: 'Performance Review',
    description: 'Analyze campaign and content performance',
    icon: BarChart3,
    color: '#8B5CF6',
    gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
    frequency: 'monthly',
    estimatedHours: 3,
  },
  'seo-audit': {
    label: 'SEO Audit',
    description: 'Review search engine optimization status',
    icon: Search,
    color: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
    frequency: 'monthly',
    estimatedHours: 3,
  },
  'content-audit': {
    label: 'Content Audit',
    description: 'Review and update existing content',
    icon: FileText,
    color: '#EC4899',
    gradient: 'linear-gradient(135deg, #EC4899, #F472B6)',
    frequency: 'quarterly',
    estimatedHours: 6,
  },
  'competitor-analysis': {
    label: 'Competitor Analysis',
    description: 'Analyze competitor activities and positioning',
    icon: TrendingUp,
    color: '#6366F1',
    gradient: 'linear-gradient(135deg, #6366F1, #818CF8)',
    frequency: 'monthly',
    estimatedHours: 4,
  },
  'email-performance': {
    label: 'Email Performance',
    description: 'Review email campaign metrics',
    icon: BarChart3,
    color: '#14B8A6',
    gradient: 'linear-gradient(135deg, #14B8A6, #2DD4BF)',
    frequency: 'monthly',
    estimatedHours: 2,
  },
  'social-metrics': {
    label: 'Social Metrics',
    description: 'Compile social media performance data',
    icon: BarChart3,
    color: '#F472B6',
    gradient: 'linear-gradient(135deg, #F472B6, #FB7185)',
    frequency: 'weekly',
    estimatedHours: 2,
  },
};

interface AnalyticsDueDatesProps {
  projectId: string;
}

export function AnalyticsDueDates({ projectId }: AnalyticsDueDatesProps) {
  const { calendarData, getFilteredItems, addItem, updateItem, deleteItem } = useCalendarStore();

  // UI State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'upcoming' | 'calendar'>('upcoming');
  const [selectedTaskType, setSelectedTaskType] = useState<AnalyticsTaskType | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<CalendarItem | null>(null);

  // Get analytics tasks from calendar
  const analyticsTasks = useMemo(() => {
    return getFilteredItems().filter((item) =>
      item.tags?.some((tag) =>
        Object.keys(ANALYTICS_TASK_CONFIG).includes(tag.toLowerCase())
      )
    );
  }, [getFilteredItems]);

  // Generate recurring task schedule
  const recurringSchedule = useMemo(() => {
    const schedule: {
      date: Date;
      tasks: AnalyticsTaskType[];
    }[] = [];

    // Generate next 3 months of recurring tasks
    for (let i = 0; i < 3; i++) {
      const month = addMonths(currentDate, i);
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      // Monthly tasks (due on last day of month)
      const monthlyTasks: AnalyticsTaskType[] = [
        'monthly-report',
        'performance-review',
        'seo-audit',
        'competitor-analysis',
        'email-performance',
      ];

      // Weekly tasks (every Friday)
      const weeklyTasks: AnalyticsTaskType[] = ['qa-review', 'social-metrics'];

      // Quarterly tasks (due on last day of quarter)
      const quarter = Math.floor(month.getMonth() / 3);
      const isQuarterEnd = month.getMonth() === 2 || month.getMonth() === 5 || month.getMonth() === 8 || month.getMonth() === 11;
      const quarterlyTasks = isQuarterEnd ? ['content-audit'] : [];

      // Add monthly task
      schedule.push({
        date: monthEnd,
        tasks: [...monthlyTasks, ...quarterlyTasks],
      });

      // Add weekly tasks for each week
      let weekStart = startOfWeek(monthStart);
      while (weekStart <= monthEnd) {
        const friday = addDays(weekStart, 5); // Friday
        if (friday >= monthStart && friday <= monthEnd) {
          schedule.push({
            date: friday,
            tasks: weeklyTasks,
          });
        }
        weekStart = addWeeks(weekStart, 1);
      }
    }

    return schedule.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [currentDate]);

  // Filter tasks by type
  const filteredTasks = useMemo(() => {
    if (selectedTaskType === 'all') {
      return analyticsTasks;
    }

    return analyticsTasks.filter((item) =>
      item.tags?.includes(selectedTaskType)
    );
  }, [analyticsTasks, selectedTaskType]);

  // Get upcoming tasks (next 30 days)
  const upcomingTasks = useMemo(() => {
    const thirtyDaysLater = addDays(new Date(), 30);
    return filteredTasks
      .filter((task) => {
        const taskDate = task.startDate;
        return taskDate >= new Date() && taskDate <= thirtyDaysLater;
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [filteredTasks]);

  // Get task type from calendar item
  function getTaskType(item: CalendarItem): AnalyticsTaskType | null {
    const taskTag = item.tags?.find((tag) =>
      Object.keys(ANALYTICS_TASK_CONFIG).includes(tag.toLowerCase())
    );
    return (taskTag?.toLowerCase() as AnalyticsTaskType) || null;
  }

  // Get due status
  function getDueStatus(date: Date): 'overdue' | 'due-soon' | 'upcoming' {
    const today = new Date();
    const daysUntil = differenceInDays(date, today);

    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 3) return 'due-soon';
    return 'upcoming';
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-purple-500" />
          <h2 className="text-lg font-semibold">Analytics Due Dates</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 border rounded-lg p-0.5">
            {(['upcoming', 'calendar'] as const).map((mode) => (
              <motion.button
                key={mode}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setViewMode(mode)}
                className={`
                  px-2 py-1 rounded-md text-xs font-medium capitalize transition-colors
                  ${viewMode === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}
                `}
              >
                {mode === 'upcoming' ? 'List' : 'Calendar'}
              </motion.button>
            ))}
          </div>

          {/* Add Task */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </motion.button>
        </div>
      </div>

      {/* Task Type Filter */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 overflow-x-auto">
        <button
          onClick={() => setSelectedTaskType('all')}
          className={`
            px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors
            ${selectedTaskType === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
            }
          `}
        >
          All Tasks
        </button>
        {Object.entries(ANALYTICS_TASK_CONFIG).map(([key, config]) => {
          const Icon = config.icon;

          return (
            <motion.button
              key={key}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedTaskType(key as AnalyticsTaskType)}
              className={`
                px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 whitespace-nowrap transition-colors
                ${selectedTaskType === key ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}
              `}
              style={selectedTaskType === key ? { background: config.gradient } : {}}
            >
              <Icon className="h-3 w-3" />
              {config.label}
            </motion.button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'upcoming' ? (
          <UpcomingTasksView
            tasks={upcomingTasks}
            recurringSchedule={recurringSchedule}
            selectedTaskType={selectedTaskType}
            onTaskClick={(task) => {
              setEditingTask(task);
              setShowAddModal(true);
            }}
            onCreateFromSchedule={(taskType, date) => {
              const config = ANALYTICS_TASK_CONFIG[taskType];

              addItem({
                title: config.label,
                description: config.description,
                type: 'deadline',
                status: 'draft',
                source: 'manual',
                startDate: date,
                allDay: true,
                tags: [taskType, 'analytics', 'recurring'],
              });
            }}
          />
        ) : (
          <CalendarView
            tasks={filteredTasks}
            recurringSchedule={recurringSchedule}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            onTaskClick={(task) => {
              setEditingTask(task);
              setShowAddModal(true);
            }}
          />
        )}
      </div>

      {/* Add/Edit Task Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AnalyticsTaskModal
            task={editingTask}
            onClose={() => {
              setShowAddModal(false);
              setEditingTask(null);
            }}
            onSave={(taskData) => {
              if (editingTask) {
                updateItem(editingTask.id, taskData);
              } else {
                addItem(taskData);
              }
              setShowAddModal(false);
              setEditingTask(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Upcoming Tasks View
function UpcomingTasksView({
  tasks,
  recurringSchedule,
  selectedTaskType,
  onTaskClick,
  onCreateFromSchedule,
}: {
  tasks: CalendarItem[];
  recurringSchedule: { date: Date; tasks: AnalyticsTaskType[] }[];
  selectedTaskType: AnalyticsTaskType | 'all';
  onTaskClick: (task: CalendarItem) => void;
  onCreateFromSchedule: (taskType: AnalyticsTaskType, date: Date) => void;
}) {
  // Get due status
  const getDueStatus = (date: Date) => {
    const today = new Date();
    const daysUntil = differenceInDays(date, today);

    if (daysUntil < 0) return { status: 'overdue' as const, color: 'bg-red-500', text: 'Overdue' };
    if (daysUntil === 0) return { status: 'today' as const, color: 'bg-amber-500', text: 'Today' };
    if (daysUntil <= 3) return { status: 'soon' as const, color: 'bg-amber-500', text: `${daysUntil} days` };
    return { status: 'upcoming' as const, color: 'bg-emerald-500', text: `${daysUntil} days` };
  };

  return (
    <div className="p-4 space-y-6">
      {/* Scheduled Tasks */}
      {tasks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Scheduled Tasks
          </h3>

          <div className="space-y-2">
            {tasks.map((task) => {
              const dueStatus = getDueStatus(task.startDate);
              const taskType = task.tags?.find((tag) =>
                Object.keys(ANALYTICS_TASK_CONFIG).includes(tag.toLowerCase())
              ) as AnalyticsTaskType | undefined;

              const config = taskType ? ANALYTICS_TASK_CONFIG[taskType] : null;
              const Icon = config?.icon || FileText;

              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ x: 2 }}
                  onClick={() => onTaskClick(task)}
                  className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all ${
                    dueStatus.status === 'overdue' ? 'bg-red-500/10 border-red-500/20' : 'bg-card'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded ${dueStatus.color}/10`}
                    >
                      <Icon className={`h-4 w-4 ${dueStatus.color.replace('bg-', 'text-')}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {task.description}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <div className={`px-1.5 py-0.5 rounded text-xs ${dueStatus.color}/20 ${dueStatus.color.replace('bg-', 'text-')}`}>
                          {dueStatus.text}
                        </div>
                        {config && (
                          <div className="text-xs text-muted-foreground">
                            {config.estimatedHours}h estimated
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {format(task.startDate, 'MMM d, yyyy')}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recurring Schedule */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-purple-500" />
          Recurring Schedule (Next 3 Months)
        </h3>

        <div className="space-y-3">
          {recurringSchedule.slice(0, 10).map((scheduleItem) => {
            const dueStatus = getDueStatus(scheduleItem.date);

            return (
              <div key={scheduleItem.date.toISOString()} className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">
                    {format(scheduleItem.date, 'EEEE, MMMM d, yyyy')}
                  </div>
                  <div className={`px-2 py-0.5 rounded text-xs ${dueStatus.color}/20 ${dueStatus.color.replace('bg-', 'text-')}`}>
                    {dueStatus.text}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {scheduleItem.tasks
                    .filter((taskType) => selectedTaskType === 'all' || taskType === selectedTaskType)
                    .map((taskType) => {
                      const config = ANALYTICS_TASK_CONFIG[taskType];
                      const Icon = config.icon;

                      return (
                        <motion.button
                          key={taskType}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => onCreateFromSchedule(taskType, scheduleItem.date)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-background hover:bg-accent text-xs"
                        >
                          <Plus className="h-3 w-3" />
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </motion.button>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Calendar View
function CalendarView({
  tasks,
  recurringSchedule,
  currentDate,
  onDateChange,
  onTaskClick,
}: {
  tasks: CalendarItem[];
  recurringSchedule: { date: Date; tasks: AnalyticsTaskType[] }[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onTaskClick: (task: CalendarItem) => void;
}) {
  // Simple month calendar view
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = Array.from({ length: monthEnd.getDate() }, (_, i) => addDays(monthStart, i));

  // Get tasks for each day
  const getTasksForDay = (date: Date) => {
    return tasks.filter((task) => isSameDay(task.startDate, date));
  };

  // Get recurring tasks for day
  const getRecurringForDay = (date: Date) => {
    return recurringSchedule.find((s) => isSameDay(s.date, date))?.tasks || [];
  };

  return (
    <div className="p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onDateChange(addMonths(currentDate, -1))}
          className="p-2 rounded-lg hover:bg-accent"
        >
          <ChevronLeft className="h-5 w-5" />
        </motion.button>

        <div className="text-lg font-semibold">
          {format(currentDate, 'MMMM yyyy')}
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onDateChange(addMonths(currentDate, 1))}
          className="p-2 rounded-lg hover:bg-accent"
        >
          <ChevronRight className="h-5 w-5" />
        </motion.button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {days.map((date) => {
          const dayTasks = getTasksForDay(date);
          const recurringTasks = getRecurringForDay(date);
          const isTodayDate = isToday(date);

          return (
            <div
              key={date.toISOString()}
              className={`
                aspect-square p-1 border rounded-lg cursor-pointer hover:bg-accent transition-colors
                ${isTodayDate ? 'bg-primary/10 border-primary' : 'bg-muted/10'}
              `}
            >
              <div className={`text-xs font-medium mb-1 ${isTodayDate ? 'text-primary' : ''}`}>
                {format(date, 'd')}
              </div>

              {/* Task indicators */}
              {(dayTasks.length > 0 || recurringTasks.length > 0) && (
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick(task);
                      }}
                      className="text-xs p-0.5 rounded bg-blue-500 text-white truncate"
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  ))}

                  {recurringTasks.slice(0, 2 - dayTasks.length).map((taskType) => {
                    const config = ANALYTICS_TASK_CONFIG[taskType];
                    return (
                      <div
                        key={taskType}
                        className="text-xs p-0.5 rounded truncate text-white"
                        style={{ background: config.gradient }}
                        title={config.label}
                      >
                        {config.label}
                      </div>
                    );
                  })}

                  {(dayTasks.length + recurringTasks.length > 2) && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{dayTasks.length + recurringTasks.length - 2} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Analytics Task Modal
function AnalyticsTaskModal({
  task,
  onClose,
  onSave,
}: {
  task: CalendarItem | null;
  onClose: () => void;
  onSave: (taskData: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [taskType, setTaskType] = useState<AnalyticsTaskType>(
    task?.tags?.find((tag) => Object.keys(ANALYTICS_TASK_CONFIG).includes(tag.toLowerCase())) as AnalyticsTaskType || 'monthly-report'
  );
  const [dueDate, setDueDate] = useState(
    task?.startDate ? format(task.startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [status, setStatus] = useState(task?.status || 'draft');

  const handleSave = () => {
    if (!title.trim()) return;

    const config = ANALYTICS_TASK_CONFIG[taskType];

    const taskData: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'> = {
      title: title.trim(),
      description: description.trim() || undefined,
      type: 'deadline',
      status,
      source: 'manual',
      startDate: new Date(dueDate),
      allDay: true,
      tags: [taskType, 'analytics'],
    };

    onSave(taskData);
  };

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
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {task ? 'Edit Analytics Task' : 'Add Analytics Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Task Type */}
          <div>
            <label className="text-sm font-medium mb-1 block">Task Type</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as AnalyticsTaskType)}
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {Object.entries(ANALYTICS_TASK_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
            {taskType && (
              <p className="text-xs text-muted-foreground mt-1">
                {ANALYTICS_TASK_CONFIG[taskType].estimatedHours}h estimated • {ANALYTICS_TASK_CONFIG[taskType].frequency}
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="text-sm font-medium mb-1 block">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium mb-1 block">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CalendarItem['status'])}
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Completed</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1 block">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add task description..."
              className="w-full min-h-20 px-3 py-2 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
            >
              {task ? 'Save Changes' : 'Add Task'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-muted font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
