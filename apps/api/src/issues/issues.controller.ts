import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { IssueDetailDto, IssueSummaryDto } from '@tasku/types';
import { IssuesService } from './issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { MoveIssueDto } from './dto/move-issue.dto';
import { ListIssuesQuery } from './dto/list-issues.query';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { BulkUpdateDto } from './dto/bulk-update.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  // --- Project-scoped ---
  @Post('projects/:key/issues')
  create(
    @Param('key') key: string,
    @Body() dto: CreateIssueDto,
    @CurrentUser() user: AuthUser,
  ): Promise<IssueDetailDto> {
    return this.issues.create(key, dto, user.id);
  }

  @Post('projects/:key/issues/bulk')
  bulkUpdate(
    @Param('key') key: string,
    @Body() dto: BulkUpdateDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ updated: number }> {
    return this.issues.bulkUpdate(key, dto, user.id);
  }

  @Get('projects/:key/issues')
  findAll(
    @Param('key') key: string,
    @Query() query: ListIssuesQuery,
    @CurrentUser() user: AuthUser,
  ): Promise<IssueSummaryDto[]> {
    return this.issues.findAll(key, query, user.id);
  }

  // --- Issue-scoped ---
  @Get('issues/:issueKey')
  findOne(
    @Param('issueKey') issueKey: string,
    @CurrentUser() user: AuthUser,
  ): Promise<IssueDetailDto> {
    return this.issues.findOne(issueKey, user.id);
  }

  @Patch('issues/:issueKey')
  update(
    @Param('issueKey') issueKey: string,
    @Body() dto: UpdateIssueDto,
    @CurrentUser() user: AuthUser,
  ): Promise<IssueDetailDto> {
    return this.issues.update(issueKey, dto, user.id);
  }

  @Post('issues/:issueKey/subtasks')
  createSubtask(
    @Param('issueKey') issueKey: string,
    @Body() dto: CreateSubtaskDto,
    @CurrentUser() user: AuthUser,
  ): Promise<IssueDetailDto> {
    return this.issues.createSubtask(issueKey, dto, user.id);
  }

  @Post('issues/:issueKey/move')
  move(
    @Param('issueKey') issueKey: string,
    @Body() dto: MoveIssueDto,
    @CurrentUser() user: AuthUser,
  ): Promise<IssueSummaryDto> {
    return this.issues.move(issueKey, dto, user.id);
  }

  @Delete('issues/:issueKey')
  remove(
    @Param('issueKey') issueKey: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.issues.remove(issueKey, user.id);
  }
}
