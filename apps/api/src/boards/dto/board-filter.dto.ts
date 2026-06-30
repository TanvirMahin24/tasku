import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { IssueType, Priority } from '@prisma/client';
import type { BoardFilter } from '@tasku/types';

export class BoardFilterDto implements BoardFilter {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labelIds?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(IssueType, { each: true })
  types?: IssueType[];

  @IsOptional()
  @IsArray()
  @IsEnum(Priority, { each: true })
  priorities?: Priority[];
}
