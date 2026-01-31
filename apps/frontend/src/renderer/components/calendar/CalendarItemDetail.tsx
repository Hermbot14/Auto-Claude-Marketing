import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Edit2, Trash2, Calendar, Clock, MapPin, User, Tag, Link2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import type { CalendarItem as CalendarItemType } from '../../../shared/types';
import { CALENDAR_COLORS, CALENDAR_ITEM_TYPE_LABELS } from '../../../shared/constants';

interface CalendarItemDetailProps {
  item: CalendarItemType;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<Omit<CalendarItemType, 'id'>>) => void;
  onDelete: () => void;
}

export function CalendarItemDetail({ item, isOpen, onClose, onUpdate, onDelete }: CalendarItemDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedItem, setEditedItem] = useState(item);

  useEffect(() => {
    setEditedItem(item);
  }, [item]);

  const handleSave = () => {
    onUpdate(editedItem);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedItem(item);
    setIsEditing(false);
  };

  if (!isOpen) return null;

  const colors = CALENDAR_COLORS[item.type];

  return (
    <AnimatePresence>
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
          {/* Header */}
          <div className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium text-white"
                    style={{ background: colors.gradient }}
                  >
                    {CALENDAR_ITEM_TYPE_LABELS[item.type]}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs bg-muted">
                    {item.status}
                  </span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedItem.title}
                    onChange={(e) => setEditedItem({ ...editedItem, title: e.target.value })}
                    className="text-xl font-semibold bg-transparent border-b border-primary focus:outline-none w-full"
                    autoFocus
                  />
                ) : (
                  <h2 className="text-xl font-semibold">{item.title}</h2>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-accent transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-4">
              {isEditing ? (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSave}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
                  >
                    Save
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCancel}
                    className="px-3 py-1.5 rounded-lg bg-muted text-sm font-medium"
                  >
                    Cancel
                  </motion.button>
                </>
              ) : (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsEditing(true)}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onDelete}
                    className="p-2 rounded-lg hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </motion.button>
                </>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-6">
            {/* Description */}
            {isEditing ? (
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Description
                </label>
                <textarea
                  value={editedItem.description || ''}
                  onChange={(e) => setEditedItem({ ...editedItem, description: e.target.value })}
                  className="w-full min-h-24 p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Add a description..."
                />
              </div>
            ) : (
              item.description && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
                  <p className="text-sm whitespace-pre-wrap">{item.description}</p>
                </div>
              )
            )}

            {/* Date & Time */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Date & Time</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {isEditing ? (
                    <input
                      type="date"
                      value={format(editedItem.startDate, 'yyyy-MM-dd')}
                      onChange={(e) =>
                        setEditedItem({
                          ...editedItem,
                          startDate: new Date(e.target.value),
                        })
                      }
                      className="border rounded px-2 py-1 bg-background"
                    />
                  ) : (
                    <span>{format(item.startDate, 'EEEE, MMMM d, yyyy')}</span>
                  )}
                </div>
                {!item.allDay && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(item.startDate, 'h:mm a')}
                      {item.endDate && ` - ${format(item.endDate, 'h:mm a')}`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Location */}
            {item.location || isEditing ? (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Location</h3>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedItem.location || ''}
                    onChange={(e) => setEditedItem({ ...editedItem, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Add location..."
                  />
                ) : (
                  item.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{item.location}</span>
                    </div>
                  )
                )}
              </div>
            ) : null}

            {/* Assignee */}
            {item.assignee || isEditing ? (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Assignee</h3>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedItem.assignee || ''}
                    onChange={(e) => setEditedItem({ ...editedItem, assignee: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Add assignee..."
                  />
                ) : (
                  item.assignee && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{item.assignee}</span>
                    </div>
                  )
                )}
              </div>
            ) : null}

            {/* Tags */}
            {isEditing ? (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Tags</h3>
                <input
                  type="text"
                  value={editedItem.tags?.join(', ') || ''}
                  onChange={(e) =>
                    setEditedItem({
                      ...editedItem,
                      tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Add tags separated by commas..."
                />
              </div>
            ) : (
              item.tags && item.tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Tags</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 rounded bg-muted text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* Linked items */}
            {item.linkedFeatureId || item.linkedTaskId || item.linkedFileId ? (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Linked Items</h3>
                <div className="space-y-2">
                  {item.linkedFeatureId && (
                    <div className="flex items-center gap-2 text-sm p-2 rounded bg-muted">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      <span>Feature: {item.linkedFeatureId}</span>
                    </div>
                  )}
                  {item.linkedTaskId && (
                    <div className="flex items-center gap-2 text-sm p-2 rounded bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>Task: {item.linkedTaskId}</span>
                    </div>
                  )}
                  {item.linkedFileId && (
                    <div className="flex items-center gap-2 text-sm p-2 rounded bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>File: {item.linkedFileId}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Metadata */}
            <div className="pt-4 border-t">
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Source: {item.source}</div>
                <div>Created: {format(item.createdAt, 'MMM d, yyyy h:mm a')}</div>
                <div>Updated: {format(item.updatedAt, 'MMM d, yyyy h:mm a')}</div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
