import { Cron } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DailyChallengeXpOutboxProcessorService } from './daily-challenge-xp-outbox-processor.service';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

const OUTBOX_LOCK_KEY = 'daily-challenge-xp:outbox:lock';
const OUTBOX_LOCK_TTL_MS = 60_000;

@Injectable()
export class DailyChallengeXpOutboxSchedulerService {
  constructor(
    private readonly processor: DailyChallengeXpOutboxProcessorService,
    @Inject(CACHE_PROVIDER) private readonly cache: CacheProvider,
    @InjectPinoLogger(DailyChallengeXpOutboxSchedulerService.name)
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
          event: 'daily_challenge_xp_outbox_tick',
          ...summary,
        });
      }
    } catch (error) {
      this.logger.error({
        event: 'daily_challenge_xp_outbox_tick_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      await this.cache.releaseAdvisoryLock(OUTBOX_LOCK_KEY, lockToken);
    }
  }
}
