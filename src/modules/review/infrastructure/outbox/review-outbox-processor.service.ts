import { Cron } from '@nestjs/schedule';
import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { and, asc, eq, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import {
  REVIEW_DOMAIN_EVENT_BUS,
  ReviewSubmittedEvent,
  type ReviewDomainEventBusPort,
} from '@/modules/review/domain/events';

const POISON_THRESHOLD = 10;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 15 * 60_000;

export class ReviewOutboxPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewOutboxPayloadError';
  }
}

@Injectable()
export class ReviewOutboxProcessorService implements OnModuleDestroy {
  private static readonly BATCH_SIZE = 100;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(REVIEW_DOMAIN_EVENT_BUS)
    private readonly reviewEventBus: ReviewDomainEventBusPort,
    @InjectPinoLogger(ReviewOutboxProcessorService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleDestroy(): void {}

  async processPendingEvents(): Promise<{ processed: number; failed: number }> {
    const nowIso = new Date().toISOString();

    const events = await this.db
      .select({
        eventId: outboxEvents.eventId,
        eventType: outboxEvents.eventType,
        payload: outboxEvents.payload,
        attemptCount: outboxEvents.attemptCount,
      })
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.aggregateType, 'review'),
          isNull(outboxEvents.processedAt),
          lte(outboxEvents.nextAttemptAt, nowIso),
        ),
      )
      .orderBy(asc(outboxEvents.createdAt))
      .limit(ReviewOutboxProcessorService.BATCH_SIZE)
      .for('update', { skipLocked: true });

    if (events.length === 0) {
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    for (const event of events) {
      try {
        await this.dispatchEvent(event);
        await this.db
          .update(outboxEvents)
          .set({ processedAt: nowIso, lastAttemptAt: nowIso, lastError: null })
          .where(and(eq(outboxEvents.eventId, event.eventId), isNull(outboxEvents.processedAt)));

        processed += 1;
        this.logger.debug({
          event: 'review_outbox_processed',
          eventType: event.eventType,
        });
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : 'unknown';
        const attemptCount = Number(event.attemptCount ?? 0) + 1;

        if (error instanceof ReviewOutboxPayloadError || attemptCount >= POISON_THRESHOLD) {
          await this.db
            .update(outboxEvents)
            .set({
              lastError: message,
              lastAttemptAt: nowIso,
              nextAttemptAt: sql`NULL`,
              failedAt: nowIso,
              dlqReason: `poison_threshold_exceeded:${message}`,
              attemptCount,
            })
            .where(eq(outboxEvents.eventId, event.eventId));

          this.logger.error({
            event: 'review_outbox_dlq',
            eventType: event.eventType,
            eventId: event.eventId,
            attemptCount,
            message,
          });
          continue;
        }

        const retryIso = new Date(Date.now() + computeBackoffMs(attemptCount)).toISOString();
        await this.db
          .update(outboxEvents)
          .set({
            lastError: message,
            lastAttemptAt: nowIso,
            nextAttemptAt: retryIso,
            attemptCount,
          })
          .where(eq(outboxEvents.eventId, event.eventId));

        this.logger.error({
          event: 'review_outbox_process_failed',
          eventType: event.eventType,
          eventId: event.eventId,
          attemptCount,
          message,
        });
      }
    }

    return { processed, failed };
  }

  private async dispatchEvent(event: {
    eventId: string;
    eventType: string;
    payload: unknown;
  }): Promise<void> {
    const quizId = readQuizId(event.payload);
    if (!quizId) {
      throw new ReviewOutboxPayloadError('payload missing quizId');
    }

    const payload = (event.payload ?? {}) as Record<string, unknown>;
    this.reviewEventBus.dispatchToSubscribers(
      new ReviewSubmittedEvent({
        quizId,

        quizTitle: typeof payload['quizTitle'] === 'string' ? payload['quizTitle'] : '',
        quizCreatorId: typeof payload['quizCreatorId'] === 'string' ? payload['quizCreatorId'] : '',

        reviewId: '',
        userId: '',
        rating: 0,
      }),
    );
  }

  @Cron('*/5 * * * *')
  async monitorDeadLetterQueue(): Promise<void> {
    const rows = await this.db
      .select({
        eventId: outboxEvents.eventId,
        aggregateType: outboxEvents.aggregateType,
        eventType: outboxEvents.eventType,
        attemptCount: outboxEvents.attemptCount,
        failedAt: outboxEvents.failedAt,
        dlqReason: outboxEvents.dlqReason,
        lastError: outboxEvents.lastError,
      })
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.aggregateType, 'review'),
          isNull(outboxEvents.processedAt),
          isNotNull(outboxEvents.failedAt),
          isNotNull(outboxEvents.dlqReason),
        ),
      )
      .limit(1000);

    if (rows.length === 0) {
      return;
    }

    this.logger.error({
      event: 'review_outbox_dlq_alert',
      totalDlqEvents: rows.length,
      sampleEventIds: rows.slice(0, 5).map((e) => e.eventId),
    });
  }
}

function computeBackoffMs(attemptCount: number): number {
  const exponential = BASE_BACKOFF_MS * 2 ** Math.max(0, attemptCount - 1);
  return Math.min(exponential, MAX_BACKOFF_MS);
}

function readQuizId(payload: unknown): string | null {
  if (payload == null || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const value = record['quizId'];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
