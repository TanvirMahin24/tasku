import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TeamRole } from '@prisma/client';
import type { AddTeamMemberDto as IAddTeamMemberDto } from '@tasku/types';

export class AddTeamMemberDto implements IAddTeamMemberDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsEnum(TeamRole)
  role?: TeamRole;
}
