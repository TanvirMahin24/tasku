import { useLocation } from 'react-router-dom';
import type { ChatContext } from '@tasku/types';

export interface DerivedMajhiContext {
  context: ChatContext;
  /** Human label for the header chip, e.g. "Board · TASK". */
  label: string;
}

/** Project key prefix of an issue key (TASK-12 -> TASK). */
function projectKeyOfIssue(issueKey: string): string | null {
  const idx = issueKey.lastIndexOf('-');
  return idx > 0 ? issueKey.slice(0, idx) : null;
}

/**
 * Derives a ChatContext from the current route so Majhi can ground its answer
 * in whatever the user is looking at. Purely path-based so it works app-wide
 * without every page having to pass context down.
 */
export function useMajhiContext(): DerivedMajhiContext {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);

  // /issues/:issueKey
  if (parts[0] === 'issues' && parts[1]) {
    const key = decodeURIComponent(parts[1]);
    return {
      context: {
        type: 'issue',
        id: key,
        projectKey: projectKeyOfIssue(key),
      },
      label: `Issue · ${key}`,
    };
  }

  // /views/:id
  if (parts[0] === 'views' && parts[1]) {
    return { context: { type: 'view', id: parts[1] }, label: 'View' };
  }

  // /teams/:id
  if (parts[0] === 'teams' && parts[1]) {
    return { context: { type: 'team', id: parts[1] }, label: 'Team' };
  }

  // /dashboard
  if (parts[0] === 'dashboard') {
    return { context: { type: 'dashboard' }, label: 'Your work' };
  }

  // /projects/:key/...
  if (parts[0] === 'projects' && parts[1]) {
    const projectKey = parts[1];
    const sub = parts[2];
    if (sub === 'board' || sub === 'boards') {
      return {
        context: { type: 'board', projectKey },
        label: `Board · ${projectKey}`,
      };
    }
    if (sub === 'releases') {
      return {
        context: { type: 'release', projectKey },
        label: `Releases · ${projectKey}`,
      };
    }
    return {
      context: { type: 'project', projectKey },
      label: `Space · ${projectKey}`,
    };
  }

  return { context: { type: 'global' }, label: 'General' };
}
