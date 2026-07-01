import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Bookmark, Filter, Search as SearchIcon, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import {
  ISSUE_TYPES,
  PRIORITIES,
  type IssueFilterCriteria,
  type IssueSummaryDto,
  type SavedFilterDto,
  type StatusCategory,
} from '@tasku/types';
import {
  apiErrorMessage,
  filtersApi,
  projectsApi,
  searchApi,
  teamsApi,
  usersApi,
} from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import {
  ISSUE_TYPE_META,
  PRIORITY_META,
  STATUS_CATEGORY_META,
  formatDate,
} from '@/lib/format';
import { useDebounced } from '@/hooks/useDebounced';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { Select, inputClass } from '@/components/ui/Select';
import { TeamChip } from '@/components/ui/TeamChip';
import { IssueTypeIcon, PriorityIcon } from '@/components/ui/icons';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';

const STATUS_CATEGORIES: StatusCategory[] = ['TODO', 'IN_PROGRESS', 'DONE'];

const EMPTY: IssueFilterCriteria = {};

export default function SearchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [criteria, setCriteria] = useState<IssueFilterCriteria>(EMPTY);
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);

  const debounced = useDebounced(criteria, 300);

  const { data: projects = [] } = useQuery({
    queryKey: qk.projects,
    queryFn: projectsApi.list,
  });
  const { data: users = [] } = useQuery({
    queryKey: qk.users,
    queryFn: usersApi.list,
  });
  const { data: teams = [] } = useQuery({
    queryKey: qk.teams,
    queryFn: teamsApi.list,
  });
  const { data: savedFilters = [] } = useQuery({
    queryKey: qk.filters,
    queryFn: filtersApi.list,
  });
  // Labels depend on the chosen project.
  const { data: labels = [] } = useQuery({
    queryKey: qk.labels(criteria.projectKey ?? ''),
    queryFn: () => projectsApi.labels(criteria.projectKey as string),
    enabled: !!criteria.projectKey,
  });

  const { data: result, isFetching } = useQuery({
    queryKey: qk.search(debounced),
    queryFn: () => searchApi.issues(debounced),
  });

  const removeFilter = useMutation({
    mutationFn: (id: string) => filtersApi.remove(id),
    onSuccess: (_d, id) => {
      queryClient.invalidateQueries({ queryKey: qk.filters });
      if (activeFilterId === id) setActiveFilterId(null);
    },
  });

  function update(patch: Partial<IssueFilterCriteria>) {
    setCriteria((c) => ({ ...c, ...patch }));
    setActiveFilterId(null);
  }

  function toggleArray<K extends keyof IssueFilterCriteria>(
    key: K,
    value: string,
  ) {
    setCriteria((c) => {
      const arr = (c[key] as string[] | undefined) ?? [];
      const next = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value];
      return { ...c, [key]: next.length ? next : undefined };
    });
    setActiveFilterId(null);
  }

  function loadSaved(f: SavedFilterDto) {
    setCriteria(f.criteria);
    setActiveFilterId(f.id);
  }

  const issues = result?.issues ?? [];

  return (
    <>
      <PageHeader
        title="Search"
        subtitle="Find issues across all projects"
        actions={
          <Button variant="secondary" onClick={() => setSaveOpen(true)}>
            <Bookmark className="h-4 w-4" /> Save filter
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Saved filters rail */}
        <aside className="w-60 shrink-0 overflow-y-auto scrollbar-thin border-r border-line dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-4">
          <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-gray-400">
            Saved filters
          </h2>
          {savedFilters.length === 0 ? (
            <p className="px-1 text-sm text-ink-faint">No saved filters yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {savedFilters.map((f) => (
                <li key={f.id} className="group flex items-center">
                  <button
                    onClick={() => loadSaved(f)}
                    className={clsx(
                      'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                      activeFilterId === f.id
                        ? 'bg-brand-50 dark:bg-brand-500/15 font-medium text-brand-700 dark:text-brand-300'
                        : 'text-ink-soft dark:text-gray-200 hover:bg-surface-sunken dark:hover:bg-gray-800',
                    )}
                  >
                    <Filter className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    {f.shared && (
                      <span className="shrink-0 rounded bg-surface-sunken dark:bg-gray-800 px-1 text-[10px] text-ink-muted dark:text-gray-400">
                        shared
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete filter “${f.name}”?`)) removeFilter.mutate(f.id);
                    }}
                    className="ml-0.5 hidden h-7 w-7 items-center justify-center rounded text-ink-faint hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 group-hover:flex"
                    title="Delete filter"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Builder + results */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Criteria builder */}
          <div className="space-y-3 border-b border-line dark:border-gray-700 bg-white dark:bg-gray-900 px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  value={criteria.text ?? ''}
                  onChange={(e) => update({ text: e.target.value || undefined })}
                  placeholder="Text…"
                  className={`${inputClass} h-9 w-56 pl-8`}
                />
              </div>
              <Select
                value={criteria.projectKey ?? ''}
                onChange={(e) =>
                  update({
                    projectKey: e.target.value || undefined,
                    labelIds: undefined,
                  })
                }
                placeholder="All projects"
                className="h-9 w-auto"
                options={projects.map((p) => ({ value: p.key, label: p.name }))}
              />
              <Select
                value=""
                onChange={(e) => {
                  if (e.target.value) toggleArray('assigneeIds', e.target.value);
                }}
                placeholder="Add assignee…"
                className="h-9 w-auto"
                options={users.map((u) => ({ value: u.id, label: u.displayName }))}
              />
              <Select
                value=""
                onChange={(e) => {
                  if (e.target.value) toggleArray('teamIds', e.target.value);
                }}
                placeholder="Add team…"
                className="h-9 w-auto"
                options={teams.map((t) => ({ value: t.id, label: t.name }))}
              />
            </div>

            {/* Status categories */}
            <FilterRow label="Status">
              {STATUS_CATEGORIES.map((sc) => (
                <Chip
                  key={sc}
                  active={(criteria.statusCategories ?? []).includes(sc)}
                  onClick={() => toggleArray('statusCategories', sc)}
                >
                  {STATUS_CATEGORY_META[sc].label}
                </Chip>
              ))}
            </FilterRow>

            <FilterRow label="Type">
              {ISSUE_TYPES.map((t) => (
                <Chip
                  key={t}
                  active={(criteria.types ?? []).includes(t)}
                  onClick={() => toggleArray('types', t)}
                >
                  {ISSUE_TYPE_META[t].label}
                </Chip>
              ))}
            </FilterRow>

            <FilterRow label="Priority">
              {PRIORITIES.map((p) => (
                <Chip
                  key={p}
                  active={(criteria.priorities ?? []).includes(p)}
                  onClick={() => toggleArray('priorities', p)}
                >
                  {PRIORITY_META[p].label}
                </Chip>
              ))}
            </FilterRow>

            {criteria.projectKey && labels.length > 0 && (
              <FilterRow label="Labels">
                {labels.map((l) => (
                  <Chip
                    key={l.id}
                    active={(criteria.labelIds ?? []).includes(l.id)}
                    onClick={() => toggleArray('labelIds', l.id)}
                  >
                    {l.name}
                  </Chip>
                ))}
              </FilterRow>
            )}

            <SelectedPeople
              users={users}
              teams={teams}
              criteria={criteria}
              onClear={() =>
                setCriteria((c) => ({
                  ...c,
                  assigneeIds: undefined,
                  teamIds: undefined,
                }))
              }
              onRemoveAssignee={(id) => toggleArray('assigneeIds', id)}
              onRemoveTeam={(id) => toggleArray('teamIds', id)}
            />
          </div>

          {/* Results */}
          <div className="flex-1 overflow-auto scrollbar-thin bg-surface-page dark:bg-gray-950 p-6">
            <div className="mb-3 flex items-center gap-2 text-sm text-ink-muted dark:text-gray-400">
              {isFetching ? (
                <>
                  <Spinner className="h-4 w-4" /> Searching…
                </>
              ) : (
                <span>{result?.total ?? 0} results</span>
              )}
            </div>

            {!isFetching && issues.length === 0 ? (
              <EmptyState
                icon={<SearchIcon className="h-10 w-10" />}
                title="No matching issues"
                description="Adjust the criteria above to broaden your search."
              />
            ) : (
              <ResultsTable
                issues={issues}
                onOpen={(k) => navigate(`/issues/${k}`)}
              />
            )}
          </div>
        </div>
      </div>

      <SaveFilterModal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        criteria={criteria}
        onSaved={(f) => {
          setActiveFilterId(f.id);
          setSaveOpen(false);
        }}
      />
    </>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-16 shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-faint">
        {label}
      </span>
      {children}
    </div>
  );
}

function SelectedPeople({
  users,
  teams,
  criteria,
  onRemoveAssignee,
  onRemoveTeam,
  onClear,
}: {
  users: { id: string; displayName: string }[];
  teams: { id: string; name: string }[];
  criteria: IssueFilterCriteria;
  onRemoveAssignee: (id: string) => void;
  onRemoveTeam: (id: string) => void;
  onClear: () => void;
}) {
  const aIds = criteria.assigneeIds ?? [];
  const tIds = criteria.teamIds ?? [];
  if (aIds.length === 0 && tIds.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-16 shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-faint">
        Selected
      </span>
      {aIds.map((id) => {
        const u = users.find((x) => x.id === id);
        return (
          <Chip key={`a-${id}`} active onClick={() => onRemoveAssignee(id)}>
            {u?.displayName ?? id} ✕
          </Chip>
        );
      })}
      {tIds.map((id) => {
        const t = teams.find((x) => x.id === id);
        return (
          <Chip key={`t-${id}`} active onClick={() => onRemoveTeam(id)}>
            {t?.name ?? id} ✕
          </Chip>
        );
      })}
      <button
        onClick={onClear}
        className="text-xs font-medium text-ink-faint hover:text-ink-muted"
      >
        Clear
      </button>
    </div>
  );
}

function ResultsTable({
  issues,
  onOpen,
}: {
  issues: IssueSummaryDto[];
  onOpen: (key: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line dark:border-gray-700 bg-white shadow-card dark:bg-gray-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line dark:border-gray-700 bg-surface-sunken dark:bg-gray-800/50 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-gray-400">
            <th className="w-10 px-3 py-2.5">Type</th>
            <th className="px-3 py-2.5">Key</th>
            <th className="px-3 py-2.5">Summary</th>
            <th className="px-3 py-2.5">Assignee</th>
            <th className="px-3 py-2.5">Team</th>
            <th className="px-3 py-2.5">Priority</th>
            <th className="px-3 py-2.5 text-right">Points</th>
            <th className="px-3 py-2.5">Due date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft dark:divide-gray-700">
          {issues.map((issue) => (
            <tr
              key={issue.id}
              onClick={() => onOpen(issue.key)}
              className="cursor-pointer transition-colors hover:bg-surface-sunken dark:hover:bg-gray-800"
            >
              <td className="px-3 py-2.5 align-middle">
                <IssueTypeIcon type={issue.type} />
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 align-middle font-mono text-xs font-semibold text-ink-muted dark:text-gray-400">
                {issue.key}
              </td>
              <td className="max-w-md px-3 py-2.5 align-middle">
                <span className="line-clamp-1 text-ink dark:text-gray-200">{issue.title}</span>
              </td>
              <td className="px-3 py-2.5 align-middle">
                <div className="flex items-center gap-1.5">
                  <Avatar user={issue.assignee} size="xs" />
                  <span className="text-xs text-ink-muted dark:text-gray-400">
                    {issue.assignee?.displayName ?? 'Unassigned'}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2.5 align-middle">
                {issue.team ? (
                  <TeamChip team={issue.team} />
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </td>
              <td className="px-3 py-2.5 align-middle">
                <span className="flex items-center gap-1 text-xs text-ink-muted dark:text-gray-400">
                  <PriorityIcon priority={issue.priority} className="h-3.5 w-3.5" />
                  {PRIORITY_META[issue.priority].label}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right align-middle text-ink-muted dark:text-gray-400">
                {issue.storyPoints ?? <span className="text-ink-faint">—</span>}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 align-middle text-ink-muted dark:text-gray-400">
                {issue.dueDate ? (
                  formatDate(issue.dueDate)
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SaveFilterModal({
  open,
  onClose,
  criteria,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  criteria: IssueFilterCriteria;
  onSaved: (f: SavedFilterDto) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => filtersApi.create({ name: name.trim(), criteria, shared }),
    onSuccess: (f) => {
      queryClient.invalidateQueries({ queryKey: qk.filters });
      setName('');
      setShared(false);
      onSaved(f);
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not save filter')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save filter"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setError(null);
              if (name.trim()) save.mutate();
            }}
            loading={save.isPending}
            disabled={!name.trim()}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-gray-400">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="My open bugs…"
            className={inputClass}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-soft dark:text-gray-200">
          <input
            type="checkbox"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
            className="h-4 w-4 rounded border-line dark:border-gray-700 text-brand-600"
          />
          Share with everyone on the workspace
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
