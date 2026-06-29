import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IssueType, Priority } from '@prisma/client';
import type { UpdateIssueDto as IUpdateIssueDto } from '@tasku/types';

// Nullable fields use `@ValidateIf(v => v.<field> !== null)` so an explicit
// `null` (meaning "clear this field") passes validation, while a wrong-typed
// non-null value is still rejected.
export class UpdateIssueDto implements IUpdateIssueDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(IssueType)
  type?: IssueType;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @ValidateIf((o) => o.assigneeId !== null)
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @ValidateIf((o) => o.parentId !== null)
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.sprintId !== null)
  @IsString()
  sprintId?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.storyPoints !== null)
  @IsInt()
  storyPoints?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labelIds?: string[];
}
