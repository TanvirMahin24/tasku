import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Pin, Plus, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import type {
  CustomFieldCondition,
  CustomFieldDefDto,
  CustomFieldOp,
  CustomFieldType,
  IssueFilterCriteria,
  IssueType,
  Priority,
  StatusCategory,
  UpdateViewDto,
  UserDto,
  ViewColumn,
  ViewDto,
  ViewFieldDto,
} from '@tasku/types';
import {
  ISSUE_TYPES,
  PRIORITIES,
  VIEW_STANDARD_FIELDS,
} from '@tasku/types';
import {
  apiErrorMessage,
  customFieldsApi,
  projectsApi,
  teamsApi,
  usersApi,
  viewsApi,
} from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { ISSUE_TYPE_META, PRIORITY_META } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, inputClass } from '@/components/ui/Select';
import { AssigneeSelect } from '@/components/ui/AssigneeSelect';
import { TeamMultiSelect } from '@/components/ui/TeamMultiSelect';

const STATUS_CATEGORIES: { value: StatusCategory; label: string }[] = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Done' },
];

// Filter-builder fields — each maps to a key on IssueFilterCriteria.
type FilterField =
  | 'text'
  | 'projectKey'
  | 'types'
  | 'priorities'
  | 'statusCategories'
  | 'teamIds'
  | 'assigneeIds';

const FILTER_FIELDS: { field: FilterField; label: string }[] = [
  { field: 'text', label: 'Text' },
  { field: 'projectKey', label: 'Space' },
  { field: 'types', label: 'Type' },
  { field: 'priorities', label: 'Priority' },
  { field: 'statusCategories', label: 'Status' },
  { field: 'teamIds', label: 'Team' },
  { field: 'assigneeIds', label: 'Assignee' },
];

// --- Custom-field conditions ---------------------------------------------

const CF_OP_LABELS: Record<CustomFieldOp, string> = {
  eq: 'equals',
  contains: 'contains',
  gt: 'greater than',
  lt: 'less than',
  set: 'is set',
  notset: 'is empty',
};

/** Sensible operators per field type. */
function opsForType(t: CustomFieldType): CustomFieldOp[] {
  switch (t) {
    case 'SELECT':
    case 'USER':
    case 'CHECKBOX':
      return ['eq', 'set', 'notset'];
    case 'TEXT':
    case 'TEXTAREA':
    case 'URL':
      return ['contains', 'eq', 'set', 'notset'];
    case 'NUMBER':
    case 'DATE':
      return ['eq', 'gt', 'lt', 'set', 'notset'];
    case 'MULTI_SELECT':
      return ['contains', 'set', 'notset'];
  }
}

function opNeedsValue(op: CustomFieldOp): boolean {
  return op !== 'set' && op !== 'notset';
}

function defaultValueFor(
  t: CustomFieldType,
  op: CustomFieldOp,
  field: CustomFieldDefDto,
): CustomFieldCondition['value'] {
  if (!opNeedsValue(op)) return undefined;
  switch (t) {
    case 'CHECKBOX':
      return true;
    case 'NUMBER':
      return 0;
    case 'SELECT':
    case 'MULTI_SELECT':
      return field.options?.[0] ?? '';
    default:
      return '';
  }
}

function hasValue(v: unknown): boolean {
  return Array.isArray(v) ? v.length > 0 : v != null && v !== '';
}

function toInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export function ViewEditor({
  view,
  fields,
  onClose,
}: {
  view: ViewDto;
  fields: ViewFieldDto[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(view.title);
  const [description, setDescription] = useState(view.description ?? '');
  const [scope, setScope] = useState(view.scope);
  const [scopeTeamId, setScopeTeamId] = useState(view.scopeTeam?.id ?? '');
  const [responsibleId, setResponsibleId] = useState(view.responsible?.id ?? null);
  const [teamIds, setTeamIds] = useState(view.teams.map((t) => t.id));
  const [startDate, setStartDate] = useState(toInput(view.startDate));
  const [endDate, setEndDate] = useState(toInput(view.endDate));
  const [criteria, setCriteria] = useState<IssueFilterCriteria>(view.criteria);
  const [columns, setColumns] = useState<ViewColumn[]>(view.columns);
  const [addKey, setAddKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeFields, setActiveFields] = useState<FilterField[]>(() =>
    FILTER_FIELDS.map((f) => f.field).filter((f) => hasValue(view.criteria[f])),
  );

  const { data: teams = [] } = useQuery({ queryKey: qk.teams, queryFn: teamsApi.list });
  const { data: users = [] } = useQuery({ queryKey: qk.users, queryFn: usersApi.list });
  const { data: projects = [] } = useQuery({
    queryKey: qk.projects,
    queryFn: projectsApi.list,
  });

  // Custom fields are per-project, so we can only offer them once a Space is
  // chosen in the filter (criteria.projectKey).
  const cfProjectKey = criteria.projectKey ?? '';
  const { data: customFieldDefs = [] } = useQuery({
    queryKey: qk.customFields(cfProjectKey),
    queryFn: () => customFieldsApi.list(cfProjectKey),
    enabled: !!cfProjectKey,
  });

  const fieldLabel = useMemo(() => {
    const m = new Map<string, string>();
    VIEW_STANDARD_FIELDS.forEach((f) => m.set(f.key, f.label));
    fields.forEach((f) => m.set(f.key, f.label));
    return (k: string) => m.get(k) ?? k;
  }, [fields]);

  const available = fields.filter((f) => !columns.some((c) => c.key === f.key));

  const save = useMutation({
    mutationFn: (dto: UpdateViewDto) => viewsApi.update(view.id, dto),
    onSuccess: (v) => {
      qc.setQueryData(qk.view(view.id), v);
      qc.invalidateQueries({ queryKey: qk.viewResults(view.id) });
      qc.invalidateQueries({ queryKey: qk.views() });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Could not save view')),
  });

  function setCrit<K extends keyof IssueFilterCriteria>(
    key: K,
    value: IssueFilterCriteria[K],
  ) {
    setCriteria((c) => ({ ...c, [key]: value }));
  }
  function toggle<T>(arr: T[] | undefined, v: T): T[] {
    const set = new Set(arr ?? []);
    set.has(v) ? set.delete(v) : set.add(v);
    return [...set];
  }
  const customConds = criteria.customFields ?? [];
  function setCustomConds(conds: CustomFieldCondition[]) {
    setCrit('customFields', conds.length ? conds : undefined);
  }
  function moveCol(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= columns.length) return;
    const next = [...columns];
    [next[i], next[j]] = [next[j], next[i]];
    setColumns(next);
  }

  const valid = title.trim() && (scope === 'GLOBAL' || scopeTeamId);

  return (
    <Modal open onClose={onClose} title="Edit view" size="lg">
      <div className="max-h-[70vh] space-y-5 overflow-y-auto scrollbar-thin pr-1">
        {error && <p className="text-xs text-red-600">{error}</p>}

        {/* Details */}
        <Section title="Details">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title" full>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Description" full>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={`${inputClass} resize-y`}
              />
            </Field>
            <Field label="Scope">
              <Select
                value={scope}
                onChange={(e) => setScope(e.target.value as typeof scope)}
                options={[
                  { value: 'GLOBAL', label: 'Global' },
                  { value: 'TEAM', label: 'Team' },
                ]}
              />
            </Field>
            {scope === 'TEAM' && (
              <Field label="Scope team">
                <Select
                  value={scopeTeamId}
                  onChange={(e) => setScopeTeamId(e.target.value)}
                  placeholder="Select team…"
                  options={teams.map((t) => ({ value: t.id, label: t.name }))}
                />
              </Field>
            )}
            <Field label="Responsible">
              <AssigneeSelect
                users={users}
                value={responsibleId}
                onChange={setResponsibleId}
                placeholder="Nobody"
              />
            </Field>
            <Field label="Associated teams">
              <TeamMultiSelect teams={teams} value={teamIds} onChange={setTeamIds} />
            </Field>
            <Field label="Start">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="End">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        {/* Filters — condition builder */}
        <Section title="Filters">
          <div className="space-y-2">
            {activeFields.length === 0 && (
              <p className="text-xs text-ink-faint">
                No conditions — the view shows every issue you can access.
              </p>
            )}
            {activeFields.map((f) => (
              <div
                key={f}
                className="flex items-start gap-2 rounded-md border border-line bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
              >
                <span className="mt-1.5 w-16 shrink-0 text-xs font-medium text-ink-soft dark:text-gray-300">
                  {FILTER_FIELDS.find((x) => x.field === f)!.label}
                </span>
                <span className="mt-1.5 shrink-0 text-[11px] text-ink-faint">
                  {f === 'text' ? 'contains' : 'is'}
                </span>
                <div className="min-w-0 flex-1">
                  {f === 'text' && (
                    <input
                      value={criteria.text ?? ''}
                      onChange={(e) => setCrit('text', e.target.value || undefined)}
                      placeholder="Key or title…"
                      className={inputClass}
                    />
                  )}
                  {f === 'projectKey' && (
                    <Select
                      value={criteria.projectKey ?? ''}
                      onChange={(e) =>
                        setCrit('projectKey', e.target.value || undefined)
                      }
                      placeholder="Any space"
                      options={projects.map((p) => ({ value: p.key, label: p.name }))}
                    />
                  )}
                  {f === 'types' && (
                    <div className="flex flex-wrap gap-1.5">
                      {ISSUE_TYPES.map((t) => (
                        <Chip
                          key={t}
                          on={(criteria.types ?? []).includes(t)}
                          onClick={() =>
                            setCrit('types', toggle(criteria.types, t) as IssueType[])
                          }
                        >
                          {ISSUE_TYPE_META[t].label}
                        </Chip>
                      ))}
                    </div>
                  )}
                  {f === 'priorities' && (
                    <div className="flex flex-wrap gap-1.5">
                      {PRIORITIES.map((p) => (
                        <Chip
                          key={p}
                          on={(criteria.priorities ?? []).includes(p)}
                          onClick={() =>
                            setCrit(
                              'priorities',
                              toggle(criteria.priorities, p) as Priority[],
                            )
                          }
                        >
                          {PRIORITY_META[p].label}
                        </Chip>
                      ))}
                    </div>
                  )}
                  {f === 'statusCategories' && (
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_CATEGORIES.map((s) => (
                        <Chip
                          key={s.value}
                          on={(criteria.statusCategories ?? []).includes(s.value)}
                          onClick={() =>
                            setCrit(
                              'statusCategories',
                              toggle(
                                criteria.statusCategories,
                                s.value,
                              ) as StatusCategory[],
                            )
                          }
                        >
                          {s.label}
                        </Chip>
                      ))}
                    </div>
                  )}
                  {f === 'teamIds' && (
                    <TeamMultiSelect
                      teams={teams}
                      value={criteria.teamIds ?? []}
                      onChange={(ids) =>
                        setCrit('teamIds', ids.length ? ids : undefined)
                      }
                    />
                  )}
                  {f === 'assigneeIds' && (
                    <div className="flex flex-wrap gap-1.5">
                      {users.map((u) => (
                        <Chip
                          key={u.id}
                          on={(criteria.assigneeIds ?? []).includes(u.id)}
                          onClick={() =>
                            setCrit(
                              'assigneeIds',
                              toggle(criteria.assigneeIds, u.id) as string[],
                            )
                          }
                        >
                          {u.displayName}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setActiveFields((a) => a.filter((x) => x !== f));
                    setCrit(f, undefined);
                  }}
                  title="Remove condition"
                  className="mt-1 shrink-0 text-ink-faint hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}

            {FILTER_FIELDS.some((x) => !activeFields.includes(x.field)) && (
              <div className="pt-1">
                <div className="max-w-[220px]">
                  <Select
                    value=""
                    onChange={(e) => {
                      if (e.target.value)
                        setActiveFields((a) => [...a, e.target.value as FilterField]);
                    }}
                    placeholder="+ Add condition…"
                    options={FILTER_FIELDS.filter(
                      (x) => !activeFields.includes(x.field),
                    ).map((x) => ({ value: x.field, label: x.label }))}
                  />
                </div>
              </div>
            )}

            {/* Custom-field conditions */}
            <CustomFieldFilter
              projectKey={criteria.projectKey}
              defs={customFieldDefs}
              users={users}
              conditions={customConds}
              onChange={setCustomConds}
            />
          </div>
        </Section>

        {/* Columns */}
        <Section title="Columns">
          <p className="mb-2 text-xs text-ink-faint">
            Order top-to-bottom = left-to-right. Pin to keep a column sticky.
          </p>
          <ul className="space-y-1">
            {columns.map((c, i) => (
              <li
                key={c.key}
                className="flex items-center gap-2 rounded-md border border-line bg-white px-2.5 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <span className="min-w-0 flex-1 truncate">{fieldLabel(c.key)}</span>
                <IconBtn onClick={() => moveCol(i, -1)} disabled={i === 0} title="Up">
                  <ArrowUp className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn
                  onClick={() => moveCol(i, 1)}
                  disabled={i === columns.length - 1}
                  title="Down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </IconBtn>
                <button
                  onClick={() =>
                    setColumns((cols) =>
                      cols.map((x) =>
                        x.key === c.key ? { ...x, pinned: !x.pinned } : x,
                      ),
                    )
                  }
                  title={c.pinned ? 'Unpin' : 'Pin'}
                  className={c.pinned ? 'text-brand-600' : 'text-ink-faint hover:text-ink-muted'}
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() =>
                    setColumns((cols) => cols.filter((x) => x.key !== c.key))
                  }
                  title="Remove"
                  className="text-ink-faint hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          {available.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1">
                <Select
                  value={addKey}
                  onChange={(e) => setAddKey(e.target.value)}
                  placeholder="Add a column…"
                  options={available.map((f) => ({ value: f.key, label: f.label }))}
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={!addKey}
                onClick={() => {
                  setColumns((cols) => [...cols, { key: addKey }]);
                  setAddKey('');
                }}
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          )}
        </Section>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-line pt-3 dark:border-gray-700">
        <Button variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" /> Cancel
        </Button>
        <Button
          loading={save.isPending}
          disabled={!valid}
          onClick={() => {
            setError(null);
            // Keep pinned columns first.
            const ordered = [...columns].sort(
              (a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false),
            );
            save.mutate({
              title: title.trim(),
              description: description.trim() || null,
              scope,
              teamId: scope === 'TEAM' ? scopeTeamId : null,
              responsibleId,
              teamIds,
              startDate: startDate ? new Date(startDate).toISOString() : null,
              endDate: endDate ? new Date(endDate).toISOString() : null,
              criteria,
              columns: ordered,
            });
          }}
        >
          Save
        </Button>
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-gray-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={clsx('block', full && 'col-span-2')}>
      <span className="mb-1 block text-xs font-medium text-ink-soft dark:text-gray-300">
        {label}
      </span>
      {children}
    </label>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        on
          ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
          : 'border-line text-ink-muted hover:bg-surface-sunken dark:border-gray-700 dark:text-gray-300',
      )}
    >
      {children}
    </button>
  );
}

function IconBtn({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="text-ink-faint hover:text-ink-muted disabled:opacity-30"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Custom-field filter builder
// ---------------------------------------------------------------------------

function CustomFieldFilter({
  projectKey,
  defs,
  users,
  conditions,
  onChange,
}: {
  projectKey?: string;
  defs: CustomFieldDefDto[];
  users: UserDto[];
  conditions: CustomFieldCondition[];
  onChange: (conds: CustomFieldCondition[]) => void;
}) {
  const defById = useMemo(
    () => new Map(defs.map((d) => [d.id, d] as const)),
    [defs],
  );

  function addField(fieldId: string) {
    const def = defById.get(fieldId);
    if (!def) return;
    const op = opsForType(def.type)[0];
    onChange([
      ...conditions,
      { fieldId, op, value: defaultValueFor(def.type, op, def) },
    ]);
  }
  function updateAt(i: number, next: CustomFieldCondition) {
    onChange(conditions.map((c, idx) => (idx === i ? next : c)));
  }
  function removeAt(i: number) {
    onChange(conditions.filter((_, idx) => idx !== i));
  }

  return (
    <div className="mt-3 space-y-2 border-t border-line-soft pt-3 dark:border-gray-800">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted dark:text-gray-400">
        Custom fields
      </p>

      {!projectKey ? (
        <p className="text-xs text-ink-faint">
          Add a <span className="font-medium">Space</span> condition above to
          filter by that project's custom fields.
        </p>
      ) : (
        <>
          {conditions.map((cond, i) => (
            <CustomFieldConditionRow
              key={i}
              cond={cond}
              def={defById.get(cond.fieldId) ?? null}
              users={users}
              onChange={(next) => updateAt(i, next)}
              onRemove={() => removeAt(i)}
            />
          ))}

          {defs.length === 0 ? (
            <p className="text-xs text-ink-faint">
              This space has no custom fields.
            </p>
          ) : (
            <div className="max-w-[220px] pt-1">
              <Select
                value=""
                onChange={(e) => {
                  if (e.target.value) addField(e.target.value);
                }}
                placeholder="+ Add custom field…"
                options={defs.map((d) => ({ value: d.id, label: d.name }))}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CustomFieldConditionRow({
  cond,
  def,
  users,
  onChange,
  onRemove,
}: {
  cond: CustomFieldCondition;
  def: CustomFieldDefDto | null;
  users: UserDto[];
  onChange: (next: CustomFieldCondition) => void;
  onRemove: () => void;
}) {
  // Field was deleted or belongs to another project — offer removal only.
  if (!def) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-line bg-white p-2 text-xs text-ink-faint dark:border-gray-700 dark:bg-gray-900">
        <span className="flex-1">Unknown field ({cond.fieldId})</span>
        <button
          onClick={onRemove}
          title="Remove condition"
          className="text-ink-faint hover:text-red-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const ops = opsForType(def.type);
  const showValue = opNeedsValue(cond.op);

  function setOp(op: CustomFieldOp) {
    onChange({
      ...cond,
      op,
      value: opNeedsValue(op) ? defaultValueFor(def!.type, op, def!) : undefined,
    });
  }
  function setValue(value: CustomFieldCondition['value']) {
    onChange({ ...cond, value });
  }

  return (
    <div className="flex items-start gap-2 rounded-md border border-line bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
      <span className="mt-1.5 w-16 shrink-0 truncate text-xs font-medium text-ink-soft dark:text-gray-300">
        {def.name}
      </span>
      <div className="w-28 shrink-0">
        <Select
          value={cond.op}
          onChange={(e) => setOp(e.target.value as CustomFieldOp)}
          options={ops.map((o) => ({ value: o, label: CF_OP_LABELS[o] }))}
        />
      </div>
      <div className="min-w-0 flex-1">
        {showValue && (
          <CustomFieldValueInput
            def={def}
            users={users}
            value={cond.value}
            onChange={setValue}
          />
        )}
      </div>
      <button
        onClick={onRemove}
        title="Remove condition"
        className="mt-1 shrink-0 text-ink-faint hover:text-red-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function CustomFieldValueInput({
  def,
  users,
  value,
  onChange,
}: {
  def: CustomFieldDefDto;
  users: UserDto[];
  value: CustomFieldCondition['value'];
  onChange: (value: CustomFieldCondition['value']) => void;
}) {
  const str = typeof value === 'string' ? value : '';

  switch (def.type) {
    case 'SELECT':
    case 'MULTI_SELECT':
      return (
        <Select
          value={str}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Select a value…"
          options={(def.options ?? []).map((o) => ({ value: o, label: o }))}
        />
      );
    case 'USER':
      return (
        <Select
          value={str}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Select a user…"
          options={users.map((u) => ({ value: u.id, label: u.displayName }))}
        />
      );
    case 'CHECKBOX':
      return (
        <Select
          value={value === false ? 'false' : 'true'}
          onChange={(e) => onChange(e.target.value === 'true')}
          options={[
            { value: 'true', label: 'Checked' },
            { value: 'false', label: 'Unchecked' },
          ]}
        />
      );
    case 'NUMBER':
      return (
        <input
          type="number"
          value={typeof value === 'number' ? value : ''}
          onChange={(e) =>
            onChange(e.target.value === '' ? '' : Number(e.target.value))
          }
          className={inputClass}
        />
      );
    case 'DATE':
      return (
        <input
          type="date"
          value={str.slice(0, 10)}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    default:
      return (
        <input
          value={str}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Value…"
          className={inputClass}
        />
      );
  }
}
