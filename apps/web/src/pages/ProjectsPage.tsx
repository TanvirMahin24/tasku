import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Plus } from 'lucide-react';
import type {
  IssueSummaryDto,
  ProjectDto,
  StatusCategory,
} from '@tasku/types';
import { apiErrorMessage, projectsApi, searchApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { avatarColor } from '@/lib/format';
import { useAuthStore } from '@/store/auth';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IssueTypeIcon, PriorityIcon } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { inputClass } from '@/components/ui/Select';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState, PageHeader } from '@/components/ui/PageHeader';

export default function ProjectsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: projects, isLoading } = useQuery({
    queryKey: qk.projects,
    queryFn: projectsApi.list,
  });
  const { data: recommended = [] } = useQuery({
    queryKey: qk.recommendedProjects,
    queryFn: projectsApi.recommended,
  });

  return (
    <>
      <PageHeader
        title="Spaces"
        subtitle="Your spaces and everything assigned to you"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create space
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <div className="mx-auto max-w-6xl space-y-8">
          <YourTasks />

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Your spaces
            </h2>
            {isLoading ? (
              <PageSpinner label="Loading spaces…" />
            ) : !projects || projects.length === 0 ? (
              <EmptyState
                icon={<FolderKanban className="h-10 w-10" />}
                title="No spaces yet"
                description="Create your first space to start tracking work."
                action={
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" /> Create space
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {projects.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            )}
          </section>

          {recommended.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Recommended spaces
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {recommended.map((p) => (
                  <RecommendedCard key={p.id} project={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

const TASK_FILTERS: { label: string; value: StatusCategory | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'To do', value: 'TODO' },
  { label: 'In progress', value: 'IN_PROGRESS' },
  { label: 'Done', value: 'DONE' },
];

function YourTasks() {
  const userId = useAuthStore((s) => s.user?.id);
  const [filter, setFilter] = useState<StatusCategory | 'ALL'>('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['spaces', 'my-tasks', userId, filter],
    queryFn: () =>
      searchApi.issues({
        assigneeIds: userId ? [userId] : [],
        statusCategories: filter === 'ALL' ? undefined : [filter],
      }),
    enabled: !!userId,
  });
  const issues = data?.issues ?? [];

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Your tasks
        </h2>
        <div className="flex gap-1">
          {TASK_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={
                filter === f.value
                  ? 'rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white'
                  : 'rounded-md px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {isLoading ? (
          <p className="px-2 py-3 text-sm text-gray-400">Loading…</p>
        ) : issues.length === 0 ? (
          <p className="px-2 py-3 text-sm text-gray-400">No tasks match.</p>
        ) : (
          <ul className="space-y-0.5">
            {issues.map((i) => (
              <TaskRow key={i.id} issue={i} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function TaskRow({ issue }: { issue: IssueSummaryDto }) {
  return (
    <li>
      <Link
        to={`/issues/${issue.key}`}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <IssueTypeIcon type={issue.type} />
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {issue.key}
        </span>
        <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
          {issue.title}
        </span>
        <PriorityIcon priority={issue.priority} className="h-3.5 w-3.5" />
      </Link>
    </li>
  );
}

function RecommendedCard({ project }: { project: ProjectDto }) {
  return (
    <div className="flex flex-col rounded-xl border border-dashed border-gray-300 bg-white/50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: avatarColor(project.key) }}
        >
          {project.key.slice(0, 2)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
            {project.name}
          </p>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {project.key}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-gray-500 dark:text-gray-400">
        {project.description || 'No description'}
      </p>
      <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400 dark:border-gray-700">
        Ask an admin to add you
      </p>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectDto }) {
  return (
    <Link
      to={`/projects/${project.key}/board`}
      className="group flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: avatarColor(project.key) }}
        >
          {project.key.slice(0, 2)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-700">
            {project.name}
          </p>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {project.key}
          </p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-gray-500 dark:text-gray-400">
        {project.description || 'No description'}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3">
        <span className="text-xs text-gray-400">
          {project.role ? project.role.toLowerCase() : 'member'}
        </span>
        {project.lead && (
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Avatar user={project.lead} size="xs" />
            {project.lead.displayName}
          </span>
        )}
      </div>
    </Link>
  );
}

export function CreateProjectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setKey('');
    setName('');
    setDescription('');
    setError(null);
  }

  const create = useMutation({
    mutationFn: () =>
      projectsApi.create({
        key: key.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.projects });
      reset();
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not create project')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!key.trim() || !name.trim()) {
      setError('Key and name are required.');
      return;
    }
    create.mutate();
  }

  function close() {
    if (!create.isPending) {
      reset();
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Create project"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            form="create-project-form"
            type="submit"
            loading={create.isPending}
          >
            Create
          </Button>
        </>
      }
    >
      <form id="create-project-form" onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Key <span className="text-red-500">*</span>
          </span>
          <input
            className={`${inputClass} font-mono uppercase`}
            value={key}
            onChange={(e) =>
              setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))
            }
            placeholder="TASK"
            autoFocus
          />
          <span className="mt-1 block text-xs text-gray-400 dark:text-gray-400">
            Used as the prefix for issues, e.g. {key || 'TASK'}-1.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Name <span className="text-red-500">*</span>
          </span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Project"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Description
          </span>
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about?"
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
