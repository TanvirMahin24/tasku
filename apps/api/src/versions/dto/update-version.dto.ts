import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { UpdateVersionDto as IUpdateVersionDto } from '@tasku/types';

export class UpdateVersionDto implements IUpdateVersionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @ValidateIf((o) => o.description !== null)
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  released?: boolean;

  @IsOptional()
  @ValidateIf((o) => o.startDate !== null)
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.releaseDate !== null)
  @IsString()
  releaseDate?: string | null;
}
