import {
  BadRequestException,
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
import { userMentionIdsFromText } from '../common/mentions.util';
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
    const all = await this.prisma.comment.findMany({
      where: { issueId: issue.id },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    });
    // Group into one-level threads: top-level comments each carry their replies.
    const repliesByParent = new Map<string, typeof all>();
    for (const c of all) {
      if (!c.parentId) continue;
      const arr = repliesByParent.get(c.parentId) ?? [];
      arr.push(c);
      repliesByParent.set(c.parentId, arr);
    }
    return all
      .filter((c) => !c.parentId)
      .map((top) =>
        toCommentDto({ ...top, replies: repliesByParent.get(top.id) ?? [] }),
      );
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

    // One-level threads: a reply attaches to a top-level comment. Replying to a
    // reply collapses onto its parent thread.
    let parentId: string | null = null;
    let threadAuthorId: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { id: true, issueId: true, parentId: true, authorId: true },
      });
      if (!parent || parent.issueId !== issue.id) {
        throw new BadRequestException('Parent comment does not belong to this issue');
      }
      parentId = parent.parentId ?? parent.id;
      threadAuthorId = parent.authorId;
    }

    const mentionedIds = await this.resolveMentions(dto.body, issue.projectId);
    const notifiedIds: string[] = [];

    const created = await this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: { issueId: issue.id, authorId: userId, body: dto.body, parentId },
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

      // COMMENTED -> reporter + assignee + watchers + (for a reply) the thread
      // author, de-duped and excluding the author.
      const commentedRecipients = new Set<string>();
      if (issue.reporterId && issue.reporterId !== userId) {
        commentedRecipients.add(issue.reporterId);
      }
      if (issue.assigneeId && issue.assigneeId !== userId) {
        commentedRecipients.add(issue.assigneeId);
      }
      if (threadAuthorId && threadAuthorId !== userId) {
        commentedRecipients.add(threadAuthorId);
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
   * Resolve user @mentions in a body (token form `@[Name](mention:user:id)`) to
   * a de-duplicated Set of ids, keeping only actual project members.
   */
  private async resolveMentions(
    body: string,
    projectId: string,
  ): Promise<Set<string>> {
    const ids = userMentionIdsFromText(body);
    if (!ids.length) return new Set();
    const members = await this.prisma.projectMember.findMany({
      where: { projectId, userId: { in: ids } },
      select: { userId: true },
    });
    return new Set(members.map((m) => m.userId));
  }
}
