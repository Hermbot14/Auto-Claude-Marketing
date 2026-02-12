/**
 * Content Scheduler Component
 * Multi-platform content scheduling with conflict detection
 *
 * Features:
 * - Schedule content across multiple social platforms
 * - Visual content preview
 * - Time slot selection with conflict detection
 * - Bulk scheduling for multiple platforms
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarketingCalendarStore } from '../stores/marketingCalendarStore';
import type {
  MarketingCalendarItem,
  SocialPlatform,
  ContentType,
  ScheduleConflict,
} from '../../../../shared/types/marketing-calendar';
import { conflictDetectionEngine } from '../lib/conflictDetection';
import { format, addDays, setHours, setMinutes } from 'date-fns';

// ============================================
// Types
// ============================================

interface ContentSchedulerProps {
  className?: string;
  initialItem?: Partial<MarketingCalendarItem>;
  onSave?: (item: Omit<MarketingCalendarItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel?: () => void;
}

interface PlatformSchedule {
  platform: SocialPlatform;
  scheduledDate?: Date;
  scheduledTime?: string;
  conflicts?: ScheduleConflict[];
}

// ============================================
// Platform Configuration
// ============================================

const PLATFORMS: Array<{ id: SocialPlatform; name: string; icon: string; color: string }> = [
  { id: 'twitter', name: 'Twitter/X', icon: '𝕏', color: 'bg-blue-100 dark:bg-blue-900/20' },
  { id: 'linkedin', name: 'LinkedIn', icon: 'in', color: 'bg-blue-100 dark:bg-blue-900/20' },
  { id: 'facebook', name: 'Facebook', icon: 'f', color: 'bg-blue-50 dark:bg-blue-900/20' },
  { id: 'instagram', name: 'Instagram', icon: '📷', color: 'bg-pink-100 dark:bg-pink-900/20' },
  { id: 'youtube', name: 'YouTube', icon: '▶️', color: 'bg-red-100 dark:bg-red-900/20' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', color: 'bg-gray-100 dark:bg-gray-900/20' },
];

const CONTENT_TYPES: Array<{ id: ContentType; name: string; icon: string }> = [
  { id: 'blog', name: 'Blog Post', icon: '📝' },
  { id: 'social', name: 'Social Post', icon: '💬' },
  { id: 'email', name: 'Email', icon: '📧' },
  { id: 'ad', name: 'Advertisement', icon: '📢' },
  { id: 'video', name: 'Video', icon: '🎥' },
  { id: 'other', name: 'Other', icon: '📄' },
];

// ============================================
// Main Component
// ============================================

export function ContentScheduler({ className = '', initialItem, onSave, onCancel }: ContentSchedulerProps) {
  const { t } = useTranslation(['marketing-calendar', 'common']);

  // Store actions
  const addItem = useMarketingCalendarStore((state) => state.addItem);
  const scheduleForPlatforms = useMarketingCalendarStore((state) => state.scheduleForPlatforms);

  // Form state
  const [formData, setFormData] = useState({
    title: initialItem?.title || '',
    description: initialItem?.description || '',
    type: initialItem?.type || 'content',
    contentType: initialItem?.contentType || 'social',
    status: initialItem?.status || 'draft',
    priority: initialItem?.priority || 'medium',
    platforms: initialItem?.platforms || [],
    startDate: initialItem?.startDate || new Date(),
    dueDate: initialItem?.dueDate,
  });

  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformSchedule[]>([]);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [showPlatformSelector, setShowPlatformSelector] = useState(false);
  const [bulkScheduleDate, setBulkScheduleDate] = useState<Date | null>(null);

  // ============================================
  // Handlers
  // ============================================

  const handlePlatformToggle = useCallback((platform: SocialPlatform) => {
    const newSelected = selectedPlatforms.find((p) => p.platform === platform)
      ? selectedPlatforms.filter((p) => p.platform !== platform)
      : [...selectedPlatforms, { platform, scheduledDate: undefined, scheduledTime: undefined, conflicts: [] }];

    setSelectedPlatforms(newSelected);
  }, [selectedPlatforms]);

  const handlePlatformDateChange = useCallback((platform: SocialPlatform, date: Date) => {
    setSelectedPlatforms((prev) =>
      prev.map((p) =>
        p.platform === platform ? { ...p, scheduledDate: date } : p
      )
    );
  }, []);

  const handlePlatformTimeChange = useCallback((platform: SocialPlatform, time: string) => {
    setSelectedPlatforms((prev) =>
      prev.map((p) =>
        p.platform === platform ? { ...p, scheduledTime: time } : p
      )
    );
  }, []);

  const handleBulkDateChange = useCallback((date: Date | null) => {
    setBulkScheduleDate(date);
    if (date) {
      // Apply bulk date to all selected platforms
      setSelectedPlatforms((prev) =>
        prev.map((p) => ({ ...p, scheduledDate: date }))
      );
    }
  }, []);

  const checkConflictsForPlatform = useCallback((platform: SocialPlatform, date: Date) => {
    const tempItem: MarketingCalendarItem = {
      id: 'temp-conflict-check',
      title: formData.title,
      description: formData.description,
      type: formData.type as any,
      status: formData.status,
      source: 'manual',
      startDate: date,
      platforms: [platform],
      contentType: formData.contentType,
      priority: formData.priority,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const conflict = conflictDetectionEngine.checkConflicts(
      tempItem,
      [] // Empty since we're checking before adding
    );

    return conflict;
  }, [formData]);

  const handleSave = useCallback(() => {
    // Validate form
    if (!formData.title.trim()) {
      return;
    }

    if (selectedPlatforms.length === 0) {
      return;
    }

    // Create calendar item for each platform with scheduled date
    const savedItems: string[] = [];

    for (const platformSchedule of selectedPlatforms) {
      if (!platformSchedule.scheduledDate) continue;

      // Create item for this platform
      const itemData: Omit<MarketingCalendarItem, 'id' | 'createdAt' | 'updatedAt'> = {
        ...formData,
        platforms: [platformSchedule.platform],
        startDate: platformSchedule.scheduledDate,
      };

      // Check for conflicts
      const conflict = checkConflictsForPlatform(platformSchedule.platform, platformSchedule.scheduledDate);

      if (conflict.length > 0) {
        // Add conflict to state
        setConflicts(conflict);
        return;
      }

      // Add item to store
      const itemId = addItem(itemData);
      savedItems.push(itemId);
    }

    if (savedItems.length > 0) {
      onSave?.({
        ...formData,
        platforms: selectedPlatforms.map((p) => p.platform),
      });
    }
  }, [formData, selectedPlatforms, addItem, checkConflictsForPlatform, onSave]);

  const handleResolveConflict = useCallback((resolution: ScheduleConflict) => {
    // Apply resolution
    const resolved = conflictDetectionEngine.resolveConflict(resolution);
    if (resolved) {
      for (const { itemId, newDate } of resolved.rescheduledItems) {
        const platform = selectedPlatforms.find((p) =>
          p.platform === (itemId === 'temp-conflict-check' ? formData.platforms?.[0] : p.platform)
        );
        if (platform) {
          handlePlatformDateChange(
            platform.platform,
            newDate
          );
        }
      }
      setConflicts((prev) => prev.filter((c) => c.id !== resolution.id));
    }
  }, [selectedPlatforms, formData, handlePlatformDateChange]);

  // ============================================
  // Render
  // ============================================

  return (
    <div className={`content-scheduler ${className}`}>
      {/* Form Header */}
      <div className="space-y-4">
        {/* Title & Description */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('marketing-calendar:form.title')}
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
              placeholder={t('marketing-calendar:form.titlePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('marketing-calendar:form.description')}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
              placeholder={t('marketing-calendar:form.descriptionPlaceholder')}
            />
          </div>
        </div>

        {/* Content Type & Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('marketing-calendar:form.contentType')}
            </label>
            <select
              value={formData.contentType}
              onChange={(e) => setFormData((prev) => ({ ...prev, contentType: e.target.value as ContentType }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
            >
              {CONTENT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.icon} {type.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('marketing-calendar:form.priority')}
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData((prev) => ({ ...prev, priority: e.target.value as 'high' | 'medium' | 'low' }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
            >
              <option value="high">{t('marketing-calendar:priorities.high')}</option>
              <option value="medium">{t('marketing-calendar:priorities.medium')}</option>
              <option value="low">{t('marketing-calendar:priorities.low')}</option>
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('marketing-calendar:form.startDate')}
            </label>
            <input
              type="date"
              value={format(formData.startDate, 'yyyy-MM-dd')}
              onChange={(e) => setFormData((prev) => ({ ...prev, startDate: new Date(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('marketing-calendar:form.dueDate')}
            </label>
            <input
              type="date"
              value={formData.dueDate ? format(formData.dueDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, dueDate: e.target.value ? new Date(e.target.value) : undefined }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Platform Selection */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {t('marketing-calendar:platforms.title')}
          </h3>
          <button
            onClick={() => setShowPlatformSelector(!showPlatformSelector)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            {showPlatformSelector ? t('common:hide') : t('common:show')}
          </button>
        </div>

        {/* Selected Platforms */}
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedPlatforms.map((platform) => (
            <div
              key={platform.platform}
              className="inline-flex items-center gap-2 px-3 py-2 bg-primary-100 dark:bg-primary-900/20 rounded-full"
            >
              <span className="font-medium text-primary-800 dark:text-primary-200">
                {platform.platform}
              </span>
              <button
                onClick={() => handlePlatformToggle(platform.platform)}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200"
              >
                ×
              </button>
            </div>
          ))}
          {selectedPlatforms.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('marketing-calendar:platforms.noneSelected')}
            </p>
          )}
        </div>

        {/* Platform Selector */}
        {showPlatformSelector && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {PLATFORMS.map((platform) => {
              const isSelected = selectedPlatforms.some((p) => p.platform === platform.id);
              return (
                <button
                  key={platform.id}
                  onClick={() => handlePlatformToggle(platform.id)}
                  className={`
                    flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all
                    ${isSelected
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600'
                    }
                  `}
                >
                  <span className="text-2xl">{platform.icon}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {platform.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Platform Scheduling */}
      {selectedPlatforms.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
            {t('marketing-calendar:scheduling.title')}
          </h3>

          {/* Bulk Date Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('marketing-calendar:scheduling.bulkDate')}
            </label>
            <input
              type="date"
              value={bulkScheduleDate ? format(bulkScheduleDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => handleBulkDateChange(e.target.value ? new Date(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Individual Platform Scheduling */}
          <div className="space-y-2">
            {selectedPlatforms.map((platform) => (
              <div
                key={platform.platform}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {PLATFORMS.find((p) => p.id === platform.platform)?.icon}
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {platform.platform}
                    </span>
                  </div>
                  {platform.scheduledDate && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {format(platform.scheduledDate, 'MMM dd, yyyy')}
                    </div>
                  )}
                </div>
                <div>
                  <input
                    type="date"
                    value={platform.scheduledDate ? format(platform.scheduledDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => handlePlatformDateChange(platform.platform, e.target.value ? new Date(e.target.value) : undefined)}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conflicts Display */}
      {conflicts.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-3">
            {t('marketing-calendar:conflicts.detected')}
          </h3>
          <div className="space-y-2">
            {conflicts.map((conflict) => (
              <div
                key={conflict.id}
                className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
              >
                <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                  {conflict.message}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResolveConflict(conflict)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
                  >
                    {t('marketing-calendar:conflicts.autoResolve')}
                  </button>
                  <button
                    onClick={() => setConflicts((prev) => prev.filter((c) => c.id !== conflict.id))}
                    className="px-3 py-1 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-sm rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                  >
                    {t('common:dismiss')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {t('common:cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={!formData.title.trim() || selectedPlatforms.length === 0 || conflicts.length > 0}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('common:save')}
        </button>
      </div>
    </div>
  );
}

// ============================================
// Export types
// ============================================

export type { ContentSchedulerProps, PlatformSchedule };
