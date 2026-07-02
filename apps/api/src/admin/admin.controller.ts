import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type {
  AdminUserDto,
  BanUserDto,
  FeatureDef,
  FeatureOverrideDto,
  SetFeatureOverrideDto,
  UpdatePlatformRoleDto,
} from '@tasku/types';
import { FEATURES } from '@tasku/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { SuperAdminGuard } from './super-admin.guard';
import { AdminService } from './admin.service';
import { FeatureService } from '../features/features.service';

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly features: FeatureService,
  ) {}

  // --- Users ---
  @Get('users')
  listUsers(): Promise<AdminUserDto[]> {
    return this.admin.listUsers();
  }

  @Patch('users/:id/role')
  setRole(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformRoleDto,
  ): Promise<AdminUserDto> {
    return this.admin.setRole(id, dto);
  }

  @Post('users/:id/ban')
  ban(
    @Param('id') id: string,
    @Body() dto: BanUserDto,
    @CurrentUser() user: AuthUser,
  ): Promise<AdminUserDto> {
    return this.admin.ban(id, dto, user.id);
  }

  @Post('users/:id/unban')
  unban(@Param('id') id: string): Promise<AdminUserDto> {
    return this.admin.unban(id);
  }

  // --- Feature flags ---
  @Get('features')
  async listFeatures(): Promise<{
    catalog: FeatureDef[];
    overrides: FeatureOverrideDto[];
  }> {
    return { catalog: FEATURES, overrides: await this.features.list() };
  }

  @Put('features')
  setFeature(
    @Body() dto: SetFeatureOverrideDto,
  ): Promise<FeatureOverrideDto> {
    return this.features.set(dto);
  }

  @Delete('features/:id')
  removeFeature(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.features.remove(id);
  }
}
