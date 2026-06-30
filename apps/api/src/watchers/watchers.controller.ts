import { Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import type { UserDto } from '@tasku/types';
import { WatchersService } from './watchers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class WatchersController {
  constructor(private readonly watchers: WatchersService) {}

  @Post('issues/:issueKey/watch')
  watch(
    @Param('issueKey') issueKey: string,
    @CurrentUser() user: AuthUser,
  ): Promise<UserDto[]> {
    return this.watchers.watch(issueKey, user.id);
  }

  @Delete('issues/:issueKey/watch')
  unwatch(
    @Param('issueKey') issueKey: string,
    @CurrentUser() user: AuthUser,
  ): Promise<UserDto[]> {
    return this.watchers.unwatch(issueKey, user.id);
  }
}
