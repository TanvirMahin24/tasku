import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  FEATURES,
  type FeatureKey,
  type FeatureMap,
  type FeatureOverrideDto,
  type FeatureScope,
  type SetFeatureOverrideDto,
} from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { toTeamSummaryDto, toUserDto } from '../common/mappers';

/** Every feature defaults to enabled. */
function defaultMap(): FeatureMap {
  const map = {} as FeatureMap;
  for (const f of FEATURES) map[f.key] = true;
  return map;
}

function toFeatureOverrideDto(o: any): FeatureOverrideDto {
  return {
    id: o.id,
    feature: o.feature as FeatureKey,
    scope: o.scope as FeatureScope,
    teamId: o.teamId ?? null,
    userId: o.userId ?? null,
    enabled: o.enabled,
    team: o.team ? toTeamSummaryDto(o.team) : null,
    user: o.user ? toUserDto(o.user) : null,
  };
}

@Injectable()
export class FeatureService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute the effective feature map for a user.
   * Precedence: USER > TEAM > GLOBAL > default(true).
   * For multiple TEAM overrides on one feature, the most restrictive wins
   * (any `false` disables) unless a USER override overrides it.
   */
  async effectiveFor(userId: string): Promise<FeatureMap> {
    const map = defaultMap();

    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const teamIds = memberships.map((m) => m.teamId);

    const or: Prisma.FeatureOverrideWhereInput[] = [
      { scope: 'GLOBAL' },
      { scope: 'USER', userId },
    ];
    if (teamIds.length) {
      or.push({ scope: 'TEAM', teamId: { in: teamIds } });
    }

    const overrides = await this.prisma.featureOverride.findMany({
      where: { OR: or },
    });

    for (const f of FEATURES) {
      const key = f.key;
      const forKey = overrides.filter((o) => o.feature === key);

      const userOv = forKey.find((o) => o.scope === 'USER');
      if (userOv) {
        map[key] = userOv.enabled;
        continue;
      }

      const teamOvs = forKey.filter((o) => o.scope === 'TEAM');
      if (teamOvs.length) {
        // Most restrictive wins: any disabled team override disables it.
        map[key] = teamOvs.every((o) => o.enabled);
        continue;
      }

      const globalOv = forKey.find((o) => o.scope === 'GLOBAL');
      if (globalOv) {
        map[key] = globalOv.enabled;
        continue;
      }

      map[key] = true;
    }

    return map;
  }

  /** All overrides with team summary / user dto included. */
  async list(): Promise<FeatureOverrideDto[]> {
    const rows = await this.prisma.featureOverride.findMany({
      include: { team: true, user: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toFeatureOverrideDto);
  }

  /**
   * Upsert an override by (feature, scope, teamId, userId). Done as
   * find-then-create/update since the unique index contains nullable columns.
   */
  async set(dto: SetFeatureOverrideDto): Promise<FeatureOverrideDto> {
    // Normalize scope-relevant fields so lookups are consistent.
    const teamId = dto.scope === 'TEAM' ? (dto.teamId ?? null) : null;
    const userId = dto.scope === 'USER' ? (dto.userId ?? null) : null;

    const existing = await this.prisma.featureOverride.findFirst({
      where: { feature: dto.feature, scope: dto.scope, teamId, userId },
    });

    const row = existing
      ? await this.prisma.featureOverride.update({
          where: { id: existing.id },
          data: { enabled: dto.enabled },
          include: { team: true, user: true },
        })
      : await this.prisma.featureOverride.create({
          data: {
            feature: dto.feature,
            scope: dto.scope,
            teamId,
            userId,
            enabled: dto.enabled,
          },
          include: { team: true, user: true },
        });

    return toFeatureOverrideDto(row);
  }

  /** Remove an override; no-op if it does not exist. */
  async remove(id: string): Promise<{ success: boolean }> {
    await this.prisma.featureOverride.deleteMany({ where: { id } });
    return { success: true };
  }
}
