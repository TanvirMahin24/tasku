import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToProject } from '@/lib/socket';
import { useAuthStore } from '@/store/auth';

/**
 * Joins the given project's realtime room and invalidates relevant queries
 * when other clients change issues/comments/sprints. No-op without a key.
 */
export function useProjectSocket(projectKey: string | undefined): void {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!projectKey) return;
    const unsubscribe = subscribeToProject(token, projectKey, queryClient);
    return unsubscribe;
  }, [projectKey, token, queryClient]);
}
