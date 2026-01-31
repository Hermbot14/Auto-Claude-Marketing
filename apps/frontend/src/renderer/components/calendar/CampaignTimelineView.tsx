import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addDays,
  addMonths,
  differenceInDays,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import {
  Megaphone,
  Flag,
  Link2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Users,
  Target,
  ChevronDown,
  ChevronRight,
  Plus,
  Settings,
} from 'lucide-react';
import { useCalendarStore } from '../../../stores/calendarStore';
import { CALENDAR_COLORS } from '../../../shared/constants';
import type { CalendarItem } from '../../../shared/types';

// Campaign health status
export type CampaignHealth = 'on-track' | 'at-risk' | 'off-track' | 'completed';

// Campaign milestone type
export interface CampaignMilestone {
  id: string;
  title: string;
  date: Date;
  status: 'pending' | 'in-progress' | 'completed';
  type: 'launch' | 'review' | 'deadline' | 'custom';
}

// Campaign dependency
export interface CampaignDependency {
  from: string; // campaign ID
  to: string; // campaign ID
  type: 'blocks' | 'related' | 'follows';
}

// Health indicator config
const HEALTH_CONFIG: Record<
  CampaignHealth,
  { label: string; color: string; bgClass: string; icon: typeof TrendingUp }
> = {
  'on-track': { label: 'On Track', color: '#10B981', bgClass: 'bg-emerald-500/20', icon: TrendingUp },
  'at-risk': { label: 'At Risk', color: '#F59E0B', bgClass: 'bg-amber-500/20', icon: AlertTriangle },
  'off-track': { label: 'Off Track', color: '#EF4444', bgClass: 'bg-red-500/20', icon: TrendingDown },
  completed: { label: 'Completed', color: '#6366F1', bgClass: 'bg-indigo-500/20', icon: Flag },
};

interface CampaignTimelineViewProps {
  projectId: string;
  onCampaignEdit?: (campaign: CalendarItem) => void;
  onMilestoneAdd?: (campaignId: string, milestone: Omit<CampaignMilestone, 'id'>) => void;
}

