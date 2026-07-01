// Shared contract between @tasku/api and @tasku/web.
// Enums mirror the Prisma schema; DTOs describe API payloads.

export type Role = 'ADMIN' | 'MEMBER' | 'VIEWER';
export type StatusCategory = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type IssueType = 'EPIC' | 'STORY' | 'TASK' | 'BUG' | 'SUBTASK';
export type Priority = 'LOWEST' | 'LOW' | 'MEDIUM' | 'HIGH' | 'HIGHEST';
export type SprintState = 'FUTURE' | 'ACTIVE' | 'CLOSED';
export type LinkType = 'BLOCKS' | 'IS_BLOCKED_BY' | 'RELATES_TO' | 'DUPLICATES';
export type TeamRole = 'LEAD' | 'MEMBER';
export type BoardType = 'KANBAN' | 'SCRUM';
export type BoardSwimlane = 'NONE' | 'ASSIGNEE' | 'EPIC' | 'TEAM' | 'PRIORITY';
export type ThemeMode = 'light' | 'dark' | 'system';
export type NotificationType =
  | 'ASSIGNED'
  | 'MENTIONED'
  | 'COMMENTED'
  | 'STATUS_CHANGED';

export const ISSUE_TYPES: IssueType[] = [
  'EPIC',
  'STORY',
  'TASK',
  'BUG',
  'SUBTASK',
];
export const PRIORITIES: Priority[] = [
  'LOWEST',
  'LOW',
  'MEDIUM',
  'HIGH',
  'HIGHEST',
];

// ---------------------------------------------------------------------------
// Entities (API response shapes)
// ---------------------------------------------------------------------------

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: UserDto;
}

export interface ProjectDto {
  id: string;
  key: string;
  name: string;
  description: string | null;
  lead: UserDto | null;
  role?: Role;
  createdAt: string;
}

export interface StatusDto {
  id: string;
  name: string;
  category: StatusCategory;
  order: number;
  wipLimit: number | null;
}

export interface LabelDto {
  id: string;
  name: string;
  color: string;
}

export interface ComponentDto {
  id: string;
  name: string;
}

export interface TeamSummaryDto {
  id: string;
  name: string;
  color: string;
}

export interface IssueSummaryDto {
  id: string;
  key: string;
  type: IssueType;
  title: string;
  statusId: string;
  priority: Priority;
  assignee: UserDto | null;
  storyPoints: number | null;
  rank: string;
  sprintId: string | null;
  parentId: string | null;
  labels: LabelDto[];
  team: TeamSummaryDto | null;
  startDate: string | null;
  dueDate: string | null;
}

