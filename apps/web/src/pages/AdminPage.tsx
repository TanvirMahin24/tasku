import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck, Ban, Plus, X } from 'lucide-react';
import clsx from 'clsx';
import type {
  AdminUserDto,
  FeatureKey,
  FeatureOverrideDto,
  FeatureScope,
  PlatformRole,
} from '@tasku/types';
import { adminApi } from '@/lib/admin';
import { apiErrorMessage, teamsApi, usersApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { useAuthStore, useIsSuperAdmin } from '@/store/auth';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, inputClass } from '@/components/ui/Select';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState, PageHeader } from '@/components/ui/PageHeader';

type Tab = 'users' | 'features';

export default function AdminPage() {
  const isSuperAdmin = useIsSuperAdmin();
  const [tab, setTab] = useState<Tab>('users');

  if (!isSuperAdmin) {
    return (
      <>
        <PageHeader title="Admin" subtitle="Platform administration" />
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <EmptyState
            icon={<ShieldAlert className="h-10 w-10" />}
            title="Insufficient permissions"
            description="You need the super-admin platform role to view this console."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Admin"
        subtitle="Manage users, roles and feature availability"
      />
      <div className="flex-none border-b border-line bg-white px-6 dark:border-gray-800 dark:bg-gray-900">
        <nav className="flex gap-[22px]">
          {(['users', 'features'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'border-b-2 px-0.5 pb-2.5 pt-3 text-[13px] capitalize transition-colors',
                tab === t
                  ? 'border-brand-600 font-semibold text-brand-600'
                  : 'border-transparent font-medium text-ink-muted hover:text-ink-soft dark:text-gray-400',
              )}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {tab === 'users' ? <UsersTab /> : <FeaturesTab />}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Users tab
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: PlatformRole }) {
  if (role === 'SUPER_ADMIN') {
    return (
      <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
        Super admin
      </Badge>
    );
  }
  return <Badge>Member</Badge>;
}

function UsersTab() {
  const qc = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<AdminUserDto | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: qk.adminUsers,
    queryFn: adminApi.users,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: qk.adminUsers });

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: PlatformRole }) =>
      adminApi.setRole(id, role),
    onSuccess: invalidate,
    onError: (e) => setActionError(apiErrorMessage(e, 'Could not update role')),
  });

  const unbanMut = useMutation({
    mutationFn: (id: string) => adminApi.unban(id),
    onSuccess: invalidate,
    onError: (e) => setActionError(apiErrorMessage(e, 'Could not unban user')),
  });

  function toggleRole(u: AdminUserDto) {
    const next: PlatformRole =
      u.platformRole === 'SUPER_ADMIN' ? 'MEMBER' : 'SUPER_ADMIN';
    const verb = next === 'SUPER_ADMIN' ? 'promote' : 'demote';
    if (
      !window.confirm(
        `Are you sure you want to ${verb} ${u.displayName} ${
          next === 'SUPER_ADMIN' ? 'to super admin' : 'to member'
        }?`,
      )
    )
      return;
    setActionError(null);
    roleMut.mutate({ id: u.id, role: next });
  }

  if (isLoading) return <PageSpinner label="Loading users…" />;
  if (!users || users.length === 0) {
    return <EmptyState title="No users" description="No accounts to manage yet." />;
  }

  return (
    <div className="space-y-3">
      {actionError && (
        <div className="flex items-start justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-line bg-white dark:border-gray-700 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-soft text-left text-[11px] font-semibold uppercase tracking-wide text-ink-faint dark:border-gray-700">
              <th className="px-4 py-2.5">User</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Teams</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isYou = u.id === currentUserId;
              return (
                <tr
                  key={u.id}
                  className="border-b border-line-soft last:border-0 dark:border-gray-800"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar user={u} size="md" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-medium text-ink dark:text-gray-100">
                          <span className="truncate">{u.displayName}</span>
                          {isYou && (
                            <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
                              you
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-ink-muted dark:text-gray-400">
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.platformRole} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.teams.length === 0 ? (
                        <span className="text-xs text-ink-faint">—</span>
                      ) : (
                        u.teams.map((t) => (
                          <Badge key={t.id} color={t.color}>
                            {t.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.banned ? (
                      <span title={u.banReason ?? undefined}>
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">
                          Banned
                        </Badge>
                      </span>
                    ) : (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300">
                        Active
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => toggleRole(u)}
                        loading={
                          roleMut.isPending && roleMut.variables?.id === u.id
                        }
                      >
                        {u.platformRole === 'SUPER_ADMIN' ? (
                          <>
                            <ShieldAlert className="h-3.5 w-3.5" /> Demote
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-3.5 w-3.5" /> Promote
                          </>
                        )}
                      </Button>
                      {u.banned ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => unbanMut.mutate(u.id)}
                          loading={
                            unbanMut.isPending && unbanMut.variables === u.id
                          }
                        >
                          Unban
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isYou}
                          onClick={() => {
                            setActionError(null);
                            setBanTarget(u);
                          }}
                        >
                          <Ban className="h-3.5 w-3.5" /> Ban
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BanModal
        user={banTarget}
        onClose={() => setBanTarget(null)}
        onError={setActionError}
      />
    </div>
  );
}

function BanModal({
  user,
  onClose,
  onError,
}: {
  user: AdminUserDto | null;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const banMut = useMutation({
    mutationFn: (id: string) => adminApi.ban(id, reason.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.adminUsers });
      setReason('');
      onClose();
    },
    onError: (e) => onError(apiErrorMessage(e, 'Could not ban user')),
  });

  return (
    <Modal
      open={!!user}
      onClose={() => !banMut.isPending && onClose()}
      title={`Ban ${user?.displayName ?? ''}`}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={banMut.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => user && banMut.mutate(user.id)}
            loading={banMut.isPending}
          >
            Ban user
          </Button>
        </>
      }
    >
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-soft dark:text-gray-200">
          Reason (optional)
        </span>
        <textarea
          className={`${inputClass} min-h-[80px] resize-y`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this user being banned?"
          autoFocus
        />
      </label>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Features tab
// ---------------------------------------------------------------------------

function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        on ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600',
      )}
    >
      <span
        className={clsx(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          on ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function FeaturesTab() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: qk.adminFeatures,
    queryFn: adminApi.featuresConfig,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.adminFeatures });
    qc.invalidateQueries({ queryKey: qk.myFeatures });
  };

  const setOverride = useMutation({
    mutationFn: adminApi.setOverride,
    onSuccess: invalidate,
    onError: (e) =>
      setError(apiErrorMessage(e, 'Could not update feature override')),
  });

  const removeOverride = useMutation({
    mutationFn: (id: string) => adminApi.removeOverride(id),
    onSuccess: invalidate,
    onError: (e) => setError(apiErrorMessage(e, 'Could not remove override')),
  });

  const globalByFeature = useMemo(() => {
    const map = new Map<FeatureKey, FeatureOverrideDto>();
    for (const o of config?.overrides ?? []) {
      if (o.scope === 'GLOBAL') map.set(o.feature, o);
    }
    return map;
  }, [config]);

  const scopedOverrides = useMemo(
    () => (config?.overrides ?? []).filter((o) => o.scope !== 'GLOBAL'),
    [config],
  );

  if (isLoading) return <PageSpinner label="Loading features…" />;
  if (!config) return <EmptyState title="No feature catalog" />;

  const busy = setOverride.isPending || removeOverride.isPending;

  function toggleGlobal(feature: FeatureKey, currentlyOn: boolean) {
    setError(null);
    if (currentlyOn) {
      // Turn OFF: create/replace a GLOBAL override with enabled=false.
      setOverride.mutate({ feature, scope: 'GLOBAL', enabled: false });
    } else {
      // Turn ON: remove the disabling override (absent == enabled).
      const existing = globalByFeature.get(feature);
      if (existing) removeOverride.mutate(existing.id);
      else setOverride.mutate({ feature, scope: 'GLOBAL', enabled: true });
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Global toggles */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-ink dark:text-gray-100">
          Global availability
        </h2>
        <p className="mb-3 text-xs text-ink-muted dark:text-gray-400">
          Turn a feature off to hide it for everyone. Per-team and per-user
          overrides below take precedence.
        </p>
        <div className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line bg-white dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900">
          {config.catalog.map((f) => {
            const globalOverride = globalByFeature.get(f.key);
            const on = !globalOverride || globalOverride.enabled;
            return (
              <div
                key={f.key}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink dark:text-gray-100">
                    {f.label}
                  </p>
                  <p className="text-xs text-ink-muted dark:text-gray-400">
                    {f.description}
                  </p>
                </div>
                <Toggle
                  on={on}
                  disabled={busy}
                  onChange={() => toggleGlobal(f.key, on)}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Scoped overrides */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-ink dark:text-gray-100">
          Overrides
        </h2>
        <p className="mb-3 text-xs text-ink-muted dark:text-gray-400">
          Enable or disable a feature for a specific team or user.
        </p>

        <AddOverrideForm
          catalog={config.catalog}
          onSubmit={(dto) => {
            setError(null);
            setOverride.mutate(dto);
          }}
          pending={setOverride.isPending}
        />

        <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white dark:border-gray-700 dark:bg-gray-900">
          {scopedOverrides.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-faint">
              No per-team or per-user overrides.
            </p>
          ) : (
            <ul className="divide-y divide-line-soft dark:divide-gray-800">
              {scopedOverrides.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm"
                >
                  <Badge>{o.scope === 'TEAM' ? 'Team' : 'User'}</Badge>
                  <span className="font-medium text-ink dark:text-gray-100">
                    {o.scope === 'TEAM'
                      ? o.team?.name ?? 'Unknown team'
                      : o.user?.displayName ?? 'Unknown user'}
                  </span>
                  <span className="text-ink-muted dark:text-gray-400">
                    {featureLabel(config.catalog, o.feature)}
                  </span>
                  <span
                    className={clsx(
                      'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                      o.enabled
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
                    )}
                  >
                    {o.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <button
                    onClick={() => {
                      setError(null);
                      removeOverride.mutate(o.id);
                    }}
                    disabled={busy}
                    title="Remove override"
                    aria-label="Remove override"
                    className="ml-auto rounded p-1 text-ink-faint hover:bg-surface-sunken hover:text-red-600 disabled:opacity-50 dark:hover:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function featureLabel(
  catalog: { key: FeatureKey; label: string }[],
  key: FeatureKey,
): string {
  return catalog.find((f) => f.key === key)?.label ?? key;
}

function AddOverrideForm({
  catalog,
  onSubmit,
  pending,
}: {
  catalog: { key: FeatureKey; label: string }[];
  onSubmit: (dto: {
    feature: FeatureKey;
    scope: FeatureScope;
    teamId?: string;
    userId?: string;
    enabled: boolean;
  }) => void;
  pending: boolean;
}) {
  const [scope, setScope] = useState<'TEAM' | 'USER'>('TEAM');
  const [feature, setFeature] = useState<FeatureKey>(catalog[0]?.key ?? 'board');
  const [targetId, setTargetId] = useState('');
  const [enabled, setEnabled] = useState(false);

  const { data: teams = [] } = useQuery({
    queryKey: qk.teams,
    queryFn: teamsApi.list,
    enabled: scope === 'TEAM',
  });
  const { data: users = [] } = useQuery({
    queryKey: qk.users,
    queryFn: usersApi.list,
    enabled: scope === 'USER',
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!targetId) return;
    onSubmit({
      feature,
      scope,
      enabled,
      ...(scope === 'TEAM' ? { teamId: targetId } : { userId: targetId }),
    });
    setTargetId('');
  }

  const targetOptions =
    scope === 'TEAM'
      ? teams.map((t) => ({ value: t.id, label: t.name }))
      : users.map((u) => ({ value: u.id, label: u.displayName }));

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface-sunken/50 p-3 dark:border-gray-700 dark:bg-gray-800/40"
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink-soft dark:text-gray-300">
          Scope
        </span>
        <Select
          className="w-32"
          value={scope}
          onChange={(e) => {
            setScope(e.target.value as 'TEAM' | 'USER');
            setTargetId('');
          }}
          options={[
            { value: 'TEAM', label: 'Team' },
            { value: 'USER', label: 'User' },
          ]}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink-soft dark:text-gray-300">
          {scope === 'TEAM' ? 'Team' : 'User'}
        </span>
        <Select
          className="w-48"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          placeholder={`Select ${scope === 'TEAM' ? 'team' : 'user'}…`}
          options={targetOptions}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink-soft dark:text-gray-300">
          Feature
        </span>
        <Select
          className="w-44"
          value={feature}
          onChange={(e) => setFeature(e.target.value as FeatureKey)}
          options={catalog.map((f) => ({ value: f.key, label: f.label }))}
        />
      </label>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-ink-soft dark:text-gray-300">
          Enabled
        </span>
        <div className="flex h-9 items-center">
          <Toggle on={enabled} onChange={setEnabled} />
        </div>
      </div>
      <Button type="submit" loading={pending} disabled={!targetId}>
        <Plus className="h-4 w-4" /> Add override
      </Button>
    </form>
  );
}
