import {
  Radio,
  Target,
  Calendar,
  Zap,
  BarChart3,
  Clock,
  DollarSign
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import { useTranslation } from 'react-i18next';
import {
  CHANNEL_STRATEGY_TYPE_LABELS,
  BUDGET_LEVEL_COLORS
} from '../../../../shared/constants';
import type { ChannelIdeaIdea } from '../../../../shared/types';

interface ChannelIdeaDetailsProps {
  idea: ChannelIdeaIdea;
}

export function ChannelIdeaDetails({ idea }: ChannelIdeaDetailsProps) {
  const { t } = useTranslation('ideation');

  return (
    <>
      {/* Channel & Content Pillar */}
      <Card className="p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Radio className="h-4 w-4 text-cyan-400" />
            {idea.channel}
          </h3>
          <Badge variant="outline" className="text-xs">
            {CHANNEL_STRATEGY_TYPE_LABELS[idea.strategyType]}
          </Badge>
        </div>
        <p className="text-sm font-medium mt-2">{idea.contentPillar}</p>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 text-center">
          <div className={`text-lg font-semibold ${BUDGET_LEVEL_COLORS[idea.estimatedCost]}`}>
            {idea.estimatedCost}
          </div>
          <div className="text-xs text-muted-foreground">Cost</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-lg font-semibold text-cyan-400">
            {idea.frequency}
          </div>
          <div className="text-xs text-muted-foreground">Frequency</div>
        </Card>
      </div>

      {/* Time Commitment */}
      {idea.timeCommitment && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Time Commitment
          </h3>
          <p className="text-sm text-muted-foreground">{idea.timeCommitment}</p>
        </div>
      )}

      {/* Growth Levers */}
      {idea.growthLevers && idea.growthLevers.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            Growth Levers
          </h3>
          <ul className="space-y-1">
            {idea.growthLevers.map((lever, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                {lever}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key Metrics */}
      {idea.keyMetrics && idea.keyMetrics.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Key Metrics to Track
          </h3>
          <div className="flex flex-wrap gap-1">
            {idea.keyMetrics.map((metric, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {metric}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
