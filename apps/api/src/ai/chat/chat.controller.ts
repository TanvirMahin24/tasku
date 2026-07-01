import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  ChatResponseDto,
  ChatSessionDto,
  ChatSessionSummaryDto,
} from '@tasku/types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/current-user.decorator';
import { ChatService } from './chat.service';
import { SendChatDto } from './dto/send-chat.dto';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('chat')
  send(
    @Body() dto: SendChatDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ChatResponseDto> {
    return this.chat.send(user.id, dto);
  }

  @Get('sessions')
  listSessions(
    @CurrentUser() user: AuthUser,
  ): Promise<ChatSessionSummaryDto[]> {
    return this.chat.listSessions(user.id);
  }

  @Get('sessions/:id')
  getSession(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ChatSessionDto> {
    return this.chat.getSession(id, user.id);
  }

  @Delete('sessions/:id')
  deleteSession(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ success: boolean }> {
    return this.chat.deleteSession(id, user.id);
  }
}
