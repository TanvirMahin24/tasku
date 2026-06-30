import { Module } from '@nestjs/common';
import { WorklogsService } from './worklogs.service';
import { WorklogsController } from './worklogs.controller';

@Module({
  controllers: [WorklogsController],
  providers: [WorklogsService],
})
export class WorklogsModule {}
