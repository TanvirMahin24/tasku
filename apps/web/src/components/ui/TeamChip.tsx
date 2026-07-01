import clsx from 'clsx';
import type { TeamSummaryDto } from '@tasku/types';

/** Small chip showing a team's color dot + name. */
export function TeamChip({
  team,
  className,
}: {
  team: TeamSummaryDto;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-muted dark:bg-gray-800 dark:text-gray-300',
        className,
      )}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: team.color }}
      />
      {team.name}
    </span>
  );
}
