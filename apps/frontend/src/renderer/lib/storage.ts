/**
 * Distributed Content Storage Client
 * =================================
 *
 * Frontend client for distributed content storage operations.
 *
 * Features:
 * - File upload/download
 * - Tier management
 * - CDN integration
 * - Presigned URL generation
 * - Bulk operations
 * - Cost tracking
 */

// ============================================================================
// Type Definitions
// ============================================================================

export enum StorageTier {
  HOT = 'hot',     // Immediate access, S3 Standard
  WARM = 'warm',   // Infrequent access, S3 IA
  COLD = 'cold',   // Archive, Glacier
}

export enum ContentType {
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  ARCHIVE = 'archive',
  OTHER = 'other',
}

export interface StorageMetadata {
  key: string;
  content_type: ContentType;
  original_filename: string;
  content_type_header: string;
  size_bytes: number;
  checksum: string;
  tier: StorageTier;
  backend: string;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
  access_count: number;
  cdn_url?: string;
  expires_at?: string;
  custom_metadata?: Record<string, string>;
}

export interface StorageResponse {
  key: string;
  content_type: string;
  size_bytes: number;
  tier: string;
  checksum: string;
  created_at: string;
  updated_at: string;
  url?: string;
  cdn_url?: string;
}

export interface ListResponse {
  objects: StorageResponse[];
  count: number;
  prefix: string;
  truncated: boolean;
  next_token?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadOptions {
  tier?: StorageTier;
  metadata?: Record<string, string>;
  backup?: boolean;
  onProgress?: (progress: UploadProgress) => void;
}

export interface MultipartUploadResult {
  uploaded: number;
  failed: number;
  results: Array<{
    key: string;
    filename: string;
    size: number;
    url: string;
    success: boolean;
  }>;
  errors: Array<{
    filename: string;
    error: string;
  }>;
}

export interface MetricsResponse {
  backend: string;
  uploads_total: number;
  uploads_success: number;
  uploads_failed: number;
  downloads_total: number;
  downloads_success: number;
  downloads_failed: number;
  upload_success_rate: number;
  download_success_rate: number;
  bytes_uploaded: number;
  bytes_downloaded: number;
  total_storage_bytes: number;
  total_file_count: number;
}

export interface LifecycleReport {
  hot_to_warm: number;
  warm_to_cold: number;
  cold_to_delete: number;
  total_processed: number;
  estimated_savings: number;
  dry_run: boolean;
}

export interface CostAnalysis {
  current_monthly_cost: number;
  projected_monthly_cost: number;
  potential_savings: number;
  breakdown: Record<string, number>;
  recommendations: string[];
}

export interface PresignedURLOptions {
  expiration?: number; // seconds
  operation?: 'get' | 'put';
  useCdn?: boolean;
  signed?: boolean;
}

export interface BulkOperationResult {
  processed: number;
  successful: number;
  failed: number;
  results: Array<{
    key: string;
    operation?: string;
    destination?: string;
    success: boolean;
  }>;
  errors: Array<{
    key: string;
    error: string;
  }>;
}

// ============================================================================
// Storage Client Class
// ============================================================================

class StorageClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'StorageClientError';
    this.statusCode = statusCode;
    this.details = details;
  }

  statusCode?: number;
  details?: unknown;
}

export class StorageClient {
  private baseUrl: string;
  private abortController: AbortController | null = null;

  constructor(baseUrl: string = '/api/storage') {
    this.baseUrl = baseUrl;
  }

  // ============================================================================
  // File Upload
  // ============================================================================

  /**
   * Upload a file to storage
   */
  async uploadFile(
    file: File,
    key?: string,
    options: UploadOptions = {}
  ): Promise<StorageResponse> {
    const {
      tier = StorageTier.HOT,
      metadata = {},
      backup = true,
      onProgress,
    } = options;

    const storageKey = key || this.generateKey(file);
    const formData = new FormData();

    formData.append('file', file);
    formData.append('key', storageKey);
    formData.append('tier', tier);
    formData.append('backup', backup.toString());
    formData.append('metadata', JSON.stringify({
      ...metadata,
      original_filename: file.name,
    }));

    // Create abort controller for this request
    this.abortController = new AbortController();

    try {
      const response = await fetch(`${this.baseUrl}/upload`, {
        method: 'POST',
        body: formData,
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new StorageClientError(
          error.detail || 'Upload failed',
          response.status,
          error
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof StorageClientError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new StorageClientError('Upload cancelled');
      }
      throw new StorageClientError('Network error during upload');
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(
    files: File[],
    prefix: string = '',
    options: UploadOptions = {}
  ): Promise<MultipartUploadResult> {
    const { tier = StorageTier.HOT, backup = true } = options;

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('prefix', prefix);
    formData.append('tier', tier);
    formData.append('backup', backup.toString());

    const response = await fetch(`${this.baseUrl}/upload/multipart`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new StorageClientError(
        error.detail || 'Batch upload failed',
        response.status
      );
    }

    return await response.json();
  }

  /**
   * Upload with progress tracking (uses XHR for progress events)
   */
  uploadFileWithProgress(
    file: File,
    key?: string,
    options: UploadOptions = {}
  ): Promise<StorageResponse> {
    return new Promise((resolve, reject) => {
      const {
        tier = StorageTier.HOT,
        metadata = {},
        backup = true,
        onProgress,
      } = options;

      const xhr = new XMLHttpRequest();
      const storageKey = key || this.generateKey(file);

      // Track progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: (event.loaded / event.total) * 100,
          });
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve(result);
          } catch {
            reject(new StorageClientError('Invalid response format'));
          }
        } else {
          let errorDetail = 'Upload failed';
          try {
            const error = JSON.parse(xhr.responseText);
            errorDetail = error.detail || errorDetail;
          } catch {
            // Use default error message
          }
          reject(new StorageClientError(errorDetail, xhr.status));
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new StorageClientError('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new StorageClientError('Upload cancelled'));
      });

      // Prepare form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('key', storageKey);
      formData.append('tier', tier);
      formData.append('backup', backup.toString());
      formData.append('metadata', JSON.stringify({
        ...metadata,
        original_filename: file.name,
      }));

      // Send request
      xhr.open('POST', `${this.baseUrl}/upload`);
      xhr.send(formData);

      // Store abort handler
      this.abortController = {
        abort: () => xhr.abort(),
      } as AbortController;
    });
  }

