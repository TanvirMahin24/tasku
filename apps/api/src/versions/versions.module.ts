import { Module } from '@nestjs/common';
import { VersionsService } from './versions.service';
import { VersionsController } from './versions.controller';
import { FeaturesModule } from '../features/features.module';

@Module({
  imports: [FeaturesModule],
  controllers: [VersionsController],
  providers: [VersionsService],
})
export class VersionsModule {}
