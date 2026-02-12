import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Grid,
  List,
  Star,
  Clock,
  Users,
  Check,
  Folder,
  Zap,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { cn } from '../../../shared/lib/utils';
import type { WorkflowTemplate } from '../../../shared/types/workflow';

/**
 * WorkflowTemplates - Template browser and selection component
 *
 * Provides a searchable, filterable template library with:
 * - Grid and list view modes
 * - Category filtering
 * - Search functionality
 * - Template preview
 * - Usage statistics
 */
interface WorkflowTemplatesProps {
  templates: WorkflowTemplate[];
  onSelectTemplate: (template: WorkflowTemplate) => void;
  onCreateNew: () => void;
  onClose?: () => void;
}

type ViewMode = 'grid' | 'list';
type Category = 'all' | 'automation' | 'integration' | 'custom' | 'favorites';

export function WorkflowTemplates({
  templates,
  onSelectTemplate,
  onCreateNew,
  onClose
}: WorkflowTemplatesProps) {
  const { t } = useTranslation(['workflow', 'common']);

  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  /**
   * Toggle favorite status
   */
  const toggleFavorite = useCallback((templateId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(templateId)) {
        newFavorites.delete(templateId);
      } else {
        newFavorites.add(templateId);
      }
      return newFavorites;
    });
  }, []);

  /**
   * Filter templates by category and search query
   */
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      // Category filter
      if (selectedCategory !== 'all' && selectedCategory !== 'favorites') {
        if (selectedCategory === 'automation' && !template.tags?.includes('automation')) {
          return false;
        }
        if (selectedCategory === 'integration' && !template.tags?.includes('integration')) {
          return false;
        }
        if (selectedCategory === 'custom' && !template.tags?.includes('custom')) {
          return false;
        }
      }

      // Favorites filter
      if (selectedCategory === 'favorites' && !favorites.has(template.id)) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          template.name.toLowerCase().includes(query) ||
          template.description?.toLowerCase().includes(query) ||
          template.tags?.some(tag => tag.toLowerCase().includes(query))
        );
      }

      return true;
    });
  }, [templates, selectedCategory, searchQuery, favorites]);

  /**
   * Group templates by category
   */
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, WorkflowTemplate[]> = {
      automation: [],
      integration: [],
      custom: []
    };

    filteredTemplates.forEach(template => {
      if (template.tags?.includes('automation')) {
        groups.automation.push(template);
      } else if (template.tags?.includes('integration')) {
        groups.integration.push(template);
      } else {
        groups.custom.push(template);
      }
    });

    return groups;
  }, [filteredTemplates]);

  /**
   * Handle template selection
   */
  const handleSelectTemplate = useCallback((template: WorkflowTemplate) => {
    setSelectedTemplate(template);
    onSelectTemplate(template);
    onClose?.();
  }, [onSelectTemplate, onClose]);

  /**
   * Render template card for grid view
   */
  const renderTemplateCard = (template: WorkflowTemplate) => (
    <motion.div
      key={template.id}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="relative"
    >
      <Card
        className={cn(
          'p-4 cursor-pointer transition-all hover:shadow-lg hover:border-primary/50',
          selectedTemplate?.id === template.id && 'ring-2 ring-primary'
        )}
        onClick={() => handleSelectTemplate(template)}
      >
        {/* Favorite button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(template.id);
          }}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-accent transition-colors"
        >
          <Star
            className={cn(
              'h-4 w-4',
              favorites.has(template.id) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
            )}
          />
        </button>

        {/* Template icon */}
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
          {template.icon === 'zap' && <Zap className="h-6 w-6" />}
          {template.icon === 'file-text' && <FileText className="h-6 w-6" />}
          {template.icon === 'folder' && <Folder className="h-6 w-6" />}
          {!template.icon && <Check className="h-6 w-6" />}
        </div>

        {/* Template info */}
        <h3 className="text-sm font-semibold text-foreground mb-1 line-clamp-1">
          {template.name}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {template.description}
        </p>

        {/* Template metadata */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {template.usageCount !== undefined && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{template.usageCount}</span>
            </div>
          )}
          {template.complexity && (
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              <span>{t(`workflow:templates.complexity.${template.complexity}`)}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {template.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );

  /**
   * Render template row for list view
   */
  const renderTemplateRow = (template: WorkflowTemplate) => (
    <motion.div
      key={template.id}
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          'p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/50',
          selectedTemplate?.id === template.id && 'ring-2 ring-primary'
        )}
        onClick={() => handleSelectTemplate(template)}
      >
        <div className="flex items-center gap-4">
          {/* Template icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {template.icon === 'zap' && <Zap className="h-5 w-5" />}
            {template.icon === 'file-text' && <FileText className="h-5 w-5" />}
            {template.icon === 'folder' && <Folder className="h-5 w-5" />}
            {!template.icon && <Check className="h-5 w-5" />}
          </div>

          {/* Template info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {template.name}
              </h3>
              {template.usageCount !== undefined && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{template.usageCount}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {template.description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(template.id);
              }}
            >
              <Star
                className={cn(
                  'h-4 w-4',
                  favorites.has(template.id) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                )}
              />
            </Button>
            <Button size="sm" variant="outline">
              {t('common:actions.use')}
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card p-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-foreground">
            {t('workflow:templates.title')}
          </h2>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('workflow:templates.search')}
              className="h-9 w-64 rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center border border-border rounded-lg">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <Button variant="outline" size="sm" onClick={onCreateNew}>
            {t('workflow:templates.create')}
          </Button>
        </div>
      </div>

      {/* Category filters and content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar with categories */}
        <div className="w-48 border-r border-border bg-muted/20 p-4">
          <nav className="space-y-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Folder className="h-4 w-4" />
              <span>{t('workflow:templates.categories.all')}</span>
            </button>

            <button
              onClick={() => setSelectedCategory('favorites')}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                selectedCategory === 'favorites'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Star className="h-4 w-4" />
              <span>{t('workflow:templates.categories.favorites')}</span>
            </button>

            <Separator className="my-2" />

            <button
              onClick={() => setSelectedCategory('automation')}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                selectedCategory === 'automation'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Zap className="h-4 w-4" />
              <span>{t('workflow:templates.categories.automation')}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {groupedTemplates.automation.length}
              </span>
            </button>

            <button
              onClick={() => setSelectedCategory('integration')}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                selectedCategory === 'integration'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Check className="h-4 w-4" />
              <span>{t('workflow:templates.categories.integration')}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {groupedTemplates.integration.length}
              </span>
            </button>

            <button
              onClick={() => setSelectedCategory('custom')}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                selectedCategory === 'custom'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <FileText className="h-4 w-4" />
              <span>{t('workflow:templates.categories.custom')}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {groupedTemplates.custom.length}
              </span>
            </button>
          </nav>
        </div>

        {/* Template grid/list */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {filteredTemplates.length === 0 ? (
              <div className="flex h-96 flex-col items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
                  <Search className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t('workflow:templates.noResults.title')}
                </h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  {t('workflow:templates.noResults.description')}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <AnimatePresence>
                  {filteredTemplates.map(renderTemplateCard)}
                </AnimatePresence>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {filteredTemplates.map(renderTemplateRow)}
                </AnimatePresence>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
