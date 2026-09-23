/**
 * Attempt XP Outbox Scheduler
 *
 * Drains `attempt.xp_to_publish` outbox rows every 15 seconds. Mirrors
 * `TournamentOutboxSchedulerService` so the attempt XP publish path
 * recovers automatically from Redis outages without manual intervention.
 */

import { Cron } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AttemptXpOutboxProcessorService } from './attempt-xp-outbox-processor.service';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

const OUTBOX_LOCK_KEY = 'attempt-xp:outbox:lock';
const OUTBOX_LOCK_TTL_MS = 60_000;

@Injectable()
export class AttemptXpOutboxSchedulerService {
  constructor(
    private readonly processor: AttemptXpOutboxProcessorService,
    @Inject(CACHE_PROVIDER) private readonly cache: CacheProvider,
    @InjectPinoLogger(AttemptXpOutboxSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  @Cron('*/15 * * * * *')
  async handleOutboxTick(): Promise<void> {
    const lockToken = await this.cache.acquireAdvisoryLock(OUTBOX_LOCK_KEY, OUTBOX_LOCK_TTL_MS);
    if (lockToken === null) {
      return;
    }

    try {
      const summary = await this.processor.processPendingEvents();
      if (summary.processed > 0 || summary.failed > 0) {
        this.logger.info({
          event: 'attempt_xp_outbox_tick',
          ...summary,
        });
      }
    } catch (error) {
      this.logger.error({
        event: 'attempt_xp_outbox_tick_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      await this.cache.releaseAdvisoryLock(OUTBOX_LOCK_KEY, lockToken);
    }
  }
}
