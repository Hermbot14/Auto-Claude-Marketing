/**
 * Data Processing Worker
 *
 * Handles data transformations, filtering, sorting, and batch operations
 * off the main thread to maintain UI responsiveness during heavy processing.
 */

import type {
  WorkerMessage,
  WorkerResponse,
  WorkerProgress,
  FilterRequest,
  SortRequest,
  TransformRequest,
  BatchRequest,
  ExportRequest,
  DataProcessResult
} from './types';

// ============================================
// Utility Functions
// ============================================

/**
 * Send progress update for batch operations
 */
function reportProgress(
  id: string,
  progress: number,
  message?: string
): void {
  self.postMessage({
    id,
    type: 'progress',
    progress,
    message
  });
}

/**
 * Safely access nested property
 */
function getValue<T extends Record<string, unknown>>(
  obj: T,
  field: keyof T | string
): unknown {
  if (typeof field === 'string' && field.includes('.')) {
    // Handle nested properties like 'user.name'
    const parts = field.split('.');
    let value: unknown = obj;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return value;
  }
  return obj[field as keyof T];
}

/**
 * Case-insensitive string comparison
 */
function stringCompare(a: unknown, b: unknown): number {
  const aStr = String(a ?? '').toLowerCase();
  const bStr = String(b ?? '').toLowerCase();
  return aStr.localeCompare(bStr);
}

/**
 * Check if value matches filter condition
 */
function matchesFilter(item: Record<string, unknown>, filter: FilterRequest['filters'][0]): boolean {
  const value = getValue(item, filter.field);

  switch (filter.operator) {
    case 'eq':
      return value === filter.value;

    case 'ne':
      return value !== filter.value;

    case 'gt':
      return typeof value === 'number' && typeof filter.value === 'number' && value > filter.value;

    case 'gte':
      return typeof value === 'number' && typeof filter.value === 'number' && value >= filter.value;

    case 'lt':
      return typeof value === 'number' && typeof filter.value === 'number' && value < filter.value;

    case 'lte':
      return typeof value === 'number' && typeof filter.value === 'number' && value <= filter.value;

    case 'contains':
      return typeof value === 'string' &&
        typeof filter.value === 'string' &&
        value.toLowerCase().includes(filter.value.toLowerCase());

    case 'startsWith':
      return typeof value === 'string' &&
        typeof filter.value === 'string' &&
        value.toLowerCase().startsWith(filter.value.toLowerCase());

    default:
      return false;
  }
}

/**
 * Check if item matches search query
 */
function matchesSearch<T extends Record<string, unknown>>(
  item: T,
  query: string,
  searchFields?: Array<keyof T | string>
): boolean {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();

  if (searchFields && searchFields.length > 0) {
    return searchFields.some((field) => {
      const value = getValue(item, field);
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(lowerQuery);
    });
  }

  // Search all string properties
  return Object.values(item).some(
    (value) =>
      typeof value === 'string' && value.toLowerCase().includes(lowerQuery)
  );
}

// ============================================
// Filter Operations
// ============================================

/**
 * Filter items based on criteria
 */
function filterItems<T extends Record<string, unknown>>(
  request: FilterRequest<T>
): DataProcessResult<T> {
  const startTime = performance.now();
  const { items, filters, searchQuery, searchFields } = request;

  let filtered = [...items];

  // Apply filters
  if (filters && filters.length > 0) {
    filtered = filtered.filter((item) =>
      filters.every((filter) => matchesFilter(item, filter))
    );
  }

  // Apply search query
  if (searchQuery) {
    filtered = filtered.filter((item) =>
      matchesSearch(item, searchQuery, searchFields)
    );
  }

  const duration = performance.now() - startTime;

  return {
    items: filtered,
    totalProcessed: items.length,
    filtered: items.length - filtered.length,
    duration
  };
}

// ============================================
// Sort Operations
// ============================================

/**
 * Sort items based on field and order
 */
function sortItems<T extends Record<string, unknown>>(request: SortRequest<T>): DataProcessResult<T> {
  const startTime = performance.now();
  const { items, sortBy, order, customComparator } = request;

  const sorted = [...items];

  if (customComparator) {
    sorted.sort(customComparator);
  } else {
    sorted.sort((a, b) => {
      const aVal = getValue(a, sortBy);
      const bVal = getValue(b, sortBy);

      // Handle null/undefined
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return order === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Date comparison
      if (aVal instanceof Date && bVal instanceof Date) {
        const diff = aVal.getTime() - bVal.getTime();
        return order === 'asc' ? diff : -diff;
      }

      // String comparison (case-insensitive)
      const comparison = stringCompare(aVal, bVal);
      return order === 'asc' ? comparison : -comparison;
    });
  }

  const duration = performance.now() - startTime;

  return {
    items: sorted,
    totalProcessed: items.length,
    duration
  };
}

// ============================================
// Transform Operations
// ============================================

/**
 * Transform items using a mapping function
 */
