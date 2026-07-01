import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolFactory } from './types';
import { resolveChatContext } from '../agent/context.util';

/**
 * Resolve the caller's current app context (board/view/issue/release/team/
 * project/dashboard) into a summary, seeding its references.
 */
export const getContextTool: ToolFactory = (ctx) =>
  new DynamicStructuredTool({
    name: 'get_context',
    description:
      'Return a summary of what the user is currently looking at in the app ' +
      '(the current issue, project, board, view, release or team). Call this ' +
      'when the user says "this", "here", "current" or asks about their context.',
    schema: z.object({}),
    func: async () => {
      const resolved = await resolveChatContext(
        ctx.prisma,
        ctx.chatContext,
        ctx.userId,
        ctx.memberProjectIds,
        ctx.memberTeamIds,
      );
      resolved.references.forEach((r) => ctx.addReference(r));
      ctx.addTrace({ name: 'get_context', ok: true });
      return JSON.stringify({ context: resolved.summary });
    },
  });
