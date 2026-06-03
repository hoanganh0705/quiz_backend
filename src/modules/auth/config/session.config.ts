import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseDurationToSeconds } from '@/core/utils/duration.util';

@Injectable()
export class SessionConfig {
  constructor(private readonly configService: ConfigService) {}

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
    if (rawValue === undefined) return 5;
    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error('MAX_ACTIVE_SESSIONS_PER_USER must be a positive integer');
    }
    return rawValue;
  }

  get refreshReuseGraceWindowMs(): number {
    return this.refreshReuseGraceWindowSeconds * 1_000;
  }

  get refreshReuseGraceWindowSeconds(): number {
    const rawValue = this.configService.get<number>('REFRESH_TOKEN_REUSE_GRACE_WINDOW_SECONDS');
    if (rawValue === undefined) return 10;
    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error('REFRESH_TOKEN_REUSE_GRACE_WINDOW_SECONDS must be a positive integer');
    }
    return rawValue;
  }

  get isBindingStrict(): boolean {
    const rawValue = this.configService.get<string | boolean>('SESSION_BINDING_STRICT');
    if (typeof rawValue === 'boolean') return rawValue;
    if (typeof rawValue !== 'string') return false;
    const normalizedValue = rawValue.trim().toLowerCase();
    return normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'yes';
  }

  get environment(): { isProduction: boolean } {
    return {
      isProduction: this.configService.get<string>('NODE_ENV') === 'production',
    };
  }

  private get refreshTokenExpiresInSeconds(): number {
    const rawValue = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN');
    if (!rawValue) {
      throw new Error('REFRESH_TOKEN_EXPIRES_IN is not defined in environment variables');
    }
    return parseDurationToSeconds(rawValue, 'REFRESH_TOKEN_EXPIRES_IN');
  }
}
