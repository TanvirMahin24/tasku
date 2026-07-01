import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { google } from 'googleapis';
import type { GoogleStatusDto } from '@tasku/types';
import { PrismaService } from '../../prisma/prisma.service';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

/** The Google editor kinds Majhi can export (a subset of KnowledgeLinkKind). */
export type GoogleKind = 'GOOGLE_DOC' | 'GOOGLE_SHEET' | 'GOOGLE_SLIDES';

/** Export MIME per Google editor type (Drive files.export). */
const EXPORT_MIME: Record<GoogleKind, string> = {
  GOOGLE_DOC: 'text/plain',
  GOOGLE_SHEET: 'text/csv',
  GOOGLE_SLIDES: 'text/plain',
};

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------
  get clientId(): string {
    return (process.env.GOOGLE_CLIENT_ID || '').trim();
  }
  get clientSecret(): string {
    return (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  }
  get redirect(): string {
    return (
      process.env.GOOGLE_OAUTH_REDIRECT ||
      'http://localhost:4000/api/v1/ai/google/callback'
    );
  }
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.redirect);
  }

  private oauthClient() {
    return new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirect);
  }

  // --- signed state (userId + HMAC over JWT_SECRET) ---
  private sign(userId: string): string {
    const secret = process.env.JWT_SECRET || 'change-me';
    const sig = createHmac('sha256', secret).update(userId).digest('hex');
    return `${userId}.${sig}`;
  }
  private verifyState(state: string): string | null {
    const dot = state.lastIndexOf('.');
    if (dot < 0) return null;
    const userId = state.slice(0, dot);
    const sig = state.slice(dot + 1);
    const expected = createHmac('sha256', process.env.JWT_SECRET || 'change-me')
      .update(userId)
      .digest('hex');
    try {
      if (
        sig.length === expected.length &&
        timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      ) {
        return userId;
      }
    } catch {
      /* length mismatch */
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // OAuth flow
  // ---------------------------------------------------------------------------
  getAuthUrl(userId: string): string | null {
    if (!this.isConfigured()) return null;
    return this.oauthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [DRIVE_SCOPE],
      state: this.sign(userId),
      include_granted_scopes: true,
    });
  }

  async status(userId: string): Promise<GoogleStatusDto> {
    const conn = await this.prisma.googleConnection.findUnique({
      where: { userId },
      select: { email: true },
    });
    const connected = !!conn;
    return {
      connected,
      email: conn?.email ?? null,
      authUrl: connected ? null : this.getAuthUrl(userId),
    };
  }

  /** Exchange the OAuth code, persist tokens, return the userId (from state). */
  async handleCallback(code: string, state: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Google integration is not configured');
    }
    const userId = this.verifyState(state);
    if (!userId) throw new BadRequestException('Invalid OAuth state');

    const client = this.oauthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Best-effort email lookup via Drive's `about` (allowed by drive.readonly).
    let email: string | null = null;
    try {
      const drive = google.drive({ version: 'v3', auth: client });
      const about = await drive.about.get({ fields: 'user(emailAddress)' });
      email = about.data.user?.emailAddress ?? null;
    } catch {
      email = null;
    }

    await this.prisma.googleConnection.upsert({
      where: { userId },
      create: {
        userId,
        email,
        accessToken: tokens.access_token ?? '',
        refreshToken: tokens.refresh_token ?? null,
        scope: tokens.scope ?? DRIVE_SCOPE,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      update: {
        email,
        accessToken: tokens.access_token ?? '',
        // keep an existing refresh token if Google didn't return a new one
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        scope: tokens.scope ?? DRIVE_SCOPE,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });
    return userId;
  }

  async disconnect(userId: string): Promise<{ success: boolean }> {
    await this.prisma.googleConnection.deleteMany({ where: { userId } });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Content fetch
  // ---------------------------------------------------------------------------
  /** Build an authed OAuth2 client that persists refreshed tokens. */
  private async clientForUser(userId: string) {
    const conn = await this.prisma.googleConnection.findUnique({
      where: { userId },
    });
    if (!conn) return null;
    const client = this.oauthClient();
    client.setCredentials({
      access_token: conn.accessToken,
      refresh_token: conn.refreshToken ?? undefined,
      expiry_date: conn.expiryDate ? conn.expiryDate.getTime() : undefined,
    });
    client.on('tokens', (tokens) => {
      void this.prisma.googleConnection
        .update({
          where: { userId },
          data: {
            accessToken: tokens.access_token ?? conn.accessToken,
            ...(tokens.refresh_token
              ? { refreshToken: tokens.refresh_token }
              : {}),
            expiryDate: tokens.expiry_date
              ? new Date(tokens.expiry_date)
              : conn.expiryDate,
          },
        })
        .catch(() => undefined);
    });
    return client;
  }

  /** Extract a Google file id + kind from a Docs/Sheets/Slides URL. */
  detectFile(url: string): { fileId: string; kind: GoogleKind } | null {
    const patterns: [RegExp, GoogleKind][] = [
      [/\/document\/d\/([a-zA-Z0-9_-]+)/, 'GOOGLE_DOC'],
      [/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/, 'GOOGLE_SHEET'],
      [/\/presentation\/d\/([a-zA-Z0-9_-]+)/, 'GOOGLE_SLIDES'],
    ];
    for (const [re, kind] of patterns) {
      const m = url.match(re);
      if (m) return { fileId: m[1], kind };
    }
    return null;
  }

  /** Export a Google file's text. Throws a clear error when not connected. */
  async fetchGoogleFileText(
    userId: string,
    fileId: string,
    kind: GoogleKind,
  ): Promise<string> {
    const client = await this.clientForUser(userId);
    if (!client) {
      throw new BadRequestException('Google account is not connected');
    }
    const drive = google.drive({ version: 'v3', auth: client });
    const res = await drive.files.export(
      { fileId, mimeType: EXPORT_MIME[kind] },
      { responseType: 'text' },
    );
    return typeof res.data === 'string' ? res.data : String(res.data ?? '');
  }
}
