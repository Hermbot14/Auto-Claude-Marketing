import {
  Flame,
  Heart,
  Share2,
  Radio,
  Zap,
  Rocket
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import { useTranslation } from 'react-i18next';
import { IMPACT_LEVEL_COLORS } from '../../../../shared/constants';
import type { ViralStrategyIdea } from '../../../../shared/types';

interface ViralStrategyDetailsProps {
  idea: ViralStrategyIdea;
}

export function ViralStrategyDetails({ idea }: ViralStrategyDetailsProps) {
  const { t } = useTranslation('ideation');

  return (
    <>
      {/* Viral Mechanism */}
      <Card className="p-4 bg-gradient-to-br from-pink-500/10 to-rose-500/10 border-pink-500/30">
        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
          <Flame className="h-4 w-4 text-pink-400" />
          Viral Mechanism
        </h3>
        <p className="text-sm font-medium">{idea.viralMechanism}</p>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 text-center">
          <div className={`text-lg font-semibold ${IMPACT_LEVEL_COLORS[idea.estimatedVirality]}`}>
            {idea.estimatedVirality}
          </div>
          <div className="text-xs text-muted-foreground">Virality</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-sm font-semibold capitalize text-pink-400">
            {idea.contentFormat}
          </div>
          <div className="text-xs text-muted-foreground">Format</div>
        </Card>
      </div>

      {/* Platform */}
      {idea.platform && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Platform
          </h3>
          <Badge className="bg-pink-500/10 text-pink-400 border-pink-500/30">
            {idea.platform}
          </Badge>
        </div>
      )}

      {/* Emotional Triggers */}
      {idea.emotionalTrigger && idea.emotionalTrigger.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-400" />
            Emotional Triggers
          </h3>
          <div className="flex flex-wrap gap-1">
            {idea.emotionalTrigger.map((emotion, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {emotion}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Share Incentives */}
      {idea.shareIncentives && idea.shareIncentives.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Why People Will Share
          </h3>
          <ul className="space-y-1">
            {idea.shareIncentives.map((incentive, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-pink-400 mt-1.5 shrink-0" />
                {incentive}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Amplification Tactics */}
      {idea.amplificationTactics && idea.amplificationTactics.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Rocket className="h-4 w-4 text-orange-400" />
            Amplification Tactics
          </h3>
          <ul className="space-y-1">
            {idea.amplificationTactics.map((tactic, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                {tactic}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
