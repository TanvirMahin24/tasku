import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  addDays,
  differenceInCalendarDays,
  eachMonthOfInterval,
  eachWeekOfInterval,
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
import { useProjectMeta } from '@/hooks/useProjectMeta';
import { IssueTypeIcon } from '@/components/ui/icons';
import { TeamChip } from '@/components/ui/TeamChip';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/PageHeader';
import { IssueDrawer } from '@/components/IssueDrawer';

const LEFT = 230; // px — label column width
const WEEK_OPTS = { weekStartsOn: 1 as const };

export default function TimelinePage() {
  const { key = '' } = useParams<{ key: string }>();
  useProjectSocket(key);
  const [openIssueKey, setOpenIssueKey] = useState<string | null>(null);

  const { data: timeline, isLoading } = useQuery({
    queryKey: qk.timeline(key),
    queryFn: () => projectsApi.timeline(key),
    enabled: !!key,
  });

  const { statuses } = useProjectMeta(key);
  const doneIds = useMemo(
    () => new Set(statuses.filter((s) => s.category === 'DONE').map((s) => s.id)),
    [statuses],
  );

  if (isLoading) return <PageSpinner label="Loading timeline…" />;
  if (!timeline) {
    return (
      <div className="p-6 text-sm text-ink-muted dark:text-gray-400">
        Project not found.
      </div>
    );
  }

  const hasScheduled = timeline.rows.length > 0;

  return (
    <>
      <div className="flex-1 overflow-auto scrollbar-thin bg-surface-page p-6 dark:bg-gray-950">
        {!hasScheduled && timeline.unscheduled.length === 0 ? (
          <EmptyState
            icon={<CalendarRange className="h-10 w-10" />}
            title="Nothing on the timeline"
            description="Set start and due dates on issues to see them here."
          />
        ) : (
          <div className="space-y-6">
            {hasScheduled && (
              <Gantt
                timeline={timeline}
                doneIds={doneIds}
                onOpen={setOpenIssueKey}
              />
            )}
            {timeline.unscheduled.length > 0 && (
              <Unscheduled
                issues={timeline.unscheduled}
                onOpen={setOpenIssueKey}
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

function dateOf(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function Gantt({
  timeline,
  doneIds,
  onOpen,
}: {
  timeline: TimelineDto;
  doneIds: Set<string>;
  onOpen: (issueKey: string) => void;
}) {
  const [scale, setScale] = useState<'months' | 'weeks'>('months');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const { rangeStart, totalDays, months, weeks } = useMemo(() => {
    const dates: Date[] = [new Date()]; // always include today so its line shows
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
    const s = dateOf(timeline.rangeStart);
    const e = dateOf(timeline.rangeEnd);
    if (s) dates.push(s);
    if (e) dates.push(e);

    const start = startOfMonth(minDate(dates));
    const end = endOfMonth(maxDate(dates));
    const days = differenceInCalendarDays(end, start) + 1;
    const pctOf = (d: Date) => (differenceInCalendarDays(d, start) / days) * 100;
    return {
      rangeStart: start,
      totalDays: days,
      months: eachMonthOfInterval({ start, end }).map((m) => ({
        date: m,
        days: differenceInCalendarDays(endOfMonth(m), startOfMonth(m)) + 1,
      })),
      weeks: eachWeekOfInterval({ start, end }, WEEK_OPTS)
        .map((d) => ({ pct: pctOf(d), label: format(d, 'd') }))
        .filter((w) => w.pct >= 0 && w.pct < 100),
    };
  }, [timeline]);

  const pct = (d: Date) =>
    Math.max(0, Math.min(100, (differenceInCalendarDays(d, rangeStart) / totalDays) * 100));
  const todayPct = pct(new Date());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const innerStyle =
    scale === 'weeks'
      ? { width: `${Math.max(weeks.length, 1) * 88}px`, minWidth: '100%' }
      : { width: '100%' };

  return (
    <div>
      {/* scale toggle */}
      <div className="mb-3 flex items-center gap-1.5">
        {(['months', 'weeks'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScale(s)}
            className={
              scale === s
                ? 'h-[30px] rounded-md border border-brand-600 bg-brand-50 px-3 text-xs font-semibold capitalize text-brand-600 dark:bg-brand-500/15'
                : 'h-[30px] rounded-md border border-line bg-white px-3 text-xs font-medium capitalize text-ink-soft hover:bg-surface-sunken dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
            }
          >
            {s}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-line bg-white scrollbar-thin dark:border-gray-700 dark:bg-gray-900">
        <div style={innerStyle}>
          {/* Header — months */}
          <div className="flex border-b border-line bg-surface-page dark:border-gray-700 dark:bg-gray-800/50">
            <div
              className="shrink-0 border-r border-line-soft dark:border-gray-800"
              style={{ width: LEFT }}
            />
            <div className="flex flex-1">
              {months.map((m) => (
                <div
                  key={m.date.toISOString()}
                  style={{ flex: m.days }}
                  className="border-r border-line px-3 pb-1 pt-2 text-[11px] font-semibold text-ink-muted dark:border-gray-700 dark:text-gray-400"
                >
                  {format(m.date, 'MMM yyyy')}
                </div>
              ))}
            </div>
          </div>

          {/* Header — week ticks */}
          <div className="flex border-b border-line bg-surface-page dark:border-gray-700 dark:bg-gray-800/50">
            <div
              className="shrink-0 border-r border-line-soft dark:border-gray-800"
              style={{ width: LEFT }}
            />
            <div className="relative h-5 flex-1">
              {weeks.map((w, i) => (
                <span
                  key={i}
                  style={{ left: `${w.pct}%` }}
                  className="absolute top-0.5 pl-1 font-mono text-[9px] text-ink-faint"
                >
                  {w.label}
                </span>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="relative">
            {/* week grid lines (behind rows) */}
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-0"
              style={{ left: LEFT }}
            >
              {weeks.map((w, i) => (
                <div
                  key={i}
                  style={{ left: `${w.pct}%` }}
                  className="absolute inset-y-0 border-l border-[#F4F5F7] dark:border-gray-800"
                />
              ))}
            </div>

            {timeline.rows.map((row) => {
              const isEpic = row.issue.type === 'EPIC' || row.children.length > 0;
              const open = expanded.has(row.issue.id);
              const progress = row.children.length
                ? Math.round(
                    (row.children.filter((c) => doneIds.has(c.statusId)).length /
                      row.children.length) *
                      100,
                  )
                : null;
              return (
                <div key={row.issue.id}>
                  <GanttRow
                    issue={row.issue}
                    epic={isEpic}
                    progress={progress}
                    pct={pct}
                    expandable={row.children.length > 0}
                    expanded={open}
                    onToggle={() => toggle(row.issue.id)}
                    onOpen={onOpen}
                  />
                  {open &&
                    row.children.map((child) => (
                      <GanttRow
                        key={child.id}
                        issue={child}
                        depth={1}
                        pct={pct}
                        onOpen={onOpen}
                      />
                    ))}
                </div>
              );
            })}

            {/* today marker (above rows) */}
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-20"
              style={{ left: LEFT }}
            >
              <div
                className="absolute inset-y-0 w-0.5 bg-[#E2483D]/70"
                style={{ left: `${todayPct}%` }}
              >
                <span className="absolute -left-4 top-0 rounded-[3px] bg-[#E2483D] px-1 py-px text-[8.5px] font-bold text-white">
                  TODAY
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GanttRow({
  issue,
  depth = 0,
  epic = false,
  progress = null,
  pct,
  expandable,
  expanded,
  onToggle,
  onOpen,
}: {
  issue: IssueSummaryDto;
  depth?: number;
  epic?: boolean;
  progress?: number | null;
  pct: (d: Date) => number;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onOpen: (issueKey: string) => void;
}) {
  const start = dateOf(issue.startDate);
  const due = dateOf(issue.dueDate);
  const color = issue.teams[0]?.color ?? ISSUE_TYPE_META[issue.type].color;

  let left = 0;
  let width = 0;
  if (start || due) {
    const s = start ?? due!;
    const e = due ?? start!;
    left = pct(s);
    width = Math.max(1.5, pct(addDays(e, 1)) - pct(s));
  }

  return (
    <div className="relative z-10 flex h-[38px] items-center border-b border-line-soft last:border-b-0 hover:bg-surface-sunken/50 dark:border-gray-800">
      {/* label */}
      <div
        className="flex shrink-0 items-center gap-2 self-stretch border-r border-line-soft dark:border-gray-800"
        style={{ width: LEFT, paddingLeft: 12 + depth * 16, paddingRight: 12 }}
      >
        {expandable ? (
          <button
            onClick={onToggle}
            className="flex h-4 w-4 shrink-0 items-center justify-center text-ink-faint hover:text-ink-muted"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <IssueTypeIcon type={issue.type} boxed />
        <button
          onClick={() => onOpen(issue.key)}
          title={issue.title}
          className={`min-w-0 flex-1 truncate text-left text-[12px] hover:text-brand-700 dark:hover:text-brand-300 ${
            epic
              ? 'font-semibold text-ink dark:text-gray-100'
              : 'font-medium text-ink-soft dark:text-gray-300'
          }`}
        >
          {issue.title}
        </button>
      </div>

      {/* bar area */}
      <div className="relative h-full flex-1">
        {width > 0 ? (
          epic ? (
            <button
              onClick={() => onOpen(issue.key)}
              title={`${issue.title} · ${formatDate(issue.startDate)} → ${formatDate(issue.dueDate)}`}
              className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-md border"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: `${color}22`,
                borderColor: `${color}66`,
              }}
            >
              {progress != null && (
                <span
                  className="absolute inset-y-0 left-0"
                  style={{ width: `${progress}%`, backgroundColor: `${color}44` }}
                />
              )}
              <span
                className="relative truncate px-2 text-[10px] font-semibold"
                style={{ color }}
              >
                {issue.key}
                {progress != null ? ` · ${progress}%` : ''}
              </span>
            </button>
          ) : (
            <button
              onClick={() => onOpen(issue.key)}
              title={`${issue.title} · ${formatDate(issue.startDate)} → ${formatDate(issue.dueDate)}`}
              className="absolute top-1/2 flex h-[18px] -translate-y-1/2 items-center overflow-hidden rounded-[5px] hover:opacity-90"
              style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color }}
            >
              <span className="truncate px-2 text-[10px] font-semibold text-white">
                {issue.key}
              </span>
            </button>
          )
        ) : (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] italic text-ink-faint">
            no dates
          </span>
        )}
      </div>
    </div>
  );
}

function Unscheduled({
  issues,
  onOpen,
}: {
  issues: IssueSummaryDto[];
  onOpen: (issueKey: string) => void;
}) {
  return (
    <section className="rounded-[10px] border border-line bg-white p-5 shadow-card dark:border-gray-700 dark:bg-gray-900">
      <h2 className="mb-1 text-sm font-semibold text-ink dark:text-gray-100">
        Unscheduled
      </h2>
      <p className="mb-3 text-xs text-ink-muted dark:text-gray-400">
        Set a start and due date on these issues to place them on the timeline.
      </p>
      <ul className="divide-y divide-line-soft dark:divide-gray-700">
        {issues.map((issue) => (
          <li key={issue.id}>
            <button
              onClick={() => onOpen(issue.key)}
              className="flex w-full items-center gap-2 py-2 text-left hover:bg-surface-sunken dark:hover:bg-gray-700/60"
            >
              <IssueTypeIcon type={issue.type} />
              <span className="font-mono text-[11px] text-ink-faint">
                {issue.key}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-soft dark:text-gray-200">
                {issue.title}
              </span>
              {issue.teams.map((t) => (
                <TeamChip key={t.id} team={t} />
              ))}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
