/**
 * Brand Guidelines Component
 *
 * Displays and edits brand guidelines including:
 * - Logo
 * - Color palette
 * - Typography
 * - Tone of voice
 * - Values and tagline
 */

import { useState } from 'react';
import { Palette, Type, MessageSquare, Heart, Tag, Edit2, Check, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useBrandKnowledgeStore } from './BrandKnowledgeStore';
import type { BrandGuidelines as BrandGuidelinesType } from './types';

interface BrandGuidelinesProps {
  guidelines: BrandGuidelinesType | null;
  isEditing: boolean;
  onEdit: (isEditing: boolean) => void;
}

export function BrandGuidelines({ guidelines, isEditing, onEdit }: BrandGuidelinesProps) {
  const { updateBrandGuidelines, createNewVersion } = useBrandKnowledgeStore();

  const [editForm, setEditForm] = useState<Partial<BrandGuidelinesType>>(
    guidelines || {
      name: '',
      logo: '',
      colors: {
        primary: '#0066CC',
        secondary: '#6C757D',
        accent: '#FF6B35',
      },
      typography: {
        heading: {
          fontFamily: 'Inter',
          fontWeight: '600',
          lineHeight: '1.2',
        },
        body: {
          fontFamily: 'Inter',
          fontWeight: '400',
          lineHeight: '1.5',
          fontSize: '16px',
        },
      },
      toneOfVoice: [],
      values: [],
      tagline: '',
    }
  );

  const [newTone, setNewTone] = useState('');
  const [newValue, setNewValue] = useState('');

  if (!guidelines && !isEditing) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Palette className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No brand guidelines found</p>
          <Button onClick={() => onEdit(true)} className="mt-4">
            Create Guidelines
          </Button>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    const changes: string[] = [];

    if (editForm.name !== guidelines?.name) changes.push('Updated brand name');
    if (editForm.tagline !== guidelines?.tagline) changes.push('Updated tagline');
    if (JSON.stringify(editForm.colors) !== JSON.stringify(guidelines?.colors)) {
      changes.push('Updated color palette');
    }

    updateBrandGuidelines(editForm);
    if (changes.length > 0) {
      createNewVersion(changes);
    }
    onEdit(false);
  };

  const handleCancel = () => {
    setEditForm(guidelines || {});
    onEdit(false);
  };

  const addTone = () => {
    if (newTone.trim()) {
      setEditForm({
        ...editForm,
        toneOfVoice: [...(editForm.toneOfVoice || []), newTone.trim()],
      });
      setNewTone('');
    }
  };

  const removeTone = (index: number) => {
    setEditForm({
      ...editForm,
      toneOfVoice: editForm.toneOfVoice?.filter((_, i) => i !== index),
    });
  };

  const addValue = () => {
    if (newValue.trim()) {
      setEditForm({
        ...editForm,
        values: [...(editForm.values || []), newValue.trim()],
      });
      setNewValue('');
    }
  };

  const removeValue = (index: number) => {
    setEditForm({
      ...editForm,
      values: editForm.values?.filter((_, i) => i !== index),
    });
  };

  const displayData = isEditing ? editForm : guidelines;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">Brand Guidelines</h3>
            <p className="text-sm text-muted-foreground">
              Version {displayData?.version} • Last updated:{' '}
              {new Date(displayData?.updatedAt || '').toLocaleDateString()}
            </p>
          </div>
          {!isEditing ? (
            <Button onClick={() => onEdit(true)} size="sm" variant="outline">
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleCancel} size="sm" variant="ghost">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} size="sm">
                <Check className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          )}
        </div>

        {/* Brand Identity */}
        <section className="space-y-4">
          <h4 className="text-lg font-medium flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Brand Identity
          </h4>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brand-name">Brand Name</Label>
              {isEditing ? (
                <Input
                  id="brand-name"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Enter brand name"
                />
              ) : (
                <p className="text-sm font-medium">{displayData?.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              {isEditing ? (
                <Input
                  id="tagline"
                  value={editForm.tagline || ''}
                  onChange={(e) => setEditForm({ ...editForm, tagline: e.target.value })}
                  placeholder="Enter tagline"
                />
              ) : (
                <p className="text-sm italic">"{displayData?.tagline}"</p>
              )}
            </div>
          </div>

          {/* Logo */}
          <div className="space-y-2">
            <Label htmlFor="logo">Logo URL</Label>
            {isEditing ? (
              <Input
                id="logo"
                value={editForm.logo || ''}
                onChange={(e) => setEditForm({ ...editForm, logo: e.target.value })}
                placeholder="Enter logo URL"
              />
            ) : displayData?.logo ? (
              <div className="border rounded-lg p-4 inline-block">
                <img src={displayData.logo} alt="Logo" className="h-16 w-auto" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No logo uploaded</p>
            )}
          </div>
        </section>

        {/* Color Palette */}
        <section className="space-y-4">
          <h4 className="text-lg font-medium flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Color Palette
          </h4>

          <div className="grid gap-4 md:grid-cols-3">
            {(['primary', 'secondary', 'accent'] as const).map((colorKey) => (
              <div key={colorKey} className="space-y-2">
                <Label className="capitalize">{colorKey} Color</Label>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Input
                        type="color"
                        value={editForm.colors?.[colorKey] || '#000000'}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            colors: {
                              ...editForm.colors!,
                              [colorKey]: e.target.value,
                            },
                          })
                        }
                        className="w-16 h-10 p-0 border-0"
                      />
                      <Input
                        value={editForm.colors?.[colorKey] || ''}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            colors: {
                              ...editForm.colors!,
                              [colorKey]: e.target.value,
                            },
                          })
                        }
                        placeholder="#000000"
                      />
                    </>
                  ) : (
                    <>
                      <div
                        className="w-16 h-10 rounded border"
                        style={{ backgroundColor: displayData?.colors?.[colorKey] }}
                      />
                      <p className="text-sm font-mono">{displayData?.colors?.[colorKey]}</p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Typography */}
        <section className="space-y-4">
          <h4 className="text-lg font-medium flex items-center gap-2">
            <Type className="h-5 w-5" />
            Typography
          </h4>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Heading Typography */}
            <div className="space-y-3 p-4 border rounded-lg">
              <Label className="text-base">Heading</Label>
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={editForm.typography?.heading?.fontFamily || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        typography: {
                          ...editForm.typography!,
                          heading: {
                            ...editForm.typography!.heading,
                            fontFamily: e.target.value,
                          },
                        },
                      })
                    }
                    placeholder="Font family"
                  />
                  <Input
                    value={editForm.typography?.heading?.fontWeight || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        typography: {
                          ...editForm.typography!,
                          heading: {
                            ...editForm.typography!.heading,
                            fontWeight: e.target.value,
                          },
                        },
                      })
                    }
                    placeholder="Font weight"
                  />
                </div>
              ) : (
                <div>
                  <p
                    style={{
                      fontFamily: displayData?.typography?.heading?.fontFamily,
                      fontWeight: displayData?.typography?.heading?.fontWeight as any,
                    }}
                    className="text-2xl"
                  >
                    Heading Text
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {displayData?.typography?.heading?.fontFamily} •{' '}
                    {displayData?.typography?.heading?.fontWeight}
                  </p>
                </div>
              )}
            </div>

            {/* Body Typography */}
            <div className="space-y-3 p-4 border rounded-lg">
              <Label className="text-base">Body</Label>
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={editForm.typography?.body?.fontFamily || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        typography: {
                          ...editForm.typography!,
                          body: {
                            ...editForm.typography!.body,
                            fontFamily: e.target.value,
                          },
                        },
                      })
                    }
                    placeholder="Font family"
                  />
                  <div className="flex gap-2">
                    <Input
                      value={editForm.typography?.body?.fontWeight || ''}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          typography: {
                            ...editForm.typography!,
                            body: {
                              ...editForm.typography!.body,
                              fontWeight: e.target.value,
                            },
                          },
                        })
                      }
                      placeholder="Weight"
                    />
                    <Input
                      value={editForm.typography?.body?.fontSize || ''}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          typography: {
                            ...editForm.typography!,
                            body: {
                              ...editForm.typography!.body,
                              fontSize: e.target.value,
                            },
                          },
                        })
                      }
                      placeholder="Size"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <p
                    style={{
                      fontFamily: displayData?.typography?.body?.fontFamily,
                      fontWeight: displayData?.typography?.body?.fontWeight as any,
                      fontSize: displayData?.typography?.body?.fontSize,
                    }}
                  >
                    Body text appears in this style. It should be readable and
                    comfortable for longer passages.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {displayData?.typography?.body?.fontFamily} •{' '}
                    {displayData?.typography?.body?.fontSize}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Tone of Voice */}
        <section className="space-y-4">
          <h4 className="text-lg font-medium flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Tone of Voice
          </h4>

          <div className="flex flex-wrap gap-2">
            {displayData?.toneOfVoice?.map((tone, index) => (
              <div
                key={index}
                className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm flex items-center gap-2"
              >
                {tone}
                {isEditing && (
                  <button
                    onClick={() => removeTone(index)}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            {isEditing && (
              <div className="flex gap-2">
                <Input
                  value={newTone}
                  onChange={(e) => setNewTone(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTone()}
                  placeholder="Add tone..."
                  className="w-32"
                />
                <Button onClick={addTone} size="sm" variant="outline">
                  Add
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Values */}
        <section className="space-y-4">
          <h4 className="text-lg font-medium flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Brand Values
          </h4>

          <div className="grid gap-2 md:grid-cols-3">
            {displayData?.values?.map((value, index) => (
              <div
                key={index}
                className="p-3 border rounded-lg flex items-center justify-between"
              >
                <span className="text-sm">{value}</span>
                {isEditing && (
                  <button
                    onClick={() => removeValue(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {isEditing && (
              <div className="flex gap-2 col-span-3">
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addValue()}
                  placeholder="Add a value..."
                />
                <Button onClick={addValue} size="sm" variant="outline">
                  Add
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
