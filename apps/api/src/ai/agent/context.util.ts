import type { ChatContext, ChatReference } from '@tasku/types';
import type { PrismaService } from '../../prisma/prisma.service';

export interface ResolvedContext {
  summary: string;
  references: ChatReference[];
}

/**
 * Turn the caller's {@link ChatContext} (where in the app they asked Majhi
 * from) into a short natural-language summary plus seed references, so answers
 * are grounded even when the model skips tool calls. Access is checked against
 * the caller's project/team memberships; inaccessible context yields a note.
 */
export async function resolveChatContext(
  prisma: PrismaService,
  ctx: ChatContext | null | undefined,
  userId: string,
  memberProjectIds: string[],
  memberTeamIds: string[],
): Promise<ResolvedContext> {
  if (!ctx || ctx.type === 'global' || ctx.type === 'dashboard') {
    return {
      summary:
        'The user is in a global/dashboard context (no single project or issue).',
      references: [],
    };
  }
  const references: ChatReference[] = [];

  try {
    switch (ctx.type) {
      case 'issue': {
        if (!ctx.id) break;
        const issue = await prisma.issue.findUnique({
          where: { key: ctx.id },
          include: { status: true, assignee: true, project: { select: { key: true } } },
        });
        if (!issue || !memberProjectIds.includes(issue.projectId)) {
          return notAccessible('issue', ctx.id);
        }
        references.push({
          kind: 'issue',
          id: issue.id,
          key: issue.key,
          title: issue.title,
          url: `/issues/${issue.key}`,
          status: issue.status?.name ?? null,
        });
        return {
          summary:
            `Current issue: ${issue.key} "${issue.title}" ` +
            `[status: ${issue.status?.name ?? 'n/a'}, type: ${issue.type}, ` +
            `priority: ${issue.priority}, assignee: ${issue.assignee?.displayName ?? 'unassigned'}].`,
          references,
        };
      }

      case 'project': {
        const key = ctx.projectKey ?? ctx.id;
        if (!key) break;
        const project = await prisma.project.findUnique({
          where: { key },
          select: { id: true, key: true, name: true },
        });
        if (!project || !memberProjectIds.includes(project.id)) {
          return notAccessible('project', key);
        }
        const total = await prisma.issue.count({
          where: { projectId: project.id },
        });
        return {
          summary: `Current project: ${project.key} "${project.name}" (${total} issues).`,
          references,
        };
      }

      case 'board': {
        if (!ctx.id) break;
        const board = await prisma.board.findUnique({
          where: { id: ctx.id },
          include: { project: { select: { id: true, key: true, name: true } } },
        });
        if (!board || !memberProjectIds.includes(board.projectId)) {
          return notAccessible('board', ctx.id);
        }
        references.push({
          kind: 'board',
          id: board.id,
          title: board.name,
          url: `/projects/${board.project.key}/board`,
        });
        return {
          summary: `Current board: "${board.name}" in project ${board.project.key}.`,
          references,
        };
      }

      case 'view': {
        if (!ctx.id) break;
        const view = await prisma.view.findUnique({
          where: { id: ctx.id },
          select: {
            id: true,
            title: true,
            teamId: true,
            scope: true,
            archived: true,
          },
        });
        if (
          !view ||
          view.archived ||
          (view.scope === 'TEAM' && view.teamId && !memberTeamIds.includes(view.teamId))
        ) {
          return notAccessible('view', ctx.id);
        }
        references.push({
          kind: 'view',
          id: view.id,
          title: view.title,
          url: `/views/${view.id}`,
        });
        return { summary: `Current view: "${view.title}".`, references };
      }

      case 'release': {
        if (!ctx.id) break;
        const version = await prisma.version.findUnique({
          where: { id: ctx.id },
          include: { project: { select: { id: true, key: true } } },
        });
        if (!version || !memberProjectIds.includes(version.projectId)) {
          return notAccessible('release', ctx.id);
        }
        references.push({
          kind: 'release',
          id: version.id,
          title: version.name,
          url: `/projects/${version.project.key}/releases`,
          status: version.released ? 'Released' : 'Unreleased',
        });
        return {
          summary:
            `Current release: "${version.name}" in ${version.project.key} ` +
            `(${version.released ? 'released' : 'unreleased'}).`,
          references,
        };
      }

      case 'team': {
        if (!ctx.id) break;
        const team = await prisma.team.findUnique({
          where: { id: ctx.id },
          include: { _count: { select: { members: true } } },
        });
        if (!team || !memberTeamIds.includes(team.id)) {
          return notAccessible('team', ctx.id);
        }
        references.push({
          kind: 'team',
          id: team.id,
          title: team.name,
          url: `/teams/${team.id}`,
        });
        return {
          summary: `Current team: "${team.name}" (${team._count.members} members).`,
          references,
        };
      }
    }
  } catch {
    // fall through to generic note
  }

  return { summary: 'No specific context could be resolved.', references };
}

function notAccessible(kind: string, id: string): ResolvedContext {
  return {
    summary: `The referenced ${kind} (${id}) is not accessible to the user.`,
    references: [],
  };
}
