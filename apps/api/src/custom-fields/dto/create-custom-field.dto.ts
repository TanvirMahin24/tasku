import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CustomFieldType } from '@prisma/client';
import type { CreateCustomFieldDto as ICreateCustomFieldDto } from '@tasku/types';

export class CreateCustomFieldDto implements ICreateCustomFieldDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEnum(CustomFieldType)
  type: CustomFieldType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}
