/**
 * Project API Mock Handlers
 *
 * Mock handlers for project-related API endpoints
 */

import { http, HttpResponse } from 'msw'
import { generateProjects, generateProject } from '../generators/ProjectGenerator'
import { delayedResponse, randomErrorResponse, successResponse } from '../index'

/**
 * GET /api/projects - List all projects
 */
export const getProjects = http.get('/api/projects', async () => {
  const error = await randomErrorResponse()
  if (error) return error

  const projects = generateProjects()
  return delayedResponse({ projects })
})

/**
 * GET /api/projects/:id - Get project details
 */
export const getProject = http.get('/api/projects/:id', async ({ params }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const project = generateProject(params.id as string)
  return delayedResponse(project)
})

/**
 * POST /api/projects - Create new project
 */
export const createProject = http.post('/api/projects', async ({ request }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const body = await request.json()
  const newProject = generateProject('new', body)
  return delayedResponse(newProject, { status: 201 })
})

/**
 * PUT /api/projects/:id - Update project
 */
export const updateProject = http.put('/api/projects/:id', async ({ params, request }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const body = await request.json()
  const updatedProject = generateProject(params.id as string, body)
  return delayedResponse(updatedProject)
})

/**
 * DELETE /api/projects/:id - Delete project
 */
export const deleteProject = http.delete('/api/projects/:id', async ({ params }) => {
  const error = await randomErrorResponse()
  if (error) return error

  return delayedResponse({ success: true, deletedId: params.id })
})

/**
 * POST /api/projects/:id/initialize - Initialize Auto Claude
 */
export const initializeProject = http.post('/api/projects/:id/initialize', async ({ params }) => {
  return delayedResponse({
    success: true,
    projectId: params.id,
    autoBuildPath: `/path/to/.auto-claude/specs/${params.id}`
  }, { minDelay: 1000, maxDelay: 2000 })
})

/**
 * Export all handlers
 */
export const handlers = [
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  initializeProject
]
