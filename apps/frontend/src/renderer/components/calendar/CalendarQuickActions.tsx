import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  format,
  addDays,
  addWeeks,
  addMonths,
  startOfWeek,
  endOfWeek,
  isSameDay,
} from 'date-fns';
import {
  Plus,
  Copy,
  Edit3,
  Trash2,
  Calendar,
  Clock,
  Zap,
  FileText,
  Mail,
  Share2,
  Video,
  Megaphone,
  Search,
  X,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useCalendarStore } from '../../../stores/calendarStore';
import { CALENDAR_ITEM_TYPE_LABELS } from '../../../shared/constants';
import type { CalendarItem, CalendarItemType } from '../../../shared/types';

// Content templates for quick creation
export interface ContentTemplate {
  id: string;
  name: string;
  type: CalendarItemType;
  channel: string;
  defaultTitle: string;
  defaultDescription?: string;
  defaultTags: string[];
  estimatedDuration: number; // in days
  icon: typeof FileText;
}

// Quick action templates
const CONTENT_TEMPLATES: ContentTemplate[] = [
  {
    id: 'blog-post',
    name: 'Blog Post',
    type: 'content',
    channel: 'blog',
    defaultTitle: 'New Blog Post',
    defaultDescription: 'Write about...',
    defaultTags: ['blog', 'content'],
    estimatedDuration: 3,
    icon: FileText,
  },
  {
    id: 'instagram-post',
    name: 'Instagram Post',
    type: 'social',
    channel: 'instagram',
    defaultTitle: 'Instagram Content',
    defaultDescription: 'Create engaging Instagram post...',
    defaultTags: ['instagram', 'social'],
    estimatedDuration: 1,
    icon: Share2,
  },
  {
    id: 'linkedin-post',
    name: 'LinkedIn Post',
    type: 'social',
    channel: 'linkedin',
    defaultTitle: 'LinkedIn Article/Post',
    defaultDescription: 'Share industry insights...',
    defaultTags: ['linkedin', 'social'],
    estimatedDuration: 1,
    icon: Share2,
  },
  {
    id: 'email-newsletter',
    name: 'Email Newsletter',
    type: 'email',
    channel: 'email',
    defaultTitle: 'Monthly Newsletter',
    defaultDescription: 'Newsletter content...',
    defaultTags: ['email', 'newsletter'],
    estimatedDuration: 2,
    icon: Mail,
  },
  {
    id: 'youtube-video',
    name: 'YouTube Video',
    type: 'content',
    channel: 'youtube',
    defaultTitle: 'New Video',
    defaultDescription: 'Video topic: ...',
    defaultTags: ['youtube', 'video'],
    estimatedDuration: 7,
    icon: Video,
  },
  {
    id: 'marketing-campaign',
    name: 'Marketing Campaign',
    type: 'campaign',
    channel: 'campaign',
    defaultTitle: 'New Campaign',
    defaultDescription: 'Campaign description...',
    defaultTags: ['campaign', 'marketing'],
    estimatedDuration: 14,
    icon: Megaphone,
  },
];

interface CalendarQuickActionsProps {
  projectId: string;
  onDateClick?: (date: Date) => void;
}

