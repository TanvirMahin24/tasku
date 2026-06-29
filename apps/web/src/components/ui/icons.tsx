import clsx from 'clsx';
import type { IssueType, Priority } from '@tasku/types';
import { ISSUE_TYPE_META, PRIORITY_META } from '@/lib/format';

export function IssueTypeIcon({
  type,
  className,
}: {
  type: IssueType;
  className?: string;
}) {
  const meta = ISSUE_TYPE_META[type];
  const Icon = meta.icon;
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
