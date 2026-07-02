import { Module } from '@nestjs/common';
import { FeaturesModule } from '../features/features.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [FeaturesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
