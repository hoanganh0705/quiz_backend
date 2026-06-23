import { Inject, Injectable } from '@nestjs/common';
import { authSecurityConfig } from '@/core/config/auth-security.config';
import type { AuthSecurityConfig } from '@/core/config/auth-security.config';

/**
 * Auth-domain wrapper around the core auth security typed config.
 * Preserves the @Injectable() surface consumed by ChangePasswordService and AuthAuditLogService.
 */
@Injectable()
export class SecurityConfig {
  constructor(
    @Inject(authSecurityConfig.KEY)
    private readonly authSecurity: AuthSecurityConfig,
  ) {}

  get maxPasswordHistorySize(): number {
    return this.authSecurity.maxPasswordHistorySize;
  }

  get authAuditRetentionDays(): number {
    return this.authSecurity.authAuditRetentionDays;
  }

  get outboxMaxRetries(): number {
    return this.authSecurity.outboxMaxRetries;
  }

  get outboxBaseDelaySeconds(): number {
    return this.authSecurity.outboxBaseDelaySeconds;
  }
}
