import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { IssueLinkDto } from '@tasku/types';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dto/create-link.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Post('issues/:issueKey/links')
  create(
    @Param('issueKey') issueKey: string,
    @Body() dto: CreateLinkDto,
    @CurrentUser() user: AuthUser,
  ): Promise<IssueLinkDto> {
    return this.links.create(issueKey, dto, user.id);
  }

  @Delete('links/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.links.remove(id, user.id);
  }
}
