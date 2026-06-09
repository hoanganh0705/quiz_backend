import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const POSITIVE_INTEGER_ERROR_SUFFIX = 'must be a positive integer';
const DEFAULT_PASSWORD_HISTORY_SIZE = 5;
const DEFAULT_AUTH_AUDIT_RETENTION_DAYS = 365;
const DEFAULT_OUTBOX_MAX_RETRIES = 8;
const DEFAULT_OUTBOX_BASE_DELAY_SECONDS = 30;

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

  get authAuditRetentionDays(): number {
    return this.getPositiveInteger('AUTH_AUDIT_RETENTION_DAYS', DEFAULT_AUTH_AUDIT_RETENTION_DAYS);
  }

  get outboxMaxRetries(): number {
    return this.getPositiveInteger('AUTH_OUTBOX_MAX_RETRIES', DEFAULT_OUTBOX_MAX_RETRIES);
  }

  get outboxBaseDelaySeconds(): number {
    return this.getPositiveInteger(
      'AUTH_OUTBOX_BASE_DELAY_SECONDS',
      DEFAULT_OUTBOX_BASE_DELAY_SECONDS,
    );
  }
}
