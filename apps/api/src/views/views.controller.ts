import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  ViewActivityDto,
  ViewDto,
  ViewFieldDto,
  ViewRowDto,
  ViewSummaryDto,
} from '@tasku/types';
import { ViewsService } from './views.service';
import { CreateViewDto } from './dto/create-view.dto';
import { UpdateViewDto } from './dto/update-view.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('views')
export class ViewsController {
  constructor(private readonly views: ViewsService) {}

  @Get()
  list(
    @Query('starred') starred: string | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<ViewSummaryDto[]> {
    return this.views.list(user.id, starred === 'true');
  }

  // Declared before ':id' so it isn't swallowed by the param route.
  @Get('fields')
  fields(@CurrentUser() user: AuthUser): Promise<ViewFieldDto[]> {
    return this.views.fields(user.id);
  }

  @Post()
  create(
    @Body() dto: CreateViewDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ViewDto> {
    return this.views.create(dto, user.id);
  }

  @Get(':id')
  get(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ViewDto> {
    return this.views.get(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateViewDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ViewDto> {
    return this.views.update(id, dto, user.id);
  }

  @Post(':id/archive')
  archive(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.views.setArchived(id, true, user.id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.views.setArchived(id, false, user.id);
  }

  @Post(':id/star')
  star(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.views.star(id, user.id);
  }

  @Delete(':id/star')
  unstar(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.views.unstar(id, user.id);
  }

  @Get(':id/results')
  results(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ViewRowDto[]> {
    return this.views.results(id, user.id);
  }

  @Get(':id/activity')
  activity(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ViewActivityDto[]> {
    return this.views.activity(id, user.id);
  }
}
