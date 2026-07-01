import type { ChatReference } from '@tasku/types';
import type { ToolContext } from './types';

/** In-app route to an issue (used as a reference url). */
export function issueUrl(key: string): string {
  return `/issues/${key}`;
}

export function issueReference(issue: {
  id: string;
  key: string;
  title: string;
  status?: { name: string } | string | null;
  priority?: string | null;
  type?: string | null;
  assignee?: { displayName: string } | null;
}): ChatReference {
  const statusName =
    typeof issue.status === 'string'
      ? issue.status
      : (issue.status?.name ?? null);
  return {
    kind: 'issue',
    id: issue.id,
    key: issue.key,
    title: issue.title,
    url: issueUrl(issue.key),
    status: statusName,
    meta: {
      type: issue.type ?? null,
      priority: issue.priority ?? null,
      assignee: issue.assignee?.displayName ?? null,
    },
  };
}

/**
 * Resolve the project ids a tool may read. When `projectKey` is given it is
 * validated against the caller's memberships; otherwise all member projects.
 */
export async function resolveScopeProjectIds(
  ctx: ToolContext,
  projectKey?: string,
): Promise<string[]> {
  if (!projectKey) return ctx.memberProjectIds;
  const project = await ctx.prisma.project.findUnique({
    where: { key: projectKey },
    select: { id: true },
  });
  if (!project || !ctx.memberProjectIds.includes(project.id)) return [];
  return [project.id];
}
