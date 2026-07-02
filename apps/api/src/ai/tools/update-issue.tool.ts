import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { IssueType, Priority } from '@prisma/client';
import type { ToolFactory } from './types';
import { applyCustomFields, issueReference, norm } from './util';

/**
 * Update an existing issue. Scalars set directly; labels/teams add or remove
 * against the current set; dates/parent/sprint clear on empty string; custom
 * fields resolve by name.
 */
export const updateIssueTool: ToolFactory = (ctx) =>
  new DynamicStructuredTool({
    name: 'update_issue',
    description:
      'Update an existing issue by key. Can change title, description, type, ' +
      'priority, status (by name), assignee (by email; empty to unassign), story ' +
      'points, start/due dates (empty string clears), parent (issue key), sprint ' +
      '(by name), add/remove labels and teams (by name), and set custom fields.',
    schema: z.object({
      key: z.string().describe('Issue key, e.g. TASK-12'),
      title: z.string().optional(),
      description: z.string().optional(),
      type: z.string().optional().describe('STORY, TASK, BUG, EPIC, IDEA, SUBTASK'),
      priority: z.string().optional().describe('LOWEST, LOW, MEDIUM, HIGH, HIGHEST'),
      statusName: z.string().optional().describe('Target status name, e.g. "Done"'),
      assigneeEmail: z
        .string()
        .optional()
        .describe('New assignee email; empty string / "none" to unassign'),
      storyPoints: z.number().optional(),
      startDate: z.string().optional().describe('ISO YYYY-MM-DD; empty string clears'),
      dueDate: z.string().optional().describe('ISO YYYY-MM-DD; empty string clears'),
      parentKey: z
        .string()
        .optional()
        .describe('Parent issue key; empty string clears the parent'),
      sprint: z.string().optional().describe('Sprint name; empty string clears'),
      addLabels: z.array(z.string()).optional().describe('Label names to add'),
      removeLabels: z.array(z.string()).optional().describe('Label names to remove'),
      addTeams: z.array(z.string()).optional().describe('Team names to add'),
      removeTeams: z.array(z.string()).optional().describe('Team names to remove'),
      customFields: z
        .array(z.object({ name: z.string(), value: z.string() }))
        .optional()
        .describe('Custom fields to set as {name, value}; empty value clears'),
    }),
    func: async (input) => {
      const warnings: string[] = [];
      const issue = await ctx.prisma.issue.findUnique({
        where: { key: input.key.toUpperCase() },
        select: { id: true, projectId: true },
      });
      if (!issue || !ctx.memberProjectIds.includes(issue.projectId)) {
        return JSON.stringify({
          error: `Issue ${input.key} not found or not accessible`,
        });
      }
      const projectId = issue.projectId;

      const dto: Parameters<typeof ctx.issues.update>[1] = {};

      if (input.title) dto.title = input.title;
      if (input.description !== undefined) dto.description = input.description;
      if (input.type) dto.type = input.type as IssueType;
      if (input.priority) dto.priority = input.priority as Priority;
      if (typeof input.storyPoints === 'number') dto.storyPoints = input.storyPoints;

      if (input.statusName) {
        const status = await ctx.prisma.status.findFirst({
          where: {
            projectId,
            name: { equals: input.statusName, mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (!status) {
          return JSON.stringify({
            error: `No status named "${input.statusName}" in that project`,
          });
        }
        dto.statusId = status.id;
      }

      if (input.assigneeEmail !== undefined) {
        const v = input.assigneeEmail.trim().toLowerCase();
        if (v === '' || v === 'none' || v === 'unassigned') {
          dto.assigneeId = null;
        } else {
          const user = await ctx.prisma.user.findUnique({
            where: { email: input.assigneeEmail },
            select: { id: true },
          });
          if (!user) {
            return JSON.stringify({ error: `No user with email ${input.assigneeEmail}` });
          }
          dto.assigneeId = user.id;
        }
      }

      // Dates: empty string clears; otherwise validate ISO.
      const parseDate = (raw: string): string | null | undefined => {
        if (raw === '') return null;
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
      };
      if (input.startDate !== undefined) {
        const v = parseDate(input.startDate);
        if (v === undefined) return JSON.stringify({ error: `Invalid startDate "${input.startDate}"` });
        dto.startDate = v;
      }
      if (input.dueDate !== undefined) {
        const v = parseDate(input.dueDate);
        if (v === undefined) return JSON.stringify({ error: `Invalid dueDate "${input.dueDate}"` });
        dto.dueDate = v;
      }

      if (input.parentKey !== undefined) {
        if (input.parentKey === '') {
          dto.parentId = null;
        } else {
          const parent = await ctx.prisma.issue.findUnique({
            where: { key: input.parentKey.toUpperCase() },
            select: { id: true, projectId: true },
          });
          if (!parent || parent.projectId !== projectId) {
            return JSON.stringify({
              error: `Parent ${input.parentKey} not found in this project`,
            });
          }
          dto.parentId = parent.id;
        }
      }

      if (input.sprint !== undefined) {
        if (input.sprint === '') {
          dto.sprintId = null;
        } else {
          const sprint = await ctx.prisma.sprint.findFirst({
            where: { projectId, name: { equals: input.sprint, mode: 'insensitive' } },
            select: { id: true },
          });
          if (!sprint) return JSON.stringify({ error: `No sprint "${input.sprint}"` });
          dto.sprintId = sprint.id;
        }
      }

      // Labels: add/remove against the current set (update replaces the whole set).
      if (input.addLabels?.length || input.removeLabels?.length) {
        const projLabels = await ctx.prisma.label.findMany({
          where: { projectId },
          select: { id: true, name: true },
        });
        const current = new Set(
          (
            await ctx.prisma.issueLabel.findMany({
              where: { issueId: issue.id },
              select: { labelId: true },
            })
          ).map((r) => r.labelId),
        );
        const idFor = (name: string): string | undefined =>
          projLabels.find((l) => norm(l.name) === norm(name))?.id;
        for (const n of input.addLabels ?? []) {
          const id = idFor(n);
          if (id) current.add(id);
          else warnings.push(`no label "${n}"`);
        }
        for (const n of input.removeLabels ?? []) {
          const id = idFor(n);
          if (id) current.delete(id);
          else warnings.push(`no label "${n}"`);
        }
        dto.labelIds = [...current];
      }

      // Teams: add/remove against the current set (teams are global metadata).
      if (input.addTeams?.length || input.removeTeams?.length) {
        const allTeams = await ctx.prisma.team.findMany({
          select: { id: true, name: true },
        });
        const withTeams = await ctx.prisma.issue.findUnique({
          where: { id: issue.id },
          select: { teams: { select: { id: true } } },
        });
        const current = new Set((withTeams?.teams ?? []).map((t) => t.id));
        const idFor = (name: string): string | undefined => {
          const s = norm(name.replace(/\s*teams?\s*$/i, ''));
          return (
            allTeams.find((t) => norm(t.name) === s)?.id ??
            allTeams.find((t) => norm(t.name).includes(s))?.id
          );
        };
        for (const n of input.addTeams ?? []) {
          const id = idFor(n);
          if (id) current.add(id);
          else warnings.push(`no team "${n}"`);
        }
        for (const n of input.removeTeams ?? []) {
          const id = idFor(n);
          if (id) current.delete(id);
          else warnings.push(`no team "${n}"`);
        }
        dto.teamIds = [...current];
      }

      try {
        const updated = await ctx.issues.update(input.key, dto, ctx.userId);

        const appliedCustom = await applyCustomFields(
          ctx,
          updated.key,
          projectId,
          input.customFields,
          warnings,
        );

        void ctx.rag.ingestIssue(updated.id).catch(() => undefined);

        const statusRow = await ctx.prisma.status.findUnique({
          where: { id: updated.statusId },
          select: { name: true },
        });
        ctx.addReference(
          issueReference({
            id: updated.id,
            key: updated.key,
            title: updated.title,
            status: statusRow?.name ?? null,
            priority: updated.priority,
            type: updated.type,
            assignee: updated.assignee
              ? { displayName: updated.assignee.displayName }
              : null,
          }),
        );
        ctx.addTrace({
          name: 'update_issue',
          ok: true,
          summary: `updated ${updated.key}`,
        });
        return JSON.stringify({
          updated: true,
          key: updated.key,
          title: updated.title,
          status: statusRow?.name ?? null,
          priority: updated.priority,
          assignee: updated.assignee?.displayName ?? null,
          startDate: updated.startDate,
          dueDate: updated.dueDate,
          storyPoints: updated.storyPoints,
          teams: updated.teams.map((t) => t.name),
          labels: updated.labels.map((l) => l.name),
          parentKey: updated.parent?.key ?? null,
          customFieldsSet: appliedCustom,
          warnings: warnings.length ? warnings : undefined,
        });
      } catch (err) {
        ctx.addTrace({ name: 'update_issue', ok: false, summary: input.key });
        return JSON.stringify({
          error: `Could not update ${input.key}: ${(err as Error).message}`,
          warnings: warnings.length ? warnings : undefined,
        });
      }
    },
  });
