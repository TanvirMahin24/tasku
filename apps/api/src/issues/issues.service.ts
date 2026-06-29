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
import type { IssueDetailDto, IssueSummaryDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { EventsService } from '../events/events.service';
import {
  toIssueDetailDto,
  toIssueSummaryDto,
} from '../common/mappers';
import { rankAfter, rankBetween } from '../common/rank.util';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { MoveIssueDto } from './dto/move-issue.dto';
import { ListIssuesQuery } from './dto/list-issues.query';

// Prisma `include` fragments reused across reads.
const SUMMARY_INCLUDE = {
  assignee: true,
  labels: { include: { label: true } },
} satisfies Prisma.IssueInclude;

const DETAIL_INCLUDE = {
  reporter: true,
  assignee: true,
  labels: { include: { label: true } },
  components: { include: { component: true } },
  comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
  activities: { include: { actor: true }, orderBy: { createdAt: 'desc' } },
  children: { include: SUMMARY_INCLUDE, orderBy: { rank: 'asc' } },
} satisfies Prisma.IssueInclude;

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly events: EventsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------
  async create(
    key: string,
    dto: CreateIssueDto,
    userId: string,
  ): Promise<IssueDetailDto> {
    const project = await this.membership.getProjectForMember(key, userId);

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
    return toIssueDetailDto(full, project.key);
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
    if (query.type) where.type = query.type;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { key: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const issues = await this.prisma.issue.findMany({
      where,
      include: SUMMARY_INCLUDE,
      orderBy: { rank: 'asc' },
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
    return toIssueDetailDto(full, project!.key);
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

    const data: Prisma.IssueUpdateInput = {};
    const activities: Prisma.ActivityLogCreateManyInput[] = [];
    const notifications: Prisma.NotificationCreateManyInput[] = [];

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
    return toIssueDetailDto(full, project!.key);
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
    return toIssueSummaryDto(full);
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
