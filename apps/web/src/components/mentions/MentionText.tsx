import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Columns3, FileText } from 'lucide-react';
import type { Mention } from '@/lib/mentions';
import { parseMentionSegments } from '@/lib/mentions';

/**
 * Render a comment/reply body, turning @-mention tokens into chips. Issues link
 * to their page and boards to their board view (when projectKey is known);
 * users and knowledge docs render as non-navigating chips.
 */
export function MentionText({
  body,
  projectKey,
  className,
}: {
  body: string;
  projectKey?: string;
  className?: string;
}) {
  const segments = parseMentionSegments(body);
  return (
    <span className={`whitespace-pre-wrap break-words ${className ?? ''}`}>
      {segments.map((seg, i) =>
        seg.kind === 'text' ? (
          <Fragment key={i}>{seg.value}</Fragment>
        ) : (
          <MentionChip key={i} mention={seg.mention} projectKey={projectKey} />
        ),
      )}
    </span>
  );
}

const CHIP =
  'mx-px inline-flex items-center gap-0.5 rounded px-1 py-px text-[0.95em] font-medium align-baseline';

export function MentionChip({
  mention,
  projectKey,
}: {
  mention: Mention;
  projectKey?: string;
}) {
  const { type, id, label } = mention;

  if (type === 'user') {
    return (
      <span className={`${CHIP} bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200`}>
        @{label}
      </span>
    );
  }
  if (type === 'issue') {
    // label is the issue key; the issue page routes by key.
    return (
      <Chip to={`/issues/${label}`}>
        <span className="font-mono">{label}</span>
      </Chip>
    );
  }
  if (type === 'board') {
    const to = projectKey ? `/projects/${projectKey}/boards/${id}` : undefined;
    return (
      <Chip to={to}>
        <Columns3 className="h-3 w-3" />
        {label}
      </Chip>
    );
  }
  // knowledge — display-only chip (no standalone route).
  return (
    <span className={`${CHIP} bg-surface-sunken text-ink-soft dark:bg-white/10 dark:text-gray-200`}>
      <FileText className="h-3 w-3" />
      {label}
    </span>
  );
}

function Chip({ to, children }: { to?: string; children: ReactNode }) {
  const cls = `${CHIP} bg-surface-sunken text-ink-soft hover:bg-brand-50 hover:text-brand-700 dark:bg-white/10 dark:text-gray-200`;
  return to ? (
    <Link to={to} className={cls}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  );
}
