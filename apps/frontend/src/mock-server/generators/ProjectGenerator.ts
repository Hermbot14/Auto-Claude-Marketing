/**
 * Project Data Generator
 *
 * Generates realistic mock project data for development
 */

import { mockConfig } from '../config'

/**
 * Project status types
 */
const PROJECT_STATUSES = ['active', 'archived', 'on-hold'] as const

/**
 * Generate random project name
 */
function generateProjectName(): string {
  const adjectives = ['Auto', 'Smart', 'Quick', 'Pro', 'Mega', 'Mini', 'Ultra']
  const nouns = ['Marketing', 'Sales', 'CRM', 'Dashboard', 'Analytics', 'Tracker']
  const types = ['App', 'Platform', 'System', 'Hub', 'Suite']

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const type = types[Math.floor(Math.random() * types.length)]

  return `${adj} ${noun} ${type}`
}

/**
 * Generate random path
 */
function generatePath(): string {
  const basePath = process.platform === 'win32' ? 'C:\\Projects' : '/Users/developer/projects'
  const projectName = generateProjectName().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  return `${basePath}/${projectName}`
}

/**
 * Generate a single project
 */
export function generateProject(id?: string, overrides = {}) {
  const status = PROJECT_STATUSES[Math.floor(Math.random() * PROJECT_STATUSES.length)]
  const hasAutoClaude = Math.random() > 0.3

  return {
    id: id || `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: generateProjectName(),
    path: generatePath(),
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastAccessedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    status,
    settings: {
      mainBranch: 'main',
      githubEnabled: Math.random() > 0.5,
      gitlabEnabled: Math.random() > 0.7
    },
    autoBuildPath: hasAutoClaude ? generatePath() + '/.auto-claude' : null,
    ...overrides
  }
}

/**
 * Generate multiple projects
 */
export function generateProjects(options: { min?: number; max?: number } = {}) {
  const { min = mockConfig.data.minItems, max = mockConfig.data.maxItems } = options
  const count = Math.floor(min + Math.random() * (max - min))

  return Array.from({ length: count }, (_, idx) =>
    generateProject(`project-${idx}`)
  )
}

/**
 * Project types
 */
export type ProjectStatus = typeof PROJECT_STATUSES[number]
