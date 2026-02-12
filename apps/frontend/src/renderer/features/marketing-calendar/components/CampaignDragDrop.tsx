/**
 * Campaign Drag & Drop Component
 * Provides drag-and-drop functionality for calendar items
 *
 * Features:
 * - Visual feedback during drag operations
 * - Drop zone highlighting
 * - Conflict detection on drop
 * - Platform-specific drop zones
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarketingCalendarStore } from '../stores/marketingCalendarStore';
import type {
  MarketingCalendarItem,
  SocialPlatform,
  DragDropContext,
} from '../../../../shared/types/marketing-calendar';
import { format, isSameDay } from 'date-fns';

// ============================================
// Types
// ============================================

interface CampaignDragDropProps {
  className?: string;
  onDrop?: (itemId: string, targetDate: Date, platform?: SocialPlatform) => void;
  enablePlatformDrop?: boolean; // Show platform-specific drop zones
}

interface DragOverlayProps {
  isDragOver: boolean;
  targetDate?: Date;
  platform?: SocialPlatform;
}

// ============================================
// Drag Overlay Component
// ============================================

function DragOverlay({ isDragOver, targetDate, platform }: DragOverlayProps) {
  const { t } = useTranslation(['marketing-calendar', 'common']);

  if (!isDragOver) return null;

  return (
    <div className="drag-overlay absolute inset-0 bg-primary-500/10 border-2 border-dashed border-primary-500 rounded-lg flex items-center justify-center z-10">
      <div className="text-center">
        <div className="text-2xl mb-2">📅</div>
        <p className="text-sm font-medium text-primary-700 dark:text-primary-300">
          {t('marketing-calendar:dropHere')}
        </p>
        {targetDate && (
          <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
            {format(targetDate, 'MMM dd, yyyy')}
          </p>
        )}
        {platform && (
          <span className="inline-block mt-2 px-2 py-1 bg-primary-100 dark:bg-primary-900 rounded text-xs text-primary-800 dark:text-primary-200">
            {platform}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// Platform Drop Zone
// ============================================

interface PlatformDropZoneProps {
  platform: SocialPlatform;
  date: Date;
  isDragOver: boolean;
  onDrop: (platform: SocialPlatform, date: Date) => void;
  onDragOver: (platform: SocialPlatform, date: Date) => void;
  onDragLeave: () => void;
}

function PlatformDropZone({
  platform,
  date,
  isDragOver,
  onDrop,
  onDragOver,
  onDragLeave,
}: PlatformDropZoneProps) {
  const { t } = useTranslation(['marketing-calendar', 'common']);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver(platform, date);
  }, [platform, date, onDragOver]);

  const handleDragLeave = useCallback(() => {
    onDragLeave();
  }, [onDragLeave]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('application/json');
    if (itemId) {
      onDrop(platform, date);
    }
  }, [onDrop]);

  const platformConfig = {
    twitter: { icon: '𝕏', color: 'text-blue-400', bgColor: 'hover:bg-blue-50 dark:hover:bg-blue-900/20' },
    linkedin: { icon: 'in', color: 'text-blue-600', bgColor: 'hover:bg-blue-50 dark:hover:bg-blue-900/20' },
    facebook: { icon: 'f', color: 'text-blue-500', bgColor: 'hover:bg-blue-50 dark:hover:bg-blue-900/20' },
    instagram: { icon: '📷', color: 'text-pink-500', bgColor: 'hover:bg-pink-50 dark:hover:bg-pink-900/20' },
    youtube: { icon: '▶️', color: 'text-red-600', bgColor: 'hover:bg-red-50 dark:hover:bg-red-900/20' },
    tiktok: { icon: '🎵', color: 'text-gray-800', bgColor: 'hover:bg-gray-50 dark:hover:bg-gray-900/20' },
  };

  const config = platformConfig[platform] || platformConfig.twitter;

  return (
    <div
      ref={dropZoneRef}
      className={`
        platform-drop-zone relative p-3 border-2 border-dashed rounded-lg transition-all
        ${isDragOver ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700'}
        ${!isDragOver ? config.bgColor : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center gap-2">
        <span className={`text-2xl ${config.color}`}>{config.icon}</span>
        <span className="text-sm font-medium capitalize text-gray-700 dark:text-gray-300">
          {platform}
        </span>
        {isDragOver && (
          <span className="text-xs text-primary-600 dark:text-primary-400">
            {t('marketing-calendar:dropToSchedule')}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// Main CampaignDragDrop Component
// ============================================

export function CampaignDragDrop({
  className = '',
  onDrop: externalOnDrop,
  enablePlatformDrop = false,
}: CampaignDragDropProps) {
  const { t } = useTranslation(['marketing-calendar', 'common']);

  // Store state
  const dragDrop = useMarketingCalendarStore((state) => state.dragDrop);
  const startDrag = useMarketingCalendarStore((state) => state.startDrag);
  const endDrag = useMarketingCalendarStore((state) => state.endDrag);
  const handleDrop = useMarketingCalendarStore((state) => state.handleDrop);

  // Local state for platform drop zones
  const [platformDropZone, setPlatformDropZone] = useState<{
    platform: SocialPlatform | null;
    date: Date | null;
  }>({
    platform: null,
    date: null,
  });

  // Handle drag start from store
  useEffect(() => {
    if (dragDrop.isDragOver && dragDrop.draggedItem) {
      // Add drag ghost image
      document.body.classList.add('dragging-calendar-item');
    } else {
      document.body.classList.remove('dragging-calendar-item');
    }
  }, [dragDrop.isDragOver, dragDrop.draggedItem]);

  // Handle drop from store
  const handleInternalDrop = useCallback((
    itemId: string,
    targetDate: Date,
    platform?: SocialPlatform
  ) => {
    // Call external handler if provided
    if (externalOnDrop) {
      externalOnDrop(itemId, targetDate, platform);
    }

    // Call store handler
    handleDrop(itemId, targetDate);

    // Reset platform drop zone
    setPlatformDropZone({ platform: null, date: null });
  }, [externalOnDrop, handleDrop]);

  // Handle platform drop zone drag over
  const handlePlatformDragOver = useCallback((platform: SocialPlatform, date: Date) => {
    setPlatformDropZone({ platform, date });
  }, []);

  const handlePlatformDragLeave = useCallback(() => {
    setPlatformDropZone({ platform: null, date: null });
  }, []);

  return (
    <div className={`campaign-drag-drop ${className}`}>
      {/* Calendar-wide drop overlay */}
      {dragDrop.isDragOver && !platformDropZone.platform && (
        <DragOverlay
          isDragOver={dragDrop.isDragOver}
          targetDate={dragDrop.dropTargetDate}
        />
      )}

      {/* Platform-specific drop zones */}
      {enablePlatformDrop && dragDrop.isDragOver && (
        <div className="platform-drop-zones mt-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('marketing-calendar:scheduleForPlatform')}
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {(['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'] as SocialPlatform[]).map((platform) => (
              <PlatformDropZone
                key={platform}
                platform={platform}
                date={new Date()}
                isDragOver={platformDropZone.platform === platform}
                onDrop={handleInternalDrop}
                onDragOver={handlePlatformDragOver}
                onDragLeave={handlePlatformDragLeave}
              />
            ))}
          </div>
        </div>
      )}

      {/* Dragged item preview */}
      {dragDrop.draggedItem && (
        <div className="dragged-item-preview fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-50 max-w-xs">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('marketing-calendar:dragging')}
          </div>
          <div className="font-medium text-sm">{dragDrop.draggedItem.title}</div>
          {dragDrop.draggedItem.description && (
            <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
              {dragDrop.draggedItem.description}
            </div>
          )}
          {dragDrop.draggedItem.platforms && dragDrop.draggedItem.platforms.length > 0 && (
            <div className="flex gap-1 mt-2">
              {dragDrop.draggedItem.platforms.map((p) => (
                <span key={p} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Drag Handle Component
// ============================================

interface DragHandleProps {
  item: MarketingCalendarItem;
  className?: string;
  children?: React.ReactNode;
}

export function DragHandle({ item, className = '', children }: DragHandleProps) {
  const startDrag = useMarketingCalendarStore((state) => state.startDrag);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', item.id);
    e.dataTransfer.setData('text/plain', JSON.stringify(item));

    // Set drag image
    startDrag(item);
  }, [item, startDrag]);

  const handleDragEnd = useCallback(() => {
    // Drag end is handled by the store
  }, []);

  return (
    <div
      className={`drag-handle cursor-move ${className}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children || (
        <div className="drag-handle-icon">
          ⋮⋮
        </div>
      )}
    </div>
  );
}

// ============================================
// Drop Zone Component
// ============================================

interface DropZoneProps {
  date: Date;
  className?: string;
  children?: React.ReactNode;
}

export function DropZone({ date, className = '', children }: DropZoneProps) {
  const { t } = useTranslation(['marketing-calendar', 'common']);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const itemId = e.dataTransfer.getData('application/json');
    if (itemId) {
      // Handle the drop via store
      const store = useMarketingCalendarStore.getState();
      store.handleDrop(itemId, date);
    }
  }, [date]);

  return (
    <div
      ref={dropZoneRef}
      className={`
        drop-zone relative transition-all
        ${isDragOver ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
        ${className}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary-500/10 border-2 border-dashed border-primary-500 rounded-lg z-10">
          <div className="text-center bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-lg">
            <p className="text-sm font-medium text-primary-700 dark:text-primary-300">
              {format(date, 'MMM dd')}
            </p>
            <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
              {t('marketing-calendar:dropToSchedule')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Drag Context Provider
// ============================================

interface DragContextProviderProps {
  children: React.ReactNode;
}

export function DragContextProvider({ children }: DragContextProviderProps) {
  const dragDrop = useMarketingCalendarStore((state) => state.dragDrop);

  return (
    <div
      className={`drag-context ${dragDrop.isDragOver ? 'is-dragging' : ''}`}
    >
      {children}
    </div>
  );
}

// ============================================
// Exports
// ============================================

export type { DragOverlayProps, PlatformDropZoneProps, DragHandleProps, DropZoneProps, DragContextProviderProps };
