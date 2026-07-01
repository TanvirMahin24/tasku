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
import type { BoardDto, BoardSummaryDto } from '@tasku/types';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  // --- Project-scoped ---
  @Get('projects/:key/boards')
  listForProject(
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
  ): Promise<BoardSummaryDto[]> {
    return this.boards.listForProject(key, user.id);
  }

  @Post('projects/:key/boards')
  createForProject(
    @Param('key') key: string,
    @Body() dto: CreateBoardDto,
    @CurrentUser() user: AuthUser,
  ): Promise<BoardSummaryDto> {
    return this.boards.createForProject(key, dto, user.id);
  }

  // --- Board-scoped ---
  @Get('boards/:id')
  getOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<BoardSummaryDto> {
    return this.boards.getOne(id, user.id);
  }

  @Patch('boards/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBoardDto,
    @CurrentUser() user: AuthUser,
  ): Promise<BoardSummaryDto> {
    return this.boards.update(id, dto, user.id);
  }

  @Delete('boards/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.boards.remove(id, user.id);
  }

  @Get('boards/:id/board')
  getBoardView(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<BoardDto> {
    return this.boards.getBoardView(id, user.id);
  }
}
