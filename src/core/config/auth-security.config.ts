/**
 * Auth security configuration.
 * Provides typed access to auth-specific security policy environment variables.
 *
 * Controls password reuse enforcement, audit log retention, and outbox retry behavior.
 */
import { ConfigType, registerAs } from '@nestjs/config';

export const authSecurityConfig = registerAs('authSecurity', () => ({
  maxPasswordHistorySize: Number(process.env.PASSWORD_HISTORY_SIZE ?? 5),
  authAuditRetentionDays: Number(process.env.AUTH_AUDIT_RETENTION_DAYS ?? 365),
  outboxMaxRetries: Number(process.env.AUTH_OUTBOX_MAX_RETRIES ?? 8),
  outboxBaseDelaySeconds: Number(process.env.AUTH_OUTBOX_BASE_DELAY_SECONDS ?? 30),
}));

export type AuthSecurityConfig = ConfigType<typeof authSecurityConfig>;
