import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { useEffect, useMemo, useRef } from 'react';
import {
  BlockNoteSchema,
  defaultInlineContentSpecs,
  type PartialBlock,
} from '@blocknote/core';
import {
  createReactInlineContentSpec,
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { MentionKindIcon } from '@/components/mentions/MentionInput';
import { mentionsApi } from '@/lib/api';
import { useThemeStore } from '@/store/theme';

// Custom inline "mention" content. Serialized into the document JSON as
// { type: 'mention', props: { type, id, label } } — the API extracts user
// mentions from that shape for notifications (see common/mentions.util.ts).
const Mention = createReactInlineContentSpec(
  {
    type: 'mention',
    propSchema: {
      type: { default: 'user' },
      id: { default: '' },
      label: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => {
      const p = props.inlineContent.props;
      return (
        <span className="rounded bg-brand-50 px-1 font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
          {p.type === 'user' ? '@' : ''}
          {p.label}
        </span>
      );
    },
  },
);

const schema = BlockNoteSchema.create({
  inlineContentSpecs: { ...defaultInlineContentSpecs, mention: Mention },
});

/**
 * Rich-text description editor (BlockNote) with @-mentions. Stores the document
 * as JSON. Legacy plain-text/HTML descriptions load as a single paragraph.
 * Saves are debounced and flushed on unmount.
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
  projectKey,
  onSave,
}: {
  value: string | null;
  projectKey: string;
  onSave: (json: string) => void;
}) {
  const isDark = useThemeStore((s) => s.isDark);
  // Evaluate the initial doc once; the parent remounts (via key) per issue.
  const initialContent = useMemo(() => parseInitial(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const editor = useCreateBlockNote({ schema, initialContent });
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

  const getMentionItems = async (
    query: string,
  ): Promise<DefaultReactSuggestionItem[]> => {
    const items = await mentionsApi.search(projectKey, query);
    return items.map((it) => ({
      title: it.label,
      subtext: it.sublabel ?? undefined,
      icon: <MentionKindIcon item={it} />,
      onItemClick: () =>
        editor.insertInlineContent([
          { type: 'mention', props: { type: it.type, id: it.id, label: it.label } },
          ' ',
        ]),
    }));
  };

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
    >
      <SuggestionMenuController
        triggerCharacter="@"
        getItems={getMentionItems}
      />
    </BlockNoteView>
  );
}
