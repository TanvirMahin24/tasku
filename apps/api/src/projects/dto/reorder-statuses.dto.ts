import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';
import type { ReorderStatusesDto as IReorderStatusesDto } from '@tasku/types';

export class ReorderStatusesDto implements IReorderStatusesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  statusIds: string[];
}
