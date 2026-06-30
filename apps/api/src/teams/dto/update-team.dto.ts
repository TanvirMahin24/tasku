import { IsOptional, IsString, MinLength } from 'class-validator';
import type { UpdateTeamDto as IUpdateTeamDto } from '@tasku/types';

export class UpdateTeamDto implements IUpdateTeamDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;
}
