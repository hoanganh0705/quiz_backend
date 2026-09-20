import { Inject, Injectable } from '@nestjs/common';
import { lt } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { authAuditLogs } from '@/core/database/schema';

export type AuditDomain =
  | 'auth'
  | 'user'
  | 'achievement'
  | 'review'
  | 'social'
  | 'quiz'
  | 'comment';

export type AuditRecordInput = {
  eventType: string;
  domain?: AuditDomain;
  action?: string;
  actorId?: string;
  subjectUserId?: string;
  userId?: string;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  retentionDays?: number;
};

const DEFAULT_AUDIT_RETENTION_DAYS = 90;

export type AuditExecutor = Pick<DrizzleDB, 'insert'>;

@Injectable()
export class AuditLogService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async record(input: AuditRecordInput): Promise<void> {
    return this.recordWithExecutor(this.db, input);
  }

  async recordWithExecutor(executor: AuditExecutor, input: AuditRecordInput): Promise<void> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const retentionDays = input.retentionDays ?? DEFAULT_AUDIT_RETENTION_DAYS;
    const expiresAt = new Date(createdAt);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + retentionDays);
    const indexedUserId = input.subjectUserId ?? input.actorId ?? input.userId ?? null;

    const metadata: Record<string, unknown> = {
      ...(input.metadata ?? {}),
    };
    if (input.domain !== undefined) metadata.domain = input.domain;
    if (input.action !== undefined) metadata.action = input.action;
    if (input.actorId !== undefined) metadata.actorId = input.actorId;
    if (input.subjectUserId !== undefined) metadata.subjectUserId = input.subjectUserId;

    await executor.insert(authAuditLogs).values({
      eventType: input.eventType,
      userId: indexedUserId,
      ipAddress: input.ipAddress ?? null,
      metadata,
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
}
