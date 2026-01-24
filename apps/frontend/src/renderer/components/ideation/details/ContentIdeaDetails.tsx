import {
  FileText,
  Radio,
  Hash,
  Target,
  Heading,
  List
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import { useTranslation } from 'react-i18next';
import {
  CONTENT_TYPE_LABELS,
  CONTENT_GOAL_LABELS,
  IMPACT_LEVEL_COLORS
} from '../../../../shared/constants';
import type { ContentIdeaIdea } from '../../../../shared/types';

interface ContentIdeaDetailsProps {
  idea: ContentIdeaIdea;
}

export function ContentIdeaDetails({ idea }: ContentIdeaDetailsProps) {
  const { t } = useTranslation('ideation');

  return (
    <>
      {/* Suggested Title */}
      {idea.suggestedTitle && (
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30">
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Heading className="h-4 w-4 text-blue-400" />
            Suggested Title
          </h3>
          <p className="text-sm font-medium">{idea.suggestedTitle}</p>
        </Card>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <div className="text-lg font-semibold capitalize">
            {CONTENT_TYPE_LABELS[idea.contentType]?.split(' ')[0] || idea.contentType}
          </div>
          <div className="text-xs text-muted-foreground">Type</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-lg font-semibold capitalize text-blue-400">
            {idea.contentGoal}
          </div>
          <div className="text-xs text-muted-foreground">Goal</div>
        </Card>
        <Card className="p-3 text-center">
          <div className={`text-lg font-semibold capitalize ${IMPACT_LEVEL_COLORS[idea.estimatedEffort]}`}>
            {idea.estimatedEffort}
          </div>
          <div className="text-xs text-muted-foreground">Effort</div>
        </Card>
      </div>

      {/* Target Platform */}
      {idea.targetPlatform && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Target Platform
          </h3>
          <Badge className={`${IDEATION_TYPE_COLORS.channel_ideas}`}>
            {idea.targetPlatform}
          </Badge>
        </div>
      )}

      {/* Target Audience */}
      {idea.targetAudience && (
        <div>
          <h3 className="text-sm font-medium mb-2">Target Audience</h3>
          <p className="text-sm text-muted-foreground">{idea.targetAudience}</p>
        </div>
      )}

      {/* SEO Keywords */}
      {idea.seoKeywords && idea.seoKeywords.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Hash className="h-4 w-4" />
            SEO Keywords
          </h3>
          <div className="flex flex-wrap gap-1">
            {idea.seoKeywords.map((keyword, i) => (
              <Badge key={i} variant="outline" className="text-xs font-mono">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Key Points */}
      {idea.keyPoints && idea.keyPoints.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <List className="h-4 w-4" />
            Key Points to Cover
          </h3>
          <ul className="space-y-2">
            {idea.keyPoints.map((point, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

const IDEATION_TYPE_COLORS: Record<string, string> = {
  channel_ideas: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
};
