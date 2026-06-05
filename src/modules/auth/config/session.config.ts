import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseDurationToSeconds } from '@/core/utils/duration.util';

const POSITIVE_INTEGER_ERROR_SUFFIX = 'must be a positive integer';

@Injectable()
export class SessionConfig {
  constructor(private readonly configService: ConfigService) {}

  private getPositiveInteger(key: string, defaultValue?: number): number {
    const rawValue = this.configService.get<number>(key);
    if (rawValue === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }

      throw new Error(`${key} is not defined in environment variables`);
    }

    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error(`${key} ${POSITIVE_INTEGER_ERROR_SUFFIX}`);
    }

    return rawValue;
  }

  private getRequiredDurationSeconds(key: string): number {
    const rawValue = this.configService.get<string>(key);
    if (!rawValue) {
      throw new Error(`${key} is not defined in environment variables`);
    }

    return parseDurationToSeconds(rawValue, key);
  }

  private getBooleanLike(key: string): boolean {
    const rawValue = this.configService.get<string | boolean>(key);
    if (typeof rawValue === 'boolean') return rawValue;
    if (typeof rawValue !== 'string') return false;

    const normalizedValue = rawValue.trim().toLowerCase();
    return normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'yes';
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
    return this.getPositiveInteger('MAX_ACTIVE_SESSIONS_PER_USER', 5);
  }

  get refreshReuseGraceWindowMs(): number {
    return this.refreshReuseGraceWindowSeconds * 1_000;
  }

  get refreshReuseGraceWindowSeconds(): number {
    return this.getPositiveInteger('REFRESH_TOKEN_REUSE_GRACE_WINDOW_SECONDS', 10);
  }

  get enforceDeviceBinding(): boolean {
    return this.getBooleanLike('SESSION_BINDING_STRICT');
  }

  get environment(): { isProduction: boolean } {
    return {
      isProduction: this.configService.get<string>('NODE_ENV') === 'production',
    };
  }

  private get refreshTokenExpiresInSeconds(): number {
    return this.getRequiredDurationSeconds('REFRESH_TOKEN_EXPIRES_IN');
  }
}
