import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { ReportsDto } from '@tasku/types';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { RequireFeatureGuard } from '../features/require-feature.guard';
import { RequireFeature } from '../features/require-feature.decorator';

@UseGuards(JwtAuthGuard, RequireFeatureGuard)
@RequireFeature('reports')
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('projects/:key/reports')
  getReports(
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ReportsDto> {
    return this.reports.getReports(key, user.id);
  }
}
