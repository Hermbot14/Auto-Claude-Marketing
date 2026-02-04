import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { Loader2, AlertCircle, RefreshCw, Plus, Filter, CalendarDays, Grid3x3, Download, Upload } from 'lucide-react';
import { useCalendarStore, loadCalendarData, saveCalendarData, aggregateFromRoadmap } from '../../stores/calendarStore';
import type { CalendarItem as CalendarItemType, CalendarZoomLevel } from '../../../shared/types';
import { CalendarTimeline } from './CalendarTimeline';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarItemDetail } from './CalendarItemDetail';
import { CalendarFilters } from './CalendarFilters';
import { CalendarAddItemDialog } from './CalendarAddItemDialog';
import { downloadICS, readICSFile } from './calendarUtils';

interface CalendarViewProps {
  projectId: string;
  roadmap?: any;
}

type CalendarLayout = 'timeline' | 'month';

export function CalendarView({ projectId, roadmap }: CalendarViewProps) {
  const {
    calendarData,
    selectedItem,
    isLoading,
    error,
    currentDate,
    zoomLevel,
    filters,
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

  // Load calendar data on mount
  useEffect(() => {
    loadCalendarData(projectId);
  }, [projectId]);

  // Generate mock data for development/testing
  useEffect(() => {
    if (calendarData && calendarData.items.length === 0) {
      const now = new Date();
      const mockEvents: Omit<CalendarItemType, 'id' | 'createdAt' | 'updatedAt'>[] = [
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

      // Add all mock events
      mockEvents.forEach((event) => {
        addItem(event);
      });

      // Save the mock data
      saveCalendarData(projectId);
    }
  }, [calendarData]);

  // Sync roadmap phases to calendar
  useEffect(() => {
    if (roadmap && roadmap.phases) {
      const roadmapItems = aggregateFromRoadmap(roadmap);
      roadmapItems.forEach((item) => {
        // Check if item already exists
        const exists = calendarData?.items.some(
          (i) => i.linkedFeatureId === item.linkedFeatureId && i.source === 'roadmap'
        );
        if (!exists) {
          addItem(item);
        }
      });
      // Save calendar after sync
      if (calendarData) {
        saveCalendarData(projectId);
      }
    }
  }, [roadmap]);

  // Handle navigation
  const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
    switch (direction) {
      case 'prev':
        setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)));
        break;
      case 'next':
        setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)));
        break;
      case 'today':
        setCurrentDate(new Date());
        break;
    }
  };

  // Handle zoom change
  const handleZoomChange = (level: CalendarZoomLevel) => {
    setZoomLevel(level);
  };

  // Handle item click
  const handleItemClick = (item: CalendarItemType) => {
    setSelectedItem(item);
    setShowDetail(true);
  };

  // Handle close detail
  const handleCloseDetail = () => {
    setShowDetail(false);
    setTimeout(() => setSelectedItem(null), 300);
  };

  // Handle refresh
  const handleRefresh = async () => {
    await loadCalendarData(projectId);
  };

  // Handle add new item
  const handleAddItem = () => {
    setShowAddDialog(true);
  };

  // Handle add item from dialog
  const handleAddItemSubmit = (item: Omit<CalendarItemType, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = addItem(item);
    const newItem = calendarData?.items.find((i) => i.id === id);
    if (newItem) {
      handleItemClick(newItem);
    }
    // Save after adding
    saveCalendarData(projectId);
  };

  // Handle item date change from drag-and-drop
  const handleItemDateChange = (itemId: string, newStartDate: Date, newEndDate: Date) => {
    updateItem(itemId, { startDate: newStartDate, endDate: newEndDate });
    // Save after drag operation
    saveCalendarData(projectId);
  };

  // Handle export to ICS
  const handleExport = () => {
    const itemsToExport = filteredItems.length > 0 ? filteredItems : (calendarData?.items || []);
    const filename = `marketing-calendar-${format(currentDate, 'yyyy-MM-dd')}.ics`;
    downloadICS(itemsToExport, filename);
  };

  // Handle import from ICS
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const importedItems = await readICSFile(file);
      // Add each imported item to the calendar
      importedItems.forEach((item) => {
        addItem(item);
      });
      // Save after importing
      await saveCalendarData(projectId);
    } catch (error) {
      console.error('Failed to import calendar:', error);
      setError('Failed to import calendar file');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Get filtered items
  const filteredItems = getFilteredItems();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading calendar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <div>
            <h3 className="text-lg font-semibold">Failed to load calendar</h3>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Marketing Calendar</h2>
          <span className="text-sm text-muted-foreground">
            ({filteredItems.length} items)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout toggle */}
          <div className="hidden sm:flex items-center gap-1 bg-muted rounded-lg p-1 mr-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setLayout('timeline')}
              className={`p-2 rounded-md transition-colors ${
                layout === 'timeline' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Timeline view"
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
              title="Month grid view"
            >
              <Grid3x3 className="h-4 w-4" />
            </motion.button>
          </div>

          {/* Add item button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAddItem}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </motion.button>

          {/* Filters button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${
              showFilters ? 'bg-accent' : 'hover:bg-accent'
            }`}
            aria-label="Toggle filters"
          >
            <Filter className="h-5 w-5" />
          </motion.button>

          {/* Export button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleExport}
            className="hidden sm:flex p-2 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
            title="Export to ICS"
          >
            <Download className="h-5 w-5" />
          </motion.button>

          {/* Import button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleImportClick}
            disabled={isImporting}
            className="hidden sm:flex p-2 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
            title="Import from ICS"
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
      <div className="flex-1 overflow-hidden">
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
              // Open add dialog with the clicked date
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
            onUpdate={(updates) => updateItem(selectedItem.id, updates)}
            onDelete={() => {
              deleteItem(selectedItem.id);
              handleCloseDetail();
            }}
          />
        )}
      </AnimatePresence>

      {/* Add item dialog */}
      <CalendarAddItemDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddItemSubmit}
        defaultDate={currentDate}
      />
    </div>
  );
}
