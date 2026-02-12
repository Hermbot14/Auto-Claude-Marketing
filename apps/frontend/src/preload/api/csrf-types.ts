/**
 * CSRF Types
 *
 * Type definitions for CSRF protection API.
 */

export interface CSRFAPI {
  /**
   * Get the current CSRF token for making requests.
   * @returns Promise<string> - The current CSRF token
   */
  getCSRFToken(): Promise<string>;

  /**
   * Validate a CSRF token against the stored value.
   * @param token - The token to validate
   * @returns Promise<{ valid: boolean; reason?: string }> - Validation result with optional reason
   */
  validateCSRFToken(token: string): Promise<{ valid: boolean; reason?: string }>;

  /**
   * Request a new CSRF token, automatically rotating if needed.
   * @returns Promise<string> - The new CSRF token
   */
  refreshCSRFToken(): Promise<string>;

  /**
   * Get current CSRF configuration.
   * @returns Promise<{ tokenValidity: number; rotationEnabled: boolean }> - Configuration details
   */
  getCSRFConfig(): Promise<{
    tokenValidity: number;
    rotationEnabled: boolean;
  }>;

  /**
   * Enhanced fetch with automatic CSRF token injection.
   * @param url - The URL to fetch
   * @param options - Standard fetch options
   * @returns Promise<T> - Fetch response with CSRF protection applied
   */
  fetchWithCSRF<T>(url: string, options?: RequestInit): Promise<T>;

  /**
   * Setup CSRF event listeners for security monitoring.
   * @param onViolation - Callback when CSRF violation detected
   * @param onTokenRotated - Callback when token is refreshed
   * @returns Cleanup function to remove listeners
   */
  setupCSRFListeners(
    onViolation?: (violation: { reason: string; timestamp: number }) => void,
    onTokenRotated?: (newToken: string) => void
  ): () => void;
}
