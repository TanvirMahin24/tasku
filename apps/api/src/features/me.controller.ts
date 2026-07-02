import { Controller, Get, UseGuards } from '@nestjs/common';
import type { FeatureMap } from '@tasku/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { FeatureService } from './features.service';

@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly features: FeatureService) {}

  /** Effective feature map for the current user. */
  @Get('features')
  features_(@CurrentUser() user: AuthUser): Promise<FeatureMap> {
    return this.features.effectiveFor(user.id);
  }
}
