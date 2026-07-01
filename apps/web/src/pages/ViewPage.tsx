import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Pencil,
  Pin,
  PinOff,
  Star,
  Users as UsersIcon,
} from 'lucide-react';
import type {
  CustomFieldValue,
  ViewColumn,
  ViewRowDto,
} from '@tasku/types';
import { VIEW_STANDARD_FIELDS } from '@tasku/types';
import { viewsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import {
  ISSUE_TYPE_META,
  PRIORITY_META,
  STATUS_CATEGORY_META,
  formatDate,
  relativeTime,
} from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge, LabelBadge } from '@/components/ui/Badge';
import { TeamChip } from '@/components/ui/TeamChip';
import { IssueTypeIcon } from '@/components/ui/icons';
import { PageSpinner } from '@/components/ui/Spinner';
import { ViewEditor } from '@/components/ViewEditor';

const COL_WIDTH: Record<string, number> = {
  key: 130,
  type: 120,
  title: 320,
  status: 150,
  priority: 120,
  assignee: 190,
  reporter: 190,
  teams: 190,
  labels: 210,
  storyPoints: 90,
  startDate: 120,
  dueDate: 120,
  project: 140,
  updatedAt: 130,
};
const widthOf = (key: string) => COL_WIDTH[key] ?? 170;