  // ============================================================================
  // File Download
  // ============================================================================

  /**
   * Download a file from storage
   */
  async downloadFile(
    key: string,
    disposition: 'inline' | 'attachment' = 'attachment'
  ): Promise<Blob> {
    const params = new URLSearchParams({ disposition });
    const response = await fetch(`${this.baseUrl}/download/${key}?${params}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new StorageClientError(`File not found: ${key}`, 404);
      }
      throw new StorageClientError('Download failed', response.status);
    }

    return await response.blob();
  }

  /**
   * Download file and trigger browser save
   */
  async saveFile(
    key: string,
    filename?: string
  ): Promise<void> {
    const blob = await this.downloadFile(key, 'attachment');

    // Get filename from Content-Disposition if not provided
    let saveFilename = filename || key.split('/').pop() || 'download';

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = saveFilename;
    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Get file URL (direct or CDN)
   */
  async getFileUrl(key: string, useCdn = true): Promise<string> {
    const info = await this.getFileInfo(key);
    return info.cdn_url || info.url || '';
  }

  /**
   * Generate presigned URL for direct access
   */
  async generatePresignedUrl(
    key: string,
    options: PresignedURLOptions = {}
  ): Promise<{ url: string; key: string; expires_in: number; expires_at: string }> {
    const {
      expiration = 3600,
      operation = 'get',
      useCdn = true,
      signed = false,
    } = options;

    const response = await fetch(`${this.baseUrl}/url/presigned`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        expiration,
        operation,
        use_cdn: useCdn,
        signed,
      }),
    });

    if (!response.ok) {
      throw new StorageClientError('Failed to generate presigned URL');
    }

    return await response.json();
  }

  // ============================================================================
  // File Information
  // ============================================================================

  /**
   * Get metadata for a file
   */
  async getFileInfo(key: string): Promise<StorageResponse> {
    const response = await fetch(`${this.baseUrl}/info/${key}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new StorageClientError(`File not found: ${key}`, 404);
      }
      throw new StorageClientError('Failed to get file info');
    }

