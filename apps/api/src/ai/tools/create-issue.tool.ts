import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { IssueType, Priority } from '@prisma/client';
import type { ToolFactory } from './types';
import { issueReference } from './util';

/** Create an issue via IssuesService (membership-checked, full side effects). */
export const createIssueTool: ToolFactory = (ctx) =>
  new DynamicStructuredTool({
    name: 'create_issue',
    description:
      'Create a new issue in a project the user can access. Requires projectKey, ' +
      'type (STORY, TASK, BUG, EPIC, IDEA, SUBTASK) and title. Optionally set ' +
      'description, priority and an assignee by email.',
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
    }),
    func: async (input) => {
      try {
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

        const created = await ctx.issues.create(
          input.projectKey,
          {
            type: input.type as IssueType,
            title: input.title,
            description: input.description,
            priority: input.priority as Priority | undefined,
            assigneeId,
          },
          ctx.userId,
        );

        // Index the new issue for future semantic retrieval (best-effort).
        void ctx.rag.ingestIssue(created.id).catch(() => undefined);

        ctx.addReference(
          issueReference({
            id: created.id,
            key: created.key,
            title: created.title,
            status: null,
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
        });
      } catch (err) {
        ctx.addTrace({ name: 'create_issue', ok: false });
        return JSON.stringify({
          error: `Could not create issue: ${(err as Error).message}`,
        });
      }
    },
  });
