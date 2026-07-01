import { useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  Flag,
  Plus,
} from 'lucide-react';
import clsx from 'clsx';
import type { IssueSummaryDto, SprintDto } from '@tasku/types';
import { apiErrorMessage, issuesApi, sprintsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { useProjectMeta } from '@/hooks/useProjectMeta';
import { useProjectSocket } from '@/hooks/useProjectSocket';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { inputClass } from '@/components/ui/Select';
import { PageSpinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { LabelBadge } from '@/components/ui/Badge';
import { IssueTypeIcon, PriorityIcon } from '@/components/ui/icons';
import { CreateIssueModal } from '@/components/CreateIssueModal';
import { IssueDrawer } from '@/components/IssueDrawer';

const BACKLOG = 'backlog';

export default function BacklogPage() {
  const { key = '' } = useParams<{ key: string }>();
  useProjectSocket(key);

  const [openIssueKey, setOpenIssueKey] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSprintFor, setCreateSprintFor] = useState<string | undefined>(undefined);
  const [sprintModalOpen, setSprintModalOpen] = useState(false);

  const { data: sprints, isLoading: sprintsLoading } = useQuery({
    queryKey: qk.sprints(key),
    queryFn: () => sprintsApi.list(key),
    enabled: !!key,
  });

  // Open sprints (future/active) shown as sections, plus the backlog bucket.
  const openSprints = useMemo(
    () => (sprints ?? []).filter((s) => s.state !== 'CLOSED'),
    [sprints],
  );

  // Fetch issues per sprint section + backlog in parallel.
  const sections = [...openSprints.map((s) => s.id), BACKLOG];
  const issueQueries = useQueries({
    queries: sections.map((sectionId) => ({
      queryKey: qk.issues(key, { sprintId: sectionId }),
      queryFn: () => issuesApi.list(key, { sprintId: sectionId }),
      enabled: !!key,
    })),
  });

  const issuesBySection: Record<string, IssueSummaryDto[]> = {};
  sections.forEach((id, i) => {
    issuesBySection[id] = issueQueries[i]?.data ?? [];
  });

  if (sprintsLoading) {
    return (
      <>
        <PageHeader title="Backlog" />
        <PageSpinner label="Loading backlog…" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Backlog"
        subtitle="Plan sprints and groom your backlog"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setSprintModalOpen(true)}
            >
              <Plus className="h-4 w-4" /> Create sprint
            </Button>
            <Button onClick={() => { setCreateSprintFor(BACKLOG); setCreateOpen(true); }}>
              <Plus className="h-4 w-4" /> Create issue
            </Button>
          </>
        }
      />

      <div className="flex-1 space-y-4 overflow-y-auto scrollbar-thin p-6">
        {openSprints.map((sprint) => (
          <SprintSection
            key={sprint.id}
            projectKey={key}
            sprint={sprint}
            sprints={sprints ?? []}
            issues={issuesBySection[sprint.id] ?? []}
            onOpenIssue={setOpenIssueKey}
            onAddIssue={() => {
              setCreateSprintFor(sprint.id);
              setCreateOpen(true);
            }}
          />
        ))}

        <BacklogSection
          projectKey={key}
          sprints={sprints ?? []}
          issues={issuesBySection[BACKLOG] ?? []}
          onOpenIssue={setOpenIssueKey}
          onAddIssue={() => {
            setCreateSprintFor(BACKLOG);
            setCreateOpen(true);
          }}
        />
      </div>

      <CreateSprintModal
        projectKey={key}
        open={sprintModalOpen}
        onClose={() => setSprintModalOpen(false)}
      />

      <CreateIssueModal
        projectKey={key}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultSprintId={createSprintFor}
        onCreated={(issueKey) => setOpenIssueKey(issueKey)}
      />

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
// Sprint section (collapsible)
// ---------------------------------------------------------------------------

function SprintSection({
  projectKey,
  sprint,
  sprints,
  issues,
  onOpenIssue,
  onAddIssue,
}: {
  projectKey: string;
  sprint: SprintDto;
  sprints: SprintDto[];
  issues: IssueSummaryDto[];
  onOpenIssue: (key: string) => void;
  onAddIssue: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: qk.sprints(projectKey) });
    queryClient.invalidateQueries({ queryKey: ['project', projectKey, 'issues'] });
    queryClient.invalidateQueries({ queryKey: ['project', projectKey, 'board'] });
    queryClient.invalidateQueries({ queryKey: ['project', projectKey] });
  }

  const start = useMutation({
    mutationFn: () => sprintsApi.start(sprint.id),
    onSuccess: invalidate,
    onError: (e) => setError(apiErrorMessage(e, 'Could not start sprint')),
  });
  const complete = useMutation({
    mutationFn: () => sprintsApi.complete(sprint.id),
    onSuccess: invalidate,
    onError: (e) => setError(apiErrorMessage(e, 'Could not complete sprint')),
  });

  const points = issues.reduce((n, i) => n + (i.storyPoints ?? 0), 0);

  return (
    <section className="overflow-hidden rounded-lg border border-line dark:border-gray-700 bg-white dark:bg-gray-900 shadow-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft dark:border-gray-700 bg-surface-sunken dark:bg-gray-800/50 px-3 py-2.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <span className="truncate font-semibold text-ink dark:text-gray-100">
            {sprint.name}
          </span>
          {sprint.state === 'ACTIVE' && (
            <span className="rounded-full bg-green-100 dark:bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:text-green-300">
              Active
            </span>
          )}
          {sprint.goal && (
            <span className="hidden truncate text-xs text-gray-400 md:inline">
              {sprint.goal}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            {issues.length} issues · {points} pts
          </span>
          {sprint.state === 'FUTURE' && (
            <Button
              size="sm"
              variant="secondary"
              loading={start.isPending}
              onClick={() => start.mutate()}
            >
              Start sprint
            </Button>
          )}
          {sprint.state === 'ACTIVE' && (
            <Button
              size="sm"
              variant="secondary"
              loading={complete.isPending}
              onClick={() => complete.mutate()}
            >
              Complete sprint
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="bg-red-50 dark:bg-red-500/10 px-3 py-1.5 text-xs text-red-700 dark:text-red-300">{error}</p>
      )}

      {open && (
        <IssueRows
          projectKey={projectKey}
          sprints={sprints}
          currentSprintId={sprint.id}
          issues={issues}
          onOpenIssue={onOpenIssue}
          onAddIssue={onAddIssue}
          emptyLabel="No issues in this sprint yet."
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Backlog section
// ---------------------------------------------------------------------------

function BacklogSection({
  projectKey,
  sprints,
  issues,
  onOpenIssue,
  onAddIssue,
}: {
  projectKey: string;
  sprints: SprintDto[];
  issues: IssueSummaryDto[];
  onOpenIssue: (key: string) => void;
  onAddIssue: () => void;
}) {
  const [open, setOpen] = useState(true);
  const points = issues.reduce((n, i) => n + (i.storyPoints ?? 0), 0);

  return (
    <section className="overflow-hidden rounded-lg border border-line dark:border-gray-700 bg-white dark:bg-gray-900 shadow-card">
      <div className="flex items-center gap-2 border-b border-line-soft dark:border-gray-700 bg-surface-sunken dark:bg-gray-800/50 px-3 py-2.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <CircleDot className="h-4 w-4 text-gray-400" />
          <span className="font-semibold text-ink dark:text-gray-100">Backlog</span>
        </button>
        <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
          {issues.length} issues · {points} pts
        </span>
      </div>

      {open && (
        <IssueRows
          projectKey={projectKey}
          sprints={sprints}
          currentSprintId={null}
          issues={issues}
          onOpenIssue={onOpenIssue}
          onAddIssue={onAddIssue}
          emptyLabel="Your backlog is empty."
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Issue rows (shared by sprint + backlog)
// ---------------------------------------------------------------------------

function IssueRows({
  projectKey,
  sprints,
  currentSprintId,
  issues,
  onOpenIssue,
  onAddIssue,
  emptyLabel,
}: {
  projectKey: string;
  sprints: SprintDto[];
  currentSprintId: string | null;
  issues: IssueSummaryDto[];
  onOpenIssue: (key: string) => void;
  onAddIssue: () => void;
  emptyLabel: string;
}) {
  const queryClient = useQueryClient();
  const { users } = useProjectMeta(projectKey);

  const moveSprint = useMutation({
    mutationFn: ({ issueKey, sprintId }: { issueKey: string; sprintId: string | null }) =>
      issuesApi.update(issueKey, { sprintId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectKey, 'issues'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectKey, 'board'] });
    },
  });

  const sprintOptions = sprints.filter((s) => s.state !== 'CLOSED');

  return (
    <div>
      {issues.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-400">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-gray-700">
          {issues.map((issue) => {
            const assignee = issue.assignee
              ? users.find((u) => u.id === issue.assignee?.id) ?? issue.assignee
              : null;
            return (
              <li
                key={issue.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <button
                  onClick={() => onOpenIssue(issue.key)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <IssueTypeIcon type={issue.type} boxed />
                  <span className="shrink-0 font-mono text-xs font-semibold text-ink-faint dark:text-gray-400">
                    {issue.key}
                  </span>
                  <span className="truncate text-sm text-ink dark:text-gray-200">
                    {issue.title}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {issue.labels.slice(0, 3).map((l) => (
                      <LabelBadge key={l.id} label={l} />
                    ))}
                  </span>
                </button>

                <div className="flex shrink-0 items-center gap-2.5">
                  <PriorityIcon priority={issue.priority} />
                  {issue.storyPoints != null && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 px-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                      {issue.storyPoints}
                    </span>
                  )}
                  <Avatar user={assignee} size="sm" />
                  <select
                    value={currentSprintId ?? BACKLOG}
                    onChange={(e) =>
                      moveSprint.mutate({
                        issueKey: issue.key,
                        sprintId: e.target.value === BACKLOG ? null : e.target.value,
                      })
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 pl-2 pr-6 text-xs text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    title="Move to sprint"
                  >
                    <option value={BACKLOG}>Backlog</option>
                    {sprintOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={onAddIssue}
        className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-brand-600"
      >
        <Plus className="h-4 w-4" /> Create issue
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create sprint modal
// ---------------------------------------------------------------------------

function CreateSprintModal({
  projectKey,
  open,
  onClose,
}: {
  projectKey: string;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      sprintsApi.create(projectKey, {
        name: name.trim(),
        goal: goal.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.sprints(projectKey) });
      setName('');
      setGoal('');
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Could not create sprint')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Sprint name is required.');
      return;
    }
    create.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={() => !create.isPending && onClose()}
      title={
        <span className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-brand-600" /> Create sprint
        </span>
      }
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button form="create-sprint-form" type="submit" loading={create.isPending}>
            Create
          </Button>
        </>
      }
    >
      <form id="create-sprint-form" onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Name <span className="text-red-500">*</span>
          </span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sprint 1"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Goal
          </span>
          <textarea
            className={clsx(inputClass, 'min-h-[72px] resize-y')}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What do you want to achieve?"
          />
        </label>
        {error && (
          <p className="rounded-md bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
