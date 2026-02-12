import { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO } from 'date-fns';
import {
  Calendar,
  TrendingUp,
  Users,
  DollarSign,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Filter,
  SortAsc,
  SortDesc,
  Grid3x3,
  List,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { VirtualizedList, VirtualizedGrid } from '../VirtualizedList';

/**
 * Campaign data structure
 */
export interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  type: 'email' | 'social' | 'content' | 'ppc' | 'seo' | 'display';
  budget?: number;
  spent?: number;
  startDate: string | Date;
  endDate?: string | Date;
  targetAudience?: string;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  roi?: number;
  owner?: string;
  tags?: string[];
  description?: string;
}

/**
 * Campaign status color mapping
 */
const STATUS_COLORS = {
  draft: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-300 dark:border-gray-700' },
  active: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-300 dark:border-green-700' },
  paused: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-300 dark:border-yellow-700' },
  completed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700' },
} as const;

/**
 * Campaign type icon mapping
 */
const CAMPAIGN_TYPE_ICONS: Record<Campaign['type'], JSX.Element> = {
  email: <Calendar className="h-4 w-4" />,
  social: <Users className="h-4 w-4" />,
  content: <TrendingUp className="h-4 w-4" />,
  ppc: <DollarSign className="h-4 w-4" />,
  seo: <TrendingUp className="h-4 w-4" />,
  display: <Eye className="h-4 w-4" />,
};

interface CampaignListProps {
  campaigns: Campaign[];
  onCampaignClick?: (campaign: Campaign) => void;
  onCampaignEdit?: (campaign: Campaign) => void;
  onCampaignDelete?: (campaignId: string) => void;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

type ViewMode = 'list' | 'grid';
type SortField = 'name' | 'startDate' | 'budget' | 'status' | 'roi';
type SortOrder = 'asc' | 'desc';

/**
 * CampaignList Component
 *
 * A high-performance virtualized list for displaying large numbers of campaigns.
 * Uses TanStack Virtual for smooth scrolling with 10,000+ items.
 *
 * Features:
 * - Virtual scrolling for constant memory usage
 * - List and grid view modes
 * - Sorting and filtering
 * - Keyboard navigation
 * - Screen reader accessibility
 * - Responsive design
 */
export const CampaignList = memo<CampaignListProps>(({
  campaigns,
  onCampaignClick,
  onCampaignEdit,
  onCampaignDelete,
  loading = false,
  error = null,
  className = '',
}) => {
  const { t } = useTranslation(['campaign', 'common']);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortField, setSortField] = useState<SortField>('startDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
  const [hoveredCampaign, setHoveredCampaign] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Campaign['status'] | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<Campaign['type'] | 'all'>('all');

  // Memoize filtered and sorted campaigns
  const filteredCampaigns = useMemo(() => {
    let result = [...campaigns];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query) ||
          c.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      result = result.filter((c) => c.type === typeFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'startDate':
          aVal = new Date(a.startDate).getTime();
          bVal = new Date(b.startDate).getTime();
          break;
        case 'budget':
          aVal = a.budget || 0;
          bVal = b.budget || 0;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'roi':
          aVal = a.roi || 0;
          bVal = b.roi || 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [campaigns, searchQuery, statusFilter, typeFilter, sortField, sortOrder]);

  // Handle sort change
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }, [sortField, sortOrder]);

  // Handle campaign selection
  const handleSelectCampaign = useCallback((campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelection = new Set(selectedCampaigns);
    if (newSelection.has(campaignId)) {
      newSelection.delete(campaignId);
    } else {
      newSelection.add(campaignId);
    }
    setSelectedCampaigns(newSelection);
  }, [selectedCampaigns]);

  // Handle campaign click
  const handleCampaignClick = useCallback((campaign: Campaign) => {
    if (onCampaignClick) {
      onCampaignClick(campaign);
    }
  }, [onCampaignClick]);

  // Handle keyboard navigation in list
  const handleKeyDown = useCallback((campaign: Campaign, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCampaignClick(campaign);
    }
  }, [handleCampaignClick]);

