import { io, type Socket } from 'socket.io-client';
import type { QueryClient } from '@tanstack/react-query';
import type { WsEvent } from '@tasku/types';
import { qk } from './queryKeys';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

/** Lazily create (and cache) the shared socket connection. */
export function getSocket(token: string | null): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: true,
      transports: ['websocket'],
      auth: token ? { token } : undefined,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/**
 * Join a project room and translate inbound WsEvents into React Query
 * invalidations. Returns a cleanup function that leaves the room and detaches
 * the listener.
 */
export function subscribeToProject(
  token: string | null,
  projectKey: string,
  queryClient: QueryClient,
): () => void {
  const s = getSocket(token);

  const join = () => s.emit('project:join', { projectKey });
  if (s.connected) join();
  s.on('connect', join);

  const handler = (event: WsEvent) => {
    if (!event || event.projectKey !== projectKey) return;
    switch (event.type) {
      case 'issue.created':
      case 'issue.updated':
      case 'issue.moved': {
        queryClient.invalidateQueries({
          queryKey: ['project', projectKey, 'board'],
        });
        queryClient.invalidateQueries({
          queryKey: ['project', projectKey, 'issues'],
        });
        if ('issue' in event && event.issue?.key) {
          queryClient.invalidateQueries({
            queryKey: qk.issue(event.issue.key),
          });
        }
        break;
      }
      case 'comment.created': {
        queryClient.invalidateQueries({
          queryKey: qk.issue(event.issueKey),
        });
        queryClient.invalidateQueries({
          queryKey: qk.comments(event.issueKey),
        });
        break;
      }
      case 'sprint.started': {
        queryClient.invalidateQueries({
          queryKey: ['project', projectKey],
        });
        break;
      }
    }
  };

  s.on('event', handler);

  return () => {
    s.emit('project:leave', { projectKey });
    s.off('event', handler);
    s.off('connect', join);
  };
}
