import type { IssueFilters } from './api';

// Centralized React Query keys so invalidation stays consistent across the app.
export const qk = {
  me: ['me'] as const,
  users: ['users'] as const,

  projects: ['projects'] as const,
  project: (key: string) => ['project', key] as const,
  statuses: (key: string) => ['project', key, 'statuses'] as const,
  labels: (key: string) => ['project', key, 'labels'] as const,
  members: (key: string) => ['project', key, 'members'] as const,

  board: (key: string, sprintId?: string) =>
    ['project', key, 'board', sprintId ?? 'active'] as const,

  issues: (key: string, filters?: IssueFilters) =>
    ['project', key, 'issues', filters ?? {}] as const,
  issue: (issueKey: string) => ['issue', issueKey] as const,
  comments: (issueKey: string) => ['issue', issueKey, 'comments'] as const,

  sprints: (key: string) => ['project', key, 'sprints'] as const,

  notifications: ['notifications'] as const,
};
