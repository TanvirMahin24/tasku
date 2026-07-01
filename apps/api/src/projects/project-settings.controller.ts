import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import type { ComponentDto, LabelDto, StatusDto } from '@tasku/types';
import { ProjectsService } from './projects.service';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateComponentDto } from './dto/update-component.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

/**
 * Id-addressed project-settings mutations that live at the root (not under
 * `/projects/:key`): individual statuses and components are edited/deleted by
 * their own id. All routes are ADMIN-only (enforced in ProjectsService via the
 * owning project's membership).
 */
@UseGuards(JwtAuthGuard)
@Controller()
export class ProjectSettingsController {
  constructor(private readonly projects: ProjectsService) {}

  // --- Statuses ---
  @Patch('statuses/:id')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ): Promise<StatusDto> {
    return this.projects.updateStatus(id, dto, user.id);
  }

  @Delete('statuses/:id')
  deleteStatus(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projects.deleteStatus(id, user.id);
  }

  // --- Components ---
  @Patch('components/:id')
  updateComponent(
    @Param('id') id: string,
    @Body() dto: UpdateComponentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ComponentDto> {
    return this.projects.updateComponent(id, dto, user.id);
  }

  @Delete('components/:id')
  deleteComponent(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projects.deleteComponent(id, user.id);
  }

  // --- Labels ---
  @Patch('labels/:id')
  updateLabel(
    @Param('id') id: string,
    @Body() dto: UpdateLabelDto,
    @CurrentUser() user: AuthUser,
  ): Promise<LabelDto> {
    return this.projects.updateLabel(id, dto, user.id);
  }

  @Delete('labels/:id')
  deleteLabel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.projects.deleteLabel(id, user.id);
  }
}
