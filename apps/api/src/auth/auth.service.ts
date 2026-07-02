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
import type { GoogleProfile } from './google-auth.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** SUPER_ADMIN for the very first account on the platform, else MEMBER. */
  private async platformRoleForNewUser(): Promise<'SUPER_ADMIN' | 'MEMBER'> {
    const userCount = await this.prisma.user.count();
    return userCount === 0 ? 'SUPER_ADMIN' : 'MEMBER';
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        platformRole: await this.platformRoleForNewUser(),
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
    // Google-only accounts have no password and cannot use the password form.
    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account uses Google sign-in. Continue with Google instead.',
      );
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildAuthResponse(user);
  }

  /**
   * Sign in (or provision) a user from a verified Google profile. Matches an
   * existing account by googleId first, then by email (linking Google to a
   * pre-existing password account). New accounts follow the same first-user
   * -> SUPER_ADMIN rule as registration.
   */
  async loginWithGoogle(profile: GoogleProfile): Promise<AuthResponse> {
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    if (!user) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });
      if (byEmail) {
        // Link Google to the existing account.
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: profile.googleId,
            avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl,
          },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            googleId: profile.googleId,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            platformRole: await this.platformRoleForNewUser(),
          },
        });
      }
    }

    if (user.bannedAt) {
      throw new UnauthorizedException('This account has been banned');
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
