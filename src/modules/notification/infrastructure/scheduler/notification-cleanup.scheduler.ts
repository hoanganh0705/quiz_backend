import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NOTIFICATION_REPOSITORY_PORT, type NotificationRepositoryPort } from '../../domain/ports';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import { REDIS_CIRCUIT_PORT, type RedisCircuitPort } from '@/common/ports/redis-circuit.port';
import { acquireSchedulerLockOrRecordSkip } from '@/core/redis/scheduler-lock.helper';
import { MetricsRegistry } from '@/core/observability/metrics.registry';

const NOTIFICATION_CLEANUP_LOCK_KEY = 'notification:cron:cleanup';
const NOTIFICATION_CLEANUP_LOCK_TTL_MS = 60 * 1000;
const NOTIFICATION_CLEANUP_JOB = 'notification-cleanup';

@Injectable()
export class NotificationCleanupScheduler implements OnModuleDestroy {
  private isShuttingDown = false;

  constructor(
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly notificationRepository: NotificationRepositoryPort,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    @Inject(REDIS_CIRCUIT_PORT)
    private readonly redisCircuit: RedisCircuitPort,
    @Optional()
    private readonly metrics: MetricsRegistry | undefined,
    @InjectPinoLogger(NotificationCleanupScheduler.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleDestroy(): void {
    this.isShuttingDown = true;
    this.logger.info({ event: 'notification_cleanup_scheduler_shutdown' });
  }
  @Cron('0 * * * *')
  async handleExpiredNotifications(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.debug({
        event: 'notification_expired_cleanup_skipped_shutdown',
      });
      return;
    }

    const lockToken = await this.acquireLockOrSkip();
    if (lockToken === null) return;
    try {
      await this.runCleanup('cron');
    } finally {
      await this.cache.releaseAdvisoryLock(NOTIFICATION_CLEANUP_LOCK_KEY, lockToken);
    }
  }
  async triggerCleanup(): Promise<number> {
    this.logger.info({ event: 'notification_cleanup_manual_trigger' });

    return this.runCleanup('manual');
  }

  private async acquireLockOrSkip(): Promise<string | null> {
    const result = await acquireSchedulerLockOrRecordSkip({
      cache: this.cache,
      circuit: this.redisCircuit,
      metrics: this.metrics,
      lockKey: NOTIFICATION_CLEANUP_LOCK_KEY,
      lockTtlMs: NOTIFICATION_CLEANUP_LOCK_TTL_MS,
      job: NOTIFICATION_CLEANUP_JOB,
    });
    if (result.acquired) return result.token;
    this.logger.debug({
      event: 'notification_expired_cleanup_skipped_lock_held',
      reason: result.reason,
    });
    return null;
  }

  private async runCleanup(origin: 'cron' | 'manual'): Promise<number> {
    const startEvent =
      origin === 'cron'
        ? 'notification_expired_cleanup_start'
        : 'notification_cleanup_manual_start';
    const completeEvent =
      origin === 'cron'
        ? 'notification_expired_cleanup_complete'
        : 'notification_cleanup_manual_complete';
    const failEvent =
      origin === 'cron'
        ? 'notification_expired_cleanup_failed'
        : 'notification_cleanup_manual_failed';

    this.logger.info({ event: startEvent });
    try {
      const deletedCount = await this.notificationRepository.deleteExpired();
      this.logger.info({ event: completeEvent, deletedCount });
      return deletedCount;
    } catch (error) {
      this.logger.error({
        event: failEvent,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
