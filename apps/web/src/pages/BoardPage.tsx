import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import {
  Check,
  ChevronsUpDown,
  Plus,
  Rows3,
  Star,
  Tag,
  User,
} from 'lucide-react';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import type {
  BoardDto,
  BoardSummaryDto,
  BoardSwimlane,
  IssueSummaryDto,
  MoveIssueDto,
  StatusDto,
} from '@tasku/types';
import {
  apiErrorMessage,
  boardsApi,
  issuesApi,
  projectsApi,
} from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { PRIORITY_META, STATUS_CATEGORY_META } from '@/lib/format';
import { useProjectSocket } from '@/hooks/useProjectSocket';
import { useAuthStore } from '@/store/auth';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { Badge, LabelBadge } from '@/components/ui/Badge';
import { IssueCardContent } from '@/components/IssueCard';
import { IssueDrawer } from '@/components/IssueDrawer';
import { CreateIssueModal } from '@/components/CreateIssueModal';
import { CreateBoardModal } from '@/components/CreateBoardModal';

export default function BoardPage() {
  const { key = '', boardId } = useParams<{ key: string; boardId?: string }>();
  return (
    <BoardView key={`${key}:${boardId ?? 'default'}`} projectKey={key} boardId={boardId} />
  );
}

// ---------------------------------------------------------------------------
// Swimlanes
// ---------------------------------------------------------------------------

const SWIMLANE_LABEL: Record<BoardSwimlane, string> = {
  NONE: 'No swimlanes',
  ASSIGNEE: 'By assignee',
  EPIC: 'By epic',
  TEAM: 'By team',
  PRIORITY: 'By priority',
};

const SWIMLANE_OPTIONS: BoardSwimlane[] = [
  'NONE',
  'ASSIGNEE',
  'TEAM',
  'PRIORITY',
  'EPIC',
];

interface Lane {
  id: string;
  title: string;
}

/** Resolve which lane an issue belongs to for a given grouping. */
function laneKeyFor(issue: IssueSummaryDto, by: BoardSwimlane): string {
  switch (by) {
    case 'ASSIGNEE':
      return issue.assignee?.id ?? '__none__';
    case 'TEAM':
      // Group by the issue's first team (an issue can now have several).
      return issue.teams[0]?.id ?? '__none__';
    case 'PRIORITY':
      return issue.priority;
    case 'EPIC':
      return issue.parentId ?? '__none__';
    default:
      return '__all__';
  }
}

function buildLanes(board: BoardDto, by: BoardSwimlane): Lane[] {
  if (by === 'NONE') return [{ id: '__all__', title: '' }];

  if (by === 'PRIORITY') {
    // Stable, meaningful ordering for priority lanes.
    const order: IssueSummaryDto['priority'][] = [
      'HIGHEST',
      'HIGH',
      'MEDIUM',
      'LOW',
      'LOWEST',
    ];
    return order.map((p) => ({ id: p, title: PRIORITY_META[p].label }));
  }

  // Collect distinct lane keys from the issues, preserving a useful title.
  const titles = new Map<string, string>();
  for (const col of board.columns) {
    for (const issue of col.issues) {
      const k = laneKeyFor(issue, by);
      if (titles.has(k)) continue;
      if (by === 'ASSIGNEE') {
        titles.set(k, issue.assignee?.displayName ?? 'Unassigned');
      } else if (by === 'TEAM') {
        titles.set(k, issue.teams[0]?.name ?? 'No team');
      } else if (by === 'EPIC') {
        titles.set(k, issue.parentId ? `Epic ${issue.parentId.slice(0, 6)}` : 'No epic');
      }
    }
  }
  const lanes = [...titles.entries()].map(([id, title]) => ({ id, title }));
  // Push the "none" lane to the end.
  lanes.sort((a, b) => {
    if (a.id === '__none__') return 1;
    if (b.id === '__none__') return -1;
    return a.title.localeCompare(b.title);
  });
  return lanes.length ? lanes : [{ id: '__all__', title: '' }];
}

