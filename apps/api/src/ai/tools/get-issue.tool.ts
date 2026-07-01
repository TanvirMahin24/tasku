import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolFactory } from './types';
import { docToText } from '../rag/chunk.util';
import { issueReference } from './util';

/** Full detail for a single issue by key (membership-checked). */
export const getIssueTool: ToolFactory = (ctx) =>
  new DynamicStructuredTool({
    name: 'get_issue',
    description:
      'Get the full details of one issue by its key (e.g. TASK-12): title, ' +
      'description, status, type, priority, assignee, reporter and subtask progress.',
    schema: z.object({
      key: z.string().describe('Issue key, e.g. TASK-12'),
    }),
    func: async (input) => {
      const issue = await ctx.prisma.issue.findUnique({
        where: { key: input.key },
        include: {
          status: true,
          assignee: true,
          reporter: true,
          children: { include: { status: true } },
        },
      });
      if (!issue || !ctx.memberProjectIds.includes(issue.projectId)) {
        ctx.addTrace({ name: 'get_issue', ok: false, summary: input.key });
        return JSON.stringify({
          error: `Issue ${input.key} not found or not accessible`,
        });
      }

      ctx.addReference(issueReference(issue));
      const done = issue.children.filter(
        (c) => c.status?.category === 'DONE',
      ).length;

      ctx.addTrace({ name: 'get_issue', ok: true, summary: issue.key });
      return JSON.stringify({
        key: issue.key,
        title: issue.title,
        description: docToText(issue.description).slice(0, 1500),
        status: issue.status?.name ?? null,
        type: issue.type,
        priority: issue.priority,
        assignee: issue.assignee?.displayName ?? null,
        reporter: issue.reporter?.displayName ?? null,
        subtasks: issue.children.length
          ? { total: issue.children.length, done }
          : null,
      });
    },
  });
