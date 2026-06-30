import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { OverviewDto } from '@tasku/types';
import { OverviewService } from './overview.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get(':key/overview')
  getOverview(
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
  ): Promise<OverviewDto> {
    return this.overview.getOverview(key, user.id);
  }
}
