import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PasswordResetConfig {
  constructor(private readonly configService: ConfigService) {}

  get tokenTtlSeconds(): number {
    const rawValue = this.configService.get<number>('PASSWORD_RESET_TOKEN_TTL_SECONDS');
    if (rawValue === undefined) return 3_600;
    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error('PASSWORD_RESET_TOKEN_TTL_SECONDS must be a positive integer');
    }
    return rawValue;
  }

  get baseUrl(): string {
    const rawValue = this.configService.get<string>('PASSWORD_RESET_BASE_URL');
    if (!rawValue || rawValue.trim().length === 0) {
      return 'http://localhost:3000/reset-password';
    }
    return rawValue.trim();
  }
}
