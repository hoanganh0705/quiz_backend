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
      sameSite: 'lax',
      maxAge: this.sessionConfig.refreshTokenCookieMaxAgeMs,
      path: '/',
    });
  }

  clearRefreshTokenCookie(response: Response): void {
    response.clearCookie('refreshToken', {
      httpOnly: true,
      secure: this.sessionConfig.environment.isProduction,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
  }

  getRefreshTokenFromCookies(cookies: unknown): string | null {
    return extractRefreshTokenFromCookies(cookies);
  }
}
