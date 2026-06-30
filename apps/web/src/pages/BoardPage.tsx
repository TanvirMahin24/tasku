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
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import type {
  BoardDto,
  BoardSummaryDto,
  IssueSummaryDto,
  MoveIssueDto,
} from '@tasku/types';
import { apiErrorMessage, boardsApi, issuesApi, projectsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { STATUS_CATEGORY_META } from '@/lib/format';
import { useProjectSocket } from '@/hooks/useProjectSocket';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
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

  const [activeIssue, setActiveIssue] = useState<IssueSummaryDto | null>(null);
  const [openIssueKey, setOpenIssueKey] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

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

  function findColumnOfDroppable(id: string): number | null {
    if (!board) return null;
    const colByStatus = board.columns.findIndex((c) => c.status.id === id);
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

    let insertAt = destIssues.length;
    if (overId !== targetStatus.id) {
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
    return (
      <>
        <PageHeader title="Board" />
        <PageSpinner label="Loading board…" />
      </>
    );
  }

  if (!board) {
    return (
      <>
        <PageHeader title="Board" />
        <div className="p-6 text-sm text-gray-500">Board not found.</div>
      </>
    );
  }

  const totalIssues = board.columns.reduce((n, c) => n + c.issues.length, 0);
  const currentBoardId = board.board?.id ?? boardId ?? null;
  const currentBoardName = board.board?.name ?? 'Board';

  return (
    <>
      <PageHeader
        title={board.project.name}
        subtitle={
          <span className="flex items-center gap-2">
            <BoardSwitcher
              boards={boards}
              currentBoardId={currentBoardId}
              currentName={currentBoardName}
              onSelect={onSelectBoard}
              onCreate={() => setCreateBoardOpen(true)}
            />
            {board.board?.teamId && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                <span className="h-2 w-2 rounded-full bg-brand-500" />
                Team board
              </span>
            )}
            {board.activeSprint ? (
              <Badge className="bg-green-100 text-green-700">
                {board.activeSprint.name} · active
              </Badge>
            ) : (
              <span className="text-gray-400">No active sprint</span>
            )}
            <span className="text-gray-300">·</span>
            <span>{totalIssues} issues</span>
          </span>
        }
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create issue
          </Button>
        }
      />

      {moveError && (
        <div className="bg-red-50 px-6 py-1.5 text-sm text-red-700">{moveError}</div>
      )}

      <div className="flex-1 overflow-x-auto overflow-y-hidden bg-gray-50 p-4 scrollbar-thin">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex h-full min-h-0 gap-3">
            {board.columns.map((column) => (
              <BoardColumn
                key={column.status.id}
                statusId={column.status.id}
                name={column.status.name}
                category={column.status.category}
                issues={column.issues}
                onCardClick={(issueKey) => setOpenIssueKey(issueKey)}
              />
            ))}
            {board.columns.length === 0 && (
              <p className="text-sm text-gray-400">
                This project has no workflow statuses.
              </p>
            )}
          </div>

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
// Board switcher
// ---------------------------------------------------------------------------

function BoardSwitcher({
  boards,
  currentBoardId,
  currentName,
  onSelect,
  onCreate,
}: {
  boards: BoardSummaryDto[];
  currentBoardId: string | null;
  currentName: string;
  onSelect: (board: BoardSummaryDto) => void;
  onCreate: () => void;
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
        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        {currentName}
        <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-8 z-30 w-56 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-xl">
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {boards.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">No boards</p>
            ) : (
              boards.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    onSelect(b);
                    setOpen(false);
                  }}
                  className={clsx(
                    'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50',
                    (b.id === currentBoardId || (b.isDefault && !currentBoardId))
                      ? 'font-semibold text-brand-700'
                      : 'text-gray-700',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{b.name}</span>
                    {b.isDefault && (
                      <span className="rounded bg-gray-100 px-1 text-[10px] font-medium text-gray-500">
                        default
                      </span>
                    )}
                  </span>
                  {b.id === currentBoardId && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                  )}
                </button>
              ))
            )}
          </div>
          <button
            onClick={() => {
              onCreate();
              setOpen(false);
            }}
            className="mt-1 flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-sm font-medium text-brand-600 hover:bg-gray-50"
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
  statusId,
  name,
  category,
  issues,
  onCardClick,
}: {
  statusId: string;
  name: string;
  category: BoardDto['columns'][number]['status']['category'];
  issues: IssueSummaryDto[];
  onCardClick: (issueKey: string) => void;
}) {
  const meta = STATUS_CATEGORY_META[category];
  const { setNodeRef, isOver } = useDroppable({ id: statusId });

  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-lg bg-gray-100/80">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: meta.color }}
          />
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            {name}
          </span>
        </div>
        <span className="rounded-full bg-gray-200 px-1.5 text-[11px] font-semibold text-gray-500">
          {issues.length}
        </span>
      </div>

      <SortableContext
        items={issues.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={clsx(
            'flex-1 space-y-2 overflow-y-auto px-2 pb-2 scrollbar-thin transition-colors',
            isOver && 'bg-brand-50/60',
          )}
        >
          {issues.map((issue) => (
            <SortableIssueCard
              key={issue.id}
              issue={issue}
              onClick={() => onCardClick(issue.key)}
            />
          ))}
          {issues.length === 0 && (
            <div className="rounded-md border border-dashed border-gray-300 py-6 text-center text-xs text-gray-400">
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
