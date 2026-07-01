import { IsString, MinLength } from 'class-validator';
import type { UpdateComponentDto as IUpdateComponentDto } from '@tasku/types';

export class UpdateComponentDto implements IUpdateComponentDto {
  @IsString()
  @MinLength(1)
  name: string;
}
