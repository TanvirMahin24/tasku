import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  max as maxDate,
  min as minDate,
  startOfMonth,
} from 'date-fns';
import { CalendarRange, ChevronDown, ChevronRight } from 'lucide-react';
import type { IssueSummaryDto, TimelineDto } from '@tasku/types';
import { projectsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { ISSUE_TYPE_META, formatDate } from '@/lib/format';
import { useProjectSocket } from '@/hooks/useProjectSocket';
import { IssueTypeIcon } from '@/components/ui/icons';
import { TeamChip } from '@/components/ui/TeamChip';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState, PageHeader } from '@/components/ui/PageHeader';
import { IssueDrawer } from '@/components/IssueDrawer';

const LEFT_COL_WIDTH = 280;
const DAY_PX = 8; // pixels per day on the time axis

export default function TimelinePage() {
  const { key = '' } = useParams<{ key: string }>();
  useProjectSocket(key);
  const [openIssueKey, setOpenIssueKey] = useState<string | null>(null);

  const { data: timeline, isLoading } = useQuery({
    queryKey: qk.timeline(key),
    queryFn: () => projectsApi.timeline(key),
    enabled: !!key,
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Timeline" />
        <PageSpinner label="Loading timeline…" />
      </>
    );
  }

  if (!timeline) {
    return (
      <>
        <PageHeader title="Timeline" />
        <div className="p-6 text-sm text-gray-500 dark:text-gray-400">Project not found.</div>
      </>
    );
  }

  const hasScheduled = timeline.rows.length > 0;

  return (
    <>
      <PageHeader title="Timeline" subtitle="Roadmap of scheduled work" />
      <div className="flex-1 overflow-auto scrollbar-thin bg-gray-50 dark:bg-gray-950 p-6">
        {!hasScheduled && timeline.unscheduled.length === 0 ? (
          <EmptyState
            icon={<CalendarRange className="h-10 w-10" />}
            title="Nothing on the timeline"
            description="Set start and due dates on issues to see them here."
          />
        ) : (
          <div className="space-y-6">
            {hasScheduled ? (
              <Gantt
                timeline={timeline}
                onOpen={(issueKey) => setOpenIssueKey(issueKey)}
              />
            ) : (
              <p className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No issues have start and due dates yet.
              </p>
            )}

            {timeline.unscheduled.length > 0 && (
              <Unscheduled
                issues={timeline.unscheduled}
                onOpen={(issueKey) => setOpenIssueKey(issueKey)}
              />
            )}
          </div>
        )}
      </div>

      <IssueDrawer
        projectKey={key}
        issueKey={openIssueKey}
        open={!!openIssueKey}
        onClose={() => setOpenIssueKey(null)}
        onDeleted={() => setOpenIssueKey(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Gantt
// ---------------------------------------------------------------------------

function dateOf(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function Gantt({
  timeline,
  onOpen,
}: {
  timeline: TimelineDto;
  onOpen: (issueKey: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // Determine the overall range from the explicit range or scanned dates.
  const { rangeStart, months, totalWidth } = useMemo(() => {
    const dates: Date[] = [];
    const collect = (i: IssueSummaryDto) => {
      const s = dateOf(i.startDate);
      const e = dateOf(i.dueDate);
      if (s) dates.push(s);
      if (e) dates.push(e);
    };
    timeline.rows.forEach((r) => {
      collect(r.issue);
      r.children.forEach(collect);
    });
    const explicitStart = dateOf(timeline.rangeStart);
    const explicitEnd = dateOf(timeline.rangeEnd);
    if (explicitStart) dates.push(explicitStart);
    if (explicitEnd) dates.push(explicitEnd);

    const today = new Date();
    const rawStart = dates.length ? minDate(dates) : today;
    const rawEnd = dates.length ? maxDate(dates) : today;
    const start = startOfMonth(rawStart);
    const end = endOfMonth(rawEnd);
    const monthsList = eachMonthOfInterval({ start, end });
    const days = differenceInCalendarDays(end, start) + 1;
    return {
      rangeStart: start,
      months: monthsList,
      totalWidth: days * DAY_PX,
    };
  }, [timeline]);

  function offsetPx(date: Date): number {
    return differenceInCalendarDays(date, rangeStart) * DAY_PX;
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 scrollbar-thin">
      <div style={{ minWidth: LEFT_COL_WIDTH + totalWidth }}>
        {/* Header: months */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div
            className="shrink-0 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
            style={{ width: LEFT_COL_WIDTH }}
          >
            Issue
          </div>
          <div className="relative" style={{ width: totalWidth }}>
            <div className="flex h-full">
              {months.map((m) => {
                const monthDays =
                  differenceInCalendarDays(endOfMonth(m), startOfMonth(m)) + 1;
                return (
                  <div
                    key={m.toISOString()}
                    className="border-l border-gray-200 dark:border-gray-700 px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400"
                    style={{ width: monthDays * DAY_PX }}
                  >
                    {format(m, 'MMM yyyy')}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rows */}
        <div className="relative">
          {timeline.rows.map((row) => {
            const isEpic = row.children.length > 0;
            const isOpen = expanded.has(row.issue.id);
            return (
              <div key={row.issue.id}>
                <GanttRow
                  issue={row.issue}
                  totalWidth={totalWidth}
                  offsetPx={offsetPx}
                  expandable={isEpic}
                  expanded={isOpen}
                  onToggle={() => toggle(row.issue.id)}
                  onOpen={onOpen}
                />
                {isEpic &&
                  isOpen &&
                  row.children.map((child) => (
                    <GanttRow
                      key={child.id}
                      issue={child}
                      totalWidth={totalWidth}
                      offsetPx={offsetPx}
                      depth={1}
                      onOpen={onOpen}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GanttRow({
  issue,
  totalWidth,
  offsetPx,
  depth = 0,
  expandable,
  expanded,
  onToggle,
  onOpen,
}: {
  issue: IssueSummaryDto;
  totalWidth: number;
  offsetPx: (d: Date) => number;
  depth?: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onOpen: (issueKey: string) => void;
}) {
  const start = dateOf(issue.startDate);
  const due = dateOf(issue.dueDate);
  const meta = ISSUE_TYPE_META[issue.type];
  const color = issue.team?.color ?? meta.color;

  let left = 0;
  let width = 0;
  if (start || due) {
    const s = start ?? due!;
    const e = due ?? start!;
    left = Math.max(0, offsetPx(s));
    width = Math.max(DAY_PX, offsetPx(e) - offsetPx(s) + DAY_PX);
  }

  return (
    <div className="flex items-center border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50/60 dark:hover:bg-gray-700/60">
      {/* Left label */}
      <div
        className="flex shrink-0 items-center gap-1.5 px-3 py-2"
        style={{ width: LEFT_COL_WIDTH, paddingLeft: 12 + depth * 18 }}
      >
        {expandable ? (
          <button
            onClick={onToggle}
            className="flex h-4 w-4 items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-400"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <IssueTypeIcon type={issue.type} />
        <button
          onClick={() => onOpen(issue.key)}
          className="min-w-0 flex-1 truncate text-left text-sm text-gray-700 dark:text-gray-200 hover:text-brand-700 dark:hover:text-brand-300"
          title={issue.title}
        >
          <span className="font-mono text-[11px] text-gray-400">{issue.key}</span>{' '}
          {issue.title}
        </button>
      </div>

      {/* Bar area */}
      <div className="relative h-9" style={{ width: totalWidth }}>
        {width > 0 ? (
          <button
            onClick={() => onOpen(issue.key)}
            className="absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-left text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ left, width, backgroundColor: color }}
            title={`${issue.title} · ${formatDate(issue.startDate)} → ${formatDate(issue.dueDate)}`}
          >
            <span className="truncate">{issue.title}</span>
          </button>
        ) : (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] italic text-gray-300">
            no dates
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unscheduled
// ---------------------------------------------------------------------------

function Unscheduled({
  issues,
  onOpen,
}: {
  issues: IssueSummaryDto[];
  onOpen: (issueKey: string) => void;
}) {
  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">Unscheduled</h2>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Set a start and due date on these issues to place them on the timeline.
      </p>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {issues.map((issue) => (
          <li key={issue.id}>
            <button
              onClick={() => onOpen(issue.key)}
              className="flex w-full items-center gap-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/60"
            >
              <IssueTypeIcon type={issue.type} />
              <span className="font-mono text-[11px] text-gray-400">
                {issue.key}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-200">
                {issue.title}
              </span>
              {issue.team && <TeamChip team={issue.team} />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
