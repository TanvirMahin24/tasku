import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Priority } from '@prisma/client';
import type { BulkUpdateDto as IBulkUpdateDto } from '@tasku/types';

class BulkChangesDto {
  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @ValidateIf((o) => o.assigneeId !== null)
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teamIds?: string[];

  @IsOptional()
  @ValidateIf((o) => o.sprintId !== null)
  @IsString()
  sprintId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  addLabelIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  removeLabelIds?: string[];
}

export class BulkUpdateDto implements IBulkUpdateDto {
  @IsArray()
  @IsString({ each: true })
  issueKeys: string[];

  @IsObject()
  @ValidateNested()
  @Type(() => BulkChangesDto)
  changes: BulkChangesDto;
}
