/**
 * Brand Knowledge Feature Module
 *
 * Exports all components and utilities for the Brand Knowledge feature.
 * This feature provides comprehensive brand asset management including:
 * - Brand guidelines (logo, colors, typography, tone)
 * - Asset library (images, videos, templates, documents)
 * - Style guide (do/dont guidelines)
 * - Version history tracking
 */

// Main component
export { BrandKnowledge } from './BrandKnowledge';

// Sub-components
export { BrandGuidelines } from './BrandGuidelines';
export { AssetLibrary } from './AssetLibrary';
export { StyleGuide } from './StyleGuide';
export { VersionHistory } from './VersionHistory';

// Store and hooks
export {
  useBrandKnowledgeStore,
  initializeBrandKnowledge,
} from './BrandKnowledgeStore';

// Types
export type {
  BrandGuidelines,
  ColorPalette,
  Typography,
  BrandAsset,
  AssetType,
  StyleGuideEntry,
  BrandVersion,
  AssetSearchFilters,
  AssetUsage,
  BrandKnowledgeState,
  BrandKnowledgeProps,
  BrandGuidelinesFormProps,
  AssetLibraryProps,
  StyleGuideProps,
} from './types';
