import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import type {
  BurndownDto,
  CreatedResolvedPointDto,
  CumulativeFlowPointDto,
  VelocityPointDto,
} from '@tasku/types';
import { projectsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { useProjectSocket } from '@/hooks/useProjectSocket';
import { PageSpinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';

const COLORS = {
  committed: '#c7d2fe',
  completed: '#6366f1',
  ideal: '#94a3b8',
  remaining: '#6366f1',
  todo: '#cbd5e1',
  inProgress: '#60a5fa',
  done: '#34d399',
  created: '#f59e0b',
  resolved: '#22c55e',
};

const W = 520;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

export default function ReportsPage() {
  const { key = '' } = useParams<{ key: string }>();
  useProjectSocket(key);

  const { data: reports, isLoading } = useQuery({
    queryKey: qk.reports(key),
    queryFn: () => projectsApi.reports(key),
    enabled: !!key,
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Reports" />
        <PageSpinner label="Loading reports…" />
      </>
    );
  }

  if (!reports) {
    return (
      <>
        <PageHeader title="Reports" />
        <div className="p-6 text-sm text-gray-500">No report data available.</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Reports" subtitle="Project dashboards & charts" />
      <div className="flex-1 overflow-y-auto scrollbar-thin bg-gray-50 p-6">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 xl:grid-cols-2">
          <Card title="Velocity" subtitle="Committed vs completed points per sprint">
            <VelocityChart data={reports.velocity} />
          </Card>
          <Card title="Burndown" subtitle="Remaining work vs ideal">
            <BurndownChart data={reports.burndown} />
          </Card>
          <Card title="Cumulative flow" subtitle="Issues by status over time">
            <CumulativeFlowChart data={reports.cumulativeFlow} />
          </Card>
          <Card title="Created vs Resolved" subtitle="Daily issue throughput">
            <CreatedResolvedChart data={reports.createdVsResolved} />
          </Card>
        </div>
      </div>
    </>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Empty() {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400">
      No data yet.
    </div>
  );
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-4">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-xs text-gray-600">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function shortDate(iso: string): string {
  try {
    return format(new Date(iso), 'MMM d');
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Velocity — grouped bars
// ---------------------------------------------------------------------------

function VelocityChart({ data }: { data: VelocityPointDto[] }) {
  if (data.length === 0) return <Empty />;
  const max = Math.max(1, ...data.flatMap((d) => [d.committed, d.completed]));
  const groupW = PLOT_W / data.length;
  const barW = Math.min(22, (groupW - 8) / 2);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        <Axes max={max} />
        {data.map((d, i) => {
          const gx = PAD.left + i * groupW + groupW / 2;
          const hCommitted = (d.committed / max) * PLOT_H;
          const hCompleted = (d.completed / max) * PLOT_H;
          const baseY = PAD.top + PLOT_H;
          return (
            <g key={d.sprintId}>
              <rect
                x={gx - barW - 1}
                y={baseY - hCommitted}
                width={barW}
                height={hCommitted}
                fill={COLORS.committed}
                rx={2}
              >
                <title>{`${d.sprintName}: committed ${d.committed}`}</title>
              </rect>
              <rect
                x={gx + 1}
                y={baseY - hCompleted}
                width={barW}
                height={hCompleted}
                fill={COLORS.completed}
                rx={2}
              >
                <title>{`${d.sprintName}: completed ${d.completed}`}</title>
              </rect>
              <text
                x={gx}
                y={H - 10}
                textAnchor="middle"
                className="fill-gray-400"
                fontSize={9}
              >
                {d.sprintName.length > 8
                  ? `${d.sprintName.slice(0, 7)}…`
                  : d.sprintName}
              </text>
            </g>
          );
        })}
      </svg>
      <Legend
        items={[
          { color: COLORS.committed, label: 'Committed' },
          { color: COLORS.completed, label: 'Completed' },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Burndown — line (ideal dashed vs remaining)
// ---------------------------------------------------------------------------

function BurndownChart({ data }: { data: BurndownDto }) {
  const points = data.points;
  if (points.length === 0) return <Empty />;
  const max = Math.max(
    1,
    data.totalPoints,
    ...points.flatMap((p) => [p.remaining, p.ideal]),
  );
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? PLOT_W / 2 : (i / (points.length - 1)) * PLOT_W);
  const y = (v: number) => PAD.top + PLOT_H - (v / max) * PLOT_H;

  const idealPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.ideal)}`).join(' ');
  const remPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.remaining)}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        <Axes max={max} />
        <path d={idealPath} fill="none" stroke={COLORS.ideal} strokeWidth={1.5} strokeDasharray="4 3" />
        <path d={remPath} fill="none" stroke={COLORS.remaining} strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.remaining)} r={2.5} fill={COLORS.remaining}>
            <title>{`${shortDate(p.date)}: ${p.remaining} remaining`}</title>
          </circle>
        ))}
        <XLabels labels={points.map((p) => shortDate(p.date))} count={points.length} />
      </svg>
      <Legend
        items={[
          { color: COLORS.ideal, label: 'Ideal' },
          { color: COLORS.remaining, label: 'Remaining' },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cumulative flow — stacked area
// ---------------------------------------------------------------------------

function CumulativeFlowChart({ data }: { data: CumulativeFlowPointDto[] }) {
  if (data.length === 0) return <Empty />;
  const max = Math.max(1, ...data.map((d) => d.todo + d.inProgress + d.done));
  const x = (i: number) =>
    PAD.left + (data.length === 1 ? PLOT_W / 2 : (i / (data.length - 1)) * PLOT_W);
  const y = (v: number) => PAD.top + PLOT_H - (v / max) * PLOT_H;

  // Stack order bottom->top: done, inProgress, todo.
  const series: { key: keyof CumulativeFlowPointDto; color: string }[] = [
    { key: 'done', color: COLORS.done },
    { key: 'inProgress', color: COLORS.inProgress },
    { key: 'todo', color: COLORS.todo },
  ];

  const cum = data.map(() => 0);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        <Axes max={max} />
        {series.map((s) => {
          const lower = data.map((_, i) => cum[i]);
          data.forEach((d, i) => {
            cum[i] += d[s.key] as number;
          });
          const upper = data.map((_, i) => cum[i]);
          const top = data.map((_, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(upper[i])}`).join(' ');
          const bottom = data
            .map((_, i) => `L${x(data.length - 1 - i)},${y(lower[data.length - 1 - i])}`)
            .join(' ');
          return (
            <path
              key={s.key}
              d={`${top} ${bottom} Z`}
              fill={s.color}
              fillOpacity={0.85}
              stroke="none"
            />
          );
        })}
        <XLabels labels={data.map((d) => shortDate(d.date))} count={data.length} />
      </svg>
      <Legend
        items={[
          { color: COLORS.todo, label: 'To Do' },
          { color: COLORS.inProgress, label: 'In Progress' },
          { color: COLORS.done, label: 'Done' },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Created vs Resolved — two lines
// ---------------------------------------------------------------------------

function CreatedResolvedChart({ data }: { data: CreatedResolvedPointDto[] }) {
  if (data.length === 0) return <Empty />;
  const max = Math.max(1, ...data.flatMap((d) => [d.created, d.resolved]));
  const x = (i: number) =>
    PAD.left + (data.length === 1 ? PLOT_W / 2 : (i / (data.length - 1)) * PLOT_W);
  const y = (v: number) => PAD.top + PLOT_H - (v / max) * PLOT_H;

  const createdPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.created)}`).join(' ');
  const resolvedPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.resolved)}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        <Axes max={max} />
        <path d={createdPath} fill="none" stroke={COLORS.created} strokeWidth={2} />
        <path d={resolvedPath} fill="none" stroke={COLORS.resolved} strokeWidth={2} />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.created)} r={2.5} fill={COLORS.created}>
              <title>{`${shortDate(d.date)}: ${d.created} created`}</title>
            </circle>
            <circle cx={x(i)} cy={y(d.resolved)} r={2.5} fill={COLORS.resolved}>
              <title>{`${shortDate(d.date)}: ${d.resolved} resolved`}</title>
            </circle>
          </g>
        ))}
        <XLabels labels={data.map((d) => shortDate(d.date))} count={data.length} />
      </svg>
      <Legend
        items={[
          { color: COLORS.created, label: 'Created' },
          { color: COLORS.resolved, label: 'Resolved' },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared chart chrome
// ---------------------------------------------------------------------------

function Axes({ max }: { max: number }) {
  const ticks = 4;
  return (
    <g>
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const v = (max / ticks) * (ticks - i);
        const yy = PAD.top + (PLOT_H / ticks) * i;
        return (
          <g key={i}>
            <line
              x1={PAD.left}
              y1={yy}
              x2={W - PAD.right}
              y2={yy}
              stroke="#f1f5f9"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={yy + 3}
              textAnchor="end"
              className="fill-gray-400"
              fontSize={9}
            >
              {Math.round(v)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function XLabels({ labels, count }: { labels: string[]; count: number }) {
  if (count === 0) return null;
  // Show at most ~6 evenly-spaced labels to avoid crowding.
  const step = Math.max(1, Math.ceil(count / 6));
  const x = (i: number) =>
    PAD.left + (count === 1 ? PLOT_W / 2 : (i / (count - 1)) * PLOT_W);
  return (
    <g>
      {labels.map((l, i) =>
        i % step === 0 || i === count - 1 ? (
          <text
            key={i}
            x={x(i)}
            y={H - 10}
            textAnchor="middle"
            className="fill-gray-400"
            fontSize={9}
          >
            {l}
          </text>
        ) : null,
      )}
    </g>
  );
}
