import type { DynamicStructuredTool } from '@langchain/core/tools';
import type { ChatContext, ChatReference, ToolCallTrace } from '@tasku/types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { IssuesService } from '../../issues/issues.service';
import type { CustomFieldsService } from '../../custom-fields/custom-fields.service';
import type { RagService } from '../rag/rag.service';

/**
 * Everything a tool needs to run for the current request. Tools are pure
 * factories over this context, so a new tool is just one file + one line in
 * {@link ./index.ts}.
 */
export interface ToolContext {
  userId: string;
  /** Project ids the caller is a member of — the hard access boundary. */
  memberProjectIds: string[];
  /** Team ids the caller belongs to — knowledge-base scope. */
  memberTeamIds: string[];
  chatContext?: ChatContext | null;
  prisma: PrismaService;
  issues: IssuesService;
  customFields: CustomFieldsService;
  rag: RagService;
  /** Attach a citation to the answer (deduped by the agent). */
  addReference: (ref: ChatReference) => void;
  /** Record that a tool ran (transparency trace). */
  addTrace: (trace: ToolCallTrace) => void;
}

export type ToolFactory = (ctx: ToolContext) => DynamicStructuredTool;
