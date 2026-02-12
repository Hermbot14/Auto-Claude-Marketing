/**
 * Settings API Mock Handlers
 *
 * Mock handlers for settings-related API endpoints
 */

import { http } from 'msw'
import { generateSettings } from '../generators/SettingsGenerator'
import { delayedResponse, randomErrorResponse } from '../index'

/**
 * GET /api/settings - Get all settings
 */
export const getSettings = http.get('/api/settings', async () => {
  const error = await randomErrorResponse()
  if (error) return error

  const settings = generateSettings()
  return delayedResponse(settings)
})

/**
 * PUT /api/settings - Update settings
 */
export const updateSettings = http.put('/api/settings', async ({ request }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const body = await request.json()
  return delayedResponse({
    success: true,
    settings: { ...generateSettings(), ...body }
  })
})

/**
 * GET /api/settings/profiles - Get API profiles
 */
export const getProfiles = http.get('/api/settings/profiles', async () => {
  const error = await randomErrorResponse()
  if (error) return error

  const profiles = [
    {
      id: 'default',
      name: 'Claude (Default)',
      baseUrl: 'https://api.anthropic.com',
      isActive: true
    },
    {
      id: 'custom',
      name: 'Custom Endpoint',
      baseUrl: 'https://custom.example.com',
      isActive: false
    }
  ]

  return delayedResponse({ profiles })
})

/**
 * POST /api/settings/profiles - Create profile
 */
export const createProfile = http.post('/api/settings/profiles', async ({ request }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const body = await request.json()
  const newProfile = {
    id: `profile-${Date.now()}`,
    ...body,
    isActive: false
  }

  return delayedResponse(newProfile, { status: 201 })
})

/**
 * Export all handlers
 */
export const handlers = [
  getSettings,
  updateSettings,
  getProfiles,
  createProfile
]
