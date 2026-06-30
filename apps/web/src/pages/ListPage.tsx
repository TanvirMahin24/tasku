import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Rows3, Search } from 'lucide-react';
import clsx from 'clsx';
import {
  ISSUE_TYPES,
  type IssueListQuery,
  type IssueSummaryDto,
  type IssueType,
  type StatusDto,
} from '@tasku/types';
import { issuesApi, teamsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import {
  ISSUE_TYPE_META,
  PRIORITY_META,
  STATUS_CATEGORY_META,
  formatDate,
} from '@/lib/format';
import { useProjectMeta } from '@/hooks/useProjectMeta';
import { useProjectSocket } from '@/hooks/useProjectSocket';
import { Avatar } from '@/components/ui/Avatar';
import { Select, inputClass } from '@/components/ui/Select';
import { TeamChip } from '@/components/ui/TeamChip';
import { IssueTypeIcon, PriorityIcon } from '@/components/ui/icons';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState, PageHeader } from '@/components/ui/PageHeader';
import { IssueDrawer } from '@/components/IssueDrawer';

type SortField = NonNullable<IssueListQuery['orderBy']>;

export default function ListPage() {
  const { key = '' } = useParams<{ key: string }>();
  useProjectSocket(key);
  const { statuses, users } = useProjectMeta(key);

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

  const statusById = useMemo(() => {
    const m = new Map<string, StatusDto>();
    statuses.forEach((s) => m.set(s.id, s));
    return m;
  }, [statuses]);

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
      <PageHeader title="List" subtitle="All issues in this project" />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-6 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className={`${inputClass} h-9 w-52 pl-8`}
          />
        </div>
        <Select
          value={statusId}
          onChange={(e) => setStatusId(e.target.value)}
          placeholder="All statuses"
          className="h-9 w-auto"
          options={statuses.map((s) => ({ value: s.id, label: s.name }))}
        />
        <Select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          placeholder="All assignees"
          className="h-9 w-auto"
          options={users.map((u) => ({ value: u.id, label: u.displayName }))}
        />
        <Select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          placeholder="All teams"
          className="h-9 w-auto"
          options={teams.map((t) => ({ value: t.id, label: t.name }))}
        />
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as IssueType | '')}
          placeholder="All types"
          className="h-9 w-auto"
          options={ISSUE_TYPES.map((t) => ({
            value: t,
            label: ISSUE_TYPE_META[t].label,
          }))}
        />
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin bg-gray-50 p-6">
        {isLoading ? (
          <PageSpinner label="Loading issues…" />
        ) : !issues || issues.length === 0 ? (
          <EmptyState
            icon={<Rows3 className="h-10 w-10" />}
            title="No issues found"
            description="Try adjusting the filters above."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
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
              <tbody className="divide-y divide-gray-100">
                {issues.map((issue) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    status={statusById.get(issue.statusId)}
                    onClick={() => setOpenIssueKey(issue.key)}
                  />
                ))}
              </tbody>
            </table>
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

function IssueRow({
  issue,
  status,
  onClick,
}: {
  issue: IssueSummaryDto;
  status?: StatusDto;
  onClick: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer transition-colors hover:bg-gray-50"
    >
      <Td>
        <IssueTypeIcon type={issue.type} />
      </Td>
      <Td className="whitespace-nowrap font-mono text-xs font-semibold text-gray-500">
        {issue.key}
      </Td>
      <Td className="max-w-md">
        <span className="line-clamp-1 text-gray-800">{issue.title}</span>
      </Td>
      <Td>
        {status ? (
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: STATUS_CATEGORY_META[status.category].bg,
              color: STATUS_CATEGORY_META[status.category].color,
            }}
          >
            {status.name}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </Td>
      <Td>
        <div className="flex items-center gap-1.5">
          <Avatar user={issue.assignee} size="xs" />
          <span className="text-xs text-gray-600">
            {issue.assignee?.displayName ?? 'Unassigned'}
          </span>
        </div>
      </Td>
      <Td>{issue.team ? <TeamChip team={issue.team} /> : <span className="text-gray-300">—</span>}</Td>
      <Td>
        <span className="flex items-center gap-1 text-xs text-gray-600">
          <PriorityIcon priority={issue.priority} className="h-3.5 w-3.5" />
          {PRIORITY_META[issue.priority].label}
        </span>
      </Td>
      <Td className="text-right text-gray-600">
        {issue.storyPoints ?? <span className="text-gray-300">—</span>}
      </Td>
      <Td className="whitespace-nowrap text-gray-600">
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
          'inline-flex items-center gap-1 hover:text-gray-700',
          isActive && 'text-gray-900',
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
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={clsx('px-3 py-2.5 align-middle', className)}>{children}</td>;
}
