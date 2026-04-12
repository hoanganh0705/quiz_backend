import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { AuthConfig } from '../auth.config';

@Injectable()
export class AuthCookieService {
  constructor(private readonly authConfig: AuthConfig) {}

  setRefreshTokenCookie(response: Response, refreshToken: string): void {
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.authConfig.isProduction,
      sameSite: 'lax',
      maxAge: this.authConfig.refreshTokenCookieMaxAgeMs,
      path: '/',
    });
  }

  clearRefreshTokenCookie(response: Response): void {
    response.clearCookie('refreshToken', {
      httpOnly: true,
      secure: this.authConfig.isProduction,
      sameSite: 'lax',
      path: '/',
    });
  }

  // cookies can be of various types depending on how the cookie parsing middleware is set up, so we need to be defensive here, cookies structure is an object with string keys and string values due to cookie-parser, but we can't guarantee that at the type level, so we need to check it at runtime
  getRefreshTokenFromCookies(cookies: unknown): string | null {
    if (!cookies || typeof cookies !== 'object') {
      return null;
    }

    const candidate = (cookies as Record<string, unknown>).refreshToken;
    return typeof candidate === 'string' ? candidate : null;
  }
}
