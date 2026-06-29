import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { BoardDto } from '@tasku/types';
import { BoardService } from './board.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class BoardController {
  constructor(private readonly board: BoardService) {}

  @Get(':key/board')
  getBoard(
    @Param('key') key: string,
    @Query('sprintId') sprintId: string | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<BoardDto> {
    return this.board.getBoard(key, sprintId, user.id);
  }
}
