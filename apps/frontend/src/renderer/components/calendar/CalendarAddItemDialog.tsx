import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar as CalendarIcon, Clock, Tag, Link2, User, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import type { CalendarItem, CalendarItemType, CalendarItemStatus } from '../../../shared/types';
import { CALENDAR_COLORS, CALENDAR_ITEM_TYPE_LABELS } from '../../../shared/constants';

interface CalendarAddItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  defaultDate?: Date;
  isSubmitting?: boolean;
}

const ITEM_TYPES: CalendarItemType[] = ['campaign', 'content', 'social', 'email', 'seo', 'deadline', 'event'];
const ITEM_STATUSES: CalendarItemStatus[] = ['draft', 'scheduled', 'published', 'cancelled'];

export function CalendarAddItemDialog({ isOpen, onClose, onAdd, defaultDate = new Date(), isSubmitting = false }: CalendarAddItemDialogProps) {
  const { t } = useTranslation(['calendar', 'common']);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CalendarItemType>('campaign');
  const [status, setStatus] = useState<CalendarItemStatus>('draft');
  const [startDate, setStartDate] = useState(format(defaultDate, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState('');
  const [assignee, setAssignee] = useState('');
  const [notes, setNotes] = useState('');

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndType, setRecurrenceEndType] = useState<'never' | 'until' | 'count'>('never');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');
  const [recurrenceCount, setRecurrenceCount] = useState(10);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setType('campaign');
      setStatus('draft');
      setStartDate(format(defaultDate, 'yyyy-MM-dd'));
      setEndDate('');
      setAllDay(true);
      setStartTime('09:00');
      setEndTime('10:00');
      setPriority('medium');
      setLocation('');
      setTags('');
      setAssignee('');
      setNotes('');
      setIsRecurring(false);
      setRecurrenceFrequency('weekly');
      setRecurrenceInterval(1);
      setRecurrenceEndType('never');
      setRecurrenceUntil('');
      setRecurrenceCount(10);
    }
  }, [isOpen, defaultDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || isSubmitting) return;

    const newItem: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'> = {
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      status,
      source: 'manual',
      startDate: parseISO(`${startDate}T${allDay ? '00:00' : startTime}`),
      endDate: endDate ? parseISO(`${endDate}T${allDay ? '23:59' : endTime}`) : undefined,
      allDay,
      priority: priority === 'high',
      location: location.trim() || undefined,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      assignee: assignee.trim() || undefined,
      notes: notes.trim() || undefined,
      recurrence: isRecurring ? {
        frequency: recurrenceFrequency,
        interval: recurrenceInterval,
        ...(recurrenceEndType === 'until' && recurrenceUntil ? {
          until: parseISO(recurrenceUntil)
        } : {}),
        ...(recurrenceEndType === 'count' ? {
          count: recurrenceCount
        } : {}),
      } : undefined,
    };

    onAdd(newItem);
    // Don't close immediately - let parent handle closing after save
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Dialog */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="dialog-title"
              aria-describedby="dialog-description"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div>
                  <h2 id="dialog-title" className="text-xl font-semibold">{t('calendar:dialog.addTitle')}</h2>
                  <p id="dialog-description" className="text-sm text-muted-foreground mt-0.5">
                    {t('calendar:dialog.addDescription')}
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={t('common:close')}
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-6">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Title <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter item title..."
                      className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      autoFocus
                      required
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add a description..."
                      rows={3}
                      className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Type & Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Type
                      </label>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as CalendarItemType)}
                        className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        {ITEM_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {CALENDAR_ITEM_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Status
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as CalendarItemStatus)}
                        className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        {ITEM_STATUSES.map((s) => (
                          <option key={s} value={s} className="capitalize">
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium">All Day</label>
                      <button
                        type="button"
                        onClick={() => setAllDay(!allDay)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          allDay ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <motion.div
                          animate={{ x: allDay ? 24 : 4 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute top-1 w-4 h-4 rounded-full bg-white"
                        />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Start Date <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          min={startDate}
                          className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>
                    </div>

                    {!allDay && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Start Time
                          </label>
                          <input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">
                            End Time
                          </label>
                          <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Priority
                    </label>
                    <div className="flex gap-2">
                      {(['low', 'medium', 'high'] as const).map((p) => (
                        <motion.button
                          key={p}
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setPriority(p)}
                          className={`flex-1 px-4 py-2 rounded-lg capitalize transition-colors ${
                            priority === p
                              ? p === 'high'
                                ? 'bg-red-500 text-white'
                                : p === 'medium'
                                ? 'bg-yellow-500 text-white'
                                : 'bg-green-500 text-white'
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                        >
                          {p}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Location
                      </div>
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Add location..."
                      className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Tags
                      </div>
                    </label>
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="marketing, q1, urgent (comma separated)"
                      className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  {/* Assignee */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Assignee
                      </div>
                    </label>
                    <input
                      type="text"
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                      placeholder="Assign to..."
                      className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Additional notes..."
                      rows={2}
                      className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Recurrence */}
                  <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <AlertCircle className="h-4 w-4 text-primary" />
                        Repeat Event
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsRecurring(!isRecurring)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          isRecurring ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <motion.div
                          animate={{ x: isRecurring ? 24 : 4 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute top-1 w-4 h-4 rounded-full bg-white"
                        />
                      </button>
                    </div>

                    {isRecurring && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4"
                      >
                        {/* Frequency */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-2">
                              Repeats
                            </label>
                            <select
                              value={recurrenceFrequency}
                              onChange={(e) => setRecurrenceFrequency(e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly')}
                              className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                            >
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                              <option value="yearly">Yearly</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-2">
                              Every
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                max={99}
                                value={recurrenceInterval}
                                onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-20 px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm text-center"
                              />
                              <span className="text-sm text-muted-foreground capitalize">
                                {recurrenceFrequency}{recurrenceInterval > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* End */}
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-2">
                            Ends
                          </label>
                          <div className="flex gap-2">
                            {(['never', 'until', 'count'] as const).map((endType) => (
                              <motion.button
                                key={endType}
                                type="button"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setRecurrenceEndType(endType)}
                                className={`px-3 py-2 rounded-lg text-sm capitalize transition-colors ${
                                  recurrenceEndType === endType
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted hover:bg-muted/80'
                                }`}
                              >
                                {endType === 'never' ? 'Never' : endType === 'until' ? 'On date' : 'After'}
                              </motion.button>
                            ))}
                          </div>
                        </div>

                        {recurrenceEndType === 'until' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            <input
                              type="date"
                              value={recurrenceUntil}
                              onChange={(e) => setRecurrenceUntil(e.target.value)}
                              min={startDate}
                              className="w-full px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                            />
                          </motion.div>
                        )}

                        {recurrenceEndType === 'count' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-2"
                          >
                            <span className="text-sm text-muted-foreground">After</span>
                            <input
                              type="number"
                              min={1}
                              max={999}
                              value={recurrenceCount}
                              onChange={(e) => setRecurrenceCount(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-24 px-3 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm text-center"
                            />
                            <span className="text-sm text-muted-foreground">occurrences</span>
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-muted/30">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="px-6 py-2 rounded-lg border hover:bg-accent transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={!title.trim() || isSubmitting}
                    className="px-6 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Add Item'
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
