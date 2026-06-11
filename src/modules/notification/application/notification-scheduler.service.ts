import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NOTIFICATION_REPOSITORY_PORT, type NotificationRepositoryPort } from '../domain/ports';

@Injectable()
export class NotificationSchedulerService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly notificationRepository: NotificationRepositoryPort,
    @InjectPinoLogger(NotificationSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Permanently removes expired notifications.
   * Runs once per hour to clean up notifications that have passed their expiresAt timestamp.
   */
  @Cron('0 * * * *')
  async handleExpiredNotifications(): Promise<void> {
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
}
