import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { useEffect, useMemo, useRef } from 'react';
import type { PartialBlock } from '@blocknote/core';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { useThemeStore } from '@/store/theme';

/**
 * Rich-text description editor (BlockNote). Stores the document as JSON. Legacy
 * plain-text/HTML descriptions load as a single paragraph. Saves are debounced
 * and flushed on unmount.
 */
function parseInitial(value: string | null): PartialBlock[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.length) return parsed as PartialBlock[];
  } catch {
    // not JSON -> treat as legacy plain text
  }
  return [{ type: 'paragraph', content: value }];
}

export function DescriptionEditor({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (json: string) => void;
}) {
  const isDark = useThemeStore((s) => s.isDark);
  // Evaluate the initial doc once; the parent remounts (via key) per issue.
  const initialContent = useMemo(() => parseInitial(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const editor = useCreateBlockNote({ initialContent });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (dirty.current) {
      dirty.current = false;
      onSave(JSON.stringify(editor.document));
    }
  };

  // Flush any pending change when the drawer/editor unmounts.
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BlockNoteView
      editor={editor}
      theme={isDark ? 'dark' : 'light'}
      onChange={() => {
        dirty.current = true;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, 800);
      }}
      className="min-h-[120px] rounded-md border border-line py-2 dark:border-gray-600"
    />
  );
}
