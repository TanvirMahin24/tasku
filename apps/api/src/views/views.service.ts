import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import {
  VIEW_STANDARD_FIELDS,
  type CreateViewDto,
  type IssueFilterCriteria,
  type UpdateViewDto,
  type ViewActivityDto,
  type ViewColumn,
  type ViewDto,
  type ViewFieldDto,
  type ViewRowDto,
  type ViewSummaryDto,
} from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import {
  toLabelDto,
  toTeamSummaryDto,
  toTeamSummaryDtoOrNull,
  toUserDto,
  toUserDtoOrNull,
} from '../common/mappers';

const iso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString() : null;

type ViewRow = Prisma.ViewGetPayload<{
  include: {
    scopeTeam: true;
    responsible: true;
    createdBy: true;
    teams: true;
    stars: true;
  };
}>;

@Injectable()
export class ViewsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Access helpers
  // ---------------------------------------------------------------------------
  private async myTeamIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    return rows.map((r) => r.teamId);
  }

  /** Views the user may see: GLOBAL, or TEAM-scoped to a team they're in. */
  private async visibleWhere(userId: string): Promise<Prisma.ViewWhereInput> {
    const teamIds = await this.myTeamIds(userId);
    return {
      OR: [
        { scope: 'GLOBAL' },
        teamIds.length ? { scope: 'TEAM', teamId: { in: teamIds } } : undefined,
      ].filter(Boolean) as Prisma.ViewWhereInput[],
    };
  }

  private include(userId: string) {
    return {
      scopeTeam: true,
      responsible: true,
      createdBy: true,
      teams: true,
      stars: { where: { userId } },
    } satisfies Prisma.ViewInclude;
  }

  private async canEdit(
    view: { createdById: string; scope: string; teamId: string | null },
    userId: string,
  ): Promise<boolean> {
    if (view.createdById === userId) return true;
    if (view.scope === 'TEAM' && view.teamId) {
      const m = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: view.teamId, userId } },
      });
      return m?.role === 'LEAD';
    }
    return false;
  }

  private async load(id: string, userId: string): Promise<ViewRow> {
    const view = await this.prisma.view.findUnique({
      where: { id },
      include: this.include(userId),
    });
    if (!view || view.archived) throw new NotFoundException('View not found');
    // Visibility check.
    if (view.scope === 'TEAM' && view.teamId) {
      const teamIds = await this.myTeamIds(userId);
      if (!teamIds.includes(view.teamId)) {
        throw new ForbiddenException('No access to this view');
      }
    }
    return view as ViewRow;
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------
  async list(userId: string, starred?: boolean): Promise<ViewSummaryDto[]> {
    const where: Prisma.ViewWhereInput = {
      archived: false,
      ...(await this.visibleWhere(userId)),
      ...(starred ? { stars: { some: { userId } } } : {}),
    };
    const views = await this.prisma.view.findMany({
      where,
      include: this.include(userId),
      orderBy: { updatedAt: 'desc' },
    });
    return views.map((v) => this.toSummary(v as ViewRow));
  }

  async get(id: string, userId: string): Promise<ViewDto> {
    const view = await this.load(id, userId);
    return {
      ...this.toSummary(view),
      criteria: (view.criteria ?? {}) as IssueFilterCriteria,
      columns: (view.columns ?? []) as unknown as ViewColumn[],
      canEdit: await this.canEdit(view, userId),
    };
  }

  // ---------------------------------------------------------------------------
  // Mutations (audited)
  // ---------------------------------------------------------------------------
  async create(dto: CreateViewDto, userId: string): Promise<ViewDto> {
    if (!dto.title?.trim()) throw new BadRequestException('Title is required');
    const scope = dto.scope ?? 'GLOBAL';
    if (scope === 'TEAM') {
      if (!dto.teamId) throw new BadRequestException('A team is required for a team view');
      await this.requireTeamMember(dto.teamId, userId);
    }
    const view = await this.prisma.view.create({
      data: {
        title: dto.title.trim(),
        description: dto.description ?? null,
        scope,
        teamId: scope === 'TEAM' ? dto.teamId : null,
        responsibleId: dto.responsibleId ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        criteria: (dto.criteria ?? {}) as Prisma.InputJsonValue,
        columns: (dto.columns ?? []) as unknown as Prisma.InputJsonValue,
        createdById: userId,
        teams: dto.teamIds?.length
          ? { connect: dto.teamIds.map((id) => ({ id })) }
          : undefined,
        activity: { create: { actorId: userId, action: 'created' } },
      },
      include: this.include(userId),
    });
    return this.get(view.id, userId);
  }

  async update(
    id: string,
    dto: UpdateViewDto,
    userId: string,
  ): Promise<ViewDto> {
    const view = await this.load(id, userId);
    if (!(await this.canEdit(view, userId))) {
      throw new ForbiddenException('You cannot edit this view');
    }
    const data: Prisma.ViewUpdateInput = {};
    const changed: string[] = [];
    if (dto.title !== undefined) {
      data.title = dto.title.trim();
      changed.push('title');
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
      changed.push('description');
    }
    if (dto.scope !== undefined) {
      data.scope = dto.scope;
      changed.push('scope');
      if (dto.scope === 'TEAM') {
        const teamId = dto.teamId ?? view.teamId;
        if (!teamId) throw new BadRequestException('A team is required for a team view');
        await this.requireTeamMember(teamId, userId);
        data.scopeTeam = { connect: { id: teamId } };
      } else {
        data.scopeTeam = { disconnect: true };
      }
    } else if (dto.teamId !== undefined && view.scope === 'TEAM') {
      if (dto.teamId) {
        await this.requireTeamMember(dto.teamId, userId);
        data.scopeTeam = { connect: { id: dto.teamId } };
      }
      changed.push('team');
    }
    if (dto.responsibleId !== undefined) {
      data.responsible = dto.responsibleId
        ? { connect: { id: dto.responsibleId } }
        : { disconnect: true };
      changed.push('responsible');
    }
    if (dto.startDate !== undefined) {
      data.startDate = dto.startDate ? new Date(dto.startDate) : null;
      changed.push('start date');
    }
    if (dto.endDate !== undefined) {
      data.endDate = dto.endDate ? new Date(dto.endDate) : null;
      changed.push('end date');
    }
    if (dto.criteria !== undefined) {
      data.criteria = dto.criteria as Prisma.InputJsonValue;
      changed.push('filters');
    }
    if (dto.columns !== undefined) {
      data.columns = dto.columns as unknown as Prisma.InputJsonValue;
      changed.push('columns');
    }
    if (dto.teamIds !== undefined) {
      data.teams = { set: dto.teamIds.map((id) => ({ id })) };
      changed.push('teams');
    }

    await this.prisma.view.update({
      where: { id },
      data: {
        ...data,
        activity: {
          create: {
            actorId: userId,
            action: 'updated',
            detail: changed.join(', ') || null,
          },
        },
      },
    });
    return this.get(id, userId);
  }

  async setArchived(
    id: string,
    archived: boolean,
    userId: string,
  ): Promise<{ archived: boolean }> {
    // load() hides archived rows, so read directly for restore.
    const view = await this.prisma.view.findUnique({ where: { id } });
    if (!view) throw new NotFoundException('View not found');
    if (!(await this.canEdit(view, userId))) {
      throw new ForbiddenException('You cannot change this view');
    }
    await this.prisma.view.update({
      where: { id },
      data: {
        archived,
        activity: {
          create: {
            actorId: userId,
            action: archived ? 'archived' : 'restored',
          },
        },
      },
    });
    return { archived };
  }

  async star(id: string, userId: string): Promise<{ starred: boolean }> {
    await this.load(id, userId); // assert access
    await this.prisma.viewStar.upsert({
      where: { viewId_userId: { viewId: id, userId } },
      create: { viewId: id, userId },
      update: {},
    });
    return { starred: true };
  }

  async unstar(id: string, userId: string): Promise<{ starred: boolean }> {
    await this.prisma.viewStar.deleteMany({ where: { viewId: id, userId } });
    return { starred: false };
  }

  async activity(id: string, userId: string): Promise<ViewActivityDto[]> {
    await this.load(id, userId);
    const rows = await this.prisma.viewActivity.findMany({
      where: { viewId: id },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((a) => ({
      id: a.id,
      action: a.action,
      detail: a.detail ?? null,
      actor: toUserDto(a.actor),
      createdAt: a.createdAt.toISOString(),
    }));
  }

  // ---------------------------------------------------------------------------
  // Results — the filtered issue rows for the table
  // ---------------------------------------------------------------------------
  async results(id: string, userId: string): Promise<ViewRowDto[]> {
    const view = await this.load(id, userId);
    const criteria = (view.criteria ?? {}) as IssueFilterCriteria;
    const columns = (view.columns ?? []) as unknown as ViewColumn[];
    const cfIds = columns
      .filter((c) => c.key.startsWith('cf:'))
      .map((c) => c.key.slice(3));

    const where = await this.buildWhere(criteria, userId);
    if (!where) return [];

    const issues = await this.prisma.issue.findMany({
      where,
      include: {
        assignee: true,
        reporter: true,
        teams: true,
        labels: { include: { label: true } },
        status: true,
        project: { select: { key: true, name: true } },
        customValues: cfIds.length
          ? { where: { fieldId: { in: cfIds } } }
          : false,
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });

    return issues.map((i) => this.toRow(i));
  }

  private async buildWhere(
    criteria: IssueFilterCriteria,
    userId: string,
  ): Promise<Prisma.IssueWhereInput | null> {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const ids = memberships.map((m) => m.projectId);
    if (!ids.length) return null;

    const where: Prisma.IssueWhereInput = { projectId: { in: ids } };

    if (criteria.projectKey) {
      const project = await this.prisma.project.findUnique({
        where: { key: criteria.projectKey },
        select: { id: true },
      });
      if (!project || !ids.includes(project.id)) return null;
      where.projectId = project.id;
    }
    const text = criteria.text?.trim();
    if (text) {
      where.OR = [
        { title: { contains: text, mode: 'insensitive' } },
        { key: { contains: text, mode: 'insensitive' } },
      ];
    }
    if (criteria.statusCategories?.length) {
      where.status = { category: { in: criteria.statusCategories } };
    }
    if (criteria.assigneeIds?.length) {
      where.assigneeId = { in: criteria.assigneeIds };
    }
    if (criteria.reporterIds?.length) {
      where.reporterId = { in: criteria.reporterIds };
    }
    if (criteria.types?.length) where.type = { in: criteria.types };
    if (criteria.priorities?.length) {
      where.priority = { in: criteria.priorities };
    }
    if (criteria.teamIds?.length) {
      where.teams = { some: { id: { in: criteria.teamIds } } };
    }
    if (criteria.labelIds?.length) {
      where.labels = { some: { labelId: { in: criteria.labelIds } } };
    }
    return where;
  }

  // ---------------------------------------------------------------------------
  // Available columns for the editor
  // ---------------------------------------------------------------------------
  async fields(userId: string): Promise<ViewFieldDto[]> {
    const defs = await this.prisma.customFieldDefinition.findMany({
      where: { project: { members: { some: { userId } } } },
      include: { project: { select: { key: true, name: true } } },
      orderBy: [{ project: { key: 'asc' } }, { order: 'asc' }],
    });
    const standard: ViewFieldDto[] = VIEW_STANDARD_FIELDS.map((f) => ({
      ...f,
      kind: 'standard',
    }));
    const custom: ViewFieldDto[] = defs.map((d) => ({
      key: `cf:${d.id}`,
      label: `${d.name} · ${d.project.key}`,
      kind: 'custom',
      projectKey: d.project.key,
    }));
    return [...standard, ...custom];
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------
  private async requireTeamMember(teamId: string, userId: string): Promise<void> {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new BadRequestException('teamId is not a valid team');
    const m = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!m) throw new ForbiddenException('You are not a member of this team');
  }

  private toSummary(v: ViewRow): ViewSummaryDto {
    return {
      id: v.id,
      title: v.title,
      description: v.description ?? null,
      scope: v.scope,
      scopeTeam: toTeamSummaryDtoOrNull(v.scopeTeam),
      responsible: toUserDtoOrNull(v.responsible),
      teams: (v.teams ?? []).map(toTeamSummaryDto),
      startDate: iso(v.startDate),
      endDate: iso(v.endDate),
      starred: (v.stars ?? []).length > 0,
      archived: v.archived,
      createdBy: toUserDto(v.createdBy),
      updatedAt: v.updatedAt.toISOString(),
    };
  }

  private toRow(i: any): ViewRowDto {
    return {
      id: i.id,
      key: i.key,
      type: i.type,
      title: i.title,
      status: i.status
        ? { id: i.status.id, name: i.status.name, category: i.status.category }
        : null,
      priority: i.priority,
      assignee: toUserDtoOrNull(i.assignee),
      reporter: toUserDtoOrNull(i.reporter),
      teams: (i.teams ?? []).map(toTeamSummaryDto),
      labels: (i.labels ?? []).map((l: any) => toLabelDto(l.label)),
      storyPoints: i.storyPoints ?? null,
      sprintId: i.sprintId ?? null,
      startDate: iso(i.startDate),
      dueDate: iso(i.dueDate),
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      projectKey: i.project.key,
      projectName: i.project.name,
      customValues: Object.fromEntries(
        (i.customValues ?? []).map((v: any) => [v.fieldId, v.value]),
      ),
    };
  }
}
