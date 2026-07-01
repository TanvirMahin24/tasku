import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ISSUE_TYPES, PRIORITIES, type CreateIssueDto } from '@tasku/types';
import { apiErrorMessage, issuesApi, teamsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { ISSUE_TYPE_META, PRIORITY_META } from '@/lib/format';
import { useProjectMeta } from '@/hooks/useProjectMeta';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select, inputClass } from '@/components/ui/Select';
import { AssigneeSelect } from '@/components/ui/AssigneeSelect';
import { LabelPicker } from '@/components/ui/LabelPicker';
import { IssueTypeIcon } from '@/components/ui/icons';

export function CreateIssueModal({
  projectKey,
  open,
  onClose,
  defaultSprintId,
  onCreated,
}: {
  projectKey: string;
  open: boolean;
  onClose: () => void;
  /** Pre-select a sprint ('backlog' for none). */
  defaultSprintId?: string;
  onCreated?: (issueKey: string) => void;
}) {
  const queryClient = useQueryClient();
  const { sprints, labels, users } = useProjectMeta(projectKey);
  const { data: teams = [] } = useQuery({
    queryKey: qk.teams,
    queryFn: teamsApi.list,
    enabled: open,
  });

  const [type, setType] = useState<CreateIssueDto['type']>('TASK');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<CreateIssueDto['priority']>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [sprintId, setSprintId] = useState<string>(defaultSprintId ?? 'backlog');
  const [storyPoints, setStoryPoints] = useState<string>('');
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [teamId, setTeamId] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setType('TASK');
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setAssigneeId(null);
    setSprintId(defaultSprintId ?? 'backlog');
    setStoryPoints('');
    setLabelIds([]);
    setTeamId('');
    setDueDate('');
    setError(null);
  }

  const create = useMutation({
    mutationFn: (dto: CreateIssueDto) => issuesApi.create(projectKey, dto),
    onSuccess: (issue) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectKey, 'board'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectKey, 'issues'] });
      reset();
      onClose();
      onCreated?.(issue.key);
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not create issue')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    const points = storyPoints.trim() === '' ? undefined : Number(storyPoints);
    create.mutate({
      type,
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      assigneeId: assigneeId ?? undefined,
      sprintId: sprintId === 'backlog' ? undefined : sprintId,
      storyPoints: Number.isFinite(points) ? points : undefined,
      labelIds: labelIds.length ? labelIds : undefined,
      teamId: teamId || undefined,
      dueDate: dueDate || undefined,
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
      title="Create issue"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={create.isPending}>
            Cancel
          </Button>
          <Button form="create-issue-form" type="submit" loading={create.isPending}>
            Create
          </Button>
        </>
      }
    >
      <form id="create-issue-form" onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Issue type">
            <div className="flex items-center gap-2">
              <IssueTypeIcon type={type} />
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as CreateIssueDto['type'])}
                options={ISSUE_TYPES.map((t) => ({
                  value: t,
                  label: ISSUE_TYPE_META[t].label,
                }))}
              />
            </div>
          </FormRow>
          <FormRow label="Priority">
            <Select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as CreateIssueDto['priority'])
              }
              options={PRIORITIES.map((p) => ({
                value: p,
                label: PRIORITY_META[p].label,
              }))}
            />
          </FormRow>
        </div>

        <FormRow label="Title" required>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            autoFocus
          />
        </FormRow>

        <FormRow label="Description">
          <textarea
            className={`${inputClass} min-h-[96px] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add more detail…"
          />
        </FormRow>

        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Assignee">
            <AssigneeSelect
              users={users}
              value={assigneeId}
              onChange={setAssigneeId}
            />
          </FormRow>
          <FormRow label="Sprint">
            <Select
              value={sprintId}
              onChange={(e) => setSprintId(e.target.value)}
              options={[
                { value: 'backlog', label: 'Backlog' },
                ...sprints
                  .filter((s) => s.state !== 'CLOSED')
                  .map((s) => ({
                    value: s.id,
                    label: s.state === 'ACTIVE' ? `${s.name} (active)` : s.name,
                  })),
              ]}
            />
          </FormRow>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Story points">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={storyPoints}
              onChange={(e) => setStoryPoints(e.target.value)}
              placeholder="—"
            />
          </FormRow>
          <FormRow label="Labels">
            <LabelPicker
              labels={labels}
              selectedIds={labelIds}
              onChange={setLabelIds}
            />
          </FormRow>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Team">
            <Select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="No team"
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
            />
          </FormRow>
          <FormRow label="Due date">
            <input
              type="date"
              className={inputClass}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </FormRow>
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

function FormRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
