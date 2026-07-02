import clsx from 'clsx';
import type { IssueType, Priority, StatusCategory } from '@tasku/types';
import {
  ISSUE_TYPE_META,
  PRIORITY_META,
  STATUS_CATEGORY_META,
} from '@/lib/format';

export function IssueTypeIcon({
  type,
  className,
  boxed,
}: {
  type: IssueType;
  className?: string;
  /** Render as a colored rounded-square with a white icon (Jira-style). */
  boxed?: boolean;
}) {
  const meta = ISSUE_TYPE_META[type];
  const Icon = meta.icon;

  if (boxed) {
    return (
      <span
        title={meta.label}
        className={clsx(
          'inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px]',
          className,
        )}
        style={{ backgroundColor: meta.color }}
      >
        <Icon className="h-3 w-3 text-white" strokeWidth={2.5} />
      </span>
    );
  }

  return (
    <span title={meta.label} className="inline-flex">
      <Icon
        className={clsx('h-4 w-4 shrink-0', className)}
        style={{ color: meta.color }}
        strokeWidth={2.25}
      />
    </span>
  );
}

/** Status pill using the STATUS_CATEGORY_META colors. */
export function StatusPill({
  category,
  label,
  className,
}: {
  category: StatusCategory;
  label: string;
  className?: string;
}) {
  const meta = STATUS_CATEGORY_META[category];
  return (
    <span
      className={clsx(
        'inline-flex h-5 items-center rounded-[10px] px-2 text-[10px] font-semibold leading-none',
        className,
      )}
      style={{ backgroundColor: meta.bg, color: meta.color }}
    >
      {label}
    </span>
  );
}

export function PriorityIcon({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;
  return (
    <span title={`${meta.label} priority`} className="inline-flex">
      <Icon
        className={clsx('h-4 w-4 shrink-0', className)}
        style={{ color: meta.color }}
        strokeWidth={2.5}
      />
    </span>
  );
}

/** Canonical priority display: icon + label. Use everywhere priority is shown. */
export function PriorityLabel({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400',
        className,
      )}
    >
      <PriorityIcon priority={priority} className="h-3.5 w-3.5" />
      {PRIORITY_META[priority].label}
    </span>
  );
}
