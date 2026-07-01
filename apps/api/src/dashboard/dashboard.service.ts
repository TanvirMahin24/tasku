import { Injectable } from '@nestjs/common';
import { Prisma, Role, StatusCategory } from '@prisma/client';
import type { DashboardDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { toIssueSummaryDto, toProjectDto } from '../common/mappers';

const SUMMARY_INCLUDE = {
  assignee: true,
  team: true,
  labels: { include: { label: true } },
} satisfies Prisma.IssueInclude;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<DashboardDto> {
    const mine = { members: { some: { userId } } };
    const [assigned, recent, stars, memberships] = await Promise.all([
      // Open work assigned to me, across my projects.
      this.prisma.issue.findMany({
        where: {
          assigneeId: userId,
          status: { category: { not: StatusCategory.DONE } },
          project: mine,
        },
        include: SUMMARY_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      // Recently touched: issues I report or am assigned.
      this.prisma.issue.findMany({
        where: {
          project: mine,
          OR: [{ assigneeId: userId }, { reporterId: userId }],
        },
        include: SUMMARY_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      this.prisma.boardStar.findMany({
        where: { userId },
        include: { board: { include: { project: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.projectMember.findMany({
        where: { userId },
        include: { project: { include: { lead: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      assignedToMe: assigned.map(toIssueSummaryDto),
      recentlyUpdated: recent.map(toIssueSummaryDto),
      starredBoards: stars.map((s) => ({
        id: s.board.id,
        name: s.board.name,
        isDefault: s.board.isDefault,
        projectKey: s.board.project.key,
        projectName: s.board.project.name,
      })),
      projects: memberships.map((m) =>
        toProjectDto(m.project, m.role as Role),
      ),
    };
  }
}
