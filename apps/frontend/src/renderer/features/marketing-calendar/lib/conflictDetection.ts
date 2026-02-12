/**
 * Conflict Detection Engine
 * Smart conflict detection and resolution for marketing calendar
 *
 * Provides rule-based conflict detection with pluggable resolution strategies
 */

import type {
  MarketingCalendarItem,
  ScheduleConflict,
  ConflictResolution,
  ConflictType,
  ConflictSeverity,
  ResolutionStrategy,
} from '../../../../shared/types/marketing-calendar';
import {
  isSameDay,
  isWithinInterval,
  startOfDay,
  endOfDay,
  addDays,
  differenceInDays,
} from 'date-fns';

// ============================================
// Configuration
// ============================================

export interface ConflictDetectionConfig {
  maxPostsPerPlatformPerDay: number;
  enableTimeOverlapDetection: boolean;
  enablePlatformOverloadDetection: boolean;
  enableResourceConflictDetection: boolean;
  enableDeadlineViolationDetection: boolean;
  autoResolveThreshold: number; // Days to look ahead for auto-resolve
}

export const DEFAULT_CONFLICT_CONFIG: ConflictDetectionConfig = {
  maxPostsPerPlatformPerDay: 3,
  enableTimeOverlapDetection: true,
  enablePlatformOverloadDetection: true,
  enableResourceConflictDetection: true,
  enableDeadlineViolationDetection: true,
  autoResolveThreshold: 7,
};

// ============================================
// Conflict Rule Interface
// ============================================

export interface ConflictRule {
  type: ConflictType;
  severity: ConflictSeverity;
  check: (item: MarketingCalendarItem, existingItems: MarketingCalendarItem[], config: ConflictDetectionConfig) => ScheduleConflict | null;
  resolve?: (conflict: ScheduleConflict, config: ConflictDetectionConfig) => ConflictResolution | null;
}

// ============================================
// Built-in Conflict Rules
// ============================================

/**
 * Time Overlap Rule
 * Detects when events are scheduled at the same time
 */
export const timeOverlapRule: ConflictRule = {
  type: 'time-overlap',
  severity: 'warning',

  check: (item, existingItems, config) => {
    if (!config.enableTimeOverlapDetection || !item.startDate) {
      return null;
    }

    const itemStart = startOfDay(item.startDate);
    const itemEnd = endOfDay(item.endDate || item.startDate);

    const conflictingItems = existingItems.filter((other) => {
      if (other.id === item.id) return false;

      const otherStart = startOfDay(other.startDate);
      const otherEnd = endOfDay(other.endDate || other.startDate);

      // Check for time overlap
      return itemStart < otherEnd && itemEnd > otherStart;
    });

    if (conflictingItems.length === 0) {
      return null;
    }

    return {
      id: `time-overlap-${item.id}-${Date.now()}`,
      type: 'time-overlap',
      severity: conflictingItems.length > 2 ? 'critical' : 'warning',
      message: `${conflictingItems.length} event(s) overlap with this time`,
      conflictingItems,
    };
  },

  resolve: (conflict, config) => {
    const { conflictingItems } = conflict;
    if (conflictingItems.length === 0) return null;

    // Sort items by priority to determine order
    const sortedItems = [...conflictingItems].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.priority || 'medium'];
      const bPriority = priorityOrder[b.priority || 'medium'];
      return aPriority - bPriority;
    });

    // Strategy: Move lower priority items to next available slots
    const rescheduledItems: Array<{ itemId: string; newDate: Date }> = [];
    let currentDate = startOfDay(new Date(sortedItems[0].startDate));

    for (const item of sortedItems) {
      // Find next available slot
      let checkDate = addDays(currentDate, 1);
      let hasConflict = true;
      let attempts = 0;

      while (hasConflict && attempts < config.autoResolveThreshold) {
        hasConflict = conflictingItems.some((other) => {
          if (other.id === item.id) return false;
          return isSameDay(checkDate, other.startDate);
        });

        if (!hasConflict) {
          currentDate = checkDate;
        }

        checkDate = addDays(checkDate, 1);
        attempts++;
      }

      rescheduledItems.push({
        itemId: item.id,
        newDate: currentDate,
      });
    }

    return {
      strategy: 'auto-resolve',
      rescheduledItems,
      cancelledItems: [],
    };
  },
};

/**
 * Platform Overload Rule
 * Detects when too many posts are scheduled for the same platform on the same day
 */
