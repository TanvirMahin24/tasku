import { IsEnum, IsString, MinLength } from 'class-validator';
import { LinkType } from '@prisma/client';
import type { CreateLinkDto as ICreateLinkDto } from '@tasku/types';

export class CreateLinkDto implements ICreateLinkDto {
  @IsEnum(LinkType)
  type: LinkType;

  @IsString()
  @MinLength(1)
  targetKey: string;
}
