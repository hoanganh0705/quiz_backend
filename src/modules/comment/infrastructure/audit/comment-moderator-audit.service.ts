import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { authAuditLogs } from '@/core/database/schema';
import type {
  ModerationAuditParams,
  ModerationAuditPort,
  ModerationAuditTx,
} from '../../domain/ports/moderation-audit.port';

export const COMMENT_MODERATION_AUDIT_RETENTION_DAYS = 365;

@Injectable()
export class CommentModeratorAuditService implements ModerationAuditPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectPinoLogger(CommentModeratorAuditService.name)
    private readonly logger: PinoLogger,
  ) {}

  async logInsideTx(tx: ModerationAuditTx, params: ModerationAuditParams): Promise<void> {
    const { createdAt, expiresAt } = this.timestamps();
    const insertable = tx as unknown as {
      insert(table: unknown): {
        values(
          values: Record<string, unknown>,
        ): { returning(): Promise<unknown> } | Promise<unknown>;
      };
    };

    await insertable.insert(authAuditLogs).values({
      eventType: 'moderator_action',
      userId: params.actorId,
      metadata: {
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        actorRole: params.actorRole ?? null,
        reason: params.reason ?? null,
        result: params.result ?? null,
      },
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    this.logger.debug({
      event: 'moderator_action_audited_in_tx',
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
    });
  }

  async log(params: ModerationAuditParams): Promise<void> {
    const { createdAt, expiresAt } = this.timestamps();
    await this.db.insert(authAuditLogs).values({
      eventType: 'moderator_action',
      userId: params.actorId,
      metadata: {
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        actorRole: params.actorRole ?? null,
        reason: params.reason ?? null,
        result: params.result ?? null,
      },
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    this.logger.info({
      event: 'moderator_action_audited',
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
    });
  }

  private timestamps(): { createdAt: Date; expiresAt: Date } {
    const createdAt = new Date();
    const expiresAt = new Date(createdAt);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + COMMENT_MODERATION_AUDIT_RETENTION_DAYS);
    return { createdAt, expiresAt };
  }
}
