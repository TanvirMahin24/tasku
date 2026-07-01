import { Injectable } from '@nestjs/common';
import {
  ISSUE_TYPES,
  PRIORITIES,
} from '@tasku/types';
import {
  Role,
  SprintState,
  StatusCategory,
  type Prisma,
} from '@prisma/client';
import type {
  CountBucket,
  OverviewDto,
  WorkloadEntryDto,
} from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import {
  toActivityDto,
  toProjectDto,
  toSprintDto,
  toUserDto,
} from '../common/mappers';

const STATUS_CATEGORY_LABELS: Record<StatusCategory, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

const ISSUE_INCLUDE = {
  assignee: true,
  status: true,
} satisfies Prisma.IssueInclude;

@Injectable()
export class OverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  async getOverview(key: string, userId: string): Promise<OverviewDto> {
    const project = await this.membership.getProjectForMember(key, userId);
    const membership = await this.membership.requireMembership(
      project.id,
      userId,
    );
    const fullProject = await this.prisma.project.findUnique({
      where: { id: project.id },
      include: { lead: true },
    });

    const [issues, activeSprint, activities] = await Promise.all([
      this.prisma.issue.findMany({
        where: { projectId: project.id },
        include: ISSUE_INCLUDE,
      }),
      this.prisma.sprint.findFirst({
        where: { projectId: project.id, state: SprintState.ACTIVE },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.activityLog.findMany({
        where: { issue: { projectId: project.id } },
        include: { actor: true },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ]);

    // --- By status category ---
    const categoryCounts: Record<StatusCategory, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      DONE: 0,
    };
    for (const i of issues) {
      categoryCounts[i.status.category as StatusCategory]++;
    }
    const byStatusCategory: CountBucket[] = (
      ['TODO', 'IN_PROGRESS', 'DONE'] as StatusCategory[]
    ).map((cat) => ({
      key: cat,
      label: STATUS_CATEGORY_LABELS[cat],
      count: categoryCounts[cat],
    }));

    // --- By type ---
    const byType: CountBucket[] = ISSUE_TYPES.map((type) => ({
      key: type,
      label: type,
      count: issues.filter((i) => i.type === type).length,
    }));

    // --- By priority ---
    const byPriority: CountBucket[] = PRIORITIES.map((priority) => ({
      key: priority,
      label: priority,
      count: issues.filter((i) => i.priority === priority).length,
    }));

    // --- Points ---
    const total = issues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);
    const done = issues
      .filter((i) => i.status.category === StatusCategory.DONE)
      .reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);

    // --- Workload (assignees with >= 1 non-DONE issue) ---
    const workloadMap = new Map<
      string,
      { user: any; count: number; points: number }
    >();
    for (const i of issues) {
      if (!i.assignee) continue;
      if (i.status.category === StatusCategory.DONE) continue;
      const entry = workloadMap.get(i.assignee.id) ?? {
        user: i.assignee,
        count: 0,
        points: 0,
      };
      entry.count += 1;
      entry.points += i.storyPoints ?? 0;
      workloadMap.set(i.assignee.id, entry);
    }
    const workload: WorkloadEntryDto[] = [...workloadMap.values()]
      .sort((a, b) => b.count - a.count)
      .map((e) => ({
        user: toUserDto(e.user),
        count: e.count,
        points: e.points,
      }));

    return {
      project: toProjectDto(fullProject, membership.role as Role),
      totalIssues: issues.length,
      byStatusCategory,
      byType,
      byPriority,
      points: { total, done },
      activeSprint: activeSprint ? toSprintDto(activeSprint) : null,
      recentActivity: activities.map(toActivityDto),
      workload,
    };
  }
}
