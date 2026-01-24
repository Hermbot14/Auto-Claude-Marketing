import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  CalendarDays,
  CalendarClock,
  List,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger
} from '../../components/ui/dropdown-menu';

import { useContentCalendarStore, generateMonthGrid, generateWeekDays } from './ContentCalendarStore';
import { CONTENT_TYPES, CALENDAR_VIEWS } from '../../../shared/constants/content-calendar';
import { DAY_NAMES } from '../../../shared/constants/content-calendar';
import type { CalendarView, ContentType } from '../../../shared/types/content-calendar';
import { CalendarHeader } from './CalendarHeader';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { ListView } from './ListView';
import { CampaignCard } from './CampaignCard';
import { FilterBar } from './FilterBar';
import { ConflictDialog } from './ConflictDialog';
import { CampaignDialog } from './CampaignDialog';

/**
 * Content Calendar Component
 * Main calendar interface for managing marketing campaigns
 */
export function ContentCalendar(): JSX.Element {
  const { t } = useTranslation(['contentCalendar', 'common']);

  const {
    currentView,
    currentDate,
    setCurrentView,
    setCurrentDate,
    filters,
    setFilters,
    campaigns,
    selectedCampaign,
    setSelectedCampaign,
    conflicts,
    showConflictDialog,
    updateCampaignDate
  } = useContentCalendarStore();

  // Navigation handlers
  const navigatePrevious = useCallback(() => {
    const newDate = new Date(currentDate);

    switch (currentView) {
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() - 1);
        break;
      case 'list':
        newDate.setDate(newDate.getDate() - 7);
        break;
    }

    setCurrentDate(newDate);
  }, [currentDate, currentView, setCurrentDate]);

  const navigateNext = useCallback(() => {
    const newDate = new Date(currentDate);

    switch (currentView) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + 1);
        break;
      case 'list':
        newDate.setDate(newDate.getDate() + 7);
        break;
    }

    setCurrentDate(newDate);
  }, [currentDate, currentView, setCurrentDate]);

  const navigateToday = useCallback(() => {
    setCurrentDate(new Date());
  }, [setCurrentDate]);

  // Calculate filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      if (filters.contentTypes.length > 0) {
        if (!filters.contentTypes.includes(campaign.contentType)) {
          return false;
        }
      }

      if (filters.statuses.length > 0) {
        if (!filters.statuses.includes(campaign.status)) {
          return false;
        }
      }

      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesTitle = campaign.title.toLowerCase().includes(query);
        const matchesDescription = campaign.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription) {
          return false;
        }
      }

      return true;
    });
  }, [campaigns, filters]);

  // Generate grid data based on view
  const calendarGrid = useMemo(() => {
    switch (currentView) {
      case 'month':
        return generateMonthGrid(currentDate);
      case 'week':
        return generateWeekDays(currentDate);
      case 'day':
      case 'list':
        return null;
    }
  }, [currentDate, currentView]);

  const viewLabel = useMemo(() => {
    const view = CALENDAR_VIEWS.find((v) => v.id === currentView);
    return view?.label || currentView;
  }, [currentView]);

  const currentMonthLabel = useMemo(() => {
    return currentDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }, [currentDate]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <CalendarHeader
        currentView={currentView}
        currentDate={currentDate}
        onPrevious={navigatePrevious}
        onNext={navigateNext}
        onToday={navigateToday}
        onViewChange={setCurrentView}
      />

      {/* Filters */}
      <FilterBar />

      {/* Calendar Content */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {currentView === 'month' && calendarGrid && (
              <MonthView grid={calendarGrid} campaigns={filteredCampaigns} />
            )}

            {currentView === 'week' && calendarGrid && (
              <WeekView days={calendarGrid} campaigns={filteredCampaigns} />
            )}

            {currentView === 'day' && (
              <DayView date={currentDate} campaigns={filteredCampaigns} />
            )}

            {currentView === 'list' && (
              <ListView campaigns={filteredCampaigns} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Conflict Dialog */}
      {showConflictDialog && conflicts.length > 0 && (
        <ConflictDialog
          conflicts={conflicts}
          onConfirm={() => {
            // Handle conflict resolution
            conflicts.forEach((conflict) => {
              updateCampaignDate(conflict.campaignId, currentDate);
            });
          }}
          onCancel={() => {
            useContentCalendarStore.getState().showConflictDialog = false;
          }}
        />
      )}

      {/* Campaign Detail/Edit Dialog */}
      {selectedCampaign && (
        <CampaignDialog
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
          onSave={(updates) => {
            useContentCalendarStore.getState().updateCampaign(selectedCampaign.id, updates);
            setSelectedCampaign(null);
          }}
        />
      )}
    </div>
  );
}
