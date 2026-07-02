import { Module } from '@nestjs/common';
import { FeatureService } from './features.service';
import { RequireFeatureGuard } from './require-feature.guard';
import { MeController } from './me.controller';

/**
 * Feature-flag system. Exports `FeatureService` and `RequireFeatureGuard` so
 * the admin module and feature-guarded controllers can reuse them.
 */
@Module({
  controllers: [MeController],
  providers: [FeatureService, RequireFeatureGuard],
  exports: [FeatureService, RequireFeatureGuard],
})
export class FeaturesModule {}
