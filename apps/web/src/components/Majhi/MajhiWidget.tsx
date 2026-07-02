import { useEffect, useRef, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  History,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import type {
  ChatMessageDto,
  ChatResponseDto,
  ChatSessionSummaryDto,
} from '@tasku/types';
import { aiApi } from '@/lib/ai';
import { apiErrorMessage } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { relativeTime } from '@/lib/format';
import { useFeature } from '@/hooks/useFeatures';
import { Spinner } from '@/components/ui/Spinner';
import { MajhiMessage } from './MajhiMessage';
import { useMajhiContext } from './useMajhiContext';

/** Locally-minted id for optimistic user turns (never sent to the server). */
function localId(): string {
  return `local-${Math.random().toString(36).slice(2)}`;
}

export function MajhiWidget() {
  const qc = useQueryClient();
  const { context, label } = useMajhiContext();

  const [open, setOpen] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Gate the entire widget on availability — hidden when no provider.
  const { data: status } = useQuery({
    queryKey: qk.aiStatus,
    queryFn: aiApi.status,
    staleTime: 60_000,
  });

  // Also hide when the assistant feature is disabled for this user.
  const assistantEnabled = useFeature('assistant');

  // Let other surfaces (e.g. the command palette) open Majhi.
  useEffect(() => {
    const openMajhi = () => setOpen(true);
    window.addEventListener('majhi:open', openMajhi);
    return () => window.removeEventListener('majhi:open', openMajhi);
  }, []);

  const { data: sessions = [] } = useQuery({
    queryKey: qk.aiSessions,
    queryFn: aiApi.sessions,
    enabled: open && showSessions && !!status?.enabled,
  });

  const send = useMutation({
    mutationFn: (message: string) =>
      aiApi.chat({ message, context, sessionId }),
    onSuccess: (res: ChatResponseDto) => {
      setSessionId(res.sessionId);
      setMessages((m) => [...m, res.message]);
      qc.invalidateQueries({ queryKey: qk.aiSessions });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Majhi could not answer.')),
  });

  const removeSession = useMutation({
    mutationFn: (id: string) => aiApi.deleteSession(id),
    onSuccess: (_v, id) => {
      qc.invalidateQueries({ queryKey: qk.aiSessions });
      if (id === sessionId) newChat();
    },
  });

  // Keep the transcript pinned to the latest turn.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, send.isPending]);

  function newChat() {
    setMessages([]);
    setSessionId(null);
    setShowSessions(false);
    setError(null);
  }

  function submit() {
    const text = input.trim();
    if (!text || send.isPending) return;
    setError(null);
    setMessages((m) => [
      ...m,
      {
        id: localId(),
        role: 'USER',
        content: text,
        references: [],
        createdAt: new Date().toISOString(),
      },
    ]);
    setInput('');
    send.mutate(text);
  }

  async function loadSession(id: string) {
    try {
      const s = await aiApi.session(id);
      setSessionId(s.id);
      setMessages(s.messages);
      setShowSessions(false);
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not load that chat.'));
    }
  }

  if (!status?.enabled || !assistantEnabled) return null;

  return (
    <>
      {/* Floating action button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Ask Majhi"
          aria-label="Ask Majhi"
          className="fixed bottom-5 right-5 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-brand-600 text-white shadow-raise transition-transform hover:scale-105 hover:bg-brand-700"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Slide-over panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 flex h-[min(640px,calc(100vh-2.5rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface-page shadow-raise dark:border-gray-700 dark:bg-gray-950">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-line bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ink dark:text-gray-100">
                Majhi
              </p>
              <p className="truncate text-[10.5px] text-ink-faint">
                Answering about:{' '}
                <span className="font-medium text-ink-muted dark:text-gray-300">
                  {label}
                </span>
              </p>
            </div>
            <IconButton
              title="Chat history"
              active={showSessions}
              onClick={() => setShowSessions((v) => !v)}
            >
              <History className="h-4 w-4" />
            </IconButton>
            <IconButton title="New chat" onClick={newChat}>
              <MessageSquarePlus className="h-4 w-4" />
            </IconButton>
            <IconButton title="Close" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>

          {showSessions ? (
            <SessionList
              sessions={sessions}
              activeId={sessionId}
              onPick={loadSession}
              onDelete={(id) => removeSession.mutate(id)}
            />
          ) : (
            <>
              {/* Transcript */}
              <div
                ref={scrollRef}
                className="flex-1 space-y-3 overflow-y-auto scrollbar-thin px-3 py-3"
              >
                {messages.length === 0 && !send.isPending ? (
                  <EmptyChat context={label} />
                ) : (
                  messages.map((m) => <MajhiMessage key={m.id} message={m} />)
                )}
                {send.isPending && <ThinkingBubble />}
                {error && (
                  <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">
                    {error}
                  </p>
                )}
              </div>

              {/* Composer */}
              <div className="border-t border-line bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-end gap-2 rounded-xl border border-line bg-surface-page px-2.5 py-1.5 focus-within:border-brand-500 dark:border-gray-700 dark:bg-gray-950">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submit();
                      }
                    }}
                    rows={1}
                    placeholder="Ask about this workspace…"
                    className="max-h-28 min-h-[24px] flex-1 resize-none bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint dark:text-gray-100"
                  />
                  <button
                    onClick={submit}
                    disabled={!input.trim() || send.isPending}
                    title="Send"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function IconButton({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={clsx(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
          : 'text-ink-faint hover:bg-surface-sunken hover:text-ink-soft dark:hover:bg-white/10',
      )}
    >
      {children}
    </button>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-line bg-white px-3 py-2 text-[13px] text-ink-faint dark:border-gray-700 dark:bg-gray-900">
        <Spinner className="h-3.5 w-3.5" />
        Thinking…
      </div>
    </div>
  );
}

function EmptyChat({ context }: { context: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
        <Sparkles className="h-6 w-6" />
      </span>
      <p className="text-sm font-semibold text-ink dark:text-gray-100">
        Hi, I'm Majhi
      </p>
      <p className="mt-1 text-xs text-ink-muted dark:text-gray-400">
        Ask me about your issues, views, releases and docs. I'm grounded in{' '}
        <span className="font-medium">{context}</span> right now.
      </p>
    </div>
  );
}

function SessionList({
  sessions,
  activeId,
  onPick,
  onDelete,
}: {
  sessions: ChatSessionSummaryDto[];
  activeId: string | null;
  onPick: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
      {sessions.length === 0 ? (
        <p className="px-2 py-8 text-center text-xs text-ink-faint">
          No previous chats yet.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {sessions.map((s) => (
            <li
              key={s.id}
              className={clsx(
                'group flex items-center gap-2 rounded-md px-2 py-2 transition-colors',
                s.id === activeId
                  ? 'bg-brand-50 dark:bg-brand-500/15'
                  : 'hover:bg-surface-sunken dark:hover:bg-white/10',
              )}
            >
              <button
                onClick={() => onPick(s.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-[13px] font-medium text-ink dark:text-gray-100">
                  {s.title || 'Untitled chat'}
                </p>
                <p className="truncate text-[10.5px] text-ink-faint">
                  {relativeTime(s.updatedAt)}
                </p>
              </button>
              <button
                onClick={() => onDelete(s.id)}
                title="Delete chat"
                className="shrink-0 text-ink-faint opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
