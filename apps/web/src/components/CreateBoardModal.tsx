import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ISSUE_TYPES,
  PRIORITIES,
  type BoardFilter,
  type BoardType,
  type CreateBoardDto,
  type IssueType,
  type Priority,
} from '@tasku/types';
import { apiErrorMessage, boardsApi, teamsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { ISSUE_TYPE_META, PRIORITY_META } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select, inputClass } from '@/components/ui/Select';
import { Chip } from '@/components/ui/Chip';

export function CreateBoardModal({
  projectKey,
  open,
  onClose,
  onCreated,
}: {
  projectKey: string;
  open: boolean;
  onClose: () => void;
  onCreated?: (boardId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data: teams = [] } = useQuery({
    queryKey: qk.teams,
    queryFn: teamsApi.list,
    enabled: open,
  });

  const [name, setName] = useState('');
  const [type, setType] = useState<BoardType>('KANBAN');
  const [teamId, setTeamId] = useState('');
  const [types, setTypes] = useState<IssueType[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName('');
    setType('KANBAN');
    setTeamId('');
    setTypes([]);
    setPriorities([]);
    setError(null);
  }

  const create = useMutation({
    mutationFn: (dto: CreateBoardDto) => boardsApi.create(projectKey, dto),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: qk.boards(projectKey) });
      reset();
      onClose();
      onCreated?.(board.id);
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not create board')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const filter: BoardFilter = {};
    if (types.length) filter.types = types;
    if (priorities.length) filter.priorities = priorities;
    create.mutate({
      name: name.trim(),
      type,
      teamId: teamId || null,
      filter: Object.keys(filter).length ? filter : undefined,
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
      title="New board"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={create.isPending}>
            Cancel
          </Button>
          <Button form="create-board-form" type="submit" loading={create.isPending}>
            Create
          </Button>
        </>
      }
    >
      <form id="create-board-form" onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </span>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sprint board"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Type
            </span>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as BoardType)}
              options={[
                { value: 'KANBAN', label: 'Kanban' },
                { value: 'SCRUM', label: 'Scrum' },
              ]}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Team filter
          </span>
          <Select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            placeholder="All teams"
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
          />
        </label>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-gray-700">
            Issue types
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ISSUE_TYPES.map((t) => (
              <Chip
                key={t}
                active={types.includes(t)}
                onClick={() =>
                  setTypes((prev) =>
                    prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
                  )
                }
              >
                {ISSUE_TYPE_META[t].label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-gray-700">
            Priorities
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map((p) => (
              <Chip
                key={p}
                active={priorities.includes(p)}
                onClick={() =>
                  setPriorities((prev) =>
                    prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
                  )
                }
              >
                {PRIORITY_META[p].label}
              </Chip>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
