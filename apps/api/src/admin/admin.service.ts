import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AdminUserDto,
  BanUserDto,
  PlatformRole,
  UpdatePlatformRoleDto,
} from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { toTeamSummaryDto } from '../common/mappers';

function toAdminUserDto(u: any): AdminUserDto {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl ?? null,
    platformRole: u.platformRole as PlatformRole,
    banned: u.bannedAt != null,
    banReason: u.banReason ?? null,
    teams: (u.teamMemberships ?? []).map((m: any) => toTeamSummaryDto(m.team)),
    createdAt:
      u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
  };
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(): Promise<AdminUserDto[]> {
    const users = await this.prisma.user.findMany({
      include: { teamMemberships: { include: { team: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return users.map(toAdminUserDto);
  }

  async setRole(id: string, dto: UpdatePlatformRoleDto): Promise<AdminUserDto> {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new BadRequestException('User not found');

    // Prevent demoting the last remaining super-admin.
    if (
      target.platformRole === 'SUPER_ADMIN' &&
      dto.platformRole !== 'SUPER_ADMIN'
    ) {
      const admins = await this.prisma.user.count({
        where: { platformRole: 'SUPER_ADMIN' },
      });
      if (admins <= 1) {
        throw new BadRequestException('Cannot demote the last super-admin');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { platformRole: dto.platformRole },
      include: { teamMemberships: { include: { team: true } } },
    });
    return toAdminUserDto(updated);
  }

  async ban(
    id: string,
    dto: BanUserDto,
    actorId: string,
  ): Promise<AdminUserDto> {
    if (id === actorId) {
      throw new BadRequestException('You cannot ban yourself');
    }
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new BadRequestException('User not found');
    if (target.platformRole === 'SUPER_ADMIN') {
      throw new BadRequestException('Cannot ban a super-admin');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { bannedAt: new Date(), banReason: dto.reason ?? null },
      include: { teamMemberships: { include: { team: true } } },
    });
    return toAdminUserDto(updated);
  }

  async unban(id: string): Promise<AdminUserDto> {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new BadRequestException('User not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { bannedAt: null, banReason: null },
      include: { teamMemberships: { include: { team: true } } },
    });
    return toAdminUserDto(updated);
  }
}
