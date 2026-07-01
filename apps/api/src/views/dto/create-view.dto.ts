import {
  IsArray,
  IsBoolean,
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
  CreateViewDto as ICreateViewDto,
  IssueFilterCriteria,
  ViewScope,
} from '@tasku/types';

export class ViewColumnDto {
  @IsString()
  key: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

export class CreateViewDto implements ICreateViewDto {
  @IsString()
  @MinLength(1)
  title: string;

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

  // Criteria is a free-form JSON blob — keep it raw (implicit conversion would
  // otherwise mangle its nested shape).
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
