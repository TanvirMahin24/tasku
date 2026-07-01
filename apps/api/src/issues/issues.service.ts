import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  StatusCategory,
  type Prisma,
} from '@prisma/client';
import {
  ISSUE_TYPE_RANK,
  type IssueDetailDto,
  type IssueSummaryDto,
} from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { EventsService } from '../events/events.service';
import {
  toIssueDetailDto,
  toIssueSummaryDto,
} from '../common/mappers';
import { userMentionIdsFromDoc } from '../common/mentions.util';
import { rankAfter, rankBetween } from '../common/rank.util';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { MoveIssueDto } from './dto/move-issue.dto';
import { ListIssuesQuery } from './dto/list-issues.query';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { BulkUpdateDto } from './dto/bulk-update.dto';

// Prisma `include` fragments reused across reads.
const SUMMARY_INCLUDE = {
  assignee: true,
  teams: true,
  labels: { include: { label: true } },
} satisfies Prisma.IssueInclude;

const DETAIL_INCLUDE = {
  reporter: true,
  assignee: true,
  teams: true,
  labels: { include: { label: true } },
  components: { include: { component: true } },
  comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
  activities: { include: { actor: true }, orderBy: { createdAt: 'desc' } },
  children: { include: SUMMARY_INCLUDE, orderBy: { rank: 'asc' } },
  parent: { include: SUMMARY_INCLUDE },
  attachments: { orderBy: { uploadedAt: 'desc' } },
  outLinks: {
    include: { target: { include: { ...SUMMARY_INCLUDE, status: true } } },
  },
  inLinks: {
    include: { source: { include: { ...SUMMARY_INCLUDE, status: true } } },
  },
  watchers: { include: { user: true } },
  worklogs: { include: { user: true }, orderBy: { startedAt: 'desc' } },
  customValues: true,
  versions: true,
  project: {
    include: {
      customFields: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
    },
  },
} satisfies Prisma.IssueInclude;

