import { Inject, Injectable } from '@nestjs/common';
import { lt, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { authAuditLogs } from '@/core/database/schema';
import { SecurityConfig } from '../../config/security.config';

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
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly securityConfig: SecurityConfig,
  ) {}

  async record(input: AuthAuditRecordInput): Promise<void> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const expiresAt = new Date(createdAt);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + this.securityConfig.authAuditRetentionDays);

    await this.db.insert(authAuditLogs).values({
      eventType: input.eventType,
      userId: input.userId,
      ipAddress: input.ipAddress ?? null,
      metadata: input.metadata ?? {},
      createdAt,
      expiresAt: expiresAt.toISOString(),
    });
  }

  async purgeExpired(nowIso = new Date().toISOString()): Promise<number> {
    const result = await this.db
      .delete(authAuditLogs)
      .where(lt(authAuditLogs.expiresAt, nowIso))
      .returning({ auditLogId: authAuditLogs.auditLogId });

    return result.length;
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
