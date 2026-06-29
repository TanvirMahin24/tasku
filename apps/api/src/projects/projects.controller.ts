import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  ProjectDto,
  StatusDto,
  LabelDto,
  SprintDto,
} from '@tasku/types';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateLabelDto } from './dto/create-label.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ProjectDto> {
    return this.projects.create(dto, user.id);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser): Promise<ProjectDto[]> {
    return this.projects.findAllForUser(user.id);
  }

  @Get(':key')
  findOne(
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ProjectDto> {
    return this.projects.findOne(key, user.id);
  }

  @Patch(':key')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ProjectDto> {
    return this.projects.update(key, dto, user.id);
  }

  @Delete(':key')
  remove(@Param('key') key: string, @CurrentUser() user: AuthUser) {
    return this.projects.remove(key, user.id);
  }

  // --- Members ---------------------------------------------------------------

  @Get(':key/members')
  listMembers(@Param('key') key: string, @CurrentUser() user: AuthUser) {
    return this.projects.listMembers(key, user.id);
  }

  @Post(':key/members')
  addMember(
    @Param('key') key: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.projects.addMember(key, dto, user.id);
  }

  // --- Statuses --------------------------------------------------------------

  @Get(':key/statuses')
  listStatuses(
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StatusDto[]> {
    return this.projects.listStatuses(key, user.id);
  }

  // --- Labels ----------------------------------------------------------------

  @Get(':key/labels')
  listLabels(
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
  ): Promise<LabelDto[]> {
    return this.projects.listLabels(key, user.id);
  }

  @Post(':key/labels')
  createLabel(
    @Param('key') key: string,
    @Body() dto: CreateLabelDto,
    @CurrentUser() user: AuthUser,
  ): Promise<LabelDto> {
    return this.projects.createLabel(key, dto, user.id);
  }

  // --- Sprints (listing) -----------------------------------------------------

  @Get(':key/sprints')
  listSprints(
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
  ): Promise<SprintDto[]> {
    return this.projects.listSprints(key, user.id);
  }
}
