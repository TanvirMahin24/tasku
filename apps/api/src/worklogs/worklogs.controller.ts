import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { WorklogDto } from '@tasku/types';
import { WorklogsService } from './worklogs.service';
import { CreateWorklogDto } from './dto/create-worklog.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class WorklogsController {
  constructor(private readonly worklogs: WorklogsService) {}

  @Post('issues/:issueKey/worklogs')
  create(
    @Param('issueKey') issueKey: string,
    @Body() dto: CreateWorklogDto,
    @CurrentUser() user: AuthUser,
  ): Promise<WorklogDto> {
    return this.worklogs.create(issueKey, dto, user.id);
  }

  @Delete('worklogs/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.worklogs.remove(id, user.id);
  }
}
