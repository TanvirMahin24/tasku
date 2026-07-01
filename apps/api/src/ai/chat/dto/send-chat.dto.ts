import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type {
  ChatContext,
  ChatContextType,
  SendChatDto as ISendChatDto,
} from '@tasku/types';

const CONTEXT_TYPES: ChatContextType[] = [
  'global',
  'project',
  'board',
  'view',
  'issue',
  'release',
  'team',
  'dashboard',
];

export class ChatContextDto implements ChatContext {
  @IsIn(CONTEXT_TYPES)
  type: ChatContextType;

  @IsOptional()
  @IsString()
  id?: string | null;

  @IsOptional()
  @IsString()
  projectKey?: string | null;
}

export class SendChatDto implements ISendChatDto {
  @IsString()
  @MinLength(1)
  message: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatContextDto)
  context?: ChatContextDto;

  @IsOptional()
  @IsString()
  sessionId?: string | null;
}
