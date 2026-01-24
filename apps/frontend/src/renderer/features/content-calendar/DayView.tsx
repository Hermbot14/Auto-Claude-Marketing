import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Calendar } from 'lucide-react';

import { useContentCalendarStore } from './ContentCalendarStore';
import type { ContentCampaign } from '../../../shared/types/content-calendar';
import { CampaignCard } from './CampaignCard';

interface DayViewProps {
  date: Date;
  campaigns: ContentCampaign[];
}

/**
 * Day View Component
 * Displays a single day with detailed campaign list
 */
export function DayView({ date, campaigns }: DayViewProps): JSX.Element {
  const { t } = useTranslation(['contentCalendar', 'common']);

  const { setSelectedCampaign } = useContentCalendarStore();

  // Filter campaigns for this specific date
  const dayCampaigns = useMemo(() => {
    const targetDate = date.toDateString();
    return campaigns.filter((campaign) => {
      if (!campaign.scheduledDate) return false;
      return new Date(campaign.scheduledDate).toDateString() === targetDate;
    });
  }, [date, campaigns]);

  const handleCampaignClick = (campaign: ContentCampaign, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedCampaign(campaign);
  };

  // Group campaigns by time if they have time slots
  const groupedCampaigns = useMemo(() => {
    const groups: Record<string, ContentCampaign[]> = {};

    dayCampaigns.forEach((campaign) => {
      const key = 'all-day'; // For now, all campaigns are all-day
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(campaign);
    });

    return groups;
  }, [dayCampaigns]);

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">{dateLabel}</h2>
            <p className="text-sm text-muted-foreground">
              {dayCampaigns.length} campaign{dayCampaigns.length !== 1 ? 's' : ''} scheduled
            </p>
          </div>
        </div>
      </div>

      {/* Campaigns */}
      <div className="flex-1 overflow-auto p-6">
        {Object.keys(groupedCampaigns).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {t('contentCalendar:views.noCampaigns')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {t('contentCalendar:views.noCampaignsDescription')}
            </p>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {Object.entries(groupedCampaigns).map(([timeSlot, timeCampaigns]) => (
              <div key={timeSlot} className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="capitalize">{timeSlot.replace('-', ' ')}</span>
                  <span className="text-xs">
                    ({timeCampaigns.length})
                  </span>
                </div>

                <div className="space-y-2 pl-6">
                  {timeCampaigns.map((campaign) => (
                    <CampaignCard
                      key={campaign.id}
                      campaign={campaign}
                      onClick={(event) => handleCampaignClick(campaign, event)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
