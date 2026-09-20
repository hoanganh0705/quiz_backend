import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { SessionConfig } from '../../config/session.config';
import { extractRefreshTokenFromCookies } from '../../utils/refresh-token.util';

@Injectable()
export class AuthCookieService {
  constructor(private readonly sessionConfig: SessionConfig) {}

  setRefreshTokenCookie(response: Response, refreshToken: string): void {
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.sessionConfig.environment.isProduction,
      // `Lax` is required to support deep-link verification flows that land on
      // the frontend after the user clicks a link in their email client.
      // `Strict` would block those top-level GET navigations and break the
      // verify-email/reset-password hand-off. CSRF risk for this cookie is
      // mitigated by (a) `HttpOnly` preventing JS access, (b) `Secure` in
      // production, and (c) the global SameSite=Lax default preventing
      // cross-site POSTs from carrying the cookie.
      sameSite: 'lax',
      maxAge: this.sessionConfig.refreshTokenCookieMaxAgeMs,
      path: '/',
    });
  }

  clearRefreshTokenCookie(response: Response): void {
    response.clearCookie('refreshToken', {
      httpOnly: true,
      secure: this.sessionConfig.environment.isProduction,
      // Match `setRefreshTokenCookie` so the browser replaces the entry
      // with an identically-named, identically-flagged tombstone instead
      // of leaving a stricter/looser variant behind.
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
  }

  getRefreshTokenFromCookies(cookies: unknown): string | null {
    return extractRefreshTokenFromCookies(cookies);
  }
}
