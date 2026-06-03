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

  get environment(): { isProduction: boolean } {
    return {
      isProduction: this.configService.get<string>('NODE_ENV') === 'production',
    };
  }

  get tokens(): {
    access: {
      secret: string;
      expiresInSeconds: number;
      issuer: string;
      audience: string;
    };
    refresh: {
      secret: string;
      expiresInSeconds: number;
      issuer: string;
      audience: string;
    };
  } {
    return {
      access: {
        secret: this.getRequiredStringConfig('JWT_ACCESS_TOKEN_SECRET'),
        expiresInSeconds: this.getAccessTokenExpiresInSeconds(),
        issuer: this.getRequiredStringConfig('JWT_ACCESS_TOKEN_ISSUER').trim(),
        audience: this.getRequiredStringConfig('JWT_ACCESS_TOKEN_AUDIENCE').trim(),
      },
      refresh: {
        secret: this.getRequiredStringConfig('JWT_REFRESH_TOKEN_SECRET'),
        expiresInSeconds: this.getRefreshTokenExpiresInSeconds(),
        issuer: this.getRequiredStringConfig('JWT_ACCESS_TOKEN_ISSUER').trim(),
        audience: this.getRequiredStringConfig('JWT_ACCESS_TOKEN_AUDIENCE').trim(),
      },
    };
  }

  get sessions(): {
    refreshTokenCookieMaxAgeMs: number;
    refreshSessionTtlMs: number;
    maxActiveSessionsPerUser: number;
    refreshReuseGraceWindowMs: number;
    isBindingStrict: boolean;
  } {
    const refreshTokenCookieMaxAgeMs = this.getRefreshTokenCookieMaxAgeMs();
    const refreshTokenExpiresInSeconds = this.getRefreshTokenExpiresInSeconds();

    return {
      refreshTokenCookieMaxAgeMs,
      refreshSessionTtlMs: Math.min(
        refreshTokenCookieMaxAgeMs,
        refreshTokenExpiresInSeconds * 1_000,
      ),
      maxActiveSessionsPerUser: this.getMaxActiveSessionsPerUser(),
      refreshReuseGraceWindowMs: this.getRefreshReuseGraceWindowSeconds() * 1_000,
      isBindingStrict: this.getIsSessionBindingStrict(),
    };
  }

  get emailVerification(): { tokenTtlSeconds: number; baseUrl: string } {
    return {
      tokenTtlSeconds: this.getEmailVerificationTokenTtlSeconds(),
      baseUrl: this.getEmailVerificationBaseUrl(),
    };
  }

  get passwordReset(): { tokenTtlSeconds: number; baseUrl: string } {
    return {
      tokenTtlSeconds: this.getPasswordResetTokenTtlSeconds(),
      baseUrl: this.getPasswordResetBaseUrl(),
    };
  }

  private getAccessTokenExpiresInSeconds(): number {
    const rawValue = this.configService.get<string>('ACCESS_TOKEN_EXPIRES_IN');
    if (!rawValue) {
      throw new Error('ACCESS_TOKEN_EXPIRES_IN is not defined in environment variables');
    }

    return parseDurationToSeconds(rawValue, 'ACCESS_TOKEN_EXPIRES_IN');
  }

  private getRefreshTokenExpiresInSeconds(): number {
    const rawValue = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN');
    if (!rawValue) {
      throw new Error('REFRESH_TOKEN_EXPIRES_IN is not defined in environment variables');
    }

    return parseDurationToSeconds(rawValue, 'REFRESH_TOKEN_EXPIRES_IN');
  }

  private getRefreshTokenCookieMaxAgeMs(): number {
    const rawValue = this.configService.get<number>('REFRESH_TOKEN_COOKIE_MAX_AGE_MS');

    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error('REFRESH_TOKEN_COOKIE_MAX_AGE_MS must be a positive integer');
    }

    return rawValue;
  }

  private getMaxActiveSessionsPerUser(): number {
    const rawValue = this.configService.get<number>('MAX_ACTIVE_SESSIONS_PER_USER');

    if (rawValue === undefined) {
      return 5;
    }

    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error('MAX_ACTIVE_SESSIONS_PER_USER must be a positive integer');
    }

    return rawValue;
  }

  private getRefreshReuseGraceWindowSeconds(): number {
    const rawValue = this.configService.get<number>('REFRESH_TOKEN_REUSE_GRACE_WINDOW_SECONDS');

    if (rawValue === undefined) {
      return 10;
    }

    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error('REFRESH_TOKEN_REUSE_GRACE_WINDOW_SECONDS must be a positive integer');
    }

    return rawValue;
  }

  private getIsSessionBindingStrict(): boolean {
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

  private getEmailVerificationTokenTtlSeconds(): number {
    const rawValue = this.configService.get<number>('EMAIL_VERIFICATION_TOKEN_TTL_SECONDS');

    if (rawValue === undefined) {
      return 1_800;
    }

    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error('EMAIL_VERIFICATION_TOKEN_TTL_SECONDS must be a positive integer');
    }

    return rawValue;
  }

  private getEmailVerificationBaseUrl(): string {
    const rawValue = this.configService.get<string>('EMAIL_VERIFICATION_BASE_URL');

    if (!rawValue || rawValue.trim().length === 0) {
      return 'http://localhost:3000/verify-email';
    }

    return rawValue.trim();
  }

  private getPasswordResetTokenTtlSeconds(): number {
    const rawValue = this.configService.get<number>('PASSWORD_RESET_TOKEN_TTL_SECONDS');

    if (rawValue === undefined) {
      return 3_600;
    }

    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error('PASSWORD_RESET_TOKEN_TTL_SECONDS must be a positive integer');
    }

    return rawValue;
  }

  private getPasswordResetBaseUrl(): string {
    const rawValue = this.configService.get<string>('PASSWORD_RESET_BASE_URL');

    if (!rawValue || rawValue.trim().length === 0) {
      return 'http://localhost:3000/reset-password';
    }

    return rawValue.trim();
  }
}
