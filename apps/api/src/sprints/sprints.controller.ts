import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { SprintDto } from '@tasku/types';
import { SprintsService } from './sprints.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Get('projects/:key/sprints')
  list(
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
  ): Promise<SprintDto[]> {
    return this.sprints.list(key, user.id);
  }

  @Post('projects/:key/sprints')
  create(
    @Param('key') key: string,
    @Body() dto: CreateSprintDto,
    @CurrentUser() user: AuthUser,
  ): Promise<SprintDto> {
    return this.sprints.create(key, dto, user.id);
  }

  @Post('sprints/:id/start')
  start(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<SprintDto> {
    return this.sprints.start(id, user.id);
  }

  @Post('sprints/:id/complete')
  complete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<SprintDto> {
    return this.sprints.complete(id, user.id);
  }
}
