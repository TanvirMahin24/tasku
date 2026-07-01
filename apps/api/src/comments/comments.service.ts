import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, type Prisma } from '@prisma/client';
import type { CommentDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { EventsService } from '../events/events.service';
import { toCommentDto } from '../common/mappers';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly events: EventsService,
  ) {}

  async list(issueKey: string, userId: string): Promise<CommentDto[]> {
    const issue = await this.membership.getIssueForMember(issueKey, userId);
    const comments = await this.prisma.comment.findMany({
      where: { issueId: issue.id },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    });
    return comments.map(toCommentDto);
  }

  async create(
    issueKey: string,
    dto: CreateCommentDto,
    userId: string,
  ): Promise<CommentDto> {
    const issue = await this.membership.getIssueForMember(issueKey, userId);
    const project = await this.prisma.project.findUnique({
      where: { id: issue.projectId },
      select: { key: true },
    });

    const mentionedIds = await this.resolveMentions(dto.body, issue.projectId);
    const notifiedIds: string[] = [];

    const created = await this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: { issueId: issue.id, authorId: userId, body: dto.body },
        include: { author: true },
      });

      await tx.activityLog.create({
        data: {
          issueId: issue.id,
          actorId: userId,
          field: 'comment',
          oldValue: null,
          newValue: null,
        },
      });

      // COMMENTED -> reporter + assignee + watchers (de-duped, excl. author).
      const commentedRecipients = new Set<string>();
      if (issue.reporterId && issue.reporterId !== userId) {
        commentedRecipients.add(issue.reporterId);
      }
      if (issue.assigneeId && issue.assigneeId !== userId) {
        commentedRecipients.add(issue.assigneeId);
      }
      const watchers = await tx.watcher.findMany({
        where: { issueId: issue.id },
        select: { userId: true },
      });
      for (const w of watchers) {
        if (w.userId !== userId) commentedRecipients.add(w.userId);
      }

      const notifications: Prisma.NotificationCreateManyInput[] = [];
      for (const recipientId of commentedRecipients) {
        // If they're also mentioned, the MENTIONED notification takes priority.
        if (mentionedIds.has(recipientId)) continue;
        notifications.push({
          recipientId,
          type: NotificationType.COMMENTED,
          issueKey: issue.key,
          message: `New comment on ${issue.key}`,
        });
      }
      for (const recipientId of mentionedIds) {
        if (recipientId === userId) continue;
        notifications.push({
          recipientId,
          type: NotificationType.MENTIONED,
          issueKey: issue.key,
          message: `You were mentioned on ${issue.key}`,
        });
      }
      if (notifications.length) {
        await tx.notification.createMany({ data: notifications });
        notifiedIds.push(...notifications.map((n) => n.recipientId));
      }

      return comment;
    });

    this.events.emit(project!.key, {
      type: 'comment.created',
      projectKey: project!.key,
      issueKey: issue.key,
    });
    this.events.notifyUsers(notifiedIds);
    return toCommentDto(created);
  }

  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: { issue: { select: { projectId: true } } },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    const membership = await this.membership.requireMembership(
      comment.issue.projectId,
      userId,
    );
    // Author may delete their own comment; project admins may delete any.
    if (comment.authorId !== userId && membership.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only the author or a project admin can delete this comment',
      );
    }
    await this.prisma.comment.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Resolve @mentions to user ids. Supports two forms:
   *  - rich: `@[Display Name](userId)`  -> the captured userId (if a project member)
   *  - plain: `@DisplayName`            -> matched against project members' displayNames
   * Returns a de-duplicated Set of member user ids.
   */
  private async resolveMentions(
    body: string,
    projectId: string,
  ): Promise<Set<string>> {
    const result = new Set<string>();

    // Project members are the only valid mention targets.
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true },
    });
    const byId = new Map(members.map((m) => [m.userId, m.user]));
    const byName = new Map(
      members.map((m) => [m.user.displayName.toLowerCase(), m.userId]),
    );

    // 1) rich mentions: @[Name](id)
    const richRe = /@\[[^\]]+\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = richRe.exec(body)) !== null) {
      const id = match[1];
      if (byId.has(id)) result.add(id);
    }

    // 2) plain mentions: @Name (longest member names first so multi-word wins).
    const names = [...byName.keys()].sort((a, b) => b.length - a.length);
    const lowerBody = body.toLowerCase();
    for (const name of names) {
      if (lowerBody.includes(`@${name}`)) {
        result.add(byName.get(name)!);
      }
    }

    return result;
  }
}
