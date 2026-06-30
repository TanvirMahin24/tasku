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

export function toBoardSummaryDto(b: any): BoardSummaryDto {
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    teamId: b.teamId ?? null,
    isDefault: b.isDefault,
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

export function toIssueDetailDto(i: any, projectKey: string): IssueDetailDto {
  return {
    ...toIssueSummaryDto(i),
    description: i.description ?? null,
    reporter: toUserDto(i.reporter),
    components: resolveComponents(i),
    comments: (i.comments ?? []).map(toCommentDto),
    activities: (i.activities ?? []).map(toActivityDto),
    children: (i.children ?? []).map(toIssueSummaryDto),
    parent: i.parent ? toIssueSummaryDto(i.parent) : null,
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
