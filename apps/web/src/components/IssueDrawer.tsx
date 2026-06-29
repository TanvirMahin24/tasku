import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ExternalLink,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  ISSUE_TYPES,
  PRIORITIES,
  type ActivityDto,
  type CommentDto,
  type IssueDetailDto,
  type UpdateIssueDto,
} from '@tasku/types';
import { apiErrorMessage, commentsApi, issuesApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import {
  ISSUE_TYPE_META,
  PRIORITY_META,
  humanizeField,
  relativeTime,
} from '@/lib/format';
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
