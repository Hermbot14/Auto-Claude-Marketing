/**
 * API Settings Store - Zustand store for API configuration management
 *
 * Manages state for API settings including:
 * - API token and base URL
 * - Request timeout configuration
 * - Model selection (Haiku, Sonnet, Opus)
 * - Connection testing
 * - Persistence to backend/localStorage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TestConnectionResult } from '@shared/types/profile';

/**
 * Model configuration structure
 */
export interface ModelConfig {
  haiku: string;
  sonnet: string;
  opus: string;
}

/**
 * API Settings state structure
 */
export interface ApiSettingsState {
  // API Configuration
  apiToken: string;
  baseUrl: string;
  timeout: number; // in seconds

  // Model Configuration
  models: ModelConfig;

  // Connection Testing
  isTestingConnection: boolean;
  testConnectionResult: TestConnectionResult | null;

  // UI State
  showToken: boolean;

  // Actions
  setApiToken: (token: string) => void;
  setBaseUrl: (url: string) => void;
  setTimeout: (timeout: number) => void;
  setModels: (models: ModelConfig) => void;
  setModel: (modelType: keyof ModelConfig, modelId: string) => void;
  setShowToken: (show: boolean) => void;

  // Connection Testing
  testConnection: () => Promise<TestConnectionResult | null>;
  clearTestResult: () => void;

  // Persistence
  saveSettings: () => Promise<boolean>;
  resetSettings: () => void;
}

/**
 * Default model configuration
 */
const DEFAULT_MODELS: ModelConfig = {
  haiku: 'claude-3-5-haiku-20241022',
  sonnet: 'claude-3-5-sonnet-20241022',
  opus: 'claude-3-5-opus-20241022',
};

/**
 * Default timeout (5 minutes)
 */
const DEFAULT_TIMEOUT = 300;

/**
 * Create the API settings store with persistence
 */
export const useApiSettingsStore = create<ApiSettingsState>()(
  persist(
    (set, get) => ({
      // Initial state
      apiToken: '',
      baseUrl: 'https://api.anthropic.com',
      timeout: DEFAULT_TIMEOUT,
      models: DEFAULT_MODELS,
      isTestingConnection: false,
      testConnectionResult: null,
      showToken: false,

      // Actions
      setApiToken: (token) => set({ apiToken: token }),

      setBaseUrl: (url) => set({ baseUrl: url }),

      setTimeout: (timeout) => set({ timeout }),

      setModels: (models) => set({ models }),

      setModel: (modelType, modelId) =>
        set((state) => ({
          models: {
            ...state.models,
            [modelType]: modelId,
          },
        })),

      setShowToken: (show) => set({ showToken: show }),

      // Connection testing
      testConnection: async () => {
        const { apiToken, baseUrl } = get();

        if (!apiToken || !baseUrl) {
          const errorResult: TestConnectionResult = {
            success: false,
            errorType: 'unknown',
            message: 'API token and base URL are required',
          };
          set({ testConnectionResult: errorResult });
          return errorResult;
        }

        set({ isTestingConnection: true, testConnectionResult: null });

        try {
          // Call the backend to test connection
          const result = await window.electronAPI.testConnection(baseUrl, apiToken);

          if (result.success && result.data) {
            set({ testConnectionResult: result.data, isTestingConnection: false });
            return result.data;
          }

          const errorResult: TestConnectionResult = {
            success: false,
            errorType: 'unknown',
            message: result.error || 'Connection test failed',
          };
          set({ testConnectionResult: errorResult, isTestingConnection: false });
          return errorResult;
        } catch (error) {
          const errorResult: TestConnectionResult = {
            success: false,
            errorType: 'unknown',
            message: error instanceof Error ? error.message : 'Connection test failed',
          };
          set({ testConnectionResult: errorResult, isTestingConnection: false });
          return errorResult;
        }
      },

      clearTestResult: () => set({ testConnectionResult: null }),

      // Persistence
      saveSettings: async () => {
        const { apiToken, baseUrl, timeout, models } = get();

        try {
          // Save to backend via IPC
          const result = await window.electronAPI.saveSettings({
            apiToken,
            baseUrl,
            timeout,
            models,
          });

          return result.success;
        } catch (error) {
          console.error('Failed to save API settings:', error);
          return false;
        }
      },

      resetSettings: () =>
        set({
          apiToken: '',
          baseUrl: 'https://api.anthropic.com',
          timeout: DEFAULT_TIMEOUT,
          models: DEFAULT_MODELS,
          showToken: false,
          testConnectionResult: null,
        }),
    }),
    {
      name: 'api-settings-storage',
      // Only persist specific fields
      partialize: (state) => ({
        apiToken: state.apiToken,
        baseUrl: state.baseUrl,
        timeout: state.timeout,
        models: state.models,
      }),
    }
  )
);

/**
 * Hook to load API settings from global settings on mount
 */
export async function loadApiSettingsFromGlobal(): Promise<void> {
  try {
    const result = await window.electronAPI.getSettings();
    if (result.success && result.data) {
      const store = useApiSettingsStore.getState();
      const { apiToken, baseUrl, timeout, models } = result.data;

      if (apiToken) store.setApiToken(apiToken);
      if (baseUrl) store.setBaseUrl(baseUrl);
      if (timeout) store.setTimeout(timeout);
      if (models) store.setModels(models as ModelConfig);
    }
  } catch (error) {
    console.error('Failed to load API settings from global:', error);
  }
}
