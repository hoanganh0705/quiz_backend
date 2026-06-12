/**
 * Discussion Moderator Audit Service
 *
 * Persists audit records for moderator actions (hide, restore, report review)
 * into the shared `auth_audit_logs` table with eventType = 'moderator_action'.
 * This enables compliance reporting and security review without a separate table.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { authAuditLogs } from '@/core/database/schema';

export type ModerationAction =
  | 'hide_thread'
  | 'restore_thread'
  | 'hide_comment'
  | 'restore_comment'
  | 'review_report';

export interface ModerationAuditParams {
  actorId: string;
  actorRole: string;
  action: ModerationAction;
  targetType: 'thread' | 'comment' | 'report';
  targetId: string;
  reason?: string;
  result?: string;
}

const MODERATION_AUDIT_RETENTION_DAYS = 365;

@Injectable()
export class DiscussionModeratorAuditService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectPinoLogger(DiscussionModeratorAuditService.name)
    private readonly logger: PinoLogger,
  ) {}

  async log(params: ModerationAuditParams): Promise<void> {
    const createdAt = new Date();
    const expiresAt = new Date(createdAt);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + MODERATION_AUDIT_RETENTION_DAYS);

    await this.db.insert(authAuditLogs).values({
      eventType: 'moderator_action',
      userId: params.actorId,
      metadata: {
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        actorRole: params.actorRole,
        reason: params.reason ?? null,
        result: params.result ?? null,
      },
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    this.logger.info({
      event: 'moderator_action_audited',
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
    });
  }
}
