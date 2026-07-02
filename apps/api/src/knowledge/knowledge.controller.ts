import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type {
  CreateKnowledgeLinkDto,
  ImportKnowledgeDto,
  ImportableKnowledgeDocDto,
  KnowledgeDocDto,
  KnowledgeListItemDto,
  KnowledgeListQuery,
} from '@tasku/types';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  // --- Global KB (sidebar Knowledge page) ---
  @Get('knowledge')
  listAll(
    @Query() query: KnowledgeListQuery,
    @CurrentUser() user: AuthUser,
  ): Promise<KnowledgeListItemDto[]> {
    return this.knowledge.listAll(user.id, query);
  }

  // --- Team KB ---
  @Get('teams/:id/knowledge')
  listTeam(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<KnowledgeDocDto[]> {
    return this.knowledge.listTeam(id, user.id);
  }

  @Post('teams/:id/knowledge/link')
  createTeamLink(
    @Param('id') id: string,
    @Body() dto: CreateKnowledgeLinkDto,
    @CurrentUser() user: AuthUser,
  ): Promise<KnowledgeDocDto> {
    return this.knowledge.createTeamLink(id, dto, user.id);
  }

  @Post('teams/:id/knowledge/file')
  @UseInterceptors(FileInterceptor('file'))
  createTeamFile(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body('title') title: string | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<KnowledgeDocDto> {
    return this.knowledge.createTeamFile(id, file, title, user.id);
  }

  @Post('teams/:id/knowledge/import')
  importToTeam(
    @Param('id') id: string,
    @Body() dto: ImportKnowledgeDto,
    @CurrentUser() user: AuthUser,
  ): Promise<KnowledgeDocDto> {
    return this.knowledge.importToTeam(id, dto.sourceDocId, user.id);
  }

  // --- Issue KB ---
  @Get('issues/:issueKey/knowledge')
  listIssue(
    @Param('issueKey') issueKey: string,
    @CurrentUser() user: AuthUser,
  ): Promise<KnowledgeDocDto[]> {
    return this.knowledge.listIssueEffective(issueKey, user.id);
  }

  @Post('issues/:issueKey/knowledge/link')
  createIssueLink(
    @Param('issueKey') issueKey: string,
    @Body() dto: CreateKnowledgeLinkDto,
    @CurrentUser() user: AuthUser,
  ): Promise<KnowledgeDocDto> {
    return this.knowledge.createIssueLink(issueKey, dto, user.id);
  }

  @Post('issues/:issueKey/knowledge/file')
  @UseInterceptors(FileInterceptor('file'))
  createIssueFile(
    @Param('issueKey') issueKey: string,
    @UploadedFile() file: any,
    @Body('title') title: string | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<KnowledgeDocDto> {
    return this.knowledge.createIssueFile(issueKey, file, title, user.id);
  }

  @Post('issues/:issueKey/knowledge/import')
  importToIssue(
    @Param('issueKey') issueKey: string,
    @Body() dto: ImportKnowledgeDto,
    @CurrentUser() user: AuthUser,
  ): Promise<KnowledgeDocDto> {
    return this.knowledge.importToIssue(issueKey, dto.sourceDocId, user.id);
  }

  // --- Shared ---
  @Get('knowledge/importable')
  importable(
    @Query('search') search: string | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<ImportableKnowledgeDocDto[]> {
    return this.knowledge.importable(user.id, search);
  }

  @Get('knowledge/:id/raw')
  async raw(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, mimeType, filename } = await this.knowledge.getFile(
      id,
      user.id,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${filename.replace(/"/g, '')}"`,
    });
    return new StreamableFile(stream);
  }

  @Delete('knowledge/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.knowledge.remove(id, user.id);
  }
}
