import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

import { CONTENT_TYPES } from '../../../shared/constants/content-calendar';
import type { ScheduleConflict } from '../../../shared/types/content-calendar';

interface ConflictDialogProps {
  conflicts: ScheduleConflict[];
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Conflict Dialog Component
 * Shows scheduling conflicts and asks for user resolution
 */
export function ConflictDialog({
  conflicts,
  onConfirm,
  onCancel
}: ConflictDialogProps): JSX.Element {
  const { t } = useTranslation(['contentCalendar', 'common']);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <DialogTitle>
              {t('contentCalendar:conflicts.title')}
            </DialogTitle>
          </div>
          <DialogDescription>
            {t('contentCalendar:conflicts.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4">
          {conflicts.map((conflict) => (
            <div
              key={conflict.campaignId}
              className={`
                p-4 rounded-lg border
                ${conflict.severity === 'error'
                  ? 'bg-destructive/10 border-destructive/30'
                  : 'bg-warning/10 border-warning/30'
                }
              `}
            >
              <p className="font-medium mb-3">
                {conflict.message}
              </p>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('contentCalendar:conflicts.conflictingWith')}:
                </p>

                {conflict.conflictingCampaigns.map((campaign) => {
                  const config = CONTENT_TYPES[campaign.contentType];

                  return (
                    <div
                      key={campaign.id}
                      className={`
                        flex items-center gap-2 p-2 rounded-md
                        ${config.bgColor}
                      `}
                    >
                      <config.icon className="h-4 w-4" />
                      <span className="font-medium text-sm flex-1">
                        {campaign.title}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {campaign.contentType}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('common:buttons.cancel')}
          </Button>
          <Button variant="default" onClick={onConfirm}>
            {t('contentCalendar:conflicts.scheduleAnyway')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
