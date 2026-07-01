import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { LabelDto } from '@tasku/types';
import { contrastText } from '@/lib/format';

export interface BadgeProps {
  children: ReactNode;
  className?: string;
  color?: string;
}

/** Generic small pill. Pass `color` for a custom hex background. */
export function Badge({ children, className, color }: BadgeProps) {
  if (color) {
    return (
      <span
        className={clsx(
          'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-none',
          className,
        )}
        style={{ backgroundColor: color, color: contrastText(color) }}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium leading-none text-gray-600 dark:bg-gray-700 dark:text-gray-300',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LabelBadge({ label }: { label: LabelDto }) {
  return <Badge color={label.color}>{label.name}</Badge>;
}
