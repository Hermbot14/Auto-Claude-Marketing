/**
 * StreamingContent Component
 *
 * Displays AI responses as they stream in real-time.
 * Features:
 * - Progressive rendering with typewriter effect
 * - Markdown rendering for code blocks
 * - Tool execution indicators
 * - Cancel button for stopping long generations
 * - Latency metrics display
 *
 * @module components/StreamingContent
 */

import { useEffect, useRef } from 'react';
import { Loader2, X, Square } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import { useTranslation } from 'react-i18next';

// ============================================================================
// Types
// ============================================================================

export interface StreamingContentProps {
  /** URL to stream from (relative to API base) */
  url: string;
  /** Request body to send */
  body?: Record<string, unknown>;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Initial content (placeholder while streaming) */
  placeholder?: string;
  /** Show cancel button */
  showCancel?: boolean;
  /** Show latency metrics */
  showMetrics?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when stream completes */
  onComplete?: (result: { text: string; tools: string[] }) => void;
  /** Callback when stream errors */
  onError?: (error: { message: string; code: string }) => void;
  /** Callback when user cancels */
  onCancel?: () => void;
}

// ============================================================================
// Latency Tracker Component
// ============================================================================

interface LatencyMetricsProps {
  reduction: number; // 0-100
  firstChunkTime?: number;
}

