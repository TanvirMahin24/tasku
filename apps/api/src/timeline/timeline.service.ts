import { Injectable } from '@nestjs/common';
import { IssueType, type Prisma } from '@prisma/client';
import type { IssueSummaryDto, TimelineDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { toIssueSummaryDto } from '../common/mappers';

const SUMMARY_INCLUDE = {
  assignee: true,
  teams: true,
  labels: { include: { label: true } },
} satisfies Prisma.IssueInclude;

@Injectable()
export class TimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  async getTimeline(key: string, userId: string): Promise<TimelineDto> {
    const project = await this.membership.getProjectForMember(key, userId);

    const issues = await this.prisma.issue.findMany({
      where: { projectId: project.id },
      include: SUMMARY_INCLUDE,
      orderBy: { rank: 'asc' },
    });

    const epics = issues.filter((i) => i.type === IssueType.EPIC);
    const epicIds = new Set(epics.map((e) => e.id));

    // Map epicId -> child issues.
    const childrenByEpic = new Map<string, typeof issues>();
    for (const issue of issues) {
      if (issue.parentId && epicIds.has(issue.parentId)) {
        const arr = childrenByEpic.get(issue.parentId) ?? [];
        arr.push(issue);
        childrenByEpic.set(issue.parentId, arr);
      }
    }

    const rows: TimelineDto['rows'] = [];
    const unscheduled: IssueSummaryDto[] = [];

    // One row per epic, with its children.
    for (const epic of epics) {
      rows.push({
        issue: toIssueSummaryDto(epic),
        children: (childrenByEpic.get(epic.id) ?? []).map(toIssueSummaryDto),
      });
    }

    // Standalone rows: non-epic, parent-less issues that are scheduled.
    for (const issue of issues) {
      if (issue.type === IssueType.EPIC) continue;
      if (issue.parentId) continue; // children belong under their epic row
      const scheduled = Boolean(issue.startDate || issue.dueDate);
      if (scheduled) {
        rows.push({ issue: toIssueSummaryDto(issue), children: [] });
      } else {
        unscheduled.push(toIssueSummaryDto(issue));
      }
    }

    // Range across scheduled issues (epics + their children + standalones).
    const scheduledIssues = issues.filter(
      (i) => i.startDate || i.dueDate,
    );
    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;
    for (const i of scheduledIssues) {
      const start = i.startDate ?? i.createdAt;
      if (start && (!rangeStart || start < rangeStart)) rangeStart = start;
      if (i.dueDate && (!rangeEnd || i.dueDate > rangeEnd)) {
        rangeEnd = i.dueDate;
      }
    }

    return {
      rows,
      unscheduled,
      rangeStart: rangeStart ? rangeStart.toISOString() : null,
      rangeEnd: rangeEnd ? rangeEnd.toISOString() : null,
    };
  }
}
