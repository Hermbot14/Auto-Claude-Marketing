/**
 * Insights and ideation types
 */

import type { TaskMetadata } from './task';

// ============================================
// Ideation Types
// ============================================

// Marketing-focused ideation types for Creative Studio
export type IdeationType =
  | 'campaign_concepts'
  | 'content_ideas'
  | 'growth_tactics'
  | 'brand_partnerships'
  | 'viral_strategies'
  | 'channel_ideas';
export type IdeationStatus = 'draft' | 'selected' | 'converted' | 'dismissed' | 'archived';
export type IdeationGenerationPhase = 'idle' | 'analyzing' | 'discovering' | 'generating' | 'finalizing' | 'complete' | 'error';

export interface IdeationConfig {
  enabledTypes: IdeationType[];
  includeRoadmapContext: boolean;
  includeKanbanContext: boolean;
  maxIdeasPerType: number;
  append?: boolean; // If true, append to existing ideas instead of replacing
  model?: string;          // Model shorthand (opus, sonnet, haiku)
  thinkingLevel?: string;  // Thinking level (none, low, medium, high, ultrathink)
}

export interface IdeaBase {
  id: string;
  title: string;
  description: string;
  rationale: string;
  status: IdeationStatus;
  createdAt: Date;
  taskId?: string; // ID of the created task when status is 'converted'
}

// Marketing Idea Interfaces

export interface CampaignConceptIdea extends IdeaBase {
  type: 'campaign_concepts';
  campaignTheme: string;  // Core theme/message
  targetAudience: string[];  // Target demographics
  channels: string[];  // Recommended channels
  estimatedDuration: 'short' | 'medium' | 'long';  // Campaign length
  budgetLevel: 'low' | 'medium' | 'high';  // Estimated budget
  keyMessages: string[];  // Core messaging points
  callToAction: string;  // Primary CTA
  expectedOutcomes: string[];  // Anticipated results
}

export interface ContentIdeaIdea extends IdeaBase {
  type: 'content_ideas';
  contentType: 'blog' | 'video' | 'infographic' | 'podcast' | 'social' | 'ebook' | 'webinar' | 'case_study';
  format: string;  // Specific format (e.g., "How-to guide", "Listicle")
  targetPlatform: string;  // Where to publish
  seoKeywords: string[];  // Target keywords
  estimatedEffort: 'quick' | 'moderate' | 'substantial';
  targetAudience: string;
  contentGoal: 'awareness' | 'consideration' | 'conversion' | 'retention' | 'advocacy';
  suggestedTitle: string;  // Proposed headline
  keyPoints: string[];  // Main content points to cover
}

export interface GrowthTacticIdea extends IdeaBase {
  type: 'growth_tactics';
  tacticCategory: 'acquisition' | 'activation' | 'retention' | 'revenue' | 'referral';
  mechanism: string;  // How it works
  targetMetric: string;  // KPI to improve
  expectedImpact: 'low' | 'medium' | 'high';
  implementationComplexity: 'simple' | 'moderate' | 'complex';
  resources: string[];  // Required resources
  timeline: string;  // Estimated time to implement
  risks?: string[];  // Potential risks
}

export interface BrandPartnershipIdea extends IdeaBase {
  type: 'brand_partnerships';
  partnershipType: 'co_marketing' | 'affiliate' | 'sponsorship' | 'influencer' | 'strategic_alliance';
  targetPartner: string;  // Type of partner/brand
  collaborationFormat: string;  // How to collaborate
  valueProposition: string;  // Mutual benefit
  audienceAlignment: string;  // How audiences align
  estimatedReach: string;  // Potential audience size
  investment: 'low' | 'medium' | 'high';
  expectedROI: string;
}

