/**
 * CSRF Protection API
 *
 * This implements OPD-PERF-001 P1-4: CSRF Protection
 * Exposes CSRF token management to the renderer process.
 */

import { ipcRenderer } from 'electron';
import type { CSRFAPI } from './csrf-types';

/**
 * CSRF API Implementation
 *
 * Provides double-submit cookie pattern for CSRF protection.
 */
export const createCSRFAPI = (): CSRFAPI => {
  return {
    /**
     * Get the current CSRF token for requests
     *
     * Returns the token that should be sent in the X-CSRF-Token header.
     */
    async getCSRFToken(): Promise<string> {
      const result = await ipcRenderer.invoke('csrf-get-token') as string;
      return result;
    },

    /**
     * Validate a CSRF token against stored value
     *
     * @param token - Token to validate
     * @returns Validation result
     */
    async validateCSRFToken(token: string): Promise<{ valid: boolean; reason?: string }> {
      const result = await ipcRenderer.invoke('csrf-validate-token', token) as {
        valid: boolean;
        reason?: string;
      };
      return result;
    },

    /**
     * Request a new CSRF token
     *
     * Automatically rotates tokens when needed.
     */
    async refreshCSRFToken(): Promise<string> {
      const result = await ipcRenderer.invoke('csrf-refresh-token') as string;
      return result;
    },

    /**
     * Get the current CSRF configuration
     *
     * Returns token validity period and rotation settings.
     */
    async getCSRFConfig(): Promise<{
      tokenValidity: number;
      rotationEnabled: boolean;
    }> {
      const result = await ipcRenderer.invoke('csrf-get-config') as {
        tokenValidity: number;
        rotationEnabled: boolean;
      };
      return result;
    },

    /**
     * Validate CSRF token for a request
     *
     * Automatically includes the token in requests and validates the response.
     *
     * @param url - Request URL
     * @param options - Fetch options
     * @returns Enhanced fetch options with CSRF token
     */
    async fetchWithCSRF<T>(
      url: string,
      options: RequestInit = {}
    ): Promise<T> {
      const token = await this.getCSRFToken();

      const enhancedOptions: RequestInit = {
        ...options,
        headers: {
          ...options.headers,
          'X-CSRF-Token': token,
        },
      };

      // Add token to body if present
      let body = options.body;
      if (body) {
        if (body instanceof FormData) {
          body.append('csrf_token', token);
        } else if (typeof body === 'string') {
          // Assume URL-encoded
          const params = new URLSearchParams(body);
          params.append('csrf_token', token);
          body = params.toString();
        } else if (typeof body === 'object' && body !== null) {
          // JSON body
          body = JSON.stringify({ ...JSON.parse(body as string), csrf_token: token });
        }
      }

      const response = await fetch(url, {
        ...enhancedOptions,
        body,
      });

      // Validate CSRF token in response
      const csrfToken = response.headers.get('X-CSRF-Token');
      if (csrfToken) {
        const validation = await this.validateCSRFToken(csrfToken);
        if (!validation.valid) {
          console.warn('[CSRF] Token validation failed:', validation.reason);

          // Refresh token and retry on validation failure
          const newToken = await this.refreshCSRFToken();

          // Retry request with new token
          let retryBody = options.body;
          if (retryBody) {
            if (retryBody instanceof FormData) {
              // FormData is immutable, create new one
              const newFormData = new FormData();
              for (const [key, value] of (retryBody as FormData).entries()) {
                newFormData.append(key, value);
              }
              newFormData.append('csrf_token', newToken);
              retryBody = newFormData;
            } else if (typeof retryBody === 'string') {
              const params = new URLSearchParams(retryBody);
              params.set('csrf_token', newToken);
              retryBody = params.toString();
            } else if (typeof retryBody === 'object') {
              retryBody = JSON.stringify({
                ...JSON.parse(retryBody as string),
                csrf_token: newToken,
              });
            }
          }

          return fetch(url, {
            ...enhancedOptions,
            headers: {
              ...enhancedOptions.headers,
              'X-CSRF-Token': newToken,
            },
            body: retryBody,
          }) as Promise<T>;
        }
      }

      return response.json();
    },

    /**
     * Setup CSRF event listeners
     *
     * Listen for CSRF violation events and token rotation.
     *
     * @param onViolation - Callback for CSRF violations
     * @param onTokenRotated - Callback for token rotation
     */
    setupCSRFListeners(
      onViolation?: (violation: { reason: string; timestamp: number }) => void,
      onTokenRotated?: (newToken: string) => void
    ): () => void {
      // Listen for CSRF violations from main process
      const listener = (_event: Electron.IpcRendererEvent, violation: { reason: string; timestamp: number }) => {
        if (onViolation) {
          onViolation(violation);
        }

        console.error('[CSRF] Violation detected:', violation);
      };

      ipcRenderer.on('csrf-violation', listener);

      // Listen for token rotation events
      const rotationListener = (_event: Electron.IpcRendererEvent, newToken: string) => {
        if (onTokenRotated) {
          onTokenRotated(newToken);
        }

        console.log('[CSRF] Token rotated:', newToken.substring(0, 8) + '...');
      };

      ipcRenderer.on('csrf-token-rotated', rotationListener);

      return () => {
        ipcRenderer.removeListener('csrf-violation', listener);
        ipcRenderer.removeListener('csrf-token-rotated', rotationListener);
      };
    },
  };
};
