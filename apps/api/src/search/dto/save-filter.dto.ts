import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { SaveFilterDto as ISaveFilterDto } from '@tasku/types';
import { IssueFilterDto } from './issue-filter.dto';

export class SaveFilterDto implements ISaveFilterDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsObject()
  @ValidateNested()
  @Type(() => IssueFilterDto)
  criteria: IssueFilterDto;

  @IsOptional()
  @IsBoolean()
  shared?: boolean;
}

export class UpdateSavedFilterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => IssueFilterDto)
  criteria?: IssueFilterDto;

  @IsOptional()
  @IsBoolean()
  shared?: boolean;
}