export function CalendarQuickActions({
  projectId,
  onDateClick,
}: CalendarQuickActionsProps) {
  const { addItem, updateItem, deleteItem, getFilteredItems } = useCalendarStore();

  // UI State
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    startDate: Date | null;
    endDate: Date | null;
  }>({
    isDragging: false,
    startDate: null,
    endDate: null,
  });

  // Create from template
  const createFromTemplate = (template: ContentTemplate, date: Date) => {
    const endDate = addDays(date, template.estimatedDuration);

    addItem({
      title: template.defaultTitle,
      description: template.defaultDescription,
      type: template.type,
      status: 'draft',
      source: 'manual',
      startDate: date,
      endDate,
      allDay: true,
      tags: [...template.defaultTags, template.channel],
    });
  };

  // Duplicate with offset
  const duplicateWithOffset = (item: CalendarItem, offsetDays: number) => {
    const newItem = {
      ...item,
      title: `${item.title} (Copy)`,
      startDate: addDays(item.startDate, offsetDays),
      endDate: item.endDate ? addDays(item.endDate, offsetDays) : undefined,
    };
    addItem(newItem);
  };

  // Bulk update selected items
  const bulkUpdate = (updates: Partial<CalendarItem>) => {
    selectedItems.forEach((itemId) => {
      updateItem(itemId, updates);
    });
    setSelectedItems(new Set());
    setShowBulkEdit(false);
  };

  // Handle drag to create
  const handleDragStart = (date: Date) => {
    setDragState({
      isDragging: true,
      startDate: date,
      endDate: null,
    });
  };

  const handleDragMove = (date: Date) => {
    if (dragState.isDragging && dragState.startDate) {
      setDragState({
        ...dragState,
        endDate: date,
      });
    }
  };

  const handleDragEnd = (date: Date) => {
    if (dragState.isDragging && dragState.startDate) {
      const start = dragState.startDate < date ? dragState.startDate : date;
      const end = dragState.startDate < date ? date : dragState.startDate;

      // Open quick add modal with pre-filled dates
      setSelectedDate(start);
      setShowQuickAdd(true);

      setDragState({
        isDragging: false,
        startDate: null,
        endDate: null,
      });
    }
  };

  return (
    <div className="relative">
      {/* Quick Add FAB */}
      <AnimatePresence>
        {!showQuickAdd && !showTemplates && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-40"
          >
            <div className="flex flex-col gap-2">
              {/* Template Button */}
              <motion.button
                initial={{ scale: 0, x: 20 }}
                animate={{ scale: 1, x: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowTemplates(!showTemplates)}
                className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg flex items-center justify-center"
                title="Templates"
              >
                <FileText className="h-6 w-6" />
              </motion.button>

              {/* Quick Add Button */}
              <motion.button
                initial={{ scale: 0, x: 20 }}
                animate={{ scale: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowQuickAdd(!showQuickAdd)}
                className="w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center"
                title="Quick Add"
              >
                <Plus className="h-7 w-7" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Templates Menu */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-40 bg-card rounded-lg shadow-xl border p-2 w-64"
          >
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-sm font-semibold">Quick Templates</span>
              <button
                onClick={() => setShowTemplates(false)}
                className="p-1 rounded hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto">
              {CONTENT_TEMPLATES.map((template) => {
                const Icon = template.icon;

                return (
                  <motion.button
                    key={template.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      const date = selectedDate || new Date();
                      createFromTemplate(template, date);
                      setShowTemplates(false);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <div className="p-2 rounded bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{template.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {template.estimatedDuration} day{template.estimatedDuration > 1 ? 's' : ''}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-2 pt-2 border-t">
              <button
                onClick={() => {
                  setShowTemplates(false);
                  setShowQuickAdd(true);
                }}
                className="w-full flex items-center justify-center gap-2 p-2 rounded-lg hover:bg-accent text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Custom Item
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Add Modal */}
      <AnimatePresence>
        {showQuickAdd && (
          <QuickAddModal
            projectId={projectId}
            selectedDate={selectedDate}
            onClose={() => {
              setShowQuickAdd(false);
              setSelectedDate(null);
            }}
            onAdd={(itemData) => {
              addItem(itemData);
              setShowQuickAdd(false);
              setSelectedDate(null);
            }}
            onCreateFromTemplate={(template, date) => {
              createFromTemplate(template, date);
              setShowQuickAdd(false);
              setSelectedDate(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Bulk Edit Modal */}
      <AnimatePresence>
        {showBulkEdit && selectedItems.size > 0 && (
          <BulkEditModal
            itemCount={selectedItems.size}
            onClose={() => {
              setShowBulkEdit(false);
              setSelectedItems(new Set());
            }}
            onBulkUpdate={bulkUpdate}
          />
        )}
      </AnimatePresence>

      {/* Selection Mode Indicator */}
      <AnimatePresence>
        {selectedItems.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-lg p-4"
          >
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const offset = 7; // 1 week
                      selectedItems.forEach((itemId) => {
                        const item = getFilteredItems().find((i) => i.id === itemId);
                        if (item) {
                          duplicateWithOffset(item, offset);
                        }
                      });
                      setSelectedItems(new Set());
                    }}
                    className="px-3 py-1.5 rounded bg-muted text-sm font-medium hover:bg-accent"
                  >
                    Duplicate (+1w)
                  </button>
                  <button
                    onClick={() => setShowBulkEdit(true)}
                    className="px-3 py-1.5 rounded bg-muted text-sm font-medium hover:bg-accent"
                  >
                    Bulk Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${selectedItems.size} items?`)) {
                        selectedItems.forEach((itemId) => {
                          deleteItem(itemId);
                        });
                        setSelectedItems(new Set());
                      }
                    }}
                    className="px-3 py-1.5 rounded bg-destructive text-destructive-foreground text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <button
                onClick={() => setSelectedItems(new Set())}
                className="p-2 rounded hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag to create hint */}
      {dragState.isDragging && (
        <div className="fixed inset-0 z-30 bg-primary/5 pointer-events-none flex items-center justify-center">
          <div className="bg-card rounded-lg shadow-xl p-4 text-center">
            <Calendar className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium">Drag to select date range</p>
            {dragState.startDate && (
              <p className="text-xs text-muted-foreground mt-1">
                {format(dragState.startDate, 'MMM d')}
                {dragState.endDate && ` - ${format(dragState.endDate, 'MMM d')}`}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Quick Add Modal
function QuickAddModal({
  projectId,
  selectedDate,
  onClose,
  onAdd,
  onCreateFromTemplate,
}: {
  projectId: string;
  selectedDate: Date | null;
  onClose: () => void;
  onAdd: (item: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCreateFromTemplate: (template: ContentTemplate, date: Date) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CalendarItemType>('content');
  const [status, setStatus] = useState<'draft' | 'scheduled'>('draft');
  const [startDate, setStartDate] = useState(
    selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState('');
  const [tags, setTags] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const handleAdd = () => {
    if (!title.trim()) return;

    const itemData: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'> = {
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      status,
      source: 'manual',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      allDay: true,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    onAdd(itemData);
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
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold">Quick Add Item</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1 block">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title..."
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-sm font-medium mb-1 block">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CalendarItemType)}
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {Object.entries(CALENDAR_ITEM_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium mb-1 block">Status</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStatus('draft')}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  status === 'draft'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'hover:bg-accent'
                }`}
              >
                Draft
              </button>
              <button
                type="button"
                onClick={() => setStatus('scheduled')}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  status === 'scheduled'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'hover:bg-accent'
                }`}
              >
                Scheduled
              </button>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">End Date (optional)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium mb-1 block">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="blog, marketing, q1..."
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1 block">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description..."
              className="w-full min-h-20 px-3 py-2 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Template shortcut */}
          <div className="pt-2 border-t">
            <button
              type="button"
              onClick={() => setShowTemplatePicker(!showTemplatePicker)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm font-medium hover:bg-accent"
            >
              <Zap className="h-4 w-4" />
              Use Template
              {showTemplatePicker ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showTemplatePicker && (
              <div className="mt-2 space-y-1">
                {CONTENT_TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => onCreateFromTemplate(template, new Date(startDate))}
                      className="w-full flex items-center gap-2 p-2 rounded hover:bg-accent text-left"
                    >
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="text-sm">{template.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleAdd}
              disabled={!title.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
            >
              Add Item
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

// Bulk Edit Modal
function BulkEditModal({
  itemCount,
  onClose,
  onBulkUpdate,
}: {
  itemCount: number;
  onClose: () => void;
  onBulkUpdate: (updates: Partial<CalendarItem>) => void;
}) {
  const [status, setStatus] = useState<CalendarItem['status'] | ''>('');
  const [newDate, setNewDate] = useState('');
  const [tagsToAdd, setTagsToAdd] = useState('');

  const handleApply = () => {
    const updates: Partial<CalendarItem> = {};

    if (status) {
      updates.status = status;
    }

    if (newDate) {
      updates.startDate = new Date(newDate);
    }

    if (tagsToAdd) {
      updates.tags = tagsToAdd.split(',').map((t) => t.trim());
    }

    if (Object.keys(updates).length > 0) {
      onBulkUpdate(updates);
    }
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
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold">Bulk Edit {itemCount} Items</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Status Update */}
          <div>
            <label className="text-sm font-medium mb-1 block">Update Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CalendarItem['status'])}
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">No change</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Reschedule */}
          <div>
            <label className="text-sm font-medium mb-1 block">Reschedule To</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to keep current dates
            </p>
          </div>

          {/* Add Tags */}
          <div>
            <label className="text-sm font-medium mb-1 block">Add Tags</label>
            <input
              type="text"
              value={tagsToAdd}
              onChange={(e) => setTagsToAdd(e.target.value)}
              placeholder="tag1, tag2, tag3"
              className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              These will be added to existing tags
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleApply}
              disabled={!status && !newDate && !tagsToAdd}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
            >
              Apply Changes
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
