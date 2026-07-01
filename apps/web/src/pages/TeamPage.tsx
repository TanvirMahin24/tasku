import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, UserPlus } from 'lucide-react';
import type {
  TeamDto,
  TeamRole,
  UpdateTeamDto,
  UserDto,
} from '@tasku/types';
import { apiErrorMessage, teamsApi, usersApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Select, inputClass } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState, PageHeader } from '@/components/ui/PageHeader';
import { ColorPicker } from '@/pages/TeamsPage';

export default function TeamPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: team, isLoading, error } = useQuery({
    queryKey: qk.team(id),
    queryFn: () => teamsApi.get(id),
    enabled: !!id,
  });
  const { data: users = [] } = useQuery({
    queryKey: qk.users,
    queryFn: usersApi.list,
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (team) {
      setName(team.name);
      setDescription(team.description ?? '');
    }
  }, [team?.id, team?.name, team?.description]); // eslint-disable-line react-hooks/exhaustive-deps

  function syncTeam(updated: TeamDto) {
    queryClient.setQueryData<TeamDto>(qk.team(id), updated);
    queryClient.invalidateQueries({ queryKey: qk.teams });
  }

  const update = useMutation({
    mutationFn: (dto: UpdateTeamDto) => teamsApi.update(id, dto),
    onSuccess: syncTeam,
    onError: (err) => setErrorMsg(apiErrorMessage(err, 'Update failed')),
  });

  const addMember = useMutation({
    mutationFn: (dto: { userId: string; role: TeamRole }) =>
      teamsApi.addMember(id, dto),
    onSuccess: syncTeam,
    onError: (err) => setErrorMsg(apiErrorMessage(err, 'Could not add member')),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => teamsApi.removeMember(id, userId),
    onSuccess: syncTeam,
    onError: (err) => setErrorMsg(apiErrorMessage(err, 'Could not remove member')),
  });

  const remove = useMutation({
    mutationFn: () => teamsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.teams });
      navigate('/teams');
    },
    onError: (err) => setErrorMsg(apiErrorMessage(err, 'Could not delete team')),
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Team" />
        <PageSpinner label="Loading team…" />
      </>
    );
  }

  if (error || !team) {
    return (
      <>
        <PageHeader title="Team" />
        <div className="p-6">
          <EmptyState
            title="Team not found"
            description="This team may have been deleted or you may not have access."
            action={<Button onClick={() => navigate('/teams')}>Back to teams</Button>}
          />
        </div>
      </>
    );
  }

  const memberIds = new Set(team.members.map((m) => m.user.id));
  const candidates = users.filter((u) => !memberIds.has(u.id));

  function patch(dto: UpdateTeamDto) {
    setErrorMsg(null);
    update.mutate(dto);
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: team.color }}
            />
            {team.name}
          </span>
        }
        subtitle={`${team.members.length} ${team.members.length === 1 ? 'member' : 'members'}`}
        actions={
          <Button
            variant="danger"
            onClick={() => {
              if (confirm(`Delete team "${team.name}"? This cannot be undone.`)) {
                remove.mutate();
              }
            }}
            loading={remove.isPending}
          >
            <Trash2 className="h-4 w-4" /> Delete team
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto scrollbar-thin bg-surface-page dark:bg-gray-950 p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {errorMsg && (
            <p className="rounded-md bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {errorMsg}
            </p>
          )}

          {/* Settings */}
          <section className="rounded-lg border border-line dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-gray-400">
              Team details
            </h2>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink-soft dark:text-gray-200">
                  Name
                </span>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => {
                    const next = name.trim();
                    if (next && next !== team.name) patch({ name: next });
                    else if (!next) setName(team.name);
                  }}
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
                  onBlur={() => {
                    if (description !== (team.description ?? '')) {
                      patch({ description });
                    }
                  }}
                  placeholder="What does this team own?"
                />
              </label>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-ink-soft dark:text-gray-200">
                  Color
                </span>
                <ColorPicker
                  value={team.color}
                  onChange={(c) => patch({ color: c })}
                />
              </div>
            </div>
          </section>

          {/* Members */}
          <section className="rounded-lg border border-line dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-gray-400">
              Members
            </h2>

            <ul className="divide-y divide-line-soft dark:divide-gray-700">
              {team.members.length === 0 && (
                <li className="py-3 text-sm text-ink-faint">No members yet.</li>
              )}
              {team.members.map((m) => (
                <li
                  key={m.user.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar user={m.user} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink dark:text-gray-100">
                        {m.user.displayName}
                      </p>
                      <p className="truncate text-xs text-ink-faint">
                        {m.user.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        m.role === 'LEAD'
                          ? 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                          : undefined
                      }
                    >
                      {m.role === 'LEAD' ? 'Lead' : 'Member'}
                    </Badge>
                    <button
                      onClick={() => removeMember.mutate(m.user.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600"
                      title="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <AddMemberRow
              candidates={candidates}
              pending={addMember.isPending}
              onAdd={(userId, role) => addMember.mutate({ userId, role })}
            />
          </section>
        </div>
      </div>
    </>
  );
}

function AddMemberRow({
  candidates,
  pending,
  onAdd,
}: {
  candidates: UserDto[];
  pending: boolean;
  onAdd: (userId: string, role: TeamRole) => void;
}) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<TeamRole>('MEMBER');

  if (candidates.length === 0) {
    return (
      <p className="mt-3 border-t border-line-soft dark:border-gray-700 pt-3 text-xs text-ink-faint">
        Everyone is already on this team.
      </p>
    );
  }

  return (
    <div className="mt-3 flex items-end gap-2 border-t border-line-soft dark:border-gray-700 pt-3">
      <div className="flex-1">
        <span className="mb-1 block text-xs font-medium text-ink-muted dark:text-gray-400">User</span>
        <Select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Select a user…"
          options={candidates.map((u) => ({
            value: u.id,
            label: u.displayName,
          }))}
        />
      </div>
      <div className="w-36">
        <span className="mb-1 block text-xs font-medium text-ink-muted dark:text-gray-400">Role</span>
        <Select
          value={role}
          onChange={(e) => setRole(e.target.value as TeamRole)}
          options={[
            { value: 'MEMBER', label: 'Member' },
            { value: 'LEAD', label: 'Lead' },
          ]}
        />
      </div>
      <Button
        disabled={!userId || pending}
        loading={pending}
        onClick={() => {
          if (userId) {
            onAdd(userId, role);
            setUserId('');
            setRole('MEMBER');
          }
        }}
      >
        <UserPlus className="h-4 w-4" /> Add
      </Button>
    </div>
  );
}
