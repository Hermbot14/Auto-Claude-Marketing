import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addDays,
  differenceInDays,
} from 'date-fns';
import {
  Calendar,
  Clock,
  FileText,
  Share2,
  Mail,
  Video,
  Instagram,
  Linkedin,
  Facebook,
  Twitter,
  Youtube,
  CheckCircle,
  Circle,
  AlertCircle,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  CalendarClock,
} from 'lucide-react';
import { useCalendarStore } from '../../stores/calendarStore';
import { CALENDAR_COLORS, CALENDAR_ITEM_TYPE_LABELS } from '../../../shared/constants';
import type { CalendarItem, CalendarItemType } from '../../../shared/types';

// Content channel types
export type ContentChannel =
  | 'blog'
  | 'instagram'
  | 'linkedin'
  | 'twitter'
  | 'facebook'
  | 'youtube'
  | 'email'
  | 'other';

export type ContentStatus = 'draft' | 'scheduled' | 'published' | 'cancelled';

// Content type badge config
const CONTENT_TYPE_CONFIG: Record<
  ContentChannel,
  { label: string; icon: typeof FileText; color: string; gradient: string }
> = {
  blog: { label: 'Blog', icon: FileText, color: '#3B82F6', gradient: 'linear-gradient(135deg, #3B82F6, #60A5FA)' },
  instagram: { label: 'Instagram', icon: Instagram, color: '#E1306C', gradient: 'linear-gradient(135deg, #E1306C, #F77737)' },
  linkedin: { label: 'LinkedIn', icon: Linkedin, color: '#0077B5', gradient: 'linear-gradient(135deg, #0077B5, #00A0DC)' },
  twitter: { label: 'X/Twitter', icon: Twitter, color: '#1DA1F2', gradient: 'linear-gradient(135deg, #1DA1F2, #14171A)' },
  facebook: { label: 'Facebook', icon: Facebook, color: '#1877F2', gradient: 'linear-gradient(135deg, #1877F2, #42B72A)' },
  youtube: { label: 'YouTube', icon: Youtube, color: '#FF0000', gradient: 'linear-gradient(135deg, #FF0000, #282828)' },
  email: { label: 'Email', icon: Mail, color: '#10B981', gradient: 'linear-gradient(135deg, #10B981, #34D399)' },
  other: { label: 'Other', icon: FileText, color: '#6B7280', gradient: 'linear-gradient(135deg, #6B7280, #9CA3AF)' },
};

// Status indicator config
const STATUS_CONFIG: Record<
  ContentStatus,
  { label: string; icon: typeof Circle; color: string; bgClass: string }
> = {
  draft: { label: 'Draft', icon: Circle, color: '#6B7280', bgClass: 'bg-gray-500/20' },
  scheduled: { label: 'Scheduled', icon: CalendarClock, color: '#3B82F6', bgClass: 'bg-blue-500/20' },
  published: { label: 'Published', icon: CheckCircle, color: '#10B981', bgClass: 'bg-emerald-500/20' },
  cancelled: { label: 'Cancelled', icon: AlertCircle, color: '#EF4444', bgClass: 'bg-red-500/20' },
};

interface ContentPublishingCalendarProps {
  projectId: string;
  onItemEdit?: (item: CalendarItem) => void;
  onItemDelete?: (itemId: string) => void;
  onBulkReschedule?: (itemIds: string[], newDate: Date) => void;
}

