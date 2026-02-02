import React, { useState, useMemo, useCallback } from 'react';
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
  isToday,
  isSameMonth,
  isSameDay,
  startOfYear,
  endOfYear,
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

  // Calculate campaign position and width
  const getCampaignStyle = useCallback(
    (campaign: TourCampaign) => {
      const { start, end } = timelineRange;
      const totalDays = Math.max(differenceInDays(end, start), 1);

      const campaignStart = campaign.scheduledDate || new Date();
      const campaignEnd = campaign.dueDate || campaignStart;

      const startOffset = Math.max(differenceInDays(campaignStart, start), 0);
      const duration = Math.max(differenceInDays(campaignEnd, campaignStart), 1);

      const leftPercent = (startOffset / totalDays) * 100;
      const widthPercent = Math.min((duration / totalDays) * 100, 100 - leftPercent);

      return {
        left: `${leftPercent}%`,
        width: `${Math.max(widthPercent, 1)}%`, // Minimum 1% width
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

  // Calculate today position
  const todayStyle = useMemo(() => {
    const { start, end } = timelineRange;
    const totalDays = Math.max(differenceInDays(end, start), 1);
    const todayOffset = differenceInDays(new Date(), start);
    const leftPercent = (todayOffset / totalDays) * 100;

    return {
      left: `${Math.max(0, Math.min(leftPercent, 100))}%`,
    };
  }, [timelineRange]);

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

      {/* Timeline */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          {/* Time periods header */}
          <div className="flex border-b bg-muted/30 sticky top-0 z-10">
            {timePeriods.map((period, index) => {
              const isCurrentPeriod =
                zoomLevel === 'year'
                  ? period.getFullYear() === new Date().getFullYear()
                  : isSameMonth(period, new Date());

              return (
                <div
                  key={index}
                  className={`
                    flex-1 min-w-32 p-2 text-center border-r last:border-r-0
                    ${isCurrentPeriod ? 'bg-primary/10' : ''}
                  `}
                >
                  <div className="text-sm font-medium">{getPeriodLabel(period)}</div>
                </div>
              );
            })}
          </div>

          {/* Campaign rows */}
          <div className="relative">
            {/* Today indicator */}
            {isToday(currentDate) && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                style={todayStyle}
              >
                <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
              </div>
            )}

            {campaignRows.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">
                    {t('contentCalendar:views.noCampaigns', 'No campaigns found')}
                  </p>
                  <p className="text-sm">
                    {t('contentCalendar:views.noCampaignsInList', 'Try adjusting your filters.')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative p-4 space-y-2">
                {campaignRows.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex h-12 relative">
                    {row.map((campaign) => {
                      const config = TOUR_CATEGORY_CONFIG[campaign.category];
                      const CategoryIcon = getCategoryIcon(campaign.category);
                      const isHovered = hoveredCampaign === campaign.id;
                      const isSelected = selectedCampaign?.id === campaign.id;

                      return (
                        <TooltipProvider key={campaign.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.02, y: -2 }}
                                onClick={() => {
                                  setSelectedCampaign(campaign);
                                  onCampaignClick?.(campaign);
                                }}
                                onMouseEnter={() => setHoveredCampaign(campaign.id)}
                                onMouseLeave={() => setHoveredCampaign(null)}
                                className={`
                                  absolute h-10 rounded-lg cursor-pointer shadow-sm
                                  flex items-center px-3 gap-2
                                  transition-all
                                  ${config.bgColor}
                                  ${isHovered || isSelected ? 'shadow-md ring-2 ring-primary/50' : ''}
                                `}
                                style={getCampaignStyle(campaign)}
                              >
                                <CategoryIcon className={`h-4 w-4 flex-shrink-0 ${config.color}`} />
                                <span className="text-sm font-medium truncate flex-1">{campaign.title}</span>

                                {/* Status indicator */}
                                <div
                                  className={`
                                    w-2 h-2 rounded-full flex-shrink-0
                                    ${
                                      campaign.status === 'planned'
                                        ? 'bg-blue-500'
                                        : campaign.status === 'in_progress'
                                          ? 'bg-yellow-500'
                                          : campaign.status === 'done'
                                            ? 'bg-green-500'
                                            : 'bg-gray-400'
                                    }
                                  `}
                                />

                                {/* Duration badge for longer campaigns */}
                                {campaign.dueDate &&
                                  campaign.scheduledDate &&
                                  differenceInDays(campaign.dueDate, campaign.scheduledDate) > 7 && (
                                    <Badge variant="secondary" className="h-5 px-1 text-xs">
                                      {differenceInDays(campaign.dueDate, campaign.scheduledDate)}d
                                    </Badge>
                                  )}
                              </motion.div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="bottom"
                              className="max-w-xs"
                              sideOffset={5}
                            >
                              <div className="space-y-1">
                                <p className="font-medium">{campaign.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {campaign.scheduledDate &&
                                    format(campaign.scheduledDate, 'MMM d, yyyy')}
                                  {campaign.dueDate &&
                                    ` - ${format(campaign.dueDate, 'MMM d, yyyy')}`}
                                </p>
                                {campaign.location && (
                                  <p className="text-xs flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {campaign.location}
                                  </p>
                                )}
                                {campaign.expectedAttendees && (
                                  <p className="text-xs flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {campaign.expectedAttendees.toLocaleString()} attendees
                                  </p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                ))}
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
