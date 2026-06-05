import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const POSITIVE_INTEGER_ERROR_SUFFIX = 'must be a positive integer';
const DEFAULT_EMAIL_VERIFICATION_TOKEN_TTL_SECONDS = 1_800;
const DEFAULT_EMAIL_VERIFICATION_BASE_URL = 'http://localhost:3000/verify-email';

@Injectable()
export class EmailVerificationConfig {
  constructor(private readonly configService: ConfigService) {}

  private getPositiveInteger(key: string, defaultValue: number): number {
    const rawValue = this.configService.get<number>(key);
    if (rawValue === undefined) {
      return defaultValue;
    }

    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error(`${key} ${POSITIVE_INTEGER_ERROR_SUFFIX}`);
    }

    return rawValue;
  }

  private getTrimmedString(key: string, defaultValue: string): string {
    const rawValue = this.configService.get<string>(key);
    if (!rawValue || rawValue.trim().length === 0) {
      return defaultValue;
    }

    return rawValue.trim();
  }

  get tokenTtlSeconds(): number {
    return this.getPositiveInteger(
      'EMAIL_VERIFICATION_TOKEN_TTL_SECONDS',
      DEFAULT_EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
    );
  }

  get baseUrl(): string {
    return this.getTrimmedString(
      'EMAIL_VERIFICATION_BASE_URL',
      DEFAULT_EMAIL_VERIFICATION_BASE_URL,
    );
  }
}
