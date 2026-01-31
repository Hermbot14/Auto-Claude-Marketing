/**
 * Roadmap-related types
 */

// ============================================
// Competitor Analysis Types
// ============================================

export type CompetitorRelevance = 'high' | 'medium' | 'low';
export type PainPointSeverity = 'high' | 'medium' | 'low';
export type OpportunitySize = 'high' | 'medium' | 'low';

export interface CompetitorPainPoint {
  id: string;
  description: string;
  source: string;
  severity: PainPointSeverity;
  frequency: string;
  opportunity: string;
}

export interface Competitor {
  id: string;
  name: string;
  url: string;
  description: string;
  relevance: CompetitorRelevance;
  painPoints: CompetitorPainPoint[];
  strengths: string[];
  marketPosition: string;
}

export interface CompetitorMarketGap {
  id: string;
  description: string;
  affectedCompetitors: string[];
  opportunitySize: OpportunitySize;
  suggestedFeature: string;
}

export interface CompetitorInsightsSummary {
  topPainPoints: string[];
  differentiatorOpportunities: string[];
  marketTrends: string[];
}

export interface CompetitorResearchMetadata {
  searchQueriesUsed: string[];
  sourcesConsulted: string[];
  limitations: string[];
}

export interface CompetitorAnalysis {
  projectContext: {
    projectName: string;
    projectType: string;
    targetAudience: string;
  };
  competitors: Competitor[];
  marketGaps: CompetitorMarketGap[];
  insightsSummary: CompetitorInsightsSummary;
  researchMetadata: CompetitorResearchMetadata;
  createdAt: Date;
}

// ============================================
// Roadmap Types
// ============================================

export type RoadmapFeaturePriority = 'must' | 'should' | 'could' | 'wont';
export type RoadmapFeatureStatus = 'under_review' | 'planned' | 'in_progress' | 'done';
export type RoadmapPhaseStatus = 'planned' | 'in_progress' | 'completed';
export type RoadmapStatus = 'draft' | 'active' | 'archived';

// Feature source tracking for external integrations (Canny, GitHub Issues, etc.)
export type FeatureSourceProvider = 'internal' | 'canny' | 'github_issue';

export interface FeatureSource {
  provider: FeatureSourceProvider;
  importedAt?: Date;
  lastSyncedAt?: Date;
}

export interface TargetAudience {
  primary: string;
  secondary: string[];
  painPoints?: string[];
  goals?: string[];
  usageContext?: string;
}

export interface RoadmapMilestone {
  id: string;
  title: string;
  description: string;
  features: string[];
  status: 'planned' | 'achieved';
  targetDate?: Date;
}

export interface RoadmapPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  status: RoadmapPhaseStatus;
  features: string[];
  milestones: RoadmapMilestone[];
}

export interface RoadmapFeature {
  id: string;
  title: string;
  description: string;
  rationale: string;
  priority: RoadmapFeaturePriority;
  complexity: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  phaseId: string;
  dependencies: string[];
  status: RoadmapFeatureStatus;
  acceptanceCriteria: string[];
  userStories: string[];
  linkedSpecId?: string;
  competitorInsightIds?: string[];
  // External integration fields
  source?: FeatureSource;
  externalId?: string;    // ID from external system (e.g., Canny post ID)
  externalUrl?: string;   // Link back to external system
  votes?: number;         // Vote count from external system
}

export interface Roadmap {
  id: string;
  projectId: string;
  projectName: string;
  version: string;
  vision: string;
  targetAudience: TargetAudience;
  phases: RoadmapPhase[];
  features: RoadmapFeature[];
  status: RoadmapStatus;
  competitorAnalysis?: CompetitorAnalysis;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoadmapDiscovery {
  projectName: string;
  projectType: string;
  techStack: {
    primaryLanguage: string;
    frameworks: string[];
    keyDependencies: string[];
  };
  targetAudience: {
    primaryPersona: string;
    secondaryPersonas: string[];
    painPoints: string[];
    goals: string[];
    usageContext: string;
  };
  productVision: {
    oneLiner: string;
    problemStatement: string;
    valueProposition: string;
    successMetrics: string[];
  };
  currentState: {
    maturity: 'idea' | 'prototype' | 'mvp' | 'growth' | 'mature';
    existingFeatures: string[];
    knownGaps: string[];
    technicalDebt: string[];
  };
  createdAt: Date;
}

export interface RoadmapGenerationStatus {
  phase: 'idle' | 'analyzing' | 'discovering' | 'generating' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
  // Detailed progress tracking
  currentSubPhase?: 'discovery' | 'research' | 'analysis' | 'generation' | 'finalization';
  subPhaseProgress?: number;
  subPhaseTotal?: number;
  subPhaseStepName?: string;
}

/**
 * Tool usage types for roadmap generation progress logs
 */
export type RoadmapToolType =
  | 'WebSearch'
  | 'Bash'
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Grep'
  | 'Glob'
  | 'Database'
  | 'Git'
  | 'Agent'
  | 'Other';

/**
 * Log severity levels for roadmap progress logs
 */
export type RoadmapLogSeverity = 'info' | 'success' | 'warning' | 'error';

/**
 * Single progress log entry for roadmap generation
 */
export interface RoadmapProgressLog {
  id: string;
  timestamp: string; // ISO string
  tool?: RoadmapToolType;
  severity: RoadmapLogSeverity;
  message: string;
  phase: 'discovery' | 'research' | 'analysis' | 'generation' | 'finalization';
  details?: string;
}

// ============================================
// Roadmap Chat Types
// ============================================

export type RoadmapChatMessageRole = 'user' | 'assistant' | 'system';

export type RoadmapOperationType =
  | 'add_context'
  | 'redefine_phase'
  | 'redefine_task'
  | 'update_status'
  | 'rearrange_priority'
  | 'add_task'
  | 'delete_task'
  | 'move_task';

export interface RoadmapOperation {
  type: RoadmapOperationType;
  targetId?: string;
  data: Record<string, unknown>;
  description: string;
}

export interface RoadmapChatMessage {
  id: string;
  role: RoadmapChatMessageRole;
  content: string;
  timestamp: Date;
  operations?: RoadmapOperation[];
}
