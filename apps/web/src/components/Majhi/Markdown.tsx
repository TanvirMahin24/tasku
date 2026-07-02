import { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatReference } from '@tasku/types';
import { InlineRefLink } from './references';

/** Escape a string for safe use inside a RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * remark plugin: turn bare issue keys (TASK-12) into links to `/issues/KEY`,
 * but only for keys the backend actually cited — so example keys in prose
 * ("e.g. TASK-12") and lookalikes (UTF-8, GPT-4) are never mis-linked. Skips
 * text already inside links or code.
 */
function remarkIssueKeys(keys: string[]) {
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  const re = sorted.length
    ? new RegExp(`\\b(${sorted.map(escapeRe).join('|')})\\b`, 'g')
    : null;

  return () => (tree: any) => {
    if (!re) return;
    const walk = (node: any): void => {
      if (!Array.isArray(node.children)) return;
      const next: any[] = [];
      for (const child of node.children) {
        if (child.type === 'text') {
          re.lastIndex = 0;
          let last = 0;
          let m: RegExpExecArray | null;
          while ((m = re.exec(child.value))) {
            if (m.index > last)
              next.push({ type: 'text', value: child.value.slice(last, m.index) });
            next.push({
              type: 'link',
              url: `/issues/${m[1]}`,
              children: [{ type: 'text', value: m[1] }],
            });
            last = m.index + m[1].length;
          }
          if (last < child.value.length)
            next.push({ type: 'text', value: child.value.slice(last) });
        } else {
          if (
            child.type !== 'link' &&
            child.type !== 'inlineCode' &&
            child.type !== 'code'
          )
            walk(child);
          next.push(child);
        }
      }
      node.children = next;
    };
    walk(tree);
  };
}

const COMPONENTS: Components = {
  a: ({ href, children }) => (
    <InlineRefLink href={href ?? '#'}>{children}</InlineRefLink>
  ),
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 text-[15px] font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-3 text-[14px] font-semibold first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2.5 text-[13px] font-semibold first:mt-0">
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 marker:text-ink-faint">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-ink-faint">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="[&>p]:my-0">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-ink dark:text-white">
      {children}
    </strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-brand-300 pl-3 text-ink-muted dark:border-brand-500/40">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-line dark:border-gray-700" />,
  code: ({ children, className }) => (
    <code
      className={
        className /* fenced block: styled by <pre> */
          ? className
          : 'rounded bg-surface-sunken px-1 py-0.5 font-mono text-[12px] text-ink dark:bg-white/10 dark:text-gray-100'
      }
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-surface-sunken p-3 font-mono text-[12px] leading-relaxed dark:bg-black/40 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-ink dark:[&_code]:text-gray-100">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-line px-2 py-1 text-left font-semibold dark:border-gray-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-line px-2 py-1 dark:border-gray-700">
      {children}
    </td>
  ),
};

/**
 * Renders assistant markdown (GFM) with app-aware inline links: issue keys and
 * in-app URLs become colour-coded kind pills. XSS-safe — raw HTML is not
 * rendered (no rehype-raw).
 */
export function Markdown({
  content,
  references,
}: {
  content: string;
  references?: ChatReference[];
}) {
  const plugins = useMemo(() => {
    const keys = (references ?? [])
      .filter((r) => r.kind === 'issue' && r.key)
      .map((r) => r.key as string);
    return [remarkGfm, remarkIssueKeys(keys)];
  }, [references]);

  return (
    <div className="break-words text-[13px] leading-relaxed text-ink dark:text-gray-100">
      <ReactMarkdown remarkPlugins={plugins} components={COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
