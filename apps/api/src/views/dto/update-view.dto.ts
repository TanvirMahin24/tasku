import {
  IsArray,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type {
  IssueFilterCriteria,
  UpdateViewDto as IUpdateViewDto,
  ViewScope,
} from '@tasku/types';
import { ViewColumnDto } from './create-view.dto';

export class UpdateViewDto implements IUpdateViewDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(['GLOBAL', 'TEAM'])
  scope?: ViewScope;

  @IsOptional()
  @IsString()
  teamId?: string | null;

  @IsOptional()
  @IsString()
  responsibleId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teamIds?: string[];

  @IsOptional()
  @IsISO8601()
  startDate?: string | null;

  @IsOptional()
  @IsISO8601()
  endDate?: string | null;

  @IsOptional()
  @IsObject()
  @Transform(({ value }) => value)
  criteria?: IssueFilterCriteria;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ViewColumnDto)
  columns?: ViewColumnDto[];
}
