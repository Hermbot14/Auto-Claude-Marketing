import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  SortAsc,
  SortDesc,
  ArrowUpDown
} from 'lucide-react';

import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../components/ui/select';
import { Input } from '../../components/ui/input';

import { useContentCalendarStore } from './ContentCalendarStore';
import { CONTENT_TYPES } from '../../../shared/constants/content-calendar';
import { CALENDAR_STATUS_COLORS } from '../../../shared/constants/content-calendar';
import { ROADMAP_PRIORITY_COLORS } from '../../../shared/constants/roadmap';
import type { ContentCampaign } from '../../../shared/types/content-calendar';
import { CampaignCard } from './CampaignCard';

type SortField = 'date' | 'title' | 'status' | 'priority' | 'contentType';
type SortOrder = 'asc' | 'desc';

interface ListViewProps {
  campaigns: ContentCampaign[];
}

/**
 * List View Component
 * Displays campaigns in a sortable, filterable list
 */
export function ListView({ campaigns }: ListViewProps): JSX.Element {
  const { t } = useTranslation(['contentCalendar', 'roadmap', 'common']);

  const { setSelectedCampaign } = useContentCalendarStore();

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  // Sort and filter campaigns
  const sortedCampaigns = useMemo(() => {
    let filtered = [...campaigns];

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((campaign) => {
        const matchesTitle = campaign.title.toLowerCase().includes(query);
        const matchesDescription = campaign.description?.toLowerCase().includes(query);
        return matchesTitle || matchesDescription;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'date':
          const aDate = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
          const bDate = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
          comparison = aDate - bDate;
          break;

        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;

        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;

        case 'priority':
          const priorityOrder = ['must', 'should', 'could', 'wont'];
          comparison = priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
          break;

        case 'contentType':
          comparison = a.contentType.localeCompare(b.contentType);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [campaigns, sortField, sortOrder, searchQuery]);

  const handleCampaignClick = (campaign: ContentCampaign, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedCampaign(campaign);
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-muted/30">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              {t('contentCalendar:views.allCampaigns')}
            </h2>
            <Badge variant="secondary" className="text-sm">
              {sortedCampaigns.length}
            </Badge>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <Input
              type="text"
              placeholder={t('contentCalendar:filters.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">{t('contentCalendar:sort.date')}</SelectItem>
                <SelectItem value="title">{t('contentCalendar:sort.title')}</SelectItem>
                <SelectItem value="status">{t('contentCalendar:sort.status')}</SelectItem>
                <SelectItem value="priority">{t('contentCalendar:sort.priority')}</SelectItem>
                <SelectItem value="contentType">{t('contentCalendar:sort.contentType')}</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={toggleSortOrder}
              aria-label={t('contentCalendar:sort.toggleOrder')}
            >
              {sortOrder === 'asc' ? (
                <SortAsc className="h-4 w-4" />
              ) : (
                <SortDesc className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Campaign List */}
      <div className="flex-1 overflow-auto p-6">
        {sortedCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {t('contentCalendar:views.noCampaigns')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {t('contentCalendar:views.noCampaignsInList')}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl mx-auto">
            {sortedCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                showStatus
                showPriority
                onClick={(event) => handleCampaignClick(campaign, event)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
