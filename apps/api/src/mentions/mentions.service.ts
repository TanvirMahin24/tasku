import { Injectable } from '@nestjs/common';
import type { MentionableDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';

const PER_TYPE = 6;

/**
 * Supplies the @-mention autocomplete for a project: users (members), issues,
 * knowledge docs (in this project's issues or the caller's teams) and boards.
 */
@Injectable()
export class MentionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  async search(
    projectKey: string,
    q: string | undefined,
    userId: string,
  ): Promise<MentionableDto[]> {
    const project = await this.membership.getProjectForMember(projectKey, userId);
    const term = (q ?? '').trim();
    const like = { contains: term, mode: 'insensitive' as const };

    const myTeams = await this.prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const teamIds = myTeams.map((t) => t.teamId);

    const [members, issues, boards, knowledge] = await Promise.all([
      this.prisma.projectMember.findMany({
        where: {
          projectId: project.id,
          ...(term
            ? { user: { OR: [{ displayName: like }, { email: like }] } }
            : {}),
        },
        include: { user: true },
        take: PER_TYPE,
      }),
      this.prisma.issue.findMany({
        where: {
          projectId: project.id,
          ...(term ? { OR: [{ key: like }, { title: like }] } : {}),
        },
        select: { id: true, key: true, title: true, type: true },
        orderBy: { updatedAt: 'desc' },
        take: PER_TYPE,
      }),
      this.prisma.board.findMany({
        where: { projectId: project.id, ...(term ? { name: like } : {}) },
        select: { id: true, name: true },
        take: PER_TYPE,
      }),
      this.prisma.knowledgeDoc.findMany({
        where: {
          isImport: false,
          ...(term ? { title: like } : {}),
          OR: [
            { issue: { projectId: project.id } },
            ...(teamIds.length ? [{ teamId: { in: teamIds } }] : []),
          ],
        },
        select: { id: true, title: true, type: true, linkKind: true },
        orderBy: { createdAt: 'desc' },
        take: PER_TYPE,
      }),
    ]);

    const out: MentionableDto[] = [];
    for (const m of members) {
      out.push({
        type: 'user',
        id: m.userId,
        label: m.user.displayName,
        sublabel: m.user.email,
      });
    }
    for (const i of issues) {
      out.push({
        type: 'issue',
        id: i.id,
        label: i.key,
        sublabel: i.title,
        issueType: i.type,
      });
    }
    for (const k of knowledge) {
      out.push({
        type: 'knowledge',
        id: k.id,
        label: k.title,
        sublabel: k.type === 'FILE' ? 'File' : 'Link',
      });
    }
    for (const b of boards) {
      out.push({ type: 'board', id: b.id, label: b.name, sublabel: 'Board' });
    }
    return out;
  }
}
