import { Injectable } from '@nestjs/common';
import { SprintState, StatusCategory } from '@prisma/client';
import type {
  BurndownDto,
  BurndownPointDto,
  CreatedResolvedPointDto,
  CumulativeFlowPointDto,
  ReportsDto,
  VelocityPointDto,
} from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { toSprintDto } from '../common/mappers';

const DAY_MS = 24 * 60 * 60 * 1000;
const CFD_DAYS = 21;

/** Normalize a date to UTC midnight + return its YYYY-MM-DD key. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  async getReports(key: string, userId: string): Promise<ReportsDto> {
    const project = await this.membership.getProjectForMember(key, userId);

    // Pull everything we need once. Status-change activity drives the
    // historical (as-of-day) computations.
    const [issues, sprints, doneStatuses, statusActivities] = await Promise.all([
      this.prisma.issue.findMany({
        where: { projectId: project.id },
        include: { status: true },
      }),
      this.prisma.sprint.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.status.findMany({
        where: { projectId: project.id, category: StatusCategory.DONE },
        select: { name: true },
      }),
      this.prisma.activityLog.findMany({
        where: { issue: { projectId: project.id }, field: 'status' },
        orderBy: { createdAt: 'asc' },
        select: { issueId: true, oldValue: true, newValue: true, createdAt: true },
      }),
    ]);

    const doneNames = new Set(doneStatuses.map((s) => s.name));

    return {
      velocity: this.velocity(issues, sprints),
      burndown: this.burndown(issues, sprints, doneNames, statusActivities),
      cumulativeFlow: this.cumulativeFlow(issues, doneNames, statusActivities),
      createdVsResolved: this.createdVsResolved(
        issues,
        doneNames,
        statusActivities,
      ),
    };
  }

  // ---------------------------------------------------------------------------
  // Velocity: CLOSED sprints first, then ACTIVE.
  // ---------------------------------------------------------------------------
  private velocity(issues: any[], sprints: any[]): VelocityPointDto[] {
    const ordered = [
      ...sprints.filter((s) => s.state === SprintState.CLOSED),
      ...sprints.filter((s) => s.state === SprintState.ACTIVE),
    ];
    return ordered.map((sprint) => {
      const inSprint = issues.filter((i) => i.sprintId === sprint.id);
      const committed = inSprint.reduce(
        (sum, i) => sum + (i.storyPoints ?? 0),
        0,
      );
      const completed = inSprint
        .filter((i) => i.status?.category === StatusCategory.DONE)
        .reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);
      return {
        sprintId: sprint.id,
        sprintName: sprint.name,
        committed,
        completed,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Burndown for the ACTIVE sprint.
  // ---------------------------------------------------------------------------
  private burndown(
    issues: any[],
    sprints: any[],
    doneNames: Set<string>,
    statusActivities: { issueId: string; newValue: string | null; createdAt: Date }[],
  ): BurndownDto {
    const active = sprints.find((s) => s.state === SprintState.ACTIVE);
    if (!active) {
      return { sprint: null, totalPoints: 0, points: [] };
    }

    const inSprint = issues.filter((i) => i.sprintId === active.id);
    const totalPoints = inSprint.reduce(
      (sum, i) => sum + (i.storyPoints ?? 0),
      0,
    );

    // Range: sprint start (fallback earliest issue createdAt) -> end (fallback now).
    const earliest = inSprint.reduce<Date | null>((min, i) => {
      const c = new Date(i.createdAt);
      return !min || c < min ? c : min;
    }, null);
    const start = startOfDay(
      active.startDate ? new Date(active.startDate) : earliest ?? new Date(),
    );
    const end = startOfDay(
      active.endDate ? new Date(active.endDate) : new Date(),
    );
    const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS));

    // For each sprint issue, the day it first reached a DONE status (if any).
    const doneDayByIssue = new Map<string, number>();
    const sprintIds = new Set(inSprint.map((i) => i.id));
    for (const a of statusActivities) {
      if (!sprintIds.has(a.issueId)) continue;
      if (!a.newValue || !doneNames.has(a.newValue)) continue;
      if (doneDayByIssue.has(a.issueId)) continue;
      doneDayByIssue.set(
        a.issueId,
        startOfDay(new Date(a.createdAt)).getTime(),
      );
    }

    const points: BurndownPointDto[] = [];
    for (let d = 0; d <= days; d++) {
      const cursor = new Date(start.getTime() + d * DAY_MS);
      const cursorMs = cursor.getTime();
      const completedByNow = inSprint.reduce((sum, i) => {
        const doneAt = doneDayByIssue.get(i.id);
        if (doneAt !== undefined && doneAt <= cursorMs) {
          return sum + (i.storyPoints ?? 0);
        }
        return sum;
      }, 0);
      const ideal =
        days === 0 ? 0 : totalPoints - (totalPoints * d) / days;
      points.push({
        date: dayKey(cursor),
        remaining: totalPoints - completedByNow,
        ideal: Math.round(ideal * 100) / 100,
      });
    }

    return { sprint: toSprintDto(active), totalPoints, points };
  }

  // ---------------------------------------------------------------------------
  // Cumulative flow: last 21 days, category counts as-of each day.
  // ---------------------------------------------------------------------------
  private cumulativeFlow(
    issues: any[],
    doneNames: Set<string>,
    statusActivities: { issueId: string; oldValue: string | null; newValue: string | null; createdAt: Date }[],
  ): CumulativeFlowPointDto[] {
    const today = startOfDay(new Date());
    const result: CumulativeFlowPointDto[] = [];

    // Pre-group status changes per issue (chronological).
    const changesByIssue = new Map<string, { newValue: string | null; ms: number }[]>();
    for (const a of statusActivities) {
      const list = changesByIssue.get(a.issueId) ?? [];
      list.push({ newValue: a.newValue, ms: new Date(a.createdAt).getTime() });
      changesByIssue.set(a.issueId, list);
    }

    // Map status name -> category for the project (current statuses).
    const categoryByName = new Map<string, StatusCategory>();
    for (const i of issues) {
      if (i.status) categoryByName.set(i.status.name, i.status.category);
    }
    const categoryFor = (name: string | null): StatusCategory => {
      if (name && categoryByName.has(name)) return categoryByName.get(name)!;
      if (name && doneNames.has(name)) return StatusCategory.DONE;
      return StatusCategory.TODO;
    };

    for (let offset = CFD_DAYS - 1; offset >= 0; offset--) {
      const day = new Date(today.getTime() - offset * DAY_MS);
      const dayMs = day.getTime() + DAY_MS - 1; // end of that day
      let todo = 0;
      let inProgress = 0;
      let done = 0;
      for (const i of issues) {
        const createdMs = startOfDay(new Date(i.createdAt)).getTime();
        if (createdMs > dayMs) continue; // not created yet

        // Latest status change at or before this day.
        const changes = changesByIssue.get(i.id) ?? [];
        let statusName: string | null = null;
        for (const c of changes) {
          if (c.ms <= dayMs) statusName = c.newValue;
          else break;
        }
        // Fallback: no history -> current status category (or TODO at creation).
        const category =
          statusName !== null
            ? categoryFor(statusName)
            : (i.status?.category as StatusCategory) ?? StatusCategory.TODO;

        if (category === StatusCategory.DONE) done++;
        else if (category === StatusCategory.IN_PROGRESS) inProgress++;
        else todo++;
      }
      result.push({ date: dayKey(day), todo, inProgress, done });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Created vs resolved: last 21 days.
  // ---------------------------------------------------------------------------
  private createdVsResolved(
    issues: any[],
    doneNames: Set<string>,
    statusActivities: { issueId: string; newValue: string | null; createdAt: Date }[],
  ): CreatedResolvedPointDto[] {
    const today = startOfDay(new Date());
    const createdByDay = new Map<string, number>();
    const resolvedByDay = new Map<string, number>();

    for (const i of issues) {
      const k = dayKey(startOfDay(new Date(i.createdAt)));
      createdByDay.set(k, (createdByDay.get(k) ?? 0) + 1);
    }

    // First transition into a DONE status counts as the resolution day.
    const resolvedIssues = new Set<string>();
    for (const a of statusActivities) {
      if (!a.newValue || !doneNames.has(a.newValue)) continue;
      if (resolvedIssues.has(a.issueId)) continue;
      resolvedIssues.add(a.issueId);
      const k = dayKey(startOfDay(new Date(a.createdAt)));
      resolvedByDay.set(k, (resolvedByDay.get(k) ?? 0) + 1);
    }

    const result: CreatedResolvedPointDto[] = [];
    for (let offset = CFD_DAYS - 1; offset >= 0; offset--) {
      const day = new Date(today.getTime() - offset * DAY_MS);
      const k = dayKey(day);
      result.push({
        date: k,
        created: createdByDay.get(k) ?? 0,
        resolved: resolvedByDay.get(k) ?? 0,
      });
    }
    return result;
  }
}
