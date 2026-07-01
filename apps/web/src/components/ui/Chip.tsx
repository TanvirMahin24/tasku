import clsx from 'clsx';
import type { ReactNode } from 'react';

/** Toggleable filter chip. */
export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-brand-600 bg-brand-50 text-brand-600 font-semibold dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-300'
          : 'border-line bg-white text-ink-soft hover:bg-surface-page dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
      )}
    >
      {children}
    </button>
  );
}
