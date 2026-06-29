import { IsString, MinLength } from 'class-validator';
import type { CreateCommentDto as ICreateCommentDto } from '@tasku/types';

export class CreateCommentDto implements ICreateCommentDto {
  @IsString()
  @MinLength(1)
  body: string;
}
