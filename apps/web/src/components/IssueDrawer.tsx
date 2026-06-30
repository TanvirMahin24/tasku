import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Link2,
  Paperclip,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  ISSUE_TYPES,
  PRIORITIES,
  type ActivityDto,
  type AttachmentDto,
  type CommentDto,
  type CreateLinkDto,
  type IssueDetailDto,
  type IssueLinkDto,
  type IssueSummaryDto,
  type LinkType,
  type StatusDto,
  type UpdateIssueDto,
  type UserDto,
  type WorklogDto,
} from '@tasku/types';
import {
  apiErrorMessage,
  commentsApi,
  fetchAttachmentBlobUrl,
  issuesApi,
  searchApi,
  teamsApi,
} from '@/lib/api';
// (teamsApi used for the Team select in the drawer sidebar)
import { qk } from '@/lib/queryKeys';
import {
  ISSUE_TYPE_META,
  PRIORITY_META,
  formatMinutes,
  humanizeField,
  parseDuration,
  relativeTime,
  toDateInput,
} from '@/lib/format';
import { useDebounced } from '@/hooks/useDebounced';
import { useProjectMeta } from '@/hooks/useProjectMeta';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Select, inputClass } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { AssigneeSelect } from '@/components/ui/AssigneeSelect';
import { LabelPicker } from '@/components/ui/LabelPicker';
import { IssueTypeIcon } from '@/components/ui/icons';

export function IssueDrawer({
  issueKey,
  projectKey,
  open,
  onClose,
  onDeleted,
}: {
  issueKey: string | null;
  projectKey: string;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !issueKey) return null;

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-gray-900/30" onClick={onClose} aria-hidden />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <DrawerBody
          issueKey={issueKey}
          projectKey={projectKey}
          onClose={onClose}
          onDeleted={onDeleted}
        />
      </aside>
    </div>,
    document.body,
  );
}

