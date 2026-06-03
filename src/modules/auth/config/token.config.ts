import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseDurationToSeconds } from '@/core/utils/duration.util';

@Injectable()
export class TokenConfig {
  constructor(private readonly configService: ConfigService) {}

  private getRequiredString(key: string): string {
    return (
      this.configService.get<string>(key) ??
      (() => {
        throw new Error(`${key} is not defined in environment variables`);
      })()
    );
  }

  get access(): {
    secret: string;
    expiresInSeconds: number;
    issuer: string;
    audience: string;
  } {
    return {
      secret: this.getRequiredString('JWT_ACCESS_TOKEN_SECRET'),
      expiresInSeconds: this.getAccessTokenExpiresInSeconds(),
      issuer: this.getRequiredString('JWT_ACCESS_TOKEN_ISSUER').trim(),
      audience: this.getRequiredString('JWT_ACCESS_TOKEN_AUDIENCE').trim(),
    };
  }

  get refresh(): {
    secret: string;
    expiresInSeconds: number;
    issuer: string;
    audience: string;
  } {
    return {
      secret: this.getRequiredString('JWT_REFRESH_TOKEN_SECRET'),
      expiresInSeconds: this.getRefreshTokenExpiresInSeconds(),
      issuer: this.getRequiredString('JWT_ACCESS_TOKEN_ISSUER').trim(),
      audience: this.getRequiredString('JWT_ACCESS_TOKEN_AUDIENCE').trim(),
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
}
