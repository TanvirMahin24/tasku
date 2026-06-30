import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Columns3,
  CornerDownLeft,
  ListTodo,
  Search as SearchIcon,
  Users,
  BarChart3,
} from 'lucide-react';
import clsx from 'clsx';
import type { IssueSummaryDto } from '@tasku/types';
import { searchApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { useDebounced } from '@/hooks/useDebounced';
import { IssueTypeIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';

interface QuickAction {
  id: string;
  label: string;
  icon: typeof Columns3;
  to: string;
}

export function CommandPalette({
  open,
  onClose,
  projectKey,
}: {
  open: boolean;
  onClose: () => void;
  projectKey?: string;
}) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const debounced = useDebounced(text, 250);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on open/close.
  useEffect(() => {
    if (open) {
      setText('');
      setActive(0);
    }
  }, [open]);

  const trimmed = debounced.trim();

  const { data, isFetching } = useQuery({
    queryKey: qk.search({ text: trimmed }),
    queryFn: () => searchApi.issues({ text: trimmed }),
    enabled: open && trimmed.length >= 1,
  });

  const issues = data?.issues ?? [];

  const quickActions = useMemo<QuickAction[]>(() => {
    const q = text.trim().toLowerCase();
    const actions: QuickAction[] = [];
    if (projectKey) {
      actions.push(
        { id: 'board', label: 'Go to Board', icon: Columns3, to: `/projects/${projectKey}/board` },
        { id: 'backlog', label: 'Go to Backlog', icon: ListTodo, to: `/projects/${projectKey}/backlog` },
        { id: 'reports', label: 'Go to Reports', icon: BarChart3, to: `/projects/${projectKey}/reports` },
      );
    }
    actions.push(
      { id: 'search', label: 'Open advanced search', icon: SearchIcon, to: '/search' },
      { id: 'teams', label: 'Go to Teams', icon: Users, to: '/teams' },
    );
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [projectKey, text]);

  // Flattened navigable list: issues first, then quick actions.
  const items = useMemo(
    () => [
      ...issues.map((i) => ({ kind: 'issue' as const, issue: i })),
      ...quickActions.map((a) => ({ kind: 'action' as const, action: a })),
    ],
    [issues, quickActions],
  );

  // Keep active index in bounds when results change.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, items.length - 1)));
  }, [items.length]);

  function selectIndex(idx: number) {
    const item = items[idx];
    if (!item) return;
    if (item.kind === 'issue') navigate(`/issues/${item.issue.key}`);
    else navigate(item.action.to);
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectIndex(active);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, items, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll active item into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-[1px] dark:bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 mt-[10vh] w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/10">
        <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 dark:border-gray-700">
          <SearchIcon className="h-4.5 w-4.5 text-gray-400" />
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search issues or jump to…"
            className="w-full bg-transparent py-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-gray-100"
          />
          {isFetching && <Spinner className="h-4 w-4" />}
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto scrollbar-thin py-1.5">
          {issues.length > 0 && (
            <Group label="Issues">
              {issues.map((issue, i) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  active={active === i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => selectIndex(i)}
                  idx={i}
                />
              ))}
            </Group>
          )}

          {quickActions.length > 0 && (
            <Group label="Actions">
              {quickActions.map((a, j) => {
                const idx = issues.length + j;
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    data-idx={idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => selectIndex(idx)}
                    className={clsx(
                      'flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm',
                      active === idx
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                        : 'text-gray-700 dark:text-gray-300',
                    )}
                  >
                    <Icon className="h-4 w-4 text-gray-400" />
                    <span className="flex-1">{a.label}</span>
                    {active === idx && (
                      <CornerDownLeft className="h-3.5 w-3.5 text-gray-400" />
                    )}
                  </button>
                );
              })}
            </Group>
          )}

          {trimmed.length >= 1 && !isFetching && items.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              No results for “{trimmed}”.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400 dark:border-gray-700">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span>navigate</span>
          <Kbd>↵</Kbd>
          <span>open</span>
          <Kbd>esc</Kbd>
          <span>close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-4 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      {children}
    </div>
  );
}

function IssueRow({
  issue,
  active,
  idx,
  onClick,
  onMouseEnter,
}: {
  issue: IssueSummaryDto;
  active: boolean;
  idx: number;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      data-idx={idx}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm',
        active ? 'bg-brand-50 dark:bg-brand-500/15' : '',
      )}
    >
      <IssueTypeIcon type={issue.type} />
      <span className="font-mono text-[11px] text-gray-400">{issue.key}</span>
      <span
        className={clsx(
          'min-w-0 flex-1 truncate',
          active
            ? 'text-brand-800 dark:text-brand-300'
            : 'text-gray-700 dark:text-gray-300',
        )}
      >
        {issue.title}
      </span>
      {active && <CornerDownLeft className="h-3.5 w-3.5 text-gray-400" />}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-sans text-[10px] text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
      {children}
    </kbd>
  );
}
