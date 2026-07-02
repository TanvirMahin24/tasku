import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { Priority } from '@prisma/client';
import type { ToolFactory } from './types';
import { issueReference } from './util';

/** Update an issue via IssuesService (status by name, assignee by email). */
export const updateIssueTool: ToolFactory = (ctx) =>
  new DynamicStructuredTool({
    name: 'update_issue',
    description:
      'Update an existing issue by key. Can change the status (by name), the ' +
      'assignee (by email), the priority and/or the title.',
    schema: z.object({
      key: z.string().describe('Issue key, e.g. TASK-12'),
      statusName: z.string().optional().describe('Target status name, e.g. "Done"'),
      assigneeEmail: z
        .string()
        .optional()
        .describe('New assignee email, or empty string to unassign'),
      priority: z.string().optional().describe('LOWEST, LOW, MEDIUM, HIGH, HIGHEST'),
      title: z.string().optional(),
    }),
    func: async (input) => {
      const issue = await ctx.prisma.issue.findUnique({
        where: { key: input.key },
        select: { id: true, projectId: true },
      });
      if (!issue || !ctx.memberProjectIds.includes(issue.projectId)) {
        return JSON.stringify({
          error: `Issue ${input.key} not found or not accessible`,
        });
      }

      const dto: {
        statusId?: string;
        assigneeId?: string | null;
        priority?: Priority;
        title?: string;
      } = {};

      if (input.statusName) {
        const status = await ctx.prisma.status.findFirst({
          where: {
            projectId: issue.projectId,
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
        if (input.assigneeEmail === '') {
          dto.assigneeId = null;
        } else {
          const user = await ctx.prisma.user.findUnique({
            where: { email: input.assigneeEmail },
            select: { id: true },
          });
          if (!user) {
            return JSON.stringify({
              error: `No user with email ${input.assigneeEmail}`,
            });
          }
          dto.assigneeId = user.id;
        }
      }

      if (input.priority) dto.priority = input.priority as Priority;
      if (input.title) dto.title = input.title;

      try {
        const updated = await ctx.issues.update(input.key, dto, ctx.userId);
        void ctx.rag.ingestIssue(updated.id).catch(() => undefined);
        ctx.addReference(
          issueReference({
            id: updated.id,
            key: updated.key,
            title: updated.title,
            status: input.statusName ?? null,
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
        return JSON.stringify({ updated: true, key: updated.key });
      } catch (err) {
        ctx.addTrace({ name: 'update_issue', ok: false, summary: input.key });
        return JSON.stringify({
          error: `Could not update ${input.key}: ${(err as Error).message}`,
        });
      }
    },
  });
