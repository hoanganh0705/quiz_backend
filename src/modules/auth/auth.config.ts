import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseDurationToSeconds } from '../../core/utils/duration.util';

@Injectable()
export class AuthConfig {
  constructor(private readonly configService: ConfigService) {}

  get isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  get accessTokenSecret(): string {
    return (
      this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET') ??
      (() => {
        throw new Error('JWT_ACCESS_TOKEN_SECRET is not defined in environment variables');
      })()
    );
  }

  get refreshTokenSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET') ??
      (() => {
        throw new Error('JWT_REFRESH_TOKEN_SECRET is not defined in environment variables');
      })()
    );
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
}
