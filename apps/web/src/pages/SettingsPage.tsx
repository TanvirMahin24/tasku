import { useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Component as ComponentIcon,
  GripVertical,
  Lock,
  Plus,
  Shield,
  SlidersHorizontal,
  Trash2,
  Users as UsersIcon,
  Workflow,
} from 'lucide-react';
import clsx from 'clsx';
import {
  CUSTOM_FIELD_TYPES,
  type ComponentDto,
  type CustomFieldDefDto,
  type CustomFieldType,
  type Role,
  type StatusCategory,
  type StatusDto,
} from '@tasku/types';
import {
  apiErrorMessage,
  componentsApi,
  customFieldsApi,
  projectsApi,
  statusesApi,
  type ProjectMemberDto,
} from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { STATUS_CATEGORY_META } from '@/lib/format';
import { useAuthStore } from '@/store/auth';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Select, inputClass } from '@/components/ui/Select';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/PageHeader';

type Tab = 'workflow' | 'fields' | 'components' | 'members';

const TABS: { id: Tab; label: string; icon: typeof Workflow }[] = [
  { id: 'workflow', label: 'Columns & workflow', icon: Workflow },
  { id: 'fields', label: 'Custom fields', icon: SlidersHorizontal },
  { id: 'components', label: 'Components', icon: ComponentIcon },
  { id: 'members', label: 'Members', icon: UsersIcon },
];

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: 'Text',
  TEXTAREA: 'Text (long)',
  NUMBER: 'Number',
  DATE: 'Date',
  CHECKBOX: 'Checkbox',
  SELECT: 'Select (single)',
  MULTI_SELECT: 'Multi-select',
  USER: 'User',
  URL: 'URL',
};

const NEEDS_OPTIONS = (t: CustomFieldType) =>
  t === 'SELECT' || t === 'MULTI_SELECT';

const CATEGORY_OPTIONS: { value: StatusCategory; label: string }[] = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Done' },
];

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Member' },
  { value: 'VIEWER', label: 'Viewer' },
];

