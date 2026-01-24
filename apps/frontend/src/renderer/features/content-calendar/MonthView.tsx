import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { motion } from 'motion/react';

import { DAY_NAMES } from '../../../shared/constants/content-calendar';
import { CALENDAR_STATUS_COLORS } from '../../../shared/constants/content-calendar';
import { useContentCalendarStore, getCampaignsForDate } from './ContentCalendarStore';
import type { CalendarDate, ContentCampaign } from '../../../shared/types/content-calendar';
import { CampaignCard } from './CampaignCard';

interface MonthViewProps {
  grid: CalendarDate[];
  campaigns: ContentCampaign[];
}

/**
 * Month View Component
 * Displays a full month calendar with campaigns
 */
export function MonthView({ grid, campaigns }: MonthViewProps): JSX.Element {
  const { t } = useTranslation(['contentCalendar', 'common']);

  const {
    draggedCampaign,
    startDrag,
    endDrag,
    handleDrop,
    setSelectedCampaign,
    setSelectedDate,
    updateCampaignDate
  } = useContentCalendarStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  );

  // Populate grid with campaigns
  const populatedGrid = useMemo(() => {
    return grid.map((day) => ({
      ...day,
      campaigns: getCampaignsForDate(campaigns, day.date)
    }));
  }, [grid, campaigns]);

  // Drag and drop handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const campaign = campaigns.find((c) => c.id === event.active.id as string);
    if (campaign) {
      startDrag(campaign);
    }
  }, [campaigns, startDrag]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Prevent default to allow dropping
    event.over?.data.current?.setIsDragOver(true);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    endDrag();

    if (over && over.data.current?.date) {
      const campaignId = active.id as string;
      const targetDate = new Date(over.data.current.date);

      updateCampaignDate(campaignId, targetDate);
    }
  }, [endDrag, updateCampaignDate]);

  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(date);
  }, [setSelectedDate]);

  const handleCampaignClick = useCallback((campaign: ContentCampaign, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedCampaign(campaign);
  }, [setSelectedCampaign]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col bg-background">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {DAY_NAMES.map((day) => (
            <div
              key={day}
              className="px-2 py-3 text-center text-sm font-semibold text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 grid grid-cols-7 grid-rows-6 auto-rows-fr">
          {populatedGrid.map((day, index) => {
            const isToday = day.isToday;
            const isCurrentMonth = day.isCurrentMonth;
            const hasCampaigns = day.campaigns.length > 0;

            return (
              <DayCell
                key={`${day.date.toISOString()}-${index}`}
                day={day}
                isToday={isToday}
                isCurrentMonth={isCurrentMonth}
                hasCampaigns={hasCampaigns}
                campaigns={day.campaigns}
                onDayClick={handleDayClick}
                onCampaignClick={handleCampaignClick}
              />
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}

interface DayCellProps {
  day: CalendarDate;
  isToday: boolean;
  isCurrentMonth: boolean;
  hasCampaigns: boolean;
  campaigns: ContentCampaign[];
  onDayClick: (date: Date) => void;
  onCampaignClick: (campaign: ContentCampaign, event: React.MouseEvent) => void;
}

function DayCell({
  day,
  isToday,
  isCurrentMonth,
  hasCampaigns,
  campaigns,
  onDayClick,
  onCampaignClick
}: DayCellProps): JSX.Element {
  const { draggedCampaign } = useContentCalendarStore();

  const isDragging = draggedCampaign !== null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`
        relative border-r border-b p-1 min-h-[100px] cursor-pointer
        transition-colors duration-200
        ${isToday ? 'bg-primary/5' : ''}
        ${isCurrentMonth ? 'bg-background' : 'bg-muted/30'}
        ${isDragging ? 'hover:bg-primary/10' : 'hover:bg-muted/50'}
      `}
      onClick={() => onDayClick(day.date)}
      data-date={day.date.toISOString()}
    >
      {/* Day Number */}
      <div className={`
        flex items-center justify-center
        w-7 h-7 text-sm font-medium rounded-full mb-1
        ${isToday ? 'bg-primary text-primary-foreground' : ''}
        ${!isCurrentMonth ? 'text-muted-foreground' : ''}
      `}>
        {day.date.getDate()}
      </div>

      {/* Campaigns */}
      <div className="space-y-1 overflow-y-auto max-h-[80px]">
        {campaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            compact
            onClick={(event) => onCampaignClick(campaign, event)}
          />
        ))}

        {/* Show indicator if more than 3 campaigns */}
        {campaigns.length > 3 && (
          <div className="text-xs text-muted-foreground text-center pt-1">
            +{campaigns.length - 3} more
          </div>
        )}
      </div>

      {/* Drag Over Indicator */}
      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
      )}
    </motion.div>
  );
}
