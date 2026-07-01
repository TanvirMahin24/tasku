import { useEffect, useRef, useState } from 'react';
import { Check, Plus, Tag } from 'lucide-react';
import clsx from 'clsx';
import type { LabelDto } from '@tasku/types';
import { LabelBadge } from '@/components/ui/Badge';

export function LabelPicker({
  labels,
  selectedIds,
  onChange,
}: {
  labels: LabelDto[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
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

  const selected = labels.filter((l) => selectedIds.includes(l.id));

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[34px] w-full flex-wrap items-center gap-1.5 rounded-md border border-line dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-left hover:border-ink-faint focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {selected.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-faint">
            <Plus className="h-3.5 w-3.5" /> Add labels
          </span>
        ) : (
          selected.map((l) => <LabelBadge key={l.id} label={l} />)
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-line dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-raise">
          {labels.length === 0 ? (
            <p className="flex items-center gap-1.5 px-3 py-2 text-sm text-ink-faint">
              <Tag className="h-3.5 w-3.5" /> No labels in this project
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto scrollbar-thin">
              {labels.map((l) => {
                const isSel = selectedIds.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggle(l.id)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-surface-sunken dark:hover:bg-gray-700/60"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: l.color }}
                      />
                      <span className="text-ink-soft dark:text-gray-200">{l.name}</span>
                    </span>
                    <Check
                      className={clsx(
                        'h-4 w-4 text-brand-600',
                        isSel ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
