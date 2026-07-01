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
import type { TeamDto } from '@tasku/types';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  findAll(): Promise<TeamDto[]> {
    return this.teams.findAll();
  }

  @Post()
  create(
    @Body() dto: CreateTeamDto,
    @CurrentUser() user: AuthUser,
  ): Promise<TeamDto> {
    return this.teams.create(dto, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<TeamDto> {
    return this.teams.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
  ): Promise<TeamDto> {
    return this.teams.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.teams.remove(id);
  }

  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @Body() dto: AddTeamMemberDto,
  ): Promise<TeamDto> {
    return this.teams.addMember(id, dto);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<TeamDto> {
    return this.teams.removeMember(id, userId);
  }
}