export const platformOverloadRule: ConflictRule = {
  type: 'platform-overload',
  severity: 'warning',

  check: (item, existingItems, config) => {
    if (!config.enablePlatformOverloadDetection || !item.platforms || item.platforms.length === 0) {
      return null;
    }

    const conflicts: ScheduleConflict[] = [];

    for (const platform of item.platforms) {
      const platformItems = existingItems.filter((other) =>
        other.platforms?.includes(platform) &&
        other.id !== item.id &&
        isSameDay(other.startDate, item.startDate)
      );

      if (platformItems.length >= config.maxPostsPerPlatformPerDay) {
        conflicts.push({
          id: `platform-overload-${platform}-${item.id}-${Date.now()}`,
          type: 'platform-overload',
          severity: platformItems.length > config.maxPostsPerPlatformPerDay ? 'error' : 'warning',
          message: `Maximum ${config.maxPostsPerPlatformPerDay} posts per day reached for ${platform}`,
          conflictingItems: platformItems,
        });
      }
    }

    return conflicts.length > 0 ? conflicts[0] : null;
  },

  resolve: (conflict, config) => {
    const { conflictingItems, type } = conflict;

    if (type !== 'platform-overload') return null;

    // Group by platform
    const platformGroups = new Map<string, MarketingCalendarItem[]>();
    for (const item of conflictingItems) {
      for (const platform of item.platforms || []) {
        if (!platformGroups.has(platform)) {
          platformGroups.set(platform, []);
        }
        platformGroups.get(platform)!.push(item);
      }
    }

    // Strategy: Redistribute items across available days
    const rescheduledItems: Array<{ itemId: string; newDate: Date }> = [];

    for (const [platform, items] of platformGroups.entries()) {
      const baseDate = startOfDay(new Date(items[0].startDate));
      const daysNeeded = Math.ceil(items.length / config.maxPostsPerPlatformPerDay);

      for (let i = 0; i < items.length; i++) {
        const dayOffset = Math.floor(i / config.maxPostsPerPlatformPerDay);
        const newDate = addDays(baseDate, dayOffset);

        rescheduledItems.push({
          itemId: items[i].id,
          newDate,
        });
      }
    }

    return {
      strategy: 'auto-resolve',
      rescheduledItems,
      cancelledItems: [],
    };
  },
};

/**
 * Resource Conflict Rule
 * Detects when the same assignee has overlapping events
 */
export const resourceConflictRule: ConflictRule = {
  type: 'resource-conflict',
  severity: 'warning',

  check: (item, existingItems, config) => {
    if (!config.enableResourceConflictDetection || !item.assignee) {
      return null;
    }

    const conflictingItems = existingItems.filter((other) =>
      other.assignee === item.assignee &&
      other.id !== item.id &&
      isSameDay(other.startDate, item.startDate)
    );

    if (conflictingItems.length === 0) {
      return null;
    }

    return {
      id: `resource-conflict-${item.assignee}-${item.id}-${Date.now()}`,
      type: 'resource-conflict',
      severity: 'warning',
      message: `${item.assignee} has ${conflictingItems.length} overlapping event(s)`,
      conflictingItems,
    };
  },

  resolve: (conflict) => {
    const { conflictingItems } = conflict;

    // Strategy: Split overlapping time into sequential slots
    const baseDate = startOfDay(new Date(conflictingItems[0].startDate));
    const slotDuration = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
    const rescheduledItems: Array<{ itemId: string; newDate: Date }> = [];

    for (let i = 0; i < conflictingItems.length; i++) {
      const slotStart = new Date(baseDate.getTime() + (i * slotDuration));
      rescheduledItems.push({
        itemId: conflictingItems[i].id,
        newDate: slotStart,
      });
    }

    return {
      strategy: 'split-interval',
      rescheduledItems,
      cancelledItems: [],
    };
  },
};

/**
 * Deadline Violation Rule
 * Detects when content is scheduled after its deadline
 */
export const deadlineViolationRule: ConflictRule = {
  type: 'deadline-violation',
  severity: 'error',

  check: (item, existingItems, config) => {
    if (!config.enableDeadlineViolationDetection || !item.dueDate) {
      return null;
    }

    const scheduledDate = item.startDate || item.scheduledDate;
    if (!scheduledDate) return null;

    if (scheduledDate <= item.dueDate) {
      return null;
    }

    const daysLate = differenceInDays(scheduledDate, item.dueDate);

    return {
      id: `deadline-violation-${item.id}-${Date.now()}`,
      type: 'deadline-violation',
      severity: daysLate > 7 ? 'critical' : 'error',
      message: `Content scheduled ${daysLate} day(s) after deadline`,
      conflictingItems: [item],
    };
  },

  resolve: (conflict) => {
    const { conflictingItems } = conflict;

    if (conflictingItems.length === 0) return null;

    const item = conflictingItems[0];

    // Strategy: Move scheduled date to deadline (or before)
    const targetDate = item.dueDate || item.startDate;

    return {
      strategy: 'auto-resolve',
      rescheduledItems: [{
        itemId: item.id,
        newDate: targetDate,
      }],
      cancelledItems: [],
    };
  },
};

