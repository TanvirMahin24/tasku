import { Controller, Get, UseGuards } from '@nestjs/common';
import type { UserDto } from '@tasku/types';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  findAll(): Promise<UserDto[]> {
    return this.users.findAll();
  }
}
