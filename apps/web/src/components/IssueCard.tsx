import clsx from 'clsx';
import type { IssueSummaryDto } from '@tasku/types';
import { Avatar } from '@/components/ui/Avatar';
import { LabelBadge } from '@/components/ui/Badge';
import { TeamChip } from '@/components/ui/TeamChip';
import { IssueTypeIcon, PriorityLabel } from '@/components/ui/icons';

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
        'group flex flex-col gap-[9px] rounded-lg border border-line bg-white p-[10px] shadow-card transition-shadow dark:border-gray-700 dark:bg-gray-800',
        dragging
          ? 'shadow-raise ring-2 ring-brand-300'
          : 'hover:border-[#B3B9C4] dark:hover:border-gray-600',
      )}
    >
      <p className="line-clamp-3 text-[13px] leading-snug text-ink dark:text-gray-100">
        {issue.title}
      </p>

      {(issue.labels.length > 0 || issue.teams.length > 0) && (
        <div className="flex flex-wrap items-center gap-1">
          {issue.teams.map((t) => (
            <TeamChip key={t.id} team={t} />
          ))}
          {issue.labels.map((l) => (
            <LabelBadge key={l.id} label={l} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <IssueTypeIcon type={issue.type} boxed />
          <span className="font-mono text-[11px] font-semibold text-ink-faint dark:text-gray-400">
            {issue.key}
          </span>
          <PriorityLabel priority={issue.priority} />
        </div>
        <div className="flex items-center gap-1.5">
          {issue.storyPoints != null && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-sunken px-1.5 text-[11px] font-semibold text-ink-soft dark:bg-gray-700 dark:text-gray-300">
              {issue.storyPoints}
            </span>
          )}
          <Avatar user={issue.assignee} size="xs" />
        </div>
      </div>
    </div>
  );
}
