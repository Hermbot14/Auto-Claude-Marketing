import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, AlertCircle, RefreshCw, Plus } from 'lucide-react';
import { useCalendarStore, loadCalendarData, saveCalendarData, aggregateFromRoadmap } from '../../../stores/calendarStore';
import type { CalendarItem as CalendarItemType, CalendarZoomLevel } from '../../../shared/types';
import { CalendarTimeline } from './CalendarTimeline';
import { CalendarItemDetail } from './CalendarItemDetail';
import { CalendarFilters } from './CalendarFilters';

interface CalendarViewProps {
  projectId: string;
  roadmap?: any;
}

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

  // Load calendar data on mount
  useEffect(() => {
    loadCalendarData(projectId);
  }, [projectId]);

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
    // TODO: Open add item dialog
    const newItem = {
      title: 'New Item',
      type: 'campaign' as const,
      status: 'draft' as const,
      source: 'manual' as const,
      startDate: new Date(),
      allDay: true,
    };
    const id = addItem(newItem);
    const item = calendarData?.items.find((i) => i.id === id);
    if (item) {
      handleItemClick(item);
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
            <RefreshCw className="h-5 w-5" />
          </motion.button>
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

      {/* Timeline */}
      <div className="flex-1 overflow-hidden">
        <CalendarTimeline
          items={filteredItems}
          currentDate={currentDate}
          zoomLevel={zoomLevel}
          onNavigate={handleNavigate}
          onZoomChange={handleZoomChange}
          onItemClick={handleItemClick}
          selectedItem={selectedItem}
        />
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
    </div>
  );
}
