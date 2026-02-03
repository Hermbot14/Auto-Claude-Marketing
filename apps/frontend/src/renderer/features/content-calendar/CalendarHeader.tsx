import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarDays,
  CalendarClock,
  List,
  GitBranch,
  Plus
} from 'lucide-react';

import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../components/ui/select';
import { CALENDAR_VIEWS } from '../../../shared/constants/content-calendar';
import type { CalendarView } from '../../../shared/types/content-calendar';

interface CalendarHeaderProps {
  currentView: CalendarView;
  currentDate: Date;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
}

/**
 * Calendar Header Component
 * Navigation and view controls for the content calendar
 */
export function CalendarHeader({
  currentView,
  currentDate,
  onPrevious,
  onNext,
  onToday,
  onViewChange
}: CalendarHeaderProps): JSX.Element {
  const { t } = useTranslation(['contentCalendar', 'common']);

  const currentMonthLabel = React.useMemo(() => {
    return currentDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }, [currentDate]);

  const getWeekLabel = React.useCallback(() => {
    const weekStart = new Date(currentDate);
    const dayOfWeek = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - dayOfWeek);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const format = (date: Date) => {
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();
      const year = date.getFullYear();
      return `${month} ${day}, ${year}`;
    };

    return `${format(weekStart)} - ${format(weekEnd)}`;
  }, [currentDate]);

  const getDayLabel = React.useCallback(() => {
    return currentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }, [currentDate]);

  const dateLabel = React.useMemo(() => {
    switch (currentView) {
      case 'month':
        return currentMonthLabel;
      case 'week':
        return getWeekLabel();
      case 'day':
        return getDayLabel();
      case 'list':
        return 'All Campaigns';
      case 'tour-timeline':
        return t('contentCalendar:tourTimeline.title', 'Tour Timeline');
    }
  }, [currentView, currentMonthLabel, getWeekLabel, getDayLabel, t]);

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
      <div className="flex items-center gap-4">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevious}
            aria-label={t('contentCalendar:navigation.previous')}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            onClick={onToday}
            className="text-sm"
          >
            {t('contentCalendar:navigation.today')}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            aria-label={t('contentCalendar:navigation.next')}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Current Date/Range Display */}
        <h2 className="text-xl font-semibold min-w-[200px]">
          {dateLabel}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {/* View Selector */}
        <Select value={currentView} onValueChange={(value) => onViewChange(value as CalendarView)}>
          <SelectTrigger className="w-[140px]" aria-label={t('contentCalendar:navigation.selectView')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CALENDAR_VIEWS.map((view) => {
              const Icon = view.icon === 'Calendar' ? Calendar :
                          view.icon === 'CalendarDays' ? CalendarDays :
                          view.icon === 'CalendarClock' ? CalendarClock :
                          view.icon === 'GitBranch' ? GitBranch :
                          List;

              return (
                <SelectItem key={view.id} value={view.id}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {t(`contentCalendar:views.${view.id}`)}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Add Campaign Button */}
        <Button
          variant="default"
          size="sm"
          className="gap-2"
          onClick={() => {
            // Handle add campaign
            console.log('Add campaign clicked');
          }}
        >
          <Plus className="h-4 w-4" />
          {t('contentCalendar:actions.addCampaign')}
        </Button>
      </div>
    </div>
  );
}