// ============================================
// Conflict Detection Engine
// ============================================

export class ConflictDetectionEngine {
  private rules: ConflictRule[] = [];
  private config: ConflictDetectionConfig;

  constructor(
    config: Partial<ConflictDetectionConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFLICT_CONFIG, ...config };
    this.rules = [
      timeOverlapRule,
      platformOverloadRule,
      resourceConflictRule,
      deadlineViolationRule,
    ];
  }

  /**
   * Add a custom conflict rule
   */
  addRule(rule: ConflictRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a rule by type
   */
  removeRule(type: ConflictType): void {
    this.rules = this.rules.filter((r) => r.type !== type);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ConflictDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check for conflicts for a single item
   */
  checkConflicts(
    item: MarketingCalendarItem,
    existingItems: MarketingCalendarItem[]
  ): ScheduleConflict[] {
    const conflicts: ScheduleConflict[] = [];

    for (const rule of this.rules) {
      const conflict = rule.check(item, existingItems, this.config);
      if (conflict) {
        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * Check for conflicts across multiple items (batch check)
   */
  checkBatchConflicts(items: MarketingCalendarItem[]): Map<string, ScheduleConflict[]> {
    const conflictMap = new Map<string, ScheduleConflict[]>();

    for (const item of items) {
      const conflicts = this.checkConflicts(item, items);
      if (conflicts.length > 0) {
        conflictMap.set(item.id, conflicts);
      }
    }

    return conflictMap;
  }

  /**
   * Resolve a conflict using the appropriate strategy
   */
  resolveConflict(conflict: ScheduleConflict): ConflictResolution | null {
    const rule = this.rules.find((r) => r.type === conflict.type);

    if (!rule || !rule.resolve) {
      return null;
    }

    return rule.resolve(conflict, this.config);
  }

  /**
   * Get suggested resolution for a conflict
   */
  getSuggestedResolution(
    conflict: ScheduleConflict,
    strategy: ResolutionStrategy
  ): ConflictResolution {
    switch (strategy) {
      case 'auto-resolve':
        return this.resolveConflict(conflict) || {
          strategy: 'auto-resolve',
          rescheduledItems: [],
          cancelledItems: [],
        };

      case 'manual-resolve':
        return {
          strategy: 'manual-resolve',
          rescheduledItems: [],
          cancelledItems: [],
        };

      case 'cancel-conflicting':
        return {
          strategy: 'cancel-conflicting',
          rescheduledItems: [],
          cancelledItems: conflict.conflictingItems.map((i) => i.id),
        };

      case 'split-interval':
        return this.resolveConflict(conflict) || {
          strategy: 'split-interval',
          rescheduledItems: [],
          cancelledItems: [],
        };

      default:
        return {
          strategy: 'auto-resolve',
          rescheduledItems: [],
          cancelledItems: [],
        };
    }
  }

  /**
   * Get all active rules
   */
  getActiveRules(): ConflictRule[] {
    return [...this.rules];
  }

  /**
   * Get current configuration
   */
  getConfig(): ConflictDetectionConfig {
    return { ...this.config };
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check if two date ranges overlap
 */
export function doRangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && end1 > start2;
}

/**
 * Get the next available slot for scheduling
 */
export function getNextAvailableSlot(
  startDate: Date,
  existingItems: MarketingCalendarItem[],
  duration?: number,
  config: Partial<ConflictDetectionConfig> = {}
): Date {
  const engine = new ConflictDetectionEngine(config);
  const checkDate = new Date(startDate);
  let attempts = 0;
  const maxAttempts = config.autoResolveThreshold || DEFAULT_CONFLICT_CONFIG.autoResolveThreshold;

  while (attempts < maxAttempts) {
    // Check if this slot has any conflicts
    const conflicts = engine.checkConflicts(
      {
        id: 'temp-check',
        title: 'temp',
        startDate: checkDate,
        endDate: duration ? addDays(checkDate, duration) : undefined,
        status: 'draft',
        type: 'content',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      existingItems
    );

    if (conflicts.length === 0) {
      return checkDate;
    }

    // Move to next day and try again
    checkDate.setDate(checkDate.getDate() + 1);
    attempts++;
  }

  // Return original date if no slot found (let user decide)
  return startDate;
}

/**
 * Calculate conflict severity score
 * Higher score = more severe conflicts
 */
export function calculateConflictScore(conflicts: ScheduleConflict[]): number {
  const severityWeights = {
    warning: 1,
    error: 5,
    critical: 10,
  };

  return conflicts.reduce((score, conflict) => {
    return score + severityWeights[conflict.severity] * conflict.conflictingItems.length;
  }, 0);
}

// ============================================
// Export singleton instance
// ============================================

export const conflictDetectionEngine = new ConflictDetectionEngine();
