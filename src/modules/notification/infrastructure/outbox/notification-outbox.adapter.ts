import { Inject, Injectable, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import { eq, and, isNull, sql, asc } from 'drizzle-orm';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import {
  NOTIFICATION_DOMAIN_EVENT_BUS,
  type NotificationDomainEventBus,
} from '@/modules/notification/domain/events/notification-domain.event-bus';
import {
  TransactionalContext,
  TRANSACTIONAL_CONTEXT,
} from '@/common/interceptors/transactional-context';

export interface NotificationOutboxEvent {
  notificationId: string;
  userId: string;
  type: string;
  channel: string;
}

const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 1000;
const BATCH_SIZE = 100;
const LOCK_TTL_MS = 60 * 1000;

@Injectable()
export class NotificationOutboxAdapter {
  private isShuttingDown = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Optional()
    @Inject(TRANSACTIONAL_CONTEXT)
    private readonly transactionalContext?: TransactionalContext,
    @Optional()
    @Inject(NOTIFICATION_DOMAIN_EVENT_BUS)
    private readonly eventBus?: NotificationDomainEventBus,
    @Optional()
    @Inject(CACHE_PROVIDER)
    private readonly cache?: CacheProvider,
    @Optional()
    @InjectPinoLogger(NotificationOutboxAdapter.name)
    private readonly logger?: PinoLogger,
  ) {}

  onModuleDestroy(): void {
    this.isShuttingDown = true;
    this.logger?.info({ event: 'notification_outbox_shutdown' });
  }

  async writeEvent(event: NotificationOutboxEvent, idempotencyKey?: string): Promise<void> {
    const tx = this.transactionalContext?.getDbClient() as DrizzleDB | null;
    if (!tx) {
      throw new Error(
        'NotificationOutboxAdapter.writeEvent must be called within a @Transactional() context to guarantee atomicity with the notification insert',
      );
    }

    await tx.insert(outboxEvents).values({
      aggregateType: 'notification',
      eventType: 'notification.sent',
      payload: event as unknown as Record<string, unknown>,
      idempotencyKey,
      nextAttemptAt: new Date().toISOString(),
    });

    this.logger?.debug({
      event: 'notification_outbox_event_written',
      notificationId: event.notificationId,
      userId: event.userId,
      idempotencyKey,
    });
  }

  @Cron('*/5 * * * * *')
  async processOutbox(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    const lockKey = 'notification:outbox:processor';

    if (this.cache) {
      const lockToken = await this.cache.acquireAdvisoryLock(lockKey, LOCK_TTL_MS);
      if (lockToken === null) {
        this.logger?.debug({ event: 'notification_outbox_skipped_lock_held' });
        return;
      }

      try {
        await this.processBatch();
      } catch (error) {
        this.logger?.error({
          event: 'notification_outbox_process_failed',
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        await this.cache.releaseAdvisoryLock(lockKey, lockToken);
      }
      return;
    }

    try {
      await this.processBatch();
    } catch (error) {
      this.logger?.error({
        event: 'notification_outbox_process_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async processBatch(): Promise<void> {
    const events = await this.db
      .select()
      .from(outboxEvents)
      .where(
        and(
          isNull(outboxEvents.processedAt),
          isNull(outboxEvents.failedAt),
          sql`next_attempt_at <= NOW()`,
        ),
      )
      .orderBy(asc(outboxEvents.createdAt))
      .limit(BATCH_SIZE);

    if (events.length === 0) {
      return;
    }

    this.logger?.info({
      event: 'notification_outbox_batch_start',
      eventCount: events.length,
    });

    await Promise.all(events.map((event) => this.processEvent(event)));
  }

  private async processEvent(event: typeof outboxEvents.$inferSelect): Promise<void> {
    const payload = event.payload as NotificationOutboxEvent;

    try {
      await this.dispatchEvent(payload);

      await this.db
        .update(outboxEvents)
        .set({
          processedAt: new Date().toISOString(),
          attemptCount: event.attemptCount + 1,
          lastAttemptAt: new Date().toISOString(),
          lastError: null,
        })
        .where(eq(outboxEvents.eventId, event.eventId));

      this.logger?.info({
        event: 'notification_outbox_event_processed',
        eventId: event.eventId,
        notificationId: payload.notificationId,
      });
    } catch (error) {
      const newAttemptCount = event.attemptCount + 1;
      const isFinalAttempt = newAttemptCount >= MAX_RETRY_ATTEMPTS;

      const nextAttemptAt = new Date(
        Date.now() + this.calculateBackoff(newAttemptCount),
      ).toISOString();

      await this.db
        .update(outboxEvents)
        .set({
          attemptCount: newAttemptCount,
          lastAttemptAt: new Date().toISOString(),
          lastError: error instanceof Error ? error.message : String(error),
          nextAttemptAt,
          failedAt: isFinalAttempt ? new Date().toISOString() : null,
          dlqReason: isFinalAttempt ? `Max retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded` : null,
        })
        .where(eq(outboxEvents.eventId, event.eventId));

      if (isFinalAttempt) {
        this.logger?.error({
          event: 'notification_outbox_event_dlq',
          eventId: event.eventId,
          notificationId: payload.notificationId,
          reason: `Max retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded`,
        });
      } else {
        this.logger?.warn({
          event: 'notification_outbox_event_retry',
          eventId: event.eventId,
          notificationId: payload.notificationId,
          attemptCount: newAttemptCount,
          nextRetryAt: nextAttemptAt,
        });
      }
    }
  }

  private async dispatchEvent(event: NotificationOutboxEvent): Promise<void> {
    await Promise.resolve();

    this.logger?.debug({
      event: 'notification_outbox_dispatch',
      notificationId: event.notificationId,
      userId: event.userId,
    });

    if (!this.eventBus) {
      throw new Error('NotificationDomainEventBus is not available for outbox dispatch');
    }

    this.eventBus.emit({
      eventType: 'notification.sent',
      notificationId: event.notificationId,
      userId: event.userId,
      type: event.type,
      channel: event.channel,
      timestamp: new Date(),
    });
  }

  private calculateBackoff(attemptCount: number): number {
    return Math.min(INITIAL_RETRY_DELAY_MS * Math.pow(2, attemptCount - 1), 60 * 1000);
  }

  async triggerProcessing(): Promise<{ processed: number; failed: number }> {
    this.logger?.info({ event: 'notification_outbox_manual_trigger' });

    const beforeCounts = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(outboxEvents)
      .where(and(isNull(outboxEvents.processedAt), isNull(outboxEvents.failedAt)));

    const failedBefore = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(outboxEvents)
      .where(and(isNull(outboxEvents.processedAt), sql`failed_at IS NOT NULL`));

    await this.processBatch();

    const afterCounts = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(outboxEvents)
      .where(and(isNull(outboxEvents.processedAt), isNull(outboxEvents.failedAt)));

    const failedAfter = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(outboxEvents)
      .where(and(isNull(outboxEvents.processedAt), sql`failed_at IS NOT NULL`));

    const processed = Number(beforeCounts[0]?.count ?? 0) - Number(afterCounts[0]?.count ?? 0);
    const failed = Number(failedAfter[0]?.count ?? 0) - Number(failedBefore[0]?.count ?? 0);

    return { processed, failed };
  }
}
