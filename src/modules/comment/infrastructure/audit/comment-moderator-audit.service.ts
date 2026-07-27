/**
 * Comment Moderator Audit Service
 *
 * Persists audit records for moderator actions (hide, restore, report review)
 * into the shared `auth_audit_logs` table with `eventType = 'moderator_action'`.
 *
 * The class is unchanged from the legacy `CommentModeratorAuditService`
 * — only the action set and `targetType` have been narrowed to comment-only
 * after the threads were removed. The file is renamed in Phase 9.8 per
 * the directory layout in the plan §8.1.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { authAuditLogs } from '@/core/database/schema';

export type ModerationAction = 'hide_comment' | 'restore_comment' | 'review_report';

export interface ModerationAuditParams {
  actorId: string;
  actorRole: string;
  action: ModerationAction;
  targetType: 'comment' | 'report';
  targetId: string;
  reason?: string;
  result?: string;
}

const MODERATION_AUDIT_RETENTION_DAYS = 365;

@Injectable()
export class CommentModeratorAuditService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectPinoLogger(CommentModeratorAuditService.name)
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