function DrawerBody({
  issueKey,
  projectKey,
  onClose,
  onDeleted,
}: {
  issueKey: string;
  projectKey: string;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const { statuses, labels, users } = useProjectMeta(projectKey);

  const { data: teams = [] } = useQuery({
    queryKey: qk.teams,
    queryFn: teamsApi.list,
  });

  const { data: issue, isLoading, error } = useQuery({
    queryKey: qk.issue(issueKey),
    queryFn: () => issuesApi.get(issueKey),
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Keep local editable fields in sync when the issue (re)loads.
  useEffect(() => {
    if (issue) {
      setTitle(issue.title);
      setDescription(issue.description ?? '');
    }
  }, [issue?.id, issue?.title, issue?.description]); // eslint-disable-line react-hooks/exhaustive-deps

  function invalidateBoards() {
    queryClient.invalidateQueries({ queryKey: ['project', projectKey, 'board'] });
    queryClient.invalidateQueries({ queryKey: ['project', projectKey, 'issues'] });
  }

  const update = useMutation({
    mutationFn: (dto: UpdateIssueDto) => issuesApi.update(issueKey, dto),
    onSuccess: (updated) => {
      queryClient.setQueryData<IssueDetailDto>(qk.issue(issueKey), updated);
      queryClient.invalidateQueries({ queryKey: qk.issue(issueKey) });
      invalidateBoards();
    },
    onError: (err) => setErrorMsg(apiErrorMessage(err, 'Update failed')),
  });

  const remove = useMutation({
    mutationFn: () => issuesApi.remove(issueKey),
    onSuccess: () => {
      invalidateBoards();
      onDeleted?.();
      onClose();
    },
    onError: (err) => setErrorMsg(apiErrorMessage(err, 'Delete failed')),
  });

  function patch(dto: UpdateIssueDto) {
    setErrorMsg(null);
    update.mutate(dto);
  }

  if (isLoading) {
    return (
      <>
        <DrawerHeader issueKey={issueKey} onClose={onClose} />
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      </>
    );
  }

  if (error || !issue) {
    return (
      <>
        <DrawerHeader issueKey={issueKey} onClose={onClose} />
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-500">
          {apiErrorMessage(error, 'Could not load this issue.')}
        </div>
      </>
    );
  }

  return (
    <>
      <DrawerHeader issueKey={issue.key} onClose={onClose}>
        <button
          onClick={() => {
            if (confirm(`Delete ${issue.key}? This cannot be undone.`)) {
              remove.mutate();
            }
          }}
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
          title="Delete issue"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </DrawerHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* Main column */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const next = title.trim();
              if (next && next !== issue.title) patch({ title: next });
              else if (!next) setTitle(issue.title);
            }}
            className="w-full rounded-md border border-transparent px-2 py-1 text-xl font-semibold text-gray-900 hover:border-gray-200 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />

          {issue.parent && (
            <div className="mt-3">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Parent
              </span>
              <Link
                to={`/issues/${issue.parent.key}`}
                className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm hover:border-brand-300 hover:bg-white"
              >
                <IssueTypeIcon type={issue.parent.type} />
                <span className="font-mono text-xs text-gray-500">
                  {issue.parent.key}
                </span>
                <span className="text-gray-700">{issue.parent.title}</span>
              </Link>
            </div>
          )}

          <Section label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                if (description !== (issue.description ?? '')) {
                  patch({ description });
                }
              }}
              placeholder="Add a description…"
              className={`${inputClass} min-h-[120px] resize-y`}
            />
          </Section>

          <Section label="Subtasks">
            <SubtasksPanel
              issueKey={issue.key}
              items={issue.children}
              statuses={statuses}
            />
          </Section>

          <Section label="Time tracking">
            <TimeTrackingPanel
              issueKey={issue.key}
              originalEstimate={issue.originalEstimate}
              timeSpent={issue.timeSpent}
              worklogs={issue.worklogs}
            />
          </Section>

          <Section label="Links">
            <LinksPanel issueKey={issue.key} links={issue.links} />
          </Section>

          <Section label="Attachments">
            <AttachmentsPanel
              issueKey={issue.key}
              attachments={issue.attachments}
            />
          </Section>

          <Section label="Comments">
            <CommentsPanel issueKey={issue.key} comments={issue.comments} />
          </Section>

          <Section label="Activity">
            <ActivityFeed activities={issue.activities} />
          </Section>
        </div>

        {/* Sidebar fields */}
        <aside className="w-72 shrink-0 space-y-4 overflow-y-auto scrollbar-thin border-l border-gray-200 bg-gray-50 px-5 py-5">
          {errorMsg && (
            <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
              {errorMsg}
            </p>
          )}

          <Field label="Status">
            <Select
              value={issue.statusId}
              onChange={(e) => patch({ statusId: e.target.value })}
              options={statuses.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Field>

          <Field label="Assignee">
            <AssigneeSelect
              users={users}
              value={issue.assignee?.id ?? null}
              onChange={(id) => patch({ assigneeId: id })}
            />
          </Field>

          <Field label="Type">
            <div className="flex items-center gap-2">
              <IssueTypeIcon type={issue.type} />
              <Select
                value={issue.type}
                onChange={(e) =>
                  patch({ type: e.target.value as IssueDetailDto['type'] })
                }
                options={ISSUE_TYPES.map((t) => ({
                  value: t,
                  label: ISSUE_TYPE_META[t].label,
                }))}
              />
            </div>
          </Field>

          <Field label="Priority">
            <Select
              value={issue.priority}
              onChange={(e) =>
                patch({ priority: e.target.value as IssueDetailDto['priority'] })
              }
              options={PRIORITIES.map((p) => ({
                value: p,
                label: PRIORITY_META[p].label,
              }))}
            />
          </Field>

          <Field label="Story points">
            <input
              type="number"
              min={0}
              defaultValue={issue.storyPoints ?? ''}
              key={issue.storyPoints ?? 'none'}
              onBlur={(e) => {
                const raw = e.target.value.trim();
                const next = raw === '' ? null : Number(raw);
                if (next !== (issue.storyPoints ?? null)) {
                  patch({ storyPoints: next });
                }
              }}
              className={inputClass}
              placeholder="—"
            />
          </Field>

          <Field label="Labels">
            <LabelPicker
              labels={labels}
              selectedIds={issue.labels.map((l) => l.id)}
              onChange={(ids) => patch({ labelIds: ids })}
            />
          </Field>

          <Field label="Team">
            <Select
              value={issue.team?.id ?? ''}
              onChange={(e) =>
                patch({ teamId: e.target.value ? e.target.value : null })
              }
              placeholder="No team"
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Start date">
              <input
                type="date"
                defaultValue={toDateInput(issue.startDate)}
                key={`start-${issue.startDate ?? 'none'}`}
                onChange={(e) =>
                  patch({ startDate: e.target.value || null })
                }
                className={inputClass}
              />
            </Field>
            <Field label="Due date">
              <input
                type="date"
                defaultValue={toDateInput(issue.dueDate)}
                key={`due-${issue.dueDate ?? 'none'}`}
                onChange={(e) => patch({ dueDate: e.target.value || null })}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Watchers">
            <WatchersPanel
              issueKey={issue.key}
              watching={issue.watching}
              watchers={issue.watchers}
            />
          </Field>

          <div className="space-y-1.5 border-t border-gray-200 pt-3 text-xs text-gray-500">
            <div className="flex items-center justify-between">
              <span>Reporter</span>
              <span className="flex items-center gap-1.5 font-medium text-gray-700">
                <Avatar user={issue.reporter} size="xs" />
                {issue.reporter.displayName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Created</span>
              <span>{relativeTime(issue.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Updated</span>
              <span>{relativeTime(issue.updatedAt)}</span>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

function CommentsPanel({
  issueKey,
  comments,
}: {
  issueKey: string;
  comments: CommentDto[];
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');

  const add = useMutation({
    mutationFn: (text: string) => commentsApi.create(issueKey, { body: text }),
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({ queryKey: qk.issue(issueKey) });
      queryClient.invalidateQueries({ queryKey: qk.comments(issueKey) });
    },
  });

  return (
    <div className="space-y-4">
      {comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar user={c.author} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {c.author.displayName}
                  </span>
                  <span className="text-xs text-gray-400">
                    {relativeTime(c.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add.mutate(body.trim());
        }}
        className="flex items-end gap-2"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && body.trim()) {
              e.preventDefault();
              add.mutate(body.trim());
            }
          }}
          placeholder="Add a comment…  (⌘/Ctrl + Enter to send)"
          className={`${inputClass} min-h-[60px] resize-y`}
        />
        <Button
          type="submit"
          size="sm"
          loading={add.isPending}
          disabled={!body.trim()}
          className="h-9"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subtasks
// ---------------------------------------------------------------------------

function SubtasksPanel({
  issueKey,
  items,
  statuses,
}: {
  issueKey: string;
  items: IssueSummaryDto[];
  statuses: StatusDto[];
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doneStatusIds = new Set(
    statuses.filter((s) => s.category === 'DONE').map((s) => s.id),
  );

  const add = useMutation({
    mutationFn: (text: string) =>
      issuesApi.createSubtask(issueKey, { title: text }),
    onSuccess: () => {
      setTitle('');
      setAdding(false);
      queryClient.invalidateQueries({ queryKey: qk.issue(issueKey) });
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not add subtask')),
  });

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
          {items.map((c) => {
            const done = doneStatusIds.has(c.statusId);
            return (
              <li key={c.id}>
                <Link
                  to={`/issues/${c.key}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={done}
                    readOnly
                    className="h-4 w-4 rounded border-gray-300 text-brand-600"
                  />
                  <IssueTypeIcon type={c.type} />
                  <span className="font-mono text-[11px] text-gray-400">
                    {c.key}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate ${done ? 'text-gray-400 line-through' : 'text-gray-700'}`}
                  >
                    {c.title}
                  </span>
                  <Avatar user={c.assignee} size="xs" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (title.trim()) add.mutate(title.trim());
          }}
          className="flex items-center gap-2"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Subtask title…"
            autoFocus
            className={inputClass}
          />
          <Button type="submit" size="sm" loading={add.isPending} className="h-9">
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => {
              setAdding(false);
              setTitle('');
              setError(null);
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          <Plus className="h-3.5 w-3.5" /> Add subtask
        </button>
      )}

      {items.length === 0 && !adding && (
        <p className="text-sm text-gray-400">No subtasks yet.</p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

function ActivityFeed({ activities }: { activities: ActivityDto[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-gray-400">No activity yet.</p>;
  }
  // Newest first.
  const sorted = [...activities].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );
  return (
    <ul className="space-y-2.5">
      {sorted.map((a) => (
        <li key={a.id} className="flex items-start gap-2.5 text-sm">
          <Avatar user={a.actor} size="xs" className="mt-0.5" />
          <p className="text-gray-600">
            <span className="font-medium text-gray-900">
              {a.actor.displayName}
            </span>{' '}
            <ActivityText activity={a} />{' '}
            <span className="text-gray-400">· {relativeTime(a.createdAt)}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

function ActivityText({ activity }: { activity: ActivityDto }) {
  const { field, oldValue, newValue } = activity;
  if (field === 'created') return <>created this issue</>;
  if (field === 'comment') return <>added a comment</>;
  const f = humanizeField(field).toLowerCase();
  if (oldValue && newValue) {
    return (
      <>
        changed <span className="font-medium">{f}</span> from{' '}
        <code className="rounded bg-gray-100 px-1 text-xs">{oldValue}</code> to{' '}
        <code className="rounded bg-gray-100 px-1 text-xs">{newValue}</code>
      </>
    );
  }
  if (newValue) {
    return (
      <>
        set <span className="font-medium">{f}</span> to{' '}
        <code className="rounded bg-gray-100 px-1 text-xs">{newValue}</code>
      </>
    );
  }
  return (
    <>
      updated <span className="font-medium">{f}</span>
    </>
  );
}

// ---------------------------------------------------------------------------
// Time tracking
// ---------------------------------------------------------------------------

function TimeTrackingPanel({
  issueKey,
  originalEstimate,
  timeSpent,
  worklogs,
}: {
  issueKey: string;
  originalEstimate: number | null;
  timeSpent: number;
  worklogs: WorklogDto[];
}) {
  const queryClient = useQueryClient();
  const [estimateStr, setEstimateStr] = useState(
    originalEstimate != null ? formatMinutes(originalEstimate) : '',
  );
  const [duration, setDuration] = useState('');
  const [comment, setComment] = useState('');
  const [started, setStarted] = useState('');
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: qk.issue(issueKey) });
  }

  const setEstimate = useMutation({
    mutationFn: (minutes: number | null) =>
      issuesApi.update(issueKey, { originalEstimate: minutes }),
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err, 'Could not set estimate')),
  });

  const addLog = useMutation({
    mutationFn: (minutes: number) =>
      issuesApi.addWorklog(issueKey, {
        minutes,
        comment: comment.trim() || undefined,
        startedAt: started ? new Date(started).toISOString() : undefined,
      }),
    onSuccess: () => {
      setDuration('');
      setComment('');
      setStarted('');
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not log work')),
  });

  const deleteLog = useMutation({
    mutationFn: (id: string) => issuesApi.deleteWorklog(id),
    onSuccess: invalidate,
  });

  const pct =
    originalEstimate && originalEstimate > 0
      ? Math.min(100, Math.round((timeSpent / originalEstimate) * 100))
      : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="mb-1 block text-xs text-gray-500">Original estimate</span>
          <input
            value={estimateStr}
            onChange={(e) => setEstimateStr(e.target.value)}
            onBlur={() => {
              setError(null);
              const raw = estimateStr.trim();
              if (raw === '') {
                if (originalEstimate != null) setEstimate.mutate(null);
                return;
              }
              const mins = parseDuration(raw);
              if (mins == null) {
                setError('Could not parse estimate (try "2h 30m").');
                setEstimateStr(
                  originalEstimate != null ? formatMinutes(originalEstimate) : '',
                );
              } else if (mins !== (originalEstimate ?? null)) {
                setEstimate.mutate(mins);
              }
            }}
            placeholder="e.g. 2h 30m"
            className={inputClass}
          />
        </div>
        <div>
          <span className="mb-1 block text-xs text-gray-500">Logged</span>
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {formatMinutes(timeSpent)}
          </p>
        </div>
      </div>

      {originalEstimate != null && originalEstimate > 0 && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {formatMinutes(timeSpent)} of {formatMinutes(originalEstimate)} ({pct}%)
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const mins = parseDuration(duration);
          if (mins == null || mins <= 0) {
            setError('Enter a valid duration (e.g. "1h 30m").');
            return;
          }
          addLog.mutate(mins);
        }}
        className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
      >
        <div className="flex items-center gap-2">
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="Duration (e.g. 1h 30m)"
            className={`${inputClass} flex-1`}
          />
          <input
            type="date"
            value={started}
            onChange={(e) => setStarted(e.target.value)}
            className={`${inputClass} w-auto`}
          />
        </div>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comment (optional)"
          className={inputClass}
        />
        <Button
          type="submit"
          size="sm"
          loading={addLog.isPending}
          disabled={!duration.trim()}
        >
          Log work
        </Button>
      </form>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {worklogs.length > 0 && (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
          {worklogs.map((w) => (
            <li key={w.id} className="flex items-start gap-2.5 px-3 py-2 text-sm">
              <Avatar user={w.user} size="xs" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-gray-700">
                  <span className="font-medium text-gray-900">
                    {w.user.displayName}
                  </span>{' '}
                  logged{' '}
                  <span className="font-medium">{formatMinutes(w.minutes)}</span>{' '}
                  <span className="text-gray-400">· {relativeTime(w.startedAt)}</span>
                </p>
                {w.comment && (
                  <p className="mt-0.5 text-xs text-gray-500">{w.comment}</p>
                )}
              </div>
              <button
                onClick={() => deleteLog.mutate(w.id)}
                className="text-gray-300 hover:text-red-600"
                title="Delete worklog"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

const LINK_TYPE_LABEL: Record<LinkType, string> = {
  BLOCKS: 'blocks',
  IS_BLOCKED_BY: 'is blocked by',
  RELATES_TO: 'relates to',
  DUPLICATES: 'duplicates',
};

const LINK_TYPES: LinkType[] = [
  'BLOCKS',
  'IS_BLOCKED_BY',
  'RELATES_TO',
  'DUPLICATES',
];

function groupLabel(link: IssueLinkDto): string {
  // Display label reflects how the *current* issue relates to the other.
  if (link.direction === 'outward') return LINK_TYPE_LABEL[link.type];
  // Inward: invert blocks/is-blocked-by.
  if (link.type === 'BLOCKS') return LINK_TYPE_LABEL.IS_BLOCKED_BY;
  if (link.type === 'IS_BLOCKED_BY') return LINK_TYPE_LABEL.BLOCKS;
  return LINK_TYPE_LABEL[link.type];
}

function LinksPanel({
  issueKey,
  links,
}: {
  issueKey: string;
  links: IssueLinkDto[];
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [linkType, setLinkType] = useState<LinkType>('RELATES_TO');
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounced(target, 250);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: qk.issue(issueKey) });
  }

  const { data: suggestions } = useQuery({
    queryKey: qk.search({ text: debounced.trim() }),
    queryFn: () => searchApi.issues({ text: debounced.trim() }),
    enabled: adding && debounced.trim().length >= 1,
  });

  const add = useMutation({
    mutationFn: (dto: CreateLinkDto) => issuesApi.addLink(issueKey, dto),
    onSuccess: () => {
      setTarget('');
      setAdding(false);
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not add link')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => issuesApi.removeLink(id),
    onSuccess: invalidate,
  });

  // Group by display label.
  const groups = new Map<string, IssueLinkDto[]>();
  for (const l of links) {
    const label = groupLabel(l);
    const arr = groups.get(label) ?? [];
    arr.push(l);
    groups.set(label, arr);
  }

  return (
    <div className="space-y-3">
      {links.length === 0 && !adding && (
        <p className="text-sm text-gray-400">No linked issues.</p>
      )}

      {[...groups.entries()].map(([label, items]) => (
        <div key={label}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            {label}
          </p>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
            {items.map((l) => (
              <li key={l.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <IssueTypeIcon type={l.issue.type} />
                <Link
                  to={`/issues/${l.issue.key}`}
                  className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
                >
                  <span className="font-mono text-[11px] text-gray-400">
                    {l.issue.key}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-gray-700">
                    {l.issue.title}
                  </span>
                </Link>
                <button
                  onClick={() => remove.mutate(l.id)}
                  className="text-gray-300 hover:text-red-600"
                  title="Remove link"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {adding ? (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center gap-2">
            <Select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value as LinkType)}
              className="w-auto"
              options={LINK_TYPES.map((t) => ({
                value: t,
                label: LINK_TYPE_LABEL[t],
              }))}
            />
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Search issue…"
              autoFocus
              className={`${inputClass} flex-1`}
            />
          </div>

          {suggestions && suggestions.issues.length > 0 && (
            <ul className="max-h-40 overflow-y-auto scrollbar-thin rounded-md border border-gray-200 bg-white">
              {suggestions.issues
                .filter((i) => i.key !== issueKey)
                .map((i) => (
                  <li key={i.id}>
                    <button
                      onClick={() => {
                        setError(null);
                        add.mutate({ type: linkType, targetKey: i.key });
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                    >
                      <IssueTypeIcon type={i.type} />
                      <span className="font-mono text-[11px] text-gray-400">
                        {i.key}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-gray-700">
                        {i.title}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              loading={add.isPending}
              disabled={!target.trim()}
              onClick={() => {
                setError(null);
                if (target.trim())
                  add.mutate({ type: linkType, targetKey: target.trim() });
              }}
            >
              Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setTarget('');
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          <Link2 className="h-3.5 w-3.5" /> Add link
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentsPanel({
  issueKey,
  attachments,
}: {
  issueKey: string;
  attachments: AttachmentDto[];
}) {
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: qk.issue(issueKey) });
  }

  const upload = useMutation({
    mutationFn: (file: File) => issuesApi.uploadAttachment(issueKey, file),
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err, 'Upload failed')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => issuesApi.deleteAttachment(id),
    onSuccess: invalidate,
  });

  function handleFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    Array.from(files).forEach((f) => upload.mutate(f));
  }

  return (
    <div className="space-y-3">
      {attachments.length > 0 && (
        <ul className="grid grid-cols-2 gap-2">
          {attachments.map((a) => (
            <AttachmentCard
              key={a.id}
              attachment={a}
              onDelete={() => remove.mutate(a.id)}
            />
          ))}
        </ul>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center text-sm ${
          dragOver
            ? 'border-brand-400 bg-brand-50 text-brand-600'
            : 'border-gray-300 text-gray-400'
        }`}
      >
        <Paperclip className="mb-1 h-5 w-5" />
        <p>
          Drop files here or{' '}
          <button
            onClick={() => fileRef.current?.click()}
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            browse
          </button>
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {upload.isPending && (
        <p className="flex items-center gap-1.5 text-xs text-gray-400">
          <Spinner className="h-3.5 w-3.5" /> Uploading…
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function AttachmentCard({
  attachment,
  onDelete,
}: {
  attachment: AttachmentDto;
  onDelete: () => void;
}) {
  const isImage = attachment.mimeType.startsWith('image/');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    if (isImage) {
      fetchAttachmentBlobUrl(attachment.id)
        .then((u) => {
          if (cancelled) {
            URL.revokeObjectURL(u);
          } else {
            url = u;
            setBlobUrl(u);
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.id, isImage]);

  async function download() {
    const url = await fetchAttachmentBlobUrl(attachment.id);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  return (
    <li className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white">
      <button
        onClick={download}
        className="block w-full text-left"
        title={`Download ${attachment.filename}`}
      >
        <div className="flex h-24 items-center justify-center bg-gray-50">
          {isImage && blobUrl ? (
            <img
              src={blobUrl}
              alt={attachment.filename}
              className="h-full w-full object-cover"
            />
          ) : (
            <FileText className="h-8 w-8 text-gray-300" />
          )}
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <Download className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="min-w-0 flex-1 truncate text-xs text-gray-700">
            {attachment.filename}
          </span>
          <span className="shrink-0 text-[10px] text-gray-400">
            {formatBytes(attachment.size)}
          </span>
        </div>
      </button>
      <button
        onClick={onDelete}
        className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded bg-white/90 text-gray-500 shadow-sm hover:text-red-600 group-hover:flex"
        title="Delete attachment"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Watchers
// ---------------------------------------------------------------------------

function WatchersPanel({
  issueKey,
  watching,
  watchers,
}: {
  issueKey: string;
  watching: boolean;
  watchers: UserDto[];
}) {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: qk.issue(issueKey) });
  }

  const toggle = useMutation({
    mutationFn: () =>
      watching ? issuesApi.unwatch(issueKey) : issuesApi.watch(issueKey),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-2">
      <button
        onClick={() => toggle.mutate()}
        disabled={toggle.isPending}
        className={`flex w-full items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors ${
          watching
            ? 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
            : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        {watching ? (
          <>
            <Eye className="h-4 w-4" /> Watching
          </>
        ) : (
          <>
            <EyeOff className="h-4 w-4" /> Watch
          </>
        )}
      </button>
      <div className="flex items-center gap-1.5">
        <div className="flex -space-x-1.5">
          {watchers.slice(0, 5).map((w) => (
            <Avatar key={w.id} user={w} size="xs" />
          ))}
        </div>
        <span className="text-xs text-gray-500">
          {watchers.length} {watchers.length === 1 ? 'watcher' : 'watchers'}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

function DrawerHeader({
  issueKey,
  onClose,
  children,
}: {
  issueKey: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
      <a
        href={`/issues/${issueKey}`}
        className="group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
        onClick={(e) => e.preventDefault()}
        title={issueKey}
      >
        {issueKey}
        <ExternalLink className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
      </a>
      <div className="flex items-center gap-1">
        {children}
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </span>
      {children}
    </div>
  );
}
