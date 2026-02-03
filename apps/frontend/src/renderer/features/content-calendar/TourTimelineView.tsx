import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  eachMonthOfInterval,
  eachQuarterOfInterval,
  eachYearOfInterval,
  differenceInDays,
  differenceInMonths,
  differenceInYears,
  isToday,
  isSameMonth,
  isSameDay,
  startOfYear,
  endOfYear,
  intervalToDuration,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  ExternalLink,
  Filter,
  X,
  Info,
  Trophy,
  Music,
  Sparkles,
  GalleryHorizontal,
  Medal,
  Flame,
  Clock,
  TrendingUp,
  CheckCircle2,
  Circle,
  AlertCircle,
} from 'lucide-react';

import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import {
  TOUR_CATEGORY_CONFIG,
  MOCK_TOUR_CAMPAIGNS,
  type TourCampaign,
  type TourCampaignCategory,
} from '../../data/mockTourCampaigns';

/**
 * Timeline zoom levels
 */
export type TimelineZoomLevel = 'month' | 'quarter' | 'year';

/**
 * Timeline view filter state
 */
interface TimelineFilters {
  categories: TourCampaignCategory[];
  searchQuery: string;
  year?: number;
}

/**
 * Tour Timeline View Props
 */
interface TourTimelineViewProps {
  campaigns?: TourCampaign[];
  onCampaignClick?: (campaign: TourCampaign) => void;
  initialZoomLevel?: TimelineZoomLevel;
  showFilters?: boolean;
}

/**
 * Tour Timeline View Component
 * Horizontal scrolling timeline for Tour campaigns
 */
