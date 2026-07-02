import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Rows3, Search, X } from 'lucide-react';
import clsx from 'clsx';
import {
  ISSUE_TYPES,
  PRIORITIES,
  type BulkUpdateDto,
  type IssueListQuery,
  type IssueSummaryDto,
  type IssueType,
  type Priority,
  type StatusDto,
} from '@tasku/types';
import { apiErrorMessage, issuesApi, projectsApi, teamsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import {
  ISSUE_TYPE_META,
  PRIORITY_META,
  formatDate,
} from '@/lib/format';
import { useProjectMeta } from '@/hooks/useProjectMeta';
import { useProjectSocket } from '@/hooks/useProjectSocket';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { LabelPicker } from '@/components/ui/LabelPicker';
import { Select, inputClass } from '@/components/ui/Select';
import { TeamChip } from '@/components/ui/TeamChip';
import { IssueTypeIcon, PriorityLabel, StatusPill } from '@/components/ui/icons';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/PageHeader';
import { IssueDrawer } from '@/components/IssueDrawer';

type SortField = NonNullable<IssueListQuery['orderBy']>;

export default function ListPage() {
  const { key = '' } = useParams<{ key: string }>();
  useProjectSocket(key);
  const { statuses, users, labels, sprints } = useProjectMeta(key);

  const { data: teams = [] } = useQuery({
    queryKey: qk.teams,
    queryFn: teamsApi.list,
  });

  const [statusId, setStatusId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [type, setType] = useState<IssueType | ''>('');
  const [search, setSearch] = useState('');
  const [orderBy, setOrderBy] = useState<SortField>('rank');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [openIssueKey, setOpenIssueKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filters: IssueListQuery = useMemo(
    () => ({
      statusId: statusId || undefined,
      assigneeId: assigneeId || undefined,
      teamId: teamId || undefined,
      type: type || undefined,
      search: search.trim() || undefined,
      orderBy,
      order,
    }),
    [statusId, assigneeId, teamId, type, search, orderBy, order],
  );

  const { data: issues, isLoading } = useQuery({
    queryKey: qk.issues(key, filters),
    queryFn: () => issuesApi.list(key, filters),
    enabled: !!key,
  });

  const queryClient = useQueryClient();

  const statusById = useMemo(() => {
    const m = new Map<string, StatusDto>();
    statuses.forEach((s) => m.set(s.id, s));
    return m;
  }, [statuses]);

  // --- Selection ---
  const allKeys = useMemo(() => (issues ?? []).map((i) => i.key), [issues]);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));

  function toggleOne(issueKey: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(issueKey)) next.delete(issueKey);
      else next.add(issueKey);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allKeys));
  }

  const bulk = useMutation({
    mutationFn: (dto: BulkUpdateDto) => projectsApi.bulkUpdate(key, dto),
    onSuccess: () => {
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['project', key, 'issues'] });
      queryClient.invalidateQueries({ queryKey: ['project', key, 'board'] });
    },
  });

  function applyBulk(changes: BulkUpdateDto['changes']) {
    bulk.mutate({ issueKeys: [...selected], changes });
  }

  function toggleSort(field: SortField) {
    if (orderBy === field) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(field);
      setOrder('asc');
    }
  }

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className={`${inputClass} h-9 w-52 pl-8`}
          />
        </div>
        {/* Wrapper divs shrink to content; Select's base `w-full` fills them,
            so each sizes to its widest option instead of the whole row. */}
        <div>
          <Select
            value={statusId}
            onChange={(e) => setStatusId(e.target.value)}
            placeholder="All statuses"
            className="h-9"
            options={statuses.map((s) => ({ value: s.id, label: s.name }))}
          />
        </div>
        <div>
          <Select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            placeholder="All assignees"
            className="h-9"
            options={users.map((u) => ({ value: u.id, label: u.displayName }))}
          />
        </div>
        <div>
          <Select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            placeholder="All teams"
            className="h-9"
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
          />
        </div>
        <div>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as IssueType | '')}
            placeholder="All types"
            className="h-9"
            options={ISSUE_TYPES.map((t) => ({
              value: t,
              label: ISSUE_TYPE_META[t].label,
            }))}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin bg-surface-page dark:bg-gray-950 p-6">
        {isLoading ? (
          <PageSpinner label="Loading issues…" />
        ) : !issues || issues.length === 0 ? (
          <EmptyState
            icon={<Rows3 className="h-10 w-10" />}
            title="No issues found"
            description="Try adjusting the filters above."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-line dark:border-gray-700 bg-white dark:bg-gray-900 shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-soft dark:border-gray-700 bg-surface-sunken dark:bg-gray-800/50 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-gray-400">
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      title="Select all (filtered)"
                      className="h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-brand-600"
                    />
                  </Th>
                  <Th className="w-10">Type</Th>
                  <SortableTh
                    label="Key"
                    field="key"
                    active={orderBy}
                    order={order}
                    onSort={toggleSort}
                  />
                  <Th>Summary</Th>
                  <Th>Status</Th>
                  <Th>Assignee</Th>
                  <Th>Team</Th>
                  <SortableTh
                    label="Priority"
                    field="priority"
                    active={orderBy}
                    order={order}
                    onSort={toggleSort}
                  />
                  <Th className="text-right">Points</Th>
                  <SortableTh
                    label="Due date"
                    field="dueDate"
                    active={orderBy}
                    order={order}
                    onSort={toggleSort}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {issues.map((issue) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    status={statusById.get(issue.statusId)}
                    selected={selected.has(issue.key)}
                    onToggle={() => toggleOne(issue.key)}
                    onClick={() => setOpenIssueKey(issue.key)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          statuses={statuses}
          users={users}
          teams={teams}
          sprints={sprints}
          labels={labels}
          pending={bulk.isPending}
          error={bulk.error ? apiErrorMessage(bulk.error, 'Bulk update failed') : null}
          onApply={applyBulk}
          onClear={() => setSelected(new Set())}
        />
      )}

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

function BulkBar({
  count,
  statuses,
  users,
  teams,
  sprints,
  labels,
  pending,
  error,
  onApply,
  onClear,
}: {
  count: number;
  statuses: StatusDto[];
  users: { id: string; displayName: string }[];
  teams: { id: string; name: string }[];
  sprints: { id: string; name: string }[];
  labels: import('@tasku/types').LabelDto[];
  pending: boolean;
  error: string | null;
  onApply: (changes: BulkUpdateDto['changes']) => void;
  onClear: () => void;
}) {
  const [addLabelIds, setAddLabelIds] = useState<string[]>([]);
  const [removeLabelIds, setRemoveLabelIds] = useState<string[]>([]);

  return (
    <div className="sticky bottom-0 z-20 border-t border-line dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-3 shadow-[0_-2px_8px_rgba(9,30,66,0.08)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">
          {count} selected
        </span>

        <Select
          value=""
          onChange={(e) => e.target.value && onApply({ statusId: e.target.value })}
          placeholder="Set status…"
          className="h-9 w-auto"
          options={statuses.map((s) => ({ value: s.id, label: s.name }))}
        />
        <Select
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            onApply({ assigneeId: v === '__unassign__' ? null : v });
          }}
          placeholder="Set assignee…"
          className="h-9 w-auto"
          options={[
            { value: '__unassign__', label: 'Unassign' },
            ...users.map((u) => ({ value: u.id, label: u.displayName })),
          ]}
        />
        <Select
          value=""
          onChange={(e) =>
            e.target.value && onApply({ priority: e.target.value as Priority })
          }
          placeholder="Set priority…"
          className="h-9 w-auto"
          options={PRIORITIES.map((p) => ({
            value: p,
            label: PRIORITY_META[p].label,
          }))}
        />
        <Select
          value=""
          onChange={(e) =>
            onApply({
              teamIds: e.target.value === '__none__' ? [] : [e.target.value],
            })
          }
          placeholder="Set team…"
          className="h-9 w-auto"
          options={[
            { value: '__none__', label: 'No team' },
            ...teams.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
        <Select
          value=""
          onChange={(e) =>
            onApply({ sprintId: e.target.value === '__none__' ? null : e.target.value })
          }
          placeholder="Set sprint…"
          className="h-9 w-auto"
          options={[
            { value: '__none__', label: 'Backlog' },
            ...sprints.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />

        <div className="flex items-center gap-1.5">
          <div className="w-44">
            <LabelPicker
              labels={labels}
              selectedIds={addLabelIds}
              onChange={setAddLabelIds}
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={addLabelIds.length === 0}
            onClick={() => {
              onApply({ addLabelIds });
              setAddLabelIds([]);
            }}
          >
            Add labels
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="w-44">
            <LabelPicker
              labels={labels}
              selectedIds={removeLabelIds}
              onChange={setRemoveLabelIds}
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={removeLabelIds.length === 0}
            onClick={() => {
              onApply({ removeLabelIds });
              setRemoveLabelIds([]);
            }}
          >
            Remove labels
          </Button>
        </div>

        {pending && <span className="text-xs text-gray-400">Applying…</span>}

        <button
          onClick={onClear}
          className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <X className="h-4 w-4" /> Clear
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function IssueRow({
  issue,
  status,
  selected,
  onToggle,
  onClick,
}: {
  issue: IssueSummaryDto;
  status?: StatusDto;
  selected: boolean;
  onToggle: () => void;
  onClick: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={clsx(
        'cursor-pointer transition-colors',
        selected
          ? 'bg-brand-50/60 dark:bg-brand-500/15 hover:bg-brand-50 dark:hover:bg-brand-500/20'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800',
      )}
    >
      <Td onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-brand-600"
        />
      </Td>
      <Td>
        <IssueTypeIcon type={issue.type} />
      </Td>
      <Td className="whitespace-nowrap font-mono text-xs font-semibold text-ink-faint dark:text-gray-400">
        {issue.key}
      </Td>
      <Td className="max-w-md">
        <span className="line-clamp-1 text-ink dark:text-gray-200">{issue.title}</span>
      </Td>
      <Td>
        {status ? (
          <StatusPill category={status.category} label={status.name} />
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </Td>
      <Td>
        <div className="flex items-center gap-1.5">
          <Avatar user={issue.assignee} size="xs" />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {issue.assignee?.displayName ?? 'Unassigned'}
          </span>
        </div>
      </Td>
      <Td>
        {issue.teams.length ? (
          <span className="flex flex-wrap gap-1">
            {issue.teams.map((t) => (
              <TeamChip key={t.id} team={t} />
            ))}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </Td>
      <Td>
        <PriorityLabel priority={issue.priority} />
      </Td>
      <Td className="text-right text-gray-600 dark:text-gray-400">
        {issue.storyPoints ?? <span className="text-gray-300">—</span>}
      </Td>
      <Td className="whitespace-nowrap text-gray-600 dark:text-gray-400">
        {issue.dueDate ? formatDate(issue.dueDate) : <span className="text-gray-300">—</span>}
      </Td>
    </tr>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={clsx('px-3 py-2.5', className)}>{children}</th>;
}

function SortableTh({
  label,
  field,
  active,
  order,
  onSort,
}: {
  label: string;
  field: SortField;
  active: SortField;
  order: 'asc' | 'desc';
  onSort: (field: SortField) => void;
}) {
  const isActive = active === field;
  return (
    <th className="px-3 py-2.5">
      <button
        onClick={() => onSort(field)}
        className={clsx(
          'inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200',
          isActive && 'text-gray-900 dark:text-gray-100',
        )}
      >
        {label}
        {isActive &&
          (order === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          ))}
      </button>
    </th>
  );
}

function Td({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
}) {
  return (
    <td onClick={onClick} className={clsx('px-3 py-2.5 align-middle', className)}>
      {children}
    </td>
  );
}
