import { IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import type { CreateVersionDto as ICreateVersionDto } from '@tasku/types';

export class CreateVersionDto implements ICreateVersionDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateIf((o) => o.startDate !== null)
  @IsString()
  startDate?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.releaseDate !== null)
  @IsString()
  releaseDate?: string | null;
}
