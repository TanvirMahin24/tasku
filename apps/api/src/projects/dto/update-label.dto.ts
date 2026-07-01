import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import type { UpdateLabelDto as IUpdateLabelDto } from '@tasku/types';

export class UpdateLabelDto implements IUpdateLabelDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'color must be a hex color like #6b7280',
  })
  color?: string;
}
