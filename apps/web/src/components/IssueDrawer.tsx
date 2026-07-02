import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
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
  ListPlus,
  Paperclip,
  Plus,
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
  type CustomFieldEntryDto,
  type CustomFieldValue,
  type DeliveryRollupDto,
  type IssueDetailDto,
  type IssueLinkDto,
  type VersionSummaryDto,
  type IssueSummaryDto,
  type LinkType,
  type StatusDto,
  type UpdateIssueDto,
  type UserDto,
} from '@tasku/types';
import {
  apiErrorMessage,
  commentsApi,
  customFieldsApi,
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
  STATUS_CATEGORY_META,
  humanizeField,
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
import { DescriptionEditor } from '@/components/DescriptionEditor';
import { LabelPicker } from '@/components/ui/LabelPicker';
import { TeamMultiSelect } from '@/components/ui/TeamMultiSelect';
import { IssueTypeIcon } from '@/components/ui/icons';
import { KnowledgeBase } from '@/components/KnowledgeBase';
import { MentionInput } from '@/components/mentions/MentionInput';
import { MentionText } from '@/components/mentions/MentionText';
import { buildMentionToken } from '@/lib/mentions';
import { useAuthStore } from '@/store/auth';

/** Smooth-scroll a labelled section into view within the drawer's main column. */
function scrollToSection(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function DrawerAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Paperclip;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-[34px] items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[12.5px] font-semibold text-ink-soft hover:bg-surface-sunken dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
    >
      <Icon className="h-[15px] w-[15px]" />
      {label}
    </button>
  );
}

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
      <div className="absolute inset-0 bg-gray-900/30 dark:bg-black/60" onClick={onClose} aria-hidden />
      <aside className="absolute right-0 top-0 flex h-full w-[1040px] max-w-[95vw] flex-col border-l border-line bg-white shadow-raise dark:border-gray-700 dark:bg-gray-900">
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
  const { statuses, labels, users, versions } = useProjectMeta(projectKey);

  const { data: teams = [] } = useQuery({
    queryKey: qk.teams,
    queryFn: teamsApi.list,
  });

  const { data: issue, isLoading, error } = useQuery({
    queryKey: qk.issue(issueKey),
    queryFn: () => issuesApi.get(issueKey),
  });

  const [title, setTitle] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Keep local editable fields in sync when the issue (re)loads.
  useEffect(() => {
    if (issue) {
      setTitle(issue.title);
    }
  }, [issue?.id, issue?.title]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const watchToggle = useMutation({
    mutationFn: (watching: boolean) =>
      watching ? issuesApi.unwatch(issueKey) : issuesApi.watch(issueKey),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: qk.issue(issueKey) }),
  });

  function patch(dto: UpdateIssueDto) {
    setErrorMsg(null);
    update.mutate(dto);
  }

  if (isLoading) {
    return (
      <>
        <DrawerHeader
          projectKey={projectKey}
          issueKey={issueKey}
          onClose={onClose}
        />
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      </>
    );
  }

  if (error || !issue) {
    return (
      <>
        <DrawerHeader
          projectKey={projectKey}
          issueKey={issueKey}
          onClose={onClose}
        />
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-ink-muted">
          {apiErrorMessage(error, 'Could not load this issue.')}
        </div>
      </>
    );
  }

  return (
    <>
      <DrawerHeader
        projectKey={projectKey}
        issueKey={issue.key}
        type={issue.type}
        onClose={onClose}
      >
        <button
          onClick={() => watchToggle.mutate(issue.watching)}
          disabled={watchToggle.isPending}
          className="flex h-[30px] items-center gap-1.5 rounded-md border border-line px-2.5 text-[11.5px] font-semibold text-ink-soft hover:bg-surface-sunken dark:border-gray-700 dark:text-gray-300"
          title={issue.watching ? 'Stop watching' : 'Watch'}
        >
          {issue.watching ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
          {issue.watching ? 'Watching' : 'Watch'}
        </button>
        <button
          onClick={() => {
            if (confirm(`Delete ${issue.key}? This cannot be undone.`)) {
              remove.mutate();
            }
          }}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-line text-ink-faint hover:bg-red-50 hover:text-red-600 dark:border-gray-700"
          title="Delete issue"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </DrawerHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* Main column */}
        <div className="flex-1 overflow-y-auto scrollbar-thin border-r border-line-soft px-6 py-5 dark:border-gray-800">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const next = title.trim();
              if (next && next !== issue.title) patch({ title: next });
              else if (!next) setTitle(issue.title);
            }}
            className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-[22px] font-bold leading-tight tracking-[-0.01em] text-ink hover:border-line focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:text-gray-100 dark:hover:border-gray-600"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <DrawerAction
              icon={Paperclip}
              label="Attach"
              onClick={() => scrollToSection('drawer-attachments')}
            />
            <DrawerAction
              icon={ListPlus}
              label="Add subtask"
              onClick={() => scrollToSection('drawer-subtasks')}
            />
            <DrawerAction
              icon={Link2}
              label="Link issue"
              onClick={() => scrollToSection('drawer-links')}
            />
          </div>

          {issue.parent && (
            <div className="mt-3">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Parent
              </span>
              <Link
                to={`/issues/${issue.parent.key}`}
                className="inline-flex items-center gap-2 rounded-md border border-line bg-surface-sunken px-2.5 py-1.5 text-sm hover:border-brand-300 hover:bg-white dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <IssueTypeIcon type={issue.parent.type} />
                <span className="font-mono text-xs text-ink-muted dark:text-ink-faint">
                  {issue.parent.key}
                </span>
                <span className="text-ink-soft dark:text-gray-200">{issue.parent.title}</span>
              </Link>
            </div>
          )}

          <Section label="Description">
            <DescriptionEditor
              key={issue.id}
              value={issue.description}
              projectKey={projectKey}
              onSave={(json) => patch({ description: json })}
            />
          </Section>

          <Section label="Subtasks" id="drawer-subtasks">
            <SubtasksPanel
              issueKey={issue.key}
              items={issue.children}
              statuses={statuses}
            />
          </Section>

          <Section label="Knowledge base" id="drawer-knowledge">
            <KnowledgeBase scope={{ kind: 'issue', issueKey: issue.key }} />
          </Section>

          {issue.delivery && (
            <Section label="Delivery">
              <DeliveryPanel delivery={issue.delivery} links={issue.links} />
            </Section>
          )}

          <Section label="Links" id="drawer-links">
            <LinksPanel issueKey={issue.key} links={issue.links} />
          </Section>

          <Section label="Attachments" id="drawer-attachments">
            <AttachmentsPanel
              issueKey={issue.key}
              attachments={issue.attachments}
            />
          </Section>

          <Section label="Comments">
            <CommentsPanel
              issueKey={issue.key}
              projectKey={projectKey}
              comments={issue.comments}
            />
          </Section>

          <Section label="Activity">
            <ActivityFeed activities={issue.activities} />
          </Section>
        </div>

        {/* Sidebar fields */}
        <aside className="w-[360px] shrink-0 space-y-3.5 overflow-y-auto scrollbar-thin px-5 py-5">
          {errorMsg && (
            <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
              {errorMsg}
            </p>
          )}

          <div>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-faint">
              Status
            </span>
            <StatusMenu
              statuses={statuses}
              value={issue.statusId}
              onChange={(id) => patch({ statusId: id })}
            />
          </div>

          <div className="rounded-[10px] border border-line dark:border-gray-700">
            <div className="px-3.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-faint">
              Details
            </div>
            <div className="flex flex-col px-3.5 pb-2.5">
              <Row label="Assignee">
                <AssigneeSelect
                  users={users}
                  value={issue.assignee?.id ?? null}
                  onChange={(id) => patch({ assigneeId: id })}
                />
              </Row>
              <Row label="Reporter">
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink dark:text-gray-100">
                  <Avatar user={issue.reporter} size="xs" />
                  {issue.reporter.displayName}
                </span>
              </Row>
              <Row label="Priority">
                <Select
                  value={issue.priority}
                  onChange={(e) =>
                    patch({
                      priority: e.target.value as IssueDetailDto['priority'],
                    })
                  }
                  options={PRIORITIES.map((p) => ({
                    value: p,
                    label: PRIORITY_META[p].label,
                  }))}
                />
              </Row>
              <Row label="Type">
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
              </Row>
              <Row label="Story points">
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
              </Row>
              <Row label="Labels" align="start">
                <LabelPicker
                  labels={labels}
                  selectedIds={issue.labels.map((l) => l.id)}
                  onChange={(ids) => patch({ labelIds: ids })}
                />
              </Row>
              <Row label="Teams" align="start">
                <TeamMultiSelect
                  teams={teams}
                  value={issue.teams.map((t) => t.id)}
                  onChange={(ids) => patch({ teamIds: ids })}
                />
              </Row>
              <Row label="Fix versions" align="start">
                <VersionMultiSelect
                  versions={versions}
                  value={issue.versions.map((v) => v.id)}
                  onChange={(ids) => patch({ fixVersionIds: ids })}
                />
              </Row>
              <Row label="Start date">
                <input
                  type="date"
                  defaultValue={toDateInput(issue.startDate)}
                  key={`start-${issue.startDate ?? 'none'}`}
                  onChange={(e) => patch({ startDate: e.target.value || null })}
                  className={inputClass}
                />
              </Row>
              <Row label="Due date">
                <input
                  type="date"
                  defaultValue={toDateInput(issue.dueDate)}
                  key={`due-${issue.dueDate ?? 'none'}`}
                  onChange={(e) => patch({ dueDate: e.target.value || null })}
                  className={inputClass}
                />
              </Row>
              <Row label="Watchers" align="start">
                <WatchersPanel
                  issueKey={issue.key}
                  watching={issue.watching}
                  watchers={issue.watchers}
                />
              </Row>
              {issue.customFields.map((cf) => (
                <Row key={cf.field.id} label={cf.field.name} align="start">
                  <CustomFieldControl
                    issueKey={issue.key}
                    entry={cf}
                    users={users}
                  />
                </Row>
              ))}
            </div>
          </div>

          <div className="px-1 text-[11px] text-ink-faint">
            Created {relativeTime(issue.createdAt)} · Updated{' '}
            {relativeTime(issue.updatedAt)}
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
  projectKey,
  comments,
}: {
  issueKey: string;
  projectKey: string;
  comments: CommentDto[];
}) {
  const queryClient = useQueryClient();
  // Which thread's reply composer is open, plus any prefilled body (an
  // @-mention of the author when replying to a reply — threads cap at 2 levels).
  const [replyTo, setReplyTo] = useState<{
    threadId: string;
    initial: string;
  } | null>(null);
  const replyToAuthor = (threadId: string, author: CommentDto['author']) =>
    setReplyTo({
      threadId,
      initial: `${buildMentionToken({
        type: 'user',
        id: author.id,
        label: author.displayName,
      })} `,
    });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.issue(issueKey) });
    queryClient.invalidateQueries({ queryKey: qk.comments(issueKey) });
  };
  const add = useMutation({
    mutationFn: (v: { body: string; parentId?: string | null }) =>
      commentsApi.create(issueKey, v),
    onSuccess: () => {
      setReplyTo(null);
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => commentsApi.remove(id),
    onSuccess: invalidate,
  });

  // Group flat comments into one-level threads.
  const tops = comments.filter((c) => !c.parentId);
  const repliesByParent = new Map<string, CommentDto[]>();
  for (const c of comments) {
    if (!c.parentId) continue;
    const arr = repliesByParent.get(c.parentId) ?? [];
    arr.push(c);
    repliesByParent.set(c.parentId, arr);
  }

  return (
    <div className="space-y-4">
      {tops.length > 0 && (
        <ul className="space-y-4">
          {tops.map((c) => {
            const replies = repliesByParent.get(c.id) ?? [];
            return (
              <li key={c.id} className="space-y-2">
                <CommentItem
                  comment={c}
                  projectKey={projectKey}
                  onDelete={() => remove.mutate(c.id)}
                  onReply={() =>
                    setReplyTo((v) =>
                      v?.threadId === c.id ? null : { threadId: c.id, initial: '' },
                    )
                  }
                />
                {(replies.length > 0 || replyTo?.threadId === c.id) && (
                  <div className="ml-9 space-y-2 border-l border-line-soft pl-3 dark:border-gray-700">
                    {replies.map((r) => (
                      <CommentItem
                        key={r.id}
                        comment={r}
                        projectKey={projectKey}
                        onDelete={() => remove.mutate(r.id)}
                        onReply={() => replyToAuthor(c.id, r.author)}
                      />
                    ))}
                    {replyTo?.threadId === c.id && (
                      <Composer
                        // Remount when the prefill changes so a new reply target
                        // resets the composer body.
                        key={replyTo.initial}
                        projectKey={projectKey}
                        initialValue={replyTo.initial}
                        placeholder="Reply…  (@ to mention)"
                        submitLabel="Reply"
                        autoFocus
                        onSubmit={(text) =>
                          add.mutateAsync({ body: text, parentId: c.id })
                        }
                        onCancel={() => setReplyTo(null)}
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Composer
        projectKey={projectKey}
        submitLabel="Comment"
        onSubmit={(text) => add.mutateAsync({ body: text })}
      />
    </div>
  );
}

function CommentItem({
  comment,
  projectKey,
  onDelete,
  onReply,
}: {
  comment: CommentDto;
  projectKey: string;
  onDelete: () => void;
  onReply?: () => void;
}) {
  const myId = useAuthStore((s) => s.user?.id);
  const mine = comment.author.id === myId;
  return (
    <div className="group flex gap-2.5">
      <Avatar user={comment.author} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-ink dark:text-gray-100">
            {comment.author.displayName}
          </span>
          <span className="text-xs text-ink-faint">
            {relativeTime(comment.createdAt)}
          </span>
          {mine && (
            <button
              onClick={onDelete}
              title="Delete"
              className="ml-auto text-ink-faint opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="mt-0.5 rounded-lg bg-surface-sunken px-3 py-2 text-sm text-ink-soft dark:bg-gray-800 dark:text-gray-200">
          <MentionText body={comment.body} projectKey={projectKey} />
        </div>
        {onReply && (
          <button
            onClick={onReply}
            className="mt-1 text-xs font-medium text-ink-faint hover:text-brand-600"
          >
            Reply
          </button>
        )}
      </div>
    </div>
  );
}

function Composer({
  projectKey,
  placeholder,
  submitLabel,
  autoFocus,
  initialValue,
  onSubmit,
  onCancel,
}: {
  projectKey: string;
  placeholder?: string;
  submitLabel: string;
  autoFocus?: boolean;
  initialValue?: string;
  onSubmit: (text: string) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initialValue ?? '');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const text = value.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await onSubmit(text);
      setValue('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <MentionInput
        value={value}
        onChange={setValue}
        onSubmit={submit}
        projectKey={projectKey}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} loading={busy} disabled={!value.trim()}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
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
        <ul className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line dark:divide-gray-700 dark:border-gray-700">
          {items.map((c) => {
            const done = doneStatusIds.has(c.statusId);
            return (
              <li key={c.id}>
                <Link
                  to={`/issues/${c.key}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-sunken"
                >
                  <input
                    type="checkbox"
                    checked={done}
                    readOnly
                    className="h-4 w-4 rounded border-line text-brand-600"
                  />
                  <IssueTypeIcon type={c.type} />
                  <span className="font-mono text-[11px] text-ink-faint">
                    {c.key}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate ${done ? 'text-ink-faint line-through' : 'text-ink-soft'}`}
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
        <p className="text-sm text-ink-faint">No subtasks yet.</p>
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
    return <p className="text-sm text-ink-faint">No activity yet.</p>;
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
          <p className="text-ink-muted">
            <span className="font-medium text-ink">
              {a.actor.displayName}
            </span>{' '}
            <ActivityText activity={a} />{' '}
            <span className="text-ink-faint">· {relativeTime(a.createdAt)}</span>
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
        <code className="rounded bg-surface-sunken px-1 text-xs">{oldValue}</code> to{' '}
        <code className="rounded bg-surface-sunken px-1 text-xs">{newValue}</code>
      </>
    );
  }
  if (newValue) {
    return (
      <>
        set <span className="font-medium">{f}</span> to{' '}
        <code className="rounded bg-surface-sunken px-1 text-xs">{newValue}</code>
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
// Links
// ---------------------------------------------------------------------------

const LINK_TYPE_LABEL: Record<LinkType, string> = {
  BLOCKS: 'blocks',
  IS_BLOCKED_BY: 'is blocked by',
  RELATES_TO: 'relates to',
  DUPLICATES: 'duplicates',
  DELIVERS: 'delivers',
  DELIVERED_BY: 'is delivered by',
};

const LINK_TYPES: LinkType[] = [
  'BLOCKS',
  'IS_BLOCKED_BY',
  'RELATES_TO',
  'DUPLICATES',
  'DELIVERS',
  'DELIVERED_BY',
];

function groupLabel(link: IssueLinkDto): string {
  // Display label reflects how the *current* issue relates to the other.
  if (link.direction === 'outward') return LINK_TYPE_LABEL[link.type];
  // Inward: invert the paired relations.
  if (link.type === 'BLOCKS') return LINK_TYPE_LABEL.IS_BLOCKED_BY;
  if (link.type === 'IS_BLOCKED_BY') return LINK_TYPE_LABEL.BLOCKS;
  if (link.type === 'DELIVERS') return LINK_TYPE_LABEL.DELIVERED_BY;
  if (link.type === 'DELIVERED_BY') return LINK_TYPE_LABEL.DELIVERS;
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
        <p className="text-sm text-ink-faint">No linked issues.</p>
      )}

      {[...groups.entries()].map(([label, items]) => (
        <div key={label}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">
            {label}
          </p>
          <ul className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line dark:divide-gray-700 dark:border-gray-700">
            {items.map((l) => (
              <li key={l.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <IssueTypeIcon type={l.issue.type} />
                <Link
                  to={`/issues/${l.issue.key}`}
                  className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
                >
                  <span className="font-mono text-[11px] text-ink-faint">
                    {l.issue.key}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink-soft">
                    {l.issue.title}
                  </span>
                </Link>
                <button
                  onClick={() => remove.mutate(l.id)}
                  className="text-ink-faint hover:text-red-600"
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
        <div className="space-y-2 rounded-lg border border-line bg-surface-sunken p-3 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <div className="w-36 shrink-0">
              <Select
                value={linkType}
                onChange={(e) => setLinkType(e.target.value as LinkType)}
                options={LINK_TYPES.map((t) => ({
                  value: t,
                  label: LINK_TYPE_LABEL[t],
                }))}
              />
            </div>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Search issue…"
              autoFocus
              className={`${inputClass} min-w-0 flex-1`}
            />
          </div>

          {suggestions && suggestions.issues.length > 0 && (
            <ul className="max-h-40 overflow-y-auto scrollbar-thin rounded-md border border-line bg-white">
              {suggestions.issues
                .filter((i) => i.key !== issueKey)
                .map((i) => (
                  <li key={i.id}>
                    <button
                      onClick={() => {
                        setError(null);
                        add.mutate({ type: linkType, targetKey: i.key });
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-sunken"
                    >
                      <IssueTypeIcon type={i.type} />
                      <span className="font-mono text-[11px] text-ink-faint">
                        {i.key}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink-soft">
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
            : 'border-line text-ink-faint'
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
        <p className="flex items-center gap-1.5 text-xs text-ink-faint">
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
    <li className="group relative overflow-hidden rounded-lg border border-line bg-white">
      <button
        onClick={download}
        className="block w-full text-left"
        title={`Download ${attachment.filename}`}
      >
        <div className="flex h-24 items-center justify-center bg-surface-sunken">
          {isImage && blobUrl ? (
            <img
              src={blobUrl}
              alt={attachment.filename}
              className="h-full w-full object-cover"
            />
          ) : (
            <FileText className="h-8 w-8 text-ink-faint" />
          )}
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <Download className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">
            {attachment.filename}
          </span>
          <span className="shrink-0 text-[10px] text-ink-faint">
            {formatBytes(attachment.size)}
          </span>
        </div>
      </button>
      <button
        onClick={onDelete}
        className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded bg-white/90 text-ink-muted shadow-sm hover:text-red-600 group-hover:flex"
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
            : 'border-line bg-white text-ink-muted hover:bg-surface-sunken'
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
        <span className="text-xs text-ink-muted">
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
  projectKey,
  issueKey,
  type,
  onClose,
  children,
}: {
  projectKey: string;
  issueKey: string;
  type?: IssueDetailDto['type'];
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-none items-center border-b border-line px-5 py-3 dark:border-gray-700">
      <div className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-medium text-ink-muted dark:text-gray-400">
        <span className="truncate">{projectKey}</span>
        <span>/</span>
        <a
          href={`/issues/${issueKey}`}
          onClick={(e) => e.preventDefault()}
          title={issueKey}
          className="group inline-flex items-center gap-1.5 font-semibold text-ink hover:text-brand-700 dark:text-gray-100"
        >
          {type && <IssueTypeIcon type={type} />}
          {issueKey}
          <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
        </a>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {children}
        <button
          onClick={onClose}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-line text-ink-faint hover:bg-surface-sunken hover:text-ink-muted dark:border-gray-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom field controls
// ---------------------------------------------------------------------------

function CustomFieldControl({
  issueKey,
  entry,
  users,
}: {
  issueKey: string;
  entry: CustomFieldEntryDto;
  users: UserDto[];
}) {
  const queryClient = useQueryClient();
  const { field, value } = entry;
  const save = useMutation({
    mutationFn: (v: CustomFieldValue) =>
      customFieldsApi.setValue(issueKey, field.id, v),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: qk.issue(issueKey) }),
  });
  const set = (v: CustomFieldValue) => save.mutate(v);

  switch (field.type) {
    case 'TEXT':
    case 'URL':
      return (
        <input
          type={field.type === 'URL' ? 'url' : 'text'}
          defaultValue={(value as string) ?? ''}
          key={String(value)}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== ((value as string) ?? '')) set(v || null);
          }}
          className={inputClass}
          placeholder="—"
        />
      );
    case 'TEXTAREA':
      return (
        <textarea
          defaultValue={(value as string) ?? ''}
          key={String(value)}
          rows={3}
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== ((value as string) ?? '')) set(v || null);
          }}
          className={`${inputClass} resize-y`}
          placeholder="—"
        />
      );
    case 'NUMBER':
      return (
        <input
          type="number"
          defaultValue={value == null ? '' : String(value)}
          key={String(value)}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const next = raw === '' ? null : Number(raw);
            if (next !== ((value as number) ?? null)) set(next);
          }}
          className={inputClass}
          placeholder="—"
        />
      );
    case 'DATE':
      return (
        <input
          type="date"
          defaultValue={value ? String(value).slice(0, 10) : ''}
          key={String(value)}
          onChange={(e) => set(e.target.value || null)}
          className={inputClass}
        />
      );
    case 'CHECKBOX':
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => set(e.target.checked)}
          className="h-4 w-4"
        />
      );
    case 'SELECT':
      return (
        <Select
          value={(value as string) ?? ''}
          onChange={(e) => set(e.target.value || null)}
          options={[
            { value: '', label: '—' },
            ...(field.options ?? []).map((o) => ({ value: o, label: o })),
          ]}
        />
      );
    case 'MULTI_SELECT':
      return (
        <MultiSelectControl
          options={field.options ?? []}
          value={(value as string[]) ?? []}
          onChange={set}
        />
      );
    case 'USER':
      return (
        <AssigneeSelect
          users={users}
          value={(value as string) ?? null}
          onChange={(id) => set(id)}
        />
      );
    default:
      return null;
  }
}

function MultiSelectControl({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[] | null) => void;
}) {
  const toggle = (o: string) => {
    const next = value.includes(o)
      ? value.filter((x) => x !== o)
      : [...value, o];
    onChange(next.length ? next : null);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={
              on
                ? 'rounded-full border border-brand-500 bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                : 'rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-sunken dark:border-gray-600 dark:text-ink-faint dark:hover:bg-gray-700/60'
            }
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Versions + delivery
// ---------------------------------------------------------------------------

function VersionMultiSelect({
  versions,
  value,
  onChange,
}: {
  versions: VersionSummaryDto[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  if (versions.length === 0) {
    return <p className="text-xs text-ink-faint">No versions yet.</p>;
  }
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {versions.map((v) => {
        const on = value.includes(v.id);
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => toggle(v.id)}
            className={
              on
                ? 'rounded-full border border-brand-500 bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                : 'rounded-full border border-line px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-sunken dark:border-gray-600 dark:text-ink-faint dark:hover:bg-gray-700/60'
            }
          >
            {v.name}
          </button>
        );
      })}
    </div>
  );
}

function DeliveryPanel({
  delivery,
  links,
}: {
  delivery: DeliveryRollupDto;
  links: IssueLinkDto[];
}) {
  const deliveryLinks = links.filter(
    (l) => l.type === 'DELIVERS' || l.type === 'DELIVERED_BY',
  );
  const total = delivery.total || 1;
  const w = (n: number) => `${(n / total) * 100}%`;
  const pct = Math.round((delivery.done / total) * 100);
  return (
    <div className="space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-sunken dark:bg-gray-800">
        <div style={{ width: w(delivery.done) }} className="bg-emerald-500" />
        <div style={{ width: w(delivery.inProgress) }} className="bg-blue-400" />
        <div
          style={{ width: w(delivery.todo) }}
          className="bg-gray-300 dark:bg-gray-600"
        />
      </div>
      <p className="text-xs text-ink-muted dark:text-ink-faint">
        {pct}% delivered · {delivery.done}/{delivery.total} done
      </p>
      <ul className="space-y-0.5">
        {deliveryLinks.map((l) => (
          <Link
            key={l.id}
            to={`/issues/${l.issue.key}`}
            className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface-sunken dark:hover:bg-gray-800"
          >
            <IssueTypeIcon type={l.issue.type} />
            <span className="font-mono text-xs text-ink-muted dark:text-ink-faint">
              {l.issue.key}
            </span>
            <span className="truncate text-ink-soft dark:text-gray-200">
              {l.issue.title}
            </span>
          </Link>
        ))}
      </ul>
    </div>
  );
}

function Section({
  label,
  id,
  children,
}: {
  label: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-6 scroll-mt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </h3>
      {children}
    </section>
  );
}

function StatusDot({ category }: { category: StatusDto['category'] }) {
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: STATUS_CATEGORY_META[category].color }}
    />
  );
}

function StatusMenu({
  statuses,
  value,
  onChange,
}: {
  statuses: StatusDto[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = statuses.find((s) => s.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md border border-line bg-white px-2.5 py-1.5 text-left text-sm text-ink hover:border-ink-faint focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        {current && <StatusDot category={current.category} />}
        <span className="min-w-0 flex-1 truncate">{current?.name ?? 'Select status'}</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-line bg-white py-1 shadow-raise dark:border-gray-700 dark:bg-gray-800">
          <div className="max-h-56 overflow-y-auto scrollbar-thin">
            {statuses.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onChange(s.id);
                  setOpen(false);
                }}
                className={clsx(
                  'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm',
                  s.id === value
                    ? 'bg-surface-sunken text-ink dark:bg-gray-700/60 dark:text-gray-100'
                    : 'text-ink-soft hover:bg-surface-sunken dark:text-gray-200 dark:hover:bg-gray-700/60',
                )}
              >
                <StatusDot category={s.category} />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  children,
  align = 'center',
}: {
  label: string;
  children: ReactNode;
  align?: 'center' | 'start';
}) {
  return (
    <div
      className={clsx(
        'flex gap-3 py-[7px]',
        align === 'start' ? 'items-start' : 'items-center',
      )}
    >
      <span
        className={clsx(
          'w-[92px] flex-none text-[11.5px] font-medium text-ink-muted dark:text-gray-400',
          align === 'start' && 'pt-1',
        )}
      >
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