export interface ViralStrategyIdea extends IdeaBase {
  type: 'viral_strategies';
  viralMechanism: string;  // What makes it shareable
  emotionalTrigger: string[];  // Emotions to evoke
  shareIncentives: string[];  // Why people would share
  platform: string;  // Best platform for this strategy
  estimatedVirality: 'low' | 'medium' | 'high';
  contentFormat: string;  // Type of content
  amplificationTactics: string[];  // How to boost spread
}

export interface ChannelIdeaIdea extends IdeaBase {
  type: 'channel_ideas';
  channel: string;  // Platform (e.g., LinkedIn, TikTok, Email)
  strategyType: 'organic' | 'paid' | 'earned' | 'owned';
  contentPillar: string;  // Content theme/focus
  frequency: string;  // Posting frequency
  growthLevers: string[];  // How to grow on this channel
  keyMetrics: string[];  // What to track
  estimatedCost: 'low' | 'medium' | 'high';
  timeCommitment: string;  // Resource requirement
}

export type Idea =
  | CampaignConceptIdea
  | ContentIdeaIdea
  | GrowthTacticIdea
  | BrandPartnershipIdea
  | ViralStrategyIdea
  | ChannelIdeaIdea;

export interface IdeationSession {
  id: string;
  projectId: string;
  config: IdeationConfig;
  ideas: Idea[];
  projectContext: {
    existingFeatures: string[];
    techStack: string[];
    targetAudience?: string;
    plannedFeatures: string[];  // From roadmap/kanban
  };
  generatedAt: Date;
  updatedAt: Date;
}

export interface IdeationGenerationStatus {
  phase: IdeationGenerationPhase;
  currentType?: IdeationType;
  progress: number;
  message: string;
  error?: string;
}

export interface IdeationSummary {
  totalIdeas: number;
  byType: Record<IdeationType, number>;
  byStatus: Record<IdeationStatus, number>;
  lastGenerated?: Date;
}

// ============================================
// Insights Chat Types
// ============================================

import type { ThinkingLevel } from './settings';
import type { ModelType } from './task';

// Model configuration for insights sessions
export interface InsightsModelConfig {
  profileId: string;           // 'complex' | 'balanced' | 'quick' | 'custom'
  model: ModelType;            // 'haiku' | 'sonnet' | 'opus'
  thinkingLevel: ThinkingLevel;
}

export type InsightsChatRole = 'user' | 'assistant';

// Tool usage record for showing what tools the AI used
export interface InsightsToolUsage {
  name: string;
  input?: string;
  timestamp: Date;
}

export interface InsightsChatMessage {
  id: string;
  role: InsightsChatRole;
  content: string;
  timestamp: Date;
  // For assistant messages that suggest task creation
  suggestedTask?: {
    title: string;
    description: string;
    metadata?: TaskMetadata;
  };
  // Tools used during this response (assistant messages only)
  toolsUsed?: InsightsToolUsage[];
}

export interface InsightsSession {
  id: string;
  projectId: string;
  title?: string; // Auto-generated from first message or user-set
  messages: InsightsChatMessage[];
  modelConfig?: InsightsModelConfig; // Per-session model configuration
  createdAt: Date;
  updatedAt: Date;
}

// Summary of a session for the history list (without full messages)
export interface InsightsSessionSummary {
  id: string;
  projectId: string;
  title: string;
  messageCount: number;
  modelConfig?: InsightsModelConfig; // For displaying model indicator in sidebar
  createdAt: Date;
  updatedAt: Date;
}

export interface InsightsChatStatus {
  phase: 'idle' | 'thinking' | 'streaming' | 'complete' | 'error';
  message?: string;
  error?: string;
}

export interface InsightsStreamChunk {
  type: 'text' | 'task_suggestion' | 'tool_start' | 'tool_end' | 'done' | 'error';
  content?: string;
  suggestedTask?: {
    title: string;
    description: string;
    metadata?: TaskMetadata;
  };
  tool?: {
    name: string;
    input?: string;  // Brief description of what's being searched/read
  };
  error?: string;
}
