import { Link } from 'react-router-dom';
import {
  ExternalLink,
  FileText,
  Layers,
  Rocket,
  SquareKanban,
  Users,
  Wrench,
} from 'lucide-react';
import type {
  ChatReference,
  ChatReferenceKind,
  ToolCallTrace,
} from '@tasku/types';

const KIND_META: Record<
  ChatReferenceKind,
  { icon: typeof FileText; label: string; color: string }
> = {
  issue: { icon: SquareKanban, label: 'Issue', color: '#1868DB' },
  knowledge: { icon: FileText, label: 'Doc', color: '#5E6C84' },
  view: { icon: Layers, label: 'View', color: '#8270DB' },
  release: { icon: Rocket, label: 'Release', color: '#E9730C' },
  team: { icon: Users, label: 'Team', color: '#00857A' },
  board: { icon: SquareKanban, label: 'Board', color: '#0C66E4' },
};

/** Resolve the destination for a reference: in-app route or external URL. */
function routeForRef(ref: ChatReference): { href: string; external: boolean } {
  if (ref.url && /^https?:\/\//i.test(ref.url)) {
    return { href: ref.url, external: true };
  }
  switch (ref.kind) {
    case 'issue':
      return { href: `/issues/${ref.key ?? ref.id}`, external: false };
    case 'view':
      return { href: `/views/${ref.id}`, external: false };
    case 'team':
      return { href: `/teams/${ref.id}`, external: false };
    default:
      return { href: ref.url ?? '#', external: false };
  }
}

function RefChip({ ref: r }: { ref: ChatReference }) {
  const meta = KIND_META[r.kind];
  const Icon = meta.icon;
  const { href, external } = routeForRef(r);

  const inner = (
    <>
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
        style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
      >
        <Icon className="h-3 w-3" />
      </span>
      {r.key && (
        <span className="shrink-0 font-mono text-[11px] font-semibold text-ink-soft dark:text-gray-300">
          {r.key}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[12px] text-ink dark:text-gray-100">
        {r.title}
      </span>
      {r.status && (
        <span className="shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium text-ink-muted dark:bg-white/10 dark:text-gray-300">
          {r.status}
        </span>
      )}
      {external && (
        <ExternalLink className="h-3 w-3 shrink-0 text-ink-faint" />
      )}
    </>
  );

  const cls =
    'flex items-center gap-2 rounded-md border border-line bg-white px-2 py-1.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10';

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link to={href} className={cls}>
      {inner}
    </Link>
  );
}

export function ReferenceBlock({
  references,
}: {
  references: ChatReference[];
}) {
  if (!references.length) return null;
  return (
    <div className="mt-2 space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
        References
      </p>
      <div className="flex flex-col gap-1">
        {references.map((r, i) => (
          <RefChip key={`${r.kind}-${r.id}-${i}`} ref={r} />
        ))}
      </div>
    </div>
  );
}

export function ToolTrace({ toolCalls }: { toolCalls: ToolCallTrace[] }) {
  if (!toolCalls.length) return null;
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-ink-faint">
      <Wrench className="h-3 w-3 shrink-0" />
      <span className="truncate">
        used: {toolCalls.map((t) => t.name).join(', ')}
      </span>
    </div>
  );
}
