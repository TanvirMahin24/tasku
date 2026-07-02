import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ExternalLink,
  FileText,
  Layers,
  Link2,
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

/** A rendered link flavour: every reference kind plus a catch-all external. */
export type LinkKind = ChatReferenceKind | 'external';

export const KIND_META: Record<
  LinkKind,
  { icon: typeof FileText; label: string; color: string }
> = {
  issue: { icon: SquareKanban, label: 'Issue', color: '#1868DB' },
  knowledge: { icon: FileText, label: 'Doc', color: '#5E6C84' },
  view: { icon: Layers, label: 'View', color: '#8270DB' },
  release: { icon: Rocket, label: 'Release', color: '#E9730C' },
  team: { icon: Users, label: 'Team', color: '#00857A' },
  board: { icon: SquareKanban, label: 'Board', color: '#0C66E4' },
  external: { icon: ExternalLink, label: 'Link', color: '#5E6C84' },
};

/** Classify an in-app href (or external URL) into a link kind for styling. */
export function classifyHref(href: string): LinkKind | null {
  if (/^https?:\/\//i.test(href)) return 'external';
  if (href.startsWith('/issues/')) return 'issue';
  if (href.startsWith('/teams/')) return 'team';
  if (href.startsWith('/views/')) return 'view';
  if (href.startsWith('/knowledge')) return 'knowledge';
  if (href.includes('/board')) return 'board';
  if (href.includes('/release')) return 'release';
  return null;
}

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
    case 'knowledge':
      return { href: ref.url ?? '/knowledge', external: false };
    default:
      return { href: ref.url ?? '#', external: false };
  }
}

/**
 * Compact inline pill for a link inside rendered markdown — a distinct,
 * colour-coded flavour per kind (issue, team, board, doc, …). Different, denser
 * design than the {@link ReferenceBlock} row chips.
 */
export function InlineRefLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const kind = classifyHref(href);
  if (!kind) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-brand-600 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-600 dark:text-brand-300"
      >
        {children}
      </a>
    );
  }

  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const external = kind === 'external';
  const cls =
    'mx-px inline-flex items-center gap-1 rounded px-1.5 py-0.5 align-baseline text-[0.92em] font-medium leading-tight ring-1 ring-inset transition-colors';
  const style = {
    backgroundColor: `${meta.color}14`,
    color: meta.color,
    '--tw-ring-color': `${meta.color}33`,
  } as React.CSSProperties;
  const inner = (
    <>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{children}</span>
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
        style={style}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link to={href} className={cls} style={style}>
      {inner}
    </Link>
  );
}

/** A full-width reference row shown in the collapsible references panel. */
function RefChip({ reference: r }: { reference: ChatReference }) {
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
      {external && <ExternalLink className="h-3 w-3 shrink-0 text-ink-faint" />}
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

/**
 * References are hidden by default behind a small icon button; clicking it
 * expands the citation chips.
 */
export function ReferenceBlock({
  references,
}: {
  references: ChatReference[];
}) {
  const [open, setOpen] = useState(false);
  if (!references.length) return null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-brand-500/40"
      >
        <Link2 className="h-3.5 w-3.5" />
        {references.length} {references.length === 1 ? 'reference' : 'references'}
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-1">
          {references.map((r, i) => (
            <RefChip key={`${r.kind}-${r.id}-${i}`} reference={r} />
          ))}
        </div>
      )}
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
