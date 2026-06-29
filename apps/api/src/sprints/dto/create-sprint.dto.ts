import { IsOptional, IsString, MinLength } from 'class-validator';
import type { CreateSprintDto as ICreateSprintDto } from '@tasku/types';

export class CreateSprintDto implements ICreateSprintDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  goal?: string;
}
