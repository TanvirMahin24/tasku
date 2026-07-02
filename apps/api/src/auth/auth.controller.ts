import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type {
  AuthProvidersDto,
  AuthResponse,
  UserDto,
} from '@tasku/types';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  private get webOrigin(): string {
    return process.env.WEB_ORIGIN || 'http://localhost:5173';
  }

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.auth.login(dto);
  }

  /** Which third-party sign-in options the UI should offer. Public. */
  @Get('providers')
  providers(): AuthProvidersDto {
    return { google: this.googleAuth.isConfigured() };
  }

  /** Kick off Google sign-in by redirecting to Google's consent screen. */
  @Get('google')
  google(@Res() res: Response): void {
    const url = this.googleAuth.getAuthUrl();
    if (!url) {
      res.redirect(`${this.webOrigin}/login?error=google_unconfigured`);
      return;
    }
    res.redirect(url);
  }

  /**
   * Google redirects back here with a `code`. Exchange it, sign the user in,
   * and hand the JWT to the SPA via a URL fragment (never logged/sent to the
   * server) at /auth/callback.
   */
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (error || !code) {
      res.redirect(`${this.webOrigin}/login?error=google_denied`);
      return;
    }
    try {
      const profile = await this.googleAuth.fetchProfile(code);
      const auth = await this.auth.loginWithGoogle(profile);
      res.redirect(`${this.webOrigin}/auth/callback#token=${auth.accessToken}`);
    } catch {
      res.redirect(`${this.webOrigin}/login?error=google_failed`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.auth.me(user.id);
  }
}
