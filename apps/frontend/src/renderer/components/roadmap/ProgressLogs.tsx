import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe,
  FileText,
  Terminal,
  Code,
  Database,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  Info,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import type { RoadmapProgressLog, RoadmapToolType, RoadmapLogSeverity } from '../../../shared/types';

// Re-export types for convenience
export type ProgressLog = RoadmapProgressLog;
export type ToolType = RoadmapToolType;
export type LogSeverity = RoadmapLogSeverity;

/**
 * Props for ProgressLogs component
 */
interface ProgressLogsProps {
  logs: ProgressLog[];
  className?: string;
}

/**
 * Tool icon mapping
 */
const TOOL_ICONS: Record<RoadmapToolType, React.ElementType> = {
  WebSearch: Globe,
  Bash: Terminal,
  Read: FileText,
  Write: FileText,
  Edit: Code,
  Grep: FileText,
  Glob: FileText,
  Database: Database,
  Git: GitBranch,
  Agent: CheckCircle2,
  Other: Info,
};

/**
 * Severity color mapping
 */
const SEVERITY_COLORS: Record<RoadmapLogSeverity, { bg: string; text: string; icon: React.ElementType }> = {
  info: { bg: 'bg-info/10', text: 'text-info', icon: Info },
  success: { bg: 'bg-success/10', text: 'text-success', icon: CheckCircle2 },
  warning: { bg: 'bg-warning/10', text: 'text-warning', icon: AlertTriangle },
  error: { bg: 'bg-destructive/10', text: 'text-destructive', icon: AlertCircle },
};

/**
 * Phase display names
 */
const PHASE_NAMES: Record<ProgressLog['phase'], string> = {
  discovery: 'Discovery',
  research: 'Research',
  analysis: 'Analysis',
  generation: 'Generation',
  finalization: 'Finalization',
};

/**
 * ProgressLogs Component
 *
 * Displays real-time logs with tool usage indicators, timestamps, and severity levels.
 * Features collapsible panel, auto-scroll, copy-to-clipboard, and smooth animations.
 */
export function ProgressLogs({ logs, className }: ProgressLogsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  /**
   * Auto-scroll to bottom when new logs arrive (if user hasn't scrolled up)
   */
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  /**
   * Track scroll position to detect if user manually scrolled up
   */
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    autoScrollRef.current = isNearBottom;
  };

  /**
   * Copy log message to clipboard
   */
  const handleCopyLog = async (log: ProgressLog) => {
    const text = `[${log.timestamp.toISOString()}] [${log.severity.toUpperCase()}] [${log.phase}] ${log.message}${log.details ? `\n${log.details}` : ''}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLogId(log.id);
      setTimeout(() => setCopiedLogId(null), 2000);
    } catch (err) {
      console.error('Failed to copy log:', err);
    }
  };

  /**
   * Get filtered logs based on severity
   */
  const getFilteredLogs = () => {
    return logs.filter(log => log.severity !== 'info' || log.tool);
  };

  /**
   * Group logs by phase for better organization
   */
  const groupLogsByPhase = (logsToGroup: ProgressLog[]) => {
    return logsToGroup.reduce((acc, log) => {
      if (!acc[log.phase]) {
        acc[log.phase] = [];
      }
      acc[log.phase].push(log);
      return acc;
    }, {} as Record<string, ProgressLog[]>);
  };

  const filteredLogs = getFilteredLogs();
  const groupedLogs = groupLogsByPhase(filteredLogs);

  if (logs.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('border rounded-lg bg-card overflow-hidden', className)}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Activity Log</h3>
          <span className="text-xs text-muted-foreground">({filteredLogs.length} entries)</span>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </div>

      {/* Logs Container */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="px-4 py-2 max-h-64 overflow-y-auto space-y-1"
            >
              {Object.entries(groupedLogs).map(([phase, phaseLogs]) => (
                <div key={phase} className="space-y-1">
                  {/* Phase Header */}
                  <div className="sticky top-0 bg-background/95 backdrop-blur-sm py-1 border-b border-border/50">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      {PHASE_NAMES[phase as ProgressLog['phase']]}
                    </span>
                  </div>

                  {/* Phase Logs */}
                  {phaseLogs.map((log, index) => {
                    const ToolIcon = log.tool ? TOOL_ICONS[log.tool] : null;
                    const SeverityIcon = SEVERITY_COLORS[log.severity].icon;
                    const severityColor = SEVERITY_COLORS[log.severity];

                    return (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15, delay: index * 0.02 }}
                        className={cn(
                          'group flex items-start gap-2 p-2 rounded text-xs hover:bg-muted/50 transition-colors cursor-pointer',
                          severityColor.bg
                        )}
                        onClick={() => handleCopyLog(log)}
                      >
                        {/* Severity Icon */}
                        <SeverityIcon className={cn('h-3 w-3 flex-shrink-0 mt-0.5', severityColor.text)} />

                        {/* Tool Icon */}
                        {ToolIcon && (
                          <ToolIcon className="h-3 w-3 flex-shrink-0 mt-0.5 text-muted-foreground" />
                        )}

                        {/* Timestamp */}
                        <span className="text-muted-foreground flex-shrink-0">
                          {format(log.timestamp, 'HH:mm:ss')}
                        </span>

                        {/* Message */}
                        <span className={cn('flex-1', severityColor.text)}>
                          {log.message}
                        </span>

                        {/* Copy indicator */}
                        {copiedLogId === log.id && (
                          <Check className="h-3 w-3 text-success flex-shrink-0" />
                        )}
                        {copiedLogId !== log.id && (
                          <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                        )}

                        {/* Details (expandable on hover) */}
                        {log.details && (
                          <div className="hidden group-hover:block absolute left-8 top-full mt-1 z-10 p-2 bg-popover border rounded shadow-lg max-w-xs">
                            <p className="text-xs">{log.details}</p>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ))}

              {/* Empty state */}
              {filteredLogs.length === 0 && (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  No activity logs yet
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
