import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  IDEMPOTENCY_SERVICE,
  type IdempotencyService as IdempotencyServiceContract,
} from './idempotency.service';

@Injectable()
export class IdempotencyCleanupScheduler {
  constructor(
    @Inject(IDEMPOTENCY_SERVICE)
    private readonly idempotencyService: IdempotencyServiceContract,
    @InjectPinoLogger(IdempotencyCleanupScheduler.name)
    private readonly logger: PinoLogger,
  ) {}

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
