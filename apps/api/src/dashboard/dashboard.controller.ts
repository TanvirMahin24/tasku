import { Controller, Get, UseGuards } from '@nestjs/common';
import type { DashboardDto } from '@tasku/types';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentUser() user: AuthUser): Promise<DashboardDto> {
    return this.dashboard.get(user.id);
  }
}
