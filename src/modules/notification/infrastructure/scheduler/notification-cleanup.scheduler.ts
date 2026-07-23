/**
 * Notification Cleanup Scheduler
 *
 * Implements the cleanup strategy for expired notifications.
 * Runs hourly to remove notifications that have passed their expiresAt timestamp.
 *
 * Architecture: Per project patterns, schedulers live in infrastructure/scheduler/
 * rather than in the application layer.
 */

import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NOTIFICATION_REPOSITORY_PORT, type NotificationRepositoryPort } from '../../domain/ports';

@Injectable()
export class NotificationCleanupScheduler implements OnModuleDestroy {
  private isShuttingDown = false;

  constructor(
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly notificationRepository: NotificationRepositoryPort,
    @InjectPinoLogger(NotificationCleanupScheduler.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleDestroy(): void {
    this.isShuttingDown = true;
    this.logger.info({ event: 'notification_cleanup_scheduler_shutdown' });
  }

  /**
   * Permanently removes expired notifications.
   * Runs once per hour to clean up notifications that have passed their expiresAt timestamp.
   *
   * Uses soft delete in the repository, but this cleanup job performs hard delete
   * on notifications that have already been soft-deleted (deletedAt is set).
   */
  @Cron('0 * * * *')
  async handleExpiredNotifications(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.debug({
        event: 'notification_expired_cleanup_skipped_shutdown',
      });
      return;
    }

    this.logger.info({ event: 'notification_expired_cleanup_start' });

    try {
      const deletedCount = await this.notificationRepository.deleteExpired();

      this.logger.info({
        event: 'notification_expired_cleanup_complete',
        deletedCount,
      });
    } catch (error) {
      this.logger.error({
        event: 'notification_expired_cleanup_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Manual trigger for notification cleanup.
   * Useful for running cleanup on-demand or after migrations.
   */
  async triggerCleanup(): Promise<number> {
    this.logger.info({ event: 'notification_cleanup_manual_trigger' });

    try {
      const deletedCount = await this.notificationRepository.deleteExpired();
      this.logger.info({
        event: 'notification_cleanup_manual_complete',
        deletedCount,
      });
      return deletedCount;
    } catch (error) {
      this.logger.error({
        event: 'notification_cleanup_manual_failed',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
