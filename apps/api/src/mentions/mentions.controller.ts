import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { MentionableDto } from '@tasku/types';
import { MentionsService } from './mentions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class MentionsController {
  constructor(private readonly mentions: MentionsService) {}

  @Get('projects/:key/mentionables')
  search(
    @Param('key') key: string,
    @Query('q') q: string | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<MentionableDto[]> {
    return this.mentions.search(key, q, user.id);
  }
}
