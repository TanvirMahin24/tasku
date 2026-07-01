import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Table2, Users } from 'lucide-react';
import type { CreateViewDto, ViewSummaryDto } from '@tasku/types';
import { VIEW_DEFAULT_COLUMNS } from '@tasku/types';
import { apiErrorMessage, teamsApi, viewsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, inputClass } from '@/components/ui/Select';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { PageSpinner } from '@/components/ui/Spinner';

export default function ViewsPage() {
  const [creating, setCreating] = useState(false);
  const { data: views = [], isLoading } = useQuery({
    queryKey: qk.views(),
    queryFn: () => viewsApi.list(),
  });

  return (
    <>
      <PageHeader
        title="Views"
        subtitle="Saved, filtered issue tables across your spaces"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New view
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin bg-surface-page p-6 dark:bg-gray-950">
        {isLoading ? (
          <PageSpinner label="Loading views…" />
        ) : views.length === 0 ? (
          <EmptyState
            icon={<Table2 className="h-10 w-10" />}
            title="No views yet"
            description="Create a view to track filtered issues across every space in one table."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> New view
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {views.map((v) => (
              <ViewCard key={v.id} view={v} />
            ))}
          </div>
        )}
      </div>

      <CreateViewModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function ViewCard({ view }: { view: ViewSummaryDto }) {
  const qc = useQueryClient();
  const toggleStar = useMutation({
    mutationFn: () =>
      view.starred ? viewsApi.unstar(view.id) : viewsApi.star(view.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.views() });
      qc.invalidateQueries({ queryKey: qk.views(true) });
    },
  });

  return (
    <div className="group relative rounded-[10px] border border-line bg-white p-4 hover:border-ink-faint dark:border-gray-700 dark:bg-gray-900">
      <button
        onClick={(e) => {
          e.preventDefault();
          toggleStar.mutate();
        }}
        title={view.starred ? 'Unstar' : 'Star'}
        className="absolute right-3 top-3 text-ink-faint hover:text-[#FCA700]"
      >
        <Star
          className="h-4 w-4"
          {...(view.starred ? { fill: '#FCA700', stroke: '#FCA700' } : {})}
        />
      </button>

      <Link to={`/views/${view.id}`} className="block">
        <div className="flex items-center gap-2 pr-6">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/15">
            <Table2 className="h-4 w-4" />
          </span>
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink dark:text-gray-100">
            {view.title}
          </h3>
        </div>
        {view.description && (
          <p className="mt-1.5 line-clamp-2 text-xs text-ink-muted dark:text-gray-400">
            {view.description}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-muted dark:bg-white/10 dark:text-gray-300">
            {view.scope === 'TEAM' ? (
              <>
                <Users className="h-3 w-3" /> {view.scopeTeam?.name ?? 'Team'}
              </>
            ) : (
              'Global'
            )}
          </span>
          {view.teams.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] text-ink-soft dark:bg-white/10 dark:text-gray-200"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: t.color }}
              />
              {t.name}
            </span>
          ))}
          {view.responsible && (
            <span className="ml-auto">
              <Avatar user={view.responsible} size="xs" />
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}

function CreateViewModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<'GLOBAL' | 'TEAM'>('GLOBAL');
  const [teamId, setTeamId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: teams = [] } = useQuery({
    queryKey: qk.teams,
    queryFn: teamsApi.list,
    enabled: open,
  });

  const create = useMutation({
    mutationFn: (dto: CreateViewDto) => viewsApi.create(dto),
    onSuccess: (view) => {
      qc.invalidateQueries({ queryKey: qk.views() });
      onClose();
      navigate(`/views/${view.id}`);
    },
    onError: (e) => setError(apiErrorMessage(e, 'Could not create view')),
  });

  const valid = title.trim() && (scope === 'GLOBAL' || teamId);

  return (
    <Modal open={open} onClose={onClose} title="New view" size="md">
      <div className="space-y-3">
        {error && <p className="text-xs text-red-600">{error}</p>}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-soft dark:text-gray-300">
            Title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q3 delivery watch"
            autoFocus
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-soft dark:text-gray-300">
            Description
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={`${inputClass} resize-y`}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-soft dark:text-gray-300">
              Scope
            </span>
            <Select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'GLOBAL' | 'TEAM')}
              options={[
                { value: 'GLOBAL', label: 'Global' },
                { value: 'TEAM', label: 'Team' },
              ]}
            />
          </label>
          {scope === 'TEAM' && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft dark:text-gray-300">
                Team
              </span>
              <Select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                placeholder="Select team…"
                options={teams.map((t) => ({ value: t.id, label: t.name }))}
              />
            </label>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          loading={create.isPending}
          disabled={!valid}
          onClick={() => {
            setError(null);
            create.mutate({
              title: title.trim(),
              description: description.trim() || null,
              scope,
              teamId: scope === 'TEAM' ? teamId : null,
              columns: VIEW_DEFAULT_COLUMNS,
            });
          }}
        >
          Create view
        </Button>
      </div>
    </Modal>
  );
}
