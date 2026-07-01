// Shared contract between @tasku/api and @tasku/web.
// Enums mirror the Prisma schema; DTOs describe API payloads.

export type Role = 'ADMIN' | 'MEMBER' | 'VIEWER';
export type StatusCategory = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type IssueType = 'IDEA' | 'EPIC' | 'STORY' | 'TASK' | 'BUG' | 'SUBTASK';
export type Priority = 'LOWEST' | 'LOW' | 'MEDIUM' | 'HIGH' | 'HIGHEST';
export type SprintState = 'FUTURE' | 'ACTIVE' | 'CLOSED';
export type LinkType =
  | 'BLOCKS'
  | 'IS_BLOCKED_BY'
  | 'RELATES_TO'
  | 'DUPLICATES'
  | 'DELIVERS'
  | 'DELIVERED_BY';
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
  'IDEA',
  'EPIC',
  'STORY',
  'TASK',
  'BUG',
  'SUBTASK',
];

// Issue hierarchy rank — lower index = higher in the tree. A parent must rank
// strictly above its child. Idea > Epic > Story/Task/Bug > Subtask.
export const ISSUE_TYPE_RANK: Record<IssueType, number> = {
  IDEA: 0,
  EPIC: 1,
  STORY: 2,
  TASK: 2,
  BUG: 2,
  SUBTASK: 3,
};
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
  defaultTab: string; // space tab opened by default (e.g. 'board')
  createdAt: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  leadId?: string;
  defaultTab?: string;
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
  teams: TeamSummaryDto[];
  startDate: string | null;
  dueDate: string | null;
}

export interface CommentDto {
  id: string;
  body: string;
  author: UserDto;
  createdAt: string;
  updatedAt: string;
  parentId: string | null;
  // Present on top-level comments (one-level threads); replies omit it.
  replies?: CommentDto[];
}

// ---------------------------------------------------------------------------
// Mentions (@-mentions in descriptions, comments, replies)
// ---------------------------------------------------------------------------

export type MentionType = 'user' | 'issue' | 'knowledge' | 'board';

/** A single @-mentionable entity returned by the picker. */
export interface MentionableDto {
  type: MentionType;
  id: string;
  label: string; // primary text (name / issue key / doc title / board name)
  sublabel?: string | null; // email / issue title / doc kind / etc.
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

// ---------------------------------------------------------------------------
// Custom fields
// ---------------------------------------------------------------------------

export type CustomFieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'DATE'
  | 'CHECKBOX'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'USER'
  | 'URL';

export const CUSTOM_FIELD_TYPES: CustomFieldType[] = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DATE',
  'CHECKBOX',
  'SELECT',
  'MULTI_SELECT',
  'USER',
  'URL',
];

export interface CustomFieldDefDto {
  id: string;
  name: string;
  type: CustomFieldType;
  options: string[] | null; // choices for SELECT / MULTI_SELECT
  required: boolean;
  order: number;
}

// value shape depends on type:
//  TEXT/TEXTAREA/URL -> string, NUMBER -> number, CHECKBOX -> boolean,
//  DATE -> ISO string, SELECT/USER -> string, MULTI_SELECT -> string[].
export type CustomFieldValue =
  | string
  | number
  | boolean
  | string[]
  | null;

export interface CustomFieldEntryDto {
  field: CustomFieldDefDto;
  value: CustomFieldValue;
}

export interface CreateCustomFieldDto {
  name: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
}

export interface UpdateCustomFieldDto {
  name?: string;
  options?: string[];
  required?: boolean;
  order?: number;
}

export interface SetCustomFieldValueDto {
  value: CustomFieldValue;
}

// ---------------------------------------------------------------------------
// Versions / releases + delivery rollup
// ---------------------------------------------------------------------------

export interface DeliveryProgress {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
}

export interface VersionSummaryDto {
  id: string;
  name: string;
  released: boolean;
  releaseDate: string | null;
}

export interface VersionDto extends VersionSummaryDto {
  description: string | null;
  startDate: string | null;
  progress: DeliveryProgress;
}

export interface CreateVersionDto {
  name: string;
  description?: string;
  startDate?: string | null;
  releaseDate?: string | null;
}

export interface UpdateVersionDto {
  name?: string;
  description?: string | null;
  released?: boolean;
  startDate?: string | null;
  releaseDate?: string | null;
}

// Delivery rollup for an Idea: aggregate status of its linked delivery issues.
export type DeliveryRollupDto = DeliveryProgress;

// ---------------------------------------------------------------------------
// Dashboard ("For you") — personal, cross-project home
// ---------------------------------------------------------------------------

export interface DashboardBoardDto {
  id: string;
  name: string;
  isDefault: boolean;
  projectKey: string;
  projectName: string;
}

