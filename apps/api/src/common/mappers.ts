// Mappers: convert Prisma rows -> @tasku/types DTO shapes.
// These intentionally never leak `passwordHash` and coerce Date -> ISO string.

import type {
  UserDto,
  ProjectDto,
  StatusDto,
  LabelDto,
  ComponentDto,
  IssueSummaryDto,
  IssueDetailDto,
  CommentDto,
  ActivityDto,
  SprintDto,
  NotificationDto,
  TeamSummaryDto,
  TeamDto,
  TeamMemberDto,
  BoardSummaryDto,
  Role,
  AttachmentDto,
  IssueLinkDto,
  WorklogDto,
  SavedFilterDto,
  IssueFilterCriteria,
  CustomFieldDefDto,
  CustomFieldEntryDto,
  VersionSummaryDto,
  VersionDto,
  DeliveryProgress,
  DeliveryRollupDto,
} from '@tasku/types';

const iso = (d: Date | string | null | undefined): string =>
  d instanceof Date ? d.toISOString() : (d as string);

export function toUserDto(u: any): UserDto {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl ?? null,
  };
}

export function toUserDtoOrNull(u: any): UserDto | null {
  return u ? toUserDto(u) : null;
}

export function toProjectDto(p: any, role?: Role): ProjectDto {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description ?? null,
    lead: toUserDtoOrNull(p.lead),
    ...(role ? { role } : {}),
    createdAt: iso(p.createdAt),
  };
}

export function toStatusDto(s: any): StatusDto {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    order: s.order,
    wipLimit: s.wipLimit ?? null,
  };
}

export function toLabelDto(l: any): LabelDto {
  return {
    id: l.id,
    name: l.name,
    color: l.color,
  };
}

export function toComponentDto(c: any): ComponentDto {
  return {
    id: c.id,
    name: c.name,
  };
}

// Labels can come through as `IssueLabel[]` (join rows with `.label`) or as
// already-resolved `Label[]`. Handle both.
function resolveLabels(issue: any): LabelDto[] {
  const rows = issue.labels ?? [];
  return rows.map((row: any) => toLabelDto(row.label ?? row));
}

function resolveComponents(issue: any): ComponentDto[] {
  const rows = issue.components ?? [];
  return rows.map((row: any) => toComponentDto(row.component ?? row));
}

export function toTeamSummaryDto(t: any): TeamSummaryDto {
  return {
    id: t.id,
    name: t.name,
    color: t.color,
  };
}

export function toTeamSummaryDtoOrNull(t: any): TeamSummaryDto | null {
  return t ? toTeamSummaryDto(t) : null;
}

export function toTeamMemberDto(m: any): TeamMemberDto {
  return {
    user: toUserDto(m.user),
    role: m.role,
  };
}

export function toTeamDto(t: any, issueCount?: number): TeamDto {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? null,
    color: t.color,
    members: (t.members ?? []).map(toTeamMemberDto),
    ...(issueCount !== undefined ? { issueCount } : {}),
  };
}

export function toBoardSummaryDto(b: any, isStarred = false): BoardSummaryDto {
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    teamId: b.teamId ?? null,
    isDefault: b.isDefault,
    swimlaneBy: b.swimlaneBy,
    isStarred,
  };
}

export function toIssueSummaryDto(i: any): IssueSummaryDto {
  return {
    id: i.id,
    key: i.key,
    type: i.type,
    title: i.title,
    statusId: i.statusId,
    priority: i.priority,
    assignee: toUserDtoOrNull(i.assignee),
    storyPoints: i.storyPoints ?? null,
    rank: i.rank,
    sprintId: i.sprintId ?? null,
    parentId: i.parentId ?? null,
    labels: resolveLabels(i),
    team: toTeamSummaryDtoOrNull(i.team),
    startDate: i.startDate ? iso(i.startDate) : null,
    dueDate: i.dueDate ? iso(i.dueDate) : null,
  };
}

