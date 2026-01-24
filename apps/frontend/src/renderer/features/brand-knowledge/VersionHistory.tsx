/**
 * Version History Component
 *
 * Displays version history for brand guidelines including:
 * - Version numbers
 * - Timestamps
 * - Change descriptions
 * - Authors
 * - Restore functionality
 */

import { History, Clock, User, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { useBrandKnowledgeStore } from './BrandKnowledgeStore';
import type { BrandVersion } from './types';

export function VersionHistory() {
  const { brandGuidelines, versionHistory, restoreVersion } = useBrandKnowledgeStore();

  const handleRestore = (version: number) => {
    if (
      confirm(
        `Are you sure you want to restore version ${version}? This will create a new version based on the restored state.`
      )
    ) {
      restoreVersion(version);
    }
  };

  if (!brandGuidelines) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No version history available</p>
        </div>
      </div>
    );
  }

  // Include current version
  const allVersions: (BrandVersion & { isCurrent: boolean })[] = [
    {
      version: brandGuidelines.version,
      timestamp: brandGuidelines.updatedAt,
      changes: ['Current version'],
      author: undefined,
      isCurrent: true,
    },
    ...[...versionHistory].reverse().map((v) => ({ ...v, isCurrent: false })),
  ];

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold">Version History</h3>
          <p className="text-sm text-muted-foreground">
            Track changes to your brand guidelines over time
          </p>
        </div>

        {/* Version Timeline */}
        {allVersions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border rounded-lg border-dashed">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No version history yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {allVersions.map((versionEntry, index) => (
              <Card key={versionEntry.version} className="relative">
                {/* Timeline connector */}
                {index < allVersions.length - 1 && (
                  <div className="absolute left-6 bottom-0 w-px h-full bg-border" />
                )}

                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {/* Version indicator */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">
                          v{versionEntry.version}
                        </span>
                      </div>

                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          Version {versionEntry.version}
                          {versionEntry.isCurrent && (
                            <Badge variant="default">Current</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-4 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(versionEntry.timestamp).toLocaleString()}
                          </span>
                          {versionEntry.author && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {versionEntry.author}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>

                    {/* Restore button */}
                    {!versionEntry.isCurrent && (
                      <Button
                        onClick={() => handleRestore(versionEntry.version)}
                        size="sm"
                        variant="outline"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restore
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Changes</h4>
                    <ul className="space-y-1">
                      {versionEntry.changes.map((change, changeIndex) => (
                        <li key={changeIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info box */}
        <Card className="mt-6 bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base">About Version History</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="space-y-2">
              <li>• Version history is automatically created when you make significant changes to brand guidelines</li>
              <li>• Restoring a previous version creates a new version based on that state</li>
              <li>• Current version cannot be deleted</li>
              <li>• All versions are stored locally in your browser</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
