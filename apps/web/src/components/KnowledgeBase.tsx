import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CornerDownRight,
  Download,
  ExternalLink,
  File as FileIcon,
  FileText,
  Link2,
  Presentation,
  RefreshCw,
  Table2,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  CreateKnowledgeLinkDto,
  KnowledgeDocDto,
  KnowledgeIngestDto,
  KnowledgeLinkKind,
  KnowledgeSource,
} from '@tasku/types';
import {
  apiErrorMessage,
  fetchKnowledgeBlobUrl,
  knowledgeApi,
} from '@/lib/api';
import { aiApi } from '@/lib/ai';
import { qk } from '@/lib/queryKeys';
import { relativeTime } from '@/lib/format';
import { useDebounced } from '@/hooks/useDebounced';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { inputClass } from '@/components/ui/Select';
import { IngestBadge } from '@/components/Majhi/IngestBadge';

export type KnowledgeScope =
  | { kind: 'team'; teamId: string }
  | { kind: 'issue'; issueKey: string };

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// Icon + accent per doc kind. Google product colors are intentional (they read
// as the source app, not the brand).
function visualFor(doc: KnowledgeDocDto): { Icon: typeof FileText; color: string } {
  if (doc.type === 'FILE') return { Icon: FileIcon, color: '#5E6C84' };
  const byKind: Record<KnowledgeLinkKind, { Icon: typeof FileText; color: string }> =
    {
      GOOGLE_DOC: { Icon: FileText, color: '#4285F4' },
      GOOGLE_SHEET: { Icon: Table2, color: '#0F9D58' },
      GOOGLE_SLIDES: { Icon: Presentation, color: '#F4B400' },
      GENERIC: { Icon: Link2, color: '#5E6C84' },
    };
  return byKind[doc.linkKind ?? 'GENERIC'];
}

export function KnowledgeBase({ scope }: { scope: KnowledgeScope }) {
  const qc = useQueryClient();
  const queryKey =
    scope.kind === 'team'
      ? qk.teamKnowledge(scope.teamId)
      : qk.issueKnowledge(scope.issueKey);

  const { data: docs = [], isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      scope.kind === 'team'
        ? knowledgeApi.listTeam(scope.teamId)
        : knowledgeApi.listIssue(scope.issueKey),
  });

  // RAG ingestion status — only relevant when the AI assistant is configured.
  const { data: aiStatus } = useQuery({
    queryKey: qk.aiStatus,
    queryFn: aiApi.status,
    staleTime: 60_000,
  });
  const aiEnabled = !!aiStatus?.enabled;

  const ingestParams =
    scope.kind === 'team'
      ? { teamId: scope.teamId }
      : { issueId: scope.issueKey };
  const ingestKey =
    scope.kind === 'team'
      ? qk.aiIngestStatus(scope.teamId, undefined)
      : qk.aiIngestStatus(undefined, scope.issueKey);

  const { data: ingest = [] } = useQuery({
    queryKey: ingestKey,
    queryFn: () => aiApi.ingestStatus(ingestParams),
    enabled: aiEnabled && docs.length > 0,
  });
  const ingestById = new Map<string, KnowledgeIngestDto>(
    ingest.map((i) => [i.id, i]),
  );

  const reingest = useMutation({
    mutationFn: (docId: string) => aiApi.ingest(docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ingestKey }),
    onError: (e) => setError(apiErrorMessage(e, 'Could not re-ingest document')),
  });

  const [adding, setAdding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const addLink = useMutation({
    mutationFn: (dto: CreateKnowledgeLinkDto) =>
      scope.kind === 'team'
        ? knowledgeApi.addTeamLink(scope.teamId, dto)
        : knowledgeApi.addIssueLink(scope.issueKey, dto),
    onSuccess: () => {
      invalidate();
      setAdding(false);
    },
    onError: (e) => setError(apiErrorMessage(e, 'Could not add link')),
  });

  const upload = useMutation({
    mutationFn: (file: File) =>
      scope.kind === 'team'
        ? knowledgeApi.uploadTeamFile(scope.teamId, file)
        : knowledgeApi.uploadIssueFile(scope.issueKey, file),
    onSuccess: invalidate,
    onError: (e) => setError(apiErrorMessage(e, 'Upload failed')),
  });

  const importDoc = useMutation({
    mutationFn: (sourceDocId: string) =>
      scope.kind === 'team'
        ? knowledgeApi.importToTeam(scope.teamId, sourceDocId)
        : knowledgeApi.importToIssue(scope.issueKey, sourceDocId),
    onSuccess: () => {
      invalidate();
      setImportOpen(false);
    },
    onError: (e) => setError(apiErrorMessage(e, 'Import failed')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => knowledgeApi.remove(id),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setAdding((v) => !v)}>
          <Link2 className="h-4 w-4" /> Add link
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={upload.isPending}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" /> Upload file
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
          <Download className="h-4 w-4" /> Import
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setError(null);
            if (f) upload.mutate(f);
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {adding && (
        <AddLinkForm
          pending={addLink.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(dto) => {
            setError(null);
            addLink.mutate(dto);
          }}
        />
      )}

      {isLoading ? (
        <div className="py-4">
          <Spinner className="h-5 w-5" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-ink-faint">No documents yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((d) => (
            <KnowledgeCard
              key={d.id}
              doc={d}
              onDelete={() => remove.mutate(d.id)}
              ingest={aiEnabled ? ingestById.get(d.id) : undefined}
              onReingest={aiEnabled ? () => reingest.mutate(d.id) : undefined}
              reingesting={reingest.isPending && reingest.variables === d.id}
            />
          ))}
        </ul>
      )}

      <ImportPicker
        open={importOpen}
        pending={importDoc.isPending}
        onClose={() => setImportOpen(false)}
        onPick={(id) => {
          setError(null);
          importDoc.mutate(id);
        }}
      />
    </div>
  );
}

