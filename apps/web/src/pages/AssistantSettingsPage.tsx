import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cpu,
  ExternalLink,
  Link2,
  Sparkles,
  Unlink,
} from 'lucide-react';
import type { AiStatusDto, GoogleStatusDto } from '@tasku/types';
import { aiApi, googleConnectUrl } from '@/lib/ai';
import { apiErrorMessage } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSpinner } from '@/components/ui/Spinner';

export default function AssistantSettingsPage() {
  const { data: status, isLoading } = useQuery({
    queryKey: qk.aiStatus,
    queryFn: aiApi.status,
  });

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-600" /> Assistant
          </span>
        }
        subtitle="Configure Majhi, your AI assistant, and its knowledge sources."
      />
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin dark:bg-gray-950">
        <div className="mx-auto max-w-2xl space-y-5">
          {isLoading || !status ? (
            <PageSpinner label="Loading assistant status…" />
          ) : (
            <>
              <ProviderCard status={status} />
              <GoogleCard />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-white p-5 shadow-card dark:border-gray-700 dark:bg-gray-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink dark:text-gray-100">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-soft py-2 last:border-0 dark:border-gray-800">
      <span className="text-[13px] text-ink-muted dark:text-gray-400">
        {label}
      </span>
      <span className="text-[13px] font-medium text-ink dark:text-gray-100">
        {children}
      </span>
    </div>
  );
}

function ProviderCard({ status }: { status: AiStatusDto }) {
  if (!status.enabled) {
    return (
      <Card title="AI provider" icon={<Cpu className="h-4 w-4 text-ink-muted" />}>
        <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="font-medium">Not configured</p>
          <p className="mt-0.5">
            Set{' '}
            <code className="rounded bg-black/5 px-1 font-mono text-xs dark:bg-white/10">
              GEMINI_API_KEY
            </code>{' '}
            for Google Gemini, or run{' '}
            <a
              href="https://ollama.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-600 hover:underline"
            >
              Ollama
            </a>{' '}
            locally, then restart the API.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card title="AI provider" icon={<Cpu className="h-4 w-4 text-ink-muted" />}>
      <div>
        <Row label="Active provider">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            {status.provider === 'gemini'
              ? 'Google Gemini'
              : status.provider === 'ollama'
                ? 'Ollama'
                : '—'}
          </span>
        </Row>
        <Row label="Chat model">
          <span className="font-mono text-xs">{status.chatModel ?? '—'}</span>
        </Row>
        <Row label="Embedding model">
          <span className="font-mono text-xs">{status.embedModel ?? '—'}</span>
        </Row>
        <Row label="Providers detected">
          <span className="flex items-center gap-1.5">
            <ProviderPill on={status.providers.gemini}>Gemini</ProviderPill>
            <ProviderPill on={status.providers.ollama}>Ollama</ProviderPill>
          </span>
        </Row>
      </div>
    </Card>
  );
}

function ProviderPill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={
        on
          ? 'rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-500/15 dark:text-green-300'
          : 'rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-faint dark:bg-white/10'
      }
    >
      {children}
    </span>
  );
}

function GoogleCard() {
  const qc = useQueryClient();
  const { data: google, isLoading } = useQuery<GoogleStatusDto>({
    queryKey: qk.aiGoogleStatus,
    queryFn: aiApi.googleStatus,
  });

  const disconnect = useMutation({
    mutationFn: aiApi.disconnectGoogle,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.aiGoogleStatus });
      qc.invalidateQueries({ queryKey: qk.aiStatus });
    },
  });

  return (
    <Card
      title="Google connection"
      icon={<Link2 className="h-4 w-4 text-ink-muted" />}
    >
      <p className="mb-3 text-[13px] text-ink-muted dark:text-gray-400">
        Connect Google to let Majhi read linked Google Docs, Sheets and Slides
        as knowledge.
      </p>
      {isLoading || !google ? (
        <p className="text-sm text-ink-faint">Checking connection…</p>
      ) : google.connected ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-[13px] text-ink dark:text-gray-100">
              Connected{google.email ? ` as ${google.email}` : ''}
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            loading={disconnect.isPending}
            onClick={() => disconnect.mutate()}
          >
            <Unlink className="h-4 w-4" /> Disconnect
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-ink-muted dark:text-gray-400">
            Not connected
          </span>
          <Button
            size="sm"
            onClick={() => {
              window.location.href = googleConnectUrl(google.authUrl);
            }}
          >
            <ExternalLink className="h-4 w-4" /> Connect Google
          </Button>
        </div>
      )}
      {disconnect.isError && (
        <p className="mt-2 text-xs text-red-600">
          {apiErrorMessage(disconnect.error, 'Could not disconnect Google')}
        </p>
      )}
    </Card>
  );
}
