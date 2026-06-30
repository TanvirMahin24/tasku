import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { SavedFilterDto, SearchResultDto } from '@tasku/types';
import { SearchService } from './search.service';
import { IssueFilterDto } from './dto/issue-filter.dto';
import { SaveFilterDto, UpdateSavedFilterDto } from './dto/save-filter.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('search/issues')
  searchIssues(
    @Query() query: IssueFilterDto,
    @CurrentUser() user: AuthUser,
  ): Promise<SearchResultDto> {
    return this.search.search(query, user.id);
  }

  // --- Saved filters ---
  @Get('filters')
  listFilters(@CurrentUser() user: AuthUser): Promise<SavedFilterDto[]> {
    return this.search.listFilters(user.id);
  }

  @Post('filters')
  createFilter(
    @Body() dto: SaveFilterDto,
    @CurrentUser() user: AuthUser,
  ): Promise<SavedFilterDto> {
    return this.search.createFilter(dto, user.id);
  }

  @Get('filters/:id')
  getFilter(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<SavedFilterDto> {
    return this.search.getFilter(id, user.id);
  }

  @Patch('filters/:id')
  updateFilter(
    @Param('id') id: string,
    @Body() dto: UpdateSavedFilterDto,
    @CurrentUser() user: AuthUser,
  ): Promise<SavedFilterDto> {
    return this.search.updateFilter(id, dto, user.id);
  }

  @Delete('filters/:id')
  removeFilter(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.search.removeFilter(id, user.id);
  }

  @Get('filters/:id/results')
  runFilter(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<SearchResultDto> {
    return this.search.runFilter(id, user.id);
  }
}
