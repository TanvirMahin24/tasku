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
import type { VersionDto } from '@tasku/types';
import { VersionsService } from './versions.service';
import { CreateVersionDto } from './dto/create-version.dto';
import { UpdateVersionDto } from './dto/update-version.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { RequireFeatureGuard } from '../features/require-feature.guard';
import { RequireFeature } from '../features/require-feature.decorator';

@UseGuards(JwtAuthGuard, RequireFeatureGuard)
@RequireFeature('releases')
@Controller()
export class VersionsController {
  constructor(private readonly versions: VersionsService) {}

  @Get('projects/:key/versions')
  list(
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
  ): Promise<VersionDto[]> {
    return this.versions.list(key, user.id);
  }

  @Post('projects/:key/versions')
  create(
    @Param('key') key: string,
    @Body() dto: CreateVersionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<VersionDto> {
    return this.versions.create(key, dto, user.id);
  }

  @Patch('versions/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVersionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<VersionDto> {
    return this.versions.update(id, dto, user.id);
  }

  @Delete('versions/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.versions.remove(id, user.id);
  }
}
