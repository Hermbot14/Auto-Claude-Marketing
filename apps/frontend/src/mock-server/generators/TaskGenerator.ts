/**
 * Task Data Generator
 *
 * Generates realistic mock task data for development
 */

import { mockConfig } from '../config'

/**
 * Task status types
 */
const TASK_STATUSES = ['pending', 'in-progress', 'completed', 'blocked', 'qa'] as const
const TASK_COMPLEXITIES = ['simple', 'standard', 'complex'] as const

/**
 * Task templates
 */
const TASK_TEMPLATES = [
  { title: 'Add user authentication', complexity: 'standard' as const },
  { title: 'Implement dark mode toggle', complexity: 'simple' as const },
  { title: 'Create responsive navigation', complexity: 'standard' as const },
  { title: 'Build dashboard analytics', complexity: 'complex' as const },
  { title: 'Fix login bug on mobile', complexity: 'simple' as const },
  { title: 'Integrate payment gateway', complexity: 'complex' as const },
  { title: 'Add search functionality', complexity: 'standard' as const },
  { title: 'Implement data export', complexity: 'standard' as const },
  { title: 'Create onboarding flow', complexity: 'complex' as const },
  { title: 'Add email notifications', complexity: 'standard' as const },
  { title: 'Build settings panel', complexity: 'simple' as const },
  { title: 'Implement rate limiting', complexity: 'complex' as const },
  { title: 'Add API documentation', complexity: 'standard' as const },
  { title: 'Create component library', complexity: 'complex' as const },
  { title: 'Fix memory leak in dashboard', complexity: 'standard' as const },
  { title: 'Implement caching layer', complexity: 'complex' as const },
  { title: 'Add unit tests for auth', complexity: 'standard' as const },
  { title: 'Build error boundary components', complexity: 'simple' as const }
]

/**
 * Generate task description
 */
function generateDescription(title: string): string {
  const templates = [
    `Implement ${title.toLowerCase()} for improved user experience.`,
    `Add support for ${title.toLowerCase()} with full feature parity.`,
    `Create ${title.toLowerCase()} component following design specifications.`,
    `Build ${title.toLowerCase()} functionality with proper error handling.`,
    `Implement ${title.toLowerCase()} with comprehensive testing.`
  ]

  return templates[Math.floor(Math.random() * templates.length)]
}

/**
 * Generate subtasks
 */
function generateSubtasks(count: number) {
  const subtaskTemplates = [
    'Create component structure',
    'Implement core logic',
    'Add error handling',
    'Write unit tests',
    'Update documentation',
    'Code review and refinement',
    'Deploy to staging',
    'Integration testing',
    'Performance optimization',
    'Add accessibility features'
  ]

  return Array.from({ length: count }, (_, idx) => ({
    id: `subtask-${Date.now()}-${idx}`,
    title: subtaskTemplates[idx % subtaskTemplates.length],
    completed: Math.random() > 0.5
  }))
}

/**
 * Generate execution progress
 */
function generateExecutionProgress() {
  return {
    phase: ['discovery', 'planning', 'implementation', 'qa', 'complete'][Math.floor(Math.random() * 5)],
    progress: Math.floor(Math.random() * 100),
    currentStep: Math.floor(Math.random() * 10) + 1,
    totalSteps: 10,
    agent: {
      name: 'planner',
      status: 'active'
    }
  }
}

/**
 * Generate a single task
 */
export function generateTask(id?: string, overrides = {}) {
  const template = TASK_TEMPLATES[Math.floor(Math.random() * TASK_TEMPLATES.length)]
  const status = TASK_STATUSES[Math.floor(Math.random() * TASK_STATUSES.length)]

  const subtaskCount = Math.floor(Math.random() * 8)

  return {
    id: id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    specId: `001-${Math.floor(Math.random() * 100)}`,
    title: overrides.title || template.title,
    description: overrides.description || generateDescription(template.title),
    status: overrides.status || status,
    complexity: template.complexity,
    priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
    createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
    subtasks: overrides.subtasks || generateSubtasks(subtaskCount),
    executionProgress: overrides.executionProgress || (status === 'in-progress' || status === 'qa' ? generateExecutionProgress() : undefined),
    metadata: {
      estimatedTime: Math.floor(1 + Math.random() * 8), // hours
      actualTime: Math.random() > 0.5 ? Math.floor(1 + Math.random() * 10) : undefined,
      assignee: Math.random() > 0.7 ? 'Developer' : undefined,
      labels: Math.random() > 0.5 ? ['enhancement', 'bug', 'feature'].slice(0, Math.floor(Math.random() * 3) + 1) : []
    },
    ...overrides
  }
}

/**
 * Generate multiple tasks
 */
export function generateTasks(options: { projectId?: string; count?: number } = {}) {
  const { count = Math.floor(mockConfig.data.minItems + Math.random() * (mockConfig.data.maxItems - mockConfig.data.minItems)) } = options

  return Array.from({ length: count }, (_, idx) =>
    generateTask(`task-${idx}`)
  )
}

/**
 * Generate subtasks for a specific task
 */
export function generateSubtasks(taskId: string, count?: number) {
  const subtaskCount = count || Math.floor(3 + Math.random() * 7)
  return generateSubtasks(subtaskCount).map(st => ({
    ...st,
    taskId
  }))
}

/**
 * Task types
 */
export type TaskStatus = typeof TASK_STATUSES[number]
export type TaskComplexity = typeof TASK_COMPLEXITIES[number]
