/**
 * Mock Server - Development API Server
 *
 * Provides a mock backend for frontend development using MSW (Mock Service Worker).
 * Eliminates backend dependency for UI development.
 *
 * Features:
 * - Realistic data generation
 * - Configurable latency simulation
 * - Error state testing
 * - Request/response recording
 * - Hot-reload support
 */

import { http, HttpResponse, delay, type HttpRequestRule } from 'msw'
import { setupWorker } from 'msw/browser'
import { handlers as projectHandlers } from './handlers/projects'
import { handlers as taskHandlers } from './handlers/tasks'
import { handlers as settingsHandlers } from './handlers/settings'
import { handlers as terminalHandlers } from './handlers/terminal'
import { handlers as integrationHandlers } from './handlers/integrations'
import { mockConfig } from './config'

// Combine all handlers
export const handlers = [
  ...projectHandlers,
  ...taskHandlers,
  ...settingsHandlers,
  ...terminalHandlers,
  ...integrationHandlers
]

/**
 * Request response recorder
 */
export class RequestRecorder {
  private recordings: Array<{
    timestamp: number
    request: Request
    response?: Response
    error?: string
  }> = []

  private maxRecordings = 100

  record(request: Request, response?: Response, error?: string) {
    this.recordings.push({
      timestamp: Date.now(),
      request,
      response,
      error
    })

    // Keep only last N recordings
    if (this.recordings.length > this.maxRecordings) {
      this.recordings = this.recordings.slice(-this.maxRecordings)
    }
  }

  getRecordings() {
    return [...this.recordings]
  }

  clear() {
    this.recordings = []
  }

  exportJson() {
    return JSON.stringify(this.recordings.map(r => ({
      timestamp: r.timestamp,
      method: r.request.method,
      url: r.request.url,
      status: r.response?.status,
      error: r.error
    })), null, 2)
  }
}

export const requestRecorder = new RequestRecorder()

/**
 * Configure response helpers
 */

/**
 * Success response with optional delay
 */
export function successResponse<T>(data: T, status = 200) {
  return HttpResponse.json(data, { status })
}

/**
 * Error response
 */
export function errorResponse(message: string, status = 500) {
  return HttpResponse.json(
    { error: message },
    { status }
  )
}

/**
 * Response with simulated delay
 */
export async function delayedResponse<T>(
  data: T,
  config: {
    status?: number
    minDelay?: number
    maxDelay?: number
  } = {}
) {
  const {
    status = 200,
    minDelay = mockConfig.latency.min,
    maxDelay = mockConfig.latency.max
  } = config

  const actualDelay = minDelay + Math.random() * (maxDelay - minDelay)

  await delay(actualDelay)

  return HttpResponse.json(data, { status })
}

/**
 * Simulated error response
 */
export async function randomErrorResponse(
  config: {
    errorRate?: number
    errors?: Array<{ status: number; message: string }>
  } = {}
) {
  const {
    errorRate = mockConfig.errorRate,
    errors = mockConfig.errorResponses
  } = config

  // Roll for error
  if (Math.random() < errorRate) {
    const error = errors[Math.floor(Math.random() * errors.length)]
    await delay(mockConfig.latency.min)
    return errorResponse(error.message, error.status)
  }

  return null
}

/**
 * Setup mock server
 */
export function setupMockServer(options: {
  onRecording?: (recording: { method: string; url: string; status?: number }) => void
} = {}) {
  // Create MSW worker
  const worker = setupWorker(...handlers)

  // Add request recording if requested
  if (options.onRecording) {
    worker.use({
      async onFetchRequest(req) {
        // Store request for recording
        const originalResponse = await req.clone().text()

        return req.clone()
      },
      async onResponse(res, req) {
        // Record the response
        const clone = res.clone()
        try {
          const data = await clone.json()
          options.onRecording?.({
            method: req.method,
            url: req.url,
            status: res.status
          })
          requestRecorder.record(req, res)
        } catch {
          // Not JSON, just record status
          options.onRecording?.({
            method: req.method,
            url: req.url,
            status: res.status
          })
          requestRecorder.record(req, res)
        }
      }
    })
  }

  console.log('[Mock Server] Initialized', {
    handlersCount: handlers.length,
    config: mockConfig
  })

  return worker
}

/**
 * Enable/disable mock mode
 */
export function setMockMode(enabled: boolean) {
  if (enabled) {
    console.log('[Mock Server] Mock mode enabled')
    // Store in session storage for persistence
    sessionStorage.setItem('mock-server-enabled', 'true')
  } else {
    console.log('[Mock Server] Mock mode disabled')
    sessionStorage.removeItem('mock-server-enabled')
  }
}

/**
 * Check if mock mode is enabled
 */
export function isMockMode(): boolean {
  return sessionStorage.getItem('mock-server-enabled') === 'true'
}

/**
 * Export request recordings
 */
export function exportRecordings() {
  const recordings = requestRecorder.getRecordings()
  const blob = new Blob([requestRecorder.exportJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mock-recordings-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Clear recordings
 */
export function clearRecordings() {
  requestRecorder.clear()
}

/**
 * Get mock statistics
 */
export function getMockStats() {
  const recordings = requestRecorder.getRecordings()
  const byMethod = recordings.reduce((acc, r) => {
    acc[r.request.method] = (acc[r.request.method] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const byStatus = recordings.reduce((acc, r) => {
    const status = r.response?.status || 'error'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    totalRequests: recordings.length,
    byMethod,
    byStatus,
    errorRate: recordings.filter(r => r.error).length / recordings.length
  }
}
