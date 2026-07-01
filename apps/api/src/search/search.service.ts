import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import type {
  IssueFilterCriteria,
  SavedFilterDto,
  SearchResultDto,
} from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { toIssueSummaryDto, toSavedFilterDto } from '../common/mappers';
import { SaveFilterDto, UpdateSavedFilterDto } from './dto/save-filter.dto';

const SUMMARY_INCLUDE = {
  assignee: true,
  team: true,
  labels: { include: { label: true } },
} satisfies Prisma.IssueInclude;

const RESULT_CAP = 100;

/** Coerce a value that may be a scalar or array (query strings) into an array. */
function asArray<T>(v: T | T[] | undefined): T[] | undefined {
  if (v === undefined || v === null) return undefined;
  return Array.isArray(v) ? v : [v];
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Cross-project search, scoped to the caller's member projects.
  // ---------------------------------------------------------------------------
  async search(
    criteria: IssueFilterCriteria,
    userId: string,
  ): Promise<SearchResultDto> {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const memberProjectIds = memberships.map((m) => m.projectId);
    if (memberProjectIds.length === 0) {
      return { issues: [], total: 0 };
    }

    const where: Prisma.IssueWhereInput = {
      projectId: { in: memberProjectIds },
    };

    if (criteria.projectKey) {
      const project = await this.prisma.project.findUnique({
        where: { key: criteria.projectKey },
        select: { id: true },
      });
      // Restrict to that project only if the caller is a member of it.
      if (project && memberProjectIds.includes(project.id)) {
        where.projectId = project.id;
      } else {
        return { issues: [], total: 0 };
      }
    }

    const text = criteria.text?.trim();
    if (text) {
      where.OR = [
        { title: { contains: text, mode: 'insensitive' } },
        { key: { contains: text, mode: 'insensitive' } },
      ];
    }

    const statusCategories = asArray(criteria.statusCategories);
    if (statusCategories?.length) {
      where.status = { category: { in: statusCategories } };
    }

    const assigneeIds = asArray(criteria.assigneeIds);
    if (assigneeIds?.length) where.assigneeId = { in: assigneeIds };

    const reporterIds = asArray(criteria.reporterIds);
    if (reporterIds?.length) where.reporterId = { in: reporterIds };

    const types = asArray(criteria.types);
    if (types?.length) where.type = { in: types };

    const priorities = asArray(criteria.priorities);
    if (priorities?.length) where.priority = { in: priorities };

    const teamIds = asArray(criteria.teamIds);
    if (teamIds?.length) where.teamId = { in: teamIds };

    const labelIds = asArray(criteria.labelIds);
    if (labelIds?.length) {
      where.labels = { some: { labelId: { in: labelIds } } };
    }

    const [issues, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        include: SUMMARY_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: RESULT_CAP,
      }),
      this.prisma.issue.count({ where }),
    ]);

    return { issues: issues.map(toIssueSummaryDto), total };
  }

  // ---------------------------------------------------------------------------
  // Saved filters
  // ---------------------------------------------------------------------------
  async listFilters(userId: string): Promise<SavedFilterDto[]> {
    const filters = await this.prisma.savedFilter.findMany({
      where: { OR: [{ ownerId: userId }, { shared: true }] },
      include: { owner: true },
      orderBy: { createdAt: 'desc' },
    });
    return filters.map(toSavedFilterDto);
  }

  async createFilter(
    dto: SaveFilterDto,
    userId: string,
  ): Promise<SavedFilterDto> {
    const created = await this.prisma.savedFilter.create({
      data: {
        ownerId: userId,
        name: dto.name,
        criteria: (dto.criteria ?? {}) as Prisma.InputJsonValue,
        shared: dto.shared ?? false,
      },
      include: { owner: true },
    });
    return toSavedFilterDto(created);
  }

  async getFilter(id: string, userId: string): Promise<SavedFilterDto> {
    const filter = await this.requireVisible(id, userId);
    return toSavedFilterDto(filter);
  }

  async updateFilter(
    id: string,
    dto: UpdateSavedFilterDto,
    userId: string,
  ): Promise<SavedFilterDto> {
    const filter = await this.requireVisible(id, userId);
    if (filter.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can edit this filter');
    }
    const data: Prisma.SavedFilterUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.criteria !== undefined) {
      data.criteria = dto.criteria as Prisma.InputJsonValue;
    }
    if (dto.shared !== undefined) data.shared = dto.shared;
    const updated = await this.prisma.savedFilter.update({
      where: { id },
      data,
      include: { owner: true },
    });
    return toSavedFilterDto(updated);
  }

  async removeFilter(
    id: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const filter = await this.requireVisible(id, userId);
    if (filter.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete this filter');
    }
    await this.prisma.savedFilter.delete({ where: { id } });
    return { success: true };
  }

  async runFilter(id: string, userId: string): Promise<SearchResultDto> {
    const filter = await this.requireVisible(id, userId);
    return this.search(
      (filter.criteria ?? {}) as IssueFilterCriteria,
      userId,
    );
  }

  private async requireVisible(id: string, userId: string) {
    const filter = await this.prisma.savedFilter.findUnique({
      where: { id },
      include: { owner: true },
    });
    if (!filter) {
      throw new NotFoundException('Filter not found');
    }
    if (filter.ownerId !== userId && !filter.shared) {
      throw new ForbiddenException('You cannot access this filter');
    }
    return filter;
  }
}