export interface DashboardDto {
  assignedToMe: IssueSummaryDto[];
  recentlyUpdated: IssueSummaryDto[];
  starredBoards: DashboardBoardDto[];
  projects: ProjectDto[];
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
  customFields: CustomFieldEntryDto[];
  versions: VersionSummaryDto[];
  delivery: DeliveryRollupDto | null; // set when the issue has delivery links
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
  isStarred: boolean;
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
  teamIds?: string[];
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
  teamIds?: string[];
  startDate?: string | null;
  dueDate?: string | null;
  originalEstimate?: number | null;
  fixVersionIds?: string[];
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
    teamIds?: string[];
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
  // Set to reply to a top-level comment (one-level threads).
  parentId?: string | null;
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
  | { type: 'sprint.started'; projectKey: string; sprintId: string }
  // pushed to a single user's room (not a project room)
  | { type: 'notification.created' };

// ---------------------------------------------------------------------------
// Knowledge base
// ---------------------------------------------------------------------------

export type KnowledgeType = 'FILE' | 'LINK';
export type KnowledgeLinkKind =
  | 'GOOGLE_DOC'
  | 'GOOGLE_SHEET'
  | 'GOOGLE_SLIDES'
  | 'GENERIC';

/** Where a doc surfaces from — drives the source badge on each KB card. */
export interface KnowledgeSource {
  // 'self' = owned by the KB being viewed; 'inherited' = from an ancestor issue.
  origin: 'self' | 'inherited';
  // Ancestor the doc is inherited from (when origin === 'inherited').
  issueKey?: string;
  issueTitle?: string;
  // Import provenance (independent of origin — a doc can be self + imported).
  imported: boolean;
  importedFrom?: { kind: 'team' | 'issue'; label: string } | null;
  // The imported source doc was deleted.
  importBroken?: boolean;
}

export interface KnowledgeDocDto {
  id: string;
  title: string;
  type: KnowledgeType;
  url: string | null; // LINK
  linkKind: KnowledgeLinkKind | null; // LINK
  filename: string | null; // FILE
  mimeType: string | null; // FILE
  size: number | null; // FILE
  rawUrl: string | null; // FILE stream/download url
  createdBy: UserDto;
  createdAt: string;
  source: KnowledgeSource;
  canDelete: boolean; // only docs owned by the KB being viewed are deletable here
}

export interface CreateKnowledgeLinkDto {
  title: string;
  url: string;
}

export interface ImportKnowledgeDto {
  sourceDocId: string;
}

/** A doc from another KB, offered in the import picker. */
export interface ImportableKnowledgeDocDto {
  id: string;
  title: string;
  type: KnowledgeType;
  linkKind: KnowledgeLinkKind | null;
  ownerKind: 'team' | 'issue';
  ownerLabel: string; // team name / issue key
}

// ---------------------------------------------------------------------------
// Views — saved, filtered cross-space issue tables with configurable columns
// ---------------------------------------------------------------------------

export type ViewScope = 'GLOBAL' | 'TEAM';

/** One column in a view table: a field key, optionally pinned (sticky-left). */
export interface ViewColumn {
  key: string; // standard field key OR `cf:<customFieldId>`
  pinned?: boolean;
}

export interface ViewSummaryDto {
  id: string;
  title: string;
  description: string | null;
  scope: ViewScope;
  scopeTeam: TeamSummaryDto | null;
  responsible: UserDto | null;
  teams: TeamSummaryDto[]; // associated teams (metadata)
  startDate: string | null;
  endDate: string | null;
  starred: boolean;
  archived: boolean;
  createdBy: UserDto;
  updatedAt: string;
}

export interface ViewDto extends ViewSummaryDto {
  criteria: IssueFilterCriteria;
  columns: ViewColumn[];
  canEdit: boolean;
}

export interface CreateViewDto {
  title: string;
  description?: string | null;
  scope?: ViewScope;
  teamId?: string | null; // scope team (when scope = TEAM)
  responsibleId?: string | null;
  teamIds?: string[]; // associated teams
  startDate?: string | null;
  endDate?: string | null;
  criteria?: IssueFilterCriteria;
  columns?: ViewColumn[];
}

export type UpdateViewDto = Partial<CreateViewDto>;

/** A resolved row in a view's results table. */
export interface ViewRowDto {
  id: string;
  key: string;
  type: IssueType;
  title: string;
  status: { id: string; name: string; category: StatusCategory } | null;
  priority: Priority;
  assignee: UserDto | null;
  reporter: UserDto | null;
  teams: TeamSummaryDto[];
  labels: LabelDto[];
  storyPoints: number | null;
  sprintId: string | null;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  projectKey: string;
  projectName: string;
  customValues: Record<string, CustomFieldValue>; // by custom field id
}

/** An available column offered in the view editor. */
export interface ViewFieldDto {
  key: string;
  label: string;
  kind: 'standard' | 'custom';
  projectKey?: string; // for custom fields
}

export interface ViewActivityDto {
  id: string;
  action: string;
  detail: string | null;
  actor: UserDto;
  createdAt: string;
}

/** Standard (non-custom) columns available to every view. */
export const VIEW_STANDARD_FIELDS: { key: string; label: string }[] = [
  { key: 'key', label: 'Key' },
  { key: 'type', label: 'Type' },
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'reporter', label: 'Reporter' },
  { key: 'teams', label: 'Teams' },
  { key: 'labels', label: 'Labels' },
  { key: 'storyPoints', label: 'Story points' },
  { key: 'startDate', label: 'Start date' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'project', label: 'Space' },
  { key: 'updatedAt', label: 'Updated' },
];

export const VIEW_DEFAULT_COLUMNS: ViewColumn[] = [
  { key: 'key', pinned: true },
  { key: 'title', pinned: true },
  { key: 'status' },
  { key: 'assignee' },
  { key: 'priority' },
  { key: 'teams' },
  { key: 'dueDate' },
  { key: 'project' },
];

export interface UpdateLabelDto {
  name?: string;
  color?: string;
}
