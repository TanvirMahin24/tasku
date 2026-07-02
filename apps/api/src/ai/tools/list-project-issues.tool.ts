import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import type { ToolFactory } from './types';
import { issueReference, resolveScopeProjectIds } from './util';

/** List issues in a project, optionally filtered by status name. */
export const listProjectIssuesTool: ToolFactory = (ctx) =>
  new DynamicStructuredTool({
    name: 'list_project_issues',
    description:
      'List issues in a single project (by key), optionally filtered to one ' +
      'status. Useful for "what is in progress in TASK" style questions.',
    schema: z.object({
      projectKey: z.string().describe('Project key, e.g. TASK'),
      status: z.string().optional().describe('Status name to filter by'),
    }),
    func: async (input) => {
      const projectIds = await resolveScopeProjectIds(ctx, input.projectKey);
      if (!projectIds.length) {
        return JSON.stringify({
          error: `Project ${input.projectKey} not found or not accessible`,
        });
      }

      const where: Prisma.IssueWhereInput = { projectId: projectIds[0] };
      if (input.status) {
        where.status = { name: { equals: input.status, mode: 'insensitive' } };
      }

      const issues = await ctx.prisma.issue.findMany({
        where,
        include: { status: true, assignee: true },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      });

      const results = issues.map((i) => {
        ctx.addReference(issueReference(i));
        return {
          key: i.key,
          title: i.title,
          status: i.status?.name ?? null,
          type: i.type,
          priority: i.priority,
          assignee: i.assignee?.displayName ?? null,
        };
      });

      ctx.addTrace({
        name: 'list_project_issues',
        ok: true,
        summary: `${results.length} issue(s) in ${input.projectKey}`,
      });
      return JSON.stringify({ results });
    },
  });
