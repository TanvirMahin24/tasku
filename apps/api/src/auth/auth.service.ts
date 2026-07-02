import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { AuthResponse, UserDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { toUserDto } from '../common/mappers';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    // The very first user to register becomes the platform super admin.
    const userCount = await this.prisma.user.count();
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        platformRole: userCount === 0 ? 'SUPER_ADMIN' : 'MEMBER',
      },
    });
    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.bannedAt) {
      throw new UnauthorizedException('This account has been banned');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildAuthResponse(user);
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return toUserDto(user);
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
  } & Record<string, any>): AuthResponse {
    const accessToken = this.jwt.sign({ sub: user.id, email: user.email });
    return { accessToken, user: toUserDto(user) };
  }
}
