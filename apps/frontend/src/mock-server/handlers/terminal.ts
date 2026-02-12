/**
 * Terminal API Mock Handlers
 *
 * Mock handlers for terminal-related API endpoints
 */

import { http, HttpResponse } from 'msw'
import { delayedResponse, randomErrorResponse } from '../index'

/**
 * GET /api/terminals - List all terminals
 */
export const getTerminals = http.get('/api/terminals', async () => {
  const error = await randomErrorResponse()
  if (error) return error

  return delayedResponse({
    terminals: [
      {
        id: 'term-1',
        projectId: 'project-1',
        cwd: '/path/to/project',
        shell: '/bin/bash',
        status: 'active'
      }
    ]
  })
})

/**
 * POST /api/terminals - Create new terminal
 */
export const createTerminal = http.post('/api/terminals', async ({ request }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const body = await request.json()
  return delayedResponse({
    id: `term-${Date.now()}`,
    ...body,
    status: 'active',
    createdAt: new Date().toISOString()
  }, { status: 201 })
})

/**
 * DELETE /api/terminals/:id - Delete terminal
 */
export const deleteTerminal = http.delete('/api/terminals/:id', async ({ params }) => {
  const error = await randomErrorResponse()
  if (error) return error

  return delayedResponse({ success: true, deletedId: params.id })
})

/**
 * POST /api/terminals/:id/input - Send input to terminal
 */
export const sendTerminalInput = http.post('/api/terminals/:id/input', async () => {
  return delayedResponse({ success: true }, { minDelay: 10, maxDelay: 50 })
})

/**
 * POST /api/terminals/:id/resize - Resize terminal
 */
export const resizeTerminal = http.post('/api/terminals/:id/resize', async ({ request }) => {
  return delayedResponse({ success: true }, { minDelay: 10, maxDelay: 50 })
})

/**
 * GET /api/terminals/:id/output - Get terminal output
 */
export const getTerminalOutput = http.get('/api/terminals/:id/output', async () => {
  // Simulate SSE stream
  return new HttpResponse('data: {"output": "", "timestamp": ' + Date.now() + '}\n\n', {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
})

/**
 * Export all handlers
 */
export const handlers = [
  getTerminals,
  createTerminal,
  deleteTerminal,
  sendTerminalInput,
  resizeTerminal,
  getTerminalOutput
]
