import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { IssueSummaryDto } from '@tasku/types';
import { issuesApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { ISSUE_TYPE_META } from '@/lib/format';
import { useProjectSocket } from '@/hooks/useProjectSocket';
import { PageSpinner } from '@/components/ui/Spinner';
import { IssueDrawer } from '@/components/IssueDrawer';

const WEEK_OPTS = { weekStartsOn: 1 as const }; // Monday
const LANES = 3; // visible bar rows per week before "+N more"

function dateOf(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** An issue's inclusive [start, end] span (a single date if only one is set). */
function span(i: IssueSummaryDto): { start: Date; end: Date } | null {
  const s = dateOf(i.startDate);
  const e = dateOf(i.dueDate);
  if (!s && !e) return null;
  return { start: s ?? e!, end: e ?? s! };
}

interface Segment {
  issue: IssueSummaryDto;
  lane: number;
  offset: number; // day index within the week (0..6)
  length: number; // days (1..7)
  roundedStart: boolean;
  roundedEnd: boolean;
}

/** Lay out issue bars for one week, assigning non-overlapping lanes. */
function layoutWeek(
  weekStart: Date,
  items: { issue: IssueSummaryDto; start: Date; end: Date }[],
): { segments: Segment[]; overflow: Record<number, number> } {
  const weekEnd = addDays(weekStart, 6);
  const lanes: (Date | null)[] = []; // last end per lane
  const segments: Segment[] = [];
  const overflow: Record<number, number> = {};

  const inWeek = items
    .filter((it) => it.start <= weekEnd && it.end >= weekStart)
    .sort((a, b) => +a.start - +b.start || +a.end - +b.end);

  for (const it of inWeek) {
    const segStart = it.start < weekStart ? weekStart : it.start;
    const segEnd = it.end > weekEnd ? weekEnd : it.end;
    const offset = differenceInCalendarDays(segStart, weekStart);
    const length = differenceInCalendarDays(segEnd, segStart) + 1;

    let lane = lanes.findIndex((end) => !end || end < segStart);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(null);
    }
    lanes[lane] = segEnd;

    if (lane >= LANES) {
      // Count as overflow for each day it covers.
      for (let d = offset; d < offset + length; d++)
        overflow[d] = (overflow[d] ?? 0) + 1;
      continue;
    }
    segments.push({
      issue: it.issue,
      lane,
      offset,
      length,
      roundedStart: it.start >= weekStart,
      roundedEnd: it.end <= weekEnd,
    });
  }
  return { segments, overflow };
}

export default function CalendarPage() {
  const { key = '' } = useParams<{ key: string }>();
  useProjectSocket(key);
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
  const [openIssueKey, setOpenIssueKey] = useState<string | null>(null);

  const { data: issues = [], isLoading } = useQuery({
    queryKey: qk.issues(key),
    queryFn: () => issuesApi.list(key),
    enabled: !!key,
  });

  const weeks = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(anchor), WEEK_OPTS);
    const gridEnd = endOfWeek(endOfMonth(anchor), WEEK_OPTS);
    const out: Date[] = [];
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 7)) out.push(d);
    return out;
  }, [anchor]);

  const dated = useMemo(
    () =>
      issues
        .map((issue) => {
          const s = span(issue);
          return s ? { issue, ...s } : null;
        })
        .filter((x): x is { issue: IssueSummaryDto; start: Date; end: Date } => !!x),
    [issues],
  );

  if (isLoading) return <PageSpinner label="Loading calendar…" />;

  const today = new Date();

  return (
    <>
      <div className="flex-1 overflow-y-auto scrollbar-thin bg-surface-page p-6 dark:bg-gray-950">
        {/* Month nav */}
        <div className="mb-3 flex items-center gap-2">
          <NavBtn onClick={() => setAnchor((a) => addMonths(a, -1))}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </NavBtn>
          <span className="min-w-[110px] text-center text-sm font-bold text-ink dark:text-white">
            {format(anchor, 'MMMM yyyy')}
          </span>
          <NavBtn onClick={() => setAnchor((a) => addMonths(a, 1))}>
            <ChevronRight className="h-3.5 w-3.5" />
          </NavBtn>
          <button
            onClick={() => setAnchor(startOfMonth(new Date()))}
            className="ml-1.5 h-7 rounded-md border border-line bg-white px-2.5 text-xs font-semibold text-ink-soft hover:bg-surface-sunken dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            Today
          </button>
        </div>

        <div className="overflow-hidden rounded-[10px] border border-line bg-white dark:border-gray-700 dark:bg-gray-900">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-line bg-surface-page dark:border-gray-700 dark:bg-gray-800/50">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span
                key={d}
                className="px-2.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink-faint"
              >
                {d}
              </span>
            ))}
          </div>

          {weeks.map((weekStart, wi) => {
            const { segments, overflow } = layoutWeek(weekStart, dated);
            return (
              <div
                key={wi}
                className={`relative h-[104px] ${
                  wi < weeks.length - 1
                    ? 'border-b border-line-soft dark:border-gray-800'
                    : ''
                }`}
              >
                {/* Day cells */}
                <div className="grid h-full grid-cols-7">
                  {Array.from({ length: 7 }).map((_, di) => {
                    const day = addDays(weekStart, di);
                    const outside = !isSameMonth(day, anchor);
                    const isToday = isSameDay(day, today);
                    return (
                      <div
                        key={di}
                        className={`border-r border-line-soft px-2 py-1.5 last:border-r-0 dark:border-gray-800 ${
                          outside ? 'bg-[#FAFBFC] dark:bg-gray-800/30' : ''
                        }`}
                      >
                        {isToday ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                            {format(day, 'd')}
                          </span>
                        ) : (
                          <span
                            className={`text-[11px] font-semibold ${
                              outside ? 'text-[#B3BAC5]' : 'text-ink-soft dark:text-gray-300'
                            }`}
                          >
                            {format(day, 'd')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bars */}
                <div className="pointer-events-none absolute inset-x-0 top-7 h-[68px]">
                  {segments.map((seg, i) => {
                    const color =
                      seg.issue.team?.color ?? ISSUE_TYPE_META[seg.issue.type].color;
                    return (
                      <button
                        key={i}
                        onClick={() => setOpenIssueKey(seg.issue.key)}
                        title={`${seg.issue.key} · ${seg.issue.title}`}
                        className="pointer-events-auto absolute flex h-[18px] items-center overflow-hidden px-2 text-[9.5px] font-semibold text-white hover:opacity-90"
                        style={{
                          top: seg.lane * 21,
                          left: `calc(${(seg.offset / 7) * 100}% + 4px)`,
                          width: `calc(${(seg.length / 7) * 100}% - 8px)`,
                          backgroundColor: color,
                          borderTopLeftRadius: seg.roundedStart ? 5 : 0,
                          borderBottomLeftRadius: seg.roundedStart ? 5 : 0,
                          borderTopRightRadius: seg.roundedEnd ? 5 : 0,
                          borderBottomRightRadius: seg.roundedEnd ? 5 : 0,
                        }}
                      >
                        <span className="truncate">
                          {seg.roundedStart ? '' : '‹ '}
                          {seg.issue.key} · {seg.issue.title}
                        </span>
                      </button>
                    );
                  })}
                  {Object.entries(overflow).map(([day, n]) => (
                    <span
                      key={day}
                      className="absolute text-[9.5px] font-semibold text-ink-faint"
                      style={{ top: LANES * 21, left: `calc(${(Number(day) / 7) * 100}% + 4px)` }}
                    >
                      +{n}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
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

function NavBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-white text-ink-soft hover:bg-surface-sunken dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
    >
      {children}
    </button>
  );
}
