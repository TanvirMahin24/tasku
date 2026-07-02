import type { CustomFieldType } from '@prisma/client';
import type { ChatReference } from '@tasku/types';
import type { ToolContext } from './types';

/** Case-insensitive normalize for name matching. */
export const norm = (s: string): string => s.trim().toLowerCase();

/** In-app route to an issue (used as a reference url). */
export function issueUrl(key: string): string {
  return `/issues/${key}`;
}

/** Coerce a prompt-supplied string into the shape a custom-field type expects. */
export function convertCustomValue(type: CustomFieldType, raw: string): unknown {
  switch (type) {
    case 'NUMBER':
      return Number(raw);
    case 'CHECKBOX':
      return ['true', '1', 'yes', 'y', 'on'].includes(raw.trim().toLowerCase());
    case 'MULTI_SELECT':
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    default: // TEXT, TEXTAREA, URL, DATE, SELECT, USER
      return raw;
  }
}

/**
 * Set custom fields on an issue from `{name, value}` prompt pairs. Resolves each
 * field by name (project-scoped), coerces per type (USER -> userId), and writes
 * through the validated CustomFieldsService. Unknown fields / bad values are
 * pushed to `warnings` rather than aborting. An empty value clears the field.
 * Returns the human-readable list of applied changes.
 */
export async function applyCustomFields(
  ctx: ToolContext,
  issueKey: string,
  projectId: string,
  fields: { name: string; value: string }[] | undefined,
  warnings: string[],
): Promise<string[]> {
  const applied: string[] = [];
  if (!fields?.length) return applied;

  const defs = await ctx.prisma.customFieldDefinition.findMany({
    where: { projectId },
    select: { id: true, name: true, type: true },
  });
  for (const cf of fields) {
    const def = defs.find((d) => norm(d.name) === norm(cf.name));
    if (!def) {
      warnings.push(`no custom field "${cf.name}"`);
      continue;
    }
    try {
      let value: unknown = convertCustomValue(def.type, cf.value);
      if (def.type === 'USER' && typeof value === 'string' && value !== '') {
        const u = await ctx.prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: value, mode: 'insensitive' } },
              { displayName: { equals: value, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
        });
        if (!u) {
          warnings.push(`custom field "${def.name}": no user "${cf.value}"`);
          continue;
        }
        value = u.id;
      }
      await ctx.customFields.setValue(
        issueKey,
        def.id,
        { value: value as never },
        ctx.userId,
      );
      applied.push(`${def.name}=${cf.value || '(cleared)'}`);
    } catch (e) {
      warnings.push(`custom field "${def.name}": ${(e as Error).message}`);
    }
  }
  return applied;
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
