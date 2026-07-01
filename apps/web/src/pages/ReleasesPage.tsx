import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, Package, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type {
  DeliveryProgress,
  UpdateVersionDto,
  VersionDto,
} from '@tasku/types';
import { apiErrorMessage, versionsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { useProjectSocket } from '@/hooks/useProjectSocket';
import { Button } from '@/components/ui/Button';
import { inputClass } from '@/components/ui/Select';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/PageHeader';

export default function ReleasesPage() {
  const { key = '' } = useParams<{ key: string }>();
  useProjectSocket(key);
  const [error, setError] = useState<string | null>(null);

  const { data: versions = [], isLoading } = useQuery({
    queryKey: qk.versions(key),
    queryFn: () => versionsApi.list(key),
    enabled: !!key,
  });

  if (isLoading) {
    return <PageSpinner label="Loading releases…" />;
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto scrollbar-thin bg-surface-page p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-3xl space-y-5">
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}

          <CreateVersionForm projectKey={key} onError={setError} />

          {versions.length === 0 ? (
            <EmptyState
              icon={<Package className="h-10 w-10" />}
              title="No versions yet"
              description="Create a version to track fixVersions and release progress."
            />
          ) : (
            <ul className="space-y-3">
              {versions.map((v) => (
                <VersionRow
                  key={v.id}
                  projectKey={key}
                  version={v}
                  onError={setError}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function ProgressBar({ p }: { p: DeliveryProgress }) {
  const total = p.total || 1;
  const w = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="space-y-1">
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-sunken dark:bg-gray-800">
        <div style={{ width: w(p.done) }} className="bg-emerald-500" />
        <div style={{ width: w(p.inProgress) }} className="bg-blue-400" />
        <div style={{ width: w(p.todo) }} className="bg-gray-300 dark:bg-gray-600" />
      </div>
      <p className="text-xs text-ink-muted dark:text-gray-400">
        {p.total} issue{p.total === 1 ? '' : 's'} · {p.done} done ·{' '}
        {p.inProgress} in progress · {p.todo} to do
      </p>
    </div>
  );
}

function VersionRow({
  projectKey,
  version,
  onError,
}: {
  projectKey: string;
  version: VersionDto;
  onError: (m: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: qk.versions(projectKey) });

  const update = useMutation({
    mutationFn: (dto: UpdateVersionDto) => versionsApi.update(version.id, dto),
    onSuccess: invalidate,
    onError: (e) => onError(apiErrorMessage(e, 'Could not update version')),
  });
  const remove = useMutation({
    mutationFn: () => versionsApi.remove(version.id),
    onSuccess: invalidate,
    onError: (e) => onError(apiErrorMessage(e, 'Could not delete version')),
  });

  return (
    <li className="rounded-lg border border-line bg-white p-4 shadow-card dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink dark:text-gray-100">
              {version.name}
            </span>
            {version.released ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                Released
                {version.releaseDate
                  ? ` · ${format(new Date(version.releaseDate), 'MMM d, yyyy')}`
                  : ''}
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                Unreleased
              </span>
            )}
          </div>
          {version.description && (
            <p className="mt-0.5 text-sm text-ink-muted dark:text-gray-400">
              {version.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            variant={version.released ? 'secondary' : 'primary'}
            loading={update.isPending}
            onClick={() => update.mutate({ released: !version.released })}
          >
            {version.released ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" /> Unrelease
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Release
              </>
            )}
          </Button>
          <button
            onClick={() => {
              if (confirm(`Delete version "${version.name}"?`)) {
                onError(null);
                remove.mutate();
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-faint hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
            title="Delete version"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <ProgressBar p={version.progress} />
    </li>
  );
}

function CreateVersionForm({
  projectKey,
  onError,
}: {
  projectKey: string;
  onError: (m: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const create = useMutation({
    mutationFn: () =>
      versionsApi.create(projectKey, {
        name: name.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      setName('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: qk.versions(projectKey) });
    },
    onError: (e) => onError(apiErrorMessage(e, 'Could not create version')),
  });

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onError(null);
        if (name.trim()) create.mutate();
      }}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-line p-2.5 dark:border-gray-700"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Version name (e.g. v1.0)"
        className={`${inputClass} h-9 w-40`}
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className={`${inputClass} h-9 min-w-[12rem] flex-1`}
      />
      <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
        <Plus className="h-4 w-4" /> Add version
      </Button>
    </form>
  );
}
