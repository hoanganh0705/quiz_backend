import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Security policy configuration.
 *
 * Controls password reuse enforcement and other security-related thresholds.
 */
@Injectable()
export class SecurityConfig {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Number of previous password hashes to check when changing a password.
   * NIST 800-63B recommends checking against the last password(s).
   * Default: 5 previous passwords (covers most compliance requirements).
   */
  get maxPasswordHistorySize(): number {
    const rawValue = this.configService.get<number>('PASSWORD_HISTORY_SIZE');
    if (rawValue === undefined) return 5;
    if (typeof rawValue !== 'number' || !Number.isInteger(rawValue) || rawValue <= 0) {
      throw new Error('PASSWORD_HISTORY_SIZE must be a positive integer');
    }
    return rawValue;
  }
}