  // Render campaign card for grid view
  const renderCampaignCard = useCallback((campaign: Campaign) => {
    const colors = STATUS_COLORS[campaign.status];
    const startDate = typeof campaign.startDate === 'string' ? parseISO(campaign.startDate) : campaign.startDate;
    const isSelected = selectedCampaigns.has(campaign.id);
    const isHovered = hoveredCampaign === campaign.id;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => handleCampaignClick(campaign)}
        onKeyDown={(e) => handleKeyDown(campaign, e)}
        onMouseEnter={() => setHoveredCampaign(campaign.id)}
        onMouseLeave={() => setHoveredCampaign(null)}
        className={`
          relative p-4 rounded-lg border-2 cursor-pointer transition-all
          ${colors.bg} ${colors.border} ${colors.text}
          ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
          ${isHovered ? 'shadow-lg' : 'shadow-md'}
        `}
        role="button"
        tabIndex={0}
        aria-label={`${campaign.name} - ${campaign.status}`}
        aria-pressed={isSelected}
      >
        {/* Type icon and status */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-md ${colors.bg}`}>
              {CAMPAIGN_TYPE_ICONS[campaign.type]}
            </div>
            <div>
              <h3 className="font-semibold text-sm line-clamp-1">{campaign.name}</h3>
              <p className="text-xs opacity-75 capitalize">{campaign.type}</p>
            </div>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${colors.bg} ${colors.text}`}>
            {campaign.status}
          </span>
        </div>

        {/* Campaign details */}
        {campaign.description && (
          <p className="text-xs opacity-75 line-clamp-2 mb-2">{campaign.description}</p>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {campaign.budget && (
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span>${campaign.budget.toLocaleString()}</span>
            </div>
          )}
          {campaign.impressions && (
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span>{campaign.impressions.toLocaleString()}</span>
            </div>
          )}
          {campaign.startDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{format(startDate, 'MMM d, yyyy')}</span>
            </div>
          )}
          {campaign.roi !== undefined && (
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span className={campaign.roi >= 0 ? 'text-green-600' : 'text-red-600'}>
                {campaign.roi >= 0 ? '+' : ''}{campaign.roi}%
              </span>
            </div>
          )}
        </div>

        {/* Tags */}
        {campaign.tags && campaign.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {campaign.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded text-xs bg-background/50"
              >
                {tag}
              </span>
            ))}
            {campaign.tags.length > 3 && (
              <span className="px-2 py-0.5 rounded text-xs bg-background/50">
                +{campaign.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Checkbox for bulk selection */}
        <div className="absolute top-2 right-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => handleSelectCampaign(campaign.id, e)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-2"
            aria-label={`Select ${campaign.name}`}
          />
        </div>
      </motion.div>
    );
  }, [selectedCampaigns, hoveredCampaign, handleCampaignClick, handleKeyDown, handleSelectCampaign]);

  // Render campaign row for list view
  const renderCampaignRow = useCallback((campaign: Campaign, index: number) => {
    const colors = STATUS_COLORS[campaign.status];
    const startDate = typeof campaign.startDate === 'string' ? parseISO(campaign.startDate) : campaign.startDate;
    const isSelected = selectedCampaigns.has(campaign.id);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        whileHover={{ x: 4, backgroundColor: 'hsl(var(--accent))' }}
        onClick={() => handleCampaignClick(campaign)}
        onKeyDown={(e) => handleKeyDown(campaign, e)}
        className={`
          flex items-center gap-4 p-4 border-b cursor-pointer transition-all
          ${isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-accent/50'}
        `}
        role="row"
        tabIndex={0}
        aria-label={`${campaign.name} - ${campaign.status}`}
        aria-selected={isSelected}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => handleSelectCampaign(campaign.id, e)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 flex-shrink-0"
          aria-label={`Select ${campaign.name}`}
        />

        {/* Status indicator */}
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colors.bg.replace('bg-', 'bg-').replace('/30', '')}`} />

        {/* Type icon */}
        <div className={`p-2 rounded-md ${colors.bg} flex-shrink-0`}>
          {CAMPAIGN_TYPE_ICONS[campaign.type]}
        </div>

        {/* Name and description */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{campaign.name}</div>
          {campaign.description && (
            <div className="text-xs text-muted-foreground truncate">{campaign.description}</div>
          )}
        </div>

        {/* Owner */}
        {campaign.owner && (
          <div className="w-32 text-sm text-muted-foreground truncate hidden sm:block">
            {campaign.owner}
          </div>
        )}

        {/* Dates */}
        <div className="w-32 text-sm text-muted-foreground hidden md:block">
          {format(startDate, 'MMM d, yyyy')}
        </div>

        {/* Budget */}
        {campaign.budget && (
          <div className="w-24 text-sm text-right font-medium hidden lg:block">
            ${campaign.budget.toLocaleString()}
          </div>
        )}

        {/* ROI */}
        {campaign.roi !== undefined && (
          <div className={`w-16 text-sm text-right font-medium hidden xl:block ${
            campaign.roi >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {campaign.roi >= 0 ? '+' : ''}{campaign.roi}%
          </div>
        )}

