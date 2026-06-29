import { IsOptional, IsString, ValidateIf } from 'class-validator';
import type { MoveIssueDto as IMoveIssueDto } from '@tasku/types';

export class MoveIssueDto implements IMoveIssueDto {
  @IsString()
  statusId: string;

  // The issue this card is dropped directly AFTER (its upper neighbor).
  @IsOptional()
  @ValidateIf((o) => o.beforeId !== null)
  @IsString()
  beforeId?: string | null;

  // The issue this card is dropped directly BEFORE (its lower neighbor).
  @IsOptional()
  @ValidateIf((o) => o.afterId !== null)
  @IsString()
  afterId?: string | null;
}
