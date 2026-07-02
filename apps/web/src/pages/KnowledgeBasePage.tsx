import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  BookOpen,
  File as FileIcon,
  FileText,
  Link2,
  Presentation,
  RefreshCw,
  Search,
  Sheet,
  Users,
} from 'lucide-react';
import type {
  KnowledgeIngestStatus,
  KnowledgeLinkKind,
  KnowledgeListItemDto,
  KnowledgeListQuery,
  KnowledgeType,
} from '@tasku/types';
import { knowledgeApi, fetchKnowledgeBlobUrl } from '../lib/api';
import { aiApi } from '../lib/ai';
import { qk } from '../lib/queryKeys';
import { avatarColor, initials, relativeTime } from '../lib/format';

const LINK_KIND_META: Record<
  KnowledgeLinkKind,
  { label: string; icon: typeof FileText; color: string }
> = {
  GOOGLE_DOC: { label: 'Google Doc', icon: FileText, color: '#1868DB' },
  GOOGLE_SHEET: { label: 'Google Sheet', icon: Sheet, color: '#22A06B' },
  GOOGLE_SLIDES: { label: 'Google Slides', icon: Presentation, color: '#E9730C' },
  GENERIC: { label: 'Link', icon: Link2, color: '#5E6C84' },
};

const INGEST_META: Record<KnowledgeIngestStatus, { label: string; cls: string }> =
  {
    READY: {
      label: 'Ready',
      cls: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300',
    },
    PENDING: {
      label: 'Pending',
      cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    },
    ERROR: {
      label: 'Error',
      cls: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    },
    UNSUPPORTED: {
      label: 'Unsupported',
      cls: 'bg-surface-sunken text-ink-muted dark:bg-white/10 dark:text-gray-300',
    },
  };

const selectCls =
  'h-9 rounded-md border border-line bg-white px-2.5 text-sm text-ink ' +
  'focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-500 ' +
  'dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

function docIcon(d: KnowledgeListItemDto) {
  if (d.type === 'LINK' && d.linkKind) return LINK_KIND_META[d.linkKind];
  return { label: 'File', icon: FileIcon, color: '#5E6C84' };
}

