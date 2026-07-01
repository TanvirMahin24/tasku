import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type {
  ActivityDto,
  CountBucket,
  WorkloadEntryDto,
} from '@tasku/types';
import { projectsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import {
  STATUS_CATEGORY_META,
  avatarColor,
  formatDate,
  humanizeField,
  relativeTime,
} from '@/lib/format';
import { useProjectSocket } from '@/hooks/useProjectSocket';
import { Avatar } from '@/components/ui/Avatar';
import { PageSpinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';

const CATEGORY_BAR: Record<string, string> = {
  TODO: '#94a3b8',
  IN_PROGRESS: '#3b82f6',
  DONE: '#22c55e',
};

export default function OverviewPage() {
  const { key = '' } = useParams<{ key: string }>();
  useProjectSocket(key);

  const { data: overview, isLoading } = useQuery({
    queryKey: qk.overview(key),
    queryFn: () => projectsApi.overview(key),
    enabled: !!key,
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Overview" />
        <PageSpinner label="Loading overview…" />
      </>
    );
  }

  if (!overview) {
    return (
      <>
        <PageHeader title="Overview" />
        <div className="p-6 text-sm text-ink-muted">Project not found.</div>
      </>
    );
  }

  const pointsPct =
    overview.points.total > 0
      ? Math.round((overview.points.done / overview.points.total) * 100)
      : 0;

  return (
    <>
      <PageHeader
        title={overview.project.name}
        subtitle="Project overview"
      />

      <div className="flex-1 overflow-y-auto scrollbar-thin bg-surface-page dark:bg-gray-950 p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total issues" value={overview.totalIssues} />
            <div className="rounded-lg border border-line dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-card">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                Story points
              </p>
              <p className="mt-1 text-2xl font-bold text-ink dark:text-gray-100">
                {overview.points.done}
                <span className="text-base font-medium text-ink-faint">
                  {' '}
                  / {overview.points.total}
                </span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken dark:bg-gray-800">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${pointsPct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-ink-faint">{pointsPct}% complete</p>
            </div>
            <div className="rounded-lg border border-line dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-card">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                Active sprint
              </p>
              {overview.activeSprint ? (
                <>
                  <p className="mt-1 truncate text-lg font-semibold text-ink dark:text-gray-100">
                    {overview.activeSprint.name}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted dark:text-gray-400">
                    {overview.activeSprint.startDate
                      ? `${formatDate(overview.activeSprint.startDate)} – ${formatDate(overview.activeSprint.endDate)}`
                      : 'No dates set'}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-faint">No active sprint</p>
              )}
            </div>
          </div>

          {/* Status breakdown */}
          <Panel title="Status breakdown">
            <StatusSegmentBar buckets={overview.byStatusCategory} />
          </Panel>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title="By type">
              <BarList buckets={overview.byType} />
            </Panel>
            <Panel title="By priority">
              <BarList buckets={overview.byPriority} />
            </Panel>
          </div>

          <Panel title="Workload">
            <Workload entries={overview.workload} />
          </Panel>

          <Panel title="Recent activity">
            <ActivityFeed activities={overview.recentActivity} />
          </Panel>
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-ink dark:text-gray-100">{value}</p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-card">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-gray-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatusSegmentBar({ buckets }: { buckets: CountBucket[] }) {
  const total = buckets.reduce((n, b) => n + b.count, 0);
  if (total === 0) {
    return <p className="text-sm text-ink-faint">No issues yet.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-sunken dark:bg-gray-800">
        {buckets.map((b) => (
          <div
            key={b.key}
            style={{
              width: `${(b.count / total) * 100}%`,
              backgroundColor: CATEGORY_BAR[b.key] ?? '#94a3b8',
            }}
            title={`${b.label}: ${b.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {buckets.map((b) => (
          <div key={b.key} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: CATEGORY_BAR[b.key] ?? '#94a3b8' }}
            />
            <span className="text-ink-muted dark:text-gray-400">
              {STATUS_CATEGORY_META[b.key as keyof typeof STATUS_CATEGORY_META]
                ?.label ?? b.label}
            </span>
            <span className="font-semibold text-ink dark:text-gray-100">{b.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarList({ buckets }: { buckets: CountBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  if (buckets.length === 0) {
    return <p className="text-sm text-ink-faint">No data.</p>;
  }
  return (
    <div className="space-y-2.5">
      {buckets.map((b) => (
        <div key={b.key} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-sm text-ink-muted dark:text-gray-400">
            {b.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-sunken dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${(b.count / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-semibold text-ink dark:text-gray-100">
            {b.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function Workload({ entries }: { entries: WorkloadEntryDto[] }) {
  const maxCount = Math.max(1, ...entries.map((e) => e.count));
  if (entries.length === 0) {
    return <p className="text-sm text-ink-faint">No assigned work.</p>;
  }
  return (
    <div className="space-y-3">
      {entries.map((e) => (
        <div key={e.user.id} className="flex items-center gap-3">
          <Avatar user={e.user} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate text-ink-soft dark:text-gray-200">{e.user.displayName}</span>
              <span className="shrink-0 text-xs text-ink-muted dark:text-gray-400">
                {e.count} {e.count === 1 ? 'issue' : 'issues'} · {e.points} pts
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-sunken dark:bg-gray-800">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(e.count / maxCount) * 100}%`,
                  backgroundColor: avatarColor(e.user.email || e.user.displayName),
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Mirrors the activity rendering style used in IssueDrawer.
function ActivityFeed({ activities }: { activities: ActivityDto[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-ink-faint">No recent activity.</p>;
  }
  const sorted = [...activities].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );
  return (
    <ul className="space-y-2.5">
      {sorted.map((a) => (
        <li key={a.id} className="flex items-start gap-2.5 text-sm">
          <Avatar user={a.actor} size="xs" className="mt-0.5" />
          <p className="text-ink-muted dark:text-gray-400">
            <span className="font-medium text-ink dark:text-gray-100">
              {a.actor.displayName}
            </span>{' '}
            <ActivityText activity={a} />{' '}
            <span className="text-ink-faint">· {relativeTime(a.createdAt)}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

function ActivityText({ activity }: { activity: ActivityDto }) {
  const { field, oldValue, newValue } = activity;
  if (field === 'created') return <>created this issue</>;
  if (field === 'comment') return <>added a comment</>;
  const f = humanizeField(field).toLowerCase();
  if (oldValue && newValue) {
    return (
      <>
        changed <span className="font-medium">{f}</span> from{' '}
        <code className="rounded bg-surface-sunken dark:bg-gray-800 px-1 text-xs">{oldValue}</code> to{' '}
        <code className="rounded bg-surface-sunken dark:bg-gray-800 px-1 text-xs">{newValue}</code>
      </>
    );
  }
  if (newValue) {
    return (
      <>
        set <span className="font-medium">{f}</span> to{' '}
        <code className="rounded bg-surface-sunken dark:bg-gray-800 px-1 text-xs">{newValue}</code>
      </>
    );
  }
  return (
    <>
      updated <span className="font-medium">{f}</span>
    </>
  );
}
