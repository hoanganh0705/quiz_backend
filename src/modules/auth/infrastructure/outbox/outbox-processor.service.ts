import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, lte } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import { BaseOutboxProcessor, type BaseOutboxRow } from '@/common/outbox/base-outbox-processor';
import { AuthAuditLogService } from '../audit/auth-audit-log.service';
import { correlationIdStorage, createCorrelationId } from '@/common/interceptors/correlation-id';
import {
  AUTH_SECURITY_NOTIFICATION_PORT,
  type AuthSecurityNotificationPort,
} from '@/modules/notification/domain/ports/notification-ports';

const AUTH_OUTBOX_BATCH_SIZE = 100;

type OutboxEventRow = BaseOutboxRow & {
  userId?: string | null;
  ipAddress?: string | null;
  revokedByIp?: string | null;
  revokedSessionCount?: number;
  provider?: string;
  sessionId?: string;
};
@Injectable()
export class OutboxProcessorService extends BaseOutboxProcessor<OutboxEventRow> {
  protected readonly batchSize = AUTH_OUTBOX_BATCH_SIZE;
  protected readonly logPrefix = 'auth';

  protected get maxRetries(): number {
    return this.authAuditLogService.maxOutboxRetries;
  }
  protected get baseDelaySeconds(): number {
    return this.authAuditLogService['securityConfig'].outboxBaseDelaySeconds;
  }

