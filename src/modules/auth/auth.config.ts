import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseDurationToSeconds } from '@/core/utils/duration.util';

@Injectable()
export class AuthConfig {
  constructor(private readonly configService: ConfigService) {}

  private getRequiredStringConfig(key: string): string {
    return (
      this.configService.get<string>(key) ??
      (() => {
        throw new Error(`${key} is not defined in environment variables`);
      })()
    );
  }

  get isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  get accessTokenSecret(): string {
    return this.getRequiredStringConfig('JWT_ACCESS_TOKEN_SECRET');
  }

  get refreshTokenSecret(): string {
    return this.getRequiredStringConfig('JWT_REFRESH_TOKEN_SECRET');
  }

  get accessTokenExpiresInSeconds(): number {
    const rawValue = this.configService.get<string>('ACCESS_TOKEN_EXPIRES_IN');
    if (!rawValue) {
      throw new Error('ACCESS_TOKEN_EXPIRES_IN is not defined in environment variables');
    }

    return parseDurationToSeconds(rawValue, 'ACCESS_TOKEN_EXPIRES_IN');
  }

  get refreshTokenExpiresInSeconds(): number {
    const rawValue = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN');
    if (!rawValue) {
      throw new Error('REFRESH_TOKEN_EXPIRES_IN is not defined in environment variables');
    }

    return parseDurationToSeconds(rawValue, 'REFRESH_TOKEN_EXPIRES_IN');
  }

  get refreshTokenCookieMaxAgeMs(): number {
    const rawValue = this.configService.get<number>('REFRESH_TOKEN_COOKIE_MAX_AGE_MS');

    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error('REFRESH_TOKEN_COOKIE_MAX_AGE_MS must be a positive integer');
    }

    return rawValue;
  }

  get refreshSessionTtlMs(): number {
    return Math.min(this.refreshTokenCookieMaxAgeMs, this.refreshTokenExpiresInSeconds * 1_000);
  }

  get maxActiveSessionsPerUser(): number {
    const rawValue = this.configService.get<number>('MAX_ACTIVE_SESSIONS_PER_USER');

    if (rawValue === undefined) {
      return 5;
    }

    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error('MAX_ACTIVE_SESSIONS_PER_USER must be a positive integer');
    }

    return rawValue;
  }

  get accessTokenIssuer(): string {
    return this.getRequiredStringConfig('JWT_ACCESS_TOKEN_ISSUER').trim();
  }

  get accessTokenAudience(): string {
    return this.getRequiredStringConfig('JWT_ACCESS_TOKEN_AUDIENCE').trim();
  }

  get refreshReuseGraceWindowSeconds(): number {
    const rawValue = this.configService.get<number>('REFRESH_TOKEN_REUSE_GRACE_WINDOW_SECONDS');

    if (rawValue === undefined) {
      return 10;
    }

    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error('REFRESH_TOKEN_REUSE_GRACE_WINDOW_SECONDS must be a positive integer');
    }

    return rawValue;
  }

  get refreshReuseGraceWindowMs(): number {
    return this.refreshReuseGraceWindowSeconds * 1_000;
  }

  get isSessionBindingStrict(): boolean {
    const rawValue = this.configService.get<string | boolean>('SESSION_BINDING_STRICT');

    if (typeof rawValue === 'boolean') {
      return rawValue;
    }

    if (typeof rawValue !== 'string') {
      return false;
    }

    const normalizedValue = rawValue.trim().toLowerCase();
    return normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'yes';
  }

  get emailVerificationTokenTtlSeconds(): number {
    const rawValue = this.configService.get<number>('EMAIL_VERIFICATION_TOKEN_TTL_SECONDS');

    if (rawValue === undefined) {
      return 1_800;
    }

    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error('EMAIL_VERIFICATION_TOKEN_TTL_SECONDS must be a positive integer');
    }

    return rawValue;
  }

  get emailVerificationBaseUrl(): string {
    const rawValue = this.configService.get<string>('EMAIL_VERIFICATION_BASE_URL');

    if (!rawValue || rawValue.trim().length === 0) {
      return 'http://localhost:3000/verify-email';
    }

    return rawValue.trim();
  }
}
