import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { TimelineDto } from '@tasku/types';
import { TimelineService } from './timeline.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get(':key/timeline')
  getTimeline(
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
  ): Promise<TimelineDto> {
    return this.timeline.getTimeline(key, user.id);
  }
}
