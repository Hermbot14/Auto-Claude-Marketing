/**
 * Style Guide Component
 *
 * Displays and manages style guide entries including:
 * - Do's and Don'ts
 * - Category organization
 * - Visual examples
 * - Rationale explanations
 */

import { useState } from 'react';
import { BookOpen, Plus, CheckCircle, XCircle, Trash2, Edit2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { useBrandKnowledgeStore } from './BrandKnowledgeStore';
import type { StyleGuideEntry } from './types';

const CATEGORIES = [
  'Visual Design',
  'Copywriting',
  'User Experience',
  'Accessibility',
  'Brand Voice',
  'Social Media',
  'Email Marketing',
  'Other',
];

export function StyleGuide() {
  const { styleGuide, addStyleGuideEntry, updateStyleGuideEntry, deleteStyleGuideEntry } =
    useBrandKnowledgeStore();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<StyleGuideEntry | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [formData, setFormData] = useState({
    category: 'Visual Design',
    do: [''],
    dont: [''],
    rationale: '',
  });

  const filteredEntries =
    selectedCategory === 'all'
      ? styleGuide
      : styleGuide.filter((entry) => entry.category === selectedCategory);

  const handleAddDo = () => {
    setFormData({
      ...formData,
      do: [...formData.do, ''],
    });
  };

  const handleRemoveDo = (index: number) => {
    setFormData({
      ...formData,
      do: formData.do.filter((_, i) => i !== index),
    });
  };

  const handleUpdateDo = (index: number, value: string) => {
    const newDo = [...formData.do];
    newDo[index] = value;
    setFormData({
      ...formData,
      do: newDo,
    });
  };

  const handleAddDont = () => {
    setFormData({
      ...formData,
      dont: [...formData.dont, ''],
    });
  };

  const handleRemoveDont = (index: number) => {
    setFormData({
      ...formData,
      dont: formData.dont.filter((_, i) => i !== index),
    });
  };

  const handleUpdateDont = (index: number, value: string) => {
    const newDont = [...formData.dont];
    newDont[index] = value;
    setFormData({
      ...formData,
      dont: newDont,
    });
  };

  const handleSave = () => {
    const entry = {
      category: formData.category,
      do: formData.do.filter((item) => item.trim()),
      dont: formData.dont.filter((item) => item.trim()),
      rationale: formData.rationale,
    };

    if (editingEntry) {
      updateStyleGuideEntry(editingEntry.id, entry);
      setEditingEntry(null);
    } else {
      addStyleGuideEntry(entry);
    }

    setShowAddDialog(false);
    setFormData({
      category: 'Visual Design',
      do: [''],
      dont: [''],
      rationale: '',
    });
  };

  const handleEdit = (entry: StyleGuideEntry) => {
    setEditingEntry(entry);
    setFormData({
      category: entry.category,
      do: [...entry.do],
      dont: [...entry.dont],
      rationale: entry.rationale || '',
    });
    setShowAddDialog(true);
  };

  const handleCancel = () => {
    setShowAddDialog(false);
    setEditingEntry(null);
    setFormData({
      category: 'Visual Design',
      do: [''],
      dont: [''],
      rationale: '',
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this style guide entry?')) {
      deleteStyleGuideEntry(id);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold">Style Guide</h3>
            <p className="text-sm text-muted-foreground">
              Do's and Don'ts for maintaining brand consistency
            </p>
          </div>

          <Dialog open={showAddDialog} onOpenChange={(open) => !open && handleCancel()}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingEntry(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingEntry ? 'Edit Style Guide Entry' : 'Add Style Guide Entry'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Do's */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Do's
                    </Label>
                    <Button onClick={handleAddDo} size="sm" variant="outline">
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  {formData.do.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={item}
                        onChange={(e) => handleUpdateDo(index, e.target.value)}
                        placeholder="Enter a best practice..."
                      />
                      {formData.do.length > 1 && (
                        <Button
                          onClick={() => handleRemoveDo(index)}
                          size="sm"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Don'ts */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Don'ts
                    </Label>
                    <Button onClick={handleAddDont} size="sm" variant="outline">
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  {formData.dont.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={item}
                        onChange={(e) => handleUpdateDont(index, e.target.value)}
                        placeholder="Enter a pitfall to avoid..."
                      />
                      {formData.dont.length > 1 && (
                        <Button
                          onClick={() => handleRemoveDont(index)}
                          size="sm"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Rationale */}
                <div className="space-y-2">
                  <Label htmlFor="rationale">Rationale (Optional)</Label>
                  <Textarea
                    id="rationale"
                    value={formData.rationale}
                    onChange={(e) =>
                      setFormData({ ...formData, rationale: e.target.value })
                    }
                    placeholder="Explain why these guidelines are important..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button onClick={handleCancel} variant="outline" type="button">
                    Cancel
                  </Button>
                  <Button onClick={handleSave} type="button">
                    {editingEntry ? 'Update' : 'Add'} Entry
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Category Filter */}
        <div className="mb-6">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Style Guide Entries */}
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border rounded-lg border-dashed">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {styleGuide.length === 0
                ? 'No style guide entries yet. Add your first entry to get started.'
                : 'No entries in this category.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEntries.map((entry) => (
              <Card key={entry.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{entry.category}</CardTitle>
                      {entry.rationale && (
                        <CardDescription className="mt-1">{entry.rationale}</CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        onClick={() => handleEdit(entry)}
                        size="sm"
                        variant="ghost"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handleDelete(entry.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Do's */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-green-600 flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Do
                      </h4>
                      <ul className="space-y-2">
                        {entry.do.map((item, index) => (
                          <li key={index} className="flex gap-2">
                            <span className="text-green-500 mt-0.5">✓</span>
                            <span className="text-sm">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Don'ts */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-red-600 flex items-center gap-2">
                        <XCircle className="h-5 w-5" />
                        Don't
                      </h4>
                      <ul className="space-y-2">
                        {entry.dont.map((item, index) => (
                          <li key={index} className="flex gap-2">
                            <span className="text-red-500 mt-0.5">✗</span>
                            <span className="text-sm">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Examples (if present) */}
                  {entry.examples && (entry.examples.good || entry.examples.bad) && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="font-medium mb-3">Examples</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        {entry.examples.good && (
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-xs font-medium text-green-700 mb-1">
                              Good Example
                            </p>
                            <p className="text-sm">{entry.examples.good}</p>
                          </div>
                        )}
                        {entry.examples.bad && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-xs font-medium text-red-700 mb-1">
                              Bad Example
                            </p>
                            <p className="text-sm">{entry.examples.bad}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
