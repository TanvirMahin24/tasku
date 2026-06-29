import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { CommentDto } from '@tasku/types';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('issues/:issueKey/comments')
  list(
    @Param('issueKey') issueKey: string,
    @CurrentUser() user: AuthUser,
  ): Promise<CommentDto[]> {
    return this.comments.list(issueKey, user.id);
  }

  @Post('issues/:issueKey/comments')
  create(
    @Param('issueKey') issueKey: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CommentDto> {
    return this.comments.create(issueKey, dto, user.id);
  }

  @Delete('comments/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.comments.remove(id, user.id);
  }
}
