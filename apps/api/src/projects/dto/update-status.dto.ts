import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { StatusCategory } from '@prisma/client';
import type { UpdateStatusDto as IUpdateStatusDto } from '@tasku/types';

export class UpdateStatusDto implements IUpdateStatusDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(StatusCategory)
  category?: StatusCategory;

  // null clears the WIP limit; a positive int sets it.
  @IsOptional()
  @ValidateIf((o) => o.wipLimit !== null)
  @IsInt()
  @Min(1)
  wipLimit?: number | null;
}
