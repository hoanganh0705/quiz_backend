/**
 * User Notification Service
 *
 * Composes and sends notifications related to user profile and settings changes.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NotificationChannelService } from '../../infrastructure/adapters/notification-channel.service';

export interface UserProfileUpdatedParams {
  userId: string;
  changedFields: ReadonlyArray<'displayName' | 'bio' | 'avatarUrl'>;
}

@Injectable()
export class UserNotificationService {
  constructor(
    private readonly channelService: NotificationChannelService,
    @InjectPinoLogger(UserNotificationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Notify the user that their profile was updated (e.g., from another session or admin action).
   * This is a confirmation/audit notification for the user.
   */
  async notifyProfileUpdated(params: UserProfileUpdatedParams): Promise<void> {
    const fieldLabels: Record<string, string> = {
      displayName: 'display name',
      bio: 'bio',
      avatarUrl: 'avatar',
    };

    const changed = params.changedFields.map((f) => fieldLabels[f] ?? f).join(', ');

    const body = `Your profile was updated: ${changed}`;

    await this.channelService.send({
      userId: params.userId,
      type: 'profile_updated',
      title: 'Profile Updated',
      body,
      metadata: {
        changedFields: params.changedFields,
      },
    });

    this.logger.info({
      event: 'profile_updated_notification_sent',
      userId: params.userId,
      changedFields: params.changedFields,
    });
  }

  /**
   * Notify the user that their settings were updated.
   */
  async notifySettingsUpdated(params: { userId: string }): Promise<void> {
    const body = 'Your account settings have been updated';

    await this.channelService.send({
      userId: params.userId,
      type: 'settings_updated',
      title: 'Settings Updated',
      body,
      metadata: {},
    });

    this.logger.info({
      event: 'settings_updated_notification_sent',
      userId: params.userId,
    });
  }
}
