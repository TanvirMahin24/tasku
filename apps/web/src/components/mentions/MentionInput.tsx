import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AtSign, Columns3, FileText, Hash } from 'lucide-react';
import type { MentionableDto } from '@tasku/types';
import { mentionsApi } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { buildMentionToken, parseMentionSegments } from '@/lib/mentions';

const CHIP_CLASS =
  'ta-mention mx-px inline-flex items-center gap-0.5 rounded bg-brand-50 px-1 py-px align-baseline text-[0.95em] font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-200';

// --- DOM <-> token-string serialization ------------------------------------

function makeChip(m: { type: string; id: string; label: string }): HTMLElement {
  const el = document.createElement('span');
  el.className = CHIP_CLASS;
  el.contentEditable = 'false';
  el.dataset.type = m.type;
  el.dataset.id = m.id;
  el.dataset.label = m.label;
  el.textContent = (m.type === 'user' ? '@' : '') + m.label;
  return el;
}

function serialize(root: HTMLElement): string {
  let out = '';
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? '';
    } else if (node instanceof HTMLElement) {
      if (node.dataset.id && node.dataset.type) {
        out += buildMentionToken({
          type: node.dataset.type as never,
          id: node.dataset.id,
          label: node.dataset.label ?? '',
        });
      } else if (node.tagName === 'BR') {
        out += '\n';
      } else {
        out += node.textContent ?? '';
      }
    }
  });
  return out;
}

function renderInto(root: HTMLElement, value: string): void {
  root.innerHTML = '';
  for (const seg of parseMentionSegments(value)) {
    if (seg.kind === 'text') {
      root.appendChild(document.createTextNode(seg.value));
    } else {
      root.appendChild(makeChip(seg.mention));
    }
  }
}

// --- The @ query under the caret -------------------------------------------

interface Trigger {
  query: string;
  node: Text;
  at: number; // index of '@' within the text node
  end: number; // caret index within the text node
}

function findTrigger(): Trigger | null {
  const sel = document.getSelection();
  if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return null;
  const { startContainer, startOffset } = sel.getRangeAt(0);
  if (startContainer.nodeType !== Node.TEXT_NODE) return null;
  const text = (startContainer.textContent ?? '').slice(0, startOffset);
  const m = /(^|\s)@([\p{L}\p{N}_.-]*)$/u.exec(text);
  if (!m) return null;
  const at = startOffset - m[2].length - 1;
  return { query: m[2], node: startContainer as Text, at, end: startOffset };
}

export function MentionInput({
  value,
  onChange,
  onSubmit,
  projectKey,
  placeholder,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  projectKey: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string>('');
  const trigger = useRef<Trigger | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  // Sync DOM from value only on external change (reset/clear) — never mid-typing.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value !== last.current) {
      renderInto(el, value);
      last.current = value;
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const { data: items = [] } = useQuery({
    queryKey: qk.mentionables(projectKey, query ?? ''),
    queryFn: () => mentionsApi.search(projectKey, query ?? ''),
    enabled: query !== null,
  });

  function emit() {
    const el = ref.current;
    if (!el) return;
    const s = serialize(el);
    last.current = s;
    onChange(s);
  }

  function refreshTrigger() {
    trigger.current = findTrigger();
    setQuery(trigger.current ? trigger.current.query : null);
    setActive(0);
  }

  function insert(item: MentionableDto) {
    const t = trigger.current;
    const el = ref.current;
    if (!t || !el) return;
    // Replace "@query" in the text node with a chip + trailing space.
    const full = t.node.textContent ?? '';
    const before = full.slice(0, t.at);
    const after = full.slice(t.end);
    const chip = makeChip({ type: item.type, id: item.id, label: item.label });
    const space = document.createTextNode(' ');
    const afterNode = document.createTextNode(after);
    const parent = t.node.parentNode!;
    t.node.textContent = before;
    parent.insertBefore(afterNode, t.node.nextSibling);
    parent.insertBefore(space, afterNode);
    parent.insertBefore(chip, space);
    // Caret after the trailing space.
    const sel = document.getSelection();
    const range = document.createRange();
    range.setStart(space, 1);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    setQuery(null);
    trigger.current = null;
    emit();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (query !== null && items.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => (a + 1) % items.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => (a - 1 + items.length) % items.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insert(items[active]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setQuery(null);
        trigger.current = null;
        return;
      }
    }
    // Enter submits; Shift+Enter inserts a newline. Intercept both so the
    // contentEditable never spawns block elements (keeps serialize simple).
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        document.execCommand('insertText', false, '\n');
        emit();
      } else {
        onSubmit?.();
      }
    }
  }

  const empty = value.length === 0;

  return (
    <div className="relative">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onInput={() => {
          emit();
          refreshTrigger();
        }}
        onKeyUp={refreshTrigger}
        onClick={refreshTrigger}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
        onKeyDown={onKeyDown}
        data-placeholder={placeholder ?? 'Add a comment…  (@ to mention)'}
        className={`ta-mention-input min-h-[60px] w-full whitespace-pre-wrap break-words rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 ${
          empty ? 'is-empty' : ''
        } ${className ?? ''}`}
      />

      {query !== null && items.length > 0 && (
        <ul className="absolute left-0 top-full z-30 mt-1 max-h-64 w-72 overflow-y-auto scrollbar-thin rounded-md border border-line bg-white py-1 shadow-raise dark:border-gray-700 dark:bg-gray-800">
          {items.map((it, i) => (
            <li key={`${it.type}:${it.id}`}>
              <button
                type="button"
                // onMouseDown (not onClick) so it fires before the input blurs.
                onMouseDown={(e) => {
                  e.preventDefault();
                  insert(it);
                }}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm ${
                  i === active
                    ? 'bg-brand-50 dark:bg-brand-500/15'
                    : 'hover:bg-surface-sunken dark:hover:bg-white/10'
                }`}
              >
                <MentionKindIcon type={it.type} />
                <span className="min-w-0 flex-1 truncate text-ink dark:text-gray-100">
                  {it.label}
                </span>
                {it.sublabel && (
                  <span className="shrink-0 truncate text-[11px] text-ink-faint">
                    {it.sublabel}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MentionKindIcon({ type }: { type: MentionableDto['type'] }) {
  const cls = 'h-3.5 w-3.5 shrink-0 text-ink-faint';
  if (type === 'user') return <AtSign className={cls} />;
  if (type === 'issue') return <Hash className={cls} />;
  if (type === 'board') return <Columns3 className={cls} />;
  return <FileText className={cls} />;
}