// ---------------------------------------------------------------------------
// Quick filters
// ---------------------------------------------------------------------------

interface QuickFilter {
  assigneeIds: Set<string>;
  labelIds: Set<string>;
  myIssues: boolean;
}

function matchesFilter(
  issue: IssueSummaryDto,
  filter: QuickFilter,
  currentUserId: string | undefined,
): boolean {
  if (filter.myIssues && issue.assignee?.id !== currentUserId) return false;
  if (filter.assigneeIds.size > 0) {
    const id = issue.assignee?.id ?? '__none__';
    if (!filter.assigneeIds.has(id)) return false;
  }
  if (filter.labelIds.size > 0) {
    if (!issue.labels.some((l) => filter.labelIds.has(l.id))) return false;
  }
  return true;
}

function BoardView({
  projectKey: key,
  boardId,
}: {
  projectKey: string;
  boardId?: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  useProjectSocket(key);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [activeIssue, setActiveIssue] = useState<IssueSummaryDto | null>(null);
  const [openIssueKey, setOpenIssueKey] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Quick filter state (client-side only).
  const [filter, setFilter] = useState<QuickFilter>({
    assigneeIds: new Set(),
    labelIds: new Set(),
    myIssues: false,
  });

  const boardQueryKey: QueryKey = boardId
    ? qk.boardById(boardId)
    : qk.board(key);

  const { data: board, isLoading } = useQuery({
    queryKey: boardQueryKey,
    queryFn: () => (boardId ? boardsApi.get(boardId) : projectsApi.board(key)),
    enabled: !!key,
  });

  const { data: boards = [] } = useQuery({
    queryKey: qk.boards(key),
    queryFn: () => boardsApi.list(key),
    enabled: !!key,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const swimlaneBy: BoardSwimlane = board?.board?.swimlaneBy ?? 'NONE';

  const updateBoard = useMutation({
    mutationFn: (next: BoardSwimlane) => {
      const id = board?.board?.id;
      if (!id) return Promise.reject(new Error('Default board cannot be configured.'));
      return boardsApi.update(id, { swimlaneBy: next });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKey });
      queryClient.invalidateQueries({ queryKey: qk.boards(key) });
    },
    onError: (err) => setMoveError(apiErrorMessage(err, 'Could not update board')),
  });

  const toggleStar = useMutation({
    mutationFn: (b: BoardSummaryDto) =>
      b.isStarred ? boardsApi.unstar(b.id) : boardsApi.star(b.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.boards(key) });
    },
    onError: (err) => setMoveError(apiErrorMessage(err, 'Could not update star')),
  });

  const move = useMutation({
    mutationFn: ({ issueKey, dto }: { issueKey: string; dto: MoveIssueDto }) =>
      issuesApi.move(issueKey, dto),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKey });
      queryClient.invalidateQueries({ queryKey: ['project', key, 'issues'] });
    },
    onError: (err) => setMoveError(apiErrorMessage(err, 'Could not move issue')),
  });

  const issueIndex = useMemo(() => {
    const map = new Map<string, { col: number; issue: IssueSummaryDto }>();
    board?.columns.forEach((c, col) =>
      c.issues.forEach((issue) => map.set(issue.id, { col, issue })),
    );
    return map;
  }, [board]);

  // Distinct assignees / labels available for the quick filter bar.
  const { assignees, labels } = useMemo(() => {
    const aMap = new Map<string, NonNullable<IssueSummaryDto['assignee']>>();
    const lMap = new Map<string, IssueSummaryDto['labels'][number]>();
    board?.columns.forEach((c) =>
      c.issues.forEach((i) => {
        if (i.assignee) aMap.set(i.assignee.id, i.assignee);
        i.labels.forEach((l) => lMap.set(l.id, l));
      }),
    );
    return {
      assignees: [...aMap.values()],
      labels: [...lMap.values()],
    };
  }, [board]);

  const filterActive =
    filter.myIssues || filter.assigneeIds.size > 0 || filter.labelIds.size > 0;

  function findColumnOfDroppable(id: string): number | null {
    if (!board) return null;
    // Swimlane columns use "<laneId>::<statusId>" droppable ids; strip the lane.
    const statusId = id.includes('::') ? id.split('::')[1] : id;
    const colByStatus = board.columns.findIndex((c) => c.status.id === statusId);
    if (colByStatus !== -1) return colByStatus;
    const entry = issueIndex.get(id);
    return entry ? entry.col : null;
  }

  function onDragStart(event: DragStartEvent) {
    const entry = issueIndex.get(String(event.active.id));
    setActiveIssue(entry?.issue ?? null);
    setMoveError(null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveIssue(null);
    const { active, over } = event;
    if (!over || !board) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeEntry = issueIndex.get(activeId);
    const fromCol = activeEntry?.col;
    const toCol = findColumnOfDroppable(overId);
    if (fromCol == null || toCol == null || !activeEntry) return;

    const targetStatus = board.columns[toCol].status;
    const destIssues = board.columns[toCol].issues.filter(
      (i) => i.id !== activeId,
    );

    // Did we drop onto a column body (status droppable) or onto a card?
    const overStatusId = overId.includes('::') ? overId.split('::')[1] : overId;
    let insertAt = destIssues.length;
    if (overStatusId !== targetStatus.id) {
      const overIdx = destIssues.findIndex((i) => i.id === overId);
      if (overIdx !== -1) insertAt = overIdx;
    }

    const beforeId = destIssues[insertAt - 1]?.id ?? null;
    const afterId = destIssues[insertAt]?.id ?? null;

    queryClient.setQueryData<BoardDto>(boardQueryKey, (prev) => {
      if (!prev) return prev;
      const columns = prev.columns.map((c) => ({
        ...c,
        issues: [...c.issues],
      }));
      const src = columns[fromCol].issues;
      const idx = src.findIndex((i) => i.id === activeId);
      if (idx === -1) return prev;
      const [moved] = src.splice(idx, 1);
      const updated = { ...moved, statusId: targetStatus.id };
      const dest = columns[toCol].issues;
      const insertIndex = afterId
        ? dest.findIndex((i) => i.id === afterId)
        : dest.length;
      dest.splice(insertIndex === -1 ? dest.length : insertIndex, 0, updated);
      return { ...prev, columns };
    });

    move.mutate({
      issueKey: activeEntry.issue.key,
      dto: { statusId: targetStatus.id, beforeId, afterId },
    });
  }

  function onSelectBoard(b: BoardSummaryDto) {
    if (b.isDefault) navigate(`/projects/${key}/board`);
    else navigate(`/projects/${key}/boards/${b.id}`);
  }

  if (isLoading) {
    return <PageSpinner label="Loading board…" />;
  }

  if (!board) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
        Board not found.
      </div>
    );
  }

  const totalIssues = board.columns.reduce((n, c) => n + c.issues.length, 0);
  const currentBoardId = board.board?.id ?? boardId ?? null;
  const currentBoardName = board.board?.name ?? 'Board';
  const canConfigureSwimlanes = !!board.board?.id; // default board has no row to PATCH

  const lanes = buildLanes(board, swimlaneBy);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-6 py-2.5 dark:border-gray-800 dark:bg-gray-900">
        <span className="flex items-center gap-2 text-sm text-ink-muted dark:text-gray-400">
          <BoardSwitcher
            boards={boards}
            currentBoardId={currentBoardId}
            currentName={currentBoardName}
            onSelect={onSelectBoard}
            onCreate={() => setCreateBoardOpen(true)}
            onToggleStar={(b) => toggleStar.mutate(b)}
          />
          {board.board?.teamId && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              <span className="h-2 w-2 rounded-full bg-brand-500" />
              Team board
            </span>
          )}
          {board.activeSprint ? (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300">
              {board.activeSprint.name} · active
            </Badge>
          ) : (
            <span className="text-gray-400">No active sprint</span>
          )}
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span>{totalIssues} issues</span>
        </span>
        <div className="flex items-center gap-2">
          <SwimlaneControl
            value={swimlaneBy}
            disabled={!canConfigureSwimlanes || updateBoard.isPending}
            onChange={(v) => updateBoard.mutate(v)}
          />
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create issue
          </Button>
        </div>
      </div>

      <QuickFilterBar
        assignees={assignees}
        labels={labels}
        filter={filter}
        active={filterActive}
        onChange={setFilter}
      />

      {moveError && (
        <div className="bg-red-50 px-6 py-1.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {moveError}
        </div>
      )}

      <div className="flex-1 overflow-auto bg-surface-page p-4 scrollbar-thin dark:bg-gray-950">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          {board.columns.length === 0 ? (
            <p className="text-sm text-gray-400">
              This project has no workflow statuses.
            </p>
          ) : swimlaneBy === 'NONE' ? (
            <div className="flex h-full min-h-0 gap-3">
              {board.columns.map((column) => (
                <BoardColumn
                  key={column.status.id}
                  status={column.status}
                  issues={column.issues.filter((i) =>
                    matchesFilter(i, filter, currentUserId),
                  )}
                  fullCount={column.issues.length}
                  onCardClick={(issueKey) => setOpenIssueKey(issueKey)}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-w-fit flex-col gap-4">
              {lanes.map((lane) => {
                const laneColumns = board.columns.map((c) => ({
                  status: c.status,
                  issues: c.issues.filter(
                    (i) =>
                      laneKeyFor(i, swimlaneBy) === lane.id &&
                      matchesFilter(i, filter, currentUserId),
                  ),
                }));
                const laneTotal = laneColumns.reduce(
                  (n, c) => n + c.issues.length,
                  0,
                );
                return (
                  <div key={lane.id}>
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <Rows3 className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        {lane.title}
                      </span>
                      <span className="rounded-full bg-gray-200 px-1.5 text-[11px] font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                        {laneTotal}
                      </span>
                    </div>
                    <div className="flex gap-3">
                      {laneColumns.map((column) => (
                        <BoardColumn
                          key={column.status.id}
                          status={column.status}
                          droppableId={`${lane.id}::${column.status.id}`}
                          issues={column.issues}
                          fullCount={
                            board.columns.find(
                              (c) => c.status.id === column.status.id,
                            )?.issues.length ?? column.issues.length
                          }
                          laned
                          onCardClick={(issueKey) => setOpenIssueKey(issueKey)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <DragOverlay>
            {activeIssue ? (
              <div className="w-72">
                <IssueCardContent issue={activeIssue} dragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <CreateIssueModal
        projectKey={key}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultSprintId={board.activeSprint?.id}
        onCreated={(issueKey) => setOpenIssueKey(issueKey)}
      />

      <CreateBoardModal
        projectKey={key}
        open={createBoardOpen}
        onClose={() => setCreateBoardOpen(false)}
        onCreated={(id) => navigate(`/projects/${key}/boards/${id}`)}
      />

      <IssueDrawer
        projectKey={key}
        issueKey={openIssueKey}
        open={!!openIssueKey}
        onClose={() => setOpenIssueKey(null)}
        onDeleted={() => setOpenIssueKey(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Swimlane control
// ---------------------------------------------------------------------------

function SwimlaneControl({
  value,
  disabled,
  onChange,
}: {
  value: BoardSwimlane;
  disabled?: boolean;
  onChange: (v: BoardSwimlane) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={
          disabled
            ? 'Swimlanes are available on custom boards'
            : 'Group into swimlanes'
        }
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px] font-medium text-ink-soft hover:bg-surface-page disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        <Rows3 className="h-4 w-4 text-ink-faint" />
        {SWIMLANE_LABEL[value]}
        <ChevronsUpDown className="h-3.5 w-3.5 text-ink-faint" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-30 w-48 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800">
          {SWIMLANE_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={clsx(
                'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/60',
                opt === value
                  ? 'font-semibold text-brand-700 dark:text-brand-300'
                  : 'text-gray-700 dark:text-gray-200',
              )}
            >
              {SWIMLANE_LABEL[opt]}
              {opt === value && <Check className="h-3.5 w-3.5 text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick filter bar
// ---------------------------------------------------------------------------

function QuickFilterBar({
  assignees,
  labels,
  filter,
  active,
  onChange,
}: {
  assignees: NonNullable<IssueSummaryDto['assignee']>[];
  labels: IssueSummaryDto['labels'];
  filter: QuickFilter;
  active: boolean;
  onChange: (next: QuickFilter) => void;
}) {
  function toggleAssignee(id: string) {
    const next = new Set(filter.assigneeIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange({ ...filter, assigneeIds: next });
  }
  function toggleLabel(id: string) {
    const next = new Set(filter.labelIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange({ ...filter, labelIds: next });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-white px-6 py-2 dark:border-gray-700 dark:bg-gray-900">
      <button
        onClick={() => onChange({ ...filter, myIssues: !filter.myIssues })}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
          filter.myIssues
            ? 'border-brand-600 bg-brand-50 font-semibold text-brand-600 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-300'
            : 'border-line bg-white text-ink-soft hover:bg-surface-page dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
        )}
      >
        <User className="h-3.5 w-3.5" /> My issues
      </button>

      {assignees.length > 0 && (
        <div className="flex items-center gap-1">
          {assignees.map((u) => {
            const on = filter.assigneeIds.has(u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggleAssignee(u.id)}
                title={u.displayName}
                className={clsx(
                  'rounded-full ring-2 transition-all',
                  on
                    ? 'ring-brand-500'
                    : 'opacity-60 ring-transparent hover:opacity-100',
                )}
              >
                <Avatar user={u} size="sm" />
              </button>
            );
          })}
        </div>
      )}

      {labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <Tag className="h-3.5 w-3.5 text-gray-400" />
          {labels.map((l) => {
            const on = filter.labelIds.has(l.id);
            return (
              <button
                key={l.id}
                onClick={() => toggleLabel(l.id)}
                className={clsx(
                  'rounded transition-opacity',
                  on ? 'ring-2 ring-brand-500' : 'opacity-60 hover:opacity-100',
                )}
              >
                <LabelBadge label={l} />
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <button
          onClick={() =>
            onChange({
              assigneeIds: new Set(),
              labelIds: new Set(),
              myIssues: false,
            })
          }
          className="ml-auto text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board switcher
// ---------------------------------------------------------------------------

function BoardSwitcher({
  boards,
  currentBoardId,
  currentName,
  onSelect,
  onCreate,
  onToggleStar,
}: {
  boards: BoardSummaryDto[];
  currentBoardId: string | null;
  currentName: string;
  onSelect: (board: BoardSummaryDto) => void;
  onCreate: () => void;
  onToggleStar: (board: BoardSummaryDto) => void;
}) {
  // Default board first, then starred, then the rest.
  const ordered = [...boards].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
    return 0;
  });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-0.5 text-sm font-medium text-ink-soft hover:bg-surface-page dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        {currentName}
        <ChevronsUpDown className="h-3.5 w-3.5 text-ink-faint" />
      </button>

      {open && (
        <div className="absolute left-0 top-8 z-30 w-56 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800">
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {ordered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">No boards</p>
            ) : (
              ordered.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center hover:bg-gray-50 dark:hover:bg-gray-700/60"
                >
                  <button
                    onClick={() => {
                      onSelect(b);
                      setOpen(false);
                    }}
                    className={clsx(
                      'flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-1.5 text-left text-sm',
                      b.id === currentBoardId || (b.isDefault && !currentBoardId)
                        ? 'font-semibold text-brand-700 dark:text-brand-300'
                        : 'text-gray-700 dark:text-gray-200',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{b.name}</span>
                      {b.isDefault && (
                        <span className="rounded bg-gray-100 px-1 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                          default
                        </span>
                      )}
                    </span>
                    {b.id === currentBoardId && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                    )}
                  </button>
                  <button
                    onClick={() => onToggleStar(b)}
                    title={b.isStarred ? 'Unstar board' : 'Star board'}
                    aria-label={b.isStarred ? 'Unstar board' : 'Star board'}
                    className="px-2 py-1.5 text-gray-300 hover:text-amber-500"
                  >
                    <Star
                      className={clsx(
                        'h-3.5 w-3.5',
                        b.isStarred && 'fill-amber-400 text-amber-400',
                      )}
                    />
                  </button>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => {
              onCreate();
              setOpen(false);
            }}
            className="mt-1 flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-sm font-medium text-brand-600 hover:bg-gray-50 dark:border-gray-700 dark:text-brand-300 dark:hover:bg-gray-700/60"
          >
            <Plus className="h-4 w-4" /> New board
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

function BoardColumn({
  status,
  issues,
  fullCount,
  laned,
  droppableId,
  onCardClick,
}: {
  status: StatusDto;
  issues: IssueSummaryDto[];
  /** Unfiltered count in this status — what the WIP limit is measured against. */
  fullCount: number;
  laned?: boolean;
  /** Unique droppable id (lane-prefixed in swimlane mode). Defaults to status.id. */
  droppableId?: string;
  onCardClick: (issueKey: string) => void;
}) {
  const meta = STATUS_CATEGORY_META[status.category];
  // dnd-kit needs unique droppable ids; suffix lane columns so they don't clash.
  const { setNodeRef, isOver } = useDroppable({ id: droppableId ?? status.id });

  const overLimit = status.wipLimit != null && fullCount > status.wipLimit;

  return (
    <div
      className={clsx(
        'flex w-72 shrink-0 flex-col rounded-[10px] bg-surface-sunken transition-colors dark:bg-gray-900/70',
        laned ? 'min-h-[7rem]' : 'h-full',
        isOver && 'bg-brand-50 ring-2 ring-brand-300 dark:bg-brand-500/10',
      )}
    >
      <div className="flex items-center justify-between rounded-t-[10px] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: meta.color }}
          />
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-gray-300">
            {status.name}
          </span>
          <span className="text-xs font-semibold text-ink-faint dark:text-gray-400">
            {issues.length}
          </span>
        </div>
        {status.wipLimit != null && (
          <span
            className={clsx(
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
              overLimit
                ? 'bg-[#FFECEB] text-[#C9372C]'
                : 'bg-[#DCFFF1] text-[#22A06B]',
            )}
            title={`${fullCount} of WIP limit ${status.wipLimit}`}
          >
            {fullCount} / {status.wipLimit}
          </span>
        )}
      </div>

      <SortableContext
        items={issues.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className="flex-1 space-y-2 overflow-y-auto px-2 pb-2 scrollbar-thin"
        >
          {issues.map((issue) => (
            <SortableIssueCard
              key={issue.id}
              issue={issue}
              onClick={() => onCardClick(issue.key)}
            />
          ))}
          {issues.length === 0 && (
            <div className="rounded-md border border-dashed border-line py-6 text-center text-xs text-ink-faint dark:border-gray-700">
              Drop issues here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableIssueCard({
  issue,
  onClick,
}: {
  issue: IssueSummaryDto;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-grab touch-none active:cursor-grabbing"
    >
      <IssueCardContent issue={issue} />
    </div>
  );
}
