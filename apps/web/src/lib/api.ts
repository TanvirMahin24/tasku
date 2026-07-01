import axios, { type AxiosInstance } from 'axios';
import type {
  AddTeamMemberDto,
  AttachmentDto,
  AuthResponse,
  BoardDto,
  BoardSummaryDto,
  BulkUpdateDto,
  CommentDto,
  ComponentDto,
  CreateBoardDto,
  CreateCommentDto,
  CreateComponentDto,
  CreateIssueDto,
  CreateLinkDto,
  CreateProjectDto,
  CreateSprintDto,
  CreateStatusDto,
  CreateSubtaskDto,
  CreateTeamDto,
  CreateWorklogDto,
  CreateCustomFieldDto,
  CreateVersionDto,
  CustomFieldDefDto,
  CustomFieldValue,
  DashboardDto,
  UpdateVersionDto,
  VersionDto,
  IssueDetailDto,
  IssueFilterCriteria,
  IssueLinkDto,
  IssueListQuery,
  IssueSummaryDto,
  LabelDto,
  LoginDto,
  MoveIssueDto,
  NotificationDto,
  OverviewDto,
  ProjectDto,
  RegisterDto,
  ReportsDto,
  Role,
  SaveFilterDto,
  SavedFilterDto,
  SearchResultDto,
  SprintDto,
  StatusDto,
  TeamDto,
  TimelineDto,
  UpdateBoardDto,
  UpdateComponentDto,
  UpdateCustomFieldDto,
  UpdateIssueDto,
  UpdateMemberRoleDto,
  UpdateStatusDto,
  UpdateTeamDto,
  UserDto,
  WorklogDto,
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
  recommended: () =>
    api.get<ProjectDto[]>('/projects/recommended').then((r) => r.data),
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
  updateMemberRole: (key: string, userId: string, dto: UpdateMemberRoleDto) =>
    api
      .patch<ProjectMemberDto>(`/projects/${key}/members/${userId}`, dto)
      .then((r) => r.data),
  removeMember: (key: string, userId: string) =>
    api.delete<void>(`/projects/${key}/members/${userId}`).then((r) => r.data),
  components: (key: string) =>
    api.get<ComponentDto[]>(`/projects/${key}/components`).then((r) => r.data),
  createComponent: (key: string, dto: CreateComponentDto) =>
    api
      .post<ComponentDto>(`/projects/${key}/components`, dto)
      .then((r) => r.data),
  board: (key: string, sprintId?: string) =>
    api
      .get<BoardDto>(`/projects/${key}/board`, {
        params: sprintId ? { sprintId } : undefined,
      })
      .then((r) => r.data),
  timeline: (key: string) =>
    api.get<TimelineDto>(`/projects/${key}/timeline`).then((r) => r.data),
  overview: (key: string) =>
    api.get<OverviewDto>(`/projects/${key}/overview`).then((r) => r.data),
  reports: (key: string) =>
    api.get<ReportsDto>(`/projects/${key}/reports`).then((r) => r.data),
  bulkUpdate: (key: string, dto: BulkUpdateDto) =>
    api
      .post<{ updated: number }>(`/projects/${key}/issues/bulk`, dto)
      .then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Statuses (workflow) — project-scoped create/reorder + id-scoped patch/delete
// ---------------------------------------------------------------------------

export const statusesApi = {
  create: (key: string, dto: CreateStatusDto) =>
    api
      .post<StatusDto>(`/projects/${key}/statuses`, dto)
      .then((r) => r.data),
  update: (id: string, dto: UpdateStatusDto) =>
    api.patch<StatusDto>(`/statuses/${id}`, dto).then((r) => r.data),
  remove: (id: string) =>
    api.delete<void>(`/statuses/${id}`).then((r) => r.data),
  reorder: (key: string, statusIds: string[]) =>
    api
      .post<StatusDto[]>(`/projects/${key}/statuses/reorder`, { statusIds })
      .then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export const componentsApi = {
  update: (id: string, dto: UpdateComponentDto) =>
    api.patch<ComponentDto>(`/components/${id}`, dto).then((r) => r.data),
  remove: (id: string) =>
    api.delete<void>(`/components/${id}`).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export const teamsApi = {
  list: () => api.get<TeamDto[]>('/teams').then((r) => r.data),
  get: (id: string) => api.get<TeamDto>(`/teams/${id}`).then((r) => r.data),
  create: (dto: CreateTeamDto) =>
    api.post<TeamDto>('/teams', dto).then((r) => r.data),
  update: (id: string, dto: UpdateTeamDto) =>
    api.patch<TeamDto>(`/teams/${id}`, dto).then((r) => r.data),
  remove: (id: string) =>
    api.delete<void>(`/teams/${id}`).then((r) => r.data),
  addMember: (id: string, dto: AddTeamMemberDto) =>
    api.post<TeamDto>(`/teams/${id}/members`, dto).then((r) => r.data),
  removeMember: (id: string, userId: string) =>
    api
      .delete<TeamDto>(`/teams/${id}/members/${userId}`)
      .then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

export const boardsApi = {
  list: (key: string) =>
    api.get<BoardSummaryDto[]>(`/projects/${key}/boards`).then((r) => r.data),
  create: (key: string, dto: CreateBoardDto) =>
    api
      .post<BoardSummaryDto>(`/projects/${key}/boards`, dto)
      .then((r) => r.data),
  get: (boardId: string) =>
    api.get<BoardDto>(`/boards/${boardId}/board`).then((r) => r.data),
  update: (boardId: string, dto: UpdateBoardDto) =>
    api.patch<BoardSummaryDto>(`/boards/${boardId}`, dto).then((r) => r.data),
  remove: (boardId: string) =>
    api.delete<void>(`/boards/${boardId}`).then((r) => r.data),
  star: (boardId: string) =>
    api
      .post<{ starred: boolean }>(`/boards/${boardId}/star`)
      .then((r) => r.data),
  unstar: (boardId: string) =>
    api
      .delete<{ starred: boolean }>(`/boards/${boardId}/star`)
      .then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Custom fields
// ---------------------------------------------------------------------------

export const customFieldsApi = {
  list: (key: string) =>
    api
      .get<CustomFieldDefDto[]>(`/projects/${key}/custom-fields`)
      .then((r) => r.data),
  create: (key: string, dto: CreateCustomFieldDto) =>
    api
      .post<CustomFieldDefDto>(`/projects/${key}/custom-fields`, dto)
      .then((r) => r.data),
  update: (id: string, dto: UpdateCustomFieldDto) =>
    api
      .patch<CustomFieldDefDto>(`/custom-fields/${id}`, dto)
      .then((r) => r.data),
  remove: (id: string) =>
    api.delete<void>(`/custom-fields/${id}`).then((r) => r.data),
  setValue: (issueKey: string, fieldId: string, value: CustomFieldValue) =>
    api
      .put<{ success: boolean }>(`/issues/${issueKey}/fields/${fieldId}`, {
        value,
      })
      .then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Versions / releases
// ---------------------------------------------------------------------------

export const versionsApi = {
  list: (key: string) =>
    api.get<VersionDto[]>(`/projects/${key}/versions`).then((r) => r.data),
  create: (key: string, dto: CreateVersionDto) =>
    api
      .post<VersionDto>(`/projects/${key}/versions`, dto)
      .then((r) => r.data),
  update: (id: string, dto: UpdateVersionDto) =>
    api.patch<VersionDto>(`/versions/${id}`, dto).then((r) => r.data),
  remove: (id: string) =>
    api.delete<void>(`/versions/${id}`).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const dashboardApi = {
  get: () => api.get<DashboardDto>('/dashboard').then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export type IssueFilters = IssueListQuery;

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
  createSubtask: (issueKey: string, dto: CreateSubtaskDto) =>
    api
      .post<IssueDetailDto>(`/issues/${issueKey}/subtasks`, dto)
      .then((r) => r.data),

  // --- Links ---
  addLink: (issueKey: string, dto: CreateLinkDto) =>
    api
      .post<IssueLinkDto>(`/issues/${issueKey}/links`, dto)
      .then((r) => r.data),
  removeLink: (linkId: string) =>
    api.delete<void>(`/links/${linkId}`).then((r) => r.data),

  // --- Attachments ---
  uploadAttachment: (issueKey: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    // Let the browser set the multipart boundary; clear the JSON default.
    return api
      .post<AttachmentDto>(`/issues/${issueKey}/attachments`, form, {
        headers: { 'Content-Type': undefined },
      })
      .then((r) => r.data);
  },
  deleteAttachment: (attachmentId: string) =>
    api.delete<void>(`/attachments/${attachmentId}`).then((r) => r.data),

  // --- Watchers ---
  watch: (issueKey: string) =>
    api.post<void>(`/issues/${issueKey}/watch`).then((r) => r.data),
  unwatch: (issueKey: string) =>
    api.delete<void>(`/issues/${issueKey}/watch`).then((r) => r.data),

  // --- Worklogs ---
  addWorklog: (issueKey: string, dto: CreateWorklogDto) =>
    api
      .post<WorklogDto>(`/issues/${issueKey}/worklogs`, dto)
      .then((r) => r.data),
  deleteWorklog: (worklogId: string) =>
    api.delete<void>(`/worklogs/${worklogId}`).then((r) => r.data),
};

/**
 * Fetch an attachment's raw bytes (with auth) and wrap them in an object URL,
 * suitable for <img src> previews and download links (which can't carry the
 * Bearer header themselves). Callers should URL.revokeObjectURL when done.
 */
export async function fetchAttachmentBlobUrl(
  attachmentId: string,
): Promise<string> {
  const res = await api.get<Blob>(`/attachments/${attachmentId}/raw`, {
    responseType: 'blob',
  });
  return URL.createObjectURL(res.data);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** Serialize filter criteria to query params (arrays as repeated keys). */
function criteriaToParams(c: IssueFilterCriteria): URLSearchParams {
  const params = new URLSearchParams();
  if (c.text) params.set('text', c.text);
  if (c.projectKey) params.set('projectKey', c.projectKey);
  const arr: (keyof IssueFilterCriteria)[] = [
    'statusCategories',
    'assigneeIds',
    'reporterIds',
    'types',
    'priorities',
    'teamIds',
    'labelIds',
  ];
  for (const k of arr) {
    const v = c[k] as string[] | undefined;
    if (v && v.length) v.forEach((item) => params.append(k, item));
  }
  return params;
}

export const searchApi = {
  issues: (criteria: IssueFilterCriteria) =>
    api
      .get<SearchResultDto>('/search/issues', {
        params: criteriaToParams(criteria),
      })
      .then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Saved filters
// ---------------------------------------------------------------------------

export const filtersApi = {
  list: () => api.get<SavedFilterDto[]>('/filters').then((r) => r.data),
  create: (dto: SaveFilterDto) =>
    api.post<SavedFilterDto>('/filters', dto).then((r) => r.data),
  get: (id: string) =>
    api.get<SavedFilterDto>(`/filters/${id}`).then((r) => r.data),
  update: (id: string, dto: Partial<SaveFilterDto>) =>
    api.patch<SavedFilterDto>(`/filters/${id}`, dto).then((r) => r.data),
  remove: (id: string) =>
    api.delete<void>(`/filters/${id}`).then((r) => r.data),
  results: (id: string) =>
    api.get<SearchResultDto>(`/filters/${id}/results`).then((r) => r.data),
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
