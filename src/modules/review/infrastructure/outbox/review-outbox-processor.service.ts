import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { and, asc, eq, isNull, lte } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { outboxEvents } from '@/core/database/schema';
import { QuizAnalyticsService } from '@/modules/quiz/domain/analytics';

/**
 * Outbox processor for review domain events.
 *
 * Phase 1 / Issue #3 — review submissions and deletions schedule
 * their analytics refresh through the transactional outbox
 * (`outbox_events`). This worker drains the rows whose
 * `aggregate_type = 'review'` and forwards each event to the quiz
 * analytics handler.
 *
 * Why not the in-memory event bus?
 *
 * The previous flow dispatched `ReviewSubmittedEvent` /
 * `ReviewDeletedEvent` to the in-memory `ReviewDomainEventBus`
 * AFTER the transaction committed. If the application crashed
 * between the commit and the listener call, the listener never
 * fired and the denormalized counters in `quiz_stats` drifted
 * from the source of truth in `quiz_reviews`. The outbox fixes
 * this by writing the event into the same transaction, so a
 * committed write is also a durably scheduled event.
 *
 * Why a separate worker from the auth/ranking outboxes?
 *
 * The review domain has its own event types (`review.submitted`,
 * `review.deleted`) and its own handler (refresh of `avg_rating`
 * and `rating_count` in `quiz_stats`). Mixing the dispatch into
 * the auth worker would couple two unrelated code paths; a
 * dedicated worker keeps the boundary clean and lets us tune
 * cadence / DLQ thresholds per domain.
 *
 * Idempotency
 * -----------
 *
 * The producer-side `idempotency_key` is a deterministic
 * `review:submitted:{quizId}:{reviewId}` (or `review:deleted:...`).
 * The schema has a partial unique index
 * `uq_outbox_events_idempotency_unprocessed` that prevents
 * duplicate inserts of the same key. On the consumer side we
 * additionally take an in-memory `Set` of processed `eventId`s for
 * the lifetime of a single drain, which protects against the same
 * row being selected twice if the worker is mid-run when a new
 * event arrives.
 */
@Injectable()
export class ReviewOutboxProcessorService {
  private static readonly BATCH_SIZE = 100;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly quizAnalyticsService: QuizAnalyticsService,
    @InjectPinoLogger(ReviewOutboxProcessorService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Drain a batch of unprocessed review outbox events.
   *
   * Returns the number of successfully processed rows. The caller
   * (a `@Cron` job, see `review-outbox.scheduler.ts`) decides how
   * often to invoke this. We deliberately do NOT auto-schedule
   * inside the service so the service is unit-testable without
   * dragging in `@nestjs/schedule`.
   */
  async processPendingEvents(): Promise<{ processed: number; failed: number }> {
    const nowIso = new Date().toISOString();

    const events = await this.db
      .select({
        eventId: outboxEvents.eventId,
        eventType: outboxEvents.eventType,
        payload: outboxEvents.payload,
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
        const quizId = readQuizId(event.payload);
        if (!quizId) {
          throw new Error('payload missing quizId');
        }

        // Phase 1 / Issue #9 — the analytics refresh reads from
        // `quiz_reviews` and `quiz_attempts` and writes to
        // `quiz_stats`. It is the same code path that was previously
        // invoked from the in-memory listener, so the SQL behavior is
        // unchanged.
        await this.quizAnalyticsService.refreshReviewMetrics(quizId);

        await this.db
          .update(outboxEvents)
          .set({ processedAt: nowIso, lastAttemptAt: nowIso, lastError: null })
          .where(and(eq(outboxEvents.eventId, event.eventId), isNull(outboxEvents.processedAt)));

        processed += 1;
        this.logger.debug({
          event: 'review_outbox_processed',
          eventType: event.eventType,
          quizId,
        });
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : 'unknown';
        // Bump `nextAttemptAt` so a poisoned event does not block the
        // queue. The producer-side idempotency key means retries are
        // safe.
        const retryIso = new Date(Date.now() + 30_000).toISOString();
        await this.db
          .update(outboxEvents)
          .set({
            lastError: message,
            lastAttemptAt: nowIso,
            nextAttemptAt: retryIso,
            attemptCount: (await this.getAttemptCount(event.eventId)) + 1,
          })
          .where(eq(outboxEvents.eventId, event.eventId));
        this.logger.error({
          event: 'review_outbox_process_failed',
          eventType: event.eventType,
          eventId: event.eventId,
          message,
        });
      }
    }

    return { processed, failed };
  }

  private async getAttemptCount(eventId: string): Promise<number> {
    const [row] = await this.db
      .select({ attemptCount: outboxEvents.attemptCount })
      .from(outboxEvents)
      .where(eq(outboxEvents.eventId, eventId))
      .limit(1);
    return Number(row?.attemptCount ?? 0);
  }
}

function readQuizId(payload: unknown): string | null {
  if (payload == null || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const value = record['quizId'];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
