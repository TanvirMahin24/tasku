import axios, { type AxiosInstance } from 'axios';
import type {
  AuthResponse,
  BoardDto,
  CommentDto,
  CreateCommentDto,
  CreateIssueDto,
  CreateProjectDto,
  CreateSprintDto,
  IssueDetailDto,
  IssueSummaryDto,
  LabelDto,
  LoginDto,
  MoveIssueDto,
  NotificationDto,
  ProjectDto,
  RegisterDto,
  Role,
  SprintDto,
  StatusDto,
  UpdateIssueDto,
  UserDto,
} from '@tasku/types';

const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Interceptors — token injection + 401 handling.
// The auth store registers callbacks here (avoids a circular import).
// ---------------------------------------------------------------------------

let tokenGetter: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

export function configureApiAuth(opts: {
  getToken: () => string | null;
  onUnauthorized: () => void;
}): void {
  tokenGetter = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

api.interceptors.request.use((config) => {
  const token = tokenGetter();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

/** Normalize an axios error into a user-facing message. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string | string[]; error?: string }
      | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
    if (data?.error) return data.error;
    if (err.message) return err.message;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const authApi = {
  register: (dto: RegisterDto) =>
    api.post<AuthResponse>('/auth/register', dto).then((r) => r.data),
  login: (dto: LoginDto) =>
    api.post<AuthResponse>('/auth/login', dto).then((r) => r.data),
  me: () => api.get<UserDto>('/auth/me').then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const usersApi = {
  list: () => api.get<UserDto[]>('/users').then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface ProjectMemberDto {
  id: string;
  role: Role;
  user: UserDto;
}

export const projectsApi = {
  list: () => api.get<ProjectDto[]>('/projects').then((r) => r.data),
  get: (key: string) =>
    api.get<ProjectDto>(`/projects/${key}`).then((r) => r.data),
  create: (dto: CreateProjectDto) =>
    api.post<ProjectDto>('/projects', dto).then((r) => r.data),
  statuses: (key: string) =>
    api.get<StatusDto[]>(`/projects/${key}/statuses`).then((r) => r.data),
  labels: (key: string) =>
    api.get<LabelDto[]>(`/projects/${key}/labels`).then((r) => r.data),
  createLabel: (key: string, dto: { name: string; color: string }) =>
    api.post<LabelDto>(`/projects/${key}/labels`, dto).then((r) => r.data),
  members: (key: string) =>
    api
      .get<ProjectMemberDto[]>(`/projects/${key}/members`)
      .then((r) => r.data),
  addMember: (key: string, dto: { email: string; role: Role }) =>
    api
      .post<ProjectMemberDto>(`/projects/${key}/members`, dto)
      .then((r) => r.data),
  board: (key: string, sprintId?: string) =>
    api
      .get<BoardDto>(`/projects/${key}/board`, {
        params: sprintId ? { sprintId } : undefined,
      })
      .then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export interface IssueFilters {
  sprintId?: string;
  statusId?: string;
  assigneeId?: string;
  type?: string;
  search?: string;
}

export const issuesApi = {
  list: (key: string, filters?: IssueFilters) =>
    api
      .get<IssueSummaryDto[]>(`/projects/${key}/issues`, { params: filters })
      .then((r) => r.data),
  create: (key: string, dto: CreateIssueDto) =>
    api
      .post<IssueDetailDto>(`/projects/${key}/issues`, dto)
      .then((r) => r.data),
  get: (issueKey: string) =>
    api.get<IssueDetailDto>(`/issues/${issueKey}`).then((r) => r.data),
  update: (issueKey: string, dto: UpdateIssueDto) =>
    api.patch<IssueDetailDto>(`/issues/${issueKey}`, dto).then((r) => r.data),
  move: (issueKey: string, dto: MoveIssueDto) =>
    api
      .post<IssueSummaryDto>(`/issues/${issueKey}/move`, dto)
      .then((r) => r.data),
  remove: (issueKey: string) =>
    api.delete<void>(`/issues/${issueKey}`).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export const commentsApi = {
  list: (issueKey: string) =>
    api.get<CommentDto[]>(`/issues/${issueKey}/comments`).then((r) => r.data),
  create: (issueKey: string, dto: CreateCommentDto) =>
    api
      .post<CommentDto>(`/issues/${issueKey}/comments`, dto)
      .then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Sprints
// ---------------------------------------------------------------------------

export const sprintsApi = {
  list: (key: string) =>
    api.get<SprintDto[]>(`/projects/${key}/sprints`).then((r) => r.data),
  create: (key: string, dto: CreateSprintDto) =>
    api.post<SprintDto>(`/projects/${key}/sprints`, dto).then((r) => r.data),
  start: (id: string) =>
    api.post<SprintDto>(`/sprints/${id}/start`).then((r) => r.data),
  complete: (id: string) =>
    api.post<SprintDto>(`/sprints/${id}/complete`).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notificationsApi = {
  list: () => api.get<NotificationDto[]>('/notifications').then((r) => r.data),
  markRead: (id: string) =>
    api.post<void>(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () =>
    api.post<void>('/notifications/read-all').then((r) => r.data),
};
