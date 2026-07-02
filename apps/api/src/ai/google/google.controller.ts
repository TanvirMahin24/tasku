import {
  Controller,
  Delete,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { GoogleStatusDto } from '@tasku/types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/current-user.decorator';
import { GoogleService } from './google.service';

@Controller('ai/google')
export class GoogleController {
  constructor(private readonly google: GoogleService) {}

  @UseGuards(JwtAuthGuard)
  @Get('status')
  status(@CurrentUser() user: AuthUser): Promise<GoogleStatusDto> {
    return this.google.status(user.id);
  }

  /** Kick off the consent flow (302 to Google). */
  @UseGuards(JwtAuthGuard)
  @Get('connect')
  connect(@CurrentUser() user: AuthUser, @Res() res: Response): void {
    const url = this.google.getAuthUrl(user.id);
    if (!url) {
      res.status(400).json({ message: 'Google integration is not configured' });
      return;
    }
    res.redirect(url);
  }

  /**
   * OAuth redirect target. No JWT guard — the browser arrives here straight
   * from Google; the caller is authenticated via the signed `state`.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:5173';
    try {
      await this.google.handleCallback(code, state);
      res.redirect(`${webOrigin}/knowledge?google=connected`);
    } catch {
      res.redirect(`${webOrigin}/knowledge?google=error`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  disconnect(@CurrentUser() user: AuthUser): Promise<{ success: boolean }> {
    return this.google.disconnect(user.id);
  }
}
