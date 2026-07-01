import { IsOptional, IsString, MinLength } from 'class-validator';
import type { CreateTeamDto as ICreateTeamDto } from '@tasku/types';

export class CreateTeamDto implements ICreateTeamDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;
}
