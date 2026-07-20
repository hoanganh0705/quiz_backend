import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ReviewOutboxProcessorService } from './review-outbox-processor.service';

/**
 * Cron schedule for the review outbox processor.
 *
 * Phase 1 / Issue #3 — every 30 seconds the worker drains pending
 * `outbox_events` rows whose `aggregate_type = 'review'` and
 * forwards them to the quiz analytics handler. The interval is
 * tight enough that, in steady state, the latency from
 * "review committed" to "stats refreshed" is bounded by this cron
 * tick rather than by some external scheduler.
 */
@Injectable()
export class ReviewOutboxSchedulerService {
  constructor(
    private readonly reviewOutboxProcessor: ReviewOutboxProcessorService,
    @InjectPinoLogger(ReviewOutboxSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleOutboxTick(): Promise<void> {
    try {
      const summary = await this.reviewOutboxProcessor.processPendingEvents();
      if (summary.processed > 0 || summary.failed > 0) {
        this.logger.info({
          event: 'review_outbox_tick',
          ...summary,
        });
      }
    } catch (error) {
      this.logger.error({
        event: 'review_outbox_tick_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
