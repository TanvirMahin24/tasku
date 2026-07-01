import { Injectable, NotFoundException } from '@nestjs/common';
import type { WorklogDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { toWorklogDto } from '../common/mappers';
import { CreateWorklogDto } from './dto/create-worklog.dto';

@Injectable()
export class WorklogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  async create(
    issueKey: string,
    dto: CreateWorklogDto,
    userId: string,
  ): Promise<WorklogDto> {
    const issue = await this.membership.getIssueForMember(issueKey, userId);

    const created = await this.prisma.$transaction(async (tx) => {
      const worklog = await tx.worklog.create({
        data: {
          issueId: issue.id,
          userId,
          minutes: dto.minutes,
          comment: dto.comment ?? null,
          startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
        },
        include: { user: true },
      });
      await tx.activityLog.create({
        data: {
          issueId: issue.id,
          actorId: userId,
          field: 'worklog',
          oldValue: null,
          newValue: `${dto.minutes}m`,
        },
      });
      return worklog;
    });

    return toWorklogDto(created);
  }

  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    const worklog = await this.prisma.worklog.findUnique({
      where: { id },
      include: { issue: { select: { projectId: true } } },
    });
    if (!worklog) {
      throw new NotFoundException('Worklog not found');
    }
    await this.membership.requireMembership(worklog.issue.projectId, userId);
    await this.prisma.worklog.delete({ where: { id } });
    return { success: true };
  }
}
