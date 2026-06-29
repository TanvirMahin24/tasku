import { useQuery } from '@tanstack/react-query';
import { projectsApi, sprintsApi, usersApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';

/** Fetches the building blocks needed by issue create/edit forms. */
export function useProjectMeta(projectKey: string) {
  const statuses = useQuery({
    queryKey: qk.statuses(projectKey),
    queryFn: () => projectsApi.statuses(projectKey),
    enabled: !!projectKey,
  });
  const labels = useQuery({
    queryKey: qk.labels(projectKey),
    queryFn: () => projectsApi.labels(projectKey),
    enabled: !!projectKey,
  });
  const sprints = useQuery({
    queryKey: qk.sprints(projectKey),
    queryFn: () => sprintsApi.list(projectKey),
    enabled: !!projectKey,
  });
  const users = useQuery({
    queryKey: qk.users,
    queryFn: usersApi.list,
  });

  return {
    statuses: statuses.data ?? [],
    labels: labels.data ?? [],
    sprints: sprints.data ?? [],
    users: users.data ?? [],
    isLoading:
      statuses.isLoading || labels.isLoading || sprints.isLoading || users.isLoading,
  };
}