export default function ViewPage() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const { data: view, isLoading, error } = useQuery({
    queryKey: qk.view(id),
    queryFn: () => viewsApi.get(id),
    enabled: !!id,
  });
  const { data: rows = [], isLoading: rowsLoading } = useQuery({
    queryKey: qk.viewResults(id),
    queryFn: () => viewsApi.results(id),
    enabled: !!id,
  });
  const { data: fields = [] } = useQuery({
    queryKey: qk.viewFields,
    queryFn: () => viewsApi.fields(),
  });
  const fieldLabel = useMemo(() => {
    const m = new Map<string, string>();
    VIEW_STANDARD_FIELDS.forEach((f) => m.set(f.key, f.label));
    fields.forEach((f) => m.set(f.key, f.label));
    return (k: string) => m.get(k) ?? k;
  }, [fields]);

  const star = useMutation({
    mutationFn: () =>
      view!.starred ? viewsApi.unstar(id) : viewsApi.star(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.view(id) });
      qc.invalidateQueries({ queryKey: qk.views(true) });
    },
  });
  const archive = useMutation({
    mutationFn: () => viewsApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.views() });
      navigate('/views');
    },
  });
  const togglePin = useMutation({
    mutationFn: (columns: ViewColumn[]) => viewsApi.update(id, { columns }),
    onSuccess: (v) => qc.setQueryData(qk.view(id), v),
  });

  if (isLoading) return <PageSpinner label="Loading view…" />;
  if (error || !view) {
    return (
      <div className="p-6 text-sm text-ink-muted dark:text-gray-400">
        View not found.
      </div>
    );
  }

  const columns = view.columns;
  // Cumulative left offset for each pinned column.
  const pinnedLefts = new Map<string, number>();
  let acc = 0;
  for (const c of columns) {
    if (c.pinned) {
      pinnedLefts.set(c.key, acc);
      acc += widthOf(c.key);
    }
  }
  const minWidth = columns.reduce((n, c) => n + widthOf(c.key), 0);

  function pinStyle(c: ViewColumn): React.CSSProperties {
    if (!c.pinned) return { width: widthOf(c.key), minWidth: widthOf(c.key) };
    return {
      width: widthOf(c.key),
      minWidth: widthOf(c.key),
      position: 'sticky',
      left: pinnedLefts.get(c.key),
      zIndex: 1,
    };
  }

  function setPinned(key: string, pinned: boolean) {
    // Keep pinned columns first, preserving order.
    const next = columns.map((c) => (c.key === key ? { ...c, pinned } : c));
    next.sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false));
    togglePin.mutate(next);
  }

  return (
    <>
      {/* Header */}
      <header className="flex-none border-b border-line bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold text-ink dark:text-white">
                {view.title}
              </h1>
              <button
                onClick={() => star.mutate()}
                title={view.starred ? 'Unstar' : 'Star'}
                className="text-ink-faint hover:text-[#FCA700]"
              >
                <Star
                  className="h-4 w-4"
                  {...(view.starred
                    ? { fill: '#FCA700', stroke: '#FCA700' }
                    : {})}
                />
              </button>
            </div>
            {view.description && (
              <p className="mt-0.5 text-sm text-ink-muted dark:text-gray-400">
                {view.description}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-muted dark:text-gray-400">
              <span className="inline-flex items-center gap-1 font-medium">
                {view.scope === 'TEAM' ? (
                  <>
                    <UsersIcon className="h-3.5 w-3.5" />
                    {view.scopeTeam?.name ?? 'Team'}
                  </>
                ) : (
                  'Global'
                )}
              </span>
              {(view.startDate || view.endDate) && (
                <span>
                  {formatDate(view.startDate)} → {formatDate(view.endDate)}
                </span>
              )}
              {view.responsible && (
                <span className="inline-flex items-center gap-1">
                  <Avatar user={view.responsible} size="xs" />
                  {view.responsible.displayName}
                </span>
              )}
              {view.teams.map((t) => (
                <TeamChip key={t.id} team={t} />
              ))}
              <span className="text-ink-faint">· {rows.length} issues</span>
            </div>
          </div>
          {view.canEdit && (
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm(`Archive "${view.title}"?`)) archive.mutate();
                }}
              >
                <Archive className="h-4 w-4" /> Archive
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto scrollbar-thin bg-surface-page dark:bg-gray-950">
        {rowsLoading ? (
          <PageSpinner label="Loading issues…" />
        ) : columns.length === 0 ? (
          <p className="p-6 text-sm text-ink-faint">
            No columns yet. Use Edit to add columns.
          </p>
        ) : (
          <table
            className="border-separate border-spacing-0 text-sm"
            style={{ minWidth }}
          >
            <thead className="sticky top-0 z-10">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    style={pinStyle(c)}
                    className={`group border-b border-r border-line bg-surface-page px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-400 ${
                      c.pinned ? 'z-[2]' : ''
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <span className="truncate">{fieldLabel(c.key)}</span>
                      {view.canEdit && (
                        <button
                          onClick={() => setPinned(c.key, !c.pinned)}
                          title={c.pinned ? 'Unpin' : 'Pin column'}
                          className={`ml-auto shrink-0 ${
                            c.pinned
                              ? 'text-brand-600'
                              : 'text-ink-faint opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {c.pinned ? (
                            <PinOff className="h-3 w-3" />
                          ) : (
                            <Pin className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="group/row">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={pinStyle(c)}
                      className={`border-b border-r border-line-soft bg-white px-3 py-2 align-middle dark:border-gray-800 dark:bg-gray-900 ${
                        c.pinned ? 'z-[1]' : ''
                      }`}
                    >
                      <Cell row={row} colKey={c.key} />
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-3 py-8 text-center text-sm text-ink-faint"
                  >
                    No issues match this view's filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <ViewEditor
          view={view}
          fields={fields}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}

function Cell({ row, colKey }: { row: ViewRowDto; colKey: string }) {
  if (colKey.startsWith('cf:')) {
    return <CfValue value={row.customValues[colKey.slice(3)] ?? null} />;
  }
  const dash = <span className="text-ink-faint">—</span>;
  switch (colKey) {
    case 'key':
      return (
        <Link
          to={`/issues/${row.key}`}
          className="font-mono text-[12px] text-brand-600 hover:underline"
        >
          {row.key}
        </Link>
      );
    case 'type':
      return (
        <span className="flex items-center gap-1.5 text-ink-soft dark:text-gray-200">
          <IssueTypeIcon type={row.type} />
          {ISSUE_TYPE_META[row.type].label}
        </span>
      );
    case 'title':
      return (
        <Link
          to={`/issues/${row.key}`}
          className="line-clamp-1 text-ink hover:text-brand-700 dark:text-gray-100"
          title={row.title}
        >
          {row.title}
        </Link>
      );
    case 'status':
      return row.status ? (
        <span className="inline-flex items-center gap-1.5 text-ink-soft dark:text-gray-200">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{
              backgroundColor: STATUS_CATEGORY_META[row.status.category].color,
            }}
          />
          {row.status.name}
        </span>
      ) : (
        dash
      );
    case 'priority':
      return (
        <span
          className="text-[12px] font-medium"
          style={{ color: PRIORITY_META[row.priority].color }}
        >
          {PRIORITY_META[row.priority].label}
        </span>
      );
    case 'assignee':
      return row.assignee ? (
        <span className="flex items-center gap-1.5 text-ink-soft dark:text-gray-200">
          <Avatar user={row.assignee} size="xs" /> {row.assignee.displayName}
        </span>
      ) : (
        dash
      );
    case 'reporter':
      return row.reporter ? (
        <span className="flex items-center gap-1.5 text-ink-soft dark:text-gray-200">
          <Avatar user={row.reporter} size="xs" /> {row.reporter.displayName}
        </span>
      ) : (
        dash
      );
    case 'teams':
      return row.teams.length ? (
        <span className="flex flex-wrap gap-1">
          {row.teams.map((t) => (
            <TeamChip key={t.id} team={t} />
          ))}
        </span>
      ) : (
        dash
      );
    case 'labels':
      return row.labels.length ? (
        <span className="flex flex-wrap gap-1">
          {row.labels.map((l) => (
            <LabelBadge key={l.id} label={l} />
          ))}
        </span>
      ) : (
        dash
      );
    case 'storyPoints':
      return row.storyPoints != null ? (
        <span className="text-ink-soft dark:text-gray-200">{row.storyPoints}</span>
      ) : (
        dash
      );
    case 'startDate':
      return row.startDate ? <span>{formatDate(row.startDate)}</span> : dash;
    case 'dueDate':
      return row.dueDate ? <span>{formatDate(row.dueDate)}</span> : dash;
    case 'updatedAt':
      return <span className="text-ink-muted">{relativeTime(row.updatedAt)}</span>;
    case 'project':
      return <Badge>{row.projectKey}</Badge>;
    default:
      return dash;
  }
}

function CfValue({ value }: { value: CustomFieldValue }) {
  if (value == null || value === '')
    return <span className="text-ink-faint">—</span>;
  if (typeof value === 'boolean')
    return <span>{value ? '✓' : '✗'}</span>;
  if (Array.isArray(value))
    return <span className="text-ink-soft dark:text-gray-200">{value.join(', ')}</span>;
  return (
    <span className="text-ink-soft dark:text-gray-200">{String(value)}</span>
  );
}
