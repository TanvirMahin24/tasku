import { IsEnum, IsString, MinLength } from 'class-validator';
import { StatusCategory } from '@prisma/client';
import type { CreateStatusDto as ICreateStatusDto } from '@tasku/types';

export class CreateStatusDto implements ICreateStatusDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEnum(StatusCategory)
  category: StatusCategory;
}