function transformItems<T, R>(request: TransformRequest<T, R>): DataProcessResult<R> {
  const startTime = performance.now();
  const { items, transform, batchSize = 100 } = request;
  const total = items.length;

  // Process in batches to allow progress reporting
  const results: R[] = [];

  for (let i = 0; i < items.length; i++) {
    if (i > 0 && i % batchSize === 0) {
      reportProgress(
        'transform',
        Math.round((i / total) * 100),
        `Processed ${i}/${total} items`
      );
    }

    try {
      results.push(transform(items[i]));
    } catch (error) {
      console.error('Error transforming item at index', i, error);
      // Push undefined for failed items to maintain array length
      results.push(undefined as unknown as R);
    }
  }

  reportProgress('transform', 100, 'Transform complete');

  const duration = performance.now() - startTime;

  return {
    items: results,
    totalProcessed: total,
    transformed: results.filter((r) => r !== undefined).length,
    duration
  };
}

// ============================================
// Batch Operations
// ============================================

/**
 * Execute operation on each item in batch
 */
function processBatch<T, R>(request: BatchRequest<T, R>): DataProcessResult<R> {
  const startTime = performance.now();
  const { items, operation, operationName } = request;
  const total = items.length;
  const results: R[] = [];
  const errors: Array<{ index: number; error: unknown }> = [];

  for (let i = 0; i < items.length; i++) {
    if (i > 0 && i % 50 === 0) {
      reportProgress(
        operationName,
        Math.round((i / total) * 100),
        `${operationName}: ${i}/${total}`
      );
    }

    try {
      results.push(operation(items[i]));
    } catch (error) {
      errors.push({ index: i, error });
      // Push undefined for failed items
      results.push(undefined as unknown as R);
    }
  }

  reportProgress(operationName, 100, `${operationName} complete`);

  const duration = performance.now() - startTime;

  return {
    items: results,
    totalProcessed: total,
    duration
  };
}

// ============================================
// Export/Import Operations
// ============================================

/**
 * Export items to specified format
 */
function exportData<T extends Record<string, unknown>>(request: ExportRequest<T>): string {
  const startTime = performance.now();
  const { items, format, fields } = request;

  let result = '';

  switch (format) {
    case 'json':
      const data = fields && fields.length > 0
        ? items.map((item) => {
            const filtered: Record<string, unknown> = {};
            fields.forEach((field) => {
              filtered[String(field)] = getValue(item, field);
            });
            return filtered;
          })
        : items;
      result = JSON.stringify(data, null, 2);
      break;

    case 'csv':
      const headers = fields && fields.length > 0
        ? fields.map(String).join(',')
        : Object.keys(items[0] || {}).join(',');

      const rows = items.map((item) => {
        if (fields && fields.length > 0) {
          return fields
            .map((field) => {
              const value = getValue(item, field);
              return escapeCSVValue(value);
            })
            .join(',');
        }
        return Object.values(item)
          .map((v) => escapeCSVValue(v))
          .join(',');
      });

      result = [headers, ...rows].join('\n');
      break;

    case 'markdown':
      result = items
        .map((item, index) => {
          let md = `## Item ${index + 1}\n\n`;

          if (fields && fields.length > 0) {
            fields.forEach((field) => {
              const value = getValue(item, field);
              md += `**${String(field)}**: ${value !== undefined && value !== null ? String(value) : 'N/A'}\n\n`;
            });
          } else {
            Object.entries(item).forEach(([key, value]) => {
              md += `**${key}**: ${value !== undefined && value !== null ? String(value) : 'N/A'}\n\n`;
            });
          }

          return md;
        })
        .join('\n---\n\n');
      break;
  }

  const duration = performance.now() - startTime;

  // Report completion with metadata
  reportProgress(
    'export',
    100,
    `Exported ${items.length} items in ${duration.toFixed(2)}ms`
  );

  return result;
}

/**
 * Escape CSV value
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ============================================
// Message Handler
// ============================================

/**
 * Main message handler for data processing worker
 */
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const { id, type, data } = event.data;

  try {
    let result: unknown;

    switch (type) {
      case 'filter':
        result = filterItems(data as FilterRequest);
        break;

      case 'sort':
        result = sortItems(data as SortRequest);
        break;

      case 'transform':
        result = transformItems(data as TransformRequest<unknown, unknown>);
        break;

      case 'batch':
        result = processBatch(data as BatchRequest<unknown, unknown>);
        break;

      case 'export':
        result = exportData(data as ExportRequest<Record<string, unknown>>);
        break;

      default:
        throw new Error(`Unknown operation type: ${type}`);
    }

    const response: WorkerResponse = {
      id,
      type,
      data: result
    };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id,
      type,
      error: error instanceof Error ? error.message : String(error)
    };
    self.postMessage(response);
  }
});

// Export for testing
if (typeof window !== 'undefined') {
  (window as unknown as { worker: unknown }).worker = self;
}

export {};
