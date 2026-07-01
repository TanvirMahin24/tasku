import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { IssueType } from '@prisma/client';
import type { IssueListQuery } from '@tasku/types';

export class ListIssuesQuery implements IssueListQuery {
  // "backlog" is a sentinel meaning sprintId IS NULL; otherwise a sprint id.
  @IsOptional()
  @IsString()
  sprintId?: string;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsEnum(IssueType)
  type?: IssueType;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['rank', 'priority', 'createdAt', 'updatedAt', 'dueDate', 'key'])
  orderBy?: 'rank' | 'priority' | 'createdAt' | 'updatedAt' | 'dueDate' | 'key';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
