import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailVerificationConfig {
  constructor(private readonly configService: ConfigService) {}

  get tokenTtlSeconds(): number {
    const rawValue = this.configService.get<number>('EMAIL_VERIFICATION_TOKEN_TTL_SECONDS');
    if (rawValue === undefined) return 1_800;
    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error('EMAIL_VERIFICATION_TOKEN_TTL_SECONDS must be a positive integer');
    }
    return rawValue;
  }

  get baseUrl(): string {
    const rawValue = this.configService.get<string>('EMAIL_VERIFICATION_BASE_URL');
    if (!rawValue || rawValue.trim().length === 0) {
      return 'http://localhost:3000/verify-email';
    }
    return rawValue.trim();
  }
}
