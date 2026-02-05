import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, addWeeks, addMonths, startOfMonth } from 'date-fns';
import { Loader2, AlertCircle, RefreshCw, Plus, Filter, CalendarDays, Grid3x3, Download, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCalendarStore, loadCalendarData, saveCalendarData, aggregateFromRoadmap, addItemWithOptimisticUpdate, updateItemWithOptimisticUpdate, deleteItemWithOptimisticUpdate } from '../../stores/calendarStore';
import type { CalendarItem as CalendarItemType, CalendarZoomLevel } from '../../../shared/types';
import { CalendarTimeline } from './CalendarTimeline';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarItemDetail } from './CalendarItemDetail';
import { CalendarFilters } from './CalendarFilters';
import { CalendarAddItemDialog } from './CalendarAddItemDialog';
import { CalendarSkeleton } from './CalendarSkeleton';
import { downloadICS, readICSFile } from './calendarUtils';
// SECURITY: Permission denied UI component
import { PermissionDeniedPage } from './PermissionDeniedBanner';

interface CalendarViewProps {
  projectId: string;
  roadmap?: any;
}

type CalendarLayout = 'timeline' | 'month';

// State machine for calendar load operations
type CalendarLoadState = 'idle' | 'loading' | 'loaded' | 'syncing';

export function CalendarView({ projectId, roadmap }: CalendarViewProps) {
  const { t } = useTranslation(['calendar', 'common']);
  const {
    calendarData,
    selectedItem,
    isLoading,
    isSaving,
    error,
    currentDate,
    zoomLevel,
    filters,
    pendingItemIds,
    setSelectedItem,
    setError,
    setCurrentDate,
    setZoomLevel,
    setFilters,
    addItem,
    updateItem,
    deleteItem,
    getFilteredItems,
  } = useCalendarStore();

  const [showDetail, setShowDetail] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [layout, setLayout] = useState<CalendarLayout>('timeline');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State machine for coordinating calendar operations
  const [loadState, setLoadState] = useState<CalendarLoadState>('idle');

  // Stable references for functions used in effects
  const handleLoadCalendarData = useCallback(() => {
    loadCalendarData(projectId);
  }, [projectId]);

  const handleSaveCalendarData = useCallback(() => {
    saveCalendarData(projectId);
  }, [projectId]);

  // Track if we've already initialized mock data to prevent re-running
  const hasInitializedMockData = useRef(false);

  // Track which roadmap phases we've already synced to prevent infinite loops
  const syncedRoadmapPhases = useRef<Set<string>>(new Set());

  // Track if roadmap sync has been completed
  const hasCompletedRoadmapSync = useRef(false);

  // Mock data definition (extracted for reusability)
  const getMockEvents = useCallback((): Omit<CalendarItemType, 'id' | 'createdAt' | 'updatedAt'>[] => {
    const now = new Date();
    return [
        // Campaign - Multi-week campaign
        {
          title: 'Q1 Product Launch Campaign',
          description: 'Comprehensive product launch campaign across all channels',
          type: 'campaign',
          status: 'published',
          source: 'manual',
          startDate: now,
          endDate: addWeeks(now, 4),
          allDay: true,
          priority: 'high',
          tags: ['launch', 'q1', 'product'],
          assignee: 'Marketing Team',
          location: 'Global',
        },
        // Content - Blog post
        {
          title: 'Blog Post: AI Marketing Trends 2026',
          description: 'Annual trends article about AI in marketing',
          type: 'content',
          status: 'published',
          source: 'manual',
          startDate: addDays(now, 2),
          allDay: true,
          priority: 'medium',
          tags: ['blog', 'seo', 'ai'],
          assignee: 'Sarah Chen',
        },
        // Social - Weekly social series
        {
          title: 'Weekly Tips Tuesday',
          description: 'Weekly marketing tips across all social platforms',
          type: 'social',
          status: 'published',
          source: 'manual',
          startDate: addDays(now, 1),
          allDay: true,
          priority: 'medium',
          tags: ['social', 'tips', 'weekly'],
          assignee: 'Alex Rivera',
          recurrence: {
            frequency: 'weekly',
            interval: 1,
            count: 12,
          },
        },
        // Email - Newsletter
        {
          title: 'Monthly Newsletter - February',
          description: 'Monthly digest of marketing insights and company updates',
          type: 'email',
          status: 'scheduled',
          source: 'manual',
          startDate: addDays(now, 7),
          allDay: true,
          priority: 'medium',
          tags: ['newsletter', 'email', 'monthly'],
          assignee: 'Jamie Smith',
        },
        // SEO - Keyword research
        {
          title: 'Q1 SEO Keyword Research',
          description: 'Research and plan keywords for Q1 content strategy',
          type: 'seo',
          status: 'published',
          source: 'manual',
          startDate: addDays(now, -3),
          endDate: addDays(now, 2),
          allDay: true,
          priority: 'high',
          tags: ['seo', 'research', 'q1'],
          assignee: 'Mike Johnson',
        },
        // Deadline - Content approval
        {
          title: 'March Content Approval Deadline',
          description: 'All March content must be approved by this date',
          type: 'deadline',
          status: 'scheduled',
          source: 'manual',
          startDate: addDays(now, 14),
          allDay: true,
          priority: 'high',
          tags: ['deadline', 'approval'],
          assignee: 'Content Team',
        },
        // Event - Industry conference
        {
          title: 'MarketingProfs Conference 2026',
          description: 'Annual marketing conference in Boston',
          type: 'event',
          status: 'scheduled',
          source: 'manual',
          startDate: addDays(now, 21),
          endDate: addDays(now, 23),
          allDay: true,
          priority: 'medium',
          tags: ['conference', 'networking'],
          assignee: 'Team Leads',
          location: 'Boston, MA',
        },
        // Campaign - Spring sale
        {
          title: 'Spring Sale Promotion',
          description: 'Annual spring sale across all product lines',
          type: 'campaign',
          status: 'draft',
          source: 'manual',
          startDate: addDays(now, 30),
          endDate: addDays(now, 44),
          allDay: true,
          priority: 'high',
          tags: ['sale', 'spring', 'promotion'],
          assignee: 'Marketing Team',
        },
        // Social - Product announcement
        {
          title: 'New Feature Announcement',
          description: 'Social media posts for new product feature launch',
          type: 'social',
          status: 'scheduled',
          source: 'manual',
          startDate: addDays(now, 10),
          allDay: true,
          priority: 'high',
          tags: ['product', 'announcement', 'social'],
          assignee: 'Alex Rivera',
        },
        // Content - Video production
        {
          title: 'Product Demo Video',
          description: 'Create demo video for new product features',
          type: 'content',
          status: 'draft',
          source: 'manual',
          startDate: addDays(now, 5),
          endDate: addDays(now, 12),
          allDay: true,
          priority: 'medium',
          tags: ['video', 'product', 'demo'],
          assignee: 'Video Team',
        },
        // Email - Drip campaign
        {
          title: 'Onboarding Email Series',
          description: '7-email onboarding sequence for new users',
          type: 'email',
          status: 'draft',
          source: 'manual',
          startDate: addDays(now, 18),
          allDay: true,
          priority: 'medium',
          tags: ['onboarding', 'email', 'automation'],
          assignee: 'Jamie Smith',
        },
        // SEO - Backlink building
        {
          title: 'Q1 Backlink Outreach',
          description: 'Reach out to partners for backlink opportunities',
          type: 'seo',
          status: 'published',
          source: 'manual',
          startDate: addDays(now, -7),
          endDate: addDays(now, 21),
          allDay: true,
          priority: 'low',
          tags: ['seo', 'backlinks', 'outreach'],
          assignee: 'Mike Johnson',
        },
        // Event - Team meeting
        {
          title: 'Weekly Marketing Sync',
          description: 'Weekly team sync to review progress and plan',
          type: 'event',
          status: 'scheduled',
          source: 'manual',
          startDate: now,
          allDay: false,
          priority: 'low',
          tags: ['meeting', 'weekly'],
          assignee: 'Marketing Team',
          location: 'Conference Room A',
          recurrence: {
            frequency: 'weekly',
            interval: 1,
          },
        },
        // Campaign - Brand awareness
        {
          title: 'Brand Awareness Q1',
          description: 'Increase brand visibility across all channels',
          type: 'campaign',
          status: 'published',
          source: 'manual',
          startDate: addDays(now, -14),
          endDate: addDays(now, 45),
          allDay: true,
          priority: 'high',
          tags: ['brand', 'awareness', 'q1'],
          assignee: 'Marketing Team',
        },
        // Content - Case study
        {
          title: 'Customer Success Case Study',
          description: 'Document and publish success story from key client',
          type: 'content',
          status: 'scheduled',
          source: 'manual',
          startDate: addDays(now, 25),
          endDate: addDays(now, 32),
          allDay: true,
          priority: 'medium',
          tags: ['case-study', 'customer', 'content'],
          assignee: 'Sarah Chen',
        },
        // Social - Holiday posts
        {
          title: 'Valentine\'s Day Social Campaign',
          description: 'Valentine\'s themed social media content',
          type: 'social',
          status: 'published',
          source: 'manual',
          startDate: addDays(now, 10),
          endDate: addDays(now, 14),
          allDay: true,
          priority: 'medium',
          tags: ['holiday', 'valentines', 'social'],
          assignee: 'Alex Rivera',
        },
        // Email - Abandoned cart
        {
          title: 'Cart Recovery Email Setup',
          description: 'Set up abandoned cart email sequence',
          type: 'email',
          status: 'published',
          source: 'manual',
          startDate: addDays(now, -2),
          allDay: true,
          priority: 'high',
          tags: ['ecommerce', 'automation', 'email'],
          assignee: 'Jamie Smith',
        },
        // Deadline - Report due
        {
          title: 'Q1 Performance Report Due',
          description: 'Submit Q1 marketing performance report',
          type: 'deadline',
          status: 'scheduled',
          source: 'manual',
          startDate: addDays(now, 60),
          allDay: true,
          priority: 'high',
          tags: ['report', 'q1', 'deadline'],
          assignee: 'Marketing Team',
        },
        // Event - Webinar
        {
          title: 'Product Training Webinar',
          description: 'Live webinar training for new product features',
          type: 'event',
          status: 'scheduled',
          source: 'manual',
          startDate: addDays(now, 28),
          allDay: false,
          priority: 'medium',
          tags: ['webinar', 'training', 'product'],
          assignee: 'Support Team',
          location: 'Zoom',
        },
        // Campaign - Retargeting
        {
          title: 'Site Retargeting Campaign',
          description: 'Retargeting ads for website visitors',
          type: 'campaign',
          status: 'published',
          source: 'manual',
          startDate: addDays(now, -5),
          endDate: addDays(now, 25),
          allDay: true,
          priority: 'medium',
          tags: ['ads', 'retargeting', 'ppc'],
          assignee: 'PPC Team',
        },
      ];
  }, []);

  // Coordinated calendar initialization with state machine
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const loadAndSync = async () => {
      // Prevent concurrent operations
      if (loadState !== 'idle' || !isMounted) {
        return;
      }

      setLoadState('loading');

      try {
        // Step 1: Load calendar data from storage
        await handleLoadCalendarData();

        // Wait for calendarData to be available
        const waitForCalendarData = () => {
          return new Promise<void>((resolve) => {
            const checkData = () => {
              const currentData = useCalendarStore.getState().calendarData;
              if (currentData !== undefined) {
                resolve();
              } else {
                timeoutId = setTimeout(checkData, 100);
              }
            };
            checkData();
          });
        };

        await waitForCalendarData();

        if (!isMounted) return;

        const currentCalendarData = useCalendarStore.getState().calendarData;

        // Step 2: Add mock data if needed (only once)
        if (!hasInitializedMockData.current && currentCalendarData?.items.length === 0) {
          const mockEvents = getMockEvents();
          mockEvents.forEach((event) => {
            addItem(event);
          });
          await handleSaveCalendarData();
          hasInitializedMockData.current = true;
        }

        setLoadState('loaded');

        // Step 3: Sync roadmap after data is loaded (only once)
        if (roadmap?.phases && !hasCompletedRoadmapSync.current) {
          setLoadState('syncing');

          const roadmapItems = aggregateFromRoadmap(roadmap);
          let hasNewItems = false;

          roadmapItems.forEach((item) => {
            // Create a unique identifier for this roadmap item
            const syncKey = `${item.linkedFeatureId || item.title}-${item.startDate.getTime()}`;

            // Skip if we've already synced this item
            if (syncedRoadmapPhases.current.has(syncKey)) {
              return;
            }

            // Check if item already exists in calendar
            const calendarData = useCalendarStore.getState().calendarData;
            const exists = calendarData?.items.some(
              (i) => i.linkedFeatureId === item.linkedFeatureId && i.source === 'roadmap'
            );

            if (!exists) {
              addItem(item);
              syncedRoadmapPhases.current.add(syncKey);
              hasNewItems = true;
            }
          });

          // Save calendar only if we added new items
          if (hasNewItems) {
            await handleSaveCalendarData();
          }

          hasCompletedRoadmapSync.current = true;
          setLoadState('loaded');
        }
      } catch (error) {
        console.error('Calendar initialization failed:', error);
        setError(error instanceof Error ? error.message : 'Failed to load calendar');
        setLoadState('idle');
      }
    };

    loadAndSync();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, roadmap?.phases]); // Only re-run if projectId or roadmap phases change

  // Create a combined loading state
  const isOperationInProgress = isLoading || loadState === 'loading' || loadState === 'syncing';

  // Handle navigation based on zoom level
  const handleNavigate = useCallback((direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
      return;
    }

    // For timeline view, navigation depends on zoom level
    if (layout === 'timeline') {
      const multiplier = direction === 'next' ? 1 : -1;
      switch (zoomLevel) {
        case 'quarter':
          // Navigate by 3 months
          setCurrentDate(addMonths(currentDate, 3 * multiplier));
          break;
        case 'month':
          // Navigate by 1 month
          setCurrentDate(addMonths(currentDate, 1 * multiplier));
          break;
        case 'week':
          // Navigate by 1 week (7 days)
          setCurrentDate(addDays(currentDate, 7 * multiplier));
          break;
        case 'day':
          // Navigate by 1 day
          setCurrentDate(addDays(currentDate, 1 * multiplier));
          break;
      }
    } else {
      // For month view, navigate by month
      const multiplier = direction === 'next' ? 1 : -1;
      setCurrentDate(addMonths(currentDate, 1 * multiplier));
    }
  }, [layout, zoomLevel, currentDate]);

  // Handle zoom change
  const handleZoomChange = useCallback((level: CalendarZoomLevel) => {
    setZoomLevel(level);
  }, []);

  // Handle item click
  const handleItemClick = useCallback((item: CalendarItemType) => {
    setSelectedItem(item);
    setShowDetail(true);
  }, [setSelectedItem]);

  // Handle close detail
  const handleCloseDetail = useCallback(() => {
    setShowDetail(false);
    setTimeout(() => setSelectedItem(null), 300);
  }, [setSelectedItem]);

  // Handle refresh (only when not loading)
  const handleRefresh = useCallback(async () => {
    if (isOperationInProgress) {
      return;
    }
    setLoadState('idle'); // Reset state to trigger reload
    await handleLoadCalendarData();
  }, [handleLoadCalendarData, isOperationInProgress]);

  // Handle add new item (prevent during load)
  const handleAddItem = useCallback(() => {
    if (isOperationInProgress) {
      return;
    }
    setShowAddDialog(true);
  }, [isOperationInProgress]);

  // Handle add item from dialog with optimistic update
  const handleAddItemSubmit = useCallback(async (item: Omit<CalendarItemType, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      // Use optimistic update - item added immediately, then saved
      const id = await addItemWithOptimisticUpdate(projectId, item);
      const newItem = useCalendarStore.getState().calendarData?.items.find((i) => i.id === id);
      if (newItem) {
        handleItemClick(newItem);
      }
      // Close dialog after successful save
      setShowAddDialog(false);
    } catch (error) {
      // Error handled by optimistic update function (rollback + error state)
      console.error('Failed to add item:', error);
    }
  }, [projectId, handleItemClick]);

  // Handle item date change from drag-and-drop
  const handleItemDateChange = useCallback((itemId: string, newStartDate: Date, newEndDate: Date) => {
    updateItem(itemId, { startDate: newStartDate, endDate: newEndDate });
    // Save after drag operation
    handleSaveCalendarData();
  }, [updateItem, handleSaveCalendarData]);

  // Handle export to ICS
  const handleExport = useCallback(() => {
    const itemsToExport = filteredItems.length > 0 ? filteredItems : (calendarData?.items || []);
    const filename = `marketing-calendar-${format(currentDate, 'yyyy-MM-dd')}.ics`;
    downloadICS(itemsToExport, filename);
  }, [filteredItems, calendarData, currentDate]);

  // Handle import from ICS
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError(null); // Clear any existing errors

    try {
      const importedItems = await readICSFile(file);

      if (importedItems.length === 0) {
        setError('No valid events found in ICS file');
        return;
      }

      // Add each imported item to the calendar
      importedItems.forEach((item) => {
        addItem(item);
      });

      // Save after importing
      await handleSaveCalendarData();

      // Show success feedback
      setError(null);
    } catch (error) {
      console.error('Failed to import calendar:', error);

      // Provide user-friendly error messages
      if (error instanceof Error) {
        const errorMessage = error.message;

        // Security-related errors
        if (errorMessage.includes('exceeds maximum size')) {
          setError('File too large. Maximum size is 5MB.');
        } else if (errorMessage.includes('Invalid file type')) {
          setError('Invalid file type. Only .ics files are allowed.');
        } else if (errorMessage.includes('security') || errorMessage.includes('pollution') || errorMessage.includes('XSS')) {
          setError('Security check failed. The file may be malicious.');
        } else if (errorMessage.includes('parse')) {
          setError('Failed to parse ICS file. Please ensure it is a valid format.');
        } else {
          setError(`Failed to import: ${errorMessage}`);
        }
      } else {
        setError('Failed to import calendar file. Please try again.');
      }
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [addItem, handleSaveCalendarData, setError]);

  // Memoize filtered items - only recompute when calendar data or filters change
  const filteredItems = useMemo(() => {
    return getFilteredItems();
  }, [calendarData?.items, filters]);

  // Show loading state for initial load or coordinated operations
  if (isLoading || isOperationInProgress) {
    return <CalendarSkeleton layout={layout} />;
  }

  if (error) {
    // SECURITY: Check if this is a permission denied error
    // Permission errors should not show a retry button as they won't be fixed by retrying
    const isPermissionError =
      error.toLowerCase().includes('permission') ||
      error.toLowerCase().includes('forbidden') ||
      error.toLowerCase().includes('access denied') ||
      error.toLowerCase().includes('unauthorized');

    if (isPermissionError) {
      return (
        <PermissionDeniedPage
          error={error}
          code="FORBIDDEN"
          onRequestAccess={handleRefresh}
        />
      );
    }

    // Other errors show the standard error UI with retry
    return (
      <div
        className="flex h-full items-center justify-center"
        role="alert"
        aria-live="assertive"
      >
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" aria-hidden="true" />
          <div>
            <h3 className="text-lg font-semibold">{t('calendar:a11y.loadError')}</h3>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground flex items-center gap-2 mx-auto"
            aria-label={t('calendar:a11y.retry')}
          >
            <RefreshCw className="h-4 w-4" />
            {t('calendar:a11y.retry')}
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card" role="banner">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold" id="calendar-title">{t('calendar:header.title')}</h2>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            ({filteredItems.length} {t('calendar:header.itemsCount', { count: filteredItems.length })})
          </span>
        </div>

        <div className="flex items-center gap-2" role="toolbar" aria-label={t('calendar:a11y.toolbar')}>
          {/* Layout toggle */}
          <div className="hidden sm:flex items-center gap-1 bg-muted rounded-lg p-1 mr-2" role="radiogroup" aria-label={t('calendar:a11y.viewSwitcher')}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setLayout('timeline')}
              className={`p-2 rounded-md transition-colors ${
                layout === 'timeline' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title={t('calendar:views.timeline')}
              role="radio"
              aria-checked={layout === 'timeline'}
              aria-label={t('calendar:a11y.switchToView', { view: t('calendar:views.timeline') })}
            >
              <CalendarDays className="h-4 w-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setLayout('month')}
              className={`p-2 rounded-md transition-colors ${
                layout === 'month' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title={t('calendar:views.month')}
              role="radio"
              aria-checked={layout === 'month'}
              aria-label={t('calendar:a11y.switchToView', { view: t('calendar:views.month') })}
            >
              <Grid3x3 className="h-4 w-4" />
            </motion.button>
          </div>

          {/* Add item button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAddItem}
            disabled={isOperationInProgress || isSaving}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground flex items-center gap-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('calendar:event.create')}
            aria-busy={isOperationInProgress || isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {isSaving ? t('calendar:a11y.saving') : t('calendar:event.create')}
            </span>
          </motion.button>

          {/* Filters button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              showFilters ? 'bg-accent' : 'hover:bg-accent'
            }`}
            aria-label={t('calendar:a11y.toggleFilters')}
            aria-pressed={showFilters}
          >
            <Filter className="h-5 w-5" />
          </motion.button>

          {/* Export button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleExport}
            className="hidden sm:flex p-2 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            title={t('calendar:a11y.export')}
            aria-label={t('calendar:a11y.export')}
          >
            <Download className="h-5 w-5" />
          </motion.button>

          {/* Import button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleImportClick}
            disabled={isImporting}
            className="hidden sm:flex p-2 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:focus-visible:ring-0"
            title={t('calendar:a11y.import')}
            aria-label={t('calendar:a11y.import')}
            aria-busy={isImporting}
          >
            <Upload className="h-5 w-5" />
          </motion.button>

          {/* Hidden file input for import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics"
            onChange={handleImportFile}
            className="hidden"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Filters panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-b bg-card overflow-hidden"
            role="region"
            aria-label={t('calendar:a11y.filters')}
          >
            <CalendarFilters
              filters={filters}
              onFilterChange={setFilters}
              onClearFilters={() => setFilters({
                itemTypes: [],
                status: [],
                sources: [],
                tags: [],
                searchQuery: '',
              })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar View */}
      <div className="flex-1 overflow-hidden" role="main" aria-labelledby="calendar-title">
        {layout === 'timeline' ? (
          <CalendarTimeline
            items={filteredItems}
            currentDate={currentDate}
            zoomLevel={zoomLevel}
            onNavigate={handleNavigate}
            onZoomChange={handleZoomChange}
            onItemClick={handleItemClick}
            onItemDateChange={handleItemDateChange}
            onDateClick={() => setShowAddDialog(true)}
            selectedItem={selectedItem}
          />
        ) : (
          <CalendarMonthView
            items={filteredItems}
            currentDate={currentDate}
            onNavigate={handleNavigate}
            onItemClick={handleItemClick}
            onDateClick={(date) => {
              setShowAddDialog(true);
            }}
            selectedItem={selectedItem}
          />
        )}
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {showDetail && selectedItem && (
          <CalendarItemDetail
            item={selectedItem}
            isOpen={showDetail}
            onClose={handleCloseDetail}
            onUpdate={async (updates) => {
              try {
                await updateItemWithOptimisticUpdate(projectId, selectedItem.id, updates);
              } catch (error) {
                console.error('Failed to update item:', error);
              }
            }}
            onDelete={async () => {
              try {
                await deleteItemWithOptimisticUpdate(projectId, selectedItem.id);
                handleCloseDetail();
              } catch (error) {
                console.error('Failed to delete item:', error);
              }
            }}
            isSaving={isSaving}
            isPending={pendingItemIds.has(selectedItem.id)}
          />
        )}
      </AnimatePresence>

      {/* Add item dialog */}
      <CalendarAddItemDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddItemSubmit}
        defaultDate={currentDate}
        isSubmitting={isSaving}
      />
    </div>
  );
}