export interface CommentDto {
  id: string;
  body: string;
  author: UserDto;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityDto {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  actor: UserDto;
  createdAt: string;
}

export interface AttachmentDto {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface IssueLinkDto {
  id: string;
  type: LinkType;
  direction: 'outward' | 'inward';
  issue: IssueSummaryDto; // the issue on the other end
}

export interface WorklogDto {
  id: string;
  user: UserDto;
  minutes: number;
  comment: string | null;
  startedAt: string;
  createdAt: string;
}

export interface IssueDetailDto extends IssueSummaryDto {
  description: string | null;
  reporter: UserDto;
  components: ComponentDto[];
  comments: CommentDto[];
  activities: ActivityDto[];
  children: IssueSummaryDto[];
  parent: IssueSummaryDto | null;
  attachments: AttachmentDto[];
  links: IssueLinkDto[];
  watchers: UserDto[];
  watching: boolean; // is the current user watching?
  worklogs: WorklogDto[];
  originalEstimate: number | null; // minutes
  timeSpent: number; // minutes (sum of worklogs)
  projectKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface SprintDto {
  id: string;
  name: string;
  goal: string | null;
  state: SprintState;
  startDate: string | null;
  endDate: string | null;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  issueKey: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface BoardColumnDto {
  status: StatusDto;
  issues: IssueSummaryDto[];
}

export interface BoardSummaryDto {
  id: string;
  name: string;
  type: BoardType;
  teamId: string | null;
  isDefault: boolean;
  swimlaneBy: BoardSwimlane;
}

export interface BoardFilter {
  assigneeIds?: string[];
  labelIds?: string[];
  types?: IssueType[];
  priorities?: Priority[];
}

export interface BoardDto {
  project: ProjectDto;
  columns: BoardColumnDto[];
  activeSprint: SprintDto | null;
  board?: BoardSummaryDto | null;
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export interface TeamMemberDto {
  user: UserDto;
  role: TeamRole;
}

export interface TeamDto {
  id: string;
  name: string;
  description: string | null;
  color: string;
  members: TeamMemberDto[];
  issueCount?: number;
}

// ---------------------------------------------------------------------------
// Timeline (roadmap)
// ---------------------------------------------------------------------------

export interface TimelineRowDto {
  issue: IssueSummaryDto; // an epic, or a standalone issue
  children: IssueSummaryDto[];
}

export interface TimelineDto {
  rows: TimelineRowDto[];
  unscheduled: IssueSummaryDto[]; // issues with no start/due date
  rangeStart: string | null;
  rangeEnd: string | null;
}

// ---------------------------------------------------------------------------
// Overview (project dashboard)
// ---------------------------------------------------------------------------

export interface CountBucket {
  key: string;
  label: string;
  count: number;
}

export interface WorkloadEntryDto {
  user: UserDto;
  count: number;
  points: number;
}

export interface OverviewDto {
  project: ProjectDto;
  totalIssues: number;
  byStatusCategory: CountBucket[]; // TODO / IN_PROGRESS / DONE
  byType: CountBucket[];
  byPriority: CountBucket[];
  points: { total: number; done: number };
  activeSprint: SprintDto | null;
  recentActivity: ActivityDto[];
  workload: WorkloadEntryDto[];
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

export interface RegisterDto {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface CreateProjectDto {
  key: string;
  name: string;
  description?: string;
}

export interface CreateIssueDto {
  type: IssueType;
  title: string;
  description?: string;
  priority?: Priority;
  assigneeId?: string;
  parentId?: string;
  sprintId?: string;
  storyPoints?: number;
  statusId?: string;
  labelIds?: string[];
  teamId?: string;
  startDate?: string;
  dueDate?: string;
}

export interface UpdateIssueDto {
  title?: string;
  description?: string;
  type?: IssueType;
  priority?: Priority;
  assigneeId?: string | null;
  statusId?: string;
  parentId?: string | null;
  sprintId?: string | null;
  storyPoints?: number | null;
  labelIds?: string[];
  teamId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  originalEstimate?: number | null;
}

export interface CreateSubtaskDto {
  title: string;
  assigneeId?: string;
}

export interface CreateTeamDto {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateTeamDto {
  name?: string;
  description?: string;
  color?: string;
}

export interface AddTeamMemberDto {
  userId: string;
  role?: TeamRole;
}

export interface CreateBoardDto {
  name: string;
  type?: BoardType;
  teamId?: string | null;
  filter?: BoardFilter;
  swimlaneBy?: BoardSwimlane;
}

export interface UpdateBoardDto {
  name?: string;
  type?: BoardType;
  teamId?: string | null;
  filter?: BoardFilter;
  swimlaneBy?: BoardSwimlane;
}

// ---------------------------------------------------------------------------
// Project settings (statuses / workflow, components, members)
// ---------------------------------------------------------------------------

export interface CreateStatusDto {
  name: string;
  category: StatusCategory;
}

export interface UpdateStatusDto {
  name?: string;
  category?: StatusCategory;
  wipLimit?: number | null;
}

export interface ReorderStatusesDto {
  statusIds: string[]; // new order
}

export interface CreateComponentDto {
  name: string;
}

export interface UpdateComponentDto {
  name: string;
}

export interface UpdateMemberRoleDto {
  role: Role;
}

// Query params for the list view
export interface IssueListQuery {
  sprintId?: string;
  statusId?: string;
  assigneeId?: string;
  teamId?: string;
  type?: IssueType;
  parentId?: string;
  search?: string;
  orderBy?: 'rank' | 'priority' | 'createdAt' | 'updatedAt' | 'dueDate' | 'key';
  order?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Search & saved filters
// ---------------------------------------------------------------------------

export interface IssueFilterCriteria {
  text?: string;
  projectKey?: string;
  statusCategories?: StatusCategory[];
  assigneeIds?: string[];
  reporterIds?: string[];
  types?: IssueType[];
  priorities?: Priority[];
  teamIds?: string[];
  labelIds?: string[];
}

export interface SearchResultDto {
  issues: IssueSummaryDto[];
  total: number;
}

export interface SavedFilterDto {
  id: string;
  name: string;
  criteria: IssueFilterCriteria;
  shared: boolean;
  owner: UserDto;
}

export interface SaveFilterDto {
  name: string;
  criteria: IssueFilterCriteria;
  shared?: boolean;
}

// ---------------------------------------------------------------------------
// Links, attachments, watchers, worklogs
// ---------------------------------------------------------------------------

export interface CreateLinkDto {
  type: LinkType;
  targetKey: string; // the issue to link to
}

export interface CreateWorklogDto {
  minutes: number;
  comment?: string;
  startedAt?: string;
}

// ---------------------------------------------------------------------------
// Bulk operations (List view)
// ---------------------------------------------------------------------------

export interface BulkUpdateDto {
  issueKeys: string[];
  changes: {
    statusId?: string;
    assigneeId?: string | null;
    priority?: Priority;
    teamId?: string | null;
    sprintId?: string | null;
    addLabelIds?: string[];
    removeLabelIds?: string[];
  };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface VelocityPointDto {
  sprintId: string;
  sprintName: string;
  committed: number; // points planned
  completed: number; // points done
}

export interface BurndownPointDto {
  date: string;
  remaining: number; // points remaining (ideal vs actual)
  ideal: number;
}

export interface BurndownDto {
  sprint: SprintDto | null;
  totalPoints: number;
  points: BurndownPointDto[];
}

export interface CumulativeFlowPointDto {
  date: string;
  todo: number;
  inProgress: number;
  done: number;
}

export interface CreatedResolvedPointDto {
  date: string;
  created: number;
  resolved: number;
}

export interface ReportsDto {
  velocity: VelocityPointDto[];
  burndown: BurndownDto;
  cumulativeFlow: CumulativeFlowPointDto[];
  createdVsResolved: CreatedResolvedPointDto[];
}

export interface MoveIssueDto {
  statusId: string;
  beforeId?: string | null;
  afterId?: string | null;
}

export interface CreateCommentDto {
  body: string;
}

export interface CreateSprintDto {
  name: string;
  goal?: string;
}

// ---------------------------------------------------------------------------
// WebSocket events
// ---------------------------------------------------------------------------

export type WsEvent =
  | { type: 'issue.created'; projectKey: string; issue: IssueSummaryDto }
  | { type: 'issue.updated'; projectKey: string; issue: IssueSummaryDto }
  | { type: 'issue.moved'; projectKey: string; issue: IssueSummaryDto }
  | { type: 'comment.created'; projectKey: string; issueKey: string }
  | { type: 'sprint.started'; projectKey: string; sprintId: string };