  protected readonly aggregateType = 'auth';

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly authAuditLogService: AuthAuditLogService,
    @Inject(AUTH_SECURITY_NOTIFICATION_PORT)
    private readonly authSecurityNotificationService: AuthSecurityNotificationPort,
    @InjectPinoLogger(OutboxProcessorService.name) private readonly logger: PinoLogger,
  ) {
    super();
  }

  protected override buildPendingWhere(nowIso: string) {
    return and(
      isNull(outboxEvents.processedAt),
      isNull(outboxEvents.failedAt),
      lte(outboxEvents.nextAttemptAt, nowIso),
    )!;
  }

  @Cron('*/30 * * * * *')
  async processPendingEvents(): Promise<void> {
    const result = await this.runProcessPendingEvents(this.db);
    this.logger.info({
      event: 'auth_outbox_processor_completed',
      processedCount: result.processed,
      failedCount: result.failed,
      idempotencyConflicts: result.idempotencyConflicts,
      movedToDlq: result.movedToDlq,
      scannedCount: result.scanned,
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredAuditLogs(): Promise<void> {
    const purgedCount = await this.authAuditLogService.purgeExpired();
    if (purgedCount > 0) {
      this.logger.info({
        event: 'auth_audit_logs_purged',
        purgedCount,
      });
    }
  }

  /**
   * DLQ monitor: scan the outbox for events that have been moved to
   * the dead-letter queue (`failedAt IS NOT NULL AND dlqReason IS NOT
   * NULL`) and emit a high-severity alert. Runs every five minutes so
   * a poisoned event that slips past the cron filter is surfaced
   * within a few minutes of being marked, well before it can
   * accumulate and start filling the outbox.
   */
  @Cron('*/5 * * * *')
  async monitorDeadLetterQueue(): Promise<void> {
    const count = await this.runMonitorDeadLetterQueue(this.db);
    if (count > 0) {
      this.logger.error({
        event: 'auth_outbox_dlq_alert',
        totalDlqEvents: count,
      });
    }
  }

  protected override async handleFailure(
    _db: DrizzleDB,
    row: OutboxEventRow,
    error: unknown,
    nowIso: string,
  ): Promise<'retried' | 'dlq'> {
    const nextAttemptCount = (row.attemptCount ?? 0) + 1;
    const lastError = error instanceof Error ? error.message : 'Unknown error';
    const retriesExhausted = nextAttemptCount >= this.authAuditLogService.maxOutboxRetries;

    const updateValues: Record<string, unknown> = retriesExhausted
      ? {
          attemptCount: nextAttemptCount,
          lastAttemptAt: nowIso,
          nextAttemptAt: nowIso,
          lastError,
          failedAt: nowIso,
          dlqReason: `exhausted_retries:${lastError}`,
        }
      : {
          attemptCount: nextAttemptCount,
          lastAttemptAt: nowIso,
          nextAttemptAt: this.authAuditLogService.buildNextAttemptIso(nextAttemptCount, nowIso),
          lastError,
        };

    await _db
      .update(outboxEvents)
      .set(updateValues)
      .where(and(eq(outboxEvents.eventId, row.eventId), isNull(outboxEvents.processedAt)));

    if (retriesExhausted) {
      this.logger.error({
        event: 'auth_outbox_event_exhausted_retries',
        outboxEventId: row.eventId,
        aggregateType: row.aggregateType,
        eventType: row.eventType,
        attemptCount: nextAttemptCount,
        dlqReason: updateValues['dlqReason'] as string,
        message: lastError,
      });
    } else {
      this.logger.warn({
        event: 'auth_outbox_event_retry_scheduled',
        outboxEventId: row.eventId,
        aggregateType: row.aggregateType,
        eventType: row.eventType,
        attemptCount: nextAttemptCount,
        nextAttemptAt: updateValues['nextAttemptAt'] as string,
        message: lastError,
      });
    }

    return retriesExhausted ? 'dlq' : 'retried';
  }

  protected async dispatch(row: OutboxEventRow): Promise<void> {
    const userId = this.readString(row.payload['userId']);
    const ipAddress =
      this.readOptionalString(row.payload['ipAddress']) ??
      this.readOptionalString(row.payload['revokedByIp']);
    const correlationId = row.correlationId ?? createCorrelationId();

    let captured: unknown;
    await new Promise<void>((resolve) => {
      correlationIdStorage.run({ correlationId }, async () => {
        try {
          switch (`${row.aggregateType}:${row.eventType}`) {
            case 'password_reset:password_reset_completed':
            case 'password_reset:password_reset_requested':
            case 'account:account_deleted':
            case 'account:password_changed':
            case 'session:session_revoked':
            case 'session:all_other_sessions_revoked':
            case 'oauth_account:oauth_account_created':
            case 'oauth_account:oauth_account_linked':
            case 'oauth_login:oauth_login':
            case 'oauth_login:oauth_login_failed': {
              await this.authAuditLogService.record({
                eventType: row.eventType,
                userId: userId ?? undefined,
                ipAddress,
                metadata: {
                  aggregateType: row.aggregateType,
                  ...row.payload,
                },
                createdAt: new Date().toISOString(),
              });
              await this.sendSecurityNotification(row, userId, ipAddress);
              resolve();
              return;
            }
            default:
              captured = new Error(
                `Unsupported outbox event dispatcher key: ${row.aggregateType}:${row.eventType}`,
              );
              resolve();
              return;
          }
        } catch (err) {
          captured = err;
          resolve();
        }
      });
    });
    if (captured !== undefined) {
      const reason = captured instanceof Error ? captured.message : JSON.stringify(captured);
      throw new Error(reason);
    }
  }

  protected override onIdempotencyConflict(row: OutboxEventRow): void {
    this.logger.debug({
      event: 'auth_outbox_event_skipped_idempotent',
      outboxEventId: row.eventId,
      aggregateType: row.aggregateType,
      eventType: row.eventType,
    });
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private readOptionalString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private async sendSecurityNotification(
    event: OutboxEventRow,
    userId: string | null,
    ipAddress: string | null,
  ): Promise<void> {
    if (!userId) return;

    try {
      switch (`${event.aggregateType}:${event.eventType}`) {
        case 'account:password_changed':
          await this.authSecurityNotificationService.notifyPasswordChanged({ userId, ipAddress });
          break;

        case 'password_reset:password_reset_requested':
          await this.authSecurityNotificationService.notifyPasswordResetRequested({
            userId,
            ipAddress,
          });
          break;

        case 'password_reset:password_reset_completed':
          await this.authSecurityNotificationService.notifyPasswordResetCompleted({
            userId,
            ipAddress,
          });
          break;

        case 'account:account_deleted':
          await this.authSecurityNotificationService.notifyAccountDeleted({ userId, ipAddress });
          break;

        case 'session:session_revoked': {
          const sessionId = this.readString(event.payload['sessionId']) ?? 'unknown';
          await this.authSecurityNotificationService.notifySessionRevoked({
            userId,
            sessionId,
            ipAddress,
          });
          break;
        }

        case 'session:all_other_sessions_revoked': {
          const count =
            typeof event.payload['revokedSessionCount'] === 'number'
              ? event.payload['revokedSessionCount']
              : 0;
          await this.authSecurityNotificationService.notifyAllSessionsRevoked({
            userId,
            revokedSessionCount: count,
            ipAddress,
          });
          break;
        }

        case 'oauth_account:oauth_account_linked': {
          const provider = this.readString(event.payload['provider']) ?? 'unknown';
          await this.authSecurityNotificationService.notifyOAuthLinked({ userId, provider });
          break;
        }

        case 'oauth_account:oauth_account_created': {
          const provider = this.readString(event.payload['provider']) ?? 'unknown';
          await this.authSecurityNotificationService.notifyOAuthLinked({ userId, provider });
          break;
        }
      }
    } catch (error) {
      this.logger.error({
        event: 'auth_security_notification_failed',
        aggregateType: event.aggregateType,
        eventType: event.eventType,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
