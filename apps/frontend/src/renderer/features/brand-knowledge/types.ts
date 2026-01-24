/**
 * Brand Knowledge Feature Types
 *
 * Type definitions for brand knowledge management including:
 * - Brand guidelines (logo, colors, typography, tone)
 * - Asset library (images, videos, templates)
 * - Style guide reference (do/dont)
 * - Version history
 */

/**
 * Color palette structure
 */
export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  neutral?: string[];
}

/**
 * Typography configuration
 */
export interface Typography {
  heading: {
    fontFamily: string;
    fontWeight: string;
    lineHeight: string;
  };
  body: {
    fontFamily: string;
    fontWeight: string;
    lineHeight: string;
    fontSize: string;
  };
}

/**
 * Brand guidelines structure
 */
export interface BrandGuidelines {
  id: string;
  name: string;
  logo: string; // URL or base64
  logoUrl?: string; // Alternative URL storage
  colors: ColorPalette;
  typography: Typography;
  toneOfVoice: string[];
  values: string[];
  tagline: string;
  mission?: string;
  vision?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/**
 * Asset types supported
 */
export type AssetType = 'image' | 'video' | 'template' | 'document' | 'audio';

/**
 * Brand asset structure
 */
export interface BrandAsset {
  id: string;
  type: AssetType;
  name: string;
  url: string;
  description?: string;
  tags: string[];
  size?: number; // File size in bytes
  dimensions?: { width: number; height: number }; // For images/videos
  duration?: number; // For videos/audio in seconds
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

/**
 * Style guide entry
 */
export interface StyleGuideEntry {
  id: string;
  category: string;
  do: string[];
  dont: string[];
  examples?: {
    good?: string; // URL or description
    bad?: string; // URL or description
  };
  rationale?: string;
}

/**
 * Version history entry
 */
export interface BrandVersion {
  version: number;
  timestamp: string;
  changes: string[];
  author?: string;
}

/**
 * Search filters for assets
 */
export interface AssetSearchFilters {
  type?: AssetType[];
  tags?: string[];
  dateRange?: {
    from: string;
    to: string;
  };
  searchText?: string;
}

/**
 * Usage tracking for brand assets
 */
export interface AssetUsage {
  assetId: string;
  usedIn: string; // Task ID or project ID
  usedAt: string;
  context: string;
}

/**
 * Main Brand Knowledge state structure
 */
export interface BrandKnowledgeState {
  // Brand Guidelines
  brandGuidelines: BrandGuidelines | null;
  versionHistory: BrandVersion[];

  // Asset Library
  assets: BrandAsset[];
  filteredAssets: BrandAsset[];
  assetSearchFilters: AssetSearchFilters;

  // Style Guide
  styleGuide: StyleGuideEntry[];

  // UI State
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  selectedAsset: BrandAsset | null;
  isEditingGuidelines: boolean;

  // Actions
  setBrandGuidelines: (guidelines: BrandGuidelines) => void;
  updateBrandGuidelines: (updates: Partial<BrandGuidelines>) => void;
  createNewVersion: (changes: string[]) => void;
  restoreVersion: (version: number) => void;

  // Asset Actions
  addAsset: (asset: Omit<BrandAsset, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => void;
  updateAsset: (id: string, updates: Partial<BrandAsset>) => void;
  deleteAsset: (id: string) => void;
  selectAsset: (asset: BrandAsset | null) => void;
  searchAssets: (filters: AssetSearchFilters) => void;
  clearAssetFilters: () => void;
  incrementAssetUsage: (id: string) => void;

  // Style Guide Actions
  addStyleGuideEntry: (entry: Omit<StyleGuideEntry, 'id'>) => void;
  updateStyleGuideEntry: (id: string, updates: Partial<StyleGuideEntry>) => void;
  deleteStyleGuideEntry: (id: string) => void;

  // Persistence
  saveToStorage: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  resetState: () => void;

  // UI Actions
  setIsEditingGuidelines: (isEditing: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Props for BrandKnowledge component
 */
export interface BrandKnowledgeProps {
  projectId?: string;
}

/**
 * Props for brand guidelines form
 */
export interface BrandGuidelinesFormProps {
  guidelines: BrandGuidelines;
  onChange: (updates: Partial<BrandGuidelines>) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
}

/**
 * Props for asset library
 */
export interface AssetLibraryProps {
  assets: BrandAsset[];
  filteredAssets: BrandAsset[];
  filters: AssetSearchFilters;
  selectedAsset: BrandAsset | null;
  onSelectAsset: (asset: BrandAsset | null) => void;
  onAddAsset: (asset: Omit<BrandAsset, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => void;
  onUpdateAsset: (id: string, updates: Partial<BrandAsset>) => void;
  onDeleteAsset: (id: string) => void;
  onSearch: (filters: AssetSearchFilters) => void;
  onClearFilters: () => void;
  isLoading: boolean;
}

/**
 * Props for style guide
 */
export interface StyleGuideProps {
  entries: StyleGuideEntry[];
  onAddEntry: (entry: Omit<StyleGuideEntry, 'id'>) => void;
  onUpdateEntry: (id: string, updates: Partial<StyleGuideEntry>) => void;
  onDeleteEntry: (id: string) => void;
}
