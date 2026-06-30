import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BoardSwimlane, BoardType } from '@prisma/client';
import type { UpdateBoardDto as IUpdateBoardDto } from '@tasku/types';
import { BoardFilterDto } from './board-filter.dto';

export class UpdateBoardDto implements IUpdateBoardDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(BoardType)
  type?: BoardType;

  @IsOptional()
  @ValidateIf((o) => o.teamId !== null)
  @IsString()
  teamId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => BoardFilterDto)
  filter?: BoardFilterDto;

  @IsOptional()
  @IsEnum(BoardSwimlane)
  swimlaneBy?: BoardSwimlane;
}
