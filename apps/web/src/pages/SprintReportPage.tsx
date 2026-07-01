import { useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CheckCircle2, Target } from 'lucide-react';
import type { IssueSummaryDto, StatusDto } from '@tasku/types';
import { issuesApi, projectsApi, sprintsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { PageSpinner } from '@/components/ui/Spinner';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';

export default function SprintReportPage() {
  const { key = '' } = useParams<{ key: string }>();

  const { data: sprints, isLoading: sprintsLoading } = useQuery({
    queryKey: qk.sprints(key),
    queryFn: () => sprintsApi.list(key),
    enabled: !!key,
  });

  const { data: statuses = [] } = useQuery({
    queryKey: qk.statuses(key),
    queryFn: () => projectsApi.statuses(key),
    enabled: !!key,
  });

  const activeSprint = (sprints ?? []).find((s) => s.state === 'ACTIVE') ?? null;

  const { data: issues = [], isLoading: issuesLoading } = useQuery({
    queryKey: qk.issues(key, { sprintId: activeSprint?.id }),
    queryFn: () => issuesApi.list(key, { sprintId: activeSprint!.id }),
    enabled: !!key && !!activeSprint,
  });

  if (sprintsLoading) {
    return (
      <>
        <PageHeader title="Sprint report" />
        <PageSpinner label="Loading…" />
      </>
    );
  }

  if (!activeSprint) {
    return (
      <>
        <PageHeader title="Sprint report" subtitle="Active sprint summary" />
        <div className="p-6">
          <EmptyState
            icon={<BarChart3 className="h-10 w-10" />}
            title="No active sprint"
            description="Start a sprint from the backlog to see its progress here."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Sprint report"
        subtitle={
          <span className="flex items-center gap-2">
            <span className="font-medium text-ink-soft dark:text-gray-200">{activeSprint.name}</span>
            {activeSprint.goal && (
              <span className="text-ink-faint">· {activeSprint.goal}</span>
            )}
          </span>
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {issuesLoading ? (
          <PageSpinner label="Crunching numbers…" />
        ) : (
          <Report issues={issues} statuses={statuses} />
        )}
      </div>
    </>
  );
}

function Report({
  issues,
  statuses,
}: {
  issues: IssueSummaryDto[];
  statuses: StatusDto[];
}) {
  const doneStatusIds = useMemo(
    () => new Set(statuses.filter((s) => s.category === 'DONE').map((s) => s.id)),
    [statuses],
  );
  const inProgressIds = useMemo(
    () =>
      new Set(
        statuses.filter((s) => s.category === 'IN_PROGRESS').map((s) => s.id),
      ),
    [statuses],
  );

  const totalPoints = issues.reduce((n, i) => n + (i.storyPoints ?? 0), 0);
  const donePoints = issues
    .filter((i) => doneStatusIds.has(i.statusId))
    .reduce((n, i) => n + (i.storyPoints ?? 0), 0);
  const inProgressPoints = issues
    .filter((i) => inProgressIds.has(i.statusId))
    .reduce((n, i) => n + (i.storyPoints ?? 0), 0);
  const todoPoints = totalPoints - donePoints - inProgressPoints;

  const doneCount = issues.filter((i) => doneStatusIds.has(i.statusId)).length;
  const pct = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;

  // Group point totals by status category for a simple stacked bar chart.
  const byCategory = statuses.map((status) => {
    const statusIssues = issues.filter((i) => i.statusId === status.id);
    return {
      status,
      count: statusIssues.length,
      points: statusIssues.reduce((n, i) => n + (i.storyPoints ?? 0), 0),
    };
  });
  const maxPoints = Math.max(1, ...byCategory.map((b) => b.points));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total issues" value={issues.length} icon={<Target className="h-4 w-4" />} />
        <StatCard label="Completed" value={`${doneCount}/${issues.length}`} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Story points" value={totalPoints} />
        <StatCard label="Points done" value={`${donePoints}/${totalPoints}`} accent />
      </div>

      {/* Completion progress */}
      <div className="rounded-lg border border-line dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-card">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-ink dark:text-gray-100">Completion</h3>
          <span className="text-2xl font-bold text-brand-600">{pct}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-surface-sunken dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-muted dark:text-gray-400">
          <Legend color="#22c55e" label={`Done · ${donePoints} pts`} />
          <Legend color="#3b82f6" label={`In progress · ${inProgressPoints} pts`} />
          <Legend color="#cbd5e1" label={`To do · ${todoPoints} pts`} />
        </div>
      </div>

      {/* Per-status bar chart */}
      <div className="rounded-lg border border-line dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-card">
        <h3 className="mb-4 text-sm font-semibold text-ink dark:text-gray-100">
          Story points by status
        </h3>
        {byCategory.length === 0 ? (
          <p className="text-sm text-ink-faint">No statuses configured.</p>
        ) : (
          <div className="space-y-3">
            {byCategory.map((b) => (
              <div key={b.status.id} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-xs font-medium text-ink-muted dark:text-gray-400">
                  {b.status.name}
                </span>
                <div className="flex h-6 flex-1 items-center">
                  <div
                    className="flex h-6 min-w-[2px] items-center justify-end rounded-md bg-brand-500/80 px-2 text-[11px] font-semibold text-white transition-all"
                    style={{ width: `${(b.points / maxPoints) * 100}%` }}
                  >
                    {b.points > 0 && b.points}
                  </div>
                </div>
                <span className="w-16 shrink-0 text-right text-xs text-ink-faint">
                  {b.count} issues
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-line dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-card">
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted dark:text-gray-400">
        {icon}
        {label}
      </div>
      <p
        className={
          accent
            ? 'mt-1 text-2xl font-bold text-brand-600'
            : 'mt-1 text-2xl font-bold text-ink dark:text-gray-100'
        }
      >
        {value}
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
