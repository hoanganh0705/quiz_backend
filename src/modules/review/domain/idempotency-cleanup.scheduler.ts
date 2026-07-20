import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  IDEMPOTENCY_SERVICE,
  type IdempotencyService as IdempotencyServiceContract,
} from './idempotency.service';

/**
 * Phase 3 / Issue #14 — periodic cleanup of expired rows in
 * `idempotency_keys`.
 *
 * Why this is needed
 * ------------------
 *
 * `IdempotencyService.checkAndSet` writes a row with
 * `expiresAt = now + 24h`, and the existing
 * `IdempotencyService.deleteExpired()` method already knows how to
 * delete them. But it was never scheduled, so rows accumulate
 * forever. Under reporting load (where a single reviewer may be the
 * target of mass reports from many distinct users, each generating a
 * fresh idempotency key per request) the table bloats without bound
 * and the per-key hash index starts to scan through garbage.
 *
 * Schedule
 * --------
 *
 * Daily at 03:17 — chosen as a low-traffic minute, distinct from
 * the other 03:xx cron jobs (the analytics scheduler also runs in
 * this window). The exact minute is not load-bearing; what matters
 * is that the sweep runs once a day.
 *
 * Failure mode
 * ------------
 *
 * If the cleanup DELETE throws, the cron tick logs the error and
 * returns. The next tick tries again; idempotency correctness is
 * not affected. The cleanup is best-effort.
 */
@Injectable()
export class IdempotencyCleanupScheduler {
  constructor(
    @Inject(IDEMPOTENCY_SERVICE)
    private readonly idempotencyService: IdempotencyServiceContract,
    @InjectPinoLogger(IdempotencyCleanupScheduler.name)
    private readonly logger: PinoLogger,
  ) {}

  // Daily at 03:17. CronExpression.EVERY_DAY_AT_MIDNIGHT is not
  // exposed by `@nestjs/schedule`; we use the explicit 6-tuple form
  // documented at https://crontab.guru (sec min hour dom mon dow).
  @Cron('17 3 * * *')
  async handleCleanupTick(): Promise<void> {
    try {
      const deleted = await this.idempotencyService.deleteExpired();
      if (deleted > 0) {
        this.logger.info({ event: 'idempotency_cleanup', deleted });
      } else {
        this.logger.debug({ event: 'idempotency_cleanup', deleted });
      }
    } catch (error) {
      this.logger.error({
        event: 'idempotency_cleanup_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
