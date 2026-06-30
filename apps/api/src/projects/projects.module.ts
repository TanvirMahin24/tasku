import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectSettingsController } from './project-settings.controller';

@Module({
  controllers: [ProjectsController, ProjectSettingsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
