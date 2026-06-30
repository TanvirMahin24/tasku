import { Injectable, NotFoundException } from '@nestjs/common';
import { TeamRole, type Prisma } from '@prisma/client';
import type { TeamDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { toTeamDto } from '../common/mappers';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';

const TEAM_INCLUDE = {
  members: { include: { user: true } },
  _count: { select: { issues: true } },
} satisfies Prisma.TeamInclude;

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<TeamDto[]> {
    const teams = await this.prisma.team.findMany({
      include: TEAM_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return teams.map((t) => toTeamDto(t, t._count.issues));
  }

  async create(dto: CreateTeamDto, userId: string): Promise<TeamDto> {
    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        color: dto.color ?? undefined,
        members: { create: [{ userId, role: TeamRole.LEAD }] },
      },
    });
    return this.load(team.id);
  }

  async findOne(id: string): Promise<TeamDto> {
    return this.load(id);
  }

  async update(id: string, dto: UpdateTeamDto): Promise<TeamDto> {
    await this.requireTeam(id);
    await this.prisma.team.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        description: dto.description ?? undefined,
        color: dto.color ?? undefined,
      },
    });
    return this.load(id);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.requireTeam(id);
    await this.prisma.team.delete({ where: { id } });
    return { success: true };
  }

  async addMember(id: string, dto: AddTeamMemberDto): Promise<TeamDto> {
    await this.requireTeam(id);
    // Idempotent on (teamId, userId).
    await this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: id, userId: dto.userId } },
      update: { role: dto.role ?? undefined },
      create: {
        teamId: id,
        userId: dto.userId,
        role: dto.role ?? TeamRole.MEMBER,
      },
    });
    return this.load(id);
  }

  async removeMember(id: string, userId: string): Promise<TeamDto> {
    await this.requireTeam(id);
    await this.prisma.teamMember.deleteMany({
      where: { teamId: id, userId },
    });
    return this.load(id);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  private async requireTeam(id: string) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) {
      throw new NotFoundException(`Team ${id} not found`);
    }
    return team;
  }

  private async load(id: string): Promise<TeamDto> {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: TEAM_INCLUDE,
    });
    if (!team) {
      throw new NotFoundException(`Team ${id} not found`);
    }
    return toTeamDto(team, team._count.issues);
  }
}
