import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import { QuizAnalyticsService } from '@/modules/quiz/domain/analytics';

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
export class ReviewOutboxProcessorService {
  private static readonly BATCH_SIZE = 100;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly quizAnalyticsService: QuizAnalyticsService,
    @InjectPinoLogger(ReviewOutboxProcessorService.name)
    private readonly logger: PinoLogger,
  ) {}

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
      .limit(ReviewOutboxProcessorService.BATCH_SIZE);

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
              processedAt: nowIso,
              attemptCount,
            })
            .where(eq(outboxEvents.eventId, event.eventId));

          this.logger.error({
            event: 'review_outbox_poison',
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
    await this.quizAnalyticsService.refreshReviewMetrics(quizId);
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
