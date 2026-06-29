import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { IssueType, Priority } from '@prisma/client';
import type { CreateIssueDto as ICreateIssueDto } from '@tasku/types';

export class CreateIssueDto implements ICreateIssueDto {
  @IsEnum(IssueType)
  type: IssueType;

  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  sprintId?: string;

  @IsOptional()
  @IsInt()
  storyPoints?: number;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labelIds?: string[];
}
