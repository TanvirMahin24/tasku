import clsx from 'clsx';
import type { IssueSummaryDto } from '@tasku/types';
import { Avatar } from '@/components/ui/Avatar';
import { LabelBadge } from '@/components/ui/Badge';
import { TeamChip } from '@/components/ui/TeamChip';
import { IssueTypeIcon, PriorityIcon } from '@/components/ui/icons';

/**
 * Presentational Kanban card. Drag wiring is layered on by SortableIssueCard so
 * this stays reusable (e.g. backlog rows could share the inner content).
 */
export function IssueCardContent({
  issue,
  dragging,
}: {
  issue: IssueSummaryDto;
  dragging?: boolean;
}) {
  return (
    <div
      className={clsx(
        'group rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm transition-shadow dark:border-gray-700 dark:bg-gray-800',
        dragging
          ? 'shadow-lg ring-2 ring-brand-400'
          : 'hover:border-gray-300 hover:shadow dark:hover:border-gray-600',
      )}
    >
      <p className="mb-2 line-clamp-3 text-sm leading-snug text-gray-800 dark:text-gray-100">
        {issue.title}
      </p>

      {(issue.labels.length > 0 || issue.team) && (
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {issue.team && <TeamChip team={issue.team} />}
          {issue.labels.map((l) => (
            <LabelBadge key={l.id} label={l} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <IssueTypeIcon type={issue.type} />
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{issue.key}</span>
          <PriorityIcon priority={issue.priority} className="h-3.5 w-3.5" />
        </div>
        <div className="flex items-center gap-1.5">
          {issue.storyPoints != null && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 px-1.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {issue.storyPoints}
            </span>
          )}
          <Avatar user={issue.assignee} size="xs" />
        </div>
      </div>
    </div>
  );
}
