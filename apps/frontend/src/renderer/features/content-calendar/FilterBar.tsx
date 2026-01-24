import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, X, Search } from 'lucide-react';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '../../components/ui/popover';

import { useContentCalendarStore } from './ContentCalendarStore';
import { CONTENT_TYPES, CALENDAR_VIEWS } from '../../../shared/constants/content-calendar';
import { ROADMAP_STATUS_COLUMNS } from '../../../shared/constants/roadmap';
import type { ContentType } from '../../../shared/types/content-calendar';

/**
 * Filter Bar Component
 * Provides filtering options for the content calendar
 */
export function FilterBar(): JSX.Element {
  const { t } = useTranslation(['contentCalendar', 'roadmap', 'common']);

  const {
    filters,
    setFilters,
    resetFilters
  } = useContentCalendarStore();

  const [searchQuery, setSearchQuery] = useState(filters.searchQuery || '');
  const [filterOpen, setFilterOpen] = useState(false);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.contentTypes.length > 0) count++;
    if (filters.statuses.length > 0) count++;
    if (filters.searchQuery) count++;
    return count;
  }, [filters]);

  const handleContentTypeToggle = (type: ContentType) => {
    const newTypes = filters.contentTypes.includes(type)
      ? filters.contentTypes.filter((t) => t !== type)
      : [...filters.contentTypes, type];

    setFilters({ contentTypes: newTypes });
  };

  const handleStatusToggle = (status: string) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];

    setFilters({ statuses: newStatuses });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Debounce search
    const timeoutId = setTimeout(() => {
      setFilters({ searchQuery: value });
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    resetFilters();
  };

  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b bg-muted/30">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t('contentCalendar:filters.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content Type Filter */}
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            {t('contentCalendar:filters.filters')}
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-5 min-w-[20px]">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {t('contentCalendar:filters.title')}
              </h3>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-auto p-1 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  {t('common:buttons.clear')}
                </Button>
              )}
            </div>

            {/* Content Types */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('contentCalendar:filters.contentTypes')}
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CONTENT_TYPES).map(([key, config]) => {
                  const isActive = filters.contentTypes.includes(key as ContentType);

                  return (
                    <button
                      key={key}
                      onClick={() => handleContentTypeToggle(key as ContentType)}
                      className={`
                        flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                        border transition-colors
                        ${isActive
                          ? `${config.color} ${config.bgColor} border-current`
                          : 'bg-background hover:bg-muted/50'
                        }
                      `}
                    >
                      <config.icon className="h-3 w-3" />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('contentCalendar:filters.status')}
              </label>
              <div className="space-y-1">
                {ROADMAP_STATUS_COLUMNS.map((status) => {
                  const isActive = filters.statuses.includes(status.id);

                  return (
                    <button
                      key={status.id}
                      onClick={() => handleStatusToggle(status.id)}
                      className={`
                        w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm
                        transition-colors text-left
                        ${isActive
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted/50'
                        }
                      `}
                    >
                      <div className={`w-2 h-2 rounded-full ${status.color.replace('border-t-', 'bg-')}`} />
                      {status.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filters Display */}
      <div className="flex items-center gap-2 flex-1">
        {filters.contentTypes.map((type) => {
          const config = CONTENT_TYPES[type];

          return (
            <Badge
              key={type}
              variant="secondary"
              className={`${config.color} ${config.bgColor} gap-1`}
            >
              {config.label}
              <button
                onClick={() => handleContentTypeToggle(type)}
                className="hover:opacity-70"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}

        {filters.statuses.map((status) => {
          const statusConfig = ROADMAP_STATUS_COLUMNS.find((s) => s.id === status);

          return (
            <Badge
              key={status}
              variant="secondary"
              className="gap-1"
            >
              {statusConfig?.label}
              <button
                onClick={() => handleStatusToggle(status)}
                className="hover:opacity-70"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
