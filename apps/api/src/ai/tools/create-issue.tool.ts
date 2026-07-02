import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { IssueType, Priority } from '@prisma/client';
import type { ToolFactory } from './types';
import {
  applyCustomFields,
  issueReference,
  norm,
  resolveScopeProjectIds,
} from './util';

/** Create an issue via IssuesService (membership-checked, full side effects). */
export const createIssueTool: ToolFactory = (ctx) =>
  new DynamicStructuredTool({
    name: 'create_issue',
    description:
      'Create a new issue in a project the user can access. Requires projectKey, ' +
      'type (STORY, TASK, BUG, EPIC, IDEA, SUBTASK) and title. Optionally set ' +
      'description, priority, assignee (email), start/due dates, a team, story ' +
      'points, initial status, a parent issue (epic/subtask), a sprint, labels, ' +
      'and custom fields. Resolve relative dates to ISO YYYY-MM-DD first.',
    schema: z.object({
      projectKey: z.string().describe('Project key, e.g. TASK'),
      type: z.string().describe('Issue type: STORY, TASK, BUG, EPIC, IDEA, SUBTASK'),
      title: z.string().describe('Short issue title'),
      description: z.string().optional(),
      priority: z
        .string()
        .optional()
        .describe('LOWEST, LOW, MEDIUM, HIGH, HIGHEST'),
      assigneeEmail: z.string().optional().describe('Assignee email address'),
      startDate: z.string().optional().describe('Start date as ISO YYYY-MM-DD'),
      dueDate: z.string().optional().describe('Due date as ISO YYYY-MM-DD'),
      team: z.string().optional().describe('Team name to associate, e.g. Platform'),
      storyPoints: z.number().optional().describe('Estimate in story points'),
      status: z.string().optional().describe('Initial status/column name, e.g. "To Do"'),
      parentKey: z
        .string()
        .optional()
        .describe('Parent issue key for an epic link or subtask, e.g. TASK-1'),
      sprint: z.string().optional().describe('Sprint name to add the issue to'),
      labels: z
        .array(z.string())
        .optional()
        .describe('Label names to attach, e.g. ["frontend","urgent"]'),
      customFields: z
        .array(z.object({ name: z.string(), value: z.string() }))
        .optional()
        .describe('Project custom fields to set, as {name, value} pairs'),
    }),
    func: async (input) => {
      const warnings: string[] = [];
      try {
        // Resolve + access-check the project once; every lookup below is scoped
        // to it.
        const [projectId] = await resolveScopeProjectIds(ctx, input.projectKey);
        if (!projectId) {
          return JSON.stringify({
            error: `Project "${input.projectKey}" not found or not accessible`,
          });
        }

        let assigneeId: string | undefined;
        if (input.assigneeEmail) {
          const user = await ctx.prisma.user.findUnique({
            where: { email: input.assigneeEmail },
            select: { id: true },
          });
          if (!user) {
            return JSON.stringify({
              error: `No user with email ${input.assigneeEmail}`,
            });
          }
          assigneeId = user.id;
        }

        // Team by name (issue-team tagging is project metadata, not gated by
        // membership — mirrors the REST create endpoint).
        let teamIds: string[] | undefined;
        if (input.team) {
          const name = input.team.replace(/\s*teams?\s*$/i, '').trim();
          const team = await ctx.prisma.team.findFirst({
            where: { name: { contains: name, mode: 'insensitive' } },
            select: { id: true },
          });
          if (!team) {
            return JSON.stringify({ error: `No team matching "${input.team}"` });
          }
          teamIds = [team.id];
        }

        // Status by name (project-scoped, case-insensitive).
        let statusId: string | undefined;
        if (input.status) {
          const all = await ctx.prisma.status.findMany({
            where: { projectId },
            select: { id: true, name: true },
          });
          const match = all.find((s) => norm(s.name) === norm(input.status!));
          if (!match) {
            return JSON.stringify({
              error: `No status "${input.status}". Available: ${all
                .map((s) => s.name)
                .join(', ')}`,
            });
          }
          statusId = match.id;
        }

        // Sprint by name (project-scoped).
        let sprintId: string | undefined;
        let sprintName: string | null = null;
        if (input.sprint) {
          const sprints = await ctx.prisma.sprint.findMany({
            where: { projectId },
            select: { id: true, name: true },
          });
          const match = sprints.find((s) => norm(s.name) === norm(input.sprint!));
          if (!match) {
            return JSON.stringify({ error: `No sprint "${input.sprint}"` });
          }
          sprintId = match.id;
          sprintName = match.name;
        }

        // Parent by key (must live in the same project).
        let parentId: string | undefined;
        if (input.parentKey) {
          const parent = await ctx.prisma.issue.findUnique({
            where: { key: input.parentKey.toUpperCase() },
            select: { id: true, projectId: true },
          });
          if (!parent || parent.projectId !== projectId) {
            return JSON.stringify({
              error: `Parent ${input.parentKey} not found in this project`,
            });
          }
          parentId = parent.id;
        }

        // Labels by name (project-scoped, additive — unknown ones are warned).
        let labelIds: string[] | undefined;
        if (input.labels?.length) {
          const all = await ctx.prisma.label.findMany({
            where: { projectId },
            select: { id: true, name: true },
          });
          const ids: string[] = [];
          for (const want of input.labels) {
            const match = all.find((l) => norm(l.name) === norm(want));
            if (match) ids.push(match.id);
            else warnings.push(`no label "${want}"`);
          }
          labelIds = ids.length ? ids : undefined;
        }

        const validDate = (raw: string | undefined, field: string): string | undefined => {
          if (!raw) return undefined;
          const d = new Date(raw);
          if (Number.isNaN(d.getTime())) {
            throw new Error(`Invalid ${field} "${raw}" (use ISO YYYY-MM-DD)`);
          }
          return d.toISOString();
        };

        const created = await ctx.issues.create(
          input.projectKey,
          {
            type: input.type as IssueType,
            title: input.title,
            description: input.description,
            priority: input.priority as Priority | undefined,
            assigneeId,
            teamIds,
            statusId,
            sprintId,
            parentId,
            labelIds,
            storyPoints:
              typeof input.storyPoints === 'number' ? input.storyPoints : undefined,
            startDate: validDate(input.startDate, 'startDate'),
            dueDate: validDate(input.dueDate, 'dueDate'),
          },
          ctx.userId,
        );

        // Custom fields — resolve, coerce, and set via the validated service.
        const appliedCustom = await applyCustomFields(
          ctx,
          created.key,
          projectId,
          input.customFields,
          warnings,
        );

        // Index the new issue for future semantic retrieval (best-effort).
        void ctx.rag.ingestIssue(created.id).catch(() => undefined);

        // The DTO carries statusId only; resolve its name for the confirmation
        // (covers the default status when none was requested).
        const statusRow = await ctx.prisma.status.findUnique({
          where: { id: created.statusId },
          select: { name: true },
        });
        const statusName = statusRow?.name ?? null;

        ctx.addReference(
          issueReference({
            id: created.id,
            key: created.key,
            title: created.title,
            status: statusName,
            priority: created.priority,
            type: created.type,
            assignee: created.assignee
              ? { displayName: created.assignee.displayName }
              : null,
          }),
        );
        ctx.addTrace({
          name: 'create_issue',
          ok: true,
          summary: `created ${created.key}`,
        });
        return JSON.stringify({
          created: true,
          key: created.key,
          title: created.title,
          status: statusName,
          priority: created.priority,
          type: created.type,
          assignee: created.assignee?.displayName ?? null,
          startDate: created.startDate,
          dueDate: created.dueDate,
          storyPoints: created.storyPoints,
          teams: created.teams.map((t) => t.name),
          labels: created.labels.map((l) => l.name),
          parentKey: created.parent?.key ?? null,
          sprint: sprintName,
          customFieldsSet: appliedCustom,
          warnings: warnings.length ? warnings : undefined,
        });
      } catch (err) {
        ctx.addTrace({ name: 'create_issue', ok: false });
        return JSON.stringify({
          error: `Could not create issue: ${(err as Error).message}`,
          warnings: warnings.length ? warnings : undefined,
        });
      }
    },
  });
