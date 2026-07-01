import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ToolFactory } from './types';

/** Semantic search over the user's knowledge base (team + project docs). */
export const searchKnowledgeTool: ToolFactory = (ctx) =>
  new DynamicStructuredTool({
    name: 'search_knowledge_base',
    description:
      'Search the knowledge base (uploaded docs and linked Google Docs/Sheets/' +
      'Slides) the user can access. Use for "how do we…", policy, spec or ' +
      'documentation questions. Returns relevant passages with their source.',
    schema: z.object({
      query: z.string().describe('What to look up in the knowledge base'),
    }),
    func: async (input) => {
      const hits = await ctx.rag.retrieveKnowledge(
        input.query,
        { teamIds: ctx.memberTeamIds, projectIds: ctx.memberProjectIds },
        6,
      );
      if (!hits.length) {
        ctx.addTrace({
          name: 'search_knowledge_base',
          ok: true,
          summary: 'no matches',
        });
        return JSON.stringify({ results: [], note: 'No relevant documents found' });
      }

      // Dedup references per doc; keep every passage in the tool output.
      const seenDocs = new Set<string>();
      const results = hits.map((h) => {
        if (!seenDocs.has(h.docId)) {
          seenDocs.add(h.docId);
          ctx.addReference({
            kind: 'knowledge',
            id: h.docId,
            title: h.title,
            url: h.url ?? null,
          });
        }
        return {
          title: h.title,
          url: h.url ?? null,
          excerpt: h.content.slice(0, 500),
          score: Number(h.score.toFixed(3)),
        };
      });

      ctx.addTrace({
        name: 'search_knowledge_base',
        ok: true,
        summary: `${results.length} passage(s)`,
      });
      return JSON.stringify({ results });
    },
  });
