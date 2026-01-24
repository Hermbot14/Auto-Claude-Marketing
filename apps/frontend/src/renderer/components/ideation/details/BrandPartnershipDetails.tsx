import {
  Handshake,
  Building,
  GitBranch,
  Users,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import { useTranslation } from 'react-i18next';
import {
  PARTNERSHIP_TYPE_LABELS,
  BUDGET_LEVEL_COLORS,
  IDEATION_TYPE_COLORS
} from '../../../../shared/constants';
import type { BrandPartnershipIdea } from '../../../../shared/types';

interface BrandPartnershipDetailsProps {
  idea: BrandPartnershipIdea;
}

export function BrandPartnershipDetails({ idea }: BrandPartnershipDetailsProps) {
  const { t } = useTranslation('ideation');

  return (
    <>
      {/* Target Partner */}
      <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
          <Building className="h-4 w-4 text-amber-400" />
          Target Partner
        </h3>
        <p className="text-sm font-medium">{idea.targetPartner}</p>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 text-center">
          <div className="text-sm font-semibold capitalize text-amber-500">
            {PARTNERSHIP_TYPE_LABELS[idea.partnershipType]?.split(' ')[0] || idea.partnershipType}
          </div>
          <div className="text-xs text-muted-foreground">Type</div>
        </Card>
        <Card className="p-3 text-center">
          <div className={`text-lg font-semibold ${BUDGET_LEVEL_COLORS[idea.investment]}`}>
            {idea.investment}
          </div>
          <div className="text-xs text-muted-foreground">Investment</div>
        </Card>
      </div>

      {/* Collaboration Format */}
      {idea.collaborationFormat && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Handshake className="h-4 w-4" />
            Collaboration Format
          </h3>
          <p className="text-sm text-muted-foreground">{idea.collaborationFormat}</p>
        </div>
      )}

      {/* Value Proposition */}
      {idea.valueProposition && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Value Proposition
          </h3>
          <Card className="p-3 bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-amber-500/20">
            <p className="text-sm">{idea.valueProposition}</p>
          </Card>
        </div>
      )}

      {/* Audience Alignment */}
      {idea.audienceAlignment && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Audience Alignment
          </h3>
          <p className="text-sm text-muted-foreground">{idea.audienceAlignment}</p>
        </div>
      )}

      {/* Estimated Reach */}
      {idea.estimatedReach && (
        <div>
          <h3 className="text-sm font-medium mb-2">Estimated Reach</h3>
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">
            {idea.estimatedReach}
          </Badge>
        </div>
      )}

      {/* Expected ROI */}
      {idea.expectedROI && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-400" />
            Expected ROI
          </h3>
          <Card className="p-3 bg-green-500/5 border-green-500/20">
            <p className="text-sm font-medium text-green-400">{idea.expectedROI}</p>
          </Card>
        </div>
      )}
    </>
  );
}

const IDEATION_TYPE_COLORS: Record<string, string> = {
  brand_partnerships: 'bg-amber-500/10 text-amber-500 border-amber-500/30'
};
