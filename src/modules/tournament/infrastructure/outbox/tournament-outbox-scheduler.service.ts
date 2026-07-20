/**
 * Tournament Outbox Scheduler Service
 *
 * Drives the tournament outbox processor on a fixed cadence. Wraps each
 * drain call in a Redis advisory lock so only one replica processes the
 * outbox at a time in a multi-instance deployment.
 *
 * Phase 3 / Issue #5 — the outbox scheduler replaces the previous pattern
 * where events were dispatched directly from the service layer after the
 * transaction committed. Now events are durably persisted in the outbox
 * table inside the same transaction as the business write, and this
 * scheduler is the only path that reads and dispatches them.
 */

import { Cron } from '@nestjs/schedule';
import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TournamentOutboxProcessorService } from './tournament-outbox-processor.service';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

const OUTBOX_LOCK_KEY = 'tournament:outbox:lock';
const OUTBOX_LOCK_TTL_MS = 60_000; // 1 minute — longer than expected drain time

@Injectable()
export class TournamentOutboxSchedulerService {
  private readonly lockToken: string = crypto.randomUUID();

  constructor(
    private readonly tournamentOutboxProcessor: TournamentOutboxProcessorService,
    @Inject(CACHE_PROVIDER) private readonly cache: CacheProvider,
    @InjectPinoLogger(TournamentOutboxSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Drain tournament outbox events every 15 seconds.
   *
   * Runs on every replica but only the replica that acquires the distributed
   * lock will actually process events. This prevents duplicate processing
   * in multi-instance deployments.
   */
  @Cron('*/15 * * * * *') // Every 15 seconds
  async handleOutboxTick(): Promise<void> {
    const lockAcquired = await this.cache.acquireAdvisoryLock(OUTBOX_LOCK_KEY, OUTBOX_LOCK_TTL_MS);

    if (!lockAcquired) {
      this.logger.debug({
        event: 'tournament_outbox_skipped_lock_not_acquired',
      });
      return;
    }

    try {
      const summary = await this.tournamentOutboxProcessor.processPendingEvents();
      if (summary.processed > 0 || summary.failed > 0) {
        this.logger.info({
          event: 'tournament_outbox_tick',
          ...summary,
        });
      }
    } catch (error) {
      this.logger.error({
        event: 'tournament_outbox_tick_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      await this.cache.releaseAdvisoryLock(OUTBOX_LOCK_KEY, this.lockToken);
    }
  }
}
