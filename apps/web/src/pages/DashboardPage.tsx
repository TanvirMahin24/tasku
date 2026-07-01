import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import type { IssueSummaryDto } from '@tasku/types';
import { dashboardApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { useAuthStore } from '@/store/auth';
import { Avatar } from '@/components/ui/Avatar';
import { IssueTypeIcon, PriorityIcon } from '@/components/ui/icons';
import { PageSpinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: qk.dashboard,
    queryFn: dashboardApi.get,
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <PageSpinner label="Loading your work…" />
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
          Nothing to show yet.
        </div>
      </>
    );
  }

  const firstName = user?.displayName?.split(' ')[0];

  return (
    <>
      <PageHeader
        title={firstName ? `For you, ${firstName}` : 'For you'}
        subtitle="Your work across every space"
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin bg-gray-50 p-6 dark:bg-gray-950">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title="Assigned to me" count={data.assignedToMe.length}>
            <IssueList
              issues={data.assignedToMe}
              empty="Nothing assigned — enjoy the calm."
            />
          </Section>

          <Section title="Recently worked on" count={data.recentlyUpdated.length}>
            <IssueList issues={data.recentlyUpdated} empty="No recent activity." />
          </Section>

          <Section title="Starred boards" count={data.starredBoards.length}>
            {data.starredBoards.length === 0 ? (
              <Empty text="Star a board to pin it here." />
            ) : (
              <ul className="space-y-0.5">
                {data.starredBoards.map((b) => (
                  <Link
                    key={b.id}
                    to={
                      b.isDefault
                        ? `/projects/${b.projectKey}/board`
                        : `/projects/${b.projectKey}/boards/${b.id}`
                    }
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {b.name}
                    </span>
                    <span className="truncate text-xs text-gray-400">
                      {b.projectName}
                    </span>
                  </Link>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Your spaces" count={data.projects.length}>
            {data.projects.length === 0 ? (
              <Empty text="No spaces yet." />
            ) : (
              <ul className="space-y-0.5">
                {data.projects.map((p) => (
                  <Link
                    key={p.id}
                    to={`/projects/${p.key}/board`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-600 text-[11px] font-bold text-white">
                      {p.key.slice(0, 2)}
                    </span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {p.name}
                    </span>
                    <span className="text-xs text-gray-400">{p.key}</span>
                  </Link>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {title}
        <span className="rounded-full bg-gray-100 px-1.5 text-[11px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-300">
          {count}
        </span>
      </h2>
      {children}
    </div>
  );
}

function IssueList({
  issues,
  empty,
}: {
  issues: IssueSummaryDto[];
  empty: string;
}) {
  if (issues.length === 0) return <Empty text={empty} />;
  return (
    <ul className="space-y-0.5">
      {issues.map((i) => (
        <li key={i.id}>
          <Link
            to={`/issues/${i.key}`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <IssueTypeIcon type={i.type} />
            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
              {i.key}
            </span>
            <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
              {i.title}
            </span>
            <PriorityIcon priority={i.priority} className="h-3.5 w-3.5" />
            <Avatar user={i.assignee} size="xs" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-2 py-1.5 text-sm text-gray-400">{text}</p>;
}