function KnowledgeCard({
  doc,
  onDelete,
  ingest,
  onReingest,
  reingesting,
}: {
  doc: KnowledgeDocDto;
  onDelete: () => void;
  ingest?: KnowledgeIngestDto;
  onReingest?: () => void;
  reingesting?: boolean;
}) {
  const { Icon, color } = visualFor(doc);

  async function open() {
    if (doc.type === 'LINK' && doc.url) {
      window.open(doc.url, '_blank', 'noopener');
      return;
    }
    if (doc.rawUrl) {
      const url = await fetchKnowledgeBlobUrl(doc.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename || doc.title;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  }

  const disabled = doc.source.importBroken;

  return (
    <li className="group flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${color}1A`, color }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <button
        onClick={open}
        disabled={disabled}
        className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-ink dark:text-gray-100">
            {doc.title}
          </span>
          {doc.type === 'LINK' && !disabled && (
            <ExternalLink className="h-3 w-3 shrink-0 text-ink-faint" />
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-ink-faint">
          <SourceBadge source={doc.source} />
          {ingest && <IngestBadge ingest={ingest} />}
          <span>{doc.createdBy.displayName}</span>
          <span>· {relativeTime(doc.createdAt)}</span>
          {doc.type === 'FILE' && doc.size != null && (
            <span>· {formatBytes(doc.size)}</span>
          )}
        </div>
      </button>
      {onReingest && (
        <button
          onClick={onReingest}
          disabled={reingesting}
          title="Re-ingest for AI search"
          className="shrink-0 text-ink-faint opacity-0 transition-opacity hover:text-brand-600 disabled:opacity-40 group-hover:opacity-100"
        >
          <RefreshCw className={reingesting ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </button>
      )}
      {doc.canDelete && (
        <button
          onClick={onDelete}
          title="Remove"
          className="shrink-0 text-ink-faint opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

/** Renders origin (inherited / imported / removed) chips for a doc. */
function SourceBadge({ source }: { source: KnowledgeSource }) {
  if (source.importBroken) {
    return (
      <span className="inline-flex items-center rounded bg-red-50 px-1.5 py-px font-medium text-red-600 dark:bg-red-500/15 dark:text-red-300">
        source removed
      </span>
    );
  }
  return (
    <>
      {source.origin === 'inherited' && (
        <span
          className="inline-flex items-center gap-1 rounded bg-surface-sunken px-1.5 py-px font-medium text-ink-muted dark:bg-white/10 dark:text-gray-300"
          title={source.issueTitle}
        >
          <CornerDownRight className="h-3 w-3" />
          from {source.issueKey}
        </span>
      )}
      {source.imported && source.importedFrom && (
        <span className="inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-px font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          <Download className="h-3 w-3" />
          imported from {source.importedFrom.label}
        </span>
      )}
    </>
  );
}

function AddLinkForm({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (dto: CreateKnowledgeLinkDto) => void;
}) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const valid = title.trim() && /^https?:\/\//i.test(url.trim());
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit({ title: title.trim(), url: url.trim() });
      }}
      className="space-y-2 rounded-lg border border-line bg-surface-sunken p-3 dark:border-gray-700 dark:bg-gray-800/50"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (e.g. Product spec)"
        autoFocus
        className={inputClass}
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://docs.google.com/…"
        className={inputClass}
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" loading={pending} disabled={!valid}>
          Add link
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ImportPicker({
  open,
  pending,
  onClose,
  onPick,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onPick: (sourceDocId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 250);
  const { data: items = [], isLoading } = useQuery({
    queryKey: qk.importableKnowledge(debounced.trim()),
    queryFn: () => knowledgeApi.importable(debounced.trim()),
    enabled: open,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import from another knowledge base"
      size="md"
    >
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search documents…"
        autoFocus
        className={`${inputClass} mb-3`}
      />
      {isLoading ? (
        <div className="py-6 text-center">
          <Spinner className="mx-auto h-5 w-5" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-faint">
          No documents available to import.
        </p>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto scrollbar-thin">
          {items.map((it) => (
            <li key={it.id}>
              <button
                onClick={() => onPick(it.id)}
                disabled={pending}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-surface-sunken disabled:opacity-60 dark:hover:bg-white/10"
              >
                {it.type === 'FILE' ? (
                  <FileIcon className="h-4 w-4 shrink-0 text-ink-faint" />
                ) : (
                  <Link2 className="h-4 w-4 shrink-0 text-ink-faint" />
                )}
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink dark:text-gray-100">
                  {it.title}
                </span>
                <span className="shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] text-ink-muted dark:bg-white/10 dark:text-gray-300">
                  {it.ownerKind === 'team' ? 'Team' : 'Issue'} · {it.ownerLabel}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
