import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FeatureKey } from '@tasku/types';
import { REQUIRE_FEATURE_KEY } from './require-feature.decorator';
import { FeatureService } from './features.service';

/**
 * Blocks a request when the `@RequireFeature(key)` feature is disabled for the
 * current user. Must run after `JwtAuthGuard` so `req.user` is populated.
 */
@Injectable()
export class RequireFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly features: FeatureService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<FeatureKey | undefined>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!feature) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.id) throw new ForbiddenException('Not authenticated');

    const map = await this.features.effectiveFor(user.id);
    if (map[feature] === false) {
      throw new ForbiddenException(`Feature "${feature}" is disabled`);
    }
    return true;
  }
}
