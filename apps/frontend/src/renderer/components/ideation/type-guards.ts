import type {
  Idea,
  CampaignConceptIdea,
  ContentIdeaIdea,
  GrowthTacticIdea,
  BrandPartnershipIdea,
  ViralStrategyIdea,
  ChannelIdeaIdea
} from '../../../shared/types';

// Marketing idea type guards for Creative Studio

export function isCampaignConceptIdea(idea: Idea): idea is CampaignConceptIdea {
  return idea.type === 'campaign_concepts';
}

export function isContentIdeaIdea(idea: Idea): idea is ContentIdeaIdea {
  return idea.type === 'content_ideas';
}

export function isGrowthTacticIdea(idea: Idea): idea is GrowthTacticIdea {
  return idea.type === 'growth_tactics';
}

export function isBrandPartnershipIdea(idea: Idea): idea is BrandPartnershipIdea {
  return idea.type === 'brand_partnerships';
}

export function isViralStrategyIdea(idea: Idea): idea is ViralStrategyIdea {
  return idea.type === 'viral_strategies';
}

export function isChannelIdeaIdea(idea: Idea): idea is ChannelIdeaIdea {
  return idea.type === 'channel_ideas';
}

// Legacy type guards for backward compatibility during migration
// TODO: Remove once all components are migrated to marketing types
export function isCodeImprovementIdea(idea: Idea): boolean {
  return idea.type === 'code_improvement';
}

export function isUIUXIdea(idea: Idea): boolean {
  return idea.type === 'uiux_improvement';
}

export function isDocumentationGapIdea(idea: Idea): boolean {
  return idea.type === 'documentation_gap';
}

export function isSecurityHardeningIdea(idea: Idea): boolean {
  return idea.type === 'security_hardening';
}

export function isPerformanceOptimizationIdea(idea: Idea): boolean {
  return idea.type === 'performance_optimization';
}

export function isCodeQualityIdea(idea: Idea): boolean {
  return idea.type === 'code_quality';
}
