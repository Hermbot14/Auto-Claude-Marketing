import {
  Megaphone,
  Users,
  Radio,
  MessageSquare,
  ArrowRight,
  Target
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import { useTranslation } from 'react-i18next';
import {
  BUDGET_LEVEL_COLORS,
  IDEATION_TYPE_COLORS
} from '../../../../shared/constants';
import type { CampaignConceptIdea } from '../../../../shared/types';

interface CampaignConceptDetailsProps {
  idea: CampaignConceptIdea;
}

export function CampaignConceptDetails({ idea }: CampaignConceptDetailsProps) {
  const { t } = useTranslation('ideation');

  return (
    <>
      {/* Campaign Theme */}
      <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30">
        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-purple-400" />
          Campaign Theme
        </h3>
        <p className="text-sm font-medium">{idea.campaignTheme}</p>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 text-center">
          <div className={`text-lg font-semibold ${BUDGET_LEVEL_COLORS[idea.budgetLevel]}`}>
            {idea.budgetLevel}
          </div>
          <div className="text-xs text-muted-foreground">Budget</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-lg font-semibold capitalize">{idea.estimatedDuration}</div>
          <div className="text-xs text-muted-foreground">Duration</div>
        </Card>
      </div>

      {/* Target Audience */}
      {idea.targetAudience && idea.targetAudience.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Target Audience
          </h3>
          <div className="flex flex-wrap gap-1">
            {idea.targetAudience.map((audience, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {audience}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Channels */}
      {idea.channels && idea.channels.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Channels
          </h3>
          <div className="flex flex-wrap gap-1">
            {idea.channels.map((channel, i) => (
              <Badge key={i} className={`${IDEATION_TYPE_COLORS.channel_ideas} text-xs`}>
                {channel}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Key Messages */}
      {idea.keyMessages && idea.keyMessages.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Key Messages
          </h3>
          <ul className="space-y-1">
            {idea.keyMessages.map((message, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                {message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Call to Action */}
      {idea.callToAction && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Call to Action
          </h3>
          <Card className="p-3 bg-gradient-to-r from-purple-500/5 to-pink-500/5 border-purple-500/20">
            <p className="text-sm font-medium">{idea.callToAction}</p>
          </Card>
        </div>
      )}

      {/* Expected Outcomes */}
      {idea.expectedOutcomes && idea.expectedOutcomes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Expected Outcomes
          </h3>
          <ul className="space-y-1">
            {idea.expectedOutcomes.map((outcome, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                {outcome}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
