import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';

/** Profile returned by Google's OpenID userinfo endpoint. */
export interface GoogleProfile {
  googleId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

/**
 * Google OAuth for *sign-in* (OpenID Connect: openid/email/profile).
 *
 * This is deliberately separate from the Drive `GoogleService` used for the
 * knowledge base: sign-in issues no long-lived tokens and needs only the
 * identity scopes. Both reuse the same GOOGLE_CLIENT_ID/SECRET but each has
 * its own redirect URI.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  private readonly scopes = ['openid', 'email', 'profile'];

  get clientId(): string {
    return (process.env.GOOGLE_CLIENT_ID || '').trim();
  }
  get clientSecret(): string {
    return (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  }
  get redirect(): string {
    return (
      process.env.GOOGLE_AUTH_REDIRECT ||
      'http://localhost:4000/api/v1/auth/google/callback'
    );
  }
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.redirect);
  }

  private oauthClient() {
    return new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirect,
    );
  }

  /** Consent URL, or null when Google sign-in is not configured. */
  getAuthUrl(): string | null {
    if (!this.isConfigured()) return null;
    return this.oauthClient().generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account',
      scope: this.scopes,
    });
  }

  /** Exchange an OAuth code for the caller's verified Google profile. */
  async fetchProfile(code: string): Promise<GoogleProfile> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Google sign-in is not configured');
    }
    const client = this.oauthClient();
    let email: string | null = null;
    let googleId: string | null = null;
    let displayName: string | null = null;
    let avatarUrl: string | null = null;
    try {
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const { data } = await oauth2.userinfo.get();
      email = data.email ?? null;
      googleId = data.id ?? null;
      displayName = data.name ?? null;
      avatarUrl = data.picture ?? null;
    } catch (err) {
      this.logger.warn(`Google sign-in exchange failed: ${err}`);
      throw new BadRequestException('Could not verify Google account');
    }
    if (!email || !googleId) {
      throw new BadRequestException('Google account has no email');
    }
    return {
      googleId,
      email,
      displayName: displayName || email.split('@')[0],
      avatarUrl,
    };
  }
}
