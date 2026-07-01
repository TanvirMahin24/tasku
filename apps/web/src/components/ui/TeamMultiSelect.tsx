import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import clsx from 'clsx';
import type { TeamSummaryDto } from '@tasku/types';
import { useAnchoredPopover } from '@/components/ui/useAnchoredPopover';

/**
 * Multi-select team picker with search. Trigger shows the selected teams as
 * colored chips; the popover is portaled + fixed-positioned so it escapes
 * overflow-clipped containers (the issue-drawer details card, modals, …).
 */
export function TeamMultiSelect({
  teams,
  value,
  onChange,
  placeholder = 'No teams',
}: {
  teams: TeamSummaryDto[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { triggerRef, popoverRef, coords } = useAnchoredPopover<HTMLButtonElement>(
    open,
    () => setOpen(false),
  );
  const selected = teams.filter((t) => value.includes(t.id));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? teams.filter((t) => t.name.toLowerCase().includes(q)) : teams;
  }, [teams, query]);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-md border border-line bg-white px-2 py-1.5 text-left text-sm text-ink hover:border-ink-faint focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1">
          {selected.length === 0 ? (
            <span className="text-ink-faint">{placeholder}</span>
          ) : (
            selected.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-soft dark:bg-white/10 dark:text-gray-200"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                {t.name}
              </span>
            ))
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-faint" />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ position: 'fixed', ...coords }}
            className="z-[60] flex flex-col overflow-hidden rounded-md border border-line bg-white shadow-raise dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-line-soft px-2.5 py-1.5 dark:border-gray-700">
              <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teams…"
                autoFocus
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint dark:text-gray-100"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin py-1">
              {filtered.map((t) => {
                const on = value.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t.id)}
                    className={clsx(
                      'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm',
                      on
                        ? 'text-ink dark:text-gray-100'
                        : 'text-ink-soft hover:bg-surface-sunken dark:text-gray-200 dark:hover:bg-gray-700/60',
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    {on && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                    )}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-sm text-ink-faint">No teams</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
