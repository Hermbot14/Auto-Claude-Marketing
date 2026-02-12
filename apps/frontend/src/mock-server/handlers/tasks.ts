/**
 * Task API Mock Handlers
 *
 * Mock handlers for task-related API endpoints
 */

import { http } from 'msw'
import { generateTasks, generateTask, generateSubtasks } from '../generators/TaskGenerator'
import { delayedResponse, randomErrorResponse } from '../index'

/**
 * GET /api/tasks - List all tasks for a project
 */
export const getTasks = http.get('/api/tasks', async ({ request }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const url = new URL(request.url)
  const projectId = url.searchParams.get('projectId') || 'default'
  const tasks = generateTasks({ projectId, count: 5 + Math.floor(Math.random() * 10) })

  return delayedResponse({ tasks })
})

/**
 * GET /api/tasks/:id - Get task details
 */
export const getTask = http.get('/api/tasks/:id', async ({ params }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const task = generateTask(params.id as string)
  return delayedResponse(task)
})

/**
 * POST /api/tasks - Create new task
 */
export const createTask = http.post('/api/tasks', async ({ request }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const body = await request.json()
  const newTask = generateTask('new-task', body)
  return delayedResponse(newTask, { status: 201 })
})

/**
 * PUT /api/tasks/:id - Update task
 */
export const updateTask = http.put('/api/tasks/:id', async ({ params, request }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const body = await request.json()
  const updatedTask = generateTask(params.id as string, { ...body, id: params.id })
  return delayedResponse(updatedTask)
})

/**
 * DELETE /api/tasks/:id - Delete task
 */
export const deleteTask = http.delete('/api/tasks/:id', async ({ params }) => {
  const error = await randomErrorResponse()
  if (error) return error

  return delayedResponse({ success: true, deletedId: params.id })
})

/**
 * POST /api/tasks/:id/start - Start task execution
 */
export const startTask = http.post('/api/tasks/:id/start', async ({ params }) => {
  return delayedResponse({
    success: true,
    taskId: params.id,
    status: 'running'
  }, { minDelay: 500, maxDelay: 1500 })
})

/**
 * POST /api/tasks/:id/stop - Stop task execution
 */
export const stopTask = http.post('/api/tasks/:id/stop', async ({ params }) => {
  return delayedResponse({
    success: true,
    taskId: params.id,
    status: 'stopped'
  })
})

/**
 * GET /api/tasks/:id/subtasks - Get task subtasks
 */
export const getSubtasks = http.get('/api/tasks/:id/subtasks', async ({ params }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const subtasks = generateSubtasks(params.id as string)
  return delayedResponse({ subtasks })
})

/**
 * POST /api/tasks/:id/subtasks - Create subtask
 */
export const createSubtask = http.post('/api/tasks/:id/subtasks', async ({ params, request }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const body = await request.json()
  const newSubtask = {
    id: `subtask-${Date.now()}`,
    taskId: params.id,
    title: body.title || 'New Subtask',
    completed: false
  }

  return delayedResponse(newSubtask, { status: 201 })
})

/**
 * PUT /api/subtasks/:id - Update subtask
 */
export const updateSubtask = http.put('/api/subtasks/:id', async ({ params, request }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const body = await request.json()
  return delayedResponse({
    id: params.id,
    ...body
  })
})

/**
 * DELETE /api/subtasks/:id - Delete subtask
 */
export const deleteSubtask = http.delete('/api/subtasks/:id', async ({ params }) => {
  const error = await randomErrorResponse()
  if (error) return error

  return delayedResponse({ success: true, deletedId: params.id })
})

/**
 * POST /api/tasks/:id/qa - Run QA on task
 */
export const runQA = http.post('/api/tasks/:id/qa', async ({ params }) => {
  return delayedResponse({
    success: true,
    taskId: params.id,
    qaStatus: 'in_progress'
  }, { minDelay: 1000, maxDelay: 2000 })
})

/**
 * Export all handlers
 */
export const handlers = [
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  startTask,
  stopTask,
  getSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  runQA
]
