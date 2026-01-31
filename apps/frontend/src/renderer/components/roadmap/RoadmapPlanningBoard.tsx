import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragCancelEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  MoreVertical,
  Edit2,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '../ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '../ui/collapsible';
import { useRoadmapStore } from '../../stores/roadmap-store';
import { ROADMAP_PRIORITY_COLORS, ROADMAP_STATUS_COLORS } from '../../../shared/constants';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion';
import type { RoadmapPhase, RoadmapFeature } from '../../../shared/types';

interface RoadmapPlanningBoardProps {
  projectId: string;
  onFeatureSelect: (feature: RoadmapFeature) => void;
}

/**
 * RoadmapPlanningBoard Component
 *
 * Provides a Kanban-style planning board for roadmap phases and features
 * with drag-and-drop, inline editing, and context menu actions.
 */
export function RoadmapPlanningBoard({ projectId, onFeatureSelect }: RoadmapPlanningBoardProps) {
  const { t } = useTranslation(['roadmap', 'common']);
  const roadmap = useRoadmapStore((state) => state.roadmap);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const updateFeatureStatus = useRoadmapStore((state) => state.updateFeatureStatus);
  const updateFeaturePriority = useRoadmapStore((state) => state.updateFeaturePriority);
  const deleteFeature = useRoadmapStore((state) => state.deleteFeature);
  const reorderFeatures = useRoadmapStore((state) => state.reorderFeatures);
  const updateFeaturePhase = useRoadmapStore((state) => state.updateFeaturePhase);
  const updateFeatureTitle = useRoadmapStore((state) => state.updateFeatureTitle);
  const updatePhase = useRoadmapStore((state) => state.updatePhase);
  const addFeature = useRoadmapStore((state) => state.addFeature);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !roadmap) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if we're dragging over a phase (to move feature between phases)
    const targetPhase = roadmap.phases.find((p) => p.id === overId);

    if (targetPhase) {
      // Move feature to different phase
      const activeFeature = roadmap.features.find((f) => f.id === activeId);
      if (activeFeature && activeFeature.phaseId !== overId) {
        updateFeaturePhase(activeId, overId);
      }
      return;
    }

    // Otherwise, we're reordering within the same phase
    if (activeId === overId) return;

    const activeFeature = roadmap.features.find((f) => f.id === activeId);
    const overFeature = roadmap.features.find((f) => f.id === overId);

    if (activeFeature && overFeature && activeFeature.phaseId === overFeature.phaseId) {
      // Get all features in this phase
      const phaseFeatures = roadmap.features
        .filter((f) => f.phaseId === activeFeature.phaseId)
        .map((f) => f.id);

      // Reorder
      const oldIndex = phaseFeatures.indexOf(activeId);
      const newIndex = phaseFeatures.indexOf(overId);

      const newFeatures = [...phaseFeatures];
      newFeatures.splice(oldIndex, 1);
      newFeatures.splice(newIndex, 0, activeId);

      reorderFeatures(activeFeature.phaseId, newFeatures);
    }
  };

  const togglePhaseCollapse = (phaseId: string) => {
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  const startEditing = (id: string, currentValue: string) => {
    setEditingId(id);
    setEditValue(currentValue);
  };

  const saveEdit = () => {
    if (editingId && editValue.trim()) {
      updateFeatureTitle(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleStatusChange = (featureId: string, status: RoadmapFeature['status']) => {
    updateFeatureStatus(featureId, status);
  };

  const handlePriorityChange = (featureId: string, priority: RoadmapFeature['priority']) => {
    updateFeaturePriority(featureId, priority);
  };

  const handleDeleteFeature = (featureId: string) => {
    if (confirm(t('roadmap:confirmDeleteFeature'))) {
      deleteFeature(featureId);
    }
  };

  const handleAddFeature = (phaseId: string) => {
    const newId = addFeature({
      title: t('roadmap:newFeature'),
      description: '',
      rationale: '',
      priority: 'should',
      complexity: 'medium',
      impact: 'medium',
      phaseId,
      dependencies: [],
      status: 'planned',
      acceptanceCriteria: [],
      userStories: []
    });

    // Start editing the new feature
    startEditing(newId, t('roadmap:newFeature'));
  };

  if (!roadmap) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t('roadmap:noRoadmap')}</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          {roadmap.phases.map((phase) => {
            const phaseFeatures = roadmap.features.filter((f) => f.phaseId === phase.id);
            const isCollapsed = collapsedPhases.has(phase.id);

            return (
              <PhaseColumn
                key={phase.id}
                phase={phase}
                features={phaseFeatures}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => togglePhaseCollapse(phase.id)}
                onFeatureSelect={onFeatureSelect}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
                onDeleteFeature={handleDeleteFeature}
                onAddFeature={() => handleAddFeature(phase.id)}
                onStartEdit={startEditing}
                editingId={editingId}
                editValue={editValue}
                onSaveEdit={saveEdit}
                onCancelEdit={cancelEdit}
                onEditChange={setEditValue}
                onUpdatePhase={(updates) => updatePhase(phase.id, updates)}
              />
            );
          })}
        </div>
      </ScrollArea>

      <DragOverlay>
        {activeId ? (
          <FeatureCardDragOverlay activeId={activeId} roadmap={roadmap} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface PhaseColumnProps {
  phase: RoadmapPhase;
  features: RoadmapFeature[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onFeatureSelect: (feature: RoadmapFeature) => void;
  onStatusChange: (featureId: string, status: RoadmapFeature['status']) => void;
  onPriorityChange: (featureId: string, priority: RoadmapFeature['priority']) => void;
  onDeleteFeature: (featureId: string) => void;
  onAddFeature: () => void;
  onStartEdit: (id: string, value: string) => void;
  editingId: string | null;
  editValue: string;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: (value: string) => void;
  onUpdatePhase: (updates: Partial<RoadmapPhase>) => void;
}

function PhaseColumn({
  phase,
  features,
  isCollapsed,
  onToggleCollapse,
  onFeatureSelect,
  onStatusChange,
  onPriorityChange,
  onDeleteFeature,
  onAddFeature,
  onStartEdit,
  editingId,
  editValue,
  onSaveEdit,
  onCancelEdit,
  onEditChange,
  onUpdatePhase
}: PhaseColumnProps) {
  const { t } = useTranslation(['roadmap', 'common']);

  const completedCount = features.filter((f) => f.status === 'done').length;
  const progress = features.length > 0 ? (completedCount / features.length) * 100 : 0;

  return (
    <Collapsible open={!isCollapsed} onOpenToggle={onToggleCollapse}>
      <Card className="overflow-hidden">
        {/* Phase Header */}
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3 flex-1">
              <Button variant="ghost" size="sm" className="shrink-0">
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{phase.name}</h3>
                  <Badge variant="outline">{phase.status}</Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span>
                    {t('roadmap:featuresCount', { count: features.length })}
                  </span>
                  <span>
                    {completedCount}/{features.length} {t('roadmap:completed')}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`${ROADMAP_STATUS_COLORS[phase.status]}`}
              >
                {Math.round(progress)}%
              </Badge>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {/* Features List */}
          <div className="border-t border-border/50">
            {features.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>{t('roadmap:noFeatures')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={onAddFeature}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t('roadmap:addFeature')}
                </Button>
              </div>
            ) : (
              <div className="p-2">
                <SortableContext
                  items={features.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {features.map((feature) => (
                        <SortableFeatureCard
                          key={feature.id}
                          feature={feature}
                          onSelect={onFeatureSelect}
                          onStatusChange={onStatusChange}
                          onPriorityChange={onPriorityChange}
                          onDelete={onDeleteFeature}
                          onStartEdit={onStartEdit}
                          editingId={editingId}
                          editValue={editValue}
                          onSaveEdit={onSaveEdit}
                          onCancelEdit={onCancelEdit}
                          onEditChange={onEditChange}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </SortableContext>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-muted-foreground"
                  onClick={onAddFeature}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t('roadmap:addFeature')}
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface SortableFeatureCardProps {
  feature: RoadmapFeature;
  onSelect: (feature: RoadmapFeature) => void;
  onStatusChange: (featureId: string, status: RoadmapFeature['status']) => void;
  onPriorityChange: (featureId: string, priority: RoadmapFeature['priority']) => void;
  onDelete: (featureId: string) => void;
  onStartEdit: (id: string, value: string) => void;
  editingId: string | null;
  editValue: string;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: (value: string) => void;
}

function SortableFeatureCard({
  feature,
  onSelect,
  onStatusChange,
  onPriorityChange,
  onDelete,
  onStartEdit,
  editingId,
  editValue,
  onSaveEdit,
  onCancelEdit,
  onEditChange
}: SortableFeatureCardProps) {
  const { t } = useTranslation(['roadmap', 'common']);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: feature.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  const isEditing = editingId === feature.id;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={`p-3 cursor-pointer hover:shadow-md transition-all ${
          isDragging ? 'opacity-50 shadow-lg' : ''
        } ${feature.status === 'done' ? 'opacity-60' : ''}`}
        onClick={() => !isEditing && onSelect(feature)}
      >
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          <button
            className="shrink-0 mt-1 text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => onEditChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSaveEdit();
                    if (e.key === 'Escape') onCancelEdit();
                  }}
                  className="flex-1 px-2 py-1 text-sm border rounded"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveEdit();
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className={`text-xs ${ROADMAP_PRIORITY_COLORS[feature.priority]}`}
                  >
                    {feature.priority}
                  </Badge>
                  <StatusBadge status={feature.status} />
                  <Badge variant="outline" className="text-xs">
                    {feature.complexity}
                  </Badge>
                </div>
                <h4 className={`font-medium text-sm ${feature.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                  {feature.title}
                </h4>
                {feature.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {feature.description}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onStartEdit(feature.id, feature.title)}>
                <Edit2 className="h-4 w-4 mr-2" />
                {t('common:actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub label={t('roadmap:status')}>
                <DropdownMenuItem onClick={() => onStatusChange(feature.id, 'planned')}>
                  <Circle className="h-4 w-4 mr-2 text-gray-500" />
                  {t('roadmap:status.planned')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(feature.id, 'in_progress')}>
                  <Clock className="h-4 w-4 mr-2 text-blue-500" />
                  {t('roadmap:status.in_progress')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(feature.id, 'done')}>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                  {t('roadmap:status.done')}
                </DropdownMenuItem>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuSub label={t('roadmap:priority')}>
                <DropdownMenuItem onClick={() => onPriorityChange(feature.id, 'must')}>
                  <span className="w-4 h-4 mr-2 rounded-full bg-red-500" />
                  {t('roadmap:priority.must')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPriorityChange(feature.id, 'should')}>
                  <span className="w-4 h-4 mr-2 rounded-full bg-orange-500" />
                  {t('roadmap:priority.should')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPriorityChange(feature.id, 'could')}>
                  <span className="w-4 h-4 mr-2 rounded-full bg-blue-500" />
                  {t('roadmap:priority.could')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPriorityChange(feature.id, 'wont')}>
                  <span className="w-4 h-4 mr-2 rounded-full bg-gray-500" />
                  {t('roadmap:priority.wont')}
                </DropdownMenuItem>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(feature.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('common:actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: RoadmapFeature['status'] }) {
  const { t } = useTranslation('roadmap');

  const variants = {
    planned: 'outline',
    in_progress: 'default',
    done: 'secondary',
    under_review: 'outline'
  } as const;

  const icons = {
    planned: <Circle className="h-3 w-3" />,
    in_progress: <Clock className="h-3 w-3" />,
    done: <CheckCircle2 className="h-3 w-3" />,
    under_review: <Circle className="h-3 w-3" />
  };

  return (
    <Badge variant={variants[status] as any} className="text-xs">
      {icons[status]}
      <span className="ml-1">{t(`status.${status}`)}</span>
    </Badge>
  );
}

function FeatureCardDragOverlay({ activeId, roadmap }: { activeId: string; roadmap: Roadmap }) {
  const feature = roadmap.features.find((f) => f.id === activeId);

  if (!feature) return null;

  return (
    <Card className="p-3 shadow-lg opacity-90">
      <div className="flex items-center gap-3">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs ${ROADMAP_PRIORITY_COLORS[feature.priority]}`}>
              {feature.priority}
            </Badge>
            <span className="font-medium text-sm">{feature.title}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Helper component for submenu
function DropdownMenuSub({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}
