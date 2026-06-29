import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IssueType } from '@prisma/client';

export class ListIssuesQuery {
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
  @IsEnum(IssueType)
  type?: IssueType;

  @IsOptional()
  @IsString()
  search?: string;
}
