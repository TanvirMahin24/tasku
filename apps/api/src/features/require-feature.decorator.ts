import { SetMetadata } from '@nestjs/common';
import type { FeatureKey } from '@tasku/types';

export const REQUIRE_FEATURE_KEY = 'requireFeature';

/**
 * Mark a route (or controller) as requiring a feature to be enabled for the
 * current user. Enforced by `RequireFeatureGuard`.
 */
export const RequireFeature = (feature: FeatureKey) =>
  SetMetadata(REQUIRE_FEATURE_KEY, feature);
