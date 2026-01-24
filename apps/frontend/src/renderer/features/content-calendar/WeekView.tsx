import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

import { DAY_NAMES } from '../../../shared/constants/content-calendar';
import { useContentCalendarStore, getCampaignsForDate } from './ContentCalendarStore';
import type { WeekDay, ContentCampaign } from '../../../shared/types/content-calendar';
import { CampaignCard } from './CampaignCard';

interface WeekViewProps {
  days: WeekDay[];
  campaigns: ContentCampaign[];
}

/**
 * Week View Component
 * Displays a single week with detailed campaign slots
 */
export function WeekView({ days, campaigns }: WeekViewProps): JSX.Element {
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

  // Populate days with campaigns
  const populatedDays = useMemo(() => {
    return days.map((day) => ({
      ...day,
      campaigns: getCampaignsForDate(campaigns, day.date)
    }));
  }, [days, campaigns]);

  // Get max campaigns for height calculation
  const maxCampaigns = useMemo(() => {
    return Math.max(...populatedDays.map((day) => day.campaigns.length), 1);
  }, [populatedDays]);

  // Drag and drop handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const campaign = campaigns.find((c) => c.id === event.active.id as string);
    if (campaign) {
      startDrag(campaign);
    }
  }, [campaigns, startDrag]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
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

        {/* Week Grid */}
        <div className="flex-1 grid grid-cols-7 gap-px bg-border">
          {populatedDays.map((day, index) => (
            <WeekDayCell
              key={`${day.date.toISOString()}-${index}`}
              day={day}
              campaigns={day.campaigns}
              maxCampaigns={maxCampaigns}
              onDayClick={handleDayClick}
              onCampaignClick={handleCampaignClick}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
}

interface WeekDayCellProps {
  day: WeekDay;
  campaigns: ContentCampaign[];
  maxCampaigns: number;
  onDayClick: (date: Date) => void;
  onCampaignClick: (campaign: ContentCampaign, event: React.MouseEvent) => void;
}

function WeekDayCell({
  day,
  campaigns,
  maxCampaigns,
  onDayClick,
  onCampaignClick
}: WeekDayCellProps): JSX.Element {
  const { draggedCampaign } = useContentCalendarStore();

  const isDragging = draggedCampaign !== null;
  const dayLabel = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div
      className={`
        relative bg-background p-2 cursor-pointer
        transition-colors duration-200
        ${day.isToday ? 'bg-primary/5' : ''}
        ${isDragging ? 'hover:bg-primary/10' : 'hover:bg-muted/50'}
      `}
      onClick={() => onDayClick(day.date)}
      data-date={day.date.toISOString()}
    >
      {/* Day Header */}
      <div className="flex items-center justify-between mb-2">
        <span className={`
          text-sm font-medium
          ${day.isToday ? 'text-primary' : ''}
          ${!day.isCurrentMonth ? 'text-muted-foreground' : ''}
        `}>
          {dayLabel}
        </span>

        {day.isToday && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
            Today
          </span>
        )}
      </div>

      {/* Campaigns */}
      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: `${maxCampaigns * 80}px` }}>
        {campaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            onClick={(event) => onCampaignClick(campaign, event)}
          />
        ))}

        {campaigns.length === 0 && (
          <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
            No campaigns
          </div>
        )}
      </div>

      {/* Drag Over Indicator */}
      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
      )}
    </div>
  );
}
