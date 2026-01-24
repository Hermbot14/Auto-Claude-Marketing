/**
 * Brand Knowledge Store - Zustand store for brand asset management
 *
 * Manages state for brand knowledge including:
 * - Brand guidelines (logo, colors, typography, tone)
 * - Asset library (images, videos, templates)
 * - Style guide reference (do/dont)
 * - Version history and tracking
 * - Persistence to localStorage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  BrandGuidelines,
  BrandAsset,
  StyleGuideEntry,
  BrandVersion,
  AssetSearchFilters,
  BrandKnowledgeState,
} from './types';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Default color palette
 */
const DEFAULT_COLORS = {
  primary: '#0066CC',
  secondary: '#6C757D',
  accent: '#FF6B35',
  neutral: ['#F8F9FA', '#E9ECEF', '#DEE2E6', '#CED4DA', '#ADB5BD'],
};

/**
 * Default typography
 */
const DEFAULT_TYPOGRAPHY = {
  heading: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: '600',
    lineHeight: '1.2',
  },
  body: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: '400',
    lineHeight: '1.5',
    fontSize: '16px',
  },
};

/**
 * Create initial brand guidelines
 */
function createInitialBrandGuidelines(): BrandGuidelines {
  return {
    id: generateId(),
    name: 'My Brand',
    logo: '',
    colors: DEFAULT_COLORS,
    typography: DEFAULT_TYPOGRAPHY,
    toneOfVoice: ['Professional', 'Friendly', 'Clear'],
    values: ['Quality', 'Innovation', 'Customer-focused'],
    tagline: 'Your tagline here',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };
}

/**
 * Create the Brand Knowledge store with persistence
 */
export const useBrandKnowledgeStore = create<BrandKnowledgeState>()(
  persist(
    (set, get) => ({
      // Initial state
      brandGuidelines: null,
      versionHistory: [],
      assets: [],
      filteredAssets: [],
      assetSearchFilters: {},
      styleGuide: [],
      isLoading: false,
      isSaving: false,
      error: null,
      selectedAsset: null,
      isEditingGuidelines: false,

      // Brand Guidelines Actions
      setBrandGuidelines: (guidelines) =>
        set({ brandGuidelines: guidelines, error: null }),

      updateBrandGuidelines: (updates) =>
        set((state) => {
          if (!state.brandGuidelines) {
            return { error: 'No brand guidelines to update' };
          }

          const updated = {
            ...state.brandGuidelines,
            ...updates,
            updatedAt: new Date().toISOString(),
          };

          return {
            brandGuidelines: updated,
            error: null,
          };
        }),

      createNewVersion: (changes) =>
        set((state) => {
          if (!state.brandGuidelines) {
            return { error: 'No brand guidelines to version' };
          }

          const newVersion: BrandVersion = {
            version: state.brandGuidelines.version + 1,
            timestamp: new Date().toISOString(),
            changes,
          };

          const updatedGuidelines = {
            ...state.brandGuidelines,
            version: newVersion.version,
            updatedAt: new Date().toISOString(),
          };

          return {
            brandGuidelines: updatedGuidelines,
            versionHistory: [...state.versionHistory, newVersion],
            error: null,
          };
        }),

      restoreVersion: (version) =>
        set((state) => {
          const versionEntry = state.versionHistory.find((v) => v.version === version);

          if (!versionEntry || !state.brandGuidelines) {
            return { error: 'Version not found' };
          }

          // Note: In a real implementation, you'd store full snapshots
          // For now, we just update the version number
          return {
            brandGuidelines: {
              ...state.brandGuidelines,
              version,
              updatedAt: new Date().toISOString(),
            },
            error: null,
          };
        }),

      // Asset Actions
      addAsset: (assetData) =>
        set((state) => {
          const newAsset: BrandAsset = {
            ...assetData,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            usageCount: 0,
          };

          return {
            assets: [...state.assets, newAsset],
            filteredAssets: [...state.assets, newAsset],
            error: null,
          };
        }),

      updateAsset: (id, updates) =>
        set((state) => {
          const updatedAssets = state.assets.map((asset) =>
            asset.id === id
              ? { ...asset, ...updates, updatedAt: new Date().toISOString() }
              : asset
          );

          return {
            assets: updatedAssets,
            filteredAssets: state.assetSearchFilters
              ? filterAssets(updatedAssets, state.assetSearchFilters)
              : updatedAssets,
            error: null,
          };
        }),

      deleteAsset: (id) =>
        set((state) => {
          const filtered = state.assets.filter((asset) => asset.id !== id);

          return {
            assets: filtered,
            filteredAssets: state.assetSearchFilters
              ? filterAssets(filtered, state.assetSearchFilters)
              : filtered,
            selectedAsset:
              state.selectedAsset?.id === id ? null : state.selectedAsset,
            error: null,
          };
        }),

      selectAsset: (asset) =>
        set({ selectedAsset: asset, error: null }),

      searchAssets: (filters) =>
        set((state) => ({
          assetSearchFilters: filters,
          filteredAssets: filterAssets(state.assets, filters),
          error: null,
        })),

      clearAssetFilters: () =>
        set((state) => ({
          assetSearchFilters: {},
          filteredAssets: state.assets,
          error: null,
        })),

      incrementAssetUsage: (id) =>
        set((state) => {
          const updatedAssets = state.assets.map((asset) =>
            asset.id === id
              ? { ...asset, usageCount: asset.usageCount + 1 }
              : asset
          );

          return {
            assets: updatedAssets,
            error: null,
          };
        }),

      // Style Guide Actions
      addStyleGuideEntry: (entryData) =>
        set((state) => {
          const newEntry: StyleGuideEntry = {
            ...entryData,
            id: generateId(),
          };

          return {
            styleGuide: [...state.styleGuide, newEntry],
            error: null,
          };
        }),

      updateStyleGuideEntry: (id, updates) =>
        set((state) => {
          const updatedEntries = state.styleGuide.map((entry) =>
            entry.id === id ? { ...entry, ...updates } : entry
          );

          return {
            styleGuide: updatedEntries,
            error: null,
          };
        }),

      deleteStyleGuideEntry: (id) =>
        set((state) => ({
          styleGuide: state.styleGuide.filter((entry) => entry.id !== id),
          error: null,
        })),

      // Persistence
      saveToStorage: async () => {
        set({ isSaving: true, error: null });

        try {
          // Data is automatically persisted by zustand persist middleware
          // This is for explicit save operations if needed
          await new Promise((resolve) => setTimeout(resolve, 500));

          set({ isSaving: false });
        } catch (error) {
          set({
            isSaving: false,
            error: error instanceof Error ? error.message : 'Failed to save',
          });
        }
      },

      loadFromStorage: async () => {
        set({ isLoading: true, error: null });

        try {
          // Data is automatically loaded by zustand persist middleware
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Initialize brand guidelines if none exist
          const state = get();
          if (!state.brandGuidelines) {
            const initialGuidelines = createInitialBrandGuidelines();
            set({ brandGuidelines: initialGuidelines });
          }

          set({ isLoading: false });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load',
          });
        }
      },

      resetState: () =>
        set({
          brandGuidelines: createInitialBrandGuidelines(),
          versionHistory: [],
          assets: [],
          filteredAssets: [],
          assetSearchFilters: {},
          styleGuide: [],
          selectedAsset: null,
          error: null,
        }),

      // UI Actions
      setIsEditingGuidelines: (isEditing) =>
        set({ isEditingGuidelines: isEditing }),

      setError: (error) =>
        set({ error }),
    }),
    {
      name: 'brand-knowledge-storage',
      // Only persist specific fields
      partialize: (state) => ({
        brandGuidelines: state.brandGuidelines,
        versionHistory: state.versionHistory,
        assets: state.assets,
        styleGuide: state.styleGuide,
      }),
    }
  )
);

