import type { DynamicStructuredTool } from '@langchain/core/tools';
import type { ToolContext, ToolFactory } from './types';
import { searchIssuesTool } from './search-issues.tool';
import { getIssueTool } from './get-issue.tool';
import { createIssueTool } from './create-issue.tool';
import { updateIssueTool } from './update-issue.tool';
import { listProjectIssuesTool } from './list-project-issues.tool';
import { getContextTool } from './get-context.tool';
import { searchKnowledgeTool } from './search-knowledge.tool';

/**
 * The Majhi tool registry. Adding a capability = write a `*.tool.ts` factory
 * and add it to this array — nothing else changes.
 */
export const TOOL_FACTORIES: ToolFactory[] = [
  getContextTool,
  searchIssuesTool,
  getIssueTool,
  listProjectIssuesTool,
  searchKnowledgeTool,
  createIssueTool,
  updateIssueTool,
];

export function buildTools(ctx: ToolContext): DynamicStructuredTool[] {
  return TOOL_FACTORIES.map((factory) => factory(ctx));
}

export type { ToolContext, ToolFactory } from './types';
