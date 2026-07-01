import { IsOptional, IsString, MinLength } from 'class-validator';
import type { CreateSubtaskDto as ICreateSubtaskDto } from '@tasku/types';

export class CreateSubtaskDto implements ICreateSubtaskDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;
}
