import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BoardType } from '@prisma/client';
import type { CreateBoardDto as ICreateBoardDto } from '@tasku/types';
import { BoardFilterDto } from './board-filter.dto';

export class CreateBoardDto implements ICreateBoardDto {
  @IsString()
  @MinLength(1)
  name: string;

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
}
