import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Plus } from 'lucide-react';
import type { ProjectDto } from '@tasku/types';
import { apiErrorMessage, projectsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { avatarColor } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
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

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="All projects you have access to"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create project
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {isLoading ? (
          <PageSpinner label="Loading projects…" />
        ) : !projects || projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-10 w-10" />}
            title="No projects yet"
            description="Create your first project to start tracking work."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Create project
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
      </div>

      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
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
