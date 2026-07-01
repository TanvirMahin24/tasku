import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BoardType, Prisma, Role, SprintState } from '@prisma/client';
import type {
  BoardDto,
  BoardFilter,
  BoardSummaryDto,
} from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import {
  toBoardSummaryDto,
  toIssueSummaryDto,
  toProjectDto,
  toSprintDto,
  toStatusDto,
} from '../common/mappers';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';

const SUMMARY_INCLUDE = {
  assignee: true,
  teams: true,
  labels: { include: { label: true } },
} satisfies Prisma.IssueInclude;

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  // ---------------------------------------------------------------------------
  // Board CRUD (per project)
  // ---------------------------------------------------------------------------
  async listForProject(
    key: string,
    userId: string,
  ): Promise<BoardSummaryDto[]> {
    const project = await this.membership.getProjectForMember(key, userId);
    let boards = await this.prisma.board.findMany({
      where: { projectId: project.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    // Lazily create a default board if the project has none.
    if (boards.length === 0) {
      const created = await this.ensureDefaultBoard(project.id);
      boards = [created];
    }
    const starred = await this.starredSet(
      boards.map((b) => b.id),
      userId,
    );
    return boards.map((b) => toBoardSummaryDto(b, starred.has(b.id)));
  }

  async createForProject(
    key: string,
    dto: CreateBoardDto,
    userId: string,
  ): Promise<BoardSummaryDto> {
    const project = await this.membership.getProjectForMember(key, userId);
    if (dto.teamId) {
      await this.requireTeam(dto.teamId);
    }
    const board = await this.prisma.board.create({
      data: {
        projectId: project.id,
        name: dto.name,
        type: dto.type ?? BoardType.KANBAN,
        teamId: dto.teamId ?? null,
        filter: this.normalizeFilter(dto.filter),
        swimlaneBy: dto.swimlaneBy ?? undefined,
        isDefault: false,
      },
    });
    return toBoardSummaryDto(board);
  }

  async getOne(id: string, userId: string): Promise<BoardSummaryDto> {
    const board = await this.requireBoardForMember(id, userId);
    return toBoardSummaryDto(board, await this.isStarred(board.id, userId));
  }

  async update(
    id: string,
    dto: UpdateBoardDto,
    userId: string,
  ): Promise<BoardSummaryDto> {
    const board = await this.requireBoardForMember(id, userId);
    if (dto.teamId) {
      await this.requireTeam(dto.teamId);
    }
    const data: Prisma.BoardUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.teamId !== undefined) {
      data.team = dto.teamId
        ? { connect: { id: dto.teamId } }
        : { disconnect: true };
    }
    if (dto.filter !== undefined) {
      data.filter = this.normalizeFilter(dto.filter) ?? Prisma.JsonNull;
    }
    if (dto.swimlaneBy !== undefined) {
      data.swimlaneBy = dto.swimlaneBy;
    }
    const updated = await this.prisma.board.update({
      where: { id: board.id },
      data,
    });
    return toBoardSummaryDto(updated, await this.isStarred(board.id, userId));
  }

  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    const board = await this.requireBoardForMember(id, userId);
    if (board.isDefault) {
      throw new BadRequestException('Cannot delete the default board');
    }
    await this.prisma.board.delete({ where: { id: board.id } });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Stars (per-user favourites)
  // ---------------------------------------------------------------------------
  async star(id: string, userId: string): Promise<{ starred: boolean }> {
    await this.requireBoardForMember(id, userId);
    await this.prisma.boardStar.upsert({
      where: { boardId_userId: { boardId: id, userId } },
      create: { boardId: id, userId },
      update: {},
    });
    return { starred: true };
  }

  async unstar(id: string, userId: string): Promise<{ starred: boolean }> {
    await this.requireBoardForMember(id, userId);
    await this.prisma.boardStar.deleteMany({ where: { boardId: id, userId } });
    return { starred: false };
  }

  private async isStarred(boardId: string, userId: string): Promise<boolean> {
    const row = await this.prisma.boardStar.findUnique({
      where: { boardId_userId: { boardId, userId } },
      select: { id: true },
    });
    return !!row;
  }

  private async starredSet(
    boardIds: string[],
    userId: string,
  ): Promise<Set<string>> {
    if (boardIds.length === 0) return new Set();
    const rows = await this.prisma.boardStar.findMany({
      where: { userId, boardId: { in: boardIds } },
      select: { boardId: true },
    });
    return new Set(rows.map((r) => r.boardId));
  }

  // ---------------------------------------------------------------------------
  // Board view (columns of issues)
  // ---------------------------------------------------------------------------
  async getBoardView(id: string, userId: string): Promise<BoardDto> {
    const board = await this.requireBoardForMember(id, userId);
    return this.buildBoardView(
      board.projectId,
      userId,
      undefined,
      board,
    );
  }

  /**
   * Shared column-builder used by both the default project board endpoint
   * (`GET /projects/:key/board`) and the per-board endpoint
   * (`GET /boards/:id/board`). Applies the active-sprint rule plus the board's
   * stored filter (when a board row is supplied).
   *
   * @param boardRow when present, its `filter` + `teamId` narrow the issues and
   *                 it is echoed back as `board`; the default board is looked up
   *                 lazily when omitted.
   */
  async buildBoardView(
    projectId: string,
    userId: string,
    sprintId: string | undefined,
    boardRow?: {
      id: string;
      name: string;
      type: BoardType;
      teamId: string | null;
      isDefault: boolean;
      filter: Prisma.JsonValue;
    },
  ): Promise<BoardDto> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { lead: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    const membership = await this.membership.requireMembership(
      projectId,
      userId,
    );

    const board = boardRow ?? (await this.ensureDefaultBoard(projectId));

    const [statuses, activeSprint] = await Promise.all([
      this.prisma.status.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
      }),
      this.prisma.sprint.findFirst({
        where: { projectId, state: SprintState.ACTIVE },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    // Active-sprint rule (mirrors the original project board):
    //  - explicit ?sprintId wins
    //  - else, if there's an active sprint, scope to it
    //  - else, show all issues
    const where: Prisma.IssueWhereInput = { projectId };
    if (sprintId) {
      where.sprintId = sprintId;
    } else if (activeSprint) {
      where.sprintId = activeSprint.id;
    }

    // Board filter (assignees / labels / types / priorities) + teamId.
    const filter = (board.filter as BoardFilter | null) ?? null;
    if (board.teamId) {
      where.teams = { some: { id: board.teamId } };
    }
    if (filter) {
      if (filter.assigneeIds?.length) {
        where.assigneeId = { in: filter.assigneeIds };
      }
      if (filter.types?.length) {
        where.type = { in: filter.types };
      }
      if (filter.priorities?.length) {
        where.priority = { in: filter.priorities };
      }
      if (filter.labelIds?.length) {
        where.labels = { some: { labelId: { in: filter.labelIds } } };
      }
    }

    const issues = await this.prisma.issue.findMany({
      where,
      include: SUMMARY_INCLUDE,
      orderBy: { rank: 'asc' },
    });

    const columns = statuses.map((status) => ({
      status: toStatusDto(status),
      issues: issues
        .filter((i) => i.statusId === status.id)
        .map(toIssueSummaryDto),
    }));

    return {
      project: toProjectDto(project, membership.role as Role),
      columns,
      activeSprint: activeSprint ? toSprintDto(activeSprint) : null,
      board: toBoardSummaryDto(board, await this.isStarred(board.id, userId)),
    };
  }

  /** Returns the project's default board, creating "Main Board" if needed. */
  async ensureDefaultBoard(projectId: string) {
    const existing = await this.prisma.board.findFirst({
      where: { projectId, isDefault: true },
    });
    if (existing) return existing;
    // A board may exist without the default flag; only create if truly none.
    return this.prisma.board.create({
      data: {
        projectId,
        name: 'Main Board',
        type: BoardType.KANBAN,
        isDefault: true,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  private async requireBoardForMember(id: string, userId: string) {
    const board = await this.prisma.board.findUnique({ where: { id } });
    if (!board) {
      throw new NotFoundException(`Board ${id} not found`);
    }
    await this.membership.requireMembership(board.projectId, userId);
    return board;
  }

  private async requireTeam(id: string) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) {
      throw new BadRequestException('teamId is not a valid team');
    }
    return team;
  }

  private normalizeFilter(
    filter: BoardFilter | undefined,
  ): Prisma.InputJsonValue | undefined {
    if (!filter) return undefined;
    return filter as unknown as Prisma.InputJsonValue;
  }
}