export function CampaignTimelineView({
  projectId,
  onCampaignEdit,
  onMilestoneAdd,
}: CampaignTimelineViewProps) {
  const { calendarData, getFilteredItems, updateItem, addItem } = useCalendarStore();

  // UI State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState<'month' | 'quarter' | 'year'>('quarter');
  const [selectedCampaign, setSelectedCampaign] = useState<CalendarItem | null>(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [showDependencies, setShowDependencies] = useState(true);
  const [showMilestones, setShowMilestones] = useState(true);
  const [showBudget, setShowBudget] = useState(false);

  // Get campaign items
  const campaigns = useMemo(() => {
    return getFilteredItems().filter((item) => item.type === 'campaign');
  }, [getFilteredItems]);

  // Calculate campaign health based on various factors
  const calculateCampaignHealth = (campaign: CalendarItem): CampaignHealth => {
    if (campaign.status === 'published') return 'completed';

    const now = new Date();
    const daysUntilStart = differenceInDays(campaign.startDate, now);
    const daysUntilEnd = campaign.endDate ? differenceInDays(campaign.endDate, now) : 0;

    // Campaign hasn't started yet
    if (daysUntilStart > 0) {
      // Check if preparation is adequate (simplified logic)
      return daysUntilStart > 7 ? 'on-track' : 'at-risk';
    }

    // Campaign is in progress
    if (campaign.endDate && daysUntilEnd > 0) {
      // Check if we're more than halfway through time-wise
      const totalDuration = differenceInDays(campaign.endDate, campaign.startDate);
      const elapsed = differenceInDays(now, campaign.startDate);
      const progressPercent = (elapsed / totalDuration) * 100;

      // Simple health logic based on status and time progress
      if (campaign.status === 'scheduled' && progressPercent > 75) {
        return 'at-risk';
      }
      return 'on-track';
    }

    // Campaign has ended but not marked as complete
    if (campaign.endDate && daysUntilEnd < 0) {
      return 'off-track';
    }

    return 'on-track';
  };

  // Get timeline range based on zoom level
  const getTimelineRange = () => {
    const monthsToShow = zoomLevel === 'year' ? 12 : zoomLevel === 'quarter' ? 3 : 1;
    const start = startOfMonth(currentDate);
    const end = endOfMonth(addMonths(start, monthsToShow - 1));

    return { start, end, months: eachMonthOfInterval({ start, end }) };
  };

  // Group campaigns by parent/child relationships
  const groupedCampaigns = useMemo(() => {
    const groups: Record<string, CalendarItem[]> = {};
    const rootCampaigns: CalendarItem[] = [];

    campaigns.forEach((campaign) => {
      const parentTag = campaign.tags?.find((t) => t.startsWith('parent:'));
      if (parentTag) {
        const parentId = parentTag.replace('parent:', '');
        if (!groups[parentId]) {
          groups[parentId] = [];
        }
        groups[parentId].push(campaign);
      } else {
        rootCampaigns.push(campaign);
      }
    });

    return { groups, rootCampaigns };
  }, [campaigns]);

  // Toggle campaign expansion
  const toggleCampaignExpansion = (campaignId: string) => {
    const newExpanded = new Set(expandedCampaigns);
    if (newExpanded.has(campaignId)) {
      newExpanded.delete(campaignId);
    } else {
      newExpanded.add(campaignId);
    }
    setExpandedCampaigns(newExpanded);
  };

  // Get campaign position on timeline
  const getCampaignStyle = (campaign: CalendarItem) => {
    const { start, end } = getTimelineRange();
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const campaignStart = new Date(Math.max(campaign.startDate.getTime(), start.getTime()));
    const campaignEnd = new Date(Math.min((campaign.endDate || campaign.startDate).getTime(), end.getTime()));

    const startOffset = Math.ceil((campaignStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((campaignEnd.getTime() - campaignStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
      left: `${(startOffset / totalDays) * 100}%`,
      width: `${(duration / totalDays) * 100}%`,
    };
  };

  // Generate sample milestones for campaigns
  const generateMilestones = (campaign: CalendarItem): CampaignMilestone[] => {
    if (!campaign.endDate) return [];

    const milestones: CampaignMilestone[] = [
      {
        id: `${campaign.id}-start`,
        title: 'Campaign Start',
        date: campaign.startDate,
        status: differenceInDays(new Date(), campaign.startDate) > 0 ? 'completed' : 'pending',
        type: 'launch',
      },
      {
        id: `${campaign.id}-mid`,
        title: 'Mid-Campaign Review',
        date: new Date((campaign.startDate.getTime() + campaign.endDate.getTime()) / 2),
        status: 'pending',
        type: 'review',
      },
      {
        id: `${campaign.id}-end`,
        title: 'Campaign End',
        date: campaign.endDate,
        status: 'pending',
        type: 'deadline',
      },
    ];

    return milestones;
  };

  // Get budget visualization data
  const getBudgetData = (campaign: CalendarItem) => {
    // Extract budget from notes or tags
    const budgetTag = campaign.tags?.find((t) => t.startsWith('budget:'));
    const spentTag = campaign.tags?.find((t) => t.startsWith('spent:'));

    const budget = budgetTag ? parseFloat(budgetTag.replace('budget:', '')) : 0;
    const spent = spentTag ? parseFloat(spentTag.replace('spent:', '')) : 0;

    return { budget, spent, remaining: budget - spent };
  };

  const { start, end, months } = getTimelineRange();

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-purple-500" />
            Campaign Timeline
          </h2>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentDate(addMonths(currentDate, -1))}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </motion.button>
            <span className="text-sm font-medium px-2">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentDate(new Date())}
              className="px-2 py-1 rounded-lg hover:bg-accent transition-colors text-xs font-medium"
            >
              Today
            </motion.button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggles */}
          <div className="flex items-center gap-1 border rounded-lg p-0.5">
            {(['month', 'quarter', 'year'] as const).map((level) => (
              <motion.button
                key={level}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setZoomLevel(level)}
                className={`
                  px-2 py-1 rounded-md text-xs font-medium capitalize transition-colors
                  ${zoomLevel === level ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}
                `}
              >
                {level}
              </motion.button>
            ))}
          </div>

          {/* Display options */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowDependencies(!showDependencies)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-sm ${
              showDependencies ? 'bg-accent' : 'hover:bg-accent'
            }`}
          >
            <Link2 className="h-4 w-4" />
            Dependencies
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowMilestones(!showMilestones)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-sm ${
              showMilestones ? 'bg-accent' : 'hover:bg-accent'
            }`}
          >
            <Flag className="h-4 w-4" />
            Milestones
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowBudget(!showBudget)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-sm ${
              showBudget ? 'bg-accent' : 'hover:bg-accent'
            }`}
          >
            <DollarSign className="h-4 w-4" />
            Budget
          </motion.button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/30 text-xs">
        <span className="font-medium text-muted-foreground">Health:</span>
        {Object.entries(HEALTH_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <div key={key} className="flex items-center gap-1">
              <Icon className="h-3 w-3" style={{ color: config.color }} />
              <span>{config.label}</span>
            </div>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          {/* Timeline header with months */}
          <div className="flex border-b bg-muted/30">
            {/* Campaign labels column */}
            <div className="w-64 flex-shrink-0 p-2 border-r">
              <span className="text-sm font-medium text-muted-foreground">Campaigns</span>
            </div>

            {/* Month columns */}
            <div className="flex-1 flex">
              {months.map((month, index) => (
                <div
                  key={index}
                  className="flex-1 min-w-32 p-2 text-center border-r last:border-r-0"
                >
                  <div className="text-sm font-medium">
                    {format(month, 'MMM')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(month, 'yyyy')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Campaign rows */}
          <div className="relative">
            {/* Today indicator */}
            {isToday(currentDate) && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                style={{
                  left: `calc(16rem + ${(differenceInDays(currentDate, start) / differenceInDays(end, start)) * 100}%)`,
                }}
              />
            )}

            {groupedCampaigns.rootCampaigns.map((campaign, index) => {
              const health = calculateCampaignHealth(campaign);
              const healthConfig = HEALTH_CONFIG[health];
              const HealthIcon = healthConfig.icon;
              const isExpanded = expandedCampaigns.has(campaign.id);
              const subCampaigns = groupedCampaigns.groups[campaign.id] || [];
              const milestones = generateMilestones(campaign);
              const budget = getBudgetData(campaign);

              return (
                <div key={campaign.id}>
                  {/* Campaign row */}
                  <div
                    className={`flex border-b hover:bg-muted/30 transition-colors ${
                      selectedCampaign?.id === campaign.id ? 'bg-muted/50' : ''
                    }`}
                  >
                    {/* Campaign label */}
                    <div className="w-64 flex-shrink-0 p-2 border-r">
                      <div className="flex items-center gap-2">
                        {subCampaigns.length > 0 && (
                          <button
                            onClick={() => toggleCampaignExpansion(campaign.id)}
                            className="p-0.5 rounded hover:bg-accent"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => setSelectedCampaign(campaign)}
                        >
                          <div className="text-sm font-medium truncate">{campaign.title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${healthConfig.bgClass}`}
                              style={{ color: healthConfig.color }}
                            >
                              <HealthIcon className="h-3 w-3" />
                              <span>{healthConfig.label}</span>
                            </div>
                            {showBudget && budget.budget > 0 && (
                              <div className="text-xs text-muted-foreground">
                                ${budget.spent.toLocaleString()} / ${budget.budget.toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="flex-1 relative p-2">
                      {/* Campaign bar */}
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => setSelectedCampaign(campaign)}
                        className="absolute h-8 rounded-lg cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                        style={{
                          ...getCampaignStyle(campaign),
                          top: '4px',
                          background: CALENDAR_COLORS.campaign.gradient,
                        }}
                      >
                        <div className="flex items-center h-full px-2 text-white text-xs font-medium truncate">
                          <Megaphone className="h-3 w-3 mr-1 flex-shrink-0" />
                          {campaign.title}
                        </div>
                      </motion.div>

                      {/* Milestones */}
                      {showMilestones && isExpanded && milestones.map((milestone) => {
                        const milestoneStyle = {
                          left: `${(differenceInDays(milestone.date, start) / differenceInDays(end, start)) * 100}%`,
                        };

                        return (
                          <div
                            key={milestone.id}
                            className="absolute top-12 transform -translate-x-1/2 group"
                            style={milestoneStyle}
                          >
                            <motion.div
                              whileHover={{ scale: 1.2 }}
                              className={`
                                w-3 h-3 rounded-full border-2 border-background cursor-pointer
                                ${milestone.status === 'completed' ? 'bg-emerald-500' :
                                  milestone.status === 'in-progress' ? 'bg-amber-500' : 'bg-gray-400'}
                              `}
                              title={milestone.title}
                            />
                            <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-popover text-xs rounded shadow-lg whitespace-nowrap">
                              {milestone.title}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sub-campaigns (expanded) */}
                  {isExpanded && subCampaigns.length > 0 && (
                    <div className="bg-muted/10">
                      {subCampaigns.map((subCampaign) => {
                        const subHealth = calculateCampaignHealth(subCampaign);
                        const subHealthConfig = HEALTH_CONFIG[subHealth];

                        return (
                          <div
                            key={subCampaign.id}
                            className="flex border-b border-dashed hover:bg-muted/20"
                          >
                            <div className="w-64 flex-shrink-0 p-2 border-r pl-12">
                              <div className="text-sm truncate">{subCampaign.title}</div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <div
                                  className={`px-1.5 py-0.5 rounded text-xs ${subHealthConfig.bgClass}`}
                                  style={{ color: subHealthConfig.color }}
                                >
                                  {subHealthConfig.label}
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 p-2">
                              <motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.02 }}
                                onClick={() => setSelectedCampaign(subCampaign)}
                                className="absolute h-6 rounded cursor-pointer shadow-sm"
                                style={{
                                  ...getCampaignStyle(subCampaign),
                                  top: '4px',
                                  background: CALENDAR_COLORS.campaign.gradient,
                                  opacity: 0.7,
                                }}
                              >
                                <div className="flex items-center h-full px-2 text-white text-xs truncate">
                                  {subCampaign.title}
                                </div>
                              </motion.div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Campaign Detail Panel */}
      <AnimatePresence>
        {selectedCampaign && (
          <CampaignDetailPanel
            campaign={selectedCampaign}
            health={calculateCampaignHealth(selectedCampaign)}
            milestones={generateMilestones(selectedCampaign)}
            budget={getBudgetData(selectedCampaign)}
            onClose={() => setSelectedCampaign(null)}
            onUpdate={(updates) => {
              updateItem(selectedCampaign.id, updates);
              setSelectedCampaign({ ...selectedCampaign, ...updates });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Campaign Detail Panel
function CampaignDetailPanel({
  campaign,
  health,
  milestones,
  budget,
  onClose,
  onUpdate,
}: {
  campaign: CalendarItem;
  health: CampaignHealth;
  milestones: CampaignMilestone[];
  budget: { budget: number; spent: number; remaining: number };
  onClose: () => void;
  onUpdate: (updates: Partial<CalendarItem>) => void;
}) {
  const healthConfig = HEALTH_CONFIG[health];
  const HealthIcon = healthConfig.icon;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute right-0 top-0 bottom-0 w-80 bg-card border-l shadow-xl overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold truncate">{campaign.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-sm ${healthConfig.bgClass}`}
                style={{ color: healthConfig.color }}
              >
                <HealthIcon className="h-4 w-4" />
                <span>{healthConfig.label}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-accent flex-shrink-0"
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Description */}
        {campaign.description && (
          <div>
            <h4 className="text-sm font-medium mb-1">Description</h4>
            <p className="text-sm text-muted-foreground">{campaign.description}</p>
          </div>
        )}

        {/* Dates */}
        <div>
          <h4 className="text-sm font-medium mb-2">Timeline</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start:</span>
              <span>{format(campaign.startDate, 'MMM d, yyyy')}</span>
            </div>
            {campaign.endDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">End:</span>
                <span>{format(campaign.endDate, 'MMM d, yyyy')}</span>
              </div>
            )}
            {campaign.endDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span>{differenceInDays(campaign.endDate, campaign.startDate)} days</span>
              </div>
            )}
          </div>
        </div>

        {/* Budget */}
        {budget.budget > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Budget</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Budget:</span>
                <span className="font-medium">${budget.budget.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Spent:</span>
                <span className="font-medium">${budget.spent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining:</span>
                <span
                  className={`font-medium ${
                    budget.remaining < 0 ? 'text-destructive' : 'text-emerald-600'
                  }`}
                >
                  ${budget.remaining.toLocaleString()}
                </span>
              </div>
              {/* Budget progress bar */}
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    budget.spent > budget.budget ? 'bg-destructive' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min((budget.spent / budget.budget) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Milestones</h4>
            <div className="space-y-2">
              {milestones.map((milestone) => {
                const isCompleted = milestone.status === 'completed';
                const isPast = milestone.date < new Date();

                return (
                  <div
                    key={milestone.id}
                    className={`flex items-start gap-2 p-2 rounded-lg border ${
                      isCompleted ? 'bg-emerald-500/10 border-emerald-500/20' :
                      isPast ? 'bg-amber-500/10 border-amber-500/20' :
                      'bg-muted/30'
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        isCompleted ? 'bg-emerald-500' :
                        isPast ? 'bg-amber-500' :
                        'bg-gray-400'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{milestone.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(milestone.date, 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tags */}
        {campaign.tags && campaign.tags.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Tags</h4>
            <div className="flex flex-wrap gap-1">
              {campaign.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 rounded bg-muted text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
