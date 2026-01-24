import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';

import { CONTENT_TYPES, SOCIAL_PLATFORMS } from '../../../shared/constants/content-calendar';
import { ROADMAP_STATUS_COLUMNS } from '../../../shared/constants/roadmap';
import { ROADMAP_PRIORITY_LABELS } from '../../../shared/constants/roadmap';
import type { ContentCampaign } from '../../../shared/types/content-calendar';

interface CampaignDialogProps {
  campaign: ContentCampaign;
  onClose: () => void;
  onSave: (updates: Partial<ContentCampaign>) => void;
}

/**
 * Campaign Dialog Component
 * Dialog for viewing and editing campaign details
 */
export function CampaignDialog({
  campaign,
  onClose,
  onSave
}: CampaignDialogProps): JSX.Element {
  const { t } = useTranslation(['contentCalendar', 'roadmap', 'common']);

  const [formData, setFormData] = useState({
    title: campaign.title,
    description: campaign.description || '',
    contentType: campaign.contentType,
    status: campaign.status,
    priority: campaign.priority,
    scheduledDate: campaign.scheduledDate
      ? new Date(campaign.scheduledDate).toISOString().split('T')[0]
      : '',
    dueDate: campaign.dueDate
      ? new Date(campaign.dueDate).toISOString().split('T')[0]
      : '',
    estimatedHours: campaign.estimatedHours || '',
    platforms: campaign.platforms || []
  });

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    campaign.platforms || []
  );

  const handleSave = () => {
    const updates: Partial<ContentCampaign> = {
      title: formData.title,
      description: formData.description,
      contentType: formData.contentType,
      status: formData.status,
      priority: formData.priority,
      platforms: selectedPlatforms
    };

    if (formData.scheduledDate) {
      updates.scheduledDate = new Date(formData.scheduledDate);
    }

    if (formData.dueDate) {
      updates.dueDate = new Date(formData.dueDate);
    }

    if (formData.estimatedHours) {
      updates.estimatedHours = parseFloat(formData.estimatedHours);
    }

    onSave(updates);
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('contentCalendar:dialog.editTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('contentCalendar:dialog.editDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('contentCalendar:dialog.title')}</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={t('contentCalendar:dialog.titlePlaceholder')}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('contentCalendar:dialog.description')}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('contentCalendar:dialog.descriptionPlaceholder')}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Content Type */}
            <div className="space-y-2">
              <Label htmlFor="contentType">{t('contentCalendar:dialog.contentType')}</Label>
              <Select
                value={formData.contentType}
                onValueChange={(value) => setFormData({ ...formData, contentType: value as any })}
              >
                <SelectTrigger id="contentType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTENT_TYPES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className="h-4 w-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">{t('contentCalendar:dialog.status')}</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as any })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROADMAP_STATUS_COLUMNS.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">{t('contentCalendar:dialog.priority')}</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value as any })}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROADMAP_PRIORITY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estimated Hours */}
            <div className="space-y-2">
              <Label htmlFor="estimatedHours">{t('contentCalendar:dialog.estimatedHours')}</Label>
              <Input
                id="estimatedHours"
                type="number"
                min="0"
                step="0.5"
                value={formData.estimatedHours}
                onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Scheduled Date */}
            <div className="space-y-2">
              <Label htmlFor="scheduledDate">{t('contentCalendar:dialog.scheduledDate')}</Label>
              <Input
                id="scheduledDate"
                type="date"
                value={formData.scheduledDate}
                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
              />
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">{t('contentCalendar:dialog.dueDate')}</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>

          {/* Platforms (for social media) */}
          {formData.contentType === 'social' && (
            <div className="space-y-2">
              <Label>{t('contentCalendar:dialog.platforms')}</Label>
              <div className="flex flex-wrap gap-2">
                {SOCIAL_PLATFORMS.map((platform) => {
                  const isSelected = selectedPlatforms.includes(platform.id);
                  const Icon = platform.icon;

                  return (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => togglePlatform(platform.id)}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                        border transition-colors
                        ${isSelected
                          ? `${platform.color} bg-background`
                          : 'bg-muted/50 hover:bg-muted'
                        }
                      `}
                    >
                      <Icon className="h-4 w-4" />
                      {platform.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common:buttons.cancel')}
          </Button>
          <Button onClick={handleSave}>
            {t('common:buttons.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