// Priority -> numeric weight for list ordering (HIGHEST first when desc).
const PRIORITY_WEIGHT: Record<string, number> = {
  LOWEST: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  HIGHEST: 4,
};

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly events: EventsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Hierarchy (Idea > Epic > Story/Task/Bug > Subtask): a parent must rank
  // strictly above its child.
  // ---------------------------------------------------------------------------
  private rankOf(type: string): number {
    return ISSUE_TYPE_RANK[type as keyof typeof ISSUE_TYPE_RANK];
  }

  private assertRank(parentType: string, childType: string): void {
    if (this.rankOf(parentType) >= this.rankOf(childType)) {
      throw new BadRequestException(
        `A ${childType.toLowerCase()} can't be a child of a ${parentType.toLowerCase()}.`,
      );
    }
  }

  private async assertValidParent(
    parentId: string | null | undefined,
    childType: string,
  ): Promise<void> {
    if (!parentId) return;
    const parent = await this.prisma.issue.findUnique({
      where: { id: parentId },
      select: { type: true },
    });
    if (!parent) throw new NotFoundException('Parent issue not found');
    this.assertRank(parent.type, childType);
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------
  async create(
    key: string,
    dto: CreateIssueDto,
    userId: string,
  ): Promise<IssueDetailDto> {
    const project = await this.membership.getProjectForMember(key, userId);

    await this.assertValidParent(dto.parentId, dto.type);

    // Resolve target status: explicit, else the first TODO column, else any.
    const statusId = await this.resolveCreateStatus(project.id, dto.statusId);

    // Rank at the bottom of the target column.
    const last = await this.prisma.issue.findFirst({
      where: { projectId: project.id, statusId },
      orderBy: { rank: 'desc' },
      select: { rank: true },
    });
    const rank = rankAfter(last?.rank);

    const created = await this.prisma.$transaction(async (tx) => {
      // Per-project monotonic sequence -> key.
      const bumped = await tx.project.update({
        where: { id: project.id },
        data: { issueSeq: { increment: 1 } },
        select: { issueSeq: true, key: true },
      });
      const seq = bumped.issueSeq;

      const issue = await tx.issue.create({
        data: {
          projectId: project.id,
          key: `${bumped.key}-${seq}`,
          seq,
          type: dto.type,
          title: dto.title,
          description: dto.description ?? null,
          statusId,
          priority: dto.priority ?? undefined,
          reporterId: userId,
          assigneeId: dto.assigneeId ?? null,
          parentId: dto.parentId ?? null,
          sprintId: dto.sprintId ?? null,
          storyPoints: dto.storyPoints ?? null,
          teams: dto.teamIds?.length
            ? { connect: dto.teamIds.map((id) => ({ id })) }
            : undefined,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          rank,
          labels: dto.labelIds?.length
            ? { create: dto.labelIds.map((labelId) => ({ labelId })) }
            : undefined,
        },
      });

      await tx.activityLog.create({
        data: {
          issueId: issue.id,
          actorId: userId,
          field: 'created',
          oldValue: null,
          newValue: issue.key,
        },
      });

      // Notify a freshly-assigned assignee (unless it's the creator).
      if (issue.assigneeId && issue.assigneeId !== userId) {
        await tx.notification.create({
          data: {
            recipientId: issue.assigneeId,
            type: NotificationType.ASSIGNED,
            issueKey: issue.key,
            message: `You were assigned to ${issue.key}: ${issue.title}`,
          },
        });
      }

      return issue;
    });

    const full = await this.loadDetail(created.id);
    this.events.emit(project.key, {
      type: 'issue.created',
      projectKey: project.key,
      issue: toIssueSummaryDto(full),
    });
    if (created.assigneeId && created.assigneeId !== userId) {
      this.events.emitToUser(created.assigneeId, {
        type: 'notification.created',
      });
    }
    return toIssueDetailDto(full, project.key, userId);
  }

  private async resolveCreateStatus(
    projectId: string,
    statusId?: string,
  ): Promise<string> {
    if (statusId) {
      const status = await this.prisma.status.findFirst({
        where: { id: statusId, projectId },
      });
      if (!status) {
        throw new BadRequestException('statusId does not belong to project');
      }
      return status.id;
    }
    const todo = await this.prisma.status.findFirst({
      where: { projectId, category: StatusCategory.TODO },
      orderBy: { order: 'asc' },
    });
    const fallback =
      todo ??
      (await this.prisma.status.findFirst({
        where: { projectId },
        orderBy: { order: 'asc' },
      }));
    if (!fallback) {
      throw new BadRequestException('Project has no statuses');
    }
    return fallback.id;
  }

  // ---------------------------------------------------------------------------
  // Create subtask (child of an existing issue)
  // ---------------------------------------------------------------------------
  async createSubtask(
    issueKey: string,
    dto: CreateSubtaskDto,
    userId: string,
  ): Promise<IssueDetailDto> {
    const parent = await this.membership.getIssueForMember(issueKey, userId);
    this.assertRank(parent.type, 'SUBTASK');
    const project = await this.prisma.project.findUnique({
      where: { id: parent.projectId },
      select: { key: true },
    });

    const statusId = await this.resolveCreateStatus(parent.projectId);

    const last = await this.prisma.issue.findFirst({
      where: { projectId: parent.projectId, statusId },
      orderBy: { rank: 'desc' },
      select: { rank: true },
    });
    const rank = rankAfter(last?.rank);

    const created = await this.prisma.$transaction(async (tx) => {
      const bumped = await tx.project.update({
        where: { id: parent.projectId },
        data: { issueSeq: { increment: 1 } },
        select: { issueSeq: true, key: true },
      });
      const seq = bumped.issueSeq;

      const issue = await tx.issue.create({
        data: {
          projectId: parent.projectId,
          key: `${bumped.key}-${seq}`,
          seq,
          type: 'SUBTASK',
          title: dto.title,
          statusId,
          reporterId: userId,
          assigneeId: dto.assigneeId ?? null,
          parentId: parent.id,
          sprintId: parent.sprintId ?? null,
          rank,
        },
      });

      await tx.activityLog.create({
        data: {
          issueId: issue.id,
          actorId: userId,
          field: 'created',
          oldValue: null,
          newValue: issue.key,
        },
      });

      if (issue.assigneeId && issue.assigneeId !== userId) {
        await tx.notification.create({
          data: {
            recipientId: issue.assigneeId,
            type: NotificationType.ASSIGNED,
            issueKey: issue.key,
            message: `You were assigned to ${issue.key}: ${issue.title}`,
          },
        });
      }

      return issue;
    });

    const full = await this.loadDetail(created.id);
    this.events.emit(project!.key, {
      type: 'issue.created',
      projectKey: project!.key,
      issue: toIssueSummaryDto(full),
    });
    if (created.assigneeId && created.assigneeId !== userId) {
      this.events.emitToUser(created.assigneeId, {
        type: 'notification.created',
      });
    }
    return toIssueDetailDto(full, project!.key, userId);
  }

  // ---------------------------------------------------------------------------
  // List (with filters)
  // ---------------------------------------------------------------------------
  async findAll(
    key: string,
    query: ListIssuesQuery,
    userId: string,
  ): Promise<IssueSummaryDto[]> {
    const project = await this.membership.getProjectForMember(key, userId);

    const where: Prisma.IssueWhereInput = { projectId: project.id };

    if (query.sprintId === 'backlog') {
      where.sprintId = null;
    } else if (query.sprintId) {
      where.sprintId = query.sprintId;
    }
    if (query.statusId) where.statusId = query.statusId;
    if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.teamId) where.teams = { some: { id: query.teamId } };
    if (query.type) where.type = query.type;
    if (query.parentId) where.parentId = query.parentId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { key: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const order = query.order ?? 'asc';
    const orderBy = query.orderBy ?? 'rank';

    // Priority needs enum-weight ordering, which Prisma can't express directly,
    // so we sort in memory for that case. Everything else maps to a column.
    if (orderBy === 'priority') {
      const issues = await this.prisma.issue.findMany({
        where,
        include: SUMMARY_INCLUDE,
      });
      issues.sort((a, b) => {
        const diff =
          (PRIORITY_WEIGHT[a.priority] ?? 0) - (PRIORITY_WEIGHT[b.priority] ?? 0);
        return order === 'asc' ? diff : -diff;
      });
      return issues.map(toIssueSummaryDto);
    }

    const issues = await this.prisma.issue.findMany({
      where,
      include: SUMMARY_INCLUDE,
      orderBy: { [orderBy]: order },
    });
    return issues.map(toIssueSummaryDto);
  }

  // ---------------------------------------------------------------------------
  // Detail
  // ---------------------------------------------------------------------------
  async findOne(issueKey: string, userId: string): Promise<IssueDetailDto> {
    const issue = await this.membership.getIssueForMember(issueKey, userId);
    const full = await this.loadDetail(issue.id);
    const project = await this.prisma.project.findUnique({
      where: { id: issue.projectId },
      select: { key: true },
    });
    return toIssueDetailDto(full, project!.key, userId);
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  async update(
    issueKey: string,
    dto: UpdateIssueDto,
    userId: string,
  ): Promise<IssueDetailDto> {
    const existing = await this.membership.getIssueForMember(issueKey, userId);
    const project = await this.prisma.project.findUnique({
      where: { id: existing.projectId },
      select: { key: true },
    });

    // Re-validate hierarchy when the type or parent changes.
    const effectiveType = dto.type ?? existing.type;
    const effectiveParent =
      dto.parentId !== undefined ? dto.parentId : existing.parentId;
    if (effectiveParent === existing.id) {
      throw new BadRequestException('An issue cannot be its own parent.');
    }
    // ponytail: checks the child against its parent only; re-typing a parent
    // below its existing children isn't re-validated. Add that if it bites.
    await this.assertValidParent(effectiveParent, effectiveType);

    const data: Prisma.IssueUpdateInput = {};
    const activities: Prisma.ActivityLogCreateManyInput[] = [];
    const notifications: Prisma.NotificationCreateManyInput[] = [];
    // Watcher fan-out, deferred until after the main notifications are built.
    let watcherNotify: { type: NotificationType; message: string } | null = null;

    // --- Simple scalar fields ---
    if (dto.title !== undefined && dto.title !== existing.title) {
      data.title = dto.title;
      activities.push(
        this.activity(existing.id, userId, 'title', existing.title, dto.title),
      );
    }
    if (
      dto.description !== undefined &&
      dto.description !== existing.description
    ) {
      data.description = dto.description;
      activities.push(
        this.activity(existing.id, userId, 'description', null, null),
      );
    }
    if (dto.type !== undefined && dto.type !== existing.type) {
      data.type = dto.type;
      activities.push(
        this.activity(existing.id, userId, 'type', existing.type, dto.type),
      );
    }
    if (dto.priority !== undefined && dto.priority !== existing.priority) {
      data.priority = dto.priority;
      activities.push(
        this.activity(
          existing.id,
          userId,
          'priority',
          existing.priority,
          dto.priority,
        ),
      );
    }
    if (
      dto.storyPoints !== undefined &&
      dto.storyPoints !== existing.storyPoints
    ) {
      data.storyPoints = dto.storyPoints;
      activities.push(
        this.activity(
          existing.id,
          userId,
          'storyPoints',
          existing.storyPoints?.toString() ?? null,
          dto.storyPoints?.toString() ?? null,
        ),
      );
    }
    if (
      dto.originalEstimate !== undefined &&
      dto.originalEstimate !== existing.originalEstimate
    ) {
      data.originalEstimate = dto.originalEstimate;
      activities.push(
        this.activity(
          existing.id,
          userId,
          'originalEstimate',
          existing.originalEstimate?.toString() ?? null,
          dto.originalEstimate?.toString() ?? null,
        ),
      );
    }

    // --- Teams (m2m; replace the whole set) ---
    if (dto.teamIds !== undefined) {
      const newTeams = dto.teamIds.length
        ? await this.prisma.team.findMany({
            where: { id: { in: dto.teamIds } },
          })
        : [];
      if (newTeams.length !== dto.teamIds.length) {
        throw new BadRequestException('teamIds contains an invalid team');
      }
      data.teams = { set: dto.teamIds.map((id) => ({ id })) };
      activities.push(
        this.activity(
          existing.id,
          userId,
          'team',
          null,
          newTeams.map((t) => t.name).join(', ') || null,
        ),
      );
    }

    // --- Fix versions (m2m) ---
    if (dto.fixVersionIds !== undefined) {
      data.versions = { set: dto.fixVersionIds.map((id) => ({ id })) };
      activities.push(
        this.activity(existing.id, userId, 'fixVersions', null, null),
      );
    }

    // --- Dates (timeline) ---
    if (dto.startDate !== undefined) {
      const newDate = dto.startDate ? new Date(dto.startDate) : null;
      const oldIso = existing.startDate
        ? existing.startDate.toISOString()
        : null;
      const newIso = newDate ? newDate.toISOString() : null;
      if (oldIso !== newIso) {
        data.startDate = newDate;
        activities.push(
          this.activity(existing.id, userId, 'startDate', oldIso, newIso),
        );
      }
    }
    if (dto.dueDate !== undefined) {
      const newDate = dto.dueDate ? new Date(dto.dueDate) : null;
      const oldIso = existing.dueDate ? existing.dueDate.toISOString() : null;
      const newIso = newDate ? newDate.toISOString() : null;
      if (oldIso !== newIso) {
        data.dueDate = newDate;
        activities.push(
          this.activity(existing.id, userId, 'dueDate', oldIso, newIso),
        );
      }
    }

    // --- Status (human label = status name) ---
    if (dto.statusId !== undefined && dto.statusId !== existing.statusId) {
      const [oldStatus, newStatus] = await Promise.all([
        this.prisma.status.findUnique({ where: { id: existing.statusId } }),
        this.prisma.status.findFirst({
          where: { id: dto.statusId, projectId: existing.projectId },
        }),
      ]);
      if (!newStatus) {
        throw new BadRequestException('statusId does not belong to project');
      }
      data.status = { connect: { id: newStatus.id } };
      activities.push(
        this.activity(
          existing.id,
          userId,
          'status',
          oldStatus?.name ?? null,
          newStatus.name,
        ),
      );
      // Notify the reporter (if someone else moved their issue).
      if (existing.reporterId && existing.reporterId !== userId) {
        notifications.push({
          recipientId: existing.reporterId,
          type: NotificationType.STATUS_CHANGED,
          issueKey: existing.key,
          message: `${existing.key} moved to ${newStatus.name}`,
        });
      }
      // Also notify watchers of the status change.
      watcherNotify = {
        type: NotificationType.STATUS_CHANGED,
        message: `${existing.key} moved to ${newStatus.name}`,
      };
    }

    // --- Assignee (human label = displayName) ---
    if (
      dto.assigneeId !== undefined &&
      dto.assigneeId !== existing.assigneeId
    ) {
      const [oldUser, newUser] = await Promise.all([
        existing.assigneeId
          ? this.prisma.user.findUnique({ where: { id: existing.assigneeId } })
          : Promise.resolve(null),
        dto.assigneeId
          ? this.prisma.user.findUnique({ where: { id: dto.assigneeId } })
          : Promise.resolve(null),
      ]);
      if (dto.assigneeId && !newUser) {
        throw new BadRequestException('assigneeId is not a valid user');
      }
      data.assignee = dto.assigneeId
        ? { connect: { id: dto.assigneeId } }
        : { disconnect: true };
      activities.push(
        this.activity(
          existing.id,
          userId,
          'assignee',
          oldUser?.displayName ?? null,
          newUser?.displayName ?? null,
        ),
      );
      if (dto.assigneeId && dto.assigneeId !== userId) {
        notifications.push({
          recipientId: dto.assigneeId,
          type: NotificationType.ASSIGNED,
          issueKey: existing.key,
          message: `You were assigned to ${existing.key}: ${existing.title}`,
        });
      }
      // Notify watchers of the assignee change (status change wins if both).
      if (!watcherNotify) {
        watcherNotify = {
          type: NotificationType.ASSIGNED,
          message: `${existing.key} was reassigned to ${
            newUser?.displayName ?? 'Unassigned'
          }`,
        };
      }
    }

    // --- Sprint ---
    if (dto.sprintId !== undefined && dto.sprintId !== existing.sprintId) {
      let newSprintName: string | null = null;
      if (dto.sprintId) {
        const sprint = await this.prisma.sprint.findFirst({
          where: { id: dto.sprintId, projectId: existing.projectId },
        });
        if (!sprint) {
          throw new BadRequestException('sprintId does not belong to project');
        }
        newSprintName = sprint.name;
      }
      let oldSprintName: string | null = null;
      if (existing.sprintId) {
        const old = await this.prisma.sprint.findUnique({
          where: { id: existing.sprintId },
        });
        oldSprintName = old?.name ?? null;
      }
      data.sprint = dto.sprintId
        ? { connect: { id: dto.sprintId } }
        : { disconnect: true };
      activities.push(
        this.activity(
          existing.id,
          userId,
          'sprint',
          oldSprintName ?? 'Backlog',
          newSprintName ?? 'Backlog',
        ),
      );
    }

    // --- Parent (epic / subtask link) ---
    if (dto.parentId !== undefined && dto.parentId !== existing.parentId) {
      if (dto.parentId) {
        const parent = await this.prisma.issue.findFirst({
          where: { id: dto.parentId, projectId: existing.projectId },
        });
        if (!parent) {
          throw new BadRequestException('parentId does not belong to project');
        }
      }
      data.parent = dto.parentId
        ? { connect: { id: dto.parentId } }
        : { disconnect: true };
      activities.push(
        this.activity(
          existing.id,
          userId,
          'parent',
          existing.parentId ?? null,
          dto.parentId ?? null,
        ),
      );
    }

    // --- Labels (replace the whole set) ---
    const labelsChanged = dto.labelIds !== undefined;

    // --- @mentions in the description -> MENTIONED (project members only) ---
    if (
      dto.description !== undefined &&
      dto.description !== existing.description
    ) {
      const ids = userMentionIdsFromDoc(dto.description);
      if (ids.length) {
        const already = new Set(notifications.map((n) => n.recipientId));
        const members = await this.prisma.projectMember.findMany({
          where: { projectId: existing.projectId, userId: { in: ids } },
          select: { userId: true },
        });
        for (const m of members) {
          if (m.userId === userId || already.has(m.userId)) continue;
          already.add(m.userId);
          notifications.push({
            recipientId: m.userId,
            type: NotificationType.MENTIONED,
            issueKey: existing.key,
            message: `You were mentioned on ${existing.key}`,
          });
        }
      }
    }

    // Fan out to watchers (de-duped against existing recipients, excl. actor).
    if (watcherNotify) {
      await this.addWatcherNotifications(
        existing.id,
        existing.key,
        userId,
        watcherNotify.type,
        watcherNotify.message,
        notifications,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.issue.update({ where: { id: existing.id }, data });
      }
      if (labelsChanged) {
        await tx.issueLabel.deleteMany({ where: { issueId: existing.id } });
        if (dto.labelIds!.length) {
          await tx.issueLabel.createMany({
            data: dto.labelIds!.map((labelId) => ({
              issueId: existing.id,
              labelId,
            })),
            skipDuplicates: true,
          });
        }
        activities.push(
          this.activity(existing.id, userId, 'labels', null, null),
        );
      }
      if (activities.length) {
        await tx.activityLog.createMany({ data: activities });
      }
      if (notifications.length) {
        await tx.notification.createMany({ data: notifications });
      }
    });

    const full = await this.loadDetail(existing.id);
    this.events.emit(project!.key, {
      type: 'issue.updated',
      projectKey: project!.key,
      issue: toIssueSummaryDto(full),
    });
    this.events.notifyUsers(notifications.map((n) => n.recipientId));
    return toIssueDetailDto(full, project!.key, userId);
  }

  // ---------------------------------------------------------------------------
  // Move (drag & drop on the board)
  // ---------------------------------------------------------------------------
  async move(
    issueKey: string,
    dto: MoveIssueDto,
    userId: string,
  ): Promise<IssueSummaryDto> {
    const existing = await this.membership.getIssueForMember(issueKey, userId);
    const project = await this.prisma.project.findUnique({
      where: { id: existing.projectId },
      select: { key: true },
    });

    const newStatus = await this.prisma.status.findFirst({
      where: { id: dto.statusId, projectId: existing.projectId },
    });
    if (!newStatus) {
      throw new BadRequestException('statusId does not belong to project');
    }

    // Resolve neighbor ranks. Empty column -> middle.
    const [before, after] = await Promise.all([
      dto.beforeId
        ? this.prisma.issue.findUnique({
            where: { id: dto.beforeId },
            select: { rank: true },
          })
        : Promise.resolve(null),
      dto.afterId
        ? this.prisma.issue.findUnique({
            where: { id: dto.afterId },
            select: { rank: true },
          })
        : Promise.resolve(null),
    ]);
    const rank = rankBetween(before?.rank ?? null, after?.rank ?? null);

    const statusChanged = dto.statusId !== existing.statusId;
    const activities: Prisma.ActivityLogCreateManyInput[] = [];
    const notifications: Prisma.NotificationCreateManyInput[] = [];

    if (statusChanged) {
      const oldStatus = await this.prisma.status.findUnique({
        where: { id: existing.statusId },
      });
      activities.push(
        this.activity(
          existing.id,
          userId,
          'status',
          oldStatus?.name ?? null,
          newStatus.name,
        ),
      );
      if (existing.reporterId && existing.reporterId !== userId) {
        notifications.push({
          recipientId: existing.reporterId,
          type: NotificationType.STATUS_CHANGED,
          issueKey: existing.key,
          message: `${existing.key} moved to ${newStatus.name}`,
        });
      }
      // Also notify watchers of the status change.
      await this.addWatcherNotifications(
        existing.id,
        existing.key,
        userId,
        NotificationType.STATUS_CHANGED,
        `${existing.key} moved to ${newStatus.name}`,
        notifications,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.issue.update({
        where: { id: existing.id },
        data: { statusId: newStatus.id, rank },
      });
      if (activities.length) {
        await tx.activityLog.createMany({ data: activities });
      }
      if (notifications.length) {
        await tx.notification.createMany({ data: notifications });
      }
    });

    const full = await this.prisma.issue.findUnique({
      where: { id: existing.id },
      include: SUMMARY_INCLUDE,
    });
    this.events.emit(project!.key, {
      type: 'issue.moved',
      projectKey: project!.key,
      issue: toIssueSummaryDto(full),
    });
    this.events.notifyUsers(notifications.map((n) => n.recipientId));
    return toIssueSummaryDto(full);
  }

  // ---------------------------------------------------------------------------
  // Bulk edit (List view) — apply the same changes to many issues at once.
  // ---------------------------------------------------------------------------
  async bulkUpdate(
    key: string,
    dto: BulkUpdateDto,
    userId: string,
  ): Promise<{ updated: number }> {
    const project = await this.membership.getProjectForMember(key, userId);

    // Only operate on issues that exist, are in this project, and were listed.
    const issues = await this.prisma.issue.findMany({
      where: { projectId: project.id, key: { in: dto.issueKeys } },
    });
    if (issues.length === 0) {
      return { updated: 0 };
    }

    const changes = dto.changes ?? {};

    // Validate FK targets once (status/team/sprint/assignee belong to project).
    if (changes.statusId) {
      const status = await this.prisma.status.findFirst({
        where: { id: changes.statusId, projectId: project.id },
      });
      if (!status) {
        throw new BadRequestException('statusId does not belong to project');
      }
    }
    if (changes.sprintId) {
      const sprint = await this.prisma.sprint.findFirst({
        where: { id: changes.sprintId, projectId: project.id },
      });
      if (!sprint) {
        throw new BadRequestException('sprintId does not belong to project');
      }
    }
    if (changes.teamIds?.length) {
      const found = await this.prisma.team.findMany({
        where: { id: { in: changes.teamIds } },
        select: { id: true },
      });
      if (found.length !== changes.teamIds.length) {
        throw new BadRequestException('teamIds contains an invalid team');
      }
    }
    if (changes.assigneeId) {
      const user = await this.prisma.user.findUnique({
        where: { id: changes.assigneeId },
      });
      if (!user) {
        throw new BadRequestException('assigneeId is not a valid user');
      }
    }

    const scalarData: Prisma.IssueUpdateInput = {};
    if (changes.statusId) {
      scalarData.status = { connect: { id: changes.statusId } };
    }
    if (changes.priority) scalarData.priority = changes.priority;
    if (changes.assigneeId !== undefined) {
      scalarData.assignee = changes.assigneeId
        ? { connect: { id: changes.assigneeId } }
        : { disconnect: true };
    }
    if (changes.teamIds !== undefined) {
      scalarData.teams = { set: changes.teamIds.map((id) => ({ id })) };
    }
    if (changes.sprintId !== undefined) {
      scalarData.sprint = changes.sprintId
        ? { connect: { id: changes.sprintId } }
        : { disconnect: true };
    }

    let updated = 0;
    for (const issue of issues) {
      await this.prisma.$transaction(async (tx) => {
        if (Object.keys(scalarData).length > 0) {
          await tx.issue.update({ where: { id: issue.id }, data: scalarData });
        }
        if (changes.addLabelIds?.length) {
          await tx.issueLabel.createMany({
            data: changes.addLabelIds.map((labelId) => ({
              issueId: issue.id,
              labelId,
            })),
            skipDuplicates: true,
          });
        }
        if (changes.removeLabelIds?.length) {
          await tx.issueLabel.deleteMany({
            where: {
              issueId: issue.id,
              labelId: { in: changes.removeLabelIds },
            },
          });
        }
        const activities: Prisma.ActivityLogCreateManyInput[] = [];
        if (changes.statusId) {
          activities.push(
            this.activity(issue.id, userId, 'status', null, null),
          );
        }
        if (changes.priority) {
          activities.push(
            this.activity(
              issue.id,
              userId,
              'priority',
              issue.priority,
              changes.priority,
            ),
          );
        }
        if (changes.assigneeId !== undefined) {
          activities.push(
            this.activity(issue.id, userId, 'assignee', null, null),
          );
        }
        if (changes.teamIds !== undefined) {
          activities.push(this.activity(issue.id, userId, 'team', null, null));
        }
        if (changes.sprintId !== undefined) {
          activities.push(
            this.activity(issue.id, userId, 'sprint', null, null),
          );
        }
        if (changes.addLabelIds?.length || changes.removeLabelIds?.length) {
          activities.push(
            this.activity(issue.id, userId, 'labels', null, null),
          );
        }
        if (activities.length) {
          await tx.activityLog.createMany({ data: activities });
        }
      });
      updated++;

      // Best-effort live update.
      const full = await this.prisma.issue.findUnique({
        where: { id: issue.id },
        include: SUMMARY_INCLUDE,
      });
      if (full) {
        this.events.emit(project.key, {
          type: 'issue.updated',
          projectKey: project.key,
          issue: toIssueSummaryDto(full),
        });
      }
    }

    return { updated };
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  async remove(
    issueKey: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.membership.getIssueForMember(issueKey, userId);
    await this.prisma.issue.delete({ where: { id: existing.id } });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  private async loadDetail(id: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!issue) {
      throw new NotFoundException('Issue not found');
    }
    return issue;
  }

  /**
   * Append notifications for an issue's watchers to an existing notification
   * batch. Watchers already targeted (e.g. the reporter/assignee) and the actor
   * are skipped. Used when status/assignee changes so watchers are kept in the
   * loop alongside the usual recipients.
   */
  private async addWatcherNotifications(
    issueId: string,
    issueKey: string,
    actorId: string,
    type: NotificationType,
    message: string,
    notifications: Prisma.NotificationCreateManyInput[],
  ): Promise<void> {
    const watchers = await this.prisma.watcher.findMany({
      where: { issueId },
      select: { userId: true },
    });
    const already = new Set(notifications.map((n) => n.recipientId));
    for (const w of watchers) {
      if (w.userId === actorId) continue;
      if (already.has(w.userId)) continue;
      already.add(w.userId);
      notifications.push({
        recipientId: w.userId,
        type,
        issueKey,
        message,
      });
    }
  }

  private activity(
    issueId: string,
    actorId: string,
    field: string,
    oldValue: string | null,
    newValue: string | null,
  ): Prisma.ActivityLogCreateManyInput {
    return { issueId, actorId, field, oldValue, newValue };
  }
}
