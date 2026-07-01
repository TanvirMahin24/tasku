import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import type { CreateTeamDto, TeamDto } from '@tasku/types';
import { apiErrorMessage, teamsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { inputClass } from '@/components/ui/Select';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState, PageHeader } from '@/components/ui/PageHeader';

const TEAM_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
];

export default function TeamsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: teams, isLoading } = useQuery({
    queryKey: qk.teams,
    queryFn: teamsApi.list,
  });

  return (
    <>
      <PageHeader
        title="Teams"
        subtitle="Groups of people that own work across projects"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create team
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {isLoading ? (
          <PageSpinner label="Loading teams…" />
        ) : !teams || teams.length === 0 ? (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="No teams yet"
            description="Create a team to group members and filter boards."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Create team
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {teams.map((t) => (
              <TeamCard key={t.id} team={t} />
            ))}
          </div>
        )}
      </div>

      <CreateTeamModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

function TeamCard({ team }: { team: TeamDto }) {
  return (
    <Link
      to={`/teams/${team.id}`}
      className="group flex flex-col rounded-lg border border-line dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full"
          style={{ backgroundColor: team.color }}
        />
        <p className="truncate font-semibold text-ink dark:text-gray-100 group-hover:text-brand-700">
          {team.name}
        </p>
      </div>
      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-ink-muted dark:text-gray-400">
        {team.description || 'No description'}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-line-soft dark:border-gray-700 pt-3">
        <div className="flex -space-x-2">
          {team.members.slice(0, 5).map((m) => (
            <Avatar key={m.user.id} user={m.user} size="xs" />
          ))}
          {team.members.length === 0 && (
            <span className="text-xs text-ink-faint">No members</span>
          )}
          {team.members.length > 5 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-sunken dark:bg-gray-800 text-[9px] font-semibold text-ink-muted dark:text-gray-400 ring-2 ring-white dark:ring-gray-900">
              +{team.members.length - 5}
            </span>
          )}
        </div>
        {team.issueCount != null && (
          <span className="text-xs text-ink-faint">
            {team.issueCount} {team.issueCount === 1 ? 'issue' : 'issues'}
          </span>
        )}
      </div>
    </Link>
  );
}

export function CreateTeamModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(TEAM_COLORS[6]);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setDescription('');
    setColor(TEAM_COLORS[6]);
    setError(null);
  }

  const create = useMutation({
    mutationFn: (dto: CreateTeamDto) => teamsApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.teams });
      reset();
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not create team')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    create.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
    });
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
      title="Create team"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={create.isPending}>
            Cancel
          </Button>
          <Button form="create-team-form" type="submit" loading={create.isPending}>
            Create
          </Button>
        </>
      }
    >
      <form id="create-team-form" onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-soft dark:text-gray-200">
            Name <span className="text-red-500">*</span>
          </span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Platform"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-soft dark:text-gray-200">
            Description
          </span>
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this team own?"
          />
        </label>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-soft dark:text-gray-200">
            Color
          </span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        {error && (
          <p className="rounded-md bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {TEAM_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="flex h-7 w-7 items-center justify-center rounded-full ring-offset-1 transition-transform hover:scale-110"
          style={{
            backgroundColor: c,
            boxShadow: value === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
          }}
          aria-label={c}
        />
      ))}
    </div>
  );
}
