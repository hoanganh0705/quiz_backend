/**
 * Notification Channel Service
 *
 * Routes notifications to appropriate channels (in-app, email, push).
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NotificationChannel, NotificationType } from '../types/notification.types';
import { NOTIFICATION_REPOSITORY_PORT } from '../../infrastructure/repositories/notification.repository';
import type { NotificationRepositoryPort } from '../../infrastructure/repositories/notification.repository';

@Injectable()
export class NotificationChannelService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly notificationRepository: NotificationRepositoryPort,
    @InjectPinoLogger(NotificationChannelService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Send a notification through appropriate channels.
   */
  async send(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    channels?: NotificationChannel[];
  }): Promise<void> {
    const channels = params.channels ?? [NotificationChannel.IN_APP];

    for (const channel of channels) {
      await this.sendToChannel(params, channel);
    }
  }

  private async sendToChannel(
    params: {
      userId: string;
      type: NotificationType;
      title: string;
      body: string;
      metadata?: Record<string, unknown>;
    },
    channel: NotificationChannel,
  ): Promise<void> {
    const notification = await this.notificationRepository.createNotification({
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      metadata: params.metadata,
      channel,
    });

    switch (channel) {
      case NotificationChannel.IN_APP:
        await this.sendInApp(notification);
        break;
      case NotificationChannel.EMAIL:
        await this.sendEmail(notification);
        break;
      case NotificationChannel.PUSH:
        await this.sendPush(notification);
        break;
    }
  }

  private sendInApp(notification: {
    id: string;
    userId: string;
    title: string;
    body: string;
  }): Promise<void> {
    this.logger.info({
      event: 'in_app_notification_sent',
      notificationId: notification.id,
      userId: notification.userId,
      channel: 'in_app',
    });

    return Promise.resolve();
  }

  private sendEmail(notification: {
    id: string;
    userId: string;
    title: string;
    body: string;
  }): Promise<void> {
    this.logger.info({
      event: 'email_notification_queued',
      notificationId: notification.id,
      userId: notification.userId,
      channel: 'email',
    });

    return Promise.resolve();
  }

  private sendPush(notification: {
    id: string;
    userId: string;
    title: string;
    body: string;
  }): Promise<void> {
    this.logger.info({
      event: 'push_notification_queued',
      notificationId: notification.id,
      userId: notification.userId,
      channel: 'push',
    });

    return Promise.resolve();
  }
}
