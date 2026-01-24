import {
  TrendingUp,
  Target,
  Settings,
  Clock,
  AlertTriangle,
  Package
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import { useTranslation } from 'react-i18next';
import {
  GROWTH_TACTIC_CATEGORY_LABELS,
  IMPACT_LEVEL_COLORS
} from '../../../../shared/constants';
import type { GrowthTacticIdea } from '../../../../shared/types';

interface GrowthTacticDetailsProps {
  idea: GrowthTacticIdea;
}

export function GrowthTacticDetails({ idea }: GrowthTacticDetailsProps) {
  const { t } = useTranslation('ideation');

  return (
    <>
      {/* Mechanism */}
      <Card className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
          <Settings className="h-4 w-4 text-green-400" />
          How It Works
        </h3>
        <p className="text-sm">{idea.mechanism}</p>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <div className="text-lg font-semibold capitalize">
            {GROWTH_TACTIC_CATEGORY_LABELS[idea.tacticCategory]?.split(' ')[0] || idea.tacticCategory}
          </div>
          <div className="text-xs text-muted-foreground">Category</div>
        </Card>
        <Card className="p-3 text-center">
          <div className={`text-lg font-semibold capitalize ${IMPACT_LEVEL_COLORS[idea.expectedImpact]}`}>
            {idea.expectedImpact}
          </div>
          <div className="text-xs text-muted-foreground">Impact</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-lg font-semibold capitalize text-amber-500">
            {idea.implementationComplexity}
          </div>
          <div className="text-xs text-muted-foreground">Complexity</div>
        </Card>
      </div>

      {/* Target Metric */}
      {idea.targetMetric && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Target Metric
          </h3>
          <Badge className="bg-green-500/10 text-green-400 border-green-500/30">
            {idea.targetMetric}
          </Badge>
        </div>
      )}

      {/* Timeline */}
      {idea.timeline && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Timeline
          </h3>
          <p className="text-sm text-muted-foreground">{idea.timeline}</p>
        </div>
      )}

      {/* Resources */}
      {idea.resources && idea.resources.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Package className="h-4 w-4" />
            Required Resources
          </h3>
          <ul className="space-y-1">
            {idea.resources.map((resource, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                {resource}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risks */}
      {idea.risks && idea.risks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Potential Risks
          </h3>
          <ul className="space-y-1">
            {idea.risks.map((risk, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