export function toCommentDto(c: any): CommentDto {
  return {
    id: c.id,
    body: c.body,
    author: toUserDto(c.author),
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

export function toActivityDto(a: any): ActivityDto {
  return {
    id: a.id,
    field: a.field,
    oldValue: a.oldValue ?? null,
    newValue: a.newValue ?? null,
    actor: toUserDto(a.actor),
    createdAt: iso(a.createdAt),
  };
}

export function toAttachmentDto(a: any): AttachmentDto {
  return {
    id: a.id,
    filename: a.filename,
    url: a.url,
    mimeType: a.mimeType,
    size: a.size,
    uploadedAt: iso(a.uploadedAt),
  };
}

export function toWorklogDto(w: any): WorklogDto {
  return {
    id: w.id,
    user: toUserDto(w.user),
    minutes: w.minutes,
    comment: w.comment ?? null,
    startedAt: iso(w.startedAt),
    createdAt: iso(w.createdAt),
  };
}

/**
 * Map a single IssueLink row to an IssueLinkDto. `direction` indicates whether
 * this issue is the source ('outward') or target ('inward'); `other` is the
 * issue on the opposite end (already summary-shaped/included).
 */
export function toIssueLinkDto(
  link: any,
  direction: 'outward' | 'inward',
  other: any,
): IssueLinkDto {
  return {
    id: link.id,
    type: link.type,
    direction,
    issue: toIssueSummaryDto(other),
  };
}

export function toSavedFilterDto(f: any): SavedFilterDto {
  return {
    id: f.id,
    name: f.name,
    criteria: (f.criteria ?? {}) as IssueFilterCriteria,
    shared: f.shared,
    owner: toUserDto(f.owner),
  };
}

/**
 * Build the combined `links` array for an issue detail: outLinks become
 * 'outward' (target on the other end), inLinks become 'inward' (source on the
 * other end). Requires `outLinks.target` and `inLinks.source` to be included.
 */
function resolveLinks(i: any): IssueLinkDto[] {
  const out = (i.outLinks ?? []).map((l: any) =>
    toIssueLinkDto(l, 'outward', l.target),
  );
  const inward = (i.inLinks ?? []).map((l: any) =>
    toIssueLinkDto(l, 'inward', l.source),
  );
  return [...out, ...inward];
}

export function toCustomFieldDefDto(d: any): CustomFieldDefDto {
  return {
    id: d.id,
    name: d.name,
    type: d.type,
    options: (d.options as string[] | null) ?? null,
    required: d.required,
    order: d.order,
  };
}

/**
 * Every project custom-field def paired with this issue's value (null when
 * unset). Requires `project.customFields` and `customValues` to be included.
 */
function resolveCustomFields(i: any): CustomFieldEntryDto[] {
  const defs = i.project?.customFields ?? [];
  const values: any[] = i.customValues ?? [];
  return defs.map((def: any) => ({
    field: toCustomFieldDefDto(def),
    value: values.find((v) => v.fieldId === def.id)?.value ?? null,
  }));
}

export function toVersionSummaryDto(v: any): VersionSummaryDto {
  return {
    id: v.id,
    name: v.name,
    released: v.released,
    releaseDate: v.releaseDate ? iso(v.releaseDate) : null,
  };
}

/** Aggregate a set of issues by status category (delivery progress). */
export function deliveryFromIssues(issues: any[]): DeliveryProgress {
  const roll: DeliveryProgress = {
    total: issues.length,
    todo: 0,
    inProgress: 0,
    done: 0,
  };
  for (const iss of issues) {
    const cat = iss.status?.category;
    if (cat === 'DONE') roll.done++;
    else if (cat === 'IN_PROGRESS') roll.inProgress++;
    else roll.todo++;
  }
  return roll;
}

export function toVersionDto(v: any): VersionDto {
  return {
    ...toVersionSummaryDto(v),
    description: v.description ?? null,
    startDate: v.startDate ? iso(v.startDate) : null,
    progress: deliveryFromIssues(v.issues ?? []),
  };
}

/** Delivery rollup for an issue: aggregate its delivery-linked issues. */
function resolveDelivery(i: any): DeliveryRollupDto | null {
  const isDelivery = (t: string) => t === 'DELIVERS' || t === 'DELIVERED_BY';
  const linked: any[] = [];
  for (const l of i.outLinks ?? []) if (isDelivery(l.type)) linked.push(l.target);
  for (const l of i.inLinks ?? []) if (isDelivery(l.type)) linked.push(l.source);
  if (!linked.length) return null;
  return deliveryFromIssues(linked);
}

export function toIssueDetailDto(
  i: any,
  projectKey: string,
  currentUserId?: string,
): IssueDetailDto {
  const watchers = (i.watchers ?? []).map((w: any) => toUserDto(w.user));
  const worklogs = (i.worklogs ?? []).map(toWorklogDto);
  const timeSpent = (i.worklogs ?? []).reduce(
    (sum: number, w: any) => sum + (w.minutes ?? 0),
    0,
  );
  return {
    ...toIssueSummaryDto(i),
    description: i.description ?? null,
    reporter: toUserDto(i.reporter),
    components: resolveComponents(i),
    comments: (i.comments ?? []).map(toCommentDto),
    activities: (i.activities ?? []).map(toActivityDto),
    children: (i.children ?? []).map(toIssueSummaryDto),
    parent: i.parent ? toIssueSummaryDto(i.parent) : null,
    attachments: (i.attachments ?? []).map(toAttachmentDto),
    links: resolveLinks(i),
    watchers,
    watching: currentUserId
      ? (i.watchers ?? []).some((w: any) => w.userId === currentUserId)
      : false,
    worklogs,
    timeSpent,
    originalEstimate: i.originalEstimate ?? null,
    customFields: resolveCustomFields(i),
    versions: (i.versions ?? []).map(toVersionSummaryDto),
    delivery: resolveDelivery(i),
    projectKey,
    createdAt: iso(i.createdAt),
    updatedAt: iso(i.updatedAt),
  };
}

export function toSprintDto(s: any): SprintDto {
  return {
    id: s.id,
    name: s.name,
    goal: s.goal ?? null,
    state: s.state,
    startDate: s.startDate ? iso(s.startDate) : null,
    endDate: s.endDate ? iso(s.endDate) : null,
  };
}

export function toNotificationDto(n: any): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    issueKey: n.issueKey,
    message: n.message,
    read: n.read,
    createdAt: iso(n.createdAt),
  };
}
