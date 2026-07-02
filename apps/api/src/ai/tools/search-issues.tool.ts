import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import type { ToolFactory } from './types';
import { issueReference, resolveScopeProjectIds } from './util';

/**
 * Semantic + filtered issue search. Uses vector retrieval when `text` is given
 * (falling back to substring match), then applies the structured filters.
 */
export const searchIssuesTool: ToolFactory = (ctx) =>
  new DynamicStructuredTool({
    name: 'search_issues',
    description:
      'Search issues across the projects the user can access. Use `text` for a ' +
      'natural-language/semantic query and the other fields to filter. Returns ' +
      'matching issues with their key, title, status, type, priority and assignee.',
    schema: z.object({
      text: z.string().optional().describe('Free-text/semantic query'),
      projectKey: z.string().optional().describe('Restrict to one project, e.g. TASK'),
      status: z.string().optional().describe('Status name, e.g. "In Progress"'),
      assignee: z.string().optional().describe('Assignee email or display name'),
      type: z.string().optional().describe('Issue type e.g. STORY, BUG, TASK'),
      priority: z.string().optional().describe('Priority e.g. HIGH, MEDIUM'),
    }),
    func: async (input) => {
      const projectIds = await resolveScopeProjectIds(ctx, input.projectKey);
      if (!projectIds.length) {
        ctx.addTrace({ name: 'search_issues', ok: true, summary: 'no accessible projects' });
        return JSON.stringify({ results: [], note: 'No accessible projects' });
      }

      let orderedIds: string[] = [];
      if (input.text) {
        const hits = await ctx.rag.retrieveIssues(input.text, projectIds, 12);
        orderedIds = hits.map((h) => h.issueId);
      }

      const where: Prisma.IssueWhereInput = { projectId: { in: projectIds } };
      if (orderedIds.length) {
        where.id = { in: orderedIds };
      } else if (input.text) {
        where.OR = [
          { title: { contains: input.text, mode: 'insensitive' } },
          { key: { contains: input.text, mode: 'insensitive' } },
        ];
      }
      if (input.status) {
        where.status = { name: { equals: input.status, mode: 'insensitive' } };
      }
      if (input.type) where.type = input.type as Prisma.IssueWhereInput['type'];
      if (input.priority) {
        where.priority = input.priority as Prisma.IssueWhereInput['priority'];
      }
      if (input.assignee) {
        where.assignee = {
          OR: [
            { email: { equals: input.assignee, mode: 'insensitive' } },
            { displayName: { contains: input.assignee, mode: 'insensitive' } },
          ],
        };
      }

      const issues = await ctx.prisma.issue.findMany({
        where,
        include: { status: true, assignee: true },
        take: 8,
      });

      // Preserve semantic ordering when we have it.
      if (orderedIds.length) {
        const rank = new Map(orderedIds.map((id, i) => [id, i]));
        issues.sort(
          (a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999),
        );
      }

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
        name: 'search_issues',
        ok: true,
        summary: `${results.length} issue(s)`,
      });
      return JSON.stringify({ results });
    },
  });
