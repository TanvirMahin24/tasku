import { Injectable } from '@nestjs/common';
import { Role, SprintState, type Prisma } from '@prisma/client';
import type { BoardDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import {
  toProjectDto,
  toStatusDto,
  toIssueSummaryDto,
  toSprintDto,
} from '../common/mappers';

const SUMMARY_INCLUDE = {
  assignee: true,
  labels: { include: { label: true } },
} satisfies Prisma.IssueInclude;

@Injectable()
export class BoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  async getBoard(
    key: string,
    sprintId: string | undefined,
    userId: string,
  ): Promise<BoardDto> {
    const project = await this.prisma.project.findUnique({
      where: { key },
      include: { lead: true },
    });
    if (!project) {
      // getProjectForMember throws NotFound; reuse for consistent errors.
      await this.membership.getProjectForMember(key, userId);
    }
    const membership = await this.membership.requireMembership(
      project!.id,
      userId,
    );

    const [statuses, activeSprint] = await Promise.all([
      this.prisma.status.findMany({
        where: { projectId: project!.id },
        orderBy: { order: 'asc' },
      }),
      this.prisma.sprint.findFirst({
        where: { projectId: project!.id, state: SprintState.ACTIVE },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    // Decide which sprint filter applies:
    //  - explicit ?sprintId wins
    //  - else, if there's an active sprint, scope to it
    //  - else, show all issues regardless of sprint
    const issueWhere: Prisma.IssueWhereInput = { projectId: project!.id };
    if (sprintId) {
      issueWhere.sprintId = sprintId;
    } else if (activeSprint) {
      issueWhere.sprintId = activeSprint.id;
    }

    const issues = await this.prisma.issue.findMany({
      where: issueWhere,
      include: SUMMARY_INCLUDE,
      orderBy: { rank: 'asc' },
    });

    const columns = statuses.map((status) => ({
      status: toStatusDto(status),
      issues: issues
        .filter((i) => i.statusId === status.id)
        .map(toIssueSummaryDto),
    }));

    return {
      project: toProjectDto(project, membership.role as Role),
      columns,
      activeSprint: activeSprint ? toSprintDto(activeSprint) : null,
    };
  }
}
