import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNull, lte } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import { AuthAuditLogService } from '../audit/auth-audit-log.service';
import { correlationIdStorage, createCorrelationId } from '@/common/interceptors/correlation-id';
import {
  AuthSecurityNotificationService,
} from '@/modules/notification/domain/services/auth-security-notification.service';

type OutboxEventRow = {
  eventId: string;
  aggregateType: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attemptCount: number;
  correlationId: string | null;
};

@Injectable()
export class OutboxProcessorService {
  private static readonly BATCH_SIZE = 100;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly authAuditLogService: AuthAuditLogService,
    private readonly authSecurityNotificationService: AuthSecurityNotificationService,
    @InjectPinoLogger(OutboxProcessorService.name) private readonly logger: PinoLogger,
  ) {}

  @Cron('*/30 * * * * *')
  async processPendingEvents(): Promise<void> {
    const nowIso = new Date().toISOString();

    const events = await this.db
      .select({
        eventId: outboxEvents.eventId,
        aggregateType: outboxEvents.aggregateType,
        eventType: outboxEvents.eventType,
        payload: outboxEvents.payload,
        createdAt: outboxEvents.createdAt,
        attemptCount: outboxEvents.attemptCount,
        correlationId: outboxEvents.correlationId,
      })
      .from(outboxEvents)
      .where(and(isNull(outboxEvents.processedAt), lte(outboxEvents.nextAttemptAt, nowIso)))
      .orderBy(asc(outboxEvents.createdAt))
      .limit(OutboxProcessorService.BATCH_SIZE);

    if (events.length === 0) {
      return;
    }

    let processedCount = 0;
    let failedCount = 0;

    for (const event of events as OutboxEventRow[]) {
      try {
        await this.dispatch(event, nowIso);

        await this.db
          .update(outboxEvents)
          .set({
            processedAt: nowIso,
            lastAttemptAt: nowIso,
            attemptCount: event.attemptCount + 1,
            lastError: null,
          })
          .where(and(eq(outboxEvents.eventId, event.eventId), isNull(outboxEvents.processedAt)));

        processedCount += 1;
      } catch (error) {
        failedCount += 1;

        const nextAttemptCount = event.attemptCount + 1;
        const nextAttemptAt = this.authAuditLogService.buildNextAttemptIso(
          nextAttemptCount,
          nowIso,
        );
        const lastError = error instanceof Error ? error.message : 'Unknown error';

        await this.db
          .update(outboxEvents)
          .set({
            attemptCount: nextAttemptCount,
            lastAttemptAt: nowIso,
            nextAttemptAt,
            lastError,
          })
          .where(and(eq(outboxEvents.eventId, event.eventId), isNull(outboxEvents.processedAt)));

        if (nextAttemptCount >= this.authAuditLogService.maxOutboxRetries) {
          this.logger.error({
            event: 'auth_outbox_event_exhausted_retries',
            outboxEventId: event.eventId,
            aggregateType: event.aggregateType,
            eventType: event.eventType,
            attemptCount: nextAttemptCount,
            message: lastError,
          });
        } else {
          this.logger.warn({
            event: 'auth_outbox_event_retry_scheduled',
            outboxEventId: event.eventId,
            aggregateType: event.aggregateType,
            eventType: event.eventType,
            attemptCount: nextAttemptCount,
            nextAttemptAt,
            message: lastError,
          });
        }
      }
    }

    this.logger.info({
      event: 'auth_outbox_processor_completed',
      processedCount,
      failedCount,
      scannedCount: events.length,
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

  private async dispatch(event: OutboxEventRow, nowIso: string): Promise<void> {
    const userId = this.readString(event.payload.userId);
    const ipAddress =
      this.readOptionalString(event.payload.ipAddress) ??
      this.readOptionalString(event.payload.revokedByIp);
    const correlationId = event.correlationId ?? createCorrelationId();

    await correlationIdStorage.run({ correlationId }, async () => {
      switch (`${event.aggregateType}:${event.eventType}`) {
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
            eventType: event.eventType,
            userId: userId ?? undefined,
            ipAddress,
            metadata: {
              aggregateType: event.aggregateType,
              ...event.payload,
            },
            createdAt: nowIso,
          });
          await this.sendSecurityNotification(event, userId, ipAddress);
          return;
        }
        default:
          throw new Error(
            `Unsupported outbox event dispatcher key: ${event.aggregateType}:${event.eventType}`,
          );
      }
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
          await this.authSecurityNotificationService.notifyPasswordResetRequested({ userId, ipAddress });
          break;

        case 'password_reset:password_reset_completed':
          await this.authSecurityNotificationService.notifyPasswordResetCompleted({ userId, ipAddress });
          break;

        case 'account:account_deleted':
          await this.authSecurityNotificationService.notifyAccountDeleted({ userId, ipAddress });
          break;

        case 'session:session_revoked': {
          const sessionId = this.readString(event.payload.sessionId) ?? 'unknown';
          await this.authSecurityNotificationService.notifySessionRevoked({ userId, sessionId, ipAddress });
          break;
        }

        case 'session:all_other_sessions_revoked': {
          const count =
            typeof event.payload.revokedSessionCount === 'number'
              ? event.payload.revokedSessionCount
              : 0;
          await this.authSecurityNotificationService.notifyAllSessionsRevoked({
            userId,
            revokedSessionCount: count,
            ipAddress,
          });
          break;
        }

        case 'oauth_account:oauth_account_linked': {
          const provider = this.readString(event.payload.provider) ?? 'unknown';
          await this.authSecurityNotificationService.notifyOAuthLinked({ userId, provider });
          break;
        }

        case 'oauth_account:oauth_account_created': {
          const provider = this.readString(event.payload.provider) ?? 'unknown';
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