export default function SettingsPage() {
  const { key = '' } = useParams<{ key: string }>();
  const [tab, setTab] = useState<Tab>('workflow');

  const { data: project, isLoading } = useQuery({
    queryKey: qk.project(key),
    queryFn: () => projectsApi.get(key),
    enabled: !!key,
  });

  const isAdmin = project?.role === 'ADMIN';

  if (isLoading) {
    return <PageSpinner label="Loading settings…" />;
  }

  return (
    <>
      {!isAdmin ? (
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <EmptyState
            icon={<Lock className="h-10 w-10" />}
            title="Admins only"
            description="You need the Admin role on this project to change its settings. Ask a project admin for access."
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Tab rail */}
          <nav className="w-56 shrink-0 space-y-0.5 border-r border-line bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={clsx(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                    tab === t.id
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                      : 'text-ink-muted hover:bg-surface-sunken dark:text-gray-300 dark:hover:bg-gray-800',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto p-6 scrollbar-thin dark:bg-gray-950">
            <div className="mx-auto max-w-3xl">
              {tab === 'workflow' && <WorkflowTab projectKey={key} />}
              {tab === 'fields' && <CustomFieldsTab projectKey={key} />}
              {tab === 'components' && <ComponentsTab projectKey={key} />}
              {tab === 'members' && <MembersTab projectKey={key} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Workflow (statuses) tab
// ---------------------------------------------------------------------------

function WorkflowTab({ projectKey }: { projectKey: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: statuses = [], isLoading } = useQuery({
    queryKey: qk.statuses(projectKey),
    queryFn: () => projectsApi.statuses(projectKey),
    enabled: !!projectKey,
  });

  // Local ordering for snappy drag-and-drop; synced from the query.
  const [order, setOrder] = useState<string[] | null>(null);
  const ordered = useMemo(() => {
    if (!order) return statuses;
    const byId = new Map(statuses.map((s) => [s.id, s] as const));
    const list = order
      .map((id) => byId.get(id))
      .filter((s): s is StatusDto => !!s);
    // Include any newly-added statuses not yet in local order.
    for (const s of statuses) if (!order.includes(s.id)) list.push(s);
    return list;
  }, [order, statuses]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: qk.statuses(projectKey) });
    queryClient.invalidateQueries({ queryKey: ['project', projectKey, 'board'] });
  }

  const reorder = useMutation({
    mutationFn: (ids: string[]) => statusesApi.reorder(projectKey, ids),
    onSuccess: () => {
      setOrder(null);
      invalidate();
    },
    onError: (err) => {
      setOrder(null);
      setError(apiErrorMessage(err, 'Could not reorder columns'));
    },
  });

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = ordered.map((s) => s.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const next = arrayMove(ids, from, to);
    setOrder(next);
    reorder.mutate(next);
  }

  if (isLoading) return <PageSpinner label="Loading workflow…" />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-ink dark:text-gray-100">
          Columns &amp; workflow
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted dark:text-gray-400">
          Drag to reorder columns. Set a WIP limit to flag overloaded columns on
          the board.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={ordered.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-2">
            {ordered.map((status) => (
              <StatusRow
                key={status.id}
                status={status}
                projectKey={projectKey}
                canDelete={ordered.length > 1}
                onError={setError}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <AddStatusForm projectKey={projectKey} onError={setError} />
    </div>
  );
}

function StatusRow({
  status,
  projectKey,
  canDelete,
  onError,
}: {
  status: StatusDto;
  projectKey: string;
  canDelete: boolean;
  onError: (msg: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const meta = STATUS_CATEGORY_META[status.category];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: qk.statuses(projectKey) });
    queryClient.invalidateQueries({ queryKey: ['project', projectKey, 'board'] });
  }

  const update = useMutation({
    mutationFn: (dto: Parameters<typeof statusesApi.update>[1]) =>
      statusesApi.update(status.id, dto),
    onSuccess: invalidate,
    onError: (err) => onError(apiErrorMessage(err, 'Could not update column')),
  });

  const remove = useMutation({
    mutationFn: () => statusesApi.remove(status.id),
    onSuccess: invalidate,
    onError: (err) =>
      onError(
        apiErrorMessage(
          err,
          'Could not delete column. It may still contain issues.',
        ),
      ),
  });

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-line bg-white p-2.5 shadow-card dark:border-gray-700 dark:bg-gray-900"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-ink-faint hover:text-ink-muted active:cursor-grabbing dark:text-gray-600"
        title="Drag to reorder"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: meta.color }}
      />

      <input
        defaultValue={status.name}
        key={`name-${status.name}`}
        onBlur={(e) => {
          onError(null);
          const next = e.target.value.trim();
          if (next && next !== status.name) update.mutate({ name: next });
          else if (!next) e.target.value = status.name;
        }}
        className={`${inputClass} h-9 flex-1`}
        aria-label="Column name"
      />

      <Select
        value={status.category}
        onChange={(e) => {
          onError(null);
          update.mutate({ category: e.target.value as StatusCategory });
        }}
        options={CATEGORY_OPTIONS}
        className="h-9 w-36"
        aria-label="Category"
      />

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-ink-faint">WIP</span>
        <input
          type="number"
          min={0}
          defaultValue={status.wipLimit ?? ''}
          key={`wip-${status.wipLimit ?? 'none'}`}
          placeholder="—"
          onBlur={(e) => {
            onError(null);
            const raw = e.target.value.trim();
            const next = raw === '' ? null : Math.max(0, Number(raw));
            if (next !== (status.wipLimit ?? null)) {
              update.mutate({ wipLimit: next });
            }
          }}
          className={`${inputClass} h-9 w-16 text-center`}
          aria-label="WIP limit"
        />
      </div>

      <button
        onClick={() => {
          if (!canDelete) return;
          if (
            confirm(
              `Delete the "${status.name}" column? Issues must be moved out first.`,
            )
          ) {
            onError(null);
            remove.mutate();
          }
        }}
        disabled={!canDelete || remove.isPending}
        title={
          canDelete ? 'Delete column' : 'A project needs at least one column'
        }
        className="flex h-8 w-8 items-center justify-center rounded-md text-ink-faint hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-500/10"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function AddStatusForm({
  projectKey,
  onError,
}: {
  projectKey: string;
  onError: (msg: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StatusCategory>('TODO');

  const create = useMutation({
    mutationFn: () => statusesApi.create(projectKey, { name: name.trim(), category }),
    onSuccess: () => {
      setName('');
      setCategory('TODO');
      queryClient.invalidateQueries({ queryKey: qk.statuses(projectKey) });
      queryClient.invalidateQueries({ queryKey: ['project', projectKey, 'board'] });
    },
    onError: (err) => onError(apiErrorMessage(err, 'Could not add column')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onError(null);
    if (!name.trim()) return;
    create.mutate();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2 rounded-lg border border-dashed border-line p-2.5 dark:border-gray-700"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New column name…"
        className={`${inputClass} h-9 flex-1`}
      />
      <Select
        value={category}
        onChange={(e) => setCategory(e.target.value as StatusCategory)}
        options={CATEGORY_OPTIONS}
        className="h-9 w-36"
      />
      <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
        <Plus className="h-4 w-4" /> Add
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Components tab
// ---------------------------------------------------------------------------

function ComponentsTab({ projectKey }: { projectKey: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: components = [], isLoading } = useQuery({
    queryKey: qk.components(projectKey),
    queryFn: () => projectsApi.components(projectKey),
    enabled: !!projectKey,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: qk.components(projectKey) });
  }

  const create = useMutation({
    mutationFn: () => projectsApi.createComponent(projectKey, { name: name.trim() }),
    onSuccess: () => {
      setName('');
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not add component')),
  });

  if (isLoading) return <PageSpinner label="Loading components…" />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-ink dark:text-gray-100">
          Components
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted dark:text-gray-400">
          Group issues by component (e.g. API, Web, Infra).
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      {components.length === 0 ? (
        <p className="text-sm text-ink-faint">No components yet.</p>
      ) : (
        <ul className="space-y-2">
          {components.map((c) => (
            <ComponentRow
              key={c.id}
              component={c}
              projectKey={projectKey}
              onError={setError}
            />
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (name.trim()) create.mutate();
        }}
        className="flex items-center gap-2 rounded-lg border border-dashed border-line p-2.5 dark:border-gray-700"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New component name…"
          className={`${inputClass} h-9 flex-1`}
        />
        <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>
    </div>
  );
}

function ComponentRow({
  component,
  projectKey,
  onError,
}: {
  component: ComponentDto;
  projectKey: string;
  onError: (msg: string | null) => void;
}) {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: qk.components(projectKey) });
  }

  const update = useMutation({
    mutationFn: (next: string) => componentsApi.update(component.id, { name: next }),
    onSuccess: invalidate,
    onError: (err) => onError(apiErrorMessage(err, 'Could not rename component')),
  });

  const remove = useMutation({
    mutationFn: () => componentsApi.remove(component.id),
    onSuccess: invalidate,
    onError: (err) => onError(apiErrorMessage(err, 'Could not delete component')),
  });

  return (
    <li className="flex items-center gap-3 rounded-lg border border-line bg-white p-2.5 shadow-card dark:border-gray-700 dark:bg-gray-900">
      <ComponentIcon className="h-4 w-4 shrink-0 text-ink-faint" />
      <input
        defaultValue={component.name}
        key={component.name}
        onBlur={(e) => {
          onError(null);
          const next = e.target.value.trim();
          if (next && next !== component.name) update.mutate(next);
          else if (!next) e.target.value = component.name;
        }}
        className={`${inputClass} h-9 flex-1`}
        aria-label="Component name"
      />
      <button
        onClick={() => {
          if (confirm(`Delete the "${component.name}" component?`)) {
            onError(null);
            remove.mutate();
          }
        }}
        disabled={remove.isPending}
        className="flex h-8 w-8 items-center justify-center rounded-md text-ink-faint hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10"
        title="Delete component"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Custom fields tab
// ---------------------------------------------------------------------------

const CUSTOM_FIELDS_KEY = (projectKey: string) =>
  ['project', projectKey, 'custom-fields'] as const;

function CustomFieldsTab({ projectKey }: { projectKey: string }) {
  const [error, setError] = useState<string | null>(null);
  const { data: fields = [], isLoading } = useQuery({
    queryKey: CUSTOM_FIELDS_KEY(projectKey),
    queryFn: () => customFieldsApi.list(projectKey),
    enabled: !!projectKey,
  });

  if (isLoading) return <PageSpinner label="Loading fields…" />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-ink dark:text-gray-100">
          Custom fields
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted dark:text-gray-400">
          Add fields that appear on every issue in this project, beside the
          built-in ones.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      {fields.length === 0 ? (
        <p className="text-sm text-ink-faint">No custom fields yet.</p>
      ) : (
        <ul className="space-y-2">
          {fields.map((f) => (
            <FieldRow
              key={f.id}
              field={f}
              projectKey={projectKey}
              onError={setError}
            />
          ))}
        </ul>
      )}

      <AddFieldForm projectKey={projectKey} onError={setError} />
    </div>
  );
}

function FieldRow({
  field,
  projectKey,
  onError,
}: {
  field: CustomFieldDefDto;
  projectKey: string;
  onError: (m: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => customFieldsApi.remove(field.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: CUSTOM_FIELDS_KEY(projectKey) }),
    onError: (err) => onError(apiErrorMessage(err, 'Could not delete field')),
  });

  return (
    <li className="flex items-center gap-3 rounded-lg border border-line bg-white p-2.5 shadow-card dark:border-gray-700 dark:bg-gray-900">
      <SlidersHorizontal className="h-4 w-4 shrink-0 text-ink-faint" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink dark:text-gray-100">
          {field.name}
        </p>
        <p className="truncate text-xs text-ink-muted dark:text-gray-400">
          {FIELD_TYPE_LABELS[field.type]}
          {field.options?.length ? ` · ${field.options.join(', ')}` : ''}
          {field.required ? ' · required' : ''}
        </p>
      </div>
      <button
        onClick={() => {
          if (
            confirm(
              `Delete the "${field.name}" field? Its values on all issues are removed.`,
            )
          ) {
            onError(null);
            remove.mutate();
          }
        }}
        disabled={remove.isPending}
        className="flex h-8 w-8 items-center justify-center rounded-md text-ink-faint hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10"
        title="Delete field"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function AddFieldForm({
  projectKey,
  onError,
}: {
  projectKey: string;
  onError: (m: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('TEXT');
  const [optionsStr, setOptionsStr] = useState('');
  const [required, setRequired] = useState(false);

  const parsedOptions = optionsStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const optionsInvalid = NEEDS_OPTIONS(type) && parsedOptions.length === 0;

  const create = useMutation({
    mutationFn: () =>
      customFieldsApi.create(projectKey, {
        name: name.trim(),
        type,
        options: NEEDS_OPTIONS(type) ? parsedOptions : undefined,
        required,
      }),
    onSuccess: () => {
      setName('');
      setType('TEXT');
      setOptionsStr('');
      setRequired(false);
      queryClient.invalidateQueries({ queryKey: CUSTOM_FIELDS_KEY(projectKey) });
    },
    onError: (err) => onError(apiErrorMessage(err, 'Could not add field')),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onError(null);
        if (name.trim() && !optionsInvalid) create.mutate();
      }}
      className="space-y-2 rounded-lg border border-dashed border-line p-2.5 dark:border-gray-700"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New field name…"
          className={`${inputClass} h-9 min-w-[12rem] flex-1`}
        />
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as CustomFieldType)}
          options={CUSTOM_FIELD_TYPES.map((t) => ({
            value: t,
            label: FIELD_TYPE_LABELS[t],
          }))}
          className="h-9 w-40"
        />
        <Button
          type="submit"
          loading={create.isPending}
          disabled={!name.trim() || optionsInvalid}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      {NEEDS_OPTIONS(type) && (
        <input
          value={optionsStr}
          onChange={(e) => setOptionsStr(e.target.value)}
          placeholder="Options, comma-separated (e.g. Low, Medium, High)"
          className={`${inputClass} h-9 w-full`}
        />
      )}
      <label className="flex items-center gap-2 text-sm text-ink-muted dark:text-gray-300">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        Required
      </label>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Members tab
// ---------------------------------------------------------------------------

function MembersTab({ projectKey }: { projectKey: string }) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('MEMBER');
  const [error, setError] = useState<string | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: qk.members(projectKey),
    queryFn: () => projectsApi.members(projectKey),
    enabled: !!projectKey,
  });

  const adminCount = members.filter((m) => m.role === 'ADMIN').length;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: qk.members(projectKey) });
  }

  const add = useMutation({
    mutationFn: () =>
      projectsApi.addMember(projectKey, { email: email.trim(), role }),
    onSuccess: () => {
      setEmail('');
      setRole('MEMBER');
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not add member')),
  });

  if (isLoading) return <PageSpinner label="Loading members…" />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-ink dark:text-gray-100">
          Members
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted dark:text-gray-400">
          Manage who can access this project and what they can do.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <ul className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line dark:divide-gray-700 dark:border-gray-700">
        {members.map((m) => (
          <MemberRow
            key={m.user.id}
            member={m}
            projectKey={projectKey}
            isSelf={m.user.id === currentUserId}
            isLastAdmin={m.role === 'ADMIN' && adminCount <= 1}
            onError={setError}
          />
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (email.trim()) add.mutate();
        }}
        className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-line p-2.5 dark:border-gray-700"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          className={`${inputClass} h-9 min-w-[14rem] flex-1`}
        />
        <Select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          options={ROLE_OPTIONS}
          className="h-9 w-32"
        />
        <Button type="submit" loading={add.isPending} disabled={!email.trim()}>
          <Plus className="h-4 w-4" /> Add member
        </Button>
      </form>
    </div>
  );
}

function MemberRow({
  member,
  projectKey,
  isSelf,
  isLastAdmin,
  onError,
}: {
  member: ProjectMemberDto;
  projectKey: string;
  isSelf: boolean;
  isLastAdmin: boolean;
  onError: (msg: string | null) => void;
}) {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: qk.members(projectKey) });
  }

  const changeRole = useMutation({
    mutationFn: (next: Role) =>
      projectsApi.updateMemberRole(projectKey, member.user.id, { role: next }),
    onSuccess: invalidate,
    onError: (err) => onError(apiErrorMessage(err, 'Could not change role')),
  });

  const remove = useMutation({
    mutationFn: () => projectsApi.removeMember(projectKey, member.user.id),
    onSuccess: invalidate,
    onError: (err) => onError(apiErrorMessage(err, 'Could not remove member')),
  });

  return (
    <li className="flex items-center gap-3 bg-white px-3 py-2.5 dark:bg-gray-900">
      <Avatar user={member.user} size="md" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink dark:text-gray-100">
          {member.user.displayName}
          {isSelf && (
            <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium text-ink-muted dark:bg-gray-700 dark:text-gray-300">
              you
            </span>
          )}
          {member.role === 'ADMIN' && (
            <Shield className="h-3.5 w-3.5 text-brand-500" />
          )}
        </p>
        <p className="truncate text-xs text-ink-muted dark:text-gray-400">
          {member.user.email}
        </p>
      </div>

      <Select
        value={member.role}
        onChange={(e) => {
          onError(null);
          changeRole.mutate(e.target.value as Role);
        }}
        options={ROLE_OPTIONS}
        disabled={isLastAdmin || changeRole.isPending}
        className="h-9 w-32"
        aria-label={`Role for ${member.user.displayName}`}
      />

      <button
        onClick={() => {
          if (isLastAdmin) return;
          if (confirm(`Remove ${member.user.displayName} from this project?`)) {
            onError(null);
            remove.mutate();
          }
        }}
        disabled={isLastAdmin || remove.isPending}
        title={
          isLastAdmin
            ? 'A project must keep at least one admin'
            : 'Remove member'
        }
        className="flex h-8 w-8 items-center justify-center rounded-md text-ink-faint hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-500/10"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
