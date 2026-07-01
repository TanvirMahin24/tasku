import { Injectable, Logger } from '@nestjs/common';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from '@langchain/google-genai';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import type { AiProvider } from '@tasku/types';
import { AiConfig } from '../ai.config';

export interface ProviderBundle {
  chat: BaseChatModel;
  embeddings: Embeddings;
  meta: {
    provider: AiProvider;
    chatModel: string;
    embedModel: string;
  };
}

/**
 * Instantiates the LangChain chat + embedding models for the active provider.
 * All models produce 768-dim embeddings (text-embedding-004 / nomic-embed-text)
 * to match the pgvector `vector(768)` columns.
 *
 * Adding a provider = one branch in {@link create}.
 */
@Injectable()
export class ProviderFactory {
  private readonly logger = new Logger(ProviderFactory.name);

  constructor(private readonly config: AiConfig) {}

  async create(): Promise<ProviderBundle | null> {
    const provider = await this.config.activeProvider();
    if (!provider) return null;

    try {
      if (provider === 'gemini') {
        const chatModel = this.config.geminiModel;
        const embedModel = this.config.geminiEmbedModel;
        return {
          chat: new ChatGoogleGenerativeAI({
            apiKey: this.config.geminiApiKey,
            model: chatModel,
            temperature: 0.2,
            maxRetries: 1,
          }),
          embeddings: new GoogleGenerativeAIEmbeddings({
            apiKey: this.config.geminiApiKey,
            model: embedModel,
          }),
          meta: { provider, chatModel, embedModel },
        };
      }

      // provider === 'ollama'
      const chatModel = this.config.ollamaModel;
      const embedModel = this.config.ollamaEmbedModel;
      const baseUrl = this.config.ollamaBaseUrl;
      return {
        chat: new ChatOllama({ baseUrl, model: chatModel, temperature: 0.2 }),
        embeddings: new OllamaEmbeddings({ baseUrl, model: embedModel }),
        meta: { provider, chatModel, embedModel },
      };
    } catch (err) {
      this.logger.warn(`Failed to build ${provider} provider: ${String(err)}`);
      return null;
    }
  }
}
