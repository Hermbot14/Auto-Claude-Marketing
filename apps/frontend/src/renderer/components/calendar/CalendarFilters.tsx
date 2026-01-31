import { motion } from 'motion/react';
import { X, Filter } from 'lucide-react';
import type { CalendarFilters as CalendarFiltersType, CalendarItemType, CalendarItemStatus } from '../../../shared/types';
import { CALENDAR_ITEM_TYPE_LABELS } from '../../../shared/constants';

interface CalendarFiltersProps {
  filters: CalendarFiltersType;
  onFilterChange: (filters: Partial<CalendarFiltersType>) => void;
  onClearFilters: () => void;
}

const ITEM_TYPES: CalendarItemType[] = ['campaign', 'content', 'social', 'email', 'seo', 'deadline', 'event'];
const STATUSES: CalendarItemStatus[] = ['draft', 'scheduled', 'published', 'cancelled'];
const SOURCES: CalendarFiltersType['sources'] = ['roadmap', 'file', 'external', 'manual'];

export function CalendarFilters({ filters, onFilterChange, onClearFilters }: CalendarFiltersProps) {
  const toggleFilter = <T extends string>(arr: T[], value: T) => {
    const newArr = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    return newArr;
  };

  const hasActiveFilters =
    filters.itemTypes.length > 0 ||
    filters.status.length > 0 ||
    filters.sources.length > 0 ||
    filters.tags.length > 0 ||
    !!filters.searchQuery;

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
          {hasActiveFilters && (
            <span className="text-xs text-muted-foreground">
              ({[
                filters.itemTypes.length,
                filters.status.length,
                filters.sources.length,
                filters.tags.length,
              ].reduce((a, b) => a + b, 0)} active)
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClearFilters}
            className="px-2 py-1 rounded bg-muted text-xs font-medium flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Clear All
          </motion.button>
        )}
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          value={filters.searchQuery || ''}
          onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
          placeholder="Search items..."
          className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Item Types */}
      <div>
        <span className="text-xs font-medium text-muted-foreground mb-2 block">Type</span>
        <div className="flex flex-wrap gap-2">
          {ITEM_TYPES.map((type) => {
            const isActive = filters.itemTypes.includes(type);
            return (
              <motion.button
                key={type}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onFilterChange({ itemTypes: toggleFilter(filters.itemTypes, type) })}
                className={`
                  px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                  ${isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                  }
                `}
              >
                {CALENDAR_ITEM_TYPE_LABELS[type]}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Status */}
      <div>
        <span className="text-xs font-medium text-muted-foreground mb-2 block">Status</span>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((status) => {
            const isActive = filters.status.includes(status);
            return (
              <motion.button
                key={status}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onFilterChange({ status: toggleFilter(filters.status, status) })}
                className={`
                  px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors
                  ${isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                  }
                `}
              >
                {status}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Source */}
      <div>
        <span className="text-xs font-medium text-muted-foreground mb-2 block">Source</span>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((source) => {
            const isActive = filters.sources.includes(source);
            return (
              <motion.button
                key={source}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onFilterChange({ sources: toggleFilter(filters.sources, source) })}
                className={`
                  px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors
                  ${isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                  }
                `}
              >
                {source}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
