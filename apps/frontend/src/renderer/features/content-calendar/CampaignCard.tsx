import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDraggable } from '@dnd-kit/core';
import { motion } from 'motion/react';

import { Badge } from '../../components/ui/badge';
import { CONTENT_TYPES } from '../../../shared/constants/content-calendar';
import { CALENDAR_STATUS_COLORS } from '../../../shared/constants/content-calendar';
import { ROADMAP_PRIORITY_COLORS } from '../../../shared/constants/roadmap';
import type { ContentCampaign } from '../../../shared/types/content-calendar';

interface CampaignCardProps {
  campaign: ContentCampaign;
  compact?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  showStatus?: boolean;
  showPriority?: boolean;
}

/**
 * Campaign Card Component
 * Displays a single campaign as a card or calendar item
 */
export function CampaignCard({
  campaign,
  compact = false,
  onClick,
  showStatus = true,
  showPriority = false
}: CampaignCardProps): JSX.Element {
  const { t } = useTranslation(['contentCalendar', 'roadmap']);

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging
  } = useDraggable({
    id: campaign.id,
    data: {
      campaign
    }
  });

  const contentTypeConfig = CONTENT_TYPES[campaign.contentType];
  const statusColor = CALENDAR_STATUS_COLORS[campaign.status];
  const priorityColor = ROADMAP_PRIORITY_COLORS[campaign.priority];

  const cardClasses = useMemo(() => {
    const base = `
      rounded-md border cursor-pointer transition-all duration-200
      ${isDragging ? 'opacity-50 scale-95' : 'hover:shadow-md'}
    `;

    if (compact) {
      return `${base} ${contentTypeConfig.bgColor} ${contentTypeConfig.color} p-1.5 text-xs`;
    }

    return `${base} ${contentTypeConfig.bgColor} ${contentTypeConfig.color} p-3`;
  }, [compact, isDragging, contentTypeConfig]);

  const handleCardClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onClick?.(event);
  };

  if (compact) {
    return (
      <motion.div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        layout
        className={cardClasses}
        onClick={handleCardClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center gap-1.5 truncate">
          <contentTypeConfig.icon className="h-3 w-3 flex-shrink-0" />
          <span className="font-medium truncate flex-1">
            {campaign.title}
          </span>
          {showStatus && (
            <span className={`
              w-1.5 h-1.5 rounded-full flex-shrink-0
              ${statusColor.split(' ')[0]}
            `} />
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      layout
      className={cardClasses}
      onClick={handleCardClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`
          flex items-center justify-center
          w-8 h-8 rounded-lg
          ${contentTypeConfig.bgColor}
        `}>
          <contentTypeConfig.icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm truncate mb-1">
            {campaign.title}
          </h4>

          {campaign.description && (
            <p className="text-xs opacity-80 line-clamp-2 mb-2">
              {campaign.description}
            </p>
          )}

          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={`text-xs ${contentTypeConfig.color}`}>
              {t(`contentCalendar:contentTypes.${campaign.contentType}`)}
            </Badge>

            {showStatus && (
              <Badge variant="outline" className={`text-xs ${statusColor}`}>
                {t(`roadmap:status.${campaign.status}`)}
              </Badge>
            )}

            {showPriority && (
              <Badge variant="outline" className={`text-xs ${priorityColor}`}>
                {t(`roadmap:priority.${campaign.priority}`)}
              </Badge>
            )}

            {campaign.scheduledDate && (
              <span className="text-xs opacity-70">
                {new Date(campaign.scheduledDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            )}

            {campaign.estimatedHours && (
              <span className="text-xs opacity-70">
                {campaign.estimatedHours}h
              </span>
            )}
          </div>

          {/* Platforms */}
          {campaign.platforms && campaign.platforms.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              {campaign.platforms.slice(0, 3).map((platform) => (
                <span
                  key={platform}
                  className="text-xs px-1.5 py-0.5 rounded bg-white/50"
                >
                  {platform}
                </span>
              ))}
              {campaign.platforms.length > 3 && (
                <span className="text-xs opacity-70">
                  +{campaign.platforms.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Drag Handle */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-1 h-1 rounded-full bg-current opacity-40" />
          <div className="w-1 h-1 rounded-full bg-current opacity-40" />
          <div className="w-1 h-1 rounded-full bg-current opacity-40" />
        </div>
      </div>
    </motion.div>
  );
}
