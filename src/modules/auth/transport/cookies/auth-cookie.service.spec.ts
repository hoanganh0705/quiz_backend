import { AuthCookieService } from './auth-cookie.service';
import type { Response } from 'express';
import type { SessionConfig } from '../../config/session.config';

describe('AuthCookieService', () => {
  let service: AuthCookieService;
  let mockResponse: Partial<Response>;
  let cookieSpy: jest.Mock;
  let clearCookieSpy: jest.Mock;

  const mockSessionConfig = {
    environment: { isProduction: true },
    refreshTokenCookieMaxAgeMs: 604800000,
  } as unknown as SessionConfig;

  beforeEach(() => {
    cookieSpy = jest.fn();
    clearCookieSpy = jest.fn();
    mockResponse = {
      cookie: cookieSpy as any,
      clearCookie: clearCookieSpy as any,
    };
    service = new AuthCookieService(mockSessionConfig);
  });

  describe('setRefreshTokenCookie', () => {
    it('sets a persistent cookie with 30-day maxAge when rememberMe is true', () => {
      service.setRefreshTokenCookie(mockResponse as Response, 'test-refresh-token', true);

      expect(cookieSpy).toHaveBeenCalledWith('refreshToken', 'test-refresh-token', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    });

    it('sets a session cookie (no maxAge) when rememberMe is false or omitted', () => {
      service.setRefreshTokenCookie(mockResponse as Response, 'test-refresh-token', false);

      expect(cookieSpy).toHaveBeenCalledWith('refreshToken', 'test-refresh-token', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      });
    });
  });

  describe('clearRefreshTokenCookie', () => {
    it('clears the cookie with maxAge: 0', () => {
      service.clearRefreshTokenCookie(mockResponse as Response);

      expect(clearCookieSpy).toHaveBeenCalledWith('refreshToken', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
    });
  });
});
