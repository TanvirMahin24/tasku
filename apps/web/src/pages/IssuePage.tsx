import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { issuesApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { PageSpinner } from '@/components/ui/Spinner';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { IssueDrawer } from '@/components/IssueDrawer';
import { Button } from '@/components/ui/Button';

/**
 * Standalone issue route (used by notification deep-links). We fetch the issue
 * to discover its project key, then present the shared IssueDrawer. Closing
 * navigates back to the project board.
 */
export default function IssuePage() {
  const { issueKey = '' } = useParams<{ issueKey: string }>();
  const navigate = useNavigate();

  const { data: issue, isLoading, error } = useQuery({
    queryKey: qk.issue(issueKey),
    queryFn: () => issuesApi.get(issueKey),
    enabled: !!issueKey,
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title={issueKey} />
        <PageSpinner label="Loading issue…" />
      </>
    );
  }

  if (error || !issue) {
    return (
      <>
        <PageHeader title={issueKey} />
        <div className="p-6">
          <EmptyState
            title="Issue not found"
            description="This issue may have been deleted or you may not have access."
            action={<Button onClick={() => navigate('/')}>Back to projects</Button>}
          />
        </div>
      </>
    );
  }

  function close() {
    navigate(`/projects/${issue!.projectKey}/board`);
  }

  return (
    <>
      <PageHeader
        title={issue.projectKey}
        subtitle="Viewing issue"
        actions={
          <Button
            variant="secondary"
            onClick={() => navigate(`/projects/${issue.projectKey}/board`)}
          >
            Open board
          </Button>
        }
      />
      <div className="flex-1 bg-gray-50 dark:bg-gray-950" />
      <IssueDrawer
        projectKey={issue.projectKey}
        issueKey={issueKey}
        open
        onClose={close}
        onDeleted={close}
      />
    </>
  );
}
