import type {
  AiStatusDto,
  ChatResponseDto,
  ChatSessionDto,
  ChatSessionSummaryDto,
  GoogleStatusDto,
  KnowledgeIngestDto,
  SendChatDto,
} from '@tasku/types';
import { api } from './api';

// The AI/Google connect endpoints are hit by full-page navigation (OAuth 302),
// so we need the absolute base URL, mirroring api.ts.
export const AI_API_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

export interface IngestStatusParams {
  teamId?: string;
  issueId?: string;
}

export const aiApi = {
  status: () => api.get<AiStatusDto>('/ai/status').then((r) => r.data),

  // --- Chat ---
  chat: (dto: SendChatDto) =>
    api.post<ChatResponseDto>('/ai/chat', dto).then((r) => r.data),
  sessions: () =>
    api.get<ChatSessionSummaryDto[]>('/ai/sessions').then((r) => r.data),
  session: (id: string) =>
    api.get<ChatSessionDto>(`/ai/sessions/${id}`).then((r) => r.data),
  deleteSession: (id: string) =>
    api.delete<void>(`/ai/sessions/${id}`).then((r) => r.data),

  // --- Google integration ---
  googleStatus: () =>
    api.get<GoogleStatusDto>('/ai/google/status').then((r) => r.data),
  disconnectGoogle: () =>
    api.delete<void>('/ai/google').then((r) => r.data),

  // --- Knowledge RAG ingestion ---
  ingestStatus: (params: IngestStatusParams) =>
    api
      .get<KnowledgeIngestDto[]>('/ai/knowledge/ingest-status', {
        params: {
          ...(params.teamId ? { teamId: params.teamId } : {}),
          ...(params.issueId ? { issueId: params.issueId } : {}),
        },
      })
      .then((r) => r.data),
  ingest: (docId: string) =>
    api
      .post<KnowledgeIngestDto>(`/ai/knowledge/${docId}/ingest`)
      .then((r) => r.data),
};

/**
 * Full-page URL that kicks off Google OAuth. The server 302s to Google's
 * consent screen, then back to the app. Prefer a server-provided authUrl when
 * available (it carries the correct redirect/state); fall back to the connect
 * endpoint otherwise.
 */
export function googleConnectUrl(authUrl?: string | null): string {
  return authUrl ?? `${AI_API_URL}/ai/google/connect`;
}