/**
 * Filter assets based on search criteria
 */
function filterAssets(assets: BrandAsset[], filters: AssetSearchFilters): BrandAsset[] {
  let filtered = [...assets];

  // Filter by type
  if (filters.type && filters.type.length > 0) {
    filtered = filtered.filter((asset) => filters.type!.includes(asset.type));
  }

  // Filter by tags
  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter((asset) =>
      filters.tags!.some((tag) => asset.tags.includes(tag))
    );
  }

  // Filter by date range
  if (filters.dateRange) {
    const fromDate = new Date(filters.dateRange.from);
    const toDate = new Date(filters.dateRange.to);
    filtered = filtered.filter((asset) => {
      const assetDate = new Date(asset.createdAt);
      return assetDate >= fromDate && assetDate <= toDate;
    });
  }

  // Filter by search text
  if (filters.searchText) {
    const searchLower = filters.searchText.toLowerCase();
    filtered = filtered.filter(
      (asset) =>
        asset.name.toLowerCase().includes(searchLower) ||
        asset.description?.toLowerCase().includes(searchLower) ||
        asset.tags.some((tag) => tag.toLowerCase().includes(searchLower))
    );
  }

  return filtered;
}

/**
 * Hook to initialize brand knowledge on mount
 */
export async function initializeBrandKnowledge(): Promise<void> {
  try {
    const store = useBrandKnowledgeStore.getState();

    // Load from storage
    await store.loadFromStorage();

    // Initialize brand guidelines if none exist
    if (!store.brandGuidelines) {
      const initialGuidelines = createInitialBrandGuidelines();
      store.setBrandGuidelines(initialGuidelines);
    }
  } catch (error) {
    console.error('Failed to initialize brand knowledge:', error);
  }
}
