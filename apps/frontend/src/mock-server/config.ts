/**
 * Mock Server Configuration
 *
 * Centralized configuration for mock server behavior
 */

export const mockConfig = {
  /**
   * Latency simulation (milliseconds)
   */
  latency: {
    min: 50,
    max: 300
  },

  /**
   * Error simulation
   * errorRate = probability of random error (0-1)
   */
  errorRate: 0.05,

  /**
   * Predefined error responses
   */
  errorResponses: [
    { status: 400, message: 'Bad Request - Invalid input' },
    { status: 401, message: 'Unauthorized - Authentication required' },
    { status: 403, message: 'Forbidden - Insufficient permissions' },
    { status: 404, message: 'Not Found - Resource does not exist' },
    { status: 409, message: 'Conflict - Resource already exists' },
    { status: 422, message: 'Unprocessable Entity - Validation failed' },
    { status: 429, message: 'Too Many Requests - Rate limit exceeded' },
    { status: 500, message: 'Internal Server Error' },
    { status: 502, message: 'Bad Gateway - Backend service unavailable' },
    { status: 503, message: 'Service Unavailable - Server overloaded' },
    { status: 504, message: 'Gateway Timeout - Request took too long' }
  ],

  /**
   * Data generation options
   */
  data: {
    minItems: 3,
    maxItems: 15,
    stringLength: 20
  },

  /**
   * Recording limits
   */
  recording: {
    maxRecordings: 100
  },

  /**
   * Feature flags
   */
  features: {
    enableRecording: true,
    enableHotReload: true,
    enableErrors: true,
    enableLatency: true
  }
} as const
