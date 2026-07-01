import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IssueType, Priority, StatusCategory } from '@prisma/client';
import type { IssueFilterCriteria } from '@tasku/types';

// Query strings deliver repeated keys as an array but a single key as a scalar.
// Normalize to an array so `@IsArray` + `each` validators accept both forms.
const toArray = ({ value }: { value: unknown }) =>
  value === undefined || value === null
    ? value
    : Array.isArray(value)
      ? value
      : [value];

/**
 * Search criteria — accepted both as a query string (GET /search/issues) and as
 * the stored `criteria` of a SavedFilter. Array params come through as repeated
 * query keys or a single value; class-transformer's implicit conversion + the
 * normalize helper coerce them to arrays.
 */
export class IssueFilterDto implements IssueFilterCriteria {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  projectKey?: string;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(StatusCategory, { each: true })
  statusCategories?: StatusCategory[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  reporterIds?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(IssueType, { each: true })
  types?: IssueType[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(Priority, { each: true })
  priorities?: Priority[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  teamIds?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  labelIds?: string[];
}
