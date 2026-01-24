/**
 * Ideation-related constants
 * Types, categories, and configuration for AI-powered marketing idea generation
 */

// ============================================
// Ideation Types
// ============================================

// Marketing-focused ideation type labels and descriptions
export const IDEATION_TYPE_LABELS: Record<string, string> = {
  campaign_concepts: 'Campaign Concepts',
  content_ideas: 'Content Ideas',
  growth_tactics: 'Growth Tactics',
  brand_partnerships: 'Brand Partnerships',
  viral_strategies: 'Viral Strategies',
  channel_ideas: 'Channel Ideas'
};

export const IDEATION_TYPE_DESCRIPTIONS: Record<string, string> = {
  campaign_concepts: 'Comprehensive marketing campaign ideas with themes, messaging, and channel recommendations',
  content_ideas: 'Individual content piece ideas for blogs, videos, social media, and more',
  growth_tactics: 'Strategies for user acquisition, activation, retention, and revenue growth',
  brand_partnerships: 'Collaboration opportunities with complementary brands and influencers',
  viral_strategies: 'Shareable content ideas designed to maximize organic reach and engagement',
  channel_ideas: 'Platform-specific strategies for organic and paid marketing channels'
};

// Ideation type colors
export const IDEATION_TYPE_COLORS: Record<string, string> = {
  campaign_concepts: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  content_ideas: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  growth_tactics: 'bg-green-500/10 text-green-400 border-green-500/30',
  brand_partnerships: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  viral_strategies: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
  channel_ideas: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
};

// Ideation type icons (Lucide icon names)
export const IDEATION_TYPE_ICONS: Record<string, string> = {
  campaign_concepts: 'Megaphone',
  content_ideas: 'FileText',
  growth_tactics: 'TrendingUp',
  brand_partnerships: 'Handshake',
  viral_strategies: 'Flame',
  channel_ideas: 'Radio'
};

// ============================================
// Ideation Status
// ============================================

export const IDEATION_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  selected: 'bg-primary/10 text-primary',
  converted: 'bg-success/10 text-success',
  dismissed: 'bg-destructive/10 text-destructive line-through',
  archived: 'bg-violet-500/10 text-violet-400'
};

// ============================================
// Ideation Effort/Complexity
// ============================================

// Ideation effort colors (full spectrum for code_improvements)
export const IDEATION_EFFORT_COLORS: Record<string, string> = {
  trivial: 'bg-success/10 text-success',
  small: 'bg-info/10 text-info',
  medium: 'bg-warning/10 text-warning',
  large: 'bg-orange-500/10 text-orange-400',
  complex: 'bg-destructive/10 text-destructive'
};

// ============================================
// Ideation Impact
// ============================================

export const IDEATION_IMPACT_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-info/10 text-info',
  high: 'bg-warning/10 text-warning',
  critical: 'bg-destructive/10 text-destructive'
};

// ============================================
// Category-Specific Labels
// ============================================

// Content type labels
export const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog: 'Blog Post',
  video: 'Video',
  infographic: 'Infographic',
  podcast: 'Podcast',
  social: 'Social Media',
  ebook: 'eBook',
  webinar: 'Webinar',
  case_study: 'Case Study'
};

// Content goal labels
export const CONTENT_GOAL_LABELS: Record<string, string> = {
  awareness: 'Awareness',
  consideration: 'Consideration',
  conversion: 'Conversion',
  retention: 'Retention',
  advocacy: 'Advocacy'
};

// Growth tactic category labels
export const GROWTH_TACTIC_CATEGORY_LABELS: Record<string, string> = {
  acquisition: 'Acquisition',
  activation: 'Activation',
  retention: 'Retention',
  revenue: 'Revenue',
  referral: 'Referral'
};

// Partnership type labels
export const PARTNERSHIP_TYPE_LABELS: Record<string, string> = {
  co_marketing: 'Co-Marketing',
  affiliate: 'Affiliate',
  sponsorship: 'Sponsorship',
  influencer: 'Influencer',
  strategic_alliance: 'Strategic Alliance'
};

// Channel strategy type labels
export const CHANNEL_STRATEGY_TYPE_LABELS: Record<string, string> = {
  organic: 'Organic',
  paid: 'Paid',
  earned: 'Earned',
  owned: 'Owned'
};

// Impact level colors
export const IMPACT_LEVEL_COLORS: Record<string, string> = {
  low: 'bg-info/10 text-info',
  medium: 'bg-warning/10 text-warning',
  high: 'bg-orange-500/10 text-orange-500'
};

// Budget level colors
export const BUDGET_LEVEL_COLORS: Record<string, string> = {
  low: 'bg-green-500/10 text-green-400',
  medium: 'bg-amber-500/10 text-amber-500',
  high: 'bg-red-500/10 text-red-400'
};

// ============================================
// Default Configuration
// ============================================

// Default ideation config for marketing ideas
export const DEFAULT_IDEATION_CONFIG = {
  enabledTypes: ['campaign_concepts', 'content_ideas', 'growth_tactics'] as const,
  includeRoadmapContext: false,
  includeKanbanContext: false,
  maxIdeasPerType: 5
};

// ============================================
// Legacy Constants (Backward Compatibility)
// TODO: Remove once all components migrated to marketing types
// ============================================

// Legacy coding-focused category labels (for backward compatibility)
export const UIUX_CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  layout: 'Layout',
  styling: 'Styling',
  accessibility: 'Accessibility',
  responsive: 'Responsive Design',
  interaction: 'Interaction Design',
  visual: 'Visual Design'
};

export const DOCUMENTATION_CATEGORY_LABELS: Record<string, string> = {
  readme: 'README',
  api: 'API Docs',
  guide: 'Guide',
  contributing: 'Contributing',
  architecture: 'Architecture',
  changelog: 'Changelog'
};

export const CODE_QUALITY_SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-info/10 text-info',
  minor: 'bg-blue-500/10 text-blue-400',
  major: 'bg-warning/10 text-warning',
  critical: 'bg-destructive/10 text-destructive',
  blocker: 'bg-red-500/10 text-red-500'
};

export const SECURITY_SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-info/10 text-info',
  medium: 'bg-warning/10 text-warning',
  high: 'bg-orange-500/10 text-orange-500',
  critical: 'bg-destructive/10 text-destructive'
};

// Legacy security category labels (for backward compatibility)
export const SECURITY_CATEGORY_LABELS: Record<string, string> = {
  authentication: 'Authentication',
  authorization: 'Authorization',
  encryption: 'Encryption',
  input_validation: 'Input Validation',
  output_encoding: 'Output Encoding',
  session_management: 'Session Management',
  data_protection: 'Data Protection',
  api_security: 'API Security'
};

// Legacy performance category labels (for backward compatibility)
export const PERFORMANCE_CATEGORY_LABELS: Record<string, string> = {
  rendering: 'Rendering',
  network: 'Network',
  memory: 'Memory',
  cpu: 'CPU Usage',
  database: 'Database',
  caching: 'Caching',
  bundle_size: 'Bundle Size',
  load_time: 'Load Time'
};

// Legacy code quality category labels (for backward compatibility)
export const CODE_QUALITY_CATEGORY_LABELS: Record<string, string> = {
  complexity: 'Complexity',
  duplication: 'Duplication',
  maintainability: 'Maintainability',
  test_coverage: 'Test Coverage',
  error_handling: 'Error Handling',
  naming_conventions: 'Naming Conventions',
  documentation: 'Documentation',
  type_safety: 'Type Safety'
};
