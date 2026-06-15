import { Injectable } from '@nestjs/common';
import { SecurityConfig } from '../../config/security.config';
import { AuditLogService, type AuditRecordInput } from '@/common/audit/audit-log.service';

/**
 * Backward-compatible shim around the cross-domain
 * `AuditLogService`. Preserves the auth outbox call site
 * (`authAuditLogService.record({ eventType, userId, ipAddress,
 * metadata, createdAt })`) and the auth-domain retention
 * default.
 *
 * New code should depend on `AuditLogService` directly and use
 * the `domain` / `action` / `actorId` / `subjectUserId` fields
 * for structured filtering. This shim will stay as long as the
 * outbox processor uses it, and then can be deleted.
 */

type AuthAuditRecordInput = {
  eventType: string;
  userId?: string;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

@Injectable()
export class AuthAuditLogService {
  constructor(
    private readonly securityConfig: SecurityConfig,
    private readonly auditLogService: AuditLogService,
  ) {}

  async record(input: AuthAuditRecordInput): Promise<void> {
    const forwarded: AuditRecordInput = {
      eventType: input.eventType,
      userId: input.userId,
      ipAddress: input.ipAddress ?? null,
      metadata: input.metadata,
      createdAt: input.createdAt,
      domain: 'auth',
      retentionDays: this.securityConfig.authAuditRetentionDays,
    };
    await this.auditLogService.record(forwarded);
  }

  async purgeExpired(nowIso = new Date().toISOString()): Promise<number> {
    return this.auditLogService.purgeExpired(nowIso);
  }

  computeRetryDelaySeconds(attemptCount: number): number {
    const exponent = Math.max(0, attemptCount - 1);
    return this.securityConfig.outboxBaseDelaySeconds * 2 ** exponent;
  }

  buildNextAttemptIso(attemptCount: number, nowIso: string): string {
    const nextAttemptAt = new Date(nowIso);
    nextAttemptAt.setUTCSeconds(
      nextAttemptAt.getUTCSeconds() + this.computeRetryDelaySeconds(attemptCount),
    );
    return nextAttemptAt.toISOString();
  }

  get maxOutboxRetries(): number {
    return this.securityConfig.outboxMaxRetries;
  }
}