        {/* Status badge */}
        <span className={`px-3 py-1 rounded text-xs font-medium capitalize ${colors.bg} ${colors.text}`}>
          {campaign.status}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onCampaignEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCampaignEdit(campaign);
              }}
              className="p-1.5 rounded hover:bg-accent transition-colors"
              aria-label={`Edit ${campaign.name}`}
            >
              <Edit className="h-4 w-4" />
            </button>
          )}
          {onCampaignDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCampaignDelete(campaign.id);
              }}
              className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"
              aria-label={`Delete ${campaign.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button className="p-1.5 rounded hover:bg-accent transition-colors">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    );
  }, [selectedCampaigns, handleCampaignClick, handleKeyDown, handleSelectCampaign, onCampaignEdit, onCampaignDelete]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">{t('common:loading')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <Filter className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Error Loading Campaigns</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (filteredCampaigns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">No Campaigns Found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your filters or search query'
                : 'Get started by creating your first campaign'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search campaigns..."
              className="w-full px-4 py-2 pl-10 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Search campaigns"
            />
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Campaign['status'] | 'all')}
            className="px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as Campaign['type'] | 'all')}
            className="px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter by type"
          >
            <option value="all">All Types</option>
            <option value="email">Email</option>
            <option value="social">Social</option>
            <option value="content">Content</option>
            <option value="ppc">PPC</option>
            <option value="seo">SEO</option>
            <option value="display">Display</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort buttons */}
          <button
            onClick={() => handleSort('name')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
              sortField === 'name' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
            }`}
            aria-label="Sort by name"
          >
            Name
            {sortField === 'name' && (
              sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => handleSort('startDate')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
              sortField === 'startDate' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
            }`}
            aria-label="Sort by date"
          >
            Date
            {sortField === 'startDate' && (
              sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
            )}
          </button>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              }`}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              }`}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Selection info */}
      {selectedCampaigns.size > 0 && (
        <div className="px-4 py-2 bg-primary/10 border-b text-sm">
          <span className="font-medium">{selectedCampaigns.size}</span> campaigns selected
        </div>
      )}

      {/* Campaign list/grid */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'list' ? (
          <VirtualizedList
            items={filteredCampaigns}
            getKey={(campaign) => campaign.id}
            renderItem={(campaign) => renderCampaignRow(campaign, 0)}
            estimateSize={() => 80}
            overscan={5}
            ariaLabel="Campaigns list"
            ariaDescription={`Showing ${filteredCampaigns.length} of ${campaigns.length} campaigns`}
          />
        ) : (
          <VirtualizedGrid
            items={filteredCampaigns}
            getKey={(campaign) => campaign.id}
            renderItem={(campaign) => renderCampaignCard(campaign)}
            columns={3}
            estimateRowHeight={() => 200}
            overscan={2}
            gap={16}
            ariaLabel="Campaigns grid"
          />
        )}
      </div>
    </div>
  );
});

CampaignList.displayName = 'CampaignList';