    return await response.json();
  }

  /**
   * List files in storage
   */
  async listFiles(
    prefix = '',
    limit = 100,
    startAfter?: string
  ): Promise<ListResponse> {
    const params = new URLSearchParams({
      prefix,
      limit: limit.toString(),
    });

    if (startAfter) {
      params.append('start_after', startAfter);
    }

    const response = await fetch(`${this.baseUrl}/list?${params}`);

    if (!response.ok) {
      throw new StorageClientError('Failed to list files');
    }

    return await response.json();
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  /**
   * Delete a file
   */
  async deleteFile(key: string, backup = true): Promise<{ key: string; deleted: boolean; backup: boolean }> {
    const params = new URLSearchParams({ backup: backup.toString() });
    const response = await fetch(`${this.baseUrl}/${key}?${params}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new StorageClientError(`File not found: ${key}`, 404);
      }
      throw new StorageClientError('Failed to delete file');
    }

    return await response.json();
  }

  /**
   * Change storage tier for files
   */
  async changeTier(keys: string[], tier: StorageTier): Promise<{
    processed: number;
    successful: number;
    failed: number;
    results: Array<{ key: string; old_tier: string; new_tier: string; success: boolean }>;
    errors: Array<{ key: string; error: string }>;
  }> {
    const response = await fetch(`${this.baseUrl}/tier`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, keys }),
    });

    if (!response.ok) {
      throw new StorageClientError('Failed to change tier');
    }

    return await response.json();
  }

  /**
   * Copy a file
   */
  async copyObject(sourceKey: string, destKey: string): Promise<StorageResponse> {
    const response = await fetch(`${this.baseUrl}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_key: sourceKey,
        dest_key: destKey,
      }),
    });

    if (!response.ok) {
      throw new StorageClientError('Failed to copy file');
    }

    return await response.json();
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Perform bulk operations on multiple files
   */
  async bulkOperation(
    keys: string[],
    operation: 'delete' | 'tier' | 'copy',
    options?: {
      destinationTier?: StorageTier;
      destinationPrefix?: string;
    }
  ): Promise<BulkOperationResult> {
    const response = await fetch(`${this.baseUrl}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keys,
        operation,
        destination_tier: options?.destinationTier,
        destination_prefix: options?.destinationPrefix,
      }),
    });

    if (!response.ok) {
      throw new StorageClientError('Failed to perform bulk operation');
    }

    return await response.json();
  }

  /**
   * Delete multiple files
   */
  async bulkDelete(keys: string[]): Promise<BulkOperationResult> {
    return this.bulkOperation(keys, 'delete');
  }

  /**
   * Change tier for multiple files
   */
  async bulkChangeTier(keys: string[], tier: StorageTier): Promise<BulkOperationResult> {
    return this.bulkOperation(keys, 'tier', { destinationTier: tier });
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  /**
   * Apply lifecycle policies (dry run or actual)
   */
  async applyLifecyclePolicies(dryRun = false): Promise<LifecycleReport> {
    const response = await fetch(`${this.baseUrl}/lifecycle/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dry_run: dryRun }),
    });

    if (!response.ok) {
      throw new StorageClientError('Failed to apply lifecycle policies');
    }

    return await response.json();
  }

  /**
   * Preview lifecycle policy changes without applying
   */
  async previewLifecycleChanges(): Promise<LifecycleReport> {
    return this.applyLifecyclePolicies(true);
  }

  // ============================================================================
  // Metrics and Analytics
  // ============================================================================

  /**
   * Get storage metrics
   */
  async getMetrics(): Promise<MetricsResponse> {
    const response = await fetch(`${this.baseUrl}/metrics`);

    if (!response.ok) {
      throw new StorageClientError('Failed to get metrics');
    }

    return await response.json();
  }

  /**
   * Get cost analysis
   */
  async getCostAnalysis(): Promise<CostAnalysis> {
    const response = await fetch(`${this.baseUrl}/cost-analysis`);

    if (!response.ok) {
      throw new StorageClientError('Failed to get cost analysis');
    }

    return await response.json();
  }

  // ============================================================================
  // CDN Operations
  // ============================================================================

  /**
   * Invalidate CDN cache for paths
   */
  async invalidateCache(paths: string[]): Promise<{
    paths: string[];
    result: Record<string, unknown>;
    status: string;
  }> {
    const response = await fetch(`${this.baseUrl}/cdn/invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths, caller_reference: null }),
    });

    if (!response.ok) {
      throw new StorageClientError('Failed to invalidate CDN cache');
    }

    return await response.json();
  }

  /**
   * Get CDN metrics
   */
  async getCDNMetrics(hours = 24): Promise<{
    period: { hours: number; start: string; end: string };
    metrics: Record<string, unknown>;
  }> {
    const response = await fetch(`${this.baseUrl}/cdn/metrics?hours=${hours}`);

    if (!response.ok) {
      throw new StorageClientError('Failed to get CDN metrics');
    }

    return await response.json();
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Cancel ongoing upload operation
   */
  cancelUpload(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Generate a storage key from filename
   */
  private generateKey(file: File): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const extension = file.name.split('.').pop() || '';
    const baseName = file.name.replace(/\.[^/.]+$/, '');

    // Sanitize filename
    const sanitized = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');

    return `${timestamp}_${random}_${sanitized}.${extension}`;
  }

  /**
   * Get content type from file
   */
  static getContentType(file: File): ContentType {
    const type = file.type.toLowerCase();

    if (type.startsWith('image/')) return ContentType.IMAGE;
    if (type.startsWith('video/')) return ContentType.VIDEO;
    if (type.startsWith('audio/')) return ContentType.AUDIO;
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) {
      return ContentType.DOCUMENT;
    }
    if (type.includes('zip') || type.includes('tar') || type.includes('compressed')) {
      return ContentType.ARCHIVE;
    }

    return ContentType.OTHER;
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format tier name for display
   */
  static formatTier(tier: StorageTier): string {
    const names: Record<StorageTier, string> = {
      [StorageTier.HOT]: 'Hot (Immediate Access)',
      [StorageTier.WARM]: 'Warm (Infrequent Access)',
      [StorageTier.COLD]: 'Cold (Archive)',
    };
    return names[tier] || tier;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let storageInstance: StorageClient | null = null;

export function getStorageClient(): StorageClient {
  if (!storageInstance) {
    // Determine base URL from environment or default
    const baseUrl = import.meta.env.VITE_STORAGE_API_URL || '/api/storage';
    storageInstance = new StorageClient(baseUrl);
  }
  return storageInstance;
}

// Re-export types and utilities
export type {
  UploadProgress,
  UploadOptions,
  MultipartUploadResult,
  MetricsResponse,
  LifecycleReport,
  CostAnalysis,
  PresignedURLOptions,
  BulkOperationResult,
};

export { StorageClientError };
