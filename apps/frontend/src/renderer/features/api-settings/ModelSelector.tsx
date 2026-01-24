/**
 * ModelSelector - Component for selecting AI models
 *
 * Features:
 * - Dropdowns for Haiku, Sonnet, Opus models
 * - Loads from global settings (read-only display)
 * - Custom model input option
 * - Model validation
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useApiSettingsStore, type ModelConfig } from './ApiSettingsStore';
import { cn } from '../../lib/utils';

/**
 * Available model options for each model type
 */
const MODEL_OPTIONS = {
  haiku: [
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    { id: 'custom', name: 'Custom Model...' },
  ],
  sonnet: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
    { id: 'custom', name: 'Custom Model...' },
  ],
  opus: [
    { id: 'claude-3-5-opus-20241022', name: 'Claude 3.5 Opus' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    { id: 'custom', name: 'Custom Model...' },
  ],
};

interface ModelSelectorProps {
  className?: string;
  readOnly?: boolean;
}

export function ModelSelector({ className, readOnly = false }: ModelSelectorProps) {
  const { t } = useTranslation();
  const { models, setModel } = useApiSettingsStore();

  // Local state for custom model inputs
  const [customModels, setCustomModels] = useState<Partial<ModelConfig>>({});
  const [showCustomInput, setShowCustomInput] = useState<Partial<Record<keyof ModelConfig, boolean>>>({});

  // Load global models on mount
  useEffect(() => {
    const loadGlobalModels = async () => {
      try {
        const result = await window.electronAPI.getSettings();
        if (result.success && result.data?.models) {
          const globalModels = result.data.models as ModelConfig;
          // Display global models as reference (read-only)
          console.log('Global models loaded:', globalModels);
        }
      } catch (error) {
        console.error('Failed to load global models:', error);
      }
    };

    loadGlobalModels();
  }, []);

  const handleModelChange = (modelType: keyof ModelConfig, value: string) => {
    if (value === 'custom') {
      setShowCustomInput((prev) => ({ ...prev, [modelType]: true }));
    } else {
      setShowCustomInput((prev) => ({ ...prev, [modelType]: false }));
      setModel(modelType, value);
    }
  };

  const handleCustomModelChange = (modelType: keyof ModelConfig, value: string) => {
    setCustomModels((prev) => ({ ...prev, [modelType]: value }));
    setModel(modelType, value);
  };

  const renderModelSelector = (modelType: keyof ModelConfig, label: string, placeholder: string) => {
    const currentValue = models[modelType];
    const isCustom = !MODEL_OPTIONS[modelType].some((opt) => opt.id === currentValue);
    const showCustom = showCustomInput[modelType] || isCustom;

    return (
      <div key={modelType} className="space-y-2">
        <Label htmlFor={`model-${modelType}`} className="text-sm text-muted-foreground">
          {label}
        </Label>

        {!showCustom ? (
          <Select
            value={currentValue}
            onValueChange={(value) => handleModelChange(modelType, value)}
            disabled={readOnly}
          >
            <SelectTrigger id={`model-${modelType}`}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS[modelType].map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex gap-2">
            <Input
              id={`model-${modelType}-custom`}
              value={isCustom ? currentValue : customModels[modelType] || ''}
              onChange={(e) => handleCustomModelChange(modelType, e.target.value)}
              placeholder={placeholder}
              disabled={readOnly}
              className="flex-1"
            />
            {!readOnly && (
              <button
                type="button"
                onClick={() => {
                  setShowCustomInput((prev) => ({ ...prev, [modelType]: false }));
                  setModel(modelType, MODEL_OPTIONS[modelType][0].id);
                }}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-accent transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <Label className="text-base">Model Selection</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Select the AI models to use for different tasks
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {renderModelSelector('haiku', 'Haiku Model', 'Select Haiku model...')}
        {renderModelSelector('sonnet', 'Sonnet Model', 'Select Sonnet model...')}
        {renderModelSelector('opus', 'Opus Model', 'Select Opus model...')}
      </div>

      {/* Global models reference */}
      <div className="pt-4 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          <strong>Tip:</strong> These models override the global settings. Leave empty to use defaults from
          global configuration.
        </p>
      </div>
    </div>
  );
}
