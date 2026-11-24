import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { SessionConfig } from '../../config/session.config';
import { extractRefreshTokenFromCookies } from '../../utils/refresh-token.util';

@Injectable()
export class AuthCookieService {
  constructor(private readonly sessionConfig: SessionConfig) {}

  setRefreshTokenCookie(
    response: Response,
    refreshToken: string,
    rememberMe: boolean = false,
  ): void {
    const isProduction = this.sessionConfig.environment.isProduction;
    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'lax';
      path: string;
      maxAge?: number;
    } = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    };

    if (rememberMe) {
      // 30 days persistent cookie
      cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000;
    }
    // When rememberMe is false, omitting maxAge makes Express emit a session cookie (no Expires/Max-Age)

    response.cookie('refreshToken', refreshToken, cookieOptions);
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
