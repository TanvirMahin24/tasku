import { AlertCircle, Ban, CheckCircle2, Clock } from 'lucide-react';
import clsx from 'clsx';
import type { KnowledgeIngestDto, KnowledgeIngestStatus } from '@tasku/types';

const META: Record<
  KnowledgeIngestStatus,
  { label: string; icon: typeof Clock; className: string }
> = {
  READY: {
    label: 'Ready',
    icon: CheckCircle2,
    className:
      'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  },
  PENDING: {
    label: 'Pending',
    icon: Clock,
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  },
  ERROR: {
    label: 'Error',
    icon: AlertCircle,
    className: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  },
  UNSUPPORTED: {
    label: 'Unsupported',
    icon: Ban,
    className:
      'bg-surface-sunken text-ink-muted dark:bg-white/10 dark:text-gray-300',
  },
};

/** Small pill summarizing a doc's RAG ingestion state. */
export function IngestBadge({ ingest }: { ingest: KnowledgeIngestDto }) {
  const meta = META[ingest.ingestStatus];
  const Icon = meta.icon;
  const title =
    ingest.ingestStatus === 'ERROR' && ingest.ingestError
      ? ingest.ingestError
      : ingest.ingestStatus === 'READY'
        ? `${ingest.chunkCount} chunk${ingest.chunkCount === 1 ? '' : 's'} indexed`
        : undefined;
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 rounded px-1.5 py-px text-[11px] font-medium leading-none',
        meta.className,
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
      {ingest.ingestStatus === 'READY' && ingest.chunkCount > 0 && (
        <span className="opacity-70">· {ingest.chunkCount}</span>
      )}
    </span>
  );
}
