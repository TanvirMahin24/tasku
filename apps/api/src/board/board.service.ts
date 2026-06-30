import { Injectable } from '@nestjs/common';
import type { BoardDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { BoardsService } from '../boards/boards.service';

/**
 * The original "default project board" endpoint (`GET /projects/:key/board`).
 * Column-building now lives in BoardsService so it is shared with the
 * multi-board endpoints; this service resolves the project key and the
 * project's default board, then delegates.
 */
@Injectable()
export class BoardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly boards: BoardsService,
  ) {}

  async getBoard(
    key: string,
    sprintId: string | undefined,
    userId: string,
  ): Promise<BoardDto> {
    const project = await this.membership.getProjectForMember(key, userId);
    const defaultBoard = await this.boards.ensureDefaultBoard(project.id);
    return this.boards.buildBoardView(
      project.id,
      userId,
      sprintId,
      defaultBoard,
    );
  }
}
