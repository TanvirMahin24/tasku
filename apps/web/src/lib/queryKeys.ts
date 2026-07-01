import type { IssueFilterCriteria } from '@tasku/types';
import type { IssueFilters } from './api';

// Centralized React Query keys so invalidation stays consistent across the app.
export const qk = {
  me: ['me'] as const,
  users: ['users'] as const,

  projects: ['projects'] as const,
  recommendedProjects: ['projects', 'recommended'] as const,
  dashboard: ['dashboard'] as const,
  project: (key: string) => ['project', key] as const,
  statuses: (key: string) => ['project', key, 'statuses'] as const,
  labels: (key: string) => ['project', key, 'labels'] as const,
  components: (key: string) => ['project', key, 'components'] as const,
  members: (key: string) => ['project', key, 'members'] as const,

  board: (key: string, sprintId?: string) =>
    ['project', key, 'board', sprintId ?? 'active'] as const,
  boards: (key: string) => ['project', key, 'boards'] as const,
  boardById: (boardId: string) => ['board', boardId] as const,

  timeline: (key: string) => ['project', key, 'timeline'] as const,
  overview: (key: string) => ['project', key, 'overview'] as const,
  reports: (key: string) => ['project', key, 'reports'] as const,

  issues: (key: string, filters?: IssueFilters) =>
    ['project', key, 'issues', filters ?? {}] as const,
  issue: (issueKey: string) => ['issue', issueKey] as const,
  comments: (issueKey: string) => ['issue', issueKey, 'comments'] as const,

  sprints: (key: string) => ['project', key, 'sprints'] as const,
  versions: (key: string) => ['project', key, 'versions'] as const,

  teams: ['teams'] as const,
  team: (id: string) => ['team', id] as const,

  notifications: ['notifications'] as const,

  search: (criteria: IssueFilterCriteria) =>
    ['search', 'issues', criteria] as const,
  filters: ['filters'] as const,
  filter: (id: string) => ['filter', id] as const,
  filterResults: (id: string) => ['filter', id, 'results'] as const,

  teamKnowledge: (id: string) => ['team', id, 'knowledge'] as const,
  issueKnowledge: (issueKey: string) =>
    ['issue', issueKey, 'knowledge'] as const,
  importableKnowledge: (search: string) =>
    ['knowledge', 'importable', search] as const,
};
