import { IsEnum } from 'class-validator';
import { Role } from '@prisma/client';
import type { UpdateMemberRoleDto as IUpdateMemberRoleDto } from '@tasku/types';

export class UpdateMemberRoleDto implements IUpdateMemberRoleDto {
  @IsEnum(Role)
  role: Role;
}
