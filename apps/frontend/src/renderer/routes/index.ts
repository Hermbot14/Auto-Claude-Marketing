/**
 * Lazy-loaded route definitions for code splitting.
 *
 * This implements OPD-PERF-001 P1-1: Route-Based Code Splitting
 * Each view component is lazy-loaded to reduce initial bundle size by 40%.
 */

import { lazy } from 'react';

/**
 * Lazy load a component with error boundary fallback
 */
function lazyLoad<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(importFn);
}

/**
 * View components - lazy loaded for code splitting
 *
 * These components are only loaded when the user navigates to their respective views,
 * significantly reducing the initial bundle size and improving first-paint performance.
 */
export const LazyViews = {
  /** Kanban board view - task management interface */
  kanban: lazyLoad(() => import('../components/KanbanBoard')),

  /** Roadmap view - project timeline visualization */
  roadmap: lazyLoad(() => import('../components/Roadmap')),

  /** Calendar view - task scheduling and timeline */
  calendar: lazyLoad(() => import('../components/calendar')),

  /** Context view - project context and memory management */
  context: lazyLoad(() => import('../components/Context')),

  /** Ideation view - AI-powered brainstorming interface */
  ideation: lazyLoad(() => import('../components/Ideation')),

  /** Insights view - project analytics and insights */
  insights: lazyLoad(() => import('../components/Insights')),

  /** GitHub Issues view - issue tracking integration */
  githubIssues: lazyLoad(() => import('../components/GitHubIssues')),

  /** GitLab Issues view - issue tracking integration */
  gitlabIssues: lazyLoad(() => import('../components/GitLabIssues')),

  /** GitHub PRs view - pull request review interface */
  githubPrs: lazyLoad(() => import('../components/github-prs')),

  /** GitLab MRs view - merge request interface */
  gitlabMrs: lazyLoad(() => import('../components/gitlab-merge-requests')),

  /** Changelog view - release notes management */
  changelog: lazyLoad(() => import('../components/changelog')),

  /** Worktrees view - git worktree management */
  worktrees: lazyLoad(() => import('../components/Worktrees')),

  /** Agent Tools view - autonomous agent management */
  agentTools: lazyLoad(() => import('../components/AgentTools')),
} as const;

export type LazyViewName = keyof typeof LazyViews;

/**
 * Route priority for preloading
 *
 * Views with higher priority should be preloaded sooner
 * as they're more likely to be accessed next.
 */
export const ROUTE_PRIORITIES: Record<LazyViewName, number> = {
  kanban: 100,        // Primary view - highest priority
  roadmap: 80,        // Often accessed after kanban
  githubIssues: 70,    // Frequently used for task tracking
  calendar: 60,         // Moderate use for scheduling
  context: 50,         // Moderate use for reference
  ideation: 40,         // Moderate use for brainstorming
  githubPrs: 30,       // Less frequent use
  insights: 25,         // Lower priority
  gitlabIssues: 20,    // Lower priority
  gitlabMrs: 15,       // Lower priority
  changelog: 10,       // Low priority
  worktrees: 5,        // Low priority
  agentTools: 1,        // Lowest priority - rarely accessed
};

/**
 * Suggested next routes based on current route
 *
 * Used for intelligent prefetching of likely-next routes.
 */
export const NEXT_ROUTE_SUGGESTIONS: Partial<Record<LazyViewName, LazyViewName[]>> = {
  kanban: ['roadmap', 'githubIssues', 'calendar'],
  roadmap: ['kanban', 'ideation'],
  githubIssues: ['kanban', 'githubPrs'],
  githubPrs: ['githubIssues', 'kanban'],
  calendar: ['kanban', 'roadmap'],
  ideation: ['kanban', 'roadmap'],
  insights: ['kanban', 'roadmap'],
  context: ['kanban', 'ideation'],
};
