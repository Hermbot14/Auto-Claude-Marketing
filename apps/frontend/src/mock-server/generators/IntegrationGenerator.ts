/**
 * Integration Data Generator
 *
 * Generates realistic mock data for GitHub, GitLab, and other integrations
 */

/**
 * Generate GitHub issues
 */
export function generateGitHubIssues(options: { state?: string; count?: number } = {}) {
  const { state = 'open', count = 5 } = options

  const issueTemplates = [
    { title: 'Fix authentication bug', labels: ['bug', 'high-priority'] },
    { title: 'Add dark mode support', labels: ['enhancement', 'good-first-issue'] },
    { title: 'Update dependencies', labels: ['dependencies', 'security'] },
    { title: 'Improve error handling', labels: ['enhancement'] },
    { title: 'Add unit tests', labels: ['testing', 'good-first-issue'] },
    { title: 'Memory leak in dashboard', labels: ['bug', 'high-priority'] },
    { title: 'Optimize render performance', labels: ['performance'] },
    { title: 'Add API documentation', labels: ['documentation'] },
    { title: 'Fix mobile responsiveness', labels: ['bug', 'mobile'] },
    { title: 'Implement search feature', labels: ['enhancement'] },
    { title: 'Refactor component library', labels: ['refactoring', 'debt'] },
    { title: 'Add rate limiting', labels: ['security', 'performance'] },
    { title: 'Create onboarding flow', labels: ['enhancement', 'ux'] }
  ]

  return Array.from({ length: count }, (_, idx) => {
    const template = issueTemplates[idx % issueTemplates.length]
    const isOpen = state === 'open' || state === 'all'

    return {
      number: idx + 1,
      title: template.title,
      state: isOpen ? 'open' : 'closed',
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      author: `user-${Math.floor(Math.random() * 100)}`,
      labels: template.labels,
      assignees: Math.random() > 0.6 ? [`developer-${Math.floor(Math.random() * 10)}`] : [],
      comments: Math.floor(Math.random() * 20),
      body: `## Description\n\nThis issue tracks ${template.title.toLowerCase()}.\n\n## Steps to Reproduce\n\n1. First step\n2. Second step\n\n## Expected Behavior\n\nThe expected behavior should occur.\n\n## Actual Behavior\n\nThe actual behavior that occurs instead.`,
      pullRequest: state === 'closed' ? Math.random() > 0.5 : undefined
    }
  })
}

/**
 * Generate GitHub pull requests
 */
export function generateGitHubPRs(options: { state?: string; count?: number } = {}) {
  const { state = 'open', count = 3 } = options

  const prTemplates = [
    { title: 'Feature: Add user authentication', additions: 250, deletions: 50 },
    { title: 'Fix: Resolve memory leak', additions: 15, deletions: 30 },
    { title: 'Refactor: Component library cleanup', additions: 100, deletions: 200 },
    { title: 'Feature: Dashboard analytics', additions: 400, deletions: 80 },
    { title: 'Docs: Update README', additions: 50, deletions: 20 },
    { title: 'Fix: Mobile responsiveness', additions: 75, deletions: 25 },
    { title: 'Chore: Update dependencies', additions: 500, deletions: 450 },
    { title: 'Feature: Search functionality', additions: 300, deletions: 100 }
  ]

  return Array.from({ length: count }, (_, idx) => {
    const template = prTemplates[idx % prTemplates.length]
    const isOpen = state === 'open' || state === 'all'
    const reviewStatuses = ['approved', 'changes_requested', 'commented', 'pending']

    return {
      number: idx + 1,
      title: template.title,
      state: isOpen ? 'open' : 'closed',
      status: isOpen ? 'open' : (Math.random() > 0.3 ? 'merged' : 'closed'),
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      author: `contributor-${Math.floor(Math.random() * 20)}`,
      baseBranch: 'main',
      headBranch: `feature/branch-${idx}`,
      additions: template.additions,
      deletions: template.deletions,
      changedFiles: Math.floor(3 + Math.random() * 15),
      comments: Math.floor(Math.random() * 15),
      reviews: isOpen && Math.random() > 0.5 ? Math.floor(1 + Math.random() * 3) : undefined,
      reviewStatus: isOpen ? undefined : reviewStatuses[Math.floor(Math.random() * reviewStatuses.length)],
      labels: ['enhancement', 'bug-fix'].slice(0, Math.floor(Math.random() * 3) + 1),
      body: `## Summary\n\nThis PR implements ${template.title.toLowerCase()}.\n\n## Changes\n\n- Added feature X\n- Fixed bug Y\n- Updated component Z\n\n## Testing\n\n- [x] Unit tests pass\n- [x] Integration tests pass\n- [x] Manual testing completed`,
      checks: isOpen ? {
        passing: Math.random() > 0.3,
        failing: Math.random() > 0.7,
        pending: Math.random() > 0.5
      } : undefined
    }
  })
}

/**
 * Generate GitLab merge requests
 */
export function generateGitLabMRs(options: { state?: string; count?: number } = {}) {
  const { state = 'opened', count = 3 } = options

  const mrTemplates = [
    { title: 'Implement feature X', author: 'developer-1' },
    { title: 'Fix bug Y', author: 'developer-2' },
    { title: 'Refactor module Z', author: 'developer-3' },
    { title: 'Update documentation', author: 'developer-4' }
  ]

  return Array.from({ length: count }, (_, idx) => {
    const template = mrTemplates[idx % mrTemplates.length]
    const isOpen = state === 'opened' || state === 'all'

    return {
      iid: idx + 1,
      title: template.title,
      state: isOpen ? 'opened' : (Math.random() > 0.5 ? 'merged' : 'closed'),
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      author: template.author,
      targetBranch: 'main',
      sourceBranch: `feature/${idx}-${Math.floor(Math.random() * 1000)}`,
      additions: Math.floor(50 + Math.random() * 500),
      deletions: Math.floor(20 + Math.random() * 200),
      changes: Math.floor(5 + Math.random() * 30),
      labels: ['feature', 'enhancement'].slice(0, Math.floor(Math.random() * 3) + 1),
      workInProgress: isOpen && Math.random() > 0.7,
      hasConflicts: isOpen && Math.random() > 0.9,
      pipelineStatus: isOpen ? ['success', 'running', 'failed'][Math.floor(Math.random() * 3)] : 'success',
      discussions: Math.floor(Math.random() * 10),
      upvotes: Math.floor(Math.random() * 5),
      assignees: Math.random() > 0.5 ? [template.author] : []
    }
  })
}
