import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import clsx from 'clsx';
import type { UserDto } from '@tasku/types';
import { Avatar } from '@/components/ui/Avatar';

/**
 * Searchable user picker: a trigger showing the selected user's avatar + name,
 * and a popover with a filter box. Used for every user-valued field (assignee,
 * USER custom fields, …).
 */
export function AssigneeSelect({
  users,
  value,
  onChange,
  allowUnassigned = true,
  placeholder = 'Unassigned',
}: {
  users: UserDto[];
  value: string | null;
  onChange: (userId: string | null) => void;
  allowUnassigned?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = users.find((u) => u.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q),
    );
  }, [users, query]);

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md border border-line bg-white px-2.5 py-1.5 text-left text-sm text-ink hover:border-ink-faint focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        <Avatar user={selected} size="sm" />
        <span
          className={clsx(
            'min-w-0 flex-1 truncate',
            !selected && 'text-ink-faint',
          )}
        >
          {selected ? selected.displayName : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-faint" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-line bg-white shadow-raise dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 border-b border-line-soft px-2.5 py-1.5 dark:border-gray-700">
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people…"
              autoFocus
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint dark:text-gray-100"
            />
          </div>
          <div className="max-h-56 overflow-y-auto scrollbar-thin py-1">
            {allowUnassigned && (
              <Row selected={!value} onClick={() => pick(null)}>
                <Avatar user={null} size="sm" />
                <span className="text-ink-muted">Unassigned</span>
              </Row>
            )}
            {filtered.map((u) => (
              <Row key={u.id} selected={u.id === value} onClick={() => pick(u.id)}>
                <Avatar user={u} size="sm" />
                <span className="min-w-0 flex-1 truncate">{u.displayName}</span>
              </Row>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-ink-faint">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm',
        selected
          ? 'bg-surface-sunken text-ink dark:bg-gray-700/60 dark:text-gray-100'
          : 'text-ink-soft hover:bg-surface-sunken dark:text-gray-200 dark:hover:bg-gray-700/60',
      )}
    >
      {children}
      {selected && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-brand-600" />}
    </button>
  );
}
