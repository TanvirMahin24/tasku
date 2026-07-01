import { Injectable } from '@nestjs/common';
import type { AiProvider } from '@tasku/types';

interface CachedHealth {
  value: boolean;
  ts: number;
}

/**
 * Central reader for every Majhi-related env var + provider availability.
 *
 * Adding a provider = add a branch here and in {@link ProviderFactory}. Nothing
 * throws when unconfigured: {@link activeProvider} simply resolves to `null` and
 * the rest of the module degrades to a friendly "configure a provider" state.
 */
@Injectable()
export class AiConfig {
  private ollamaHealth: CachedHealth | null = null;
  private static readonly HEALTH_TTL_MS = 30_000;
  private static readonly HEALTH_TIMEOUT_MS = 1_500;

  // --- raw env -------------------------------------------------------------
  get forcedProvider(): AiProvider | '' {
    const v = (process.env.AI_PROVIDER || '').trim().toLowerCase();
    return v === 'ollama' || v === 'gemini' ? v : '';
  }

  get geminiApiKey(): string {
    return (process.env.GEMINI_API_KEY || '').trim();
  }
  get geminiModel(): string {
    return process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  }
  get geminiEmbedModel(): string {
    return process.env.GEMINI_EMBED_MODEL || 'text-embedding-004';
  }

  get ollamaBaseUrl(): string {
    return (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(
      /\/+$/,
      '',
    );
  }
  get ollamaModel(): string {
    return process.env.OLLAMA_MODEL || 'llama3.1';
  }
  get ollamaEmbedModel(): string {
    return process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
  }

  // --- availability --------------------------------------------------------
  hasGemini(): boolean {
    return this.geminiApiKey.length > 0;
  }

  /** Cached `GET {OLLAMA_BASE_URL}/api/tags` probe (1.5s timeout). */
  async hasOllama(): Promise<boolean> {
    const now = Date.now();
    if (
      this.ollamaHealth &&
      now - this.ollamaHealth.ts < AiConfig.HEALTH_TTL_MS
    ) {
      return this.ollamaHealth.value;
    }
    let value = false;
    try {
      const res = await fetch(`${this.ollamaBaseUrl}/api/tags`, {
        signal: AbortSignal.timeout(AiConfig.HEALTH_TIMEOUT_MS),
      });
      value = res.ok;
    } catch {
      value = false;
    }
    this.ollamaHealth = { value, ts: now };
    return value;
  }

  async getProviders(): Promise<{ ollama: boolean; gemini: boolean }> {
    const [gemini, ollama] = await Promise.all([
      Promise.resolve(this.hasGemini()),
      this.hasOllama(),
    ]);
    return { ollama, gemini };
  }

  /**
   * The provider Majhi will use: a forced `AI_PROVIDER` (when available), else
   * Gemini if a key is present, else Ollama if reachable, else `null`.
   */
  async activeProvider(): Promise<AiProvider | null> {
    const forced = this.forcedProvider;
    if (forced === 'gemini') return this.hasGemini() ? 'gemini' : null;
    if (forced === 'ollama') return (await this.hasOllama()) ? 'ollama' : null;
    if (this.hasGemini()) return 'gemini';
    if (await this.hasOllama()) return 'ollama';
    return null;
  }

  /** Model names for the active provider (null when nothing is configured). */
  async models(): Promise<{ chatModel: string | null; embedModel: string | null }> {
    const provider = await this.activeProvider();
    if (provider === 'gemini') {
      return { chatModel: this.geminiModel, embedModel: this.geminiEmbedModel };
    }
    if (provider === 'ollama') {
      return { chatModel: this.ollamaModel, embedModel: this.ollamaEmbedModel };
    }
    return { chatModel: null, embedModel: null };
  }
}
