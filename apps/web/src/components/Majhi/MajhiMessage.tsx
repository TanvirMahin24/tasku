import clsx from 'clsx';
import { Sparkles } from 'lucide-react';
import type { ChatMessageDto } from '@tasku/types';
import { Markdown } from './Markdown';
import { ReferenceBlock, ToolTrace } from './references';

/**
 * Renders a single chat turn. User turns are right-aligned subtle bubbles;
 * Majhi turns are left-aligned with an avatar, rich references and an optional
 * tool trace. Kept deliberately small/extensible — new content types can hang
 * off ChatMessageDto without touching the panel shell.
 */
export function MajhiMessage({ message }: { message: ChatMessageDto }) {
  const isUser = message.role === 'USER';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-brand-600 px-3 py-2 text-[13px] text-white">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={clsx(
            'break-words rounded-2xl rounded-tl-sm border border-line bg-white px-3 py-2',
            'dark:border-gray-700 dark:bg-gray-900',
          )}
        >
          {message.content ? (
            <Markdown content={message.content} references={message.references} />
          ) : (
            <span className="text-[13px] italic text-ink-faint">No answer.</span>
          )}
        </div>
        <ReferenceBlock references={message.references} />
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolTrace toolCalls={message.toolCalls} />
        )}
      </div>
    </div>
  );
}
