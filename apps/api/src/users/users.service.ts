import { Injectable } from '@nestjs/common';
import type { UserDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { toUserDto } from '../common/mappers';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** All users, for assignee/member pickers. */
  async findAll(): Promise<UserDto[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { displayName: 'asc' },
    });
    return users.map(toUserDto);
  }
}
