/**
 * Asset Library Component
 *
 * Displays and manages brand assets including:
 * - Images
 * - Videos
 * - Templates
 * - Documents
 *
 * Features:
 * - Upload/add assets
 * - Filter by type and tags
 * - Search functionality
 * - Usage tracking
 */

import { useState } from 'react';
import {
  Library,
  Plus,
  Search,
  Filter,
  Image,
  Video,
  FileText,
  Music,
  Trash2,
  Eye,
  Tag as TagIcon,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import { useBrandKnowledgeStore } from './BrandKnowledgeStore';
import type { BrandAsset, AssetType } from './types';

const ASSET_TYPES = [
  { value: 'image', label: 'Image', icon: Image },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'template', label: 'Template', icon: FileText },
  { value: 'document', label: 'Document', icon: FileText },
  { value: 'audio', label: 'Audio', icon: Music },
] as const;

export function AssetLibrary() {
  const {
    assets,
    filteredAssets,
    assetSearchFilters,
    selectedAsset,
    isLoading,
    addAsset,
    updateAsset,
    deleteAsset,
    selectAsset,
    searchAssets,
    clearAssetFilters,
    incrementAssetUsage,
  } = useBrandKnowledgeStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [newAsset, setNewAsset] = useState<{
    type: AssetType;
    name: string;
    url: string;
    description: string;
    tags: string[];
  }>({
    type: 'image',
    name: '',
    url: '',
    description: '',
    tags: [],
  });
  const [newTag, setNewTag] = useState('');

  // Filter assets
  const handleSearch = () => {
    const filters: any = {};

    if (selectedType !== 'all') {
      filters.type = [selectedType as AssetType];
    }

    if (searchQuery.trim()) {
      filters.searchText = searchQuery;
    }

    searchAssets(filters);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    clearAssetFilters();
  };

  const handleAddAsset = () => {
    if (!newAsset.name || !newAsset.url) {
      return;
    }

    addAsset(newAsset);
    setShowAddDialog(false);
    setNewAsset({
      type: 'image',
      name: '',
      url: '',
      description: '',
      tags: [],
    });
  };

  const handleAddTag = () => {
    if (newTag.trim() && !newAsset.tags.includes(newTag.trim())) {
      setNewAsset({
        ...newAsset,
        tags: [...newAsset.tags, newTag.trim()],
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setNewAsset({
      ...newAsset,
      tags: newAsset.tags.filter((t) => t !== tag),
    });
  };

  const handlePreviewAsset = (asset: BrandAsset) => {
    selectAsset(asset);
    incrementAssetUsage(asset.id);
    setShowPreviewDialog(true);
  };

  const handleDeleteAsset = (id: string) => {
    if (confirm('Are you sure you want to delete this asset?')) {
      deleteAsset(id);
      if (selectedAsset?.id === id) {
        selectAsset(null);
        setShowPreviewDialog(false);
      }
    }
  };

  const getAssetIcon = (type: AssetType) => {
    const assetType = ASSET_TYPES.find((t) => t.value === type);
    return assetType ? assetType.icon : FileText;
  };

  const getAssetTypeLabel = (type: AssetType) => {
    const assetType = ASSET_TYPES.find((t) => t.value === type);
    return assetType?.label || type;
  };

  // Get all unique tags from assets
  const allTags = Array.from(
    new Set(assets.flatMap((asset) => asset.tags))
  ).sort();

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold">Asset Library</h3>
            <p className="text-sm text-muted-foreground">
              {filteredAssets.length} {filteredAssets.length === 1 ? 'asset' : 'assets'}
            </p>
          </div>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Asset
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Asset</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="asset-type">Type</Label>
                  <Select
                    value={newAsset.type}
                    onValueChange={(value) =>
                      setNewAsset({ ...newAsset, type: value as AssetType })
                    }
                  >
                    <SelectTrigger id="asset-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_TYPES.map((type) => {
                        const Icon = type.icon;
                        return (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="asset-name">Name</Label>
                  <Input
                    id="asset-name"
                    value={newAsset.name}
                    onChange={(e) =>
                      setNewAsset({ ...newAsset, name: e.target.value })
                    }
                    placeholder="Asset name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="asset-url">URL</Label>
                  <Input
                    id="asset-url"
                    value={newAsset.url}
                    onChange={(e) =>
                      setNewAsset({ ...newAsset, url: e.target.value })
                    }
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="asset-description">Description</Label>
                  <Input
                    id="asset-description"
                    value={newAsset.description}
                    onChange={(e) =>
                      setNewAsset({ ...newAsset, description: e.target.value })
                    }
                    placeholder="Brief description"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {newAsset.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs flex items-center gap-1"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder="Add tag..."
                    />
                    <Button
                      onClick={handleAddTag}
                      size="sm"
                      variant="outline"
                      type="button"
                    >
                      <TagIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowAddDialog(false)}
                    type="button"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddAsset} type="button">
                    Add Asset
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {ASSET_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={handleSearch} variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>

          <Button onClick={handleClearFilters} variant="ghost">
            Clear
          </Button>
        </div>

        {/* Asset Grid */}
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border rounded-lg border-dashed">
            <Library className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {assets.length === 0
                ? 'No assets yet. Add your first asset to get started.'
                : 'No assets match your filters.'}
            </p>
            {assets.length === 0 && (
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Asset
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAssets.map((asset) => {
              const AssetIcon = getAssetIcon(asset.type);
              return (
                <div
                  key={asset.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  {/* Asset Preview */}
                  <div className="aspect-video bg-muted rounded-md mb-3 flex items-center justify-center overflow-hidden">
                    {asset.type === 'image' && asset.url ? (
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <AssetIcon className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>

                  {/* Asset Info */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium truncate flex-1">{asset.name}</h4>
                      <span className="text-xs text-muted-foreground ml-2">
                        {getAssetTypeLabel(asset.type)}
                      </span>
                    </div>

                    {asset.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {asset.description}
                      </p>
                    )}

                    {/* Tags */}
                    {asset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {asset.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                        {asset.tags.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{asset.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground">
                        Used {asset.usageCount} {asset.usageCount === 1 ? 'time' : 'times'}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          onClick={() => handlePreviewAsset(asset)}
                          size="sm"
                          variant="ghost"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteAsset(asset.id)}
                          size="sm"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tags Summary */}
        {allTags.length > 0 && (
          <div className="mt-8 pt-6 border-t">
            <h4 className="text-sm font-medium mb-3">All Tags</h4>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setSearchQuery(tag);
                    handleSearch();
                  }}
                  className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm hover:bg-secondary/80 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedAsset?.name}</DialogTitle>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-4">
              <div className="aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden">
                {selectedAsset.type === 'image' ? (
                  <img
                    src={selectedAsset.url}
                    alt={selectedAsset.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center">
                    {(() => {
                      const Icon = getAssetIcon(selectedAsset.type);
                      return <Icon className="h-16 w-16 text-muted-foreground mx-auto" />;
                    })()}
                    <p className="text-sm text-muted-foreground mt-2">
                      Preview not available for this asset type
                    </p>
                  </div>
                )}
              </div>

              {selectedAsset.description && (
                <div>
                  <Label>Description</Label>
                  <p className="text-sm">{selectedAsset.description}</p>
                </div>
              )}

              {selectedAsset.tags.length > 0 && (
                <div>
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedAsset.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-primary/10 text-primary rounded-full text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>Type</Label>
                  <p>{getAssetTypeLabel(selectedAsset.type)}</p>
                </div>
                <div>
                  <Label>Usage</Label>
                  <p>
                    {selectedAsset.usageCount} {selectedAsset.usageCount === 1 ? 'time' : 'times'}
                  </p>
                </div>
                <div>
                  <Label>Created</Label>
                  <p>{new Date(selectedAsset.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label>Last Updated</Label>
                  <p>{new Date(selectedAsset.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedAsset.dimensions && (
                <div>
                  <Label>Dimensions</Label>
                  <p>
                    {selectedAsset.dimensions.width} × {selectedAsset.dimensions.height}px
                  </p>
                </div>
              )}

              {selectedAsset.size && (
                <div>
                  <Label>File Size</Label>
                  <p>{(selectedAsset.size / 1024).toFixed(2)} KB</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
