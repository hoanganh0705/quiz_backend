import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ReviewOutboxProcessorService } from './review-outbox-processor.service';

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
