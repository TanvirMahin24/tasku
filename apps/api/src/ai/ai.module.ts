import { Module } from '@nestjs/common';
import { IssuesModule } from '../issues/issues.module';
import { FeaturesModule } from '../features/features.module';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';
import { AiConfig } from './ai.config';
import { ProviderFactory } from './providers/provider.factory';
import { RagService } from './rag/rag.service';
import { MajhiAgent } from './agent/majhi.agent';
import { ChatService } from './chat/chat.service';
import { GoogleService } from './google/google.service';
import { IngestService } from './knowledge-ingest/ingest.service';
import { StatusController } from './status.controller';
import { ChatController } from './chat/chat.controller';
import { GoogleController } from './google/google.controller';
import { IngestController } from './knowledge-ingest/ingest.controller';

/**
 * Majhi — the extensible LangChain multi-tool AI assistant.
 *
 * Extensibility: add a tool = one file in `tools/` + one line in `tools/index.ts`;
 * add a provider = one branch in `AiConfig` + `ProviderFactory`.
 */
@Module({
  imports: [IssuesModule, FeaturesModule, CustomFieldsModule],
  controllers: [
    StatusController,
    ChatController,
    GoogleController,
    IngestController,
  ],
  providers: [
    AiConfig,
    ProviderFactory,
    RagService,
    MajhiAgent,
    ChatService,
    GoogleService,
    IngestService,
  ],
  exports: [RagService, GoogleService],
})
export class AiModule {}
