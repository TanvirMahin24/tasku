import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { VersionDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { toVersionDto } from '../common/mappers';
import { CreateVersionDto } from './dto/create-version.dto';
import { UpdateVersionDto } from './dto/update-version.dto';

// Pull each version's issues (just their status category) to derive progress.
const PROGRESS_INCLUDE = {
  issues: { include: { status: { select: { category: true } } } },
} satisfies Prisma.VersionInclude;

@Injectable()
export class VersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  async list(key: string, userId: string): Promise<VersionDto[]> {
    const project = await this.membership.getProjectForMember(key, userId);
    const versions = await this.prisma.version.findMany({
      where: { projectId: project.id },
      include: PROGRESS_INCLUDE,
      orderBy: [
        { released: 'asc' },
        { releaseDate: 'asc' },
        { createdAt: 'asc' },
      ],
    });
    return versions.map(toVersionDto);
  }

  async create(
    key: string,
    dto: CreateVersionDto,
    userId: string,
  ): Promise<VersionDto> {
    const project = await this.membership.getProjectForMember(key, userId);
    const version = await this.prisma.version.create({
      data: {
        projectId: project.id,
        name: dto.name,
        description: dto.description ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : null,
      },
      include: PROGRESS_INCLUDE,
    });
    return toVersionDto(version);
  }

  async update(
    id: string,
    dto: UpdateVersionDto,
    userId: string,
  ): Promise<VersionDto> {
    const version = await this.requireVersionForMember(id, userId);
    const data: Prisma.VersionUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.startDate !== undefined) {
      data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }
    if (dto.releaseDate !== undefined) {
      data.releaseDate = dto.releaseDate ? new Date(dto.releaseDate) : null;
    }
    if (dto.released !== undefined) {
      data.released = dto.released;
      // Stamp a release date on first release if none was provided.
      if (dto.released && !version.releaseDate && dto.releaseDate === undefined) {
        data.releaseDate = new Date();
      }
    }
    const updated = await this.prisma.version.update({
      where: { id: version.id },
      data,
      include: PROGRESS_INCLUDE,
    });
    return toVersionDto(updated);
  }

  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    const version = await this.requireVersionForMember(id, userId);
    await this.prisma.version.delete({ where: { id: version.id } });
    return { success: true };
  }

  private async requireVersionForMember(id: string, userId: string) {
    const version = await this.prisma.version.findUnique({ where: { id } });
    if (!version) throw new NotFoundException('Version not found');
    await this.membership.requireMembership(version.projectId, userId);
    return version;
  }
}