export function ContentPublishingCalendar({
  projectId,
  onItemEdit,
  onItemDelete,
  onBulkReschedule,
}: ContentPublishingCalendarProps) {
  const { calendarData, updateItem, deleteItem, getFilteredItems, addItem } = useCalendarStore();

  // UI State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedChannels, setSelectedChannels] = useState<ContentChannel[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<ContentStatus[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkRescheduleModal, setShowBulkRescheduleModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);
  const [bulkRescheduleDate, setBulkRescheduleDate] = useState<Date | null>(null);

  // Get content items for current month
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Filter and group content items
  const contentItemsByDay = useMemo(() => {
    const filtered = getFilteredItems().filter(
      (item) => item.type === 'content' || item.type === 'social' || item.type === 'email'
    );

    const grouped: Record<string, CalendarItem[]> = {};

    filtered.forEach((item) => {
      const dateKey = format(item.startDate, 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }

      // Apply channel filter
      if (selectedChannels.length > 0) {
        const itemChannel = getChannelFromItem(item);
        if (!selectedChannels.includes(itemChannel)) {
          return;
        }
      }

      // Apply status filter
      if (selectedStatuses.length > 0) {
        if (!selectedStatuses.includes(item.status as ContentStatus)) {
          return;
        }
      }

      grouped[dateKey].push(item);
    });

    return grouped;
  }, [getFilteredItems, selectedChannels, selectedStatuses]);

  // Get channel from calendar item
  function getChannelFromItem(item: CalendarItem): ContentChannel {
    const channelTag = item.tags?.find((t) =>
      ['blog', 'instagram', 'linkedin', 'twitter', 'facebook', 'youtube', 'email'].includes(t.toLowerCase())
    );
    return (channelTag?.toLowerCase() as ContentChannel) || 'other';
  }

  // Toggle item selection
  function toggleItemSelection(itemId: string) {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
    setShowBulkActions(newSelection.size > 0);
  }

  // Toggle select all visible
  function toggleSelectAll() {
    const allItemIds = Object.values(contentItemsByDay).flat().map((item) => item.id);
    if (selectedItems.size === allItemIds.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(allItemIds));
    }
    setShowBulkActions(true);
  }

  // Handle bulk reschedule
  function handleBulkReschedule() {
    if (bulkRescheduleDate && selectedItems.size > 0) {
      selectedItems.forEach((itemId) => {
        updateItem(itemId, {
          startDate: bulkRescheduleDate,
        });
      });

      if (onBulkReschedule) {
        onBulkReschedule(Array.from(selectedItems), bulkRescheduleDate);
      }

      setSelectedItems(new Set());
      setShowBulkActions(false);
      setShowBulkRescheduleModal(false);
      setBulkRescheduleDate(null);
    }
  }

  // Duplicate item with offset
  function duplicateWithOffset(item: CalendarItem, offsetDays: number) {
    const newItem = {
      ...item,
      title: `${item.title} (Copy)`,
      startDate: addDays(item.startDate, offsetDays),
      endDate: item.endDate ? addDays(item.endDate, offsetDays) : undefined,
    };
    addItem(newItem);
  }

  // Get content type badge component
  function getChannelBadge(channel: ContentChannel) {
    const config = CONTENT_TYPE_CONFIG[channel];
    const Icon = config.icon;

    return (
      <div
        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
        style={{ background: config.gradient }}
      >
        <Icon className="h-3 w-3" />
        <span>{config.label}</span>
      </div>
    );
  }

  // Get status indicator component
  function getStatusIndicator(status: ContentStatus) {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;

    return (
      <div
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgClass}`}
        style={{ color: config.color }}
      >
        <Icon className="h-3 w-3" />
        <span>{config.label}</span>
      </div>
    );
  }

  // Render day cell
  function renderDayCell(date: Date) {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayItems = contentItemsByDay[dateKey] || [];
    const isCurrentMonth = isSameDay(date, currentDate);

    return (
      <div
        key={dateKey}
        className={`min-h-32 p-2 border-b border-r ${
          isCurrentMonth ? 'bg-background' : 'bg-muted/30'
        } ${isToday(date) ? 'bg-primary/5' : ''}`}
      >
        {/* Date header */}
        <div className={`flex items-center justify-between mb-2`}>
          <span
            className={`text-sm font-medium ${
              isToday(date) ? 'text-primary' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {format(date, 'd')}
          </span>
          {isToday(date) && (
            <span className="text-xs text-primary font-medium">Today</span>
          )}
        </div>

        {/* Content items */}
        <div className="space-y-1">
          <AnimatePresence>
            {dayItems.map((item, index) => {
              const channel = getChannelFromItem(item);
              const isSelected = selectedItems.has(item.id);

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (showBulkActions) {
                      toggleItemSelection(item.id);
                    } else {
                      setEditingItem(item);
                      setShowEditModal(true);
                    }
                  }}
                  className={`
                    p-2 rounded-lg border cursor-pointer transition-all
                    ${isSelected ? 'ring-2 ring-primary ring-offset-2' : 'hover:shadow-sm'}
                  `}
                  style={{
                    background: CONTENT_TYPE_CONFIG[channel].gradient,
                    borderColor: isSelected ? CONTENT_TYPE_CONFIG[channel].color : 'transparent',
                  }}
                >
                  {/* Selection checkbox */}
                  {showBulkActions && (
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItemSelection(item.id)}
                        className="mt-0.5 h-4 w-4 rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}

                  {/* Content title */}
                  <div className="text-white text-xs font-medium truncate">{item.title}</div>

                  {/* Channel and status badges */}
                  <div className="flex items-center gap-1 mt-1">
                    {getChannelBadge(channel)}
                    {getStatusIndicator(item.status as ContentStatus)}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Content Publishing Calendar</h2>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentDate(addDays(currentDate, -30))}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <Calendar className="h-4 w-4" />
            </motion.button>
            <span className="text-sm font-medium px-2">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentDate(addDays(currentDate, 30))}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <Calendar className="h-4 w-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentDate(new Date())}
              className="px-2 py-1 rounded-lg hover:bg-accent transition-colors text-xs font-medium"
            >
              Today
            </motion.button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Add */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowQuickAddModal(true)}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Quick Add
          </motion.button>

          {/* Bulk Selection Toggle */}
          {!showBulkActions && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowBulkActions(true)}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              title="Enable bulk selection"
            >
              <CheckSquare className="h-5 w-5" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/30">
        {/* Channel filters */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Channels:</span>
          <div className="flex flex-wrap gap-1">
            {Object.entries(CONTENT_TYPE_CONFIG).map(([key, config]) => {
              const isSelected = selectedChannels.includes(key as ContentChannel);
              const Icon = config.icon;

              return (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectedChannels((prev) =>
                      prev.includes(key as ContentChannel)
                        ? prev.filter((c) => c !== key)
                        : [...prev, key as ContentChannel]
                    );
                  }}
                  className={`
                    px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors
                    ${isSelected ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}
                  `}
                  style={isSelected ? { background: config.gradient } : {}}
                >
                  <Icon className="h-3 w-3" />
                  {config.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Status:</span>
          <div className="flex flex-wrap gap-1">
            {Object.entries(STATUS_CONFIG).map(([key, config]) => {
              const isSelected = selectedStatuses.includes(key as ContentStatus);
              const Icon = config.icon;

              return (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectedStatuses((prev) =>
                      prev.includes(key as ContentStatus)
                        ? prev.filter((s) => s !== key)
                        : [...prev, key as ContentStatus]
                    );
                  }}
                  className={`
                    px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors
                    ${isSelected ? '' : 'bg-muted text-muted-foreground hover:bg-muted/80'}
                  `}
                  style={isSelected ? { background: config.bgClass, color: config.color } : {}}
                >
                  <Icon className="h-3 w-3" />
                  {config.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Clear filters */}
        {(selectedChannels.length > 0 || selectedStatuses.length > 0) && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setSelectedChannels([]);
              setSelectedStatuses([]);
            }}
            className="px-2 py-1 rounded bg-muted text-xs font-medium"
          >
            Clear Filters
          </motion.button>
        )}
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {showBulkActions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-primary/10 border-b px-4 py-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedItems.size} items selected
                </span>

                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleSelectAll}
                    className="px-2 py-1 rounded bg-background text-xs font-medium hover:bg-accent"
                  >
                    Select All
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSelectedItems(new Set());
                      setShowBulkActions(false);
                    }}
                    className="px-2 py-1 rounded bg-background text-xs font-medium hover:bg-accent"
                  >
                    Clear Selection
                  </motion.button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Bulk Reschedule */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowBulkRescheduleModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1"
                >
                  <CalendarClock className="h-4 w-4" />
                  Reschedule
                </motion.button>

                {/* Bulk Delete */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (confirm(`Delete ${selectedItems.size} items?`)) {
                      selectedItems.forEach((itemId) => {
                        deleteItem(itemId);
                      });
                      setSelectedItems(new Set());
                      setShowBulkActions(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium flex items-center gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-full">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 auto-rows-fr">
            {/* Empty cells for days before month start */}
            {Array.from({
              length: startOfMonth(currentDate).getDay(),
            }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-32 p-2 border-b border-r bg-muted/10" />
            ))}

            {/* Actual days */}
            {monthDays.map((date) => renderDayCell(date))}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && editingItem && (
          <EditContentModal
            item={editingItem}
            onClose={() => {
              setShowEditModal(false);
              setEditingItem(null);
            }}
            onSave={(updates) => {
              updateItem(editingItem.id, updates);
              setShowEditModal(false);
              setEditingItem(null);
            }}
            onDelete={() => {
              deleteItem(editingItem.id);
              setShowEditModal(false);
              setEditingItem(null);
            }}
            onDuplicate={(offsetDays) => {
              duplicateWithOffset(editingItem, offsetDays);
              setShowEditModal(false);
              setEditingItem(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Bulk Reschedule Modal */}
      <AnimatePresence>
        {showBulkRescheduleModal && (
          <BulkRescheduleModal
            itemCount={selectedItems.size}
            onClose={() => {
              setShowBulkRescheduleModal(false);
              setBulkRescheduleDate(null);
            }}
            onConfirm={handleBulkReschedule}
            selectedDate={bulkRescheduleDate}
            onDateSelect={setBulkRescheduleDate}
          />
        )}
      </AnimatePresence>

      {/* Quick Add Modal */}
      <AnimatePresence>
        {showQuickAddModal && (
          <QuickAddContentModal
            onClose={() => setShowQuickAddModal(false)}
            onAdd={(newItem) => {
              addItem(newItem);
              setShowQuickAddModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Edit Content Modal Component
function EditContentModal({
  item,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
}: {
  item: CalendarItem;
  onClose: () => void;
  onSave: (updates: Partial<CalendarItem>) => void;
  onDelete: () => void;
  onDuplicate: (offsetDays: number) => void;
}) {
  const [editedItem, setEditedItem] = useState(item);
  const [showOffsetPicker, setShowOffsetPicker] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card border-l shadow-xl overflow-y-auto"
      >
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b p-4">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-semibold">Edit Content</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1 block">Title</label>
            <input
              type="text"
              value={editedItem.title}
              onChange={(e) => setEditedItem({ ...editedItem, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border bg-background"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <textarea
              value={editedItem.description || ''}
              onChange={(e) => setEditedItem({ ...editedItem, description: e.target.value })}
              className="w-full min-h-24 px-3 py-2 rounded-lg border bg-background resize-none"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium mb-1 block">Status</label>
            <select
              value={editedItem.status}
              onChange={(e) =>
                setEditedItem({ ...editedItem, status: e.target.value as ContentStatus })
              }
              className="w-full px-3 py-2 rounded-lg border bg-background"
            >
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Publish Date */}
          <div>
            <label className="text-sm font-medium mb-1 block">Publish Date</label>
            <input
              type="date"
              value={format(editedItem.startDate, 'yyyy-MM-dd')}
              onChange={(e) =>
                setEditedItem({ ...editedItem, startDate: new Date(e.target.value) })
              }
              className="w-full px-3 py-2 rounded-lg border bg-background"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-4 border-t">
            <button
              onClick={() => onSave(editedItem)}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
            >
              Save Changes
            </button>
            <button
              onClick={() => setShowOffsetPicker(!showOffsetPicker)}
              className="px-4 py-2 rounded-lg bg-muted font-medium flex items-center gap-1"
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </button>
          </div>

          {/* Duplicate offset picker */}
          {showOffsetPicker && (
            <div className="p-4 rounded-lg bg-muted space-y-2">
              <label className="text-sm font-medium">Duplicate with offset (days):</label>
              <div className="flex flex-wrap gap-2">
                {[1, 7, 14, 30].map((offset) => (
                  <button
                    key={offset}
                    onClick={() => {
                      onDuplicate(offset);
                      onClose();
                    }}
                    className="px-3 py-1 rounded bg-background hover:bg-accent text-sm"
                  >
                    +{offset}d
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onDelete}
            className="w-full px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-medium"
          >
            Delete Content
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Bulk Reschedule Modal
function BulkRescheduleModal({
  itemCount,
  onClose,
  onConfirm,
  selectedDate,
  onDateSelect,
}: {
  itemCount: number;
  onClose: () => void;
  onConfirm: () => void;
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-lg shadow-xl max-w-md w-full p-6"
      >
        <h2 className="text-lg font-semibold mb-4">Reschedule {itemCount} Items</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">New Date</label>
            <input
              type="date"
              value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => onDateSelect(new Date(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border bg-background"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onConfirm}
              disabled={!selectedDate}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
            >
              Reschedule
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-muted font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Quick Add Content Modal
function QuickAddContentModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (item: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [channel, setChannel] = useState<ContentChannel>('blog');
  const [status, setStatus] = useState<ContentStatus>('draft');
  const [publishDate, setPublishDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleAdd = () => {
    if (!title.trim()) return;

    onAdd({
      title: title.trim(),
      description: description.trim() || undefined,
      type: 'content',
      status,
      source: 'manual',
      startDate: new Date(publishDate),
      allDay: true,
      tags: [channel],
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-lg shadow-xl max-w-md w-full p-6"
      >
        <h2 className="text-lg font-semibold mb-4">Quick Add Content</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter content title..."
              className="w-full px-3 py-2 rounded-lg border bg-background"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as ContentChannel)}
              className="w-full px-3 py-2 rounded-lg border bg-background"
            >
              {Object.entries(CONTENT_TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
              className="w-full px-3 py-2 rounded-lg border bg-background"
            >
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Publish Date</label>
            <input
              type="date"
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description..."
              className="w-full min-h-20 px-3 py-2 rounded-lg border bg-background resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={!title.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
            >
              Add Content
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-muted font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Icons
import { Plus, CheckSquare, X } from 'lucide-react';
