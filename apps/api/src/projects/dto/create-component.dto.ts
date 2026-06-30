import { IsString, MinLength } from 'class-validator';
import type { CreateComponentDto as ICreateComponentDto } from '@tasku/types';

export class CreateComponentDto implements ICreateComponentDto {
  @IsString()
  @MinLength(1)
  name: string;
}
