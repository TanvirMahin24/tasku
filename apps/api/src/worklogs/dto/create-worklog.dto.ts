import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import type { CreateWorklogDto as ICreateWorklogDto } from '@tasku/types';

export class CreateWorklogDto implements ICreateWorklogDto {
  @IsInt()
  @Min(1)
  minutes: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsISO8601()
  startedAt?: string;
}