export function TourTimelineView({
  campaigns = MOCK_TOUR_CAMPAIGNS,
  onCampaignClick,
  initialZoomLevel = 'quarter',
  showFilters = true,
}: TourTimelineViewProps): JSX.Element {
  const { t } = useTranslation(['contentCalendar', 'common']);

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState<TimelineZoomLevel>(initialZoomLevel);
  const [selectedCampaign, setSelectedCampaign] = useState<TourCampaign | null>(null);
  const [filters, setFilters] = useState<TimelineFilters>({
    categories: [],
    searchQuery: '',
  });
  const [hoveredCampaign, setHoveredCampaign] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  // Live countdown ticker - updates every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  /**
   * Calculate countdown text for a campaign
   * Returns human-readable countdown (e.g., "In 2 days", "In 3 months")
   */
  const getCountdown = useCallback((campaign: TourCampaign): { text: string; isUrgent: boolean } => {
    const eventDate = campaign.scheduledDate;
    if (!eventDate) return { text: '', isUrgent: false };

    const daysUntil = differenceInDays(eventDate, now);
    const absoluteDays = Math.abs(daysUntil);

    // Past event
    if (daysUntil < 0) {
      if (absoluteDays === 0) return { text: t('contentCalendar:countdown.endedToday', 'Ended today'), isUrgent: false };
      if (absoluteDays === 1) return { text: t('contentCalendar:countdown.endedYesterday', 'Ended yesterday'), isUrgent: false };
      if (absoluteDays < 7) return { text: t('contentCalendar:countdown.endedDaysAgo', 'Ended {{days}} days ago', { days: absoluteDays }), isUrgent: false };
      if (absoluteDays < 30) return { text: t('contentCalendar:countdown.endedWeeksAgo', 'Ended {{weeks}} weeks ago', { weeks: Math.floor(absoluteDays / 7) }), isUrgent: false };
      return { text: t('contentCalendar:countdown.endedMonthsAgo', 'Ended {{months}} months ago', { months: Math.floor(absoluteDays / 30) }), isUrgent: false };
    }

    // Today
    if (daysUntil === 0) return { text: t('contentCalendar:countdown.today', 'Today!'), isUrgent: true };
    // Tomorrow
    if (daysUntil === 1) return { text: t('contentCalendar:countdown.tomorrow', 'Tomorrow'), isUrgent: true };
    // This week
    if (daysUntil <= 7) return { text: t('contentCalendar:countdown.inDays', 'In {{days}} days', { days: daysUntil }), isUrgent: true };
    // This month
    if (daysUntil <= 30) return { text: t('contentCalendar:countdown.inWeeks', 'In {{weeks}} weeks', { weeks: Math.floor(daysUntil / 7) }), isUrgent: false };
    // This year
    if (daysUntil <= 365) return { text: t('contentCalendar:countdown.inMonths', 'In {{months}} months', { months: Math.floor(daysUntil / 30) }), isUrgent: false };
    // Over a year
    const years = Math.floor(daysUntil / 365);
    const remainingDays = daysUntil % 365;
    if (remainingDays < 30) return { text: t('contentCalendar:countdown.inYears', 'In {{years}} years', { years }), isUrgent: false };
    return { text: t('contentCalendar:countdown.inYearsAndMonths', 'In {{years}}y {{months}}m', { years, months: Math.floor(remainingDays / 30) }), isUrgent: false };
  }, [now, t]);

  // Get time periods based on zoom level
  const timePeriods = useMemo(() => {
    const periods: Date[] = [];
    const baseDate = startOfMonth(currentDate);

    switch (zoomLevel) {
      case 'month':
        // Show 12 months
        for (let i = -1; i < 11; i++) {
          periods.push(addMonths(baseDate, i));
        }
        break;
      case 'quarter':
        // Show 8 quarters (2 years)
        const quarters = eachQuarterOfInterval({
          start: addMonths(baseDate, -3),
          end: addMonths(baseDate, 21),
        });
        periods.push(...quarters.map((q) => startOfMonth(q)));
        break;
      case 'year':
        // Show 5 years
        const years = eachYearOfInterval({
          start: startOfMonth(addMonths(baseDate, -12)),
          end: addMonths(baseDate, 48),
        });
        periods.push(...years.map((y) => startOfYear(y)));
        break;
    }

    return periods;
  }, [currentDate, zoomLevel]);

  // Get timeline range
  const timelineRange = useMemo(() => {
    if (timePeriods.length === 0) {
      return { start: new Date(), end: new Date() };
    }
    const start = timePeriods[0];
    const end = timePeriods[timePeriods.length - 1];
    return { start, end };
  }, [timePeriods]);

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      // Category filter
      if (filters.categories.length > 0 && !filters.categories.includes(campaign.category)) {
        return false;
      }

      // Search filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesTitle = campaign.title.toLowerCase().includes(query);
        const matchesDescription = campaign.description?.toLowerCase().includes(query);
        const matchesLocation = campaign.location?.toLowerCase().includes(query);
        const matchesTags = campaign.tags?.some((tag) => tag.toLowerCase().includes(query));
        if (!matchesTitle && !matchesDescription && !matchesLocation && !matchesTags) {
          return false;
        }
      }

      // Year filter
      if (filters.year) {
        const campaignYear = campaign.scheduledDate?.getFullYear() || new Date().getFullYear();
        if (campaignYear !== filters.year) {
          return false;
        }
      }

      return true;
    });
  }, [campaigns, filters]);

  // Group campaigns by row to prevent overlapping
  const campaignRows = useMemo(() => {
    const rows: TourCampaign[][] = [];

    const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
      const dateA = a.scheduledDate?.getTime() || 0;
      const dateB = b.scheduledDate?.getTime() || 0;
      return dateA - dateB;
    });

    sortedCampaigns.forEach((campaign) => {
      let placed = false;
      const campaignStart = campaign.scheduledDate || new Date();
      const campaignEnd = campaign.dueDate || campaignStart;

      for (const row of rows) {
        let canPlace = true;
        for (const existingCampaign of row) {
          const existingStart = existingCampaign.scheduledDate || new Date();
          const existingEnd = existingCampaign.dueDate || existingStart;

          // Check for overlap
          if (campaignStart <= existingEnd && campaignEnd >= existingStart) {
            canPlace = false;
            break;
          }
        }

        if (canPlace) {
          row.push(campaign);
          placed = true;
          break;
        }
      }

      if (!placed) {
        rows.push([campaign]);
      }
    });

    return rows;
  }, [filteredCampaigns]);

  // Calculate campaign position as percentage of timeline
  const getCampaignPosition = useCallback(
    (campaign: TourCampaign) => {
      const { start, end } = timelineRange;
      const campaignStart = campaign.scheduledDate || new Date();
      const campaignEnd = campaign.dueDate || campaignStart;

      // Calculate total timeline duration in days
      const totalDays = Math.max(differenceInDays(end, start), 1);

      // Calculate campaign start offset in days
      const startOffset = Math.max(differenceInDays(campaignStart, start), 0);

      // Calculate campaign duration in days
      const campaignDuration = Math.max(differenceInDays(campaignEnd, campaignStart), 1);

      // Convert to percentages
      const leftPercent = (startOffset / totalDays) * 100;
      const widthPercent = Math.min((campaignDuration / totalDays) * 100, 100 - leftPercent);

      return {
        left: `${leftPercent}%`,
        width: `${Math.max(widthPercent, 0.5)}%`, // Minimum 0.5% width for visibility
      };
    },
    [timelineRange]
  );

  // Navigation handlers
  const navigatePrevious = useCallback(() => {
    const months = zoomLevel === 'year' ? 12 : zoomLevel === 'quarter' ? 3 : 1;
    setCurrentDate(addMonths(currentDate, -months));
  }, [currentDate, zoomLevel]);

  const navigateNext = useCallback(() => {
    const months = zoomLevel === 'year' ? 12 : zoomLevel === 'quarter' ? 3 : 1;
    setCurrentDate(addMonths(currentDate, months));
  }, [currentDate, zoomLevel]);

  const navigateToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Toggle category filter
  const toggleCategoryFilter = useCallback((category: TourCampaignCategory) => {
    setFilters((prev) => {
      const newCategories = prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category];
      return { ...prev, categories: newCategories };
    });
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({ categories: [], searchQuery: '' });
  }, []);

  // Get category icon
  const getCategoryIcon = (category: TourCampaignCategory) => {
    const icons = {
      'sports-event': Trophy,
      'concert-tour': Music,
      'festival': Sparkles,
      'exhibition': GalleryHorizontal,
      'championship': Medal,
      'olympics': Flame,
    };
    return icons[category] || Calendar;
  };

  // Get category background color
  const getCategoryColor = (category: TourCampaignCategory) => {
    const colors = {
      'sports-event': 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',      // Blue
      'concert-tour': 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',     // Purple
      'festival': 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',        // Pink
      'exhibition': 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',      // Orange
      'championship': 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',     // Gold/Yellow
      'olympics': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',        // Emerald/Green
    };
    return colors[category] || 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
  };

  // Get category border color
  const getCategoryBorderColor = (category: TourCampaignCategory) => {
    const colors = {
      'sports-event': '#1d4ed8',
      'concert-tour': '#7c3aed',
      'festival': '#be185d',
      'exhibition': '#c2410c',
      'championship': '#a16207',
      'olympics': '#047857',
    };
    return colors[category] || '#374151';
  };

  // Get category text color
  const getCategoryTextColor = (category: TourCampaignCategory) => {
    return '#ffffff'; // Always white text for contrast with gradient backgrounds
  };

  // Get period label
  const getPeriodLabel = (period: Date) => {
    switch (zoomLevel) {
      case 'month':
        return format(period, 'MMM yyyy');
      case 'quarter':
        return `Q${Math.floor(period.getMonth() / 3) + 1} ${period.getFullYear()}`;
      case 'year':
        return period.getFullYear().toString();
      default:
        return format(period, 'MMM yyyy');
    }
  };

  // Get available years from campaigns
  const availableYears = useMemo(() => {
    const years = new Set(
      campaigns.map((c) => c.scheduledDate?.getFullYear() || new Date().getFullYear())
    );
    return Array.from(years).sort();
  }, [campaigns]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-500" />
            {t('contentCalendar:tourTimeline.title', 'Tour Timeline')}
          </h2>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={navigatePrevious}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label={t('contentCalendar:navigation.previous', 'Previous')}
            >
              <ChevronLeft className="h-4 w-4" />
            </motion.button>
            <span className="text-sm font-medium px-2 min-w-32 text-center">
              {zoomLevel === 'year'
                ? currentDate.getFullYear().toString()
                : format(currentDate, 'MMMM yyyy')}
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={navigateNext}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label={t('contentCalendar:navigation.next', 'Next')}
            >
              <ChevronRight className="h-4 w-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={navigateToday}
              className="px-2 py-1 rounded-lg hover:bg-accent transition-colors text-xs font-medium"
            >
              {t('contentCalendar:navigation.today', 'Today')}
            </motion.button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Category Legend */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">Categories:</span>
            {(Object.keys(TOUR_CATEGORY_CONFIG) as TourCampaignCategory[]).map((category) => {
              const config = TOUR_CATEGORY_CONFIG[category];
              const CategoryIcon = getCategoryIcon(category);

              return (
                <div
                  key={category}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-white font-medium"
                  style={{
                    background: getCategoryColor(category),
                    border: `1px solid ${getCategoryBorderColor(category)}`,
                  }}
                  title={config.label}
                >
                  <CategoryIcon className="h-3 w-3" />
                  <span className="max-w-20 truncate">{config.label}</span>
                </div>
              );
            })}
          </div>

          <div className="w-px h-8 bg-border" />

          {/* Zoom level controls */}
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

          {/* Filters toggle */}
          {showFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({ ...filters, categories: [] })}
              className="gap-1"
            >
              <Filter className="h-4 w-4" />
              {t('contentCalendar:filters.title', 'Filters')}
              {filters.categories.length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1">
                  {filters.categories.length}
                </Badge>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Category Filters */}
      {showFilters && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 overflow-x-auto">
          <span className="text-sm font-medium text-muted-foreground flex-shrink-0">
            {t('contentCalendar:filters.categories', 'Categories')}:
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {(Object.keys(TOUR_CATEGORY_CONFIG) as TourCampaignCategory[]).map((category) => {
              const config = TOUR_CATEGORY_CONFIG[category];
              const CategoryIcon = getCategoryIcon(category);
              const isActive = filters.categories.includes(category);

              return (
                <motion.button
                  key={category}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleCategoryFilter(category)}
                  className={`
                    flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                    transition-colors flex-shrink-0
                    ${isActive ? config.bgColor + ' ' + config.color : 'hover:bg-accent'}
                  `}
                >
                  <CategoryIcon className="h-3 w-3" />
                  {config.label}
                </motion.button>
              );
            })}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-48">
            <input
              type="text"
              placeholder={t('contentCalendar:filters.searchPlaceholder', 'Search...')}
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-full px-3 py-1 text-sm rounded-md border border-input bg-background"
            />
          </div>

          {/* Year filter */}
          <Select
            value={filters.year?.toString() || 'all'}
            onValueChange={(value) =>
              setFilters({ ...filters, year: value === 'all' ? undefined : parseInt(value) })
            }
          >
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('contentCalendar:filters.allYears', 'All Years')}</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear filters */}
          {(filters.categories.length > 0 || filters.searchQuery || filters.year) && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium hover:bg-accent transition-colors"
            >
              <X className="h-3 w-3" />
              {t('contentCalendar:filters.clearFilters', 'Clear')}
            </motion.button>
          )}
        </div>
      )}

      {/* Timeline - Gantt Chart Style */}
      <div className="flex-1 overflow-auto border-t">
        {/* Timeline container with fixed minimum width for horizontal scrolling */}
        <div
          className="relative min-w-max"
          style={{ width: `${Math.max(timePeriods.length * 150, 1200)}px` }}
        >
          {/* Time periods header with grid lines */}
          <div className="sticky top-0 z-20 bg-background border-b">
            <div className="flex">
              {timePeriods.map((period, index) => {
                const isCurrentPeriod =
                  zoomLevel === 'year'
                    ? period.getFullYear() === new Date().getFullYear()
                    : isSameMonth(period, new Date());

                return (
                  <div
                    key={`header-${index}`}
                    className={`
                      flex-shrink-0 w-[150px] p-3 text-center border-r last:border-r-0
                      ${isCurrentPeriod ? 'bg-primary/10' : 'bg-muted/30'}
                    `}
                  >
                    <div className="text-sm font-semibold">{getPeriodLabel(period)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline body with vertical grid lines */}
          <div className="relative">
            {/* Vertical grid lines */}
            <div className="absolute inset-0 pointer-events-none flex">
              {timePeriods.map((_, index) => (
                <div
                  key={`gridline-${index}`}
                  className="flex-shrink-0 w-[150px] border-r border-border/50 last:border-r-0"
                />
              ))}
            </div>

            {/* Today indicator */}
            {(() => {
              const today = new Date();
              const { start, end } = timelineRange;
              const isTodayInRange = today >= start && today <= end;
              if (!isTodayInRange) return null;

              // Calculate today's position as a percentage
              const totalDays = differenceInDays(end, start);
              const todayOffset = differenceInDays(today, start);
              const todayPercent = (todayOffset / totalDays) * 100;

              return (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                  style={{ left: `${todayPercent}%` }}
                >
                  <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
                  <div className="absolute -top-6 -left-6 text-xs font-medium text-red-500 whitespace-nowrap bg-background px-1 rounded border">
                    {t('contentCalendar:countdown.today', 'Today')}
                  </div>
                </div>
              );
            })()}

            {/* Campaign rows - vertical stacking with color coding */}
            {campaignRows.length === 0 ? (
              <div className="flex items-center justify-center py-32 text-muted-foreground">
                <div className="text-center">
                  <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">
                    {t('contentCalendar:views.noCampaigns', 'No campaigns found')}
                  </p>
                  <p className="text-sm">
                    {t('contentCalendar:views.noCampaignsInList', 'Try adjusting your filters.')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative p-4">
                {/* Campaign timeline - vertical stacking by date */}
                {filteredCampaigns.map((campaign, index) => {
                  const config = TOUR_CATEGORY_CONFIG[campaign.category];
                  const CategoryIcon = getCategoryIcon(campaign.category);
                  const isHovered = hoveredCampaign === campaign.id;
                  const isSelected = selectedCampaign?.id === campaign.id;
                  const countdown = getCountdown(campaign);
                  const position = getCampaignPosition(campaign);

                  // Status configuration
                  const statusConfig = {
                    planned: {
                      label: t('contentCalendar:status.planned', 'Planned'),
                      icon: Circle,
                      color: 'text-blue-700',
                      bgColor: 'bg-blue-100',
                      dotColor: 'bg-blue-500',
                    },
                    in_progress: {
                      label: t('contentCalendar:status.inProgress', 'In Progress'),
                      icon: TrendingUp,
                      color: 'text-amber-700',
                      bgColor: 'bg-amber-100',
                      dotColor: 'bg-amber-500',
                    },
                    done: {
                      label: t('contentCalendar:status.done', 'Completed'),
                      icon: CheckCircle2,
                      color: 'text-green-700',
                      bgColor: 'bg-green-100',
                      dotColor: 'bg-green-500',
                    },
                    under_review: {
                      label: t('contentCalendar:status.underReview', 'Under Review'),
                      icon: AlertCircle,
                      color: 'text-purple-700',
                      bgColor: 'bg-purple-100',
                      dotColor: 'bg-purple-500',
                    },
                  };
                  const status = statusConfig[campaign.status as keyof typeof statusConfig] || statusConfig.planned;
                  const StatusIcon = status.icon;

                  // Calculate vertical position based on index
                  const topPosition = index * 56; // 56px per row

                  return (
                    <TooltipProvider key={campaign.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.div
                            layout
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            whileHover={{ scale: 1.01, y: -2 }}
                            onClick={() => {
                              setSelectedCampaign(campaign);
                              onCampaignClick?.(campaign);
                            }}
                            onMouseEnter={() => setHoveredCampaign(campaign.id)}
                            onMouseLeave={() => setHoveredCampaign(null)}
                            className={`
                              absolute h-12 rounded-lg border-2 cursor-pointer
                              transition-all duration-200
                              flex items-center px-3 gap-2 shadow-sm
                              ${isHovered || isSelected ? 'shadow-lg ring-2 ring-primary/50 z-20' : 'hover:shadow-md'}
                            `}
                            style={{
                              ...position,
                              top: `${topPosition}px`,
                              // Color coding by category
                              backgroundColor: getCategoryColor(campaign.category),
                              borderColor: getCategoryBorderColor(campaign.category),
                              color: getCategoryTextColor(campaign.category),
                            }}
                          >
                            <CategoryIcon className="h-4 w-4 flex-shrink-0" />
                            <span className="text-xs font-semibold truncate flex-1">{campaign.title}</span>

                            {/* Date range badge */}
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/30 text-[10px] font-medium flex-shrink-0">
                              <Calendar className="h-3 w-3" />
                              <span className="max-w-24 truncate">
                                {campaign.scheduledDate && format(campaign.scheduledDate, 'MMM d')}
                                {campaign.dueDate && ` - ${format(campaign.dueDate, 'MMM d')}`}
                              </span>
                            </div>

                            {/* Countdown badge */}
                            {countdown.text && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`
                                  flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0
                                  ${countdown.isUrgent ? 'bg-red-500 text-white' : 'bg-white/40'}
                                `}
                              >
                                <Clock className="h-3 w-3" />
                                <span className="max-w-20 truncate">{countdown.text}</span>
                              </motion.div>
                            )}

                            {/* Status indicator */}
                            <div
                              className={`
                                flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 bg-white/30
                              `}
                            >
                              <StatusIcon className="h-3 w-3" />
                              <div className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
                            </div>
                          </motion.div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs" sideOffset={5}>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-4">
                              <p className="font-semibold">{campaign.title}</p>
                              <div
                                className={`
                                  flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
                                  ${status.bgColor} ${status.color}
                                `}
                              >
                                <StatusIcon className="h-3 w-3" />
                                {status.label}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p className="font-medium">
                                {campaign.scheduledDate && format(campaign.scheduledDate, 'MMM d, yyyy')}
                                {campaign.dueDate && ` - ${format(campaign.dueDate, 'MMM d, yyyy')}`}
                              </p>
                              {countdown.text && (
                                <p
                                  className={`
                                    flex items-center gap-1 font-medium
                                    ${countdown.isUrgent ? 'text-red-600' : 'text-gray-600'}
                                  `}
                                >
                                  <Clock className="h-3 w-3" />
                                  {countdown.text}
                                </p>
                              )}
                              {campaign.location && (
                                <p className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {campaign.location}
                                </p>
                              )}
                              {campaign.expectedAttendees && (
                                <p className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {campaign.expectedAttendees.toLocaleString()} attendees
                                </p>
                              )}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}

                {/* Timeline container height */}
                <div style={{ height: `${filteredCampaigns.length * 56}px` }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Campaign Detail Panel */}
      <AnimatePresence>
        {selectedCampaign && (
          <CampaignDetailPanel
            campaign={selectedCampaign}
            onClose={() => setSelectedCampaign(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Campaign Detail Panel
 * Slide-in panel showing campaign details
 */
function CampaignDetailPanel({
  campaign,
  onClose,
}: {
  campaign: TourCampaign;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation(['contentCalendar', 'common']);
  const config = TOUR_CATEGORY_CONFIG[campaign.category];
  const CategoryIcon = {
    'sports-event': Trophy,
    'concert-tour': Music,
    'festival': Sparkles,
    'exhibition': GalleryHorizontal,
    'championship': Medal,
    'olympics': Flame,
  }[campaign.category];

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute right-0 top-0 bottom-0 w-96 bg-card border-l shadow-xl overflow-y-auto z-30"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className={`flex items-center gap-2 mb-2 ${config.color}`}>
              <CategoryIcon className="h-5 w-5" />
              <Badge variant="outline" className={config.bgColor}>
                {config.label}
              </Badge>
            </div>
            <h3 className="text-lg font-semibold">{campaign.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-accent flex-shrink-0"
            aria-label={t('common:actions.close', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Description */}
        {campaign.description && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              {t('contentCalendar:dialog.description', 'Description')}
            </h4>
            <p className="text-sm text-muted-foreground">{campaign.description}</p>
          </div>
        )}

        {/* Dates */}
        <div>
          <h4 className="text-sm font-medium mb-2">{t('contentCalendar:tourTimeline.dates', 'Dates')}</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t('contentCalendar:dialog.scheduledDate', 'Start')}:
              </span>
              <span className="font-medium">
                {campaign.scheduledDate && format(campaign.scheduledDate, 'MMM d, yyyy')}
              </span>
            </div>
            {campaign.dueDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('contentCalendar:dialog.dueDate', 'End')}:
                </span>
                <span className="font-medium">{format(campaign.dueDate, 'MMM d, yyyy')}</span>
              </div>
            )}
            {campaign.dueDate && campaign.scheduledDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t('contentCalendar:tourTimeline.duration', 'Duration')}:
                </span>
                <span className="font-medium">
                  {differenceInDays(campaign.dueDate, campaign.scheduledDate)} days
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        {campaign.location && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {t('contentCalendar:tourTimeline.location', 'Location')}
            </h4>
            <p className="text-sm">{campaign.location}</p>
            {campaign.venue && (
              <p className="text-xs text-muted-foreground mt-1">{campaign.venue}</p>
            )}
          </div>
        )}

        {/* Attendees */}
        {campaign.expectedAttendees && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              {t('contentCalendar:tourTimeline.attendees', 'Expected Attendees')}
            </h4>
            <p className="text-sm">{campaign.expectedAttendees.toLocaleString()}</p>
          </div>
        )}

        {/* Pricing */}
        {campaign.ticketPriceRange && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              {t('contentCalendar:tourTimeline.pricing', 'Ticket Price Range')}
            </h4>
            <p className="text-sm">{campaign.ticketPriceRange}</p>
          </div>
        )}

        {/* Organizing Body */}
        {campaign.organizingBody && (
          <div>
            <h4 className="text-sm font-medium mb-2">
              {t('contentCalendar:tourTimeline.organizer', 'Organizing Body')}
            </h4>
            <p className="text-sm">{campaign.organizingBody}</p>
          </div>
        )}

        {/* Website */}
        {campaign.website && (
          <div>
            <a
              href={campaign.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="h-4 w-4" />
              {t('contentCalendar:tourTimeline.visitWebsite', 'Visit Website')}
            </a>
          </div>
        )}

        {/* Tags */}
        {campaign.tags && campaign.tags.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Tags</h4>
            <div className="flex flex-wrap gap-1">
              {campaign.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Estimated Hours */}
        {campaign.estimatedHours && (
          <div>
            <h4 className="text-sm font-medium mb-2">
              {t('contentCalendar:dialog.estimatedHours', 'Estimated Hours')}
            </h4>
            <p className="text-sm">{campaign.estimatedHours.toLocaleString()} hours</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
