import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { KnowledgeIngestDto } from '@tasku/types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/current-user.decorator';
import { IngestService } from './ingest.service';

@UseGuards(JwtAuthGuard)
@Controller('ai/knowledge')
export class IngestController {
  constructor(private readonly ingest: IngestService) {}

  @Post(':docId/ingest')
  ingestDoc(
    @Param('docId') docId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<KnowledgeIngestDto> {
    return this.ingest.ingest(docId, user.id);
  }

  @Get('ingest-status')
  status(
    @CurrentUser() user: AuthUser,
    @Query('teamId') teamId?: string,
    @Query('issueId') issueId?: string,
  ): Promise<KnowledgeIngestDto[]> {
    return this.ingest.listStatus(user.id, teamId, issueId);
  }
}