function LatencyMetrics({ reduction, firstChunkTime }: LatencyMetricsProps) {
  const { t } = useTranslation(['common']);

  if (reduction <= 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <span>
          {t('common:streaming.latencyReduction', 'Latency reduced by')}
          <strong>{reduction.toFixed(0)}%</strong>
        </span>
      </div>
      {firstChunkTime && (
        <span className="text-muted-foreground">
          {t('common:streaming.firstChunk', 'First chunk')}{' '}
          {firstChunkTime}ms
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Tool Execution Indicator Component
// ============================================================================

interface ToolIndicatorProps {
  toolName: string;
  status: 'running' | 'success' | 'error';
  error?: string;
}

function ToolIndicator({ toolName, status, error }: ToolIndicatorProps) {
  const { t } = useTranslation(['common']);

  const statusColors = {
    running: 'bg-blue-500 animate-pulse',
    success: 'bg-green-500',
    error: 'bg-red-500',
  };

  return (
    <div className="flex items-center gap-2 text-xs py-1">
      <div className={cn('h-2 w-2 rounded-full', statusColors[status])} />
      <span className="font-mono text-muted-foreground">{toolName}</span>
      {status === 'running' && (
        <span className="text-muted-foreground">
          {t('common:streaming.running', 'running...')}
        </span>
      )}
      {status === 'error' && error && (
        <span className="text-destructive">{error}</span>
      )}
    </div>
  );
}

// ============================================================================
// Main Streaming Content Component
// ============================================================================

export function StreamingContent({
  url,
  body,
  headers,
  placeholder,
  showCancel = true,
  showMetrics = true,
  className,
  onComplete,
  onError,
  onCancel,
}: StreamingContentProps) {
  const { t } = useTranslation(['common']);

  // Use streaming hook
  const {
    state,
    startStreaming,
    cancelStreaming,
    reset,
  } = useStreamingResponse();

  // Track timing for latency calculation
  const startTimeRef = useRef<number>(0);
  const firstChunkTimeRef = useRef<number>(0);

  // Handle stream completion
  useEffect(() => {
    if (state.isComplete && !state.error) {
      onComplete?.({
        text: state.content,
        tools: state.tools_used.map(t => t.name)
      });
    }
  }, [state.isComplete, state.error, state.content, state.tools_used, onComplete, t]);

  // Handle stream errors
  useEffect(() => {
    if (state.error) {
      onError?.({
        message: state.error,
        code: 'STREAM_ERROR'
      });
    }
  }, [state.error, onError]);

  // Calculate latency reduction
  const latencyReduction = (() => {
    if (!firstChunkTimeRef.current || !startTimeRef.current) {
      return 0;
    }
    // Baseline: assume 5 seconds for non-streaming
    const baselineTime = 5000;
    const firstChunkTime = firstChunkTimeRef.current - startTimeRef.current;

    return ((baselineTime - firstChunkTime) / baselineTime) * 100;
  })();

  // Render markdown content (basic, could use react-markdown)
  const renderContent = (content: string) => {
    // Simple markdown-like rendering
    const lines = content.split('\n');
    return lines.map((line, i) => {
      // Code blocks
      if (line.trim().startsWith('```')) {
        const lang = line.replace(/```(\w*)/, '$1').trim();
        return (
          <div key={i} className="my-1">
            <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
              <code>{lang}</code>
            </pre>
          </div>
        );
      }

      // Headers
      if (line.startsWith('#')) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const Tag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
        const text = line.replace(/^#+\s*/, '');
        return (
          <Tag key={i} className={`font-bold mt-${level > 1 ? '2' : '0'} mb-1`}>
            {text}
          </Tag>
        );
      }

      // Lists
      if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
        return (
          <li key={i} className="ml-4">
            {line.replace(/^[\s*-*]\s*/, '')}
          </li>
        );
      }

      // Regular text
      return (
        <p key={i} className="my-0 leading-relaxed">
          {line || '\u00A0'} {/* Non-breaking space for empty lines */}
        </p>
      );
    });
  };

  // Handle cancel button click
  const handleCancel = () => {
    cancelStreaming();
    onCancel?.();
  };

  // Start streaming on mount
  useEffect(() => {
    startTimeRef.current = Date.now();
    startStreaming({
      url,
      body,
      headers,
      onProgress: (content) => {
        if (!firstChunkTimeRef.current) {
          firstChunkTimeRef.current = Date.now();
        }
      },
    });
  }, [url, body, headers, startStreaming]);

  return (
    <div className={cn('relative', className)}>
      {/* Cancel button */}
      {showCancel && state.isStreaming && !state.isComplete && (
        <button
          onClick={handleCancel}
          className={cn(
            'absolute right-4 top-4 z-10',
            'rounded-full p-2 bg-muted hover:bg-muted-foreground/10',
            'transition-colors'
          )}
          aria-label={t('common:streaming.cancel', 'Cancel streaming')}
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Loading indicator */}
      {state.isStreaming && !state.content && (
        <div className="flex items-center gap-3 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {t('common:streaming.connecting', 'Connecting...')}
          </span>
        </div>
      )}

      {/* Streamed content */}
      {(state.content || state.isComplete) && (
        <div className="prose prose-sm max-w-none">
          {renderContent(state.content)}

          {/* Tool execution indicators */}
          {state.tools_used.length > 0 && (
            <div className="mt-4 space-y-1 border-t border-border pt-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t('common:streaming.toolsUsed', 'Tools Used')}
              </div>
              {state.tools_used.map((tool, i) => (
                <ToolIndicator
                  key={i}
                  toolName={tool.name}
                  status={
                    state.currentTool === tool.name
                      ? 'running'
                      : state.toolResults.find(r => r.name === tool.name)?.success
                      ? 'success'
                      : 'error'
                  }
                  error={state.toolResults.find(r => r.name === tool.name)?.error}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Metrics */}
      {showMetrics && state.isStreaming && latencyReduction > 0 && (
        <div className="mt-4">
          <LatencyMetrics
            reduction={latencyReduction}
            firstChunkTime={firstChunkTimeRef.current - startTimeRef.current}
          />
        </div>
      )}

      {/* Error display */}
      {state.error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <Square className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-destructive mb-1">
                {t('common:streaming.errorTitle', 'Streaming Error')}
              </h3>
              <p className="text-sm text-destructive/90">{state.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder */}
      {!state.content && !state.isStreaming && !state.error && placeholder && (
        <div className="text-muted-foreground text-sm italic">
          {placeholder}
        </div>
      )}
    </div>
  );
}

export default StreamingContent;
