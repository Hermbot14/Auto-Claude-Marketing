/**
 * Integrations API Mock Handlers
 *
 * Mock handlers for GitHub, GitLab, and other integration endpoints
 */

import { http } from 'msw'
import { generateGitHubIssues, generateGitHubPRs, generateGitLabMRs } from '../generators/IntegrationGenerator'
import { delayedResponse, randomErrorResponse } from '../index'

/**
 * GET /api/github/issues - Get GitHub issues
 */
export const getGitHubIssues = http.get('/api/github/issues', async ({ request }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const url = new URL(request.url)
  const state = url.searchParams.get('state') || 'open'
  const issues = generateGitHubIssues({ state, count: 5 + Math.floor(Math.random() * 15) })

  return delayedResponse({ issues })
})

/**
 * GET /api/github/issues/:number - Get GitHub issue details
 */
export const getGitHubIssue = http.get('/api/github/issues/:number', async ({ params }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const allIssues = generateGitHubIssues({ state: 'all', count: 50 })
  const issue = allIssues.find(i => i.number === Number(params.number))

  if (!issue) {
    return HttpResponse.json(
      { error: 'Issue not found' },
      { status: 404 }
    )
  }

  return delayedResponse(issue)
})

/**
 * POST /api/github/issues/:number/investigate - Start investigation
 */
export const investigateIssue = http.post('/api/github/issues/:number/investigate', async ({ params }) => {
  return delayedResponse({
    success: true,
    issueNumber: params.number,
    status: 'investigating'
  }, { minDelay: 1000, maxDelay: 2000 })
})

/**
 * GET /api/github/pulls - Get GitHub pull requests
 */
export const getGitHubPRs = http.get('/api/github/pulls', async ({ request }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const url = new URL(request.url)
  const state = url.searchParams.get('state') || 'open'
  const prs = generateGitHubPRs({ state, count: 3 + Math.floor(Math.random() * 10) })

  return delayedResponse({ pulls: prs })
})

/**
 * GET /api/github/pulls/:number - Get PR details
 */
export const getGitHubPR = http.get('/api/github/pulls/:number', async ({ params }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const allPRs = generateGitHubPRs({ state: 'all', count: 50 })
  const pr = allPRs.find(p => p.number === Number(params.number))

  if (!pr) {
    return HttpResponse.json(
      { error: 'Pull request not found' },
      { status: 404 }
    )
  }

  return delayedResponse(pr)
})

/**
 * POST /api/github/pulls/:number/approve - Approve PR
 */
export const approvePR = http.post('/api/github/pulls/:number/approve', async ({ params }) => {
  return delayedResponse({
    success: true,
    prNumber: params.number,
    approvedAt: new Date().toISOString()
  })
})

/**
 * GET /api/gitlab/merge-requests - Get GitLab MRs
 */
export const getGitLabMRs = http.get('/api/gitlab/merge-requests', async ({ request }) => {
  const error = await randomErrorResponse()
  if (error) return error

  const url = new URL(request.url)
  const state = url.searchParams.get('state') || 'opened'
  const mrs = generateGitLabMRs({ state, count: 3 + Math.floor(Math.random() * 8) })

  return delayedResponse({ mergeRequests: mrs })
})

/**
 * POST /api/gitlab/merge-requests/:iid/merge - Merge MR
 */
export const mergeGitLabMR = http.post('/api/gitlab/merge-requests/:iid/merge', async ({ params }) => {
  return delayedResponse({
    success: true,
    iid: params.iid,
    mergedAt: new Date().toISOString()
  }, { minDelay: 1000, maxDelay: 3000 })
})

/**
 * GET /api/changelog - Get changelog
 */
export const getChangelog = http.get('/api/changelog', async () => {
  const error = await randomErrorResponse()
  if (error) return error

  return delayedResponse({
    versions: [
      {
        version: '2.8.0',
        date: '2025-02-10',
        changes: [
          { type: 'feat', message: 'Add new feature X' },
          { type: 'fix', message: 'Fix bug Y' }
        ]
      },
      {
        version: '2.7.5',
        date: '2025-02-01',
        changes: [
          { type: 'feat', message: 'Add feature Z' },
          { type: 'fix', message: 'Fix bug W' }
        ]
      }
    ]
  })
})

/**
 * POST /api/changelog/generate - Generate changelog
 */
export const generateChangelog = http.post('/api/changelog/generate', async () => {
  return delayedResponse({
    success: true,
    status: 'generating',
    estimatedTime: 30
  }, { minDelay: 1000, maxDelay: 2000 })
})

/**
 * Export all handlers
 */
export const handlers = [
  getGitHubIssues,
  getGitHubIssue,
  investigateIssue,
  getGitHubPRs,
  getGitHubPR,
  approvePR,
  getGitLabMRs,
  mergeGitLabMR,
  getChangelog,
  generateChangelog
]
