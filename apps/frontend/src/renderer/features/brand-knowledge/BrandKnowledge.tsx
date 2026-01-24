/**
 * Brand Knowledge Feature Component
 *
 * Main component for managing brand assets and guidelines.
 * Provides tabs for:
 * - Brand Guidelines (logo, colors, typography, tone)
 * - Asset Library (images, videos, templates)
 * - Style Guide (do/dont guidelines)
 * - Version History
 */

import { useEffect, useState } from 'react';
import { Palette, Library, BookOpen, History } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { useBrandKnowledgeStore, initializeBrandKnowledge } from './BrandKnowledgeStore';
import { BrandGuidelines } from './BrandGuidelines';
import { AssetLibrary } from './AssetLibrary';
import { StyleGuide } from './StyleGuide';
import { VersionHistory } from './VersionHistory';
import type { BrandKnowledgeProps } from './types';

export function BrandKnowledge({ projectId }: BrandKnowledgeProps) {
  const {
    brandGuidelines,
    isLoading,
    error,
    isSaving,
    isEditingGuidelines,
    saveToStorage,
    resetState,
    setIsEditingGuidelines,
  } = useBrandKnowledgeStore();

  const [activeTab, setActiveTab] = useState('guidelines');

  // Initialize on mount
  useEffect(() => {
    initializeBrandKnowledge();
  }, []);

  const handleSave = async () => {
    await saveToStorage();
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all brand knowledge? This cannot be undone.')) {
      resetState();
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Brand Knowledge</h2>
            <p className="text-sm text-muted-foreground">
              Manage your brand guidelines, assets, and style references
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading brand knowledge...</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <div className="border-b border-border px-6 py-3">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="guidelines" className="gap-2">
                <Palette className="h-4 w-4" />
                Guidelines
              </TabsTrigger>
              <TabsTrigger value="assets" className="gap-2">
                <Library className="h-4 w-4" />
                Assets
              </TabsTrigger>
              <TabsTrigger value="style" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Style Guide
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Brand Guidelines Tab */}
          <TabsContent value="guidelines" className="flex-1 overflow-hidden m-0">
            <BrandGuidelines
              guidelines={brandGuidelines}
              isEditing={isEditingGuidelines}
              onEdit={setIsEditingGuidelines}
            />
          </TabsContent>

          {/* Asset Library Tab */}
          <TabsContent value="assets" className="flex-1 overflow-hidden m-0">
            <AssetLibrary />
          </TabsContent>

          {/* Style Guide Tab */}
          <TabsContent value="style" className="flex-1 overflow-hidden m-0">
            <StyleGuide />
          </TabsContent>

          {/* Version History Tab */}
          <TabsContent value="history" className="flex-1 overflow-hidden m-0">
            <VersionHistory />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