export default function KnowledgeBasePage() {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [type, setType] = useState<KnowledgeType | ''>('');
  const [linkKind, setLinkKind] = useState<KnowledgeLinkKind | ''>('');
  const [ingestStatus, setIngestStatus] = useState<KnowledgeIngestStatus | ''>(
    '',
  );

  const query: KnowledgeListQuery = useMemo(
    () => ({
      q: text.trim() || undefined,
      type: type || undefined,
      linkKind: linkKind || undefined,
      ingestStatus: ingestStatus || undefined,
    }),
    [text, type, linkKind, ingestStatus],
  );

  const { data: ai } = useQuery({ queryKey: qk.aiStatus, queryFn: aiApi.status });
  const { data: docs = [], isLoading } = useQuery({
    queryKey: qk.knowledgeAll(query),
    queryFn: () => knowledgeApi.listAll(query),
  });

  const reingest = useMutation({
    mutationFn: (id: string) => aiApi.ingest(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['knowledge', 'all'] }),
  });

  const openFile = async (id: string) => {
    const url = await fetchKnowledgeBlobUrl(id);
    window.open(url, '_blank', 'noopener');
  };

  const aiEnabled = !!ai?.enabled;

  return (
    <div className="min-h-full bg-surface-page px-8 py-6 dark:bg-gray-950">
      <div className="mb-6 flex items-center gap-2.5">
        <BookOpen className="h-6 w-6 text-brand-600" />
        <div>
          <h1 className="text-xl font-bold text-ink dark:text-gray-100">
            Knowledge base
          </h1>
          <p className="text-sm text-ink-muted dark:text-gray-400">
            Every doc across your teams and issues — searchable and filterable.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search docs…"
            className={clsx(selectCls, 'w-72 pl-8')}
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as KnowledgeType | '')}
          className={selectCls}
        >
          <option value="">All types</option>
          <option value="LINK">Links</option>
          <option value="FILE">Files</option>
        </select>
        <select
          value={linkKind}
          onChange={(e) => setLinkKind(e.target.value as KnowledgeLinkKind | '')}
          className={selectCls}
        >
          <option value="">All sources</option>
          <option value="GOOGLE_DOC">Google Docs</option>
          <option value="GOOGLE_SHEET">Google Sheets</option>
          <option value="GOOGLE_SLIDES">Google Slides</option>
          <option value="GENERIC">Other links</option>
        </select>
        {aiEnabled && (
          <select
            value={ingestStatus}
            onChange={(e) =>
              setIngestStatus(e.target.value as KnowledgeIngestStatus | '')
            }
            className={selectCls}
          >
            <option value="">AI Processed</option>
            <option value="READY">Ready</option>
            <option value="PENDING">Pending</option>
            <option value="ERROR">Error</option>
            <option value="UNSUPPORTED">Unsupported</option>
          </select>
        )}
        <span className="ml-auto text-sm text-ink-muted dark:text-gray-400">
          {docs.length} {docs.length === 1 ? 'doc' : 'docs'}
        </span>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-ink-muted">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-white py-20 text-center dark:border-gray-700 dark:bg-gray-900">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-ink-faint" />
          <p className="text-sm text-ink-muted dark:text-gray-400">
            No knowledge docs match. Add docs from a team or an issue’s
            Knowledge panel.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {docs.map((d) => {
            const meta = docIcon(d);
            const Icon = meta.icon;
            return (
              <div
                key={d.id}
                className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 shadow-card dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-md"
                    style={{ background: `${meta.color}1a`, color: meta.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {d.type === 'LINK' && d.url ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="line-clamp-2 text-sm font-semibold text-ink hover:text-brand-600 dark:text-gray-100"
                      >
                        {d.title}
                      </a>
                    ) : (
                      <button
                        onClick={() => openFile(d.id)}
                        className="line-clamp-2 text-left text-sm font-semibold text-ink hover:text-brand-600 dark:text-gray-100"
                      >
                        {d.title}
                      </button>
                    )}
                    <div className="mt-0.5 text-xs text-ink-faint">
                      {meta.label}
                    </div>
                  </div>
                </div>

                {/* owner + ingest */}
                <div className="flex flex-wrap items-center gap-2">
                  {d.owner.kind === 'team' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-ink-soft dark:bg-white/10 dark:text-gray-300">
                      <Users className="h-3 w-3" />
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: d.owner.color ?? '#5E6C84' }}
                      />
                      {d.owner.label}
                    </span>
                  ) : (
                    <Link
                      to={`/issues/${d.owner.id}`}
                      className="rounded-full bg-surface-sunken px-2 py-0.5 font-mono text-xs font-medium text-ink-soft hover:text-brand-600 dark:bg-white/10 dark:text-gray-300"
                    >
                      {d.owner.label}
                    </Link>
                  )}
                  {aiEnabled && d.ingestStatus && (
                    <span
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        INGEST_META[d.ingestStatus].cls,
                      )}
                    >
                      {INGEST_META[d.ingestStatus].label}
                      {d.chunkCount > 0 && ` · ${d.chunkCount}`}
                    </span>
                  )}
                </div>

                {/* footer */}
                <div className="mt-auto flex items-center gap-2 border-t border-line-soft pt-2.5 dark:border-gray-800">
                  <span
                    className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: avatarColor(d.createdBy.id) }}
                    title={d.createdBy.displayName}
                  >
                    {initials(d.createdBy.displayName)}
                  </span>
                  <span className="truncate text-xs text-ink-muted dark:text-gray-400">
                    {d.createdBy.displayName} · {relativeTime(d.createdAt)}
                  </span>
                  {aiEnabled && (
                    <button
                      onClick={() => reingest.mutate(d.id)}
                      disabled={reingest.isPending}
                      title="Re-ingest for Majhi (RAG)"
                      className="ml-auto flex-none rounded-md p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-brand-600 disabled:opacity-50 dark:hover:bg-white/10"
                    >
                      <RefreshCw
                        className={clsx(
                          'h-4 w-4',
                          reingest.isPending &&
                            reingest.variables === d.id &&
                            'animate-spin',
                        )}
                      />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
