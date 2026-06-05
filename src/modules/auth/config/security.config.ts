import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const POSITIVE_INTEGER_ERROR_SUFFIX = 'must be a positive integer';
const DEFAULT_PASSWORD_HISTORY_SIZE = 5;

/**
 * Security policy configuration.
 *
 * Controls password reuse enforcement and other security-related thresholds.
 */
@Injectable()
export class SecurityConfig {
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

  /**
   * Number of previous password hashes to check when changing a password.
   * NIST 800-63B recommends checking against the last password(s).
   * Default: 5 previous passwords (covers most compliance requirements).
   */
  get maxPasswordHistorySize(): number {
    return this.getPositiveInteger('PASSWORD_HISTORY_SIZE', DEFAULT_PASSWORD_HISTORY_SIZE);
  }
}
