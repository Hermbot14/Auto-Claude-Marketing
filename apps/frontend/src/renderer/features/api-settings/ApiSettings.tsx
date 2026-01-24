/**
 * ApiSettings - Main API settings configuration panel
 *
 * Features:
 * - API token input with show/hide toggle
 * - Base URL input
 * - Timeout slider
 * - Model selector integration
 * - Connection test integration
 * - Save/Cancel buttons
 * - Settings persistence
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Loader2, Save, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { useApiSettingsStore } from './ApiSettingsStore';
import { ModelSelector } from './ModelSelector';
import { ConnectionTest } from './ConnectionTest';
import { cn } from '../../lib/utils';
import { useToast } from '../../hooks/use-toast';

interface ApiSettingsProps {
  isOpen?: boolean;
}

export function ApiSettings({ isOpen = false }: ApiSettingsProps) {
  const { t } = useTranslation('settings');
  const { toast } = useToast();

  const {
    apiToken,
    baseUrl,
    timeout,
    showToken,
    setApiToken,
    setBaseUrl,
    setTimeout,
    setShowToken,
    saveSettings,
    resetSettings,
  } = useApiSettingsStore();

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  const handleApiTokenChange = (value: string) => {
    setApiToken(value);
    setHasChanges(true);
  };

  const handleBaseUrlChange = (value: string) => {
    setBaseUrl(value);
    setHasChanges(true);
  };

  const handleTimeoutChange = (value: number) => {
    setTimeout(value);
    setHasChanges(true);
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await saveSettings();
      if (success) {
        setHasChanges(false);
        toast({
          title: t('apiConfig.toast.settingsSaved'),
          description: t('apiConfig.toast.settingsSavedDescription'),
        });
      } else {
        toast({
          variant: 'destructive',
          title: t('apiConfig.toast.saveFailed'),
          description: t('apiConfig.toast.saveFailedDescription'),
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('apiConfig.toast.saveFailed'),
        description: error instanceof Error ? error.message : t('apiConfig.toast.saveError'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel/reset
  const handleCancel = () => {
    resetSettings();
    setHasChanges(false);
    toast({
      title: t('apiConfig.toast.changesDiscarded'),
      description: t('apiConfig.toast.changesDiscardedDescription'),
    });
  };

  return (
    <SettingsSection
      title={t('apiConfig.title')}
      description={t('apiConfig.description')}
    >
      <div className="space-y-6">
        {/* API Token */}
        <div className="space-y-2">
          <Label htmlFor="api-token">
            {t('apiConfig.apiToken')} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="api-token"
              type={showToken ? 'text' : 'password'}
              placeholder={t('apiConfig.placeholder.apiToken')}
              value={apiToken}
              onChange={(e) => handleApiTokenChange(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showToken ? t('apiConfig.actions.hideToken') : t('apiConfig.actions.showToken')}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('apiConfig.apiTokenDescription', {
              link: (
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {t('apiConfig.apiTokenLink')}
                </a>
              )
            })}
          </p>
        </div>

        {/* Base URL */}
        <div className="space-y-2">
          <Label htmlFor="base-url">
            {t('apiConfig.baseUrl')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="base-url"
            type="url"
            placeholder={t('apiConfig.placeholder.baseUrl')}
            value={baseUrl}
            onChange={(e) => handleBaseUrlChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t('apiConfig.baseUrlDescription')}
          </p>
        </div>

        {/* Timeout Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="timeout">{t('apiConfig.requestTimeout')}</Label>
            <span className="text-sm font-mono text-muted-foreground">{timeout}{t('apiConfig.seconds')}</span>
          </div>
          <input
            id="timeout"
            type="range"
            min="30"
            max="600"
            step="30"
            value={timeout}
            onChange={(e) => handleTimeoutChange(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            aria-describedby="timeout-description"
          />
          <p id="timeout-description" className="text-xs text-muted-foreground">
            {t('apiConfig.requestTimeoutDescription')}
          </p>
        </div>

        {/* Connection Test */}
        <div className="pt-4 border-t border-border/50">
          <ConnectionTest />
        </div>

        {/* Model Selection */}
        <div className="pt-4 border-t border-border/50">
          <ModelSelector />
        </div>

        {/* Action Buttons */}
        {hasChanges && (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              {t('apiConfig.actions.cancel')}
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('apiConfig.actions.saving')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {t('apiConfig.actions.save')}
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

export default ApiSettings;
